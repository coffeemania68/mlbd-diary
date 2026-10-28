import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { SCHEMA_VERSION, SNAPSHOT_KEEP } from '../src/config.js';
import { createDb } from '../src/db/db.js';
import { readLiveData, buildExport, restoreData, RECORD_TABLES } from '../src/db/backup.js';
import {
  createSnapshot,
  listSnapshots,
  maybeCreateDailySnapshot,
  restoreSnapshot,
  rotateSnapshots,
} from '../src/db/snapshots.js';
import { runAssetGc } from '../src/db/asset-gc.js';
import { createProject, updateProject } from '../src/db/projects.js';
import { createCharacter, setCharacterImage } from '../src/db/characters.js';
import { createStorageItem, setStorageImage } from '../src/db/storage.js';
import { createFreePage, ensureMonthlyPage } from '../src/db/pages.js';
import { addAsset, savePageOps } from '../src/db/widgets.js';
import { ensureSettings, getSettings, updateSettings } from '../src/db/settings.js';
import { LIVE_TABLES, parseBackup, serializeBackup } from '../src/lib/backup-format.js';

let n = 0;
const freshDb = () => createDb(`test-backup-${Date.now()}-${n++}`);
const dropDb = async (database) => {
  database.close();
  await database.delete();
};
const img = (bytes) => ({
  blob: new Blob([new Uint8Array(bytes)], { type: 'image/webp' }),
  mime: 'image/webp',
  width: 10,
  height: 10,
  kind: 'image',
});
const bytesOf = async (blob) => [...new Uint8Array(await blob.arrayBuffer())];
const assetBytes = async (database) => {
  const out = {};
  for (const a of await database.assets.toArray()) out[a.id] = await bytesOf(a.blob);
  return out;
};
const assetIds = async (database) => (await database.assets.toCollection().primaryKeys()).sort();
const clearLive = (database) =>
  database.transaction('rw', LIVE_TABLES.map((t) => database.table(t)), () =>
    Promise.all(LIVE_TABLES.map((t) => database.table(t).clear())),
  );
/** 파일 문자열 → parseBackup → bytes를 Blob으로(설정 화면처럼 트랜잭션 전에) */
const parseFile = (text) => {
  const parsed = parseBackup(text);
  expect(parsed.ok).toBe(true);
  const { meta, tables, assets } = parsed.value;
  const blobs = assets.map(({ bytes, ...m }) => ({ ...m, blob: new Blob([bytes], { type: m.mime }) }));
  return { data: { schemaVersion: meta.schemaVersion, tables }, assets: blobs };
};
const exportText = async (database) => (await buildExport({}, database)).join('');

/** 작품 2개, 캐릭터 이미지, 보관함 이미지, 자유 페이지(image 위젯 + InkStroke), 월간 페이지 */
async function seed(database) {
  await ensureSettings(database);
  const p1 = await createProject({ title: '첫 작품' }, database);
  const p2 = await createProject({ title: '둘째 작품' }, database);
  const ch = await createCharacter(p1.id, database);
  const withImg = await setCharacterImage(ch.id, img([1, 2, 3]), database);
  const item = await createStorageItem(p2.id, 'image', database);
  const itemImg = await setStorageImage(item.id, img([4, 5, 6, 7]), database);
  const page = await createFreePage(p1.id, database);
  const widgetAsset = await addAsset(img([8, 9]), undefined, database);
  await savePageOps(
    page.id,
    {
      'w:w1': { id: 'w1', pageId: page.id, type: 'image', x: 10, y: 20, w: 400, h: 400, z: 1,
        rotation: 0, style: {}, data: { assetId: widgetAsset.id }, createdAt: 1, updatedAt: 1 },
      's:s1': { id: 's1', pageId: page.id, tool: 'pen', color: '#2b2b33', size: 6,
        points: [[1.5, 2.25, 0.5], [3, 4, 0.75]], createdAt: 1, updatedAt: 1 },
      's:s2': { id: 's2', pageId: page.id, tool: 'highlighter', color: '#d9434f', size: 12,
        points: [[100, 200, 0.1], [101.125, 202, 1], [105, 210, 0.333]], createdAt: 1, updatedAt: 1 },
    },
    database,
  );
  await ensureMonthlyPage(p1.id, '2027-10', database);
  // 아무도 가리키지 않는 Asset은 내보내지 않는다
  await addAsset(img([99]), 'a-orphan', database);
  return { p1, p2, character: withImg, item: itemImg, page, widgetAsset };
}

