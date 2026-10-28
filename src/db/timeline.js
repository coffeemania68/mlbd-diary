// 타임라인 사건(TimelineEvent).
// 순서 저장(saveTimelineOrder)은 한 트랜잭션으로 묶어 중간 상태가 남지 않게 한다.
// 모든 함수의 마지막 인자 database는 테스트용이다. 앱에서는 생략한다.
import { db } from './db.js';
import { newRecord, touch } from './records.js';
import { sortTimeline, nextSortKey } from '../lib/timeline.js';

/** 작품의 사건 목록. sortTimeline 순서 */
export async function listTimelineEvents(projectId, database = db) {
  const events = await database.timelineEvents.where('projectId').equals(projectId).toArray();
  return sortTimeline(events);
}

/** 빈 사건을 목록 끝에 만든다. sortKey = 그 작품 사건들의 nextSortKey */
export async function createTimelineEvent(projectId, database = db) {
  return database.transaction('rw', database.timelineEvents, async () => {
    const existing = await database.timelineEvents.where('projectId').equals(projectId).toArray();
    const event = newRecord({
      projectId,
      storyDateLabel: '',
      sortKey: nextSortKey(existing),
      title: '',
      description: '',
      characterIds: [],
      episodeId: null,
    });
    await database.timelineEvents.add(event);
    return event;
  });
}

/** 사건 일부(storyDateLabel, title, description, characterIds, episodeId)를 바꾼다. 바뀐 레코드를 돌려준다 */
export async function updateTimelineEvent(id, changes, database = db) {
  return database.transaction('rw', database.timelineEvents, async () => {
    const current = await database.timelineEvents.get(id);
    if (!current) throw new Error(`타임라인 사건이 없습니다: ${id}`);
    const patch = touch(changes);
    await database.timelineEvents.update(id, patch);
    return { ...current, ...patch };
  });
}

/** 사건을 지운다. 다른 레코드가 참조하지 않으므로 연쇄 정리는 없다 */
export async function deleteTimelineEvent(id, database = db) {
  await database.timelineEvents.delete(id);
}

/** [{ id, sortKey }]를 한 트랜잭션에서 (touch). 없는 사건이 있으면 오류(전체 되돌림) */
export async function saveTimelineOrder(updates, database = db) {
  if (updates.length === 0) return;
  return database.transaction('rw', database.timelineEvents, async () => {
    const now = Date.now();
    for (const { id, sortKey } of updates) {
      const current = await database.timelineEvents.get(id);
      if (!current) throw new Error(`타임라인 사건이 없습니다: ${id}`);
      await database.timelineEvents.update(id, touch({ sortKey }, now));
    }
  });
}
