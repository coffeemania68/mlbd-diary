// 작품(Project) 생성·수정·목록·연쇄 삭제.
// 로그라인은 Project와 Synopsis 두 곳에 있으므로 항상 같은 트랜잭션에서 함께 저장한다.
// 모든 함수의 마지막 인자 database는 테스트용이다. 앱에서는 생략한다.
import { COVER_COLORS, UNTITLED_PROJECT } from '../config.js';
import { sortByOrder, nextOrder } from '../lib/order.js';
import { db } from './db.js';
import { newRecord, touch } from './records.js';

/** projectId 색인을 가진 테이블. widgets·inkStrokes는 pageId로 따로 지운다 */
const PROJECT_TABLES = [
  'characters',
  'synopses',
  'plotStructures',
  'plotCards',
  'timelineEvents',
  'mandalarts',
  'episodes',
  'storageItems',
  'pages',
];

/** 앞뒤 공백을 지우고, 비면 "제목 없는 작품" (요구사항 8.4) */
function normalizeTitle(title) {
  return String(title ?? '').trim() || UNTITLED_PROJECT;
}

/** 모든 작품을 order 순서로 (요구사항 8.2) */
export async function listProjects(database = db) {
  return sortByOrder(await database.projects.toArray());
}

/** 작품 하나. 없으면 undefined */
export async function getProject(id, database = db) {
  return database.projects.get(id);
}

/**
 * 새 작품을 맨 뒤에 만들고 빈 Synopsis를 같은 트랜잭션에서 함께 만든다 (요구사항 8.3, 8.4, 8.6).
 * @param {{ title?: string, genre?: string, platform?: string, logline?: string, coverColor?: string }} input
 */
export async function createProject(input = {}, database = db) {
  return database.transaction('rw', database.projects, database.synopses, async () => {
    const existing = await database.projects.toArray();
    const logline = input.logline ?? '';
    const now = Date.now();
    const project = newRecord(
      {
        title: normalizeTitle(input.title),
        genre: input.genre ?? '',
        platform: input.platform ?? '',
        logline,
        coverColor: input.coverColor || COVER_COLORS[0].value,
        themeId: null,
        order: nextOrder(existing),
      },
      now,
    );
    await database.projects.add(project);
    await database.synopses.add(
      newRecord({ projectId: project.id, logline, short: '', long: '' }, now),
    );
    return project;
  });
}

/**
 * 작품 일부를 바꾼다 (요구사항 8.8). 제목이 비면 "제목 없는 작품"으로 저장한다.
 * changes에 logline이 있으면 Synopsis.logline도 같은 트랜잭션에서 바꾼다(없으면 만든다).
 * 바뀐 Project를 돌려준다.
 */
export async function updateProject(id, changes, database = db) {
  return database.transaction('rw', database.projects, database.synopses, async () => {
    const current = await database.projects.get(id);
    if (!current) throw new Error(`작품을 찾을 수 없습니다: ${id}`);
    const patch = touch(changes);
    if ('title' in patch) patch.title = normalizeTitle(patch.title);
    if ('logline' in patch) patch.logline = patch.logline ?? '';
    await database.projects.update(id, patch);

    if ('logline' in patch) {
      const synopsis = await database.synopses.where('projectId').equals(id).first();
      if (synopsis) {
        await database.synopses.update(synopsis.id, touch({ logline: patch.logline }, patch.updatedAt));
      } else {
        await database.synopses.add(
          newRecord({ projectId: id, logline: patch.logline, short: '', long: '' }, patch.updatedAt),
        );
      }
    }
    return { ...current, ...patch };
  });
}

/**
 * 작품과 그 작품의 모든 레코드를 한 트랜잭션에서 지운다 (요구사항 8.10).
 * 참조가 없어진 Asset은 지우지 않고 Asset_GC가 정리한다 (요구사항 24.1). Snapshot은 건드리지 않는다.
 * Settings.lastOpenedProjectId가 이 작품이면 null로 비운다 (요구사항 8.11).
 */
export async function deleteProjectCascade(id, database = db) {
  const tables = ['projects', ...PROJECT_TABLES, 'widgets', 'inkStrokes', 'settings'].map((name) =>
    database.table(name),
  );

  return database.transaction('rw', tables, async () => {
    // 1. pageId로 붙은 레코드
    const pageIds = await database.pages.where('projectId').equals(id).primaryKeys();
    if (pageIds.length > 0) {
      await database.widgets.where('pageId').anyOf(pageIds).delete();
      await database.inkStrokes.where('pageId').anyOf(pageIds).delete();
    }

    // 2. projectId 테이블, 마지막으로 작품 자신
    for (const name of PROJECT_TABLES) {
      await database.table(name).where('projectId').equals(id).delete();
    }
    await database.projects.delete(id);

    // 3. 마지막으로 연 작품이었으면 비운다
    const settings = await database.settings.toCollection().first();
    if (settings && settings.lastOpenedProjectId === id) {
      await database.settings.update(settings.id, touch({ lastOpenedProjectId: null }));
    }
  });
}
