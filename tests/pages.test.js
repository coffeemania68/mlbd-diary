import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createDb } from '../src/db/db.js';
import {
  createPage,
  isValidPageKind,
  PAGE_KINDS,
  getPage,
  ensureMainPage,
  ensureMonthlyPage,
  listFreePages,
  createFreePage,
  renamePage,
  deletePage,
  templateWidgets,
  createFreePageFromTemplate,
  setPageBackground,
} from '../src/db/pages.js';
import { DEFAULT_LAYOUTS, PAGE_TEMPLATES, PAGE_W, PAGE_H } from '../src/config.js';
import { listWidgets, listInkStrokes, savePageOps, addAsset } from '../src/db/widgets.js';
import { newRecord } from '../src/db/records.js';

let n = 0;
const freshDb = () => createDb(`test-pages-${Date.now()}-${n++}`);

const widgetRec = (pageId, fields = {}) =>
  newRecord({ pageId, type: 'text', x: 0, y: 0, w: 100, h: 100, z: 1, rotation: 0, style: {}, data: {}, ...fields });
const strokeRec = (pageId) =>
  newRecord({ pageId, tool: 'pen', color: '#000', size: 3, points: [[1, 2, 0.5]] });

describe('pages', () => {
  it('PAGE_KINDS는 main, monthly, free (daily 없음)', () => {
    expect(PAGE_KINDS).toEqual(['main', 'monthly', 'free']);
    expect(isValidPageKind('daily')).toBe(false);
  });

  it('올바른 kind면 기본값과 order를 채워 저장한다', async () => {
    const database = freshDb();
    const a = await createPage('p1', { kind: 'main' }, database);
    const b = await createPage('p1', { kind: 'monthly', month: '2027-01' }, database);
    const c = await createPage('p2', { kind: 'free' }, database);
    expect(a).toMatchObject({ projectId: 'p1', kind: 'main', month: null, title: '', templateId: null, background: null, order: 0 });
    expect(b.order).toBe(1);
    expect(b.month).toBe('2027-01');
    expect(c.order).toBe(0);
    expect(await database.pages.count()).toBe(3);
  });

  it('잘못된 kind면 Error를 던지고 저장하지 않는다', async () => {
    const database = freshDb();
    await expect(createPage('p1', { kind: 'daily' }, database)).rejects.toThrow(Error);
    await expect(createPage('p1', {}, database)).rejects.toThrow(Error);
    expect(await database.pages.count()).toBe(0);
  });

  it('메인 페이지 기본 배치는 episodeCard, checklist, text이고 z는 1부터', async () => {
    const database = freshDb();
    const page = await ensureMainPage('p1', database);
    expect(page).toMatchObject({ projectId: 'p1', kind: 'main', month: null });
    expect(await getPage(page.id, database)).toEqual(page);
    const widgets = (await listWidgets(page.id, database)).sort((a, b) => a.z - b.z);
    expect(widgets.map((w) => w.type)).toEqual(['episodeCard', 'checklist', 'text']);
    expect(widgets.map((w) => w.z)).toEqual([1, 2, 3]);
    expect(widgets[0].data).toEqual({ mode: 'next' });
    expect(widgets[1]).toMatchObject({ style: {}, data: {}, rotation: 0 });
    expect(await getPage('nope', database)).toBeNull();
  });

  it('월간 페이지 기본 배치는 calendar, text', async () => {
    const database = freshDb();
    const page = await ensureMonthlyPage('p1', '2027-03', database);
    expect(page).toMatchObject({ kind: 'monthly', month: '2027-03' });
    const widgets = (await listWidgets(page.id, database)).sort((a, b) => a.z - b.z);
    expect(widgets.map((w) => w.type)).toEqual(['calendar', 'text']);
  });

  it('동시에 ensureMonthlyPage를 불러도 1장만 생기고 같은 id를 돌려준다', async () => {
    const database = freshDb();
    const [a, b] = await Promise.all([
      ensureMonthlyPage('p1', '2027-04', database),
      ensureMonthlyPage('p1', '2027-04', database),
    ]);
    expect(a.id).toBe(b.id);
    expect(await database.pages.count()).toBe(1);
  });

  it('createFreePage는 위젯 없이 목록 끝 order로 만들고 listFreePages는 order 순', async () => {
    const database = freshDb();
    await ensureMainPage('p1', database);
    const a = await createFreePage('p1', database);
    const b = await createFreePage('p1', database);
    await createFreePage('p2', database);
    expect([a.order, b.order]).toEqual([0, 1]);
    expect(a).toMatchObject({ kind: 'free', month: null, title: '' });
    expect(await listWidgets(a.id, database)).toEqual([]);
    expect((await listFreePages('p1', database)).map((p) => p.id)).toEqual([a.id, b.id]);
  });

  it('renamePage는 앞뒤 공백을 지우고 저장한다', async () => {
    const database = freshDb();
    const page = await createFreePage('p1', database);
    await renamePage(page.id, '  설정 메모  ', database);
    expect((await getPage(page.id, database)).title).toBe('설정 메모');
  });

  it('deletePage가 중간에 실패하면 Page·위젯·InkStroke가 모두 그대로다', async () => {
    const database = freshDb();
    const page = await createFreePage('p1', database);
    await database.widgets.bulkAdd([widgetRec(page.id), widgetRec(page.id)]);
    await database.inkStrokes.add(strokeRec(page.id));
    database.widgets.hook('deleting', () => {
      throw new Error('강제 실패');
    });
    await expect(deletePage(page.id, database)).rejects.toThrow();
    expect(await getPage(page.id, database)).not.toBeNull();
    expect(await database.widgets.count()).toBe(2);
    expect(await database.inkStrokes.count()).toBe(1);
  });

  it('savePageOps는 삭제·추가를 한 번에 반영하고 Page.updatedAt을 갱신한다', async () => {
    const database = freshDb();
    const page = await createFreePage('p1', database);
    const keep = widgetRec(page.id);
    const gone = widgetRec(page.id);
    const oldStroke = strokeRec(page.id);
    await database.widgets.bulkAdd([keep, gone]);
    await database.inkStrokes.add(oldStroke);
    const added = widgetRec(page.id, { type: 'checklist' });
    const newStroke = strokeRec(page.id);
    await new Promise((r) => setTimeout(r, 2));
    await savePageOps(page.id, {
      [`w:${gone.id}`]: null,
      [`w:${added.id}`]: added,
      [`w:${keep.id}`]: { ...keep, x: 77 },
      [`s:${oldStroke.id}`]: null,
      [`s:${newStroke.id}`]: newStroke,
    }, database);
    const widgets = await listWidgets(page.id, database);
    expect(widgets.map((w) => w.id).sort()).toEqual([keep.id, added.id].sort());
    expect(widgets.find((w) => w.id === keep.id).x).toBe(77);
    expect((await listInkStrokes(page.id, database)).map((s) => s.id)).toEqual([newStroke.id]);
    expect((await getPage(page.id, database)).updatedAt).toBeGreaterThan(page.updatedAt);
  });

  it('addAsset은 준 id로 Asset을 저장한다', async () => {
    const database = freshDb();
    const asset = await addAsset({ blob: new Blob(['x']), mime: 'image/webp', width: 10, height: 20 }, 'a-1', database);
    expect(asset).toMatchObject({ id: 'a-1', kind: 'image', width: 10, height: 20 });
    expect((await database.assets.get('a-1')).mime).toBe('image/webp');
  });

  // Feature: mlbd-pages-backup, Property 12: 페이지 유일성
  it('Property 12: ensureMainPage·ensureMonthlyPage는 작품마다 main 1장, (작품, month)마다 monthly 1장', async () => {
    /** **Validates: Requirements 1.2, 1.3, 2.4, 2.5** */
    const call = fc.record({
      project: fc.constantFrom('p1', 'p2', 'p3'),
      month: fc.option(fc.constantFrom('2027-01', '2027-02', '2028-12'), { nil: null }),
    });
    await fc.assert(
      fc.asyncProperty(fc.array(call, { minLength: 1, maxLength: 12 }), async (calls) => {
        const database = freshDb();
        const seen = new Map();
        for (const { project, month } of calls) {
          const page = month === null
            ? await ensureMainPage(project, database)
            : await ensureMonthlyPage(project, month, database);
          const key = `${project}|${month}`;
          if (seen.has(key)) expect(page.id).toBe(seen.get(key));
          else seen.set(key, page.id);
        }
        const pages = await database.pages.toArray();
        expect(pages.length).toBe(seen.size);
        const keys = pages.map((p) => `${p.projectId}|${p.kind === 'main' ? null : p.month}`);
        expect(new Set(keys).size).toBe(pages.length);
        database.close();
      }),
      { numRuns: 50 },
    );
  });

  // Feature: mlbd-pages-backup, Property 13: 페이지 삭제 범위
  it('Property 13: deletePage는 그 Page와 그 위젯·InkStroke만 지우고 다른 Record와 Asset은 그대로', async () => {
    /** **Validates: Requirements 4.1, 24.1** */
    const arb = fc
      .integer({ min: 1, max: 4 })
      .chain((pageCount) =>
        fc.record({
          pageCount: fc.constant(pageCount),
          widgets: fc.array(fc.nat(pageCount - 1), { maxLength: 8 }),
          strokes: fc.array(fc.nat(pageCount - 1), { maxLength: 6 }),
          target: fc.nat(pageCount - 1),
        }),
      );
    await fc.assert(
      fc.asyncProperty(arb, async ({ pageCount, widgets, strokes, target }) => {
        const database = freshDb();
        const pages = [];
        for (let i = 0; i < pageCount; i++) pages.push(await createFreePage('p1', database));
        const asset = await addAsset({ blob: new Blob(['x']), mime: 'image/webp', width: 1, height: 1 }, 'a-1', database);
        await database.widgets.bulkAdd(
          widgets.map((i) => widgetRec(pages[i].id, { type: 'image', data: { assetId: asset.id } })),
        );
        await database.inkStrokes.bulkAdd(strokes.map((i) => strokeRec(pages[i].id)));
        const targetId = pages[target].id;
        const before = {
          pages: (await database.pages.toArray()).filter((p) => p.id !== targetId),
          widgets: (await database.widgets.toArray()).filter((w) => w.pageId !== targetId),
          strokes: (await database.inkStrokes.toArray()).filter((s) => s.pageId !== targetId),
        };

        await deletePage(targetId, database);

        const byId = (a, b) => a.id.localeCompare(b.id);
        expect(await getPage(targetId, database)).toBeNull();
        expect((await database.pages.toArray()).sort(byId)).toEqual(before.pages.sort(byId));
        expect((await database.widgets.toArray()).sort(byId)).toEqual(before.widgets.sort(byId));
        expect((await database.inkStrokes.toArray()).sort(byId)).toEqual(before.strokes.sort(byId));
        expect(await database.assets.get('a-1')).toBeTruthy();
        database.close();
      }),
      { numRuns: 50 },
    );
  });
});

