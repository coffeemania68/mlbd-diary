// 타임라인 사건(TimelineEvent) 순서 계산. DOM·DB를 쓰지 않는 순수 함수만 둔다.
// 순서는 sortKey 하나로 정한다. 작중 날짜(storyDateLabel)는 자유 문자열이라 정렬에 쓰지 않는다.

/** sortKey 오름차순, 같으면 createdAt 오름차순. 원본은 바꾸지 않는다 */
export function sortTimeline(events) {
  return [...events].sort(
    (a, b) => a.sortKey - b.sortKey || (a.createdAt ?? 0) - (b.createdAt ?? 0),
  );
}

/** max(sortKey) + 1, 비면 0 */
export function nextSortKey(events) {
  if (events.length === 0) return 0;
  return Math.max(...events.map((e) => e.sortKey)) + 1;
}

/**
 * 정렬된 events에서 index와 index+direction(-1 | 1)의 순서를 바꾼다. [{ id, sortKey }] 갱신 목록.
 * 범위 밖이면 [].
 * 두 sortKey가 다르고 다른 사건과도 겹치지 않으면 두 값만 맞바꾼다.
 * 그렇지 않으면(같은 sortKey가 있는 옛 데이터) 바꾼 순서대로 전체를 0..n-1로 다시 매기고,
 * 값이 실제로 바뀌는 사건만 돌려준다.
 */
export function swapTimeline(sortedEvents, index, direction) {
  const other = index + direction;
  const n = sortedEvents.length;
  if (!Number.isInteger(index) || index < 0 || index >= n || other < 0 || other >= n || other === index) {
    return [];
  }
  const a = sortedEvents[index];
  const b = sortedEvents[other];
  const keyCount = (key) => sortedEvents.filter((e) => e.sortKey === key).length;
  if (a.sortKey !== b.sortKey && keyCount(a.sortKey) === 1 && keyCount(b.sortKey) === 1) {
    return [
      { id: a.id, sortKey: b.sortKey },
      { id: b.id, sortKey: a.sortKey },
    ];
  }
  const swapped = [...sortedEvents];
  swapped[index] = b;
  swapped[other] = a;
  return swapped
    .map((e, i) => ({ id: e.id, sortKey: i, old: e.sortKey }))
    .filter((u) => u.old !== u.sortKey)
    .map(({ id, sortKey }) => ({ id, sortKey }));
}
