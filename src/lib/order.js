// order 필드 정렬·다음 값 계산

/** order 오름차순, 같으면 createdAt 오름차순. 입력은 바꾸지 않고 새 배열을 반환한다 */
export function sortByOrder(items) {
  return [...items].sort(
    (a, b) => a.order - b.order || (a.createdAt ?? 0) - (b.createdAt ?? 0),
  );
}

/** 비면 0, 아니면 max(order) + 1 */
export function nextOrder(items) {
  if (items.length === 0) return 0;
  return Math.max(...items.map((item) => item.order)) + 1;
}
