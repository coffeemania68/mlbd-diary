// 문자열 칩(키워드·태그)과 id 태그(characterIds, episodeIds) 목록 편집.
// 모두 입력 배열을 바꾸지 않는다.

/** 정리한 값이 비거나 이미 있으면 원래 배열 그대로, 아니면 끝에 추가한 새 배열 */
export function addUnique(list, raw, normalize = (s) => String(s ?? '').trim()) {
  const value = normalize(raw);
  if (!value || list.includes(value)) return list;
  return [...list, value];
}

export function removeValue(list, value) {
  return list.filter((v) => v !== value);
}

/** 이미 있으면 그대로 */
export function addId(ids, id) {
  if (ids.includes(id)) return ids;
  return [...ids, id];
}

export function removeId(ids, id) {
  return ids.filter((x) => x !== id);
}
