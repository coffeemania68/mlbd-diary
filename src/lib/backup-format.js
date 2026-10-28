// 백업 파일 형식: 직렬화·검사·Base64 변환. DOM 없음(Blob·atob·btoa는 node 18+에도 있다).
import { BACKUP_FORMAT_ID, SCHEMA_VERSION } from '../config.js';

/** snapshots를 뺀 Live_Data 테이블 14개. 백업 파일 tables의 순서도 이것을 따른다 */
export const LIVE_TABLES = [
  'projects', 'characters', 'synopses', 'plotStructures', 'plotCards', 'timelineEvents',
  'mandalarts', 'episodes', 'storageItems', 'pages', 'widgets', 'inkStrokes', 'settings', 'assets',
];

/** 그 schemaVersion의 백업 파일에 있어야 하는 테이블. 모르는 버전이면 null */
export function backupTablesFor(schemaVersion) {
  if (Number.isInteger(schemaVersion) && schemaVersion >= 1 && schemaVersion <= 3) {
    return [...LIVE_TABLES];
  }
  return null;
}

const CHUNK = 0x8000;
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

/** 0x8000 바이트씩 String.fromCharCode. 큰 배열에서 호출 스택 초과를 막는다 */
export function bytesToBase64(bytes) {
  const parts = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(''));
}

/** 형식(문자 종류, 길이 % 4) 검사에 실패하면 null */
export function base64ToBytes(text) {
  if (typeof text !== 'string' || text.length % 4 !== 0 || !BASE64_RE.test(text)) return null;
  let binary;
  try {
    binary = atob(text);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const pad2 = (n) => String(n).padStart(2, '0');

/** 'MyLastBestDiary-백업-YYYY-MM-DD.json'. 기기 지역 날짜 (18.5) */
export function backupFileName(date) {
  const ymd = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  return `MyLastBestDiary-백업-${ymd}.json`;
}

/**
 * 문자열 조각 배열. Record·Asset 하나마다 조각 하나라 거대한 문자열 하나를 만들지 않는다.
 * tables: assets를 뺀 테이블별 Record 배열(없는 테이블은 []).
 * assets: [{ id, mime, width, height, kind, createdAt, updatedAt, data: Base64 }].
 *   data 대신 bytes(Uint8Array)를 주면 여기서 Base64로 바꾼다. blob은 쓰지 않는다.
 */
export function serializeBackup({ appVersion, schemaVersion, exportedAt, tables, assets }) {
  const at = exportedAt instanceof Date ? exportedAt.toISOString() : exportedAt;
  const head = JSON.stringify({ format: BACKUP_FORMAT_ID, appVersion, schemaVersion, exportedAt: at });
  // 마지막 '}'를 떼고 tables를 이어 쓴다
  const parts = [`${head.slice(0, -1)},"tables":{`];
  const names = (backupTablesFor(schemaVersion) ?? LIVE_TABLES).filter((n) => n !== 'assets');
  for (const name of names) {
    parts.push(`${JSON.stringify(name)}:[`);
    (tables?.[name] ?? []).forEach((record, i) => {
      parts.push(`${i ? ',' : ''}${JSON.stringify(record)}`);
    });
    parts.push('],');
  }
  parts.push('"assets":[');
  (assets ?? []).forEach((asset, i) => {
    const { blob, bytes, data, ...meta } = asset;
    const encoded = typeof data === 'string' ? data : bytesToBase64(bytes ?? new Uint8Array(0));
    parts.push(`${i ? ',' : ''}${JSON.stringify({ ...meta, data: encoded })}`);
  });
  parts.push(']}}');
  return parts;
}

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isRecord = (v) => isPlainObject(v) && typeof v.id === 'string';

/**
 * text → { ok: true, value: { meta, tables, assets: [{ ...meta, bytes }] } }
 *      | { ok: false, error: 'not-backup' | 'corrupt' | 'newer' }
 * 검사 순서는 설계 10절(20장).
 */
export function parseBackup(text, appSchemaVersion = SCHEMA_VERSION) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not-backup' };
  }
  if (!isPlainObject(obj) || obj.format !== BACKUP_FORMAT_ID) return { ok: false, error: 'not-backup' };
  const { appVersion, schemaVersion, exportedAt } = obj;
  if (typeof appVersion !== 'string' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    return { ok: false, error: 'corrupt' };
  }
  if (schemaVersion > appSchemaVersion) return { ok: false, error: 'newer' };

  const names = backupTablesFor(schemaVersion);
  const source = obj.tables;
  if (!names || !isPlainObject(source)) return { ok: false, error: 'corrupt' };
  const tables = {};
  const assets = [];
  for (const name of names) {
    const list = source[name];
    if (!Array.isArray(list) || !list.every(isRecord)) return { ok: false, error: 'corrupt' };
    if (name !== 'assets') {
      tables[name] = list;
      continue;
    }
    for (const asset of list) {
      const { data, ...meta } = asset;
      const bytes = base64ToBytes(data);
      if (!bytes) return { ok: false, error: 'corrupt' };
      asset.data = null;   // 파싱한 객체는 여기서만 쓴다. 큰 Base64 문자열을 바로 놓아준다
      assets.push({ ...meta, bytes });
    }
  }
  return {
    ok: true,
    value: { meta: { format: obj.format, appVersion, schemaVersion, exportedAt }, tables, assets },
  };
}
