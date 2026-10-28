// db/characters.js
// 캐릭터 CRUD와 이미지 교체·제거. 이전 Asset은 지우지 않고 Asset_GC(db/asset-gc.js)에 맡긴다.
// 등장 회차는 저장하지 않는다. episodes.js의 listEpisodesWithCharacter()로 계산한다.
// 모든 함수의 마지막 인자 database는 테스트용이다. 앱에서는 생략한다.
import { db } from './db.js';
import { newRecord, touch } from './records.js';
import { nextOrder, sortByOrder } from '../lib/order.js';

/** 작품의 캐릭터 목록. order 오름차순 */
export async function listCharacters(projectId, database = db) {
  const characters = await database.characters.where('projectId').equals(projectId).toArray();
  return sortByOrder(characters);
}

/** 캐릭터 하나. 없으면 undefined */
export async function getCharacter(id, database = db) {
  return database.characters.get(id);
}

/** Asset 하나. 없으면 undefined */
export async function getAsset(id, database = db) {
  if (id == null) return undefined;
  return database.assets.get(id);
}

/** 빈 캐릭터를 만든다. order는 같은 작품의 캐릭터 중 가장 큰 값 + 1. 만든 레코드를 돌려준다 */
export async function createCharacter(projectId, database = db) {
  return database.transaction('rw', database.characters, async () => {
    const existing = await database.characters.where('projectId').equals(projectId).toArray();
    const character = newRecord({
      projectId,
      name: '',
      role: '',
      age: '',
      appearance: '',
      personality: '',
      goal: '',
      secret: '',
      quotes: [],
      imageAssetId: null,
      relations: [],
      tags: [],
      memo: '',
      order: nextOrder(existing),
    });
    await database.characters.add(character);
    return character;
  });
}

/** 캐릭터 일부를 바꾼다. updatedAt은 touch()가 찍는다. 바뀐 레코드를 돌려준다 */
export async function updateCharacter(id, changes, database = db) {
  return database.transaction('rw', database.characters, async () => {
    const current = await database.characters.get(id);
    if (!current) throw new Error(`캐릭터가 없습니다: ${id}`);
    const patch = touch(changes);
    await database.characters.update(id, patch);
    return { ...current, ...patch };
  });
}

/**
 * 처리된 이미지(processImage 결과)를 저장한다.
 * 한 트랜잭션 안에서 새 Asset 추가 → imageAssetId 교체.
 * 이전 Asset은 지우지 않는다. 화면이 끝난 뒤 requestAssetGc()로 정리한다 (요구사항 24.1).
 * 중간에 실패하면 전부 되돌아가 이전 이미지가 그대로 남는다. 바뀐 캐릭터를 돌려준다.
 */
export async function setCharacterImage(id, processed, database = db) {
  return database.transaction('rw', database.characters, database.assets, async () => {
    const current = await database.characters.get(id);
    if (!current) throw new Error(`캐릭터가 없습니다: ${id}`);
    const { blob, mime, width, height, kind = 'image' } = processed;
    const asset = newRecord({ blob, mime, width, height, kind });
    await database.assets.add(asset);
    const patch = touch({ imageAssetId: asset.id });
    await database.characters.update(id, patch);
    return { ...current, ...patch };
  });
}

/** 이미지를 뺀다. imageAssetId = null. Asset은 Asset_GC가 정리한다. 바뀐 캐릭터를 돌려준다 */
export async function removeCharacterImage(id, database = db) {
  return database.transaction('rw', database.characters, async () => {
    const current = await database.characters.get(id);
    if (!current) throw new Error(`캐릭터가 없습니다: ${id}`);
    if (!current.imageAssetId) return current;
    const patch = touch({ imageAssetId: null });
    await database.characters.update(id, patch);
    return { ...current, ...patch };
  });
}

/**
 * 캐릭터를 지운다. 한 트랜잭션(characters, episodes, timelineEvents)에서
 *   1. Episode·TimelineEvent의 characterIds에서 id를 뺀다 (나머지 순서 유지, updatedAt 갱신)
 *   2. 캐릭터 삭제
 * 이미지 Asset은 Asset_GC가 정리한다 (요구사항 24.1).
 * 중간에 실패하면 세 테이블 모두 되돌아간다. 없는 id면 아무것도 하지 않는다.
 */
export async function deleteCharacter(id, database = db) {
  return database.transaction(
    'rw',
    [database.characters, database.episodes, database.timelineEvents],
    async () => {
      const current = await database.characters.get(id);
      if (!current) return;
      const now = Date.now();
      const strip = (record) => {
        record.characterIds = record.characterIds.filter((c) => c !== id);
        record.updatedAt = now;
      };
      // *characterIds 다중 값 색인으로 해당 캐릭터가 들어 있는 레코드만 찾는다
      await database.episodes.where('characterIds').equals(id).modify(strip);
      await database.timelineEvents.where('characterIds').equals(id).modify(strip);
      await database.characters.delete(id);
    },
  );
}
