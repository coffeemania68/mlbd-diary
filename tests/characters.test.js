import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createDb } from '../src/db/db.js';
import {
  listCharacters,
  getCharacter,
  getAsset,
  createCharacter,
  updateCharacter,
  setCharacterImage,
  removeCharacterImage,
  deleteCharacter,
} from '../src/db/characters.js';
import { listEpisodesWithCharacter } from '../src/db/episodes.js';
import { runAssetGc } from '../src/db/asset-gc.js';

let n = 0;
const freshDb = () => createDb(`test-characters-${Date.now()}-${n++}`);
const img = (w = 10) => ({ blob: new Uint8Array([1, 2, 3]), mime: 'image/webp', width: w, height: w, kind: 'image' });

describe('characters', () => {
  it('기본값과 order로 만들고 작품별 order 순으로 돌려준다', async () => {
    const database = freshDb();
    const a = await createCharacter('p1', database);
    const b = await createCharacter('p1', database);
    const c = await createCharacter('p2', database);
    expect(a).toMatchObject({
      projectId: 'p1', name: '', role: '', age: '', appearance: '', personality: '',
      goal: '', secret: '', quotes: [], imageAssetId: null, relations: [], tags: [], memo: '', order: 0,
    });
    expect(a).not.toHaveProperty('appearances');
    expect(b.order).toBe(1);
    expect(c.order).toBe(0);
    expect((await listCharacters('p1', database)).map((x) => x.id)).toEqual([a.id, b.id]);
  });

  it('updateCharacter는 id·createdAt을 지키고 updatedAt을 갱신한다', async () => {
    const database = freshDb();
    const a = await createCharacter('p1', database);
    const updated = await updateCharacter(a.id, { name: '하나', id: 'x', createdAt: 1 }, database);
    const stored = await getCharacter(a.id, database);
    expect(stored.name).toBe('하나');
    expect(stored.id).toBe(a.id);
    expect(stored.createdAt).toBe(a.createdAt);
    expect(stored.updatedAt).toBeGreaterThanOrEqual(a.updatedAt);
    expect(updated).toEqual(stored);
  });

  it('이미지 교체·제거·삭제 직후 이전 Asset은 남아 있고, Asset 정리 뒤 참조 없는 Asset이 없다', async () => {
    const database = freshDb();
    const gc = () => runAssetGc(database, { pins: new Set() });
    const a = await createCharacter('p1', database);
    const first = await setCharacterImage(a.id, img(10), database);
    const second = await setCharacterImage(a.id, img(20), database);
    expect(second.imageAssetId).not.toBe(first.imageAssetId);
    expect(await getAsset(first.imageAssetId, database)).toBeDefined();
    expect(await gc()).toBe(1);
    expect(await getAsset(first.imageAssetId, database)).toBeUndefined();
    expect((await getAsset(second.imageAssetId, database)).width).toBe(20);
    expect(await database.assets.count()).toBe(1);

    const removed = await removeCharacterImage(a.id, database);
    expect(removed.imageAssetId).toBeNull();
    expect(await database.assets.count()).toBe(1);
    await gc();
    expect(await database.assets.count()).toBe(0);

    await setCharacterImage(a.id, img(), database);
    await deleteCharacter(a.id, database);
    expect(await getCharacter(a.id, database)).toBeUndefined();
    expect(await database.assets.count()).toBe(1);
    await gc();
    expect(await database.assets.count()).toBe(0);
  });

  it('등장 회차는 같은 작품의 해당 캐릭터 회차를 number 순으로 돌려준다', async () => {
    const database = freshDb();
    await database.episodes.bulkAdd([
      { id: 'e2', projectId: 'p1', number: 2, title: '둘', characterIds: ['c1'] },
      { id: 'e1', projectId: 'p1', number: 1, title: '하나', characterIds: ['c1', 'c2'] },
      { id: 'e3', projectId: 'p1', number: 3, title: '셋', characterIds: ['c2'] },
      { id: 'e4', projectId: 'p2', number: 1, title: '다른 작품', characterIds: ['c1'] },
    ]);
    expect(await listEpisodesWithCharacter('p1', 'c1', database)).toEqual([
      { id: 'e1', number: 1, title: '하나' },
      { id: 'e2', number: 2, title: '둘' },
    ]);
  });
});

