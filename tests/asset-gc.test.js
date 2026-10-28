import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { createDb } from '../src/db/db.js';
import { runAssetGc } from '../src/db/asset-gc.js';

let n = 0;
const freshDb = () => createDb(`test-asset-gc-${Date.now()}-${n++}`);
const asset = (id) => ({ id, blob: new Uint8Array([1]), mime: 'image/webp', width: 1, height: 1, kind: 'image' });
const ids = async (database) => (await database.assets.toCollection().primaryKeys()).sort();
const dropDb = async (database) => {
  database.close();
  await database.delete();
};

describe('runAssetGc', () => {
  it('어디에서도 가리키지 않는 Asset만 지우고 지운 개수를 돌려준다', async () => {
    const database = freshDb();
    await database.assets.bulkAdd(['a-char', 'a-item', 'a-snap', 'a-orphan'].map(asset));
    await database.characters.add({ id: 'c1', projectId: 'p1', imageAssetId: 'a-char' });
    await database.storageItems.add({ id: 's1', projectId: 'p1', kind: 'image', assetId: 'a-item' });
    await database.snapshots.add({ id: 'snap1', createdAt: 1, localDate: '2027-01-01', assetIds: ['a-snap'] });

    expect(await runAssetGc(database, { pins: new Set() })).toBe(1);
    expect(await ids(database)).toEqual(['a-char', 'a-item', 'a-snap']);
    await dropDb(database);
  });

  it('핀에 넣은 Asset은 참조가 없어도 남긴다', async () => {
    const database = freshDb();
    await database.assets.bulkAdd(['a-pin', 'a-orphan'].map(asset));
    expect(await runAssetGc(database, { pins: new Set(['a-pin']) })).toBe(1);
    expect(await ids(database)).toEqual(['a-pin']);
    await dropDb(database);
  });

  it('image 위젯의 data.assetId가 가리키는 Asset은 남긴다', async () => {
    const database = freshDb();
    await database.assets.bulkAdd(['a-widget', 'a-orphan'].map(asset));
    await database.widgets.add({ id: 'w1', pageId: 'pg1', type: 'image', data: { assetId: 'a-widget' } });
    expect(await runAssetGc(database, { pins: new Set() })).toBe(1);
    expect(await ids(database)).toEqual(['a-widget']);
    await dropDb(database);
  });

  it('삭제 중 오류가 나면 아무 Asset도 지워지지 않는다', async () => {
    const database = freshDb();
    await database.assets.bulkAdd(['a1', 'a2', 'a3'].map(asset));
    database.assets.hook('deleting', () => {
      throw new Error('강제 실패');
    });
    await expect(runAssetGc(database, { pins: new Set() })).rejects.toThrow();
    expect(await ids(database)).toEqual(['a1', 'a2', 'a3']);
    await dropDb(database);
  });
});
