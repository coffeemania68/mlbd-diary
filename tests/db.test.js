import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import Dexie from 'dexie';
import { createDb, openDatabase, DatabaseError } from '../src/db/db.js';
import { MIGRATIONS, planMigrations, runMigrationSteps } from '../src/db/migrations.js';
import { getSettings, updateSettings } from '../src/db/settings.js';
import { SCHEMA_VERSION } from '../src/config.js';

let n = 0;
const freshDb = () => createDb(`test-db-${Date.now()}-${n++}`);

describe('openDatabase', () => {
  it('빈 DB를 열면 15개 테이블(snapshots 포함)과 Settings 1건(schemaVersion = SCHEMA_VERSION)이 생긴다', async () => {
    const database = freshDb();
    await openDatabase(database);
    expect(database.tables).toHaveLength(15);
    expect(await database.settings.count()).toBe(1);
    const s = await getSettings(database);
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.lastOpenedProjectId).toBeNull();
  });

  it('다시 열어도 Settings는 1건이다', async () => {
    const database = freshDb();
    await openDatabase(database);
    database.close();
    await openDatabase(database);
    expect(await database.settings.count()).toBe(1);
  });

  it('저장된 schemaVersion이 더 높으면 newer-data 오류, 데이터는 그대로', async () => {
    const database = freshDb();
    await openDatabase(database, { target: 3 });
    const before = await getSettings(database);
    const err = await openDatabase(database, { target: 2 }).catch((e) => e);
    expect(err).toBeInstanceOf(DatabaseError);
    expect(err.kind).toBe('newer-data');
    expect(await getSettings(database)).toEqual(before);
  });

  it('낮은 버전이면 규칙을 실행하고, 실패하면 전체를 되돌린다', async () => {
    const database = freshDb();
    await openDatabase(database, { target: 1 });
    await database.projects.add({ id: 'p1', title: 'a', order: 0 });

    const failing = {
      2: async (tx) => { await tx.table('projects').update('p1', { title: 'b' }); },
      3: async () => { throw new Error('boom'); },
    };
    const err = await openDatabase(database, { target: 3, migrations: failing }).catch((e) => e);
    expect(err.kind).toBe('migration');
    expect((await database.projects.get('p1')).title).toBe('a');
    expect((await getSettings(database)).schemaVersion).toBe(1);

    const ok = { 2: async (tx) => { await tx.table('projects').update('p1', { title: 'b' }); } };
    await openDatabase(database, { target: 2, migrations: ok });
    expect((await database.projects.get('p1')).title).toBe('b');
    expect((await getSettings(database)).schemaVersion).toBe(2);
  });

  it('updateSettings는 id·createdAt을 지키고 updatedAt을 갱신한다', async () => {
    const database = freshDb();
    await openDatabase(database);
    const before = await getSettings(database);
    await updateSettings({ id: 'x', createdAt: 0, onboardingDone: true }, database);
    const after = await getSettings(database);
    expect(after.id).toBe(before.id);
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.onboardingDone).toBe(true);
    expect(after.updatedAt).toBeGreaterThanOrEqual(before.updatedAt);
  });
});

