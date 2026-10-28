import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createDb } from '../src/db/db.js';
import { sortTimeline, nextSortKey, swapTimeline } from '../src/lib/timeline.js';
import {
  listTimelineEvents,
  createTimelineEvent,
  updateTimelineEvent,
  deleteTimelineEvent,
  saveTimelineOrder,
} from '../src/db/timeline.js';

let n = 0;
const freshDb = () => createDb(`test-timeline-${Date.now()}-${n++}`);

// 사건 목록: sortKey는 좁은 범위라 자주 겹친다(옛 데이터), createdAt은 서로 달라 정렬이 하나로 정해진다
const eventsArb = fc
  .array(fc.integer({ min: -3, max: 6 }), { maxLength: 10 })
  .map((keys) => keys.map((k, i) => ({ id: `t${i}`, sortKey: k, createdAt: i })));

/** 갱신 목록을 적용한 새 사건 목록 */
function apply(events, updates) {
  const byId = new Map(updates.map((u) => [u.id, u.sortKey]));
  return events.map((e) => (byId.has(e.id) ? { ...e, sortKey: byId.get(e.id) } : e));
}

const ids = (events) => events.map((e) => e.id);

describe('lib/timeline', () => {
  it('nextSortKey: 비면 0, 아니면 최댓값 + 1', () => {
    expect(nextSortKey([])).toBe(0);
    expect(nextSortKey([{ sortKey: 3 }, { sortKey: -1 }])).toBe(4);
  });

  it('sortTimeline: sortKey, 같으면 createdAt 순. 원본은 그대로', () => {
    const events = [
      { id: 'a', sortKey: 1, createdAt: 2 },
      { id: 'b', sortKey: 0, createdAt: 3 },
      { id: 'c', sortKey: 1, createdAt: 1 },
    ];
    expect(ids(sortTimeline(events))).toEqual(['b', 'c', 'a']);
    expect(ids(events)).toEqual(['a', 'b', 'c']);
  });

  // **Validates: Requirements 10.1, 10.4, 10.6**
  it('Property 19: 타임라인 새 사건과 교환', () => {
    fc.assert(
      fc.property(
        eventsArb,
        fc.integer({ min: -2, max: 11 }),
        fc.constantFrom(-1, 1),
        (events, index, direction) => {
          const next = nextSortKey(events);
          expect(events.every((e) => next > e.sortKey)).toBe(true);

          const sorted = sortTimeline(events);
          const snapshot = JSON.stringify(sorted);
          const updates = swapTimeline(sorted, index, direction);
          expect(JSON.stringify(sorted)).toBe(snapshot);

          const other = index + direction;
          if (index < 0 || index >= sorted.length || other < 0 || other >= sorted.length) {
            expect(updates).toEqual([]);
            return;
          }
          const expected = ids(sorted);
          [expected[index], expected[other]] = [expected[other], expected[index]];
          expect(ids(sortTimeline(apply(sorted, updates)))).toEqual(expected);
        },
      ),
    );
  });
});

describe('db/timeline', () => {
  it('사건 만들기·고치기·지우기', async () => {
    const database = freshDb();
    const a = await createTimelineEvent('p1', database);
    const b = await createTimelineEvent('p1', database);
    expect(a).toMatchObject({
      projectId: 'p1',
      storyDateLabel: '',
      sortKey: 0,
      title: '',
      description: '',
      characterIds: [],
      episodeId: null,
    });
    expect(b.sortKey).toBe(1);
    expect((await createTimelineEvent('p2', database)).sortKey).toBe(0);

    const updated = await updateTimelineEvent(a.id, { title: '첫 만남', episodeId: 'e1' }, database);
    expect(updated).toMatchObject({ title: '첫 만남', episodeId: 'e1', sortKey: 0 });
    await expect(updateTimelineEvent('missing', { title: 'x' }, database)).rejects.toThrow();

    await deleteTimelineEvent(b.id, database);
    expect(ids(await listTimelineEvents('p1', database))).toEqual([a.id]);
  });

  it('saveTimelineOrder 후 다시 읽으면 바꾼 순서다. 없는 사건이 있으면 전체 되돌림', async () => {
    const database = freshDb();
    const a = await createTimelineEvent('p1', database);
    const b = await createTimelineEvent('p1', database);
    const c = await createTimelineEvent('p1', database);

    const listed = await listTimelineEvents('p1', database);
    await saveTimelineOrder(swapTimeline(listed, 2, -1), database);
    expect(ids(await listTimelineEvents('p1', database))).toEqual([a.id, c.id, b.id]);

    const before = await listTimelineEvents('p1', database);
    await expect(
      saveTimelineOrder([{ id: a.id, sortKey: 9 }, { id: 'missing', sortKey: 0 }], database),
    ).rejects.toThrow();
    expect(await listTimelineEvents('p1', database)).toEqual(before);
  });

  // **Validates: Requirements 16.7**
  it('Property 24: listTimelineEvents 작품 격리', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom('p1', 'p2', 'p3'), { maxLength: 10 }),
        fc.constantFrom('p1', 'p2', 'p3'),
        async (projects, target) => {
          const database = freshDb();
          const created = [];
          for (const p of projects) created.push(await createTimelineEvent(p, database));
          const listed = await listTimelineEvents(target, database);
          expect(listed.every((e) => e.projectId === target)).toBe(true);
          expect(ids(listed).sort()).toEqual(
            ids(created.filter((e) => e.projectId === target)).sort(),
          );
          database.close();
        },
      ),
      { numRuns: 25 },
    );
  });
});