describe('page templates and background', () => {
  const sortedWidgets = async (pageId, database) =>
    (await listWidgets(pageId, database)).sort((a, b) => a.z - b.z);

  it('createFreePageFromTemplate: 템플릿 3종의 위젯 구성과 templateId', async () => {
    const database = freshDb();
    const today = new Date(2027, 4, 15); // 기기 지역 기준 2027-05
    const main = await createFreePageFromTemplate('p1', 'main', { today }, database);
    const monthly = await createFreePageFromTemplate('p1', 'monthly', { today }, database);
    const blank = await createFreePageFromTemplate('p1', 'blank', { today }, database);
    expect(main).toMatchObject({ kind: 'free', templateId: 'main', month: null, order: 0 });
    expect(monthly).toMatchObject({ kind: 'free', templateId: 'monthly', month: null, order: 1 });
    expect(blank).toMatchObject({ kind: 'free', templateId: 'blank', order: 2 });
    expect((await sortedWidgets(main.id, database)).map((w) => w.type)).toEqual(['episodeCard', 'checklist', 'text']);
    const mw = await sortedWidgets(monthly.id, database);
    expect(mw.map((w) => w.type)).toEqual(['calendar', 'text']);
    expect(mw[0].data.month).toBe('2027-05');
    expect(await listWidgets(blank.id, database)).toEqual([]);
  });

  it('위젯 저장이 실패하면 Page도 만들어지지 않는다', async () => {
    const database = freshDb();
    database.widgets.hook('creating', () => {
      throw new Error('강제 실패');
    });
    await expect(createFreePageFromTemplate('p1', 'main', {}, database)).rejects.toThrow();
    expect(await database.pages.count()).toBe(0);
    expect(await database.widgets.count()).toBe(0);
  });

  it('새 main·monthly Page는 templateId main·monthly, 기존 createFreePage는 위젯 0개', async () => {
    const database = freshDb();
    expect((await ensureMainPage('p1', database)).templateId).toBe('main');
    expect((await ensureMonthlyPage('p1', '2027-02', database)).templateId).toBe('monthly');
    const free = await createFreePage('p1', database);
    expect(free.templateId).toBe('blank');
    expect(await listWidgets(free.id, database)).toEqual([]);
  });

  it('setPageBackground는 정리한 값을 저장하고 돌려준다', async () => {
    const database = freshDb();
    const page = await createFreePage('p1', database);
    await new Promise((r) => setTimeout(r, 2));
    const ok = await setPageBackground(page.id, { pattern: 'dot', color: '#ffffff' }, database);
    expect(ok).toEqual({ pattern: 'dot', color: '#ffffff' });
    const saved = await getPage(page.id, database);
    expect(saved.background).toEqual(ok);
    expect(saved.updatedAt).toBeGreaterThan(page.updatedAt);
    const bad = await setPageBackground(page.id, { pattern: 'zigzag', color: 'red', extra: 1 }, database);
    expect(bad).toEqual({ pattern: 'plain', color: null });
    expect((await getPage(page.id, database)).background).toEqual(bad);
    expect(await setPageBackground(page.id, null, database)).toEqual({ pattern: 'plain', color: null });
  });

  // Feature: mlbd-final-block, Property 6: 템플릿 위젯
  it('Property 6: templateWidgets는 pageId·Page 범위·z 순서·DEFAULT_LAYOUTS type을 지킨다', () => {
    /** **Validates: Requirements 4.1, 4.2, 4.5, 4.8** */
    const monthArb = fc
      .record({ y: fc.integer({ min: 1, max: 9999 }), m: fc.integer({ min: 1, max: 12 }) })
      .map(({ y, m }) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`);
    const knownIds = PAGE_TEMPLATES.map((t) => t.id);
    fc.assert(
      fc.property(
        fc.constantFrom(...knownIds),
        fc.uuid(),
        monthArb,
        fc.string().filter((s) => !knownIds.includes(s)),
        (templateId, pageId, month, unknownId) => {
          const layout = PAGE_TEMPLATES.find((t) => t.id === templateId).layout;
          const widgets = templateWidgets(pageId, templateId, { month });
          expect(widgets.map((w) => w.type)).toEqual(DEFAULT_LAYOUTS[layout].map((l) => l.type));
          widgets.forEach((w, i) => {
            expect(w.pageId).toBe(pageId);
            expect(w.z).toBe(i + 1);
            expect(w.x).toBeGreaterThanOrEqual(0);
            expect(w.y).toBeGreaterThanOrEqual(0);
            expect(w.x + w.w).toBeLessThanOrEqual(PAGE_W);
            expect(w.y + w.h).toBeLessThanOrEqual(PAGE_H);
            if (templateId === 'monthly' && w.type === 'calendar') expect(w.data.month).toBe(month);
          });
          if (templateId === 'blank') expect(widgets).toEqual([]);
          expect(templateWidgets(pageId, unknownId, { month })).toEqual([]);
          expect(templateWidgets(pageId, null, { month })).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