// Feature: mlbd-book-sections, Property 15: 캐릭터 삭제 연쇄
// **Validates: Requirements 7.2, 7.3, 7.4**
describe('Property 15: 캐릭터 삭제 연쇄', () => {
  const CHAR_IDS = ['c0', 'c1', 'c2', 'c3'];
  // 인물 태그: 겹치지 않는 캐릭터 id를 임의 순서로 (없는 id 'gone'도 섞는다)
  const tagsArb = fc.uniqueArray(fc.constantFrom(...CHAR_IDS, 'gone'), { maxLength: 5 });

  const scenarioArb = fc.record({
    hasImage: fc.array(fc.boolean(), { minLength: CHAR_IDS.length, maxLength: CHAR_IDS.length }),
    episodes: fc.array(tagsArb, { maxLength: 6 }),
    events: fc.array(tagsArb, { maxLength: 6 }),
    target: fc.constantFrom(...CHAR_IDS),
    fail: fc.boolean(),
  });

  const snapshot = async (database) => {
    const sortById = (rows) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
    return {
      characters: sortById(await database.characters.toArray()),
      assets: sortById(await database.assets.toArray()),
      episodes: sortById(await database.episodes.toArray()),
      timelineEvents: sortById(await database.timelineEvents.toArray()),
    };
  };

  it('대상 캐릭터·이미지와 모든 인물 태그를 지우고, 나머지는 그대로 두며, 실패하면 모두 되돌린다', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async ({ hasImage, episodes, events, target, fail }) => {
        const database = freshDb();
        const T0 = 1000;
        await database.characters.bulkAdd(
          CHAR_IDS.map((id, i) => ({
            id, projectId: 'p1', name: id, order: i,
            imageAssetId: hasImage[i] ? `a-${id}` : null, createdAt: T0, updatedAt: T0,
          })),
        );
        await database.assets.bulkAdd(
          CHAR_IDS.filter((_, i) => hasImage[i]).map((id) => ({
            id: `a-${id}`, blob: new Uint8Array([1]), mime: 'image/webp', width: 1, height: 1, kind: 'image',
          })),
        );
        // 캐릭터와 관계없는 Asset(보관함 이미지)
        await database.assets.add({ id: 'a-other', blob: new Uint8Array([2]), mime: 'image/webp', width: 1, height: 1, kind: 'image' });
        await database.storageItems.add({ id: 's-other', projectId: 'p1', kind: 'image', assetId: 'a-other' });
        await database.episodes.bulkAdd(
          episodes.map((characterIds, i) => ({
            id: `e${i}`, projectId: 'p1', number: i + 1, title: '', characterIds, createdAt: T0, updatedAt: T0,
          })),
        );
        await database.timelineEvents.bulkAdd(
          events.map((characterIds, i) => ({
            id: `t${i}`, projectId: 'p1', sortKey: i, title: '', characterIds, episodeId: null, createdAt: T0, updatedAt: T0,
          })),
        );
        const before = await snapshot(database);

        if (fail) {
          // 트랜잭션 마지막 단계(캐릭터 삭제)에서 오류를 일으킨다. 앞선 태그 정리도 되돌아가야 한다
          database.characters.hook('deleting', () => {
            throw new Error('강제 실패');
          });
          await expect(deleteCharacter(target, database)).rejects.toThrow();
          expect(await snapshot(database)).toEqual(before);
          database.close();
          return;
        }

        await deleteCharacter(target, database);
        const after = await snapshot(database);

        // 대상 캐릭터는 없다. 삭제 직후 Asset은 모두 그대로다(정리는 Asset_GC가 한다)
        expect(after.characters.map((c) => c.id)).toEqual(CHAR_IDS.filter((id) => id !== target));
        expect(after.assets).toEqual(before.assets);
        // Asset 정리 뒤: 대상 이미지 Asset만 없고 다른 캐릭터의 Asset, 관계없는 Asset은 그대로다
        await runAssetGc(database, { pins: new Set() });
        expect(await database.assets.get(`a-${target}`)).toBeUndefined();
        expect(after.characters).toEqual(before.characters.filter((c) => c.id !== target));
        expect((await snapshot(database)).assets).toEqual(before.assets.filter((a) => a.id !== `a-${target}`));

        // Episode·TimelineEvent: 대상 id만 빠지고 나머지 순서 유지. 바뀐 레코드만 updatedAt 갱신
        for (const table of ['episodes', 'timelineEvents']) {
          expect(after[table].length).toBe(before[table].length);
          after[table].forEach((row, i) => {
            const prev = before[table][i];
            expect(row.id).toBe(prev.id);
            expect(row.characterIds).toEqual(prev.characterIds.filter((c) => c !== target));
            if (prev.characterIds.includes(target)) {
              expect(row.updatedAt).toBeGreaterThan(T0);
              expect({ ...row, characterIds: null, updatedAt: null }).toEqual({ ...prev, characterIds: null, updatedAt: null });
            } else {
              expect(row).toEqual(prev);
            }
          });
        }
        database.close();
      }),
      { numRuns: 50 },
    );
  });

  it('없는 id면 아무것도 바꾸지 않는다', async () => {
    const database = freshDb();
    await database.episodes.add({ id: 'e1', projectId: 'p1', number: 1, characterIds: ['x'], updatedAt: 1 });
    await deleteCharacter('x', database);
    expect(await database.episodes.get('e1')).toMatchObject({ characterIds: ['x'], updatedAt: 1 });
  });
});
