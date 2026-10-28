import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { createDb } from '../src/db/db.js';
import { ensureSettings, updateSettings, getSettings } from '../src/db/settings.js';
import { newRecord } from '../src/db/records.js';
import { COVER_COLORS, UNTITLED_PROJECT } from '../src/config.js';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProjectCascade,
} from '../src/db/projects.js';
import { runAssetGc } from '../src/db/asset-gc.js';

let n = 0;
const freshDb = () => createDb(`test-projects-${Date.now()}-${n++}`);

describe('projects', () => {
  it('createProject: 제목 trim, 빈 제목은 기본 제목, 기본값과 order, Synopsis 함께 생성', async () => {
    const database = freshDb();
    const a = await createProject({ title: '  달빛  ', logline: '한 줄' }, database);
    const b = await createProject({ title: '   ' }, database);
    expect(a).toMatchObject({
      title: '달빛', genre: '', platform: '', logline: '한 줄',
      coverColor: COVER_COLORS[0].value, themeId: null, order: 0,
    });
    expect(b.title).toBe(UNTITLED_PROJECT);
    expect(b.order).toBe(1);
    const syn = await database.synopses.where('projectId').equals(a.id).first();
    expect(syn).toMatchObject({ logline: '한 줄', short: '', long: '' });
    expect((await listProjects(database)).map((p) => p.id)).toEqual([a.id, b.id]);
    expect((await getProject(a.id, database)).title).toBe('달빛');
  });

  it('updateProject: 빈 제목은 기본 제목, logline은 Synopsis에도 반영', async () => {
    const database = freshDb();
    const p = await createProject({ title: 'A' }, database);
    const updated = await updateProject(p.id, { title: '', logline: '새 줄' }, database);
    expect(updated.title).toBe(UNTITLED_PROJECT);
    expect((await getProject(p.id, database)).logline).toBe('새 줄');
    const syn = await database.synopses.where('projectId').equals(p.id).first();
    expect(syn.logline).toBe('새 줄');

    // Synopsis가 없으면 새로 만든다
    await database.synopses.clear();
    await updateProject(p.id, { logline: '다시' }, database);
    expect((await database.synopses.where('projectId').equals(p.id).first()).logline).toBe('다시');
  });

  it('deleteProjectCascade: 작품 레코드를 지우고 다른 작품은 남긴다, 참조 Asset은 정리 뒤 없다', async () => {
    const database = freshDb();
    await ensureSettings(database);
    const p = await createProject({ title: '지울 작품' }, database);
    const keep = await createProject({ title: '남길 작품' }, database);
    await updateSettings({ lastOpenedProjectId: p.id }, database);

    const asset = (k) => newRecord({ blob: null, mime: 'image/webp', width: 1, height: 1, kind: k });
    const [a1, a2, a3, aKeep] = [asset('image'), asset('image'), asset('sticker'), asset('image')];
    await database.assets.bulkAdd([a1, a2, a3, aKeep]);
    await database.characters.bulkAdd([
      newRecord({ projectId: p.id, imageAssetId: a1.id, order: 0 }),
      newRecord({ projectId: keep.id, imageAssetId: aKeep.id, order: 0 }),
    ]);
    await database.storageItems.add(newRecord({ projectId: p.id, kind: 'image', assetId: a2.id }));
    const page = newRecord({ projectId: p.id, kind: 'free', order: 0 });
    await database.pages.add(page);
    await database.widgets.add(newRecord({ pageId: page.id, type: 'sticker', data: { assetId: a3.id } }));
    await database.inkStrokes.add(newRecord({ pageId: page.id, tool: 'pen', points: [] }));
    await database.episodes.add(newRecord({ projectId: p.id, number: 1 }));

    await deleteProjectCascade(p.id, database);

    expect(await getProject(p.id, database)).toBeUndefined();
    expect(await getProject(keep.id, database)).toBeDefined();
    for (const name of ['characters', 'synopses', 'storageItems', 'pages', 'episodes']) {
      expect(await database.table(name).where('projectId').equals(p.id).count()).toBe(0);
    }
    expect(await database.widgets.count()).toBe(0);
    expect(await database.inkStrokes.count()).toBe(0);
    // 연쇄 삭제 직후 Asset은 모두 남아 있고, Asset 정리 뒤 다른 작품의 Asset만 남는다
    expect(await database.assets.count()).toBe(4);
    expect(await runAssetGc(database, { pins: new Set() })).toBe(3);
    expect((await database.assets.toArray()).map((a) => a.id)).toEqual([aKeep.id]);
    expect(await database.synopses.where('projectId').equals(keep.id).count()).toBe(1);
    expect((await getSettings(database)).lastOpenedProjectId).toBeNull();
  });

  it('deleteProjectCascade는 Snapshot을 건드리지 않고, Snapshot이 가리키는 Asset은 정리 뒤에도 남는다', async () => {
    const database = freshDb();
    await ensureSettings(database);
    const p = await createProject({ title: '지울 작품' }, database);
    const a1 = newRecord({ blob: null, mime: 'image/webp', width: 1, height: 1, kind: 'image' });
    await database.assets.add(a1);
    await database.characters.add(newRecord({ projectId: p.id, imageAssetId: a1.id, order: 0 }));
    const snap = {
      id: 'snap-1', createdAt: 1000, localDate: '2027-01-01', reason: 'daily',
      fingerprint: '{}', assetIds: [a1.id], projectCount: 1, data: { tables: {} },
    };
    await database.snapshots.add(snap);

    await deleteProjectCascade(p.id, database);

    expect(await database.snapshots.toArray()).toEqual([snap]);
    expect(await runAssetGc(database, { pins: new Set() })).toBe(0);
    expect(await database.assets.get(a1.id)).toBeDefined();
  });
});
