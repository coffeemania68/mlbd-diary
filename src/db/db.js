// Dexie 정의와 DB 열기. 화면 코드는 이 파일의 db를 직접 쓰지 않고 db/*.js 함수를 거친다.
import Dexie from 'dexie';
import { SCHEMA_VERSION } from '../config.js';
import { ensureSettings } from './settings.js';
import { MIGRATIONS, runMigrations } from './migrations.js';

export const DB_NAME = 'mlbd-diary';

/**
 * Dexie 인스턴스를 만든다. 앱은 아래 db 하나만 쓰고,
 * 테스트는 다른 이름으로 새로 만들어 서로 섞이지 않게 한다.
 */
export function createDb(name = DB_NAME) {
  const database = new Dexie(name);
  // Dexie 버전 = 색인 구조 버전. 테이블·색인을 바꿀 때만 올린다.
  // 데이터 변환은 config.SCHEMA_VERSION + migrations.js가 맡는다.
  // 스키마 문자열에는 색인할 필드만 적는다. 나머지 필드는 records.js 주석 참고.
  database.version(1).stores({
    projects:       'id, order',
    characters:     'id, projectId, [projectId+order]',
    synopses:       'id, &projectId',
    plotStructures: 'id, projectId',
    plotCards:      'id, projectId, [projectId+sectionIndex]',
    timelineEvents: 'id, projectId, [projectId+sortKey], *characterIds, episodeId',
    mandalarts:     'id, projectId',
    episodes:       'id, projectId, [projectId+number], *characterIds',
    storageItems:   'id, projectId, kind',
    pages:          'id, projectId, kind, [projectId+kind]',
    widgets:        'id, pageId',     // projectId 없이 pageId로 Page에 붙는다
    inkStrokes:     'id, pageId',
    assets:         'id, kind',
    settings:       'id',             // 단일 레코드, toCollection().first()로 읽는다
  });
  // version(2): snapshots 테이블, 월간 페이지 유일성 색인(mlbd-pages-backup).
  // 바뀌지 않는 테이블도 모두 다시 적는다(읽는 사람이 한곳에서 보게).
  database.version(2).stores({
    projects:       'id, order',
    characters:     'id, projectId, [projectId+order]',
    synopses:       'id, &projectId',
    plotStructures: 'id, projectId',
    plotCards:      'id, projectId, [projectId+sectionIndex]',
    timelineEvents: 'id, projectId, [projectId+sortKey], *characterIds, episodeId',
    mandalarts:     'id, projectId',
    episodes:       'id, projectId, [projectId+number], *characterIds',
    storageItems:   'id, projectId, kind',
    // month가 null인 main·free는 고유 색인에 들어가지 않는다(null은 IndexedDB 키가 아니다)
    pages:          'id, projectId, kind, [projectId+kind], &[projectId+kind+month]',
    widgets:        'id, pageId',
    inkStrokes:     'id, pageId',
    assets:         'id, kind',
    settings:       'id',
    snapshots:      'id, createdAt, localDate',  // 앱 전체, projectId 없음
  });
  return database;
}

export const db = createDb();

/** openDatabase가 던지는 오류. kind로 사용자 안내 문구를 고른다. */
export class DatabaseError extends Error {
  /**
   * @param {'open' | 'migration' | 'newer-data'} kind
   *   open: DB 열기 실패(저장 공간 차단 등)
   *   migration: 변환 규칙 실패(전체 되돌림, 데이터 그대로)
   *   newer-data: 저장된 schemaVersion이 앱 값보다 높음(쓰기 안 함)
   */
  constructor(kind, message, cause) {
    super(message, { cause });
    this.name = 'DatabaseError';
    this.kind = kind;
  }
}

/**
 * 앱 시작 시 한 번 부른다. db.open() → ensureSettings() → schemaVersion 확인·변환.
 * target·migrations는 테스트용 인자다. 앱에서는 기본값을 쓴다.
 */
export async function openDatabase(
  database = db,
  { target = SCHEMA_VERSION, migrations = MIGRATIONS } = {},
) {
  let settings;
  try {
    await database.open();
    settings = await ensureSettings(database, target);
  } catch (err) {
    throw new DatabaseError('open', `데이터베이스를 열 수 없습니다: ${err?.name ?? err}`, err);
  }

  if (settings.schemaVersion > target) {
    // 옛 버전 앱이 새 데이터를 연 경우. 데이터를 건드리지 않는다.
    throw new DatabaseError(
      'newer-data',
      `저장된 데이터 버전(${settings.schemaVersion})이 앱 버전(${target})보다 높습니다`,
    );
  }

  if (settings.schemaVersion < target) {
    try {
      await runMigrations(database, settings, target, migrations);
    } catch (err) {
      throw new DatabaseError('migration', `데이터 변환에 실패했습니다: ${err?.message ?? err}`, err);
    }
  }
  return database;
}
