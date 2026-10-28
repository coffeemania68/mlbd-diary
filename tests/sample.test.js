import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createDb } from '../src/db/db.js';
import { buildSampleProject } from '../src/lib/sample-data.js';
import { createSampleProject } from '../src/db/sample.js';
import { createProject, deleteProjectCascade, listProjects } from '../src/db/projects.js';
import { nextEpisode, currentMonth } from '../src/lib/calendar.js';
import { getSticker } from '../src/lib/stickers.js';
import { ensureMainPage, listFreePages } from '../src/db/pages.js';
import { getOrCreatePlotStructure } from '../src/db/plot.js';
import { DEFAULT_LAYOUTS } from '../src/config.js';

let n = 0;
const freshDb = () => createDb(`test-sample-${Date.now()}-${n++}`);

const pad2 = (v) => String(v).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const SAMPLE_TABLES = ['projects', 'synopses', 'characters', 'episodes'];
const EXTENSION_TABLES = ['plotStructures', 'plotCards', 'timelineEvents', 'pages', 'widgets'];

/** 결정적 id 생성기 */
function counterIds() {
  let i = 0;
  return () => `id-${i++}`;
}

describe('buildSampleProject', () => {
  // Feature: mlbd-final-block, Property 11: 예시 작품 무결성
  it('Property 11: id 고유, projectId·참조는 예시 안의 id, 회차 번호·상태, nextEpisode·이번 달 회차', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(2000, 0, 1), max: new Date(2099, 11, 31), noInvalidDate: true }),
        fc.integer({ min: 0, max: 4_000_000_000_000 }),
        fc.integer({ min: 0, max: 50 }),
        (today, now, order) => {
          const { projectId, tables } = buildSampleProject({ now, today, order, ids: counterIds() });
          const all = Object.values(tables).flat();
          const ids = all.map((r) => r.id);
          expect(new Set(ids).size).toBe(ids.length);
          const idSet = new Set(ids);

          expect(tables.projects).toHaveLength(1);
          expect(tables.projects[0].id).toBe(projectId);
          expect(tables.projects[0].title.startsWith('예시')).toBe(true);
          expect(tables.projects[0].order).toBe(order);
          for (const r of all) {
            expect(r.createdAt).toBe(now);
            expect(r.updatedAt).toBe(now);
            if ('projectId' in r) expect(r.projectId).toBe(projectId);
          }

          const { episodes, characters } = tables;
          expect(characters).toHaveLength(3);
          for (const ep of episodes) {
            for (const c of ep.characterIds) expect(idSet.has(c)).toBe(true);
          }
          expect(episodes.map((e) => e.number).sort()).toEqual([1, 2, 3, 4, 5]);
          expect(new Set(episodes.map((e) => e.status))).toEqual(
            new Set(['idea', 'draft', 'revised', 'scheduled', 'published']),
          );

          // 확장 테이블
          const episodeIds = new Set(episodes.map((e) => e.id));
          const characterIds = new Set(characters.map((c) => c.id));
          const pageIds = new Set(tables.pages.map((p) => p.id));
          expect(tables.plotStructures).toHaveLength(1);
          expect(tables.plotCards).toHaveLength(4);
          expect(tables.plotCards.map((c) => c.sectionIndex).sort()).toEqual([0, 1, 2, 3]);
          for (const card of tables.plotCards) {
            expect(card.episodeIds.length).toBeGreaterThan(0);
            for (const e of card.episodeIds) expect(episodeIds.has(e)).toBe(true);
          }
          expect(tables.timelineEvents).toHaveLength(3);
          for (const ev of tables.timelineEvents) {
            for (const c of ev.characterIds) expect(characterIds.has(c)).toBe(true);
            if (ev.episodeId != null) expect(episodeIds.has(ev.episodeId)).toBe(true);
          }
          for (const w of tables.widgets) {
            expect(pageIds.has(w.pageId)).toBe(true);
            expect(Number.isFinite(w.rotation)).toBe(true);
            if (w.type === 'sticker') expect(getSticker(w.data.stickerId)).not.toBeNull();
            else expect(w.rotation).toBe(0);
            if (w.type === 'characterCard' && w.data.characterId != null) {
              expect(characterIds.has(w.data.characterId)).toBe(true);
            }
            if (w.type === 'episodeCard' && w.data.episodeId != null) {
              expect(episodeIds.has(w.data.episodeId)).toBe(true);
            }
          }
          for (const p of tables.pages) expect(['main', 'monthly', 'free']).toContain(p.kind);
          expect(tables.pages.filter((p) => p.kind === 'main')).toHaveLength(1);

          const todayText = ymd(today);
          const next = nextEpisode(episodes, todayText);
          expect(next).not.toBeNull();
          expect(next.number).toBe(2);
          const month = currentMonth(today);
          expect(episodes.some((e) => typeof e.publishDate === 'string' && e.publishDate.startsWith(`${month}-`))).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('회차 발행일: 1화 −7일, 2화 오늘, 3화 +7일, 4·5화 없음 (월말 경계)', () => {
    const { tables } = buildSampleProject({ today: new Date(2027, 1, 26), ids: counterIds() });
    const byNumber = Object.fromEntries(tables.episodes.map((e) => [e.number, e]));
    expect(byNumber[1]).toMatchObject({ status: 'published', publishDate: '2027-02-19' });
    expect(byNumber[2]).toMatchObject({ status: 'scheduled', publishDate: '2027-02-26' });
    expect(byNumber[3]).toMatchObject({ status: 'revised', publishDate: '2027-03-05' });
    expect(byNumber[4]).toMatchObject({ status: 'draft', publishDate: null });
    expect(byNumber[5]).toMatchObject({ status: 'idea', publishDate: null });
    expect(nextEpisode(tables.episodes, '2027-02-26').number).toBe(2);
  });

  it('기본 레코드와 같은 필드를 쓰고, 캐릭터는 이미지 없이 대사 1~2개', () => {
    const { tables } = buildSampleProject({ ids: counterIds() });
    const keys = (r) => Object.keys(r).sort();
    expect(keys(tables.projects[0])).toEqual(
      ['coverColor', 'createdAt', 'genre', 'id', 'logline', 'order', 'platform', 'themeId', 'title', 'updatedAt'],
    );
    expect(keys(tables.synopses[0])).toEqual(['createdAt', 'id', 'logline', 'long', 'projectId', 'short', 'updatedAt']);
    expect(tables.synopses[0].logline).toBe(tables.projects[0].logline);
    expect(tables.characters.map((c) => c.role)).toEqual(['주인공', '조연', '악역']);
    for (const c of tables.characters) {
      expect(c.imageAssetId).toBeNull();
      expect(c.personality).not.toBe('');
      expect(c.goal).not.toBe('');
      expect(c.quotes.length).toBeGreaterThanOrEqual(1);
      expect(c.quotes.length).toBeLessThanOrEqual(2);
    }
    for (const e of tables.episodes) {
      expect(keys(e)).toEqual(
        ['actualChars', 'characterIds', 'createdAt', 'id', 'keyPoints', 'keywords', 'links', 'memo', 'number',
          'places', 'projectId', 'publishDate', 'quotes', 'status', 'targetChars', 'title', 'updatedAt'],
      );
      expect(e.targetChars).toBeGreaterThan(0);
    }
  });

  it('확장 레코드: 플롯·타임라인·페이지·위젯 필드와 내용', () => {
    const { tables } = buildSampleProject({ ids: counterIds() });
    const keys = (r) => Object.keys(r).sort();
    expect(keys(tables.plotStructures[0])).toEqual(['createdAt', 'id', 'projectId', 'sections', 'type', 'updatedAt']);
    expect(tables.plotStructures[0]).toMatchObject({ type: 'kishotenketsu', sections: ['기', '승', '전', '결'] });
    for (const c of tables.plotCards) {
      expect(keys(c)).toEqual(['createdAt', 'episodeIds', 'id', 'order', 'projectId', 'sectionIndex', 'summary', 'title', 'updatedAt']);
    }
    expect(tables.timelineEvents.map((e) => e.sortKey)).toEqual([0, 1, 2]);
    for (const e of tables.timelineEvents) {
      expect(keys(e)).toEqual(
        ['characterIds', 'createdAt', 'description', 'episodeId', 'id', 'projectId', 'sortKey', 'storyDateLabel', 'title', 'updatedAt'],
      );
      expect(e.storyDateLabel).not.toBe('');
    }
    const pageKeys = ['background', 'createdAt', 'id', 'kind', 'month', 'order', 'projectId', 'templateId', 'title', 'updatedAt'];
    const main = tables.pages.find((p) => p.kind === 'main');
    const free = tables.pages.find((p) => p.kind === 'free');
    expect(keys(main)).toEqual(pageKeys);
    expect(keys(free)).toEqual(pageKeys);
    expect(main).toMatchObject({ templateId: 'main', month: null, background: null });
    expect(free).toMatchObject({ title: '꾸미기 예시', templateId: 'blank', order: 0, month: null, background: { pattern: 'dot', color: null } });

    const widgetKeys = ['createdAt', 'data', 'h', 'id', 'pageId', 'rotation', 'style', 'type', 'updatedAt', 'w', 'x', 'y', 'z'];
    for (const w of tables.widgets) expect(keys(w)).toEqual(widgetKeys);
    const mainWidgets = tables.widgets.filter((w) => w.pageId === main.id);
    expect(mainWidgets.map((w) => w.type)).toEqual(DEFAULT_LAYOUTS.main.map((l) => l.type));
    expect(mainWidgets.map((w) => w.z)).toEqual([1, 2, 3]);
    const checklist = mainWidgets.find((w) => w.type === 'checklist');
    expect(checklist.data.items).toHaveLength(3);
    expect(checklist.data.items.some((i) => i.text === '2화 예약 확인')).toBe(true);
    expect(new Set(checklist.data.items.map((i) => i.id)).size).toBe(3);
    const memo = mainWidgets.find((w) => w.type === 'text');
    expect(memo.data.title).not.toBe('');
    expect(memo.data.body).not.toBe('');

    const freeWidgets = tables.widgets.filter((w) => w.pageId === free.id);
    expect(freeWidgets.filter((w) => w.type === 'text')).toHaveLength(1);
    expect(freeWidgets.find((w) => w.type === 'text').data.body).toContain('편집 모드에서 옮겨 보세요');
    const stickers = freeWidgets.filter((w) => w.type === 'sticker');
    expect(stickers).toHaveLength(4);
    expect(new Set(stickers.map((w) => w.rotation))).toEqual(new Set([0, 15, 345]));
  });
});

