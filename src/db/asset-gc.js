// db/asset-gc.js
// 아무도 가리키지 않는 Asset을 지운다 (요구사항 24).
// 참조는 세 곳: Live_Data의 Asset_Reference, 모든 Snapshot.assetIds, 열린 페이지 화면의 핀.
// 이미지 교체·삭제 함수는 Asset을 직접 지우지 않고, 동작이 끝난 뒤 화면이 requestAssetGc()를 부른다.
import { db } from './db.js';
import { collectAssetRefs, orphanAssetIds } from '../lib/backup-rules.js';

/** 열린 페이지 화면(모델·되돌리기 기록)이 쥔 Asset id */
let pinned = new Set();

/** 페이지 화면이 지금 쥔 Asset id 목록으로 바꾼다. 화면을 떠나면 빈 목록 */
export function setPinnedAssets(ids) {
  pinned = new Set(ids ?? []);
}

/**
 * 한 rw 트랜잭션(assets, characters, storageItems, widgets, snapshots)에서
 * 참조 모음 → orphanAssetIds → bulkDelete. 지운 개수를 돌려준다 (24.3, 24.4).
 * 트랜잭션 하나라 실패하면 아무것도 지워지지 않는다.
 */
export async function runAssetGc(database = db, { pins = pinned } = {}) {
  return database.transaction(
    'rw',
    [database.assets, database.characters, database.storageItems, database.widgets, database.snapshots],
    async () => {
      const [assetIds, characters, storageItems, widgets, snapshots] = await Promise.all([
        database.assets.toCollection().primaryKeys(),
        database.characters.toArray(),
        database.storageItems.toArray(),
        database.widgets.toArray(),
        database.snapshots.toArray(),
      ]);
      const liveRefs = collectAssetRefs({ characters, storageItems, widgets });
      const snapshotRefs = snapshots.map((s) => s.assetIds ?? []);
      const orphans = orphanAssetIds(assetIds, { liveRefs, snapshotRefs, pinned: pins });
      if (orphans.length > 0) await database.assets.bulkDelete(orphans);
      return orphans.length;
    },
  );
}

const GC_DELAY_MS = 1000;
let timer = null;

/** 1초 안에 여러 번 불러도 한 번 실행. 오류는 console.error, 아무것도 지우지 않은 채 끝난다 (24.2, 24.7) */
export function requestAssetGc() {
  if (timer != null) return;
  timer = setTimeout(async () => {
    timer = null;
    try {
      await runAssetGc();
    } catch (err) {
      console.error('Asset 정리에 실패했습니다', err);
    }
  }, GC_DELAY_MS);
}
