// 시놉시스(Synopsis) 읽기(없으면 생성)·저장.
// 로그라인은 Project와 Synopsis 두 곳에 있으므로 항상 같은 트랜잭션에서 함께 저장한다.
// 모든 함수의 마지막 인자 database는 테스트용이다. 앱에서는 생략한다.
import { db } from './db.js';
import { newRecord, touch } from './records.js';

/** 트랜잭션 안에서 Synopsis를 찾고, 없으면 빈 레코드를 만든다 */
async function findOrAdd(projectId, database, now = Date.now()) {
  const existing = await database.synopses.where('projectId').equals(projectId).first();
  if (existing) return existing;
  const project = await database.projects.get(projectId);
  const synopsis = newRecord(
    { projectId, logline: project?.logline ?? '', short: '', long: '' },
    now,
  );
  await database.synopses.add(synopsis);
  return synopsis;
}

/** 작품의 Synopsis. 없으면 빈 레코드를 만들어 돌려준다 (요구사항 14.3) */
export async function getOrCreateSynopsis(projectId, database = db) {
  return database.transaction('rw', database.projects, database.synopses, () =>
    findOrAdd(projectId, database),
  );
}

/**
 * Synopsis 일부를 바꾼다 (요구사항 14.2). 없으면 먼저 만든다.
 * changes에 logline이 있으면 Project.logline도 같은 트랜잭션에서 바꾼다.
 * 바뀐 Synopsis를 돌려준다.
 */
export async function updateSynopsis(projectId, changes, database = db) {
  return database.transaction('rw', database.projects, database.synopses, async () => {
    // eslint-disable-next-line no-unused-vars
    const { projectId: _ignored, ...rest } = changes;
    const patch = touch(rest);
    if ('logline' in patch) patch.logline = patch.logline ?? '';

    const current = await findOrAdd(projectId, database, patch.updatedAt);
    await database.synopses.update(current.id, patch);

    if ('logline' in patch) {
      const project = await database.projects.get(projectId);
      if (project) {
        await database.projects.update(projectId, touch({ logline: patch.logline }, patch.updatedAt));
      }
    }
    return { ...current, ...patch };
  });
}