describe('backup 통합 시나리오', () => {
  it('1. 내보내기 → 비우기 → 가져오기 왕복: Record·Asset 바이트·points가 같다', async () => {
    const database = freshDb();
    const { character, item, widgetAsset } = await seed(database);
    const before = await readLiveData(database);
    const refBytes = {};
    for (const a of before.assets) refBytes[a.id] = await bytesOf(a.blob);
    expect(Object.keys(refBytes).sort()).toEqual(
      [character.imageAssetId, item.assetId, widgetAsset.id].sort(),
    );

    const text = await exportText(database);
    await clearLive(database);
    const { data, assets } = parseFile(text);
    await restoreData(data, assets, database);

    const after = await readLiveData(database, { withAssets: false });
    for (const name of RECORD_TABLES) expect(after.tables[name]).toEqual(before.tables[name]);
    expect(await assetBytes(database)).toEqual(refBytes);
    const strokes = await database.inkStrokes.toArray();
    expect(strokes.map((s) => s.points)).toEqual(before.tables.inkStrokes.map((s) => s.points));
    await dropDb(database);
  });

  it('2. 복원 뒤 lastBackupAt·penDetected·penOnly는 이 기기 값을 지킨다', async () => {
    const database = freshDb();
    await seed(database);
    await updateSettings({ lastBackupAt: 111, penDetected: false, penOnly: false, snapGrid: true }, database);
    const text = await exportText(database);
    await updateSettings({ lastBackupAt: 999, penDetected: true, penOnly: true, snapGrid: false }, database);

    const { data, assets } = parseFile(text);
    await restoreData(data, assets, database);
    const s = await getSettings(database);
    expect(s).toMatchObject({ lastBackupAt: 999, penDetected: true, penOnly: true, snapGrid: true });
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(await database.settings.count()).toBe(1);
    await dropDb(database);
  });

  it('3. 복원 중 오류가 나면 Live_Data가 복원 전과 같다', async () => {
    const database = freshDb();
    const { p1 } = await seed(database);
    const text = await exportText(database);
    await updateProject(p1.id, { title: '바뀐 제목' }, database);
    const before = await readLiveData(database, { withAssets: false });
    const beforeAssets = await assetBytes(database);

    database.widgets.hook('creating', () => {
      throw new Error('강제 실패');
    });
    const { data, assets } = parseFile(text);
    await expect(restoreData(data, assets, database)).rejects.toThrow();

    const after = await readLiveData(database, { withAssets: false });
    expect(after.tables).toEqual(before.tables);
    expect(await assetBytes(database)).toEqual(beforeAssets);
    await dropDb(database);
  });

  it('4. schemaVersion 2 파일은 변환 뒤 Settings 세 필드 기본값, schemaVersion 3이 된다', async () => {
    const database = freshDb();
    const text = serializeBackup({
      appVersion: '0.1.0',
      schemaVersion: 2,
      exportedAt: new Date(0),
      tables: {
        projects: [{ id: 'p1', title: '옛 작품', order: 0, createdAt: 1, updatedAt: 1 }],
        settings: [{ id: 'set1', schemaVersion: 2, lastBackupAt: 5, defaultThemeId: null,
          onboardingDone: true, lastOpenedProjectId: 'p1', createdAt: 1, updatedAt: 1 }],
      },
      assets: [],
    }).join('');
    const { data, assets } = parseFile(text);
    await restoreData(data, assets, database);

    const s = await getSettings(database);
    expect(s).toMatchObject({
      id: 'set1', schemaVersion: 3, snapGrid: false, penDetected: false, penOnly: false,
      onboardingDone: true, lastOpenedProjectId: 'p1', lastBackupAt: null,
    });
    expect(await database.projects.toArray()).toEqual(data.tables.projects);
    await dropDb(database);
  });

  it('5. createSnapshot: 8번째에 7개만 남고, 보호 id는 남고, lastBackupAt은 그대로', async () => {
    const database = freshDb();
    const { character, item, widgetAsset } = await seed(database);
    await updateSettings({ lastBackupAt: 12345 }, database);

    const made = [];
    for (let i = 0; i < SNAPSHOT_KEEP; i += 1) {
      made.push(await createSnapshot('daily', { now: 1000 + i }, database));
    }
    const first = made[0];
    expect(first).toMatchObject({ reason: 'daily', schemaVersion: SCHEMA_VERSION, projectCount: 2 });
    expect(first.assetIds.sort()).toEqual([character.imageAssetId, item.assetId, widgetAsset.id].sort());
    expect(Object.keys(first.data.tables).sort()).toEqual([...RECORD_TABLES].sort());
    expect(typeof first.fingerprint).toBe('string');

    const eighth = await createSnapshot('daily', { now: 2000 }, database);
    let list = await listSnapshots(database);
    expect(list).toHaveLength(SNAPSHOT_KEEP);
    expect(list.map((s) => s.id)).not.toContain(first.id);
    expect(list[0].id).toBe(eighth.id);
    expect(list.every((s) => s.data === undefined)).toBe(true);
    expect(list.map((s) => s.createdAt)).toEqual([...list.map((s) => s.createdAt)].sort((a, b) => b - a));

    // 가장 오래된 것을 보호하면 회전에서 남는다
    const oldest = list[list.length - 1];
    const pre = await createSnapshot('pre-restore', { protectIds: [oldest.id], now: 3000 }, database);
    list = await listSnapshots(database);
    expect(list.map((s) => s.id)).toContain(oldest.id);
    expect(list[0]).toMatchObject({ id: pre.id, reason: 'pre-restore' });
    expect(list).toHaveLength(SNAPSHOT_KEEP + 1);

    // 보호 없이 회전하면 다시 7개
    expect(await rotateSnapshots(database)).toEqual([oldest.id]);
    expect(await database.snapshots.count()).toBe(SNAPSHOT_KEEP);

    expect((await getSettings(database)).lastBackupAt).toBe(12345);
    await dropDb(database);
  });

  it('6. 스냅샷이 옛 Asset을 가리키면 GC 뒤에도 남고, 스냅샷을 지우면 다음 GC에서 지워진다', async () => {
    const database = freshDb();
    await ensureSettings(database);
    const p = await createProject({}, database);
    const ch = await createCharacter(p.id, database);
    const old = await setCharacterImage(ch.id, img([1]), database);
    const snap = await createSnapshot('daily', {}, database);
    const now = await setCharacterImage(ch.id, img([2]), database);

    expect(await runAssetGc(database, { pins: new Set() })).toBe(0);
    expect(await assetIds(database)).toEqual([old.imageAssetId, now.imageAssetId].sort());

    await database.snapshots.delete(snap.id);
    expect(await runAssetGc(database, { pins: new Set() })).toBe(1);
    expect(await assetIds(database)).toEqual([now.imageAssetId]);
    await dropDb(database);
  });

  it('7. 파일 복원은 assets를 비우지 않아 스냅샷이 가리키는 Asset이 GC 뒤에도 남는다', async () => {
    const database = freshDb();
    await ensureSettings(database);
    const p = await createProject({}, database);
    const ch = await createCharacter(p.id, database);
    const old = await setCharacterImage(ch.id, img([1, 1]), database);
    await createSnapshot('pre-restore', {}, database);
    const now = await setCharacterImage(ch.id, img([2, 2]), database);

    const text = await exportText(database);
    expect(parseBackup(text).value.assets.map((a) => a.id)).toEqual([now.imageAssetId]);
    const { data, assets } = parseFile(text);
    await restoreData(data, assets, database);
    await runAssetGc(database, { pins: new Set() });

    const bytes = await assetBytes(database);
    expect(bytes[old.imageAssetId]).toEqual([1, 1]);
    expect(bytes[now.imageAssetId]).toEqual([2, 2]);
    await dropDb(database);
  });
});

