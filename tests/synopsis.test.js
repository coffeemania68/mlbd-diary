import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { createDb } from '../src/db/db.js';
import { createProject, updateProject, getProject } from '../src/db/projects.js';
import { getOrCreateSynopsis, updateSynopsis } from '../src/db/synopsis.js';

let n = 0;
const freshDb = () => createDb(`test-synopsis-${Date.now()}-${n++}`);

describe('synopsis', () => {
  it('getOrCreateSynopsis: 있으면 그대로, 없으면 작품 로그라인으로 빈 레코드 생성', async () => {
    const database = freshDb();
    const p = await createProject({ title: 'A', logline: '한 줄' }, database);
    const first = await getOrCreateSynopsis(p.id, database);
    expect(first).toMatchObject({ projectId: p.id, logline: '한 줄', short: '', long: '' });

    await database.synopses.clear();
    const created = await getOrCreateSynopsis(p.id, database);
    expect(created).toMatchObject({ projectId: p.id, logline: '한 줄', short: '', long: '' });
    expect(await getOrCreateSynopsis(p.id, database)).toEqual(created);
    expect(await database.synopses.where('projectId').equals(p.id).count()).toBe(1);
  });

  it('updateSynopsis: 값 저장, logline은 Project에도 반영', async () => {
    const database = freshDb();
    const p = await createProject({ title: 'A' }, database);
    const updated = await updateSynopsis(p.id, { short: '짧게', logline: '새 줄' }, database);
    expect(updated).toMatchObject({ projectId: p.id, short: '짧게', logline: '새 줄', long: '' });
    expect((await getProject(p.id, database)).logline).toBe('새 줄');
    expect(await getOrCreateSynopsis(p.id, database)).toMatchObject({ short: '짧게', logline: '새 줄' });

    // short만 바꾸면 Project.logline은 그대로
    await updateSynopsis(p.id, { long: '길게' }, database);
    expect((await getProject(p.id, database)).logline).toBe('새 줄');

    // 작품 편집 경로와 섞어도 두 값이 같다
    await updateProject(p.id, { logline: '세 번째' }, database);
    expect((await getOrCreateSynopsis(p.id, database)).logline).toBe('세 번째');
  });

  it('updateSynopsis: Synopsis가 없으면 만든 뒤 저장', async () => {
    const database = freshDb();
    const p = await createProject({ title: 'A', logline: 'x' }, database);
    await database.synopses.clear();
    const updated = await updateSynopsis(p.id, { long: '본문' }, database);
    expect(updated).toMatchObject({ projectId: p.id, logline: 'x', short: '', long: '본문' });
    expect(await database.synopses.where('projectId').equals(p.id).count()).toBe(1);
  });
});
