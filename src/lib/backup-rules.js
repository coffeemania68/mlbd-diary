// 백업 알림·스냅샷·Asset 정리의 판단 규칙. DOM·DB 없음.
import { BACKUP_REMINDER_DAYS, SNAPSHOT_KEEP } from '../config.js';
import { LIVE_TABLES } from './backup-format.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 백업한 적 없으면 작품이 있을 때, 있으면 days일(168시간) 이상 지났을 때 (19.1, 19.2, 19.5) */
export function shouldShowReminder({ lastBackupAt, projectCount, now, days = BACKUP_REMINDER_DAYS }) {
  if (lastBackupAt == null) return projectCount > 0;
  return now - lastBackupAt >= days * DAY_MS;
}

// settings는 작품만 바꿔 열어도 updatedAt이 바뀌어서, assets는 참조하는 Record가 대신 바뀌어서 뺀다
const FINGERPRINT_TABLES = LIVE_TABLES.filter((n) => n !== 'settings' && n !== 'assets');

/** tables → '{"projects":[3,1730000000000],...}' (테이블별 [Record 수, 가장 큰 updatedAt]) */
export function fingerprint(tables) {
  const out = {};
  for (const name of FINGERPRINT_TABLES) {
    const list = tables?.[name] ?? [];
    let max = 0;
    for (const r of list) {
      if (typeof r?.updatedAt === 'number' && r.updatedAt > max) max = r.updatedAt;
    }
    out[name] = [list.length, max];
  }
  return JSON.stringify(out);
}

/** latest: 가장 최근 Snapshot 또는 null (22.3, 22.4) */
export function shouldCreateSnapshot({ hasTodaySnapshot, latest, currentFingerprint, projectCount }) {
  if (hasTodaySnapshot) return false;
  if (!latest) return projectCount > 0;
  return latest.fingerprint !== currentFingerprint;
}

/** createdAt 내림차순 keep개 + protectIds는 남기고 나머지 id (22.6, 23.4) */
export function snapshotsToDelete(snapshots, keep = SNAPSHOT_KEEP, protectIds = []) {
  const protect = new Set(protectIds);
  const sorted = [...snapshots].sort((a, b) => b.createdAt - a.createdAt);
  const kept = new Set(sorted.slice(0, keep).map((s) => s.id));
  return sorted.filter((s) => !kept.has(s.id) && !protect.has(s.id)).map((s) => s.id);
}

/** Asset_Reference: Character.imageAssetId, StorageItem.assetId, image 위젯 data.assetId → Set<assetId> */
export function collectAssetRefs(tables) {
  const refs = new Set();
  const add = (id) => {
    if (id != null) refs.add(id);
  };
  for (const c of tables?.characters ?? []) add(c.imageAssetId);
  for (const s of tables?.storageItems ?? []) add(s.assetId);
  for (const w of tables?.widgets ?? []) {
    if (w.type === 'image') add(w.data?.assetId);
  }
  return refs;
}

/** snapshotRefs는 id들, 또는 Snapshot마다의 assetIds 배열들 */
function toIdSet(ids) {
  const set = new Set();
  for (const v of ids ?? []) {
    if (Array.isArray(v)) v.forEach((id) => set.add(id));
    else set.add(v);
  }
  return set;
}

/** 세 곳(Live 참조, 스냅샷, 핀) 어디에도 없는 Asset id. 입력 순서를 따른다 (24.3, 24.4) */
export function orphanAssetIds(assetIds, { liveRefs, snapshotRefs, pinned }) {
  const live = toIdSet(liveRefs);
  const snap = toIdSet(snapshotRefs);
  const pins = toIdSet(pinned);
  return [...assetIds].filter((id) => !live.has(id) && !snap.has(id) && !pins.has(id));
}

/** 가져온 Settings에 이 기기 값(lastBackupAt, penDetected, penOnly)을 덮는다 (21.7, 23.8) */
export function keepDeviceSettings(imported, device) {
  return {
    ...imported,
    lastBackupAt: device?.lastBackupAt ?? null,
    penDetected: device?.penDetected ?? false,
    penOnly: device?.penOnly ?? false,
  };
}
