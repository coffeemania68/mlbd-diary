import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createDb } from '../src/db/db.js';
import {
  listStorageItems,
  getStorageItem,
  getAsset,
  createStorageItem,
  updateStorageItem,
  setStorageImage,
  deleteStorageItem,
} from '../src/db/storage.js';
import { runAssetGc } from '../src/db/asset-gc.js';

let n = 0;
const freshDb = () => createDb(`test-storage-${Date.now()}-${n++}`);
const img = (w = 10) => ({ blob: new Uint8Array([1, 2, 3]), mime: 'image/webp', width: w, height: w, kind: 'image' });
const dropDb = async (database) => {
  database.close();
  await database.delete();
};

describe('storage', () => {
  it('createStorageItem은 기본값으로 만들고 kind가 image·note·link가 아니면 오류', async () => {
    const database = freshDb();
    for (const kind of ['image', 'note', 'link']) {
      const item = await createStorageItem('p1', kind, database);
      expect(item).toMatchObject({ projectId: 'p1', kind, title: '', body: '', assetId: null, url: '', tags: [] });
      expect(await getStorageItem(item.id, database)).toEqual(item);
    }
    for (const bad of ['video', '', undefined, null, 'Image']) {
      await expect(createStorageItem('p1', bad, database)).rejects.toThrow();
    }
    expect(await database.storageItems.count()).toBe(3);
    await dropDb(database);
  });

  it('updateStorageItem은 id·createdAt을 지키고 updatedAt을 갱신한다', async () => {
    const database = freshDb();
    const a = await createStorageItem('p1', 'note', database);
    const updated = await updateStorageItem(a.id, { title: '메모', tags: ['복선'], id: 'x', createdAt: 1 }, database);
    const stored = await getStorageItem(a.id, database);
    expect(stored).toMatchObject({ id: a.id, createdAt: a.createdAt, title: '메모', tags: ['복선'] });
    expect(stored.updatedAt).toBeGreaterThanOrEqual(a.updatedAt);
    expect(updated).toEqual(stored);
    await expect(updateStorageItem('none', { title: 'x' }, database)).rejects.toThrow();
    await dropDb(database);
  });

  it('이미지 교체·삭제 직후 이전 Asset은 남아 있고, Asset 정리 뒤 참조 없는 Asset이 없다', async () => {
    const database = freshDb();
    const gc = () => runAssetGc(database, { pins: new Set() });
    const a = await createStorageItem('p1', 'image', database);
    const first = await setStorageImage(a.id, img(10), database);
    const second = await setStorageImage(a.id, img(20), database);
    expect(second.assetId).not.toBe(first.assetId);
    expect(await getAsset(first.assetId, database)).toBeDefined();
    await gc();
    expect(await getAsset(first.assetId, database)).toBeUndefined();
    expect((await getAsset(second.assetId, database)).width).toBe(20);
    expect(await database.assets.count()).toBe(1);

    await deleteStorageItem(a.id, database);
    expect(await getStorageItem(a.id, database)).toBeUndefined();
    expect(await database.assets.count()).toBe(1);
    await gc();
    expect(await database.assets.count()).toBe(0);
    await deleteStorageItem('none', database); // 없는 id는 아무것도 하지 않는다
    await dropDb(database);
  });

  // Feature: mlbd-book-sections, Property 22: 보관함 이미지 수명
  // **Validates: Requirements 13.5, 13.14**
  it('Property 22: 이미지 지정·교체·삭제와 Asset 정리 뒤 assetId는 존재하는 Asset을 가리키고 고아 Asset이 없으며 다른 작품은 그대로다', async () => {
    const opArb = fc.oneof(
      fc.record({ type: fc.constant('set'), index: fc.nat({ max: 9 }), width: fc.integer({ min: 1, max: 99 }) }),
      fc.record({ type: fc.constant('delete'), index: fc.nat({ max: 9 }) }),
    );
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 0, max: 3 }),
        fc.array(opArb, { maxLength: 10 }),
        async (mineCount, otherCount, ops) => {
          const database = freshDb();
          const mine = [];
          for (let i = 0; i < mineCount; i++) mine.push((await createStorageItem('p1', 'image', database)).id);
          for (let i = 0; i < otherCount; i++) {
            const other = await createStorageItem('p2', 'image', database);
            if (i % 2 === 0) await setStorageImage(other.id, img(i + 1), database);
          }
          const otherItems = await listStorageItems('p2', database);
          const otherAssetIds = otherItems.map((s) => s.assetId).filter(Boolean);
          const otherAssets = await database.assets.bulkGet(otherAssetIds);

          for (const op of ops) {
            const id = mine[op.index % mine.length];
            if (op.type === 'set') {
              if (await getStorageItem(id, database)) await setStorageImage(id, img(op.width), database);
            } else {
              await deleteStorageItem(id, database);
            }
            await runAssetGc(database, { pins: new Set() });

            const items = await database.storageItems.toArray();
            const assets = await database.assets.toArray();
            const assetIds = new Set(assets.map((a) => a.id));
            const referenced = new Set(items.map((s) => s.assetId).filter(Boolean));
            for (const s of items) if (s.assetId) expect(assetIds.has(s.assetId)).toBe(true);
            for (const a of assets) expect(referenced.has(a.id)).toBe(true);
            expect(await listStorageItems('p2', database)).toEqual(otherItems);
            expect(await database.assets.bulkGet(otherAssetIds)).toEqual(otherAssets);
          }
          await dropDb(database);
        },
      ),
      { numRuns: 50 },
    );
  });

  // Feature: mlbd-book-sections, Property 24: 작품 격리 (listStorageItems 부분)
  // **Validates: Requirements 16.7**
  it('Property 24: listStorageItems(P)는 P의 자료 전부만 createdAt 내림차순으로 돌려준다', async () => {
    const projectArb = fc.constantFrom('p1', 'p2', 'p3');
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            projectId: projectArb,
            kind: fc.constantFrom('image', 'note', 'link'),
            createdAt: fc.integer({ min: 0, max: 1000 }),
          }),
          { maxLength: 8 },
        ),
        projectArb,
        async (seed, p) => {
          const database = freshDb();
          const records = seed.map((s, i) => ({
            ...s, id: `s${i}`, updatedAt: s.createdAt, title: '', body: '', assetId: null, url: '', tags: [],
          }));
          await database.storageItems.bulkAdd(records);
          const listed = await listStorageItems(p, database);
          expect(listed.every((s) => s.projectId === p)).toBe(true);
          expect(listed.map((s) => s.id).sort()).toEqual(records.filter((r) => r.projectId === p).map((r) => r.id).sort());
          for (let i = 1; i < listed.length; i++) expect(listed[i - 1].createdAt).toBeGreaterThanOrEqual(listed[i].createdAt);
          await dropDb(database);
        },
      ),
      { numRuns: 100 },
    );
  });
});