const DAY1 = new Date(2027, 9, 30, 21, 4).getTime();
const DAY2 = new Date(2027, 9, 31, 9, 0).getTime();
const OTHER_TABLES = RECORD_TABLES.filter((t) => t !== 'settings');

describe('스냅샷 복원과 매일 스냅샷', () => {
  it('5. restoreSnapshot: Live_Data가 스냅샷 시점과 같고, 이미지가 남고, 대상 스냅샷이 보존된다', async () => {
    const database = freshDb();
    const { p1, character } = await seed(database);
    await updateSettings({ lastBackupAt: 77, penOnly: true }, database);
    const before = await readLiveData(database, { withAssets: false });
    const snap = await createSnapshot('daily', { now: DAY1 }, database);

    // 데이터 고치기: 제목 바꾸고 캐릭터 이미지 교체, 프로젝트 하나 추가
    await updateProject(p1.id, { title: '바뀐 제목' }, database);
    await setCharacterImage(character.id, img([42]), database);
    await createProject({ title: '셋째' }, database);
    await runAssetGc(database, { pins: new Set() });

    await restoreSnapshot(snap.id, { now: DAY1 + 1000 }, database);

    const after = await readLiveData(database, { withAssets: false });
    for (const name of OTHER_TABLES) expect(after.tables[name]).toEqual(before.tables[name]);
    expect(await getSettings(database)).toMatchObject({ lastBackupAt: 77, penOnly: true });
    // 스냅샷이 가리키던 옛 캐릭터 이미지가 그대로 있다
    expect((await assetBytes(database))[character.imageAssetId]).toEqual([1, 2, 3]);

    const list = await listSnapshots(database);
    expect(list.map((s) => s.id)).toContain(snap.id);
    expect(list[0].reason).toBe('pre-restore');
    expect(list[0].projectCount).toBe(3);
    await dropDb(database);
  });

  it('없는 스냅샷 id로 복원하면 오류이고 Live_Data는 그대로다', async () => {
    const database = freshDb();
    await seed(database);
    const before = await readLiveData(database, { withAssets: false });
    await expect(restoreSnapshot('nope', {}, database)).rejects.toThrow();
    expect((await readLiveData(database, { withAssets: false })).tables).toEqual(before.tables);
    expect(await database.snapshots.count()).toBe(0);
    await dropDb(database);
  });

  it('maybeCreateDailySnapshot: 작품이 없으면 만들지 않고, 있으면 만들고, 같은 날 두 번째는 만들지 않는다', async () => {
    const database = freshDb();
    await ensureSettings(database);
    expect(await maybeCreateDailySnapshot({ now: DAY1 }, database)).toBeNull();
    expect(await database.snapshots.count()).toBe(0);

    const p = await createProject({ title: '작품' }, database);
    // 동시에 부르면 같은 Promise
    const a = maybeCreateDailySnapshot({ now: DAY1 }, database);
    const b = maybeCreateDailySnapshot({ now: DAY1 }, database);
    expect(a).toBe(b);
    const made = await a;
    expect(made).toMatchObject({ reason: 'daily', localDate: '2027-10-30', projectCount: 1 });
    expect(await database.snapshots.count()).toBe(1);

    // 같은 날: 데이터가 바뀌어도 새로 만들지 않는다
    await updateProject(p.id, { title: '바뀜' }, database);
    expect(await maybeCreateDailySnapshot({ now: DAY1 + 60_000 }, database)).toBeNull();
    expect(await database.snapshots.count()).toBe(1);

    // 다음 날: 바뀌었으면 만든다
    expect(await maybeCreateDailySnapshot({ now: DAY2 }, database)).toMatchObject({ localDate: '2027-10-31' });
    expect(await database.snapshots.count()).toBe(2);
    await dropDb(database);
  });

  it('maybeCreateDailySnapshot: 다음 날이라도 바뀐 것이 없으면 만들지 않는다', async () => {
    const database = freshDb();
    await ensureSettings(database);
    await createProject({}, database);
    await maybeCreateDailySnapshot({ now: DAY1 }, database);
    expect(await maybeCreateDailySnapshot({ now: DAY2 }, database)).toBeNull();
    expect(await database.snapshots.count()).toBe(1);
    await dropDb(database);
  });

  it('maybeCreateDailySnapshot: 강제 오류가 나면 삼키고 기존 스냅샷과 Live_Data는 그대로다', async () => {
    const database = freshDb();
    await ensureSettings(database);
    const p = await createProject({}, database);
    const first = await maybeCreateDailySnapshot({ now: DAY1 }, database);
    await updateProject(p.id, { title: '바뀜' }, database);
    const beforeSnaps = await database.snapshots.toArray();
    const beforeLive = await readLiveData(database, { withAssets: false });

    database.snapshots.hook('creating', () => {
      throw new Error('강제 실패');
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(maybeCreateDailySnapshot({ now: DAY2 }, database)).resolves.toBeNull();
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
    expect(await database.snapshots.toArray()).toEqual(beforeSnaps);
    expect(beforeSnaps.map((s) => s.id)).toEqual([first.id]);
    expect((await readLiveData(database, { withAssets: false })).tables).toEqual(beforeLive.tables);
    await dropDb(database);
  });
});

describe('작품 0개에서 파일 복원 (11.4)', () => {
  it('작품 0개 DB에서 pre-restore 스냅샷이 projectCount 0으로 만들어지고, 작품 2개 파일로 복원된다', async () => {
    const source = freshDb();
    await seed(source);
    const { data, assets } = parseFile(await exportText(source));
    await dropDb(source);

    const database = freshDb();
    await ensureSettings(database);
    expect(await database.projects.count()).toBe(0);
    const snap = await createSnapshot('pre-restore', {}, database);
    expect(snap.reason).toBe('pre-restore');
    expect(snap.projectCount).toBe(0);
    expect((await listSnapshots(database)).map((s) => s.id)).toContain(snap.id);

    await restoreData(data, assets, database);
    const titles = (await database.projects.toArray()).map((p) => p.title).sort();
    expect(titles).toEqual(['둘째 작품', '첫 작품']);
    await dropDb(database);
  });
});
