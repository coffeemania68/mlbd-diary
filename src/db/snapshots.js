// db/snapshots.js
// 앱 안 자동 보관(Snapshot). 최근 SNAPSHOT_KEEP개만 남긴다 (요구사항 21.2, 22, 23).
// Snapshot은 assets를 뺀 Live_Data를 객체로 들고, 가리키는 Asset id(assetIds)를 Asset_GC가 지킨다.
// 모든 함수의 마지막 인자 database는 테스트용이다. 앱에서는 생략한다.
import { APP_VERSION, SCHEMA_VERSION, SNAPSHOT_KEEP } from '../config.js';
import {
  collectAssetRefs,
  fingerprint,
  shouldCreateSnapshot,
  snapshotsToDelete,
} from '../lib/backup-rules.js';
import { requestAssetGc } from './asset-gc.js';
import { readLiveData, restoreData } from './backup.js';
import { db } from './db.js';
import { newRecord } from './records.js';

const pad2 = (n) => String(n).padStart(2, '0');

/** 기기 지역 날짜 'YYYY-MM-DD' */
export function localDateOf(time) {
  const d = new Date(time);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** { id, createdAt } 목록. data를 읽지 않으려고 색인 키만 읽는다 */
async function snapshotKeys(database) {
  const collection = database.snapshots.orderBy('createdAt');
  const [createdAts, ids] = await Promise.all([collection.keys(), collection.primaryKeys()]);
  return ids.map((id, i) => ({ id, createdAt: createdAts[i] }));
}

/** 회전 대상을 지운다. 이미 열린 rw(snapshots) 트랜잭션 안에서 부른다 */
async function deleteOld(database, protectIds) {
  const ids = snapshotsToDelete(await snapshotKeys(database), SNAPSHOT_KEEP, protectIds);
  if (ids.length > 0) await database.snapshots.bulkDelete(ids);
  return ids;
}

/** 지운 스냅샷이 지키던 Asset 정리 요청. requestAssetGc는 앱 db만 정리하므로 그때만 부른다 */
function afterDelete(deleted, database) {
  if (deleted.length > 0 && database === db) requestAssetGc();
}

/**
 * 지금 Live_Data(assets 제외)로 Snapshot을 만들고 회전한다. 만든 레코드를 돌려준다.
 * protectIds의 스냅샷은 회전에서 지우지 않는다(복원 대상, 23.4).
 * Settings.lastBackupAt은 건드리지 않는다(19.7). now는 테스트용이다.
 */
export async function createSnapshot(
  reason,
  { protectIds = [], now = Date.now() } = {},
  database = db,
) {
  const { tables } = await readLiveData(database, { withAssets: false });
  const record = newRecord(
    {
      localDate: localDateOf(now),
      reason,
      appVersion: APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      projectCount: tables.projects.length,
      fingerprint: fingerprint(tables),
      data: { tables },
      assetIds: [...collectAssetRefs(tables)],
    },
    now,
  );
  const deleted = await database.transaction('rw', database.snapshots, async () => {
    await database.snapshots.add(record);
    return deleteOld(database, [record.id, ...protectIds]);
  });
  afterDelete(deleted, database);
  return record;
}

/** createdAt 내림차순 요약 목록(data 없음) */
export async function listSnapshots(database = db) {
  const list = await database.snapshots.orderBy('createdAt').reverse().toArray();
  return list.map(({ data, ...summary }) => summary);
}

/** 최근 SNAPSHOT_KEEP개만 남기고 지운다(보호 없음). 지운 id 목록을 돌려준다 */
export async function rotateSnapshots(database = db) {
  const deleted = await database.transaction('rw', database.snapshots, () => deleteOld(database, []));
  afterDelete(deleted, database);
  return deleted;
}

// database별 진행 중인 확인. 같은 때 여러 번 불러도 한 번만 만든다
const pendingDaily = new WeakMap();

async function runDailyCheck(now, database) {
  const today = localDateOf(now);
  const hasTodaySnapshot = (await database.snapshots.where('localDate').equals(today).count()) > 0;
  // 오늘 것이 있으면 Live_Data를 읽지 않고 끝낸다
  if (hasTodaySnapshot) return null;
  const [latest, { tables }] = await Promise.all([
    database.snapshots.orderBy('createdAt').last(),
    readLiveData(database, { withAssets: false }),
  ]);
  const create = shouldCreateSnapshot({
    hasTodaySnapshot,
    latest: latest ?? null,
    currentFingerprint: fingerprint(tables),
    projectCount: tables.projects.length,
  });
  return create ? createSnapshot('daily', { now }, database) : null;
}

/**
 * 하루 한 번 자동 보관 (22.1~22.4, 22.8). 만들었으면 레코드, 아니면 null.
 * 진행 중이면 같은 Promise를 돌려준다. 오류는 console.error 후 삼킨다.
 */
export function maybeCreateDailySnapshot({ now = Date.now() } = {}, database = db) {
  const running = pendingDaily.get(database);
  if (running) return running;
  const promise = runDailyCheck(now, database)
    .catch((err) => {
      console.error(err);
      return null;
    })
    .finally(() => pendingDaily.delete(database));
  pendingDaily.set(database, promise);
  return promise;
}

/**
 * Snapshot 하나로 Live_Data를 되돌린다 (23.3~23.9).
 * 대상을 먼저 읽고, 지금 상태를 pre-restore로 보관(대상은 회전에서 지킨다)한 뒤 덮어쓴다.
 * assets는 건드리지 않는다. 대상이 가리키던 Asset은 GC가 지켜 왔다(23.5).
 */
export async function restoreSnapshot(id, { now = Date.now() } = {}, database = db) {
  const target = await database.snapshots.get(id);
  if (!target) throw new Error(`스냅샷이 없습니다: ${id}`);
  await createSnapshot('pre-restore', { protectIds: [id], now }, database);
  await restoreData(
    { schemaVersion: target.schemaVersion, tables: target.data?.tables ?? {} },
    null,
    database,
  );
  await rotateSnapshots(database);
  if (database === db) requestAssetGc();
}
