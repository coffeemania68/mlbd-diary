// db/pages.js
// Page: 메인(작품당 1장), 월간(작품·달마다 1장), 자유(여러 장). daily는 없다 (요구사항 4.3).
// 모든 함수의 마지막 인자 database는 테스트용이다. 앱에서는 생략한다.
import { db } from './db.js';
import { newRecord, touch } from './records.js';
import { nextOrder, sortByOrder } from '../lib/order.js';
import { DEFAULT_LAYOUTS, PAGE_TEMPLATES } from '../config.js';
import { currentMonth } from '../lib/calendar.js';
import { normalizeBackground } from '../lib/page-style.js';

/** 허용하는 Page.kind. daily는 없다 */
export const PAGE_KINDS = ['main', 'monthly', 'free'];

export function isValidPageKind(kind) {
  return PAGE_KINDS.includes(kind);
}

/**
 * 작품에 Page를 하나 만든다. kind가 잘못되면 Error를 던지고 아무것도 저장하지 않는다.
 * order는 같은 작품의 Page 중 가장 큰 값 + 1. 만든 레코드를 돌려준다.
 */
export async function createPage(projectId, fields = {}, database = db) {
  if (!isValidPageKind(fields.kind)) {
    throw new Error(`잘못된 페이지 종류입니다: ${String(fields.kind)}`);
  }
  return database.transaction('rw', database.pages, async () => {
    const pages = await database.pages.where('projectId').equals(projectId).toArray();
    const page = newRecord({
      month: null,
      title: '',
      templateId: null,
      background: null,
      ...fields,
      projectId,
      order: nextOrder(pages),
    });
    await database.pages.add(page);
    return page;
  });
}

/** 없으면 null */
export async function getPage(id, database = db) {
  return (await database.pages.get(id)) ?? null;
}

/**
 * 기본 배치(DEFAULT_LAYOUTS[kind])의 위젯 레코드를 만든다. z는 1부터 순서대로.
 * 빈 style·data는 {}로 둔다(위젯 모듈이 그릴 때 defaults()로 채운다). config 객체는 복사한다.
 */
function layoutWidgets(pageId, kind) {
  return (DEFAULT_LAYOUTS[kind] ?? []).map((item, i) =>
    newRecord({
      pageId,
      type: item.type,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      z: i + 1,
      rotation: 0,
      style: structuredClone(item.style ?? {}),
      data: structuredClone(item.data ?? {}),
    }),
  );
}

/**
 * 템플릿(PAGE_TEMPLATES)의 위젯 레코드(z 1부터). 모르는 id·blank면 [].
 * month가 있으면 calendar 위젯 data.month에 넣는다 (4.1, 4.2, 4.5).
 */
export function templateWidgets(pageId, templateId, { month = null } = {}) {
  const template = PAGE_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return [];
  const widgets = layoutWidgets(pageId, template.layout);
  if (month) {
    for (const w of widgets) if (w.type === 'calendar') w.data = { ...w.data, month };
  }
  return widgets;
}

/** main·monthly Page는 같은 이름의 템플릿으로 만든 것으로 기록한다 (4.7) */
const KIND_TEMPLATE = { main: 'main', monthly: 'monthly' };

function newPage(projectId, kind, month = null, order = 0, templateId = KIND_TEMPLATE[kind] ?? null) {
  return newRecord({
    projectId,
    kind,
    month,
    title: '',
    templateId,
    background: null,
    order,
  });
}

/**
 * [projectId+kind]로 main Page를 찾고 없으면 Page + DEFAULT_LAYOUTS.main 위젯을
 * 한 트랜잭션(pages, widgets)에서 만든다. Page를 돌려준다 (1.2, 1.3, 1.4).
 */
export async function ensureMainPage(projectId, database = db) {
  return database.transaction('rw', database.pages, database.widgets, async () => {
    const found = await database.pages.where('[projectId+kind]').equals([projectId, 'main']).first();
    if (found) return found;
    const page = newPage(projectId, 'main');
    await database.pages.add(page);
    await database.widgets.bulkAdd(layoutWidgets(page.id, 'main'));
    return page;
  });
}

function findMonthly(projectId, month, database) {
  return database.pages
    .where('[projectId+kind+month]')
    .equals([projectId, 'monthly', month])
    .first();
}

/**
 * [projectId+kind+month]로 monthly Page를 찾고 없으면 Page + DEFAULT_LAYOUTS.monthly 위젯을 만든다.
 * 다른 탭과 동시에 만들어 고유 색인에 걸리면(ConstraintError) 다시 읽어 돌려준다 (2.4, 2.5, 2.6).
 */
export async function ensureMonthlyPage(projectId, month, database = db) {
  try {
    return await database.transaction('rw', database.pages, database.widgets, async () => {
      const found = await findMonthly(projectId, month, database);
      if (found) return found;
      const page = newPage(projectId, 'monthly', month);
      await database.pages.add(page);
      await database.widgets.bulkAdd(layoutWidgets(page.id, 'monthly'));
      return page;
    });
  } catch (err) {
    if (err?.name !== 'ConstraintError') throw err;
    const found = await findMonthly(projectId, month, database);
    if (!found) throw err;
    return found;
  }
}

/** 작품의 free Page들, order 오름차순 */
export async function listFreePages(projectId, database = db) {
  const pages = await database.pages.where('[projectId+kind]').equals([projectId, 'free']).toArray();
  return sortByOrder(pages);
}

/**
 * templateId의 위젯과 함께 free Page를 목록 끝 order로 pages·widgets 한 트랜잭션에서 만든다.
 * monthly 템플릿이면 달력 data.month = currentMonth(today) (4.4, 4.5)
 */
export async function createFreePageFromTemplate(projectId, templateId, { today = new Date() } = {}, database = db) {
  return database.transaction('rw', database.pages, database.widgets, async () => {
    const pages = await database.pages.where('[projectId+kind]').equals([projectId, 'free']).toArray();
    const page = newPage(projectId, 'free', null, nextOrder(pages), templateId);
    await database.pages.add(page);
    const month = templateId === 'monthly' ? currentMonth(today) : null;
    const widgets = templateWidgets(page.id, templateId, { month });
    if (widgets.length) await database.widgets.bulkAdd(widgets);
    return page;
  });
}

/** 위젯 없는 free Page를 목록 끝 order로 만든다 (3.2, 3.4) */
export async function createFreePage(projectId, database = db) {
  return createFreePageFromTemplate(projectId, 'blank', {}, database);
}

/** normalizeBackground(bg)를 Page.background에 저장(touch). 저장한 값을 돌려준다 (5.3, 5.6, 5.8) */
export async function setPageBackground(id, bg, database = db) {
  const background = normalizeBackground(bg);
  await database.pages.update(id, touch({ background }));
  return background;
}

/** 제목을 trim해서 저장한다 (3.6) */
export async function renamePage(id, title, database = db) {
  await database.pages.update(id, touch({ title: String(title ?? '').trim() }));
}

/**
 * Page와 그 Page의 위젯·InkStroke를 한 트랜잭션에서 지운다.
 * Asset은 건드리지 않는다. 참조가 없어진 Asset은 Asset_GC가 지운다 (4.1, 24.1).
 */
export async function deletePage(id, database = db) {
  await database.transaction('rw', database.pages, database.widgets, database.inkStrokes, async () => {
    await database.widgets.where('pageId').equals(id).delete();
    await database.inkStrokes.where('pageId').equals(id).delete();
    await database.pages.delete(id);
  });
}
