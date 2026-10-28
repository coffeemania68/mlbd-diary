// db/storage.js
// 보관함 자료(StorageItem) CRUD와 이미지 Asset 교체. 이전 Asset은 Asset_GC(db/asset-gc.js)가 정리한다.
// 모든 함수의 마지막 인자 database는 테스트용이다. 앱에서는 생략한다.
import { db } from './db.js';
import { newRecord, touch } from './records.js';

export { getAsset } from './characters.js';

/** 자료 종류. 만든 뒤에는 바꾸지 않는다 */
export const STORAGE_KINDS = ['image', 'note', 'link'];

/** 작품의 보관함 자료 목록. createdAt 내림차순(새 자료가 앞) */
export async function listStorageItems(projectId, database = db) {
  const items = await database.storageItems.where('projectId').equals(projectId).toArray();
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

/** 자료 하나. 없으면 undefined */
export async function getStorageItem(id, database = db) {
  return database.storageItems.get(id);
}

/** 빈 자료를 만든다. kind가 image·note·link가 아니면 오류. 만든 레코드를 돌려준다 */
export async function createStorageItem(projectId, kind, database = db) {
  if (!STORAGE_KINDS.includes(kind)) throw new Error(`알 수 없는 자료 종류입니다: ${kind}`);
  const item = newRecord({
    projectId,
    kind,
    title: '',
    body: '',
    assetId: null,
    url: '',
    tags: [],
  });
  await database.storageItems.add(item);
  return item;
}

/** 자료 일부를 바꾼다. updatedAt은 touch()가 찍는다. 바뀐 레코드를 돌려준다 */
export async function updateStorageItem(id, changes, database = db) {
  return database.transaction('rw', database.storageItems, async () => {
    const current = await database.storageItems.get(id);
    if (!current) throw new Error(`보관함 자료가 없습니다: ${id}`);
    const patch = touch(changes);
    await database.storageItems.update(id, patch);
    return { ...current, ...patch };
  });
}

/**
 * 처리된 이미지(processImage 결과)를 저장한다.
 * 한 트랜잭션 안에서 새 Asset 추가 → assetId 교체 (setCharacterImage와 같은 순서).
 * 이전 Asset은 지우지 않는다. 화면이 끝난 뒤 requestAssetGc()로 정리한다 (요구사항 24.1).
 * 중간에 실패하면 전부 되돌아가 이전 이미지가 그대로 남는다. 바뀐 자료를 돌려준다.
 */
export async function setStorageImage(id, processed, database = db) {
  return database.transaction('rw', database.storageItems, database.assets, async () => {
    const current = await database.storageItems.get(id);
    if (!current) throw new Error(`보관함 자료가 없습니다: ${id}`);
    const { blob, mime, width, height, kind = 'image' } = processed;
    const asset = newRecord({ blob, mime, width, height, kind });
    await database.assets.add(asset);
    const patch = touch({ assetId: asset.id });
    await database.storageItems.update(id, patch);
    return { ...current, ...patch };
  });
}

/** 자료를 지운다. assetId의 Asset은 Asset_GC가 정리한다. 없는 id면 아무것도 하지 않는다 */
export async function deleteStorageItem(id, database = db) {
  await database.storageItems.delete(id);
}
