// Settings: 앱 전체에 하나뿐인 레코드. UUID id를 가지며 toCollection().first()로 읽는다.
// 모든 함수의 마지막 인자 database는 테스트용이다. 앱에서는 생략한다.
import { SCHEMA_VERSION } from '../config.js';
import { db } from './db.js';
import { newRecord, touch } from './records.js';

/** 단일 Settings 레코드. 아직 없으면 undefined */
export async function getSettings(database = db) {
  return database.settings.toCollection().first();
}

/**
 * Settings가 없으면 기본값으로 만들고, 있으면 그대로 돌려준다(쓰기 없음).
 * schemaVersion은 새로 만들 때만 정한다. 빈 DB는 이미 최신 구조이므로 앱 값을 쓴다.
 */
export async function ensureSettings(database = db, schemaVersion = SCHEMA_VERSION) {
  return database.transaction('rw', database.settings, async () => {
    const existing = await database.settings.toCollection().first();
    if (existing) return existing;
    const record = newRecord({
      schemaVersion,
      lastBackupAt: null,
      defaultThemeId: null,
      onboardingDone: false,
      lastOpenedProjectId: null,
      snapGrid: false,     // 편집 모드 격자 맞춤
      penDetected: false,  // 이 기기에서 pen 입력을 본 적 있음
      penOnly: false,      // 손글씨 모드에서 펜으로만 쓰기
    });
    await database.settings.add(record);
    return record;
  });
}

/** Settings 일부를 바꾼다. updatedAt은 touch()가 찍는다. 바뀐 레코드를 돌려준다. */
export async function updateSettings(changes, database = db) {
  return database.transaction('rw', database.settings, async () => {
    const current = await database.settings.toCollection().first();
    if (!current) throw new Error('Settings가 없습니다. openDatabase()를 먼저 불러 주세요');
    const patch = touch(changes);
    await database.settings.update(current.id, patch);
    return { ...current, ...patch };
  });
}
