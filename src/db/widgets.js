// db/widgets.js
// Page에 붙는 Widget·InkStroke 읽기와 한꺼번에 저장하기, Asset 추가.
// 모든 함수의 마지막 인자 database는 테스트용이다. 앱에서는 생략한다.
import { db } from './db.js';
import { newRecord, touch } from './records.js';

export async function listWidgets(pageId, database = db) {
  return database.widgets.where('pageId').equals(pageId).toArray();
}

export async function listInkStrokes(pageId, database = db) {
  return database.inkStrokes.where('pageId').equals(pageId).toArray();
}

/**
 * 모아 둔 변경을 한 트랜잭션(widgets, inkStrokes, pages)에서 반영한다.
 * ops: { 'w:<id>': Widget | null, 's:<id>': InkStroke | null }. null이면 삭제, 아니면 put.
 * 끝에 Page.updatedAt을 갱신한다(목록의 최근 수정일).
 */
export async function savePageOps(pageId, ops, database = db) {
  const widgetPuts = [];
  const widgetDeletes = [];
  const strokePuts = [];
  const strokeDeletes = [];
  for (const [key, value] of Object.entries(ops)) {
    const sep = key.indexOf(':');
    const kind = key.slice(0, sep);
    const id = key.slice(sep + 1);
    if (kind === 'w') {
      if (value === null) widgetDeletes.push(id);
      else widgetPuts.push(value);
    } else if (kind === 's') {
      if (value === null) strokeDeletes.push(id);
      else strokePuts.push(value);
    } else {
      throw new Error(`알 수 없는 변경 키입니다: ${key}`);
    }
  }
  await database.transaction('rw', database.widgets, database.inkStrokes, database.pages, async () => {
    if (widgetDeletes.length) await database.widgets.bulkDelete(widgetDeletes);
    if (widgetPuts.length) await database.widgets.bulkPut(widgetPuts);
    if (strokeDeletes.length) await database.inkStrokes.bulkDelete(strokeDeletes);
    if (strokePuts.length) await database.inkStrokes.bulkPut(strokePuts);
    await database.pages.update(pageId, touch({}));
  });
}

/**
 * 처리된 이미지(processImage 결과)를 Asset으로 저장하고 레코드를 돌려준다.
 * id는 호출하는 쪽이 먼저 핀(setPinnedAssets)을 걸 수 있게 줄 수 있다.
 */
export async function addAsset(processed, id = crypto.randomUUID(), database = db) {
  const { blob, mime, width, height, kind = 'image' } = processed;
  const asset = newRecord({ blob, mime, width, height, kind }, Date.now(), id);
  await database.assets.add(asset);
  return asset;
}