describe('데이터 변환 규칙 2', () => {
  // Feature: mlbd-book-sections, Property 23: 데이터 변환 규칙 2
  // **Validates: Requirements 15.1, 15.2, 15.3**
  it('Episode에 links 배열을 넣고 나머지 필드는 그대로 둔다', async () => {
    const linkArb = fc.record({ category: fc.string(), name: fc.string(), url: fc.webUrl() });
    const episodeArb = fc.record(
      {
        projectId: fc.constantFrom('p1', 'p2'),
        number: fc.integer({ min: 1, max: 999 }),
        title: fc.string(),
        keywords: fc.array(fc.string(), { maxLength: 3 }),
        characterIds: fc.array(fc.uuid(), { maxLength: 3 }),
        status: fc.constantFrom('idea', 'draft', 'revised', 'scheduled', 'published'),
        publishDate: fc.option(fc.integer({ min: 0 }), { nil: null }),
        createdAt: fc.integer({ min: 0, max: 2e12 }),
        updatedAt: fc.integer({ min: 0, max: 2e12 }),
        // 없음 / 배열 / 배열이 아닌 잘못된 값
        links: fc.oneof(fc.array(linkArb, { maxLength: 3 }), fc.constant(null), fc.string()),
      },
      { requiredKeys: ['projectId', 'number', 'title', 'createdAt', 'updatedAt'] },
    );

    await fc.assert(
      fc.asyncProperty(fc.array(episodeArb, { maxLength: 6 }), async (eps) => {
        const records = eps.map((e, i) => ({ ...e, id: `e${i}` }));
        const database = freshDb();
        await openDatabase(database, { target: 1 });
        await database.episodes.bulkAdd(records.map((r) => structuredClone(r)));
        database.close();

        await openDatabase(database, { target: 2 }); // 규칙 2까지만, 기본 MIGRATIONS
        expect((await getSettings(database)).schemaVersion).toBe(2);
        for (const before of records) {
          const after = await database.episodes.get(before.id);
          expect(Array.isArray(after.links)).toBe(true);
          if (Array.isArray(before.links)) expect(after.links).toEqual(before.links);
          else expect(after.links).toEqual([]);
          const { links: _a, ...restAfter } = after;
          const { links: _b, ...restBefore } = before;
          expect(restAfter).toEqual(restBefore);
        }
        database.close();
        await database.delete();
      }),
      { numRuns: 100 },
    );
  });

  it('SCHEMA_VERSION은 3이다', () => {
    expect(SCHEMA_VERSION).toBe(3);
  });
});

/** schemaVersion 2 상태의 DB: Settings에서 규칙 3 필드를 지우고 다른 Record를 넣는다 */
async function dbAtVersion2() {
  const database = freshDb();
  await openDatabase(database, { target: 2 });
  await database.settings.toCollection().modify((s) => {
    delete s.snapGrid;
    delete s.penDetected;
    s.penOnly = 'yes'; // boolean이 아닌 잘못된 값
  });
  await database.projects.add({ id: 'p1', title: '작품', order: 0, createdAt: 1, updatedAt: 2 });
  await database.episodes.add({
    id: 'e1', projectId: 'p1', number: 1, title: '1화', links: [], createdAt: 3, updatedAt: 4,
  });
  await database.pages.add({
    id: 'pg1', projectId: 'p1', kind: 'main', month: null, title: '', order: 0, createdAt: 5, updatedAt: 6,
  });
  database.close();
  return database;
}

describe('데이터 변환 규칙 3', () => {
  it('기존 Settings에 snapGrid·penDetected·penOnly 기본값(false)을 넣고 다른 Record는 그대로 둔다', async () => {
    const database = await dbAtVersion2();
    await database.open();
    const before = {
      settings: await getSettings(database),
      projects: await database.projects.toArray(),
      episodes: await database.episodes.toArray(),
      pages: await database.pages.toArray(),
    };
    database.close();

    await openDatabase(database);
    const s = await getSettings(database);
    expect(s.schemaVersion).toBe(3);
    expect(s.snapGrid).toBe(false);
    expect(s.penDetected).toBe(false);
    expect(s.penOnly).toBe(false);
    expect(s.id).toBe(before.settings.id);
    expect(s.lastOpenedProjectId).toBe(before.settings.lastOpenedProjectId);
    expect(await database.projects.toArray()).toEqual(before.projects);
    expect(await database.episodes.toArray()).toEqual(before.episodes);
    expect(await database.pages.toArray()).toEqual(before.pages);
  });

  it('이미 boolean이면 값을 바꾸지 않는다', async () => {
    const database = freshDb();
    await openDatabase(database, { target: 2 });
    await database.settings.toCollection().modify((s) => {
      s.snapGrid = true;
      s.penDetected = true;
      s.penOnly = true;
    });
    database.close();
    await openDatabase(database);
    const s = await getSettings(database);
    expect([s.snapGrid, s.penDetected, s.penOnly]).toEqual([true, true, true]);
  });

  it('규칙 3이 실패하면 데이터와 schemaVersion 2가 그대로 남는다', async () => {
    const database = await dbAtVersion2();
    await database.open();
    const before = await getSettings(database);
    const projectsBefore = await database.projects.toArray();
    database.close();

    const failing = {
      ...MIGRATIONS,
      3: async (tx) => {
        await MIGRATIONS[3](tx); // 일부를 고친 뒤
        await tx.table('projects').update('p1', { title: '바뀜' });
        throw new Error('boom');  // 실패
      },
    };
    const err = await openDatabase(database, { migrations: failing }).catch((e) => e);
    expect(err).toBeInstanceOf(DatabaseError);
    expect(err.kind).toBe('migration');
    const after = await getSettings(database);
    expect(after).toEqual(before);
    expect(after.schemaVersion).toBe(2);
    expect('snapGrid' in after).toBe(false);
    expect(await database.projects.toArray()).toEqual(projectsBefore);
  });
});

