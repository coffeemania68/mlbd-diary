// 데이터 변환 규칙. config.SCHEMA_VERSION을 올릴 때 여기에 같은 번호의 규칙을 추가한다.
// (색인·테이블을 바꿀 때는 db.js의 Dexie version도 따로 올린다.)
import { touch } from './records.js';

// 키 = 이 버전으로 올리는 규칙. 예: 2번 규칙은 1 → 2 변환.
// 규칙은 Dexie 트랜잭션 tx를 받아 데이터를 고친다.
export const MIGRATIONS = {
  // 2: Episode에 참고 링크 links[] 추가 (Requirement 15).
  // 데이터 모양만 맞추는 변환이라 updatedAt은 바꾸지 않는다. Dexie version(1) 스키마는 그대로.
  2: async (tx) => {
    await tx.table('episodes').toCollection().modify((e) => {
      if (!Array.isArray(e.links)) e.links = [];
    });
  },
  // 3: Settings에 격자 맞춤·펜 감지·펜으로만 쓰기 필드 (Requirement 25.3).
  // 다른 Record는 건드리지 않고 updatedAt도 바꾸지 않는다. 색인은 Dexie version(2)가 맡는다.
  3: async (tx) => {
    await tx.table('settings').toCollection().modify((s) => {
      if (typeof s.snapGrid !== 'boolean') s.snapGrid = false;
      if (typeof s.penDetected !== 'boolean') s.penDetected = false;
      if (typeof s.penOnly !== 'boolean') s.penOnly = false;
    });
  },
};

/** 순수 함수: 적용할 버전 목록을 오름차순으로 돌려준다. 빠진 규칙이 있으면 오류. */
export function planMigrations(from, to, migrations = MIGRATIONS) {
  const steps = [];
  for (let v = from + 1; v <= to; v++) {
    if (typeof migrations[v] !== 'function') {
      throw new Error(`schemaVersion ${v} 변환 규칙이 없습니다`);
    }
    steps.push(v);
  }
  return steps;
}

/**
 * settings.schemaVersion에서 target까지 규칙을 순서대로 실행한다.
 * 모든 테이블을 묶은 rw 트랜잭션 하나 안에서 실행하므로,
 * 중간에 하나라도 실패하면 데이터와 schemaVersion이 모두 되돌아간다.
 */
export async function runMigrations(db, settings, target, migrations = MIGRATIONS) {
  // 트랜잭션 전에 계획을 세운다. 빠진 규칙이 있으면 아무것도 실행하지 않는다.
  const steps = planMigrations(settings.schemaVersion, target, migrations);
  if (steps.length === 0) return;

  await db.transaction('rw', db.tables, async (tx) => {
    await runMigrationSteps(tx, steps, migrations);
    await tx.table('settings').update(settings.id, touch({ schemaVersion: target }));
  });
}

/**
 * 이미 열린 트랜잭션 tx 안에서 steps(planMigrations 결과)의 규칙을 순서대로 실행한다.
 * schemaVersion은 바꾸지 않는다. 앱 시작 변환과 백업 복원(가져온 데이터 변환)이 함께 쓴다.
 */
export async function runMigrationSteps(tx, steps, migrations = MIGRATIONS) {
  for (const v of steps) {
    await migrations[v](tx);
  }
}
