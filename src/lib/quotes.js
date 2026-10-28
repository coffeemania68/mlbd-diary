// 대표 대사 배열 편집 (요구사항 13.1, 13.2). 항상 새 배열을 돌려준다.
export function addQuote(quotes, text) {
  return [...(quotes || []), text];
}

export function removeQuote(quotes, index) {
  const list = quotes || [];
  return list.filter((_, i) => i !== index);
}