describe('Dexie version(2) 스키마', () => {
  it('snapshots 테이블과 pages의 [projectId+kind+month] 고유 색인이 있다', async () => {
    const database = freshDb();
    await openDatabase(database);
    expect(database.verno).toBe(2);
    expect(database.tables.map((t) => t.name)).toContain('snapshots');
    const snap = database.table('snapshots').schema;
    expect(snap.primKey.name).toBe('id');
    expect(Object.keys(snap.idxByName).sort()).toEqual(['createdAt', 'localDate']);
    const idx = database.table('pages').schema.idxByName['[projectId+kind+month]'];
    expect(idx).toBeDefined();
    expect(idx.unique).toBe(true);
  });

  it('같은 작품·같은 달 monthly 페이지는 두 번 들어가지 않고, month가 null인 페이지는 여러 장 들어간다', async () => {
    const database = freshDb();
    await openDatabase(database);
    const page = (id, kind, month) => ({ id, projectId: 'p1', kind, month, title: '', order: 0 });
    await database.pages.add(page('m1', 'monthly', '2027-10'));
    const err = await database.pages.add(page('m2', 'monthly', '2027-10')).catch((e) => e);
    expect(err?.name).toBe('ConstraintError');
    await database.pages.add(page('m3', 'monthly', '2027-11'));
    await database.pages.bulkAdd([page('f1', 'free', null), page('f2', 'free', null)]);
    expect(await database.pages.count()).toBe(4);
  });

  it('version(1) 데이터베이스를 version(2)로 열면 기존 Record가 그대로 있다', async () => {
    const name = `test-db-v1-${Date.now()}-${n++}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ projects: 'id, order', pages: 'id, projectId, kind, [projectId+kind]' });
    await v1.open();
    await v1.projects.add({ id: 'p1', title: 'a', order: 0 });
    v1.close();

    const database = createDb(name);
    await database.open();
    expect(await database.projects.get('p1')).toEqual({ id: 'p1', title: 'a', order: 0 });
    expect(await database.snapshots.count()).toBe(0);
  });
});

describe('runMigrationSteps', () => {
  it('열린 트랜잭션 안에서 주어진 규칙만 실행하고 schemaVersion은 바꾸지 않는다', async () => {
    const database = await dbAtVersion2();
    await database.open();
    await database.transaction('rw', database.tables, async (tx) => {
      await runMigrationSteps(tx, planMigrations(2, 3));
    });
    const s = await getSettings(database);
    expect(s.schemaVersion).toBe(2);
    expect([s.snapGrid, s.penDetected, s.penOnly]).toEqual([false, false, false]);
  });

  it('steps가 비어 있으면 아무것도 하지 않는다', async () => {
    const calls = [];
    await runMigrationSteps(null, [], { 3: async () => calls.push(3) });
    expect(calls).toEqual([]);
  });
});