describe('createSampleProject', () => {
  async function counts(database) {
    const out = {};
    for (const name of [...SAMPLE_TABLES, ...EXTENSION_TABLES]) out[name] = await database.table(name).count();
    return out;
  }

  it('생성 뒤 각 테이블 개수와 반환한 Project', async () => {
    const database = freshDb();
    const project = await createSampleProject({}, database);
    expect(project.title.startsWith('예시')).toBe(true);
    expect(await database.projects.get(project.id)).toEqual(project);
    expect(await counts(database)).toEqual({
      projects: 1, synopses: 1, characters: 3, episodes: 5,
      plotStructures: 1, plotCards: 4, timelineEvents: 3, pages: 2, widgets: 8,
    });
    expect(project.order).toBe(0);
  });

  it('ensureMainPage·getOrCreatePlotStructure는 예시의 Page·구조를 그대로 쓴다', async () => {
    const database = freshDb();
    const project = await createSampleProject({}, database);
    const before = await database.pages.where('[projectId+kind]').equals([project.id, 'main']).toArray();
    expect(before).toHaveLength(1);
    const main = await ensureMainPage(project.id, database);
    expect(main).toEqual(before[0]);
    expect(await ensureMainPage(project.id, database)).toEqual(before[0]);
    expect(await database.pages.where('[projectId+kind]').equals([project.id, 'main']).count()).toBe(1);
    expect(await database.widgets.where('pageId').equals(main.id).count()).toBe(3);
    const structure = await getOrCreatePlotStructure(project.id, database);
    expect(await database.plotStructures.count()).toBe(1);
    expect(structure.type).toBe('kishotenketsu');
    const free = await listFreePages(project.id, database);
    expect(free.map((p) => p.title)).toEqual(['꾸미기 예시']);
  });

  it('기존 작품이 있으면 order가 맨 끝', async () => {
    const database = freshDb();
    await createProject({ title: 'A' }, database);
    await createProject({ title: 'B' }, database);
    const project = await createSampleProject({}, database);
    expect(project.order).toBe(2);
    const list = await listProjects(database);
    expect(list[list.length - 1].id).toBe(project.id);
  });

  it('episodes 추가가 실패하면 모든 변경이 되돌아간다', async () => {
    const database = freshDb();
    database.episodes.hook('creating', () => {
      throw new Error('강제 실패');
    });
    await expect(createSampleProject({}, database)).rejects.toThrow();
    expect(await counts(database)).toEqual({
      projects: 0, synopses: 0, characters: 0, episodes: 0,
      plotStructures: 0, plotCards: 0, timelineEvents: 0, pages: 0, widgets: 0,
    });
  });

  it('deleteProjectCascade 뒤 예시 Record가 모두 없다', async () => {
    const database = freshDb();
    const other = await createProject({ title: '내 작품' }, database);
    const project = await createSampleProject({}, database);
    await deleteProjectCascade(project.id, database);
    for (const name of [...SAMPLE_TABLES, ...EXTENSION_TABLES]) {
      const rows = await database.table(name).toArray();
      expect(rows.some((r) => r.id === project.id || r.projectId === project.id)).toBe(false);
    }
    expect(await database.widgets.count()).toBe(0);
    expect(await database.projects.get(other.id)).toBeTruthy();
    expect(await database.synopses.where('projectId').equals(other.id).count()).toBe(1);
  });
});
