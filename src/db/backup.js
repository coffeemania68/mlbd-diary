// db/backup.js
// Live_Data 읽기(백업·스냅샷 공용), 백업 파일 조각 만들기, 복원 (요구사항 18, 21, 23).
// 모든 함수의 마지막 인자 database는 테스트용이다. 앱에서는 생략한다.
import { APP_VERSION, SCHEMA_VERSION } from '../config.js';
import { LIVE_TABLES, bytesToBase64, serializeBackup } from '../lib/backup-format.js';
import { collectAssetRefs, keepDeviceSettings } from '../lib/backup-rules.js';
import { db } from './db.js';
import { planMigrations, runMigrationSteps } from './migrations.js';
import { ensureSettings } from './settings.js';

/** assets를 뺀 13개 Live 테이블. 복원 때 비우고 다시 채우는 범위 */
export const RECORD_TABLES = LIVE_TABLES.filter((name) => name !== 'assets');

/**
 * 'r' 트랜잭션 하나에서 13개 테이블을 읽어 같은 시점의 데이터를 만든다.
 * withAssets면 Asset_Reference가 가리키는 Asset만 bulkGet한다(없는 id는 뺀다) (18.3, 18.4).
 * → { tables: { 테이블 이름: Record[] }, assets: Asset[] }
 */
export async function readLiveData(database = db, { withAssets = true } = {}) {
  const names = withAssets ? LIVE_TABLES : RECORD_TABLES;
  return database.transaction('r', names.map((name) => database.table(name)), async () => {
    const lists = await Promise.all(RECORD_TABLES.map((name) => database.table(name).toArray()));
    const tables = Object.fromEntries(RECORD_TABLES.map((name, i) => [name, lists[i]]));
    let assets = [];
    if (withAssets) {
      const ids = [...collectAssetRefs(tables)];
      assets = (await database.assets.bulkGet(ids)).filter(Boolean);
    }
    return { tables, assets };
  });
}

/** Asset.blob(Blob, 또는 테스트의 Uint8Array·ArrayBuffer) → Uint8Array */
async function blobToBytes(blob) {
  if (blob instanceof Uint8Array) return blob;
  if (blob instanceof ArrayBuffer) return new Uint8Array(blob);
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * 백업 파일 내용을 문자열 조각 배열로 만든다. new File(조각, 이름)에 바로 넘긴다.
 * Asset은 트랜잭션 밖에서 하나씩 bytes → Base64로 바꾸고 bytes 참조를 바로 버린다.
 */
export async function buildExport({ exportedAt = new Date() } = {}, database = db) {
  const { tables, assets } = await readLiveData(database, { withAssets: true });
  const encoded = [];
  for (let i = 0; i < assets.length; i += 1) {
    const { blob, ...meta } = assets[i];
    let bytes = await blobToBytes(blob);
    encoded.push({ ...meta, data: bytesToBase64(bytes) });
    bytes = null;
    assets[i] = null;
  }
  return serializeBackup({
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    tables,
    assets: encoded,
  });
}

/** 복원할 Asset 레코드. blob이 없고 bytes만 있으면 Blob으로 바꾼다(트랜잭션 전에 부른다) */
function toAssetRecord({ bytes, data, blob, ...meta }) {
  return { ...meta, blob: blob ?? new Blob([bytes ?? new Uint8Array(0)], { type: meta.mime }) };
}

/**
 * 가져온 데이터로 Live_Data를 바꾼다. 14개 Live 테이블 rw 트랜잭션 하나(설계 11절).
 *   1. 이 기기의 lastBackupAt·penDetected·penOnly를 읽는다
 *   2. assets를 뺀 13개 테이블 clear → bulkAdd
 *   3. assets가 배열이면 bulkPut(비우지 않는다). null이면 assets 테이블을 건드리지 않는다(스냅샷 복원)
 *   4. schemaVersion < SCHEMA_VERSION이면 변환 규칙 실행 (21.5, 23.6)
 *   5. Settings: 없으면 기본값, 기기 설정 세 필드 유지, schemaVersion = SCHEMA_VERSION (21.7, 23.8)
 * 어느 단계든 실패하면 전부 되돌아간다 (21.6, 23.7).
 * assets: [{ id, mime, width, height, kind, createdAt, updatedAt, blob | bytes }] | null
 */
export async function restoreData({ schemaVersion, tables }, assets, database = db) {
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > SCHEMA_VERSION) {
    throw new Error(`복원할 수 없는 schemaVersion입니다: ${schemaVersion}`);
  }
  // 트랜잭션 전에 끝낸다. IndexedDB가 아닌 비동기 작업을 기다리면 트랜잭션이 닫힌다
  const steps = planMigrations(schemaVersion, SCHEMA_VERSION);
  const assetRecords = Array.isArray(assets) ? assets.map(toAssetRecord) : null;

  await database.transaction('rw', LIVE_TABLES.map((name) => database.table(name)), async (tx) => {
    const current = await database.settings.toCollection().first();
    const device = {
      lastBackupAt: current?.lastBackupAt ?? null,
      penDetected: current?.penDetected ?? false,
      penOnly: current?.penOnly ?? false,
    };

    for (const name of RECORD_TABLES) {
      const table = database.table(name);
      await table.clear();
      const list = tables?.[name] ?? [];
      if (list.length > 0) await table.bulkAdd(list);
    }

    if (assetRecords && assetRecords.length > 0) await database.assets.bulkPut(assetRecords);

    if (steps.length > 0) await runMigrationSteps(tx, steps);

    // 가져온 Settings가 여러 개면 첫 번째만 남긴다(단일 레코드 규칙)
    const imported = await ensureSettings(database, SCHEMA_VERSION);
    await database.settings.clear();
    await database.settings.add({ ...keepDeviceSettings(imported, device), schemaVersion: SCHEMA_VERSION });
  });
}
