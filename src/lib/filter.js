// 분류·태그 필터 공통 계산 (요구사항 4.6~4.8, 14.1~14.4)
// 선택값은 문자열이 아니라 { all: true } 또는 { value } 객체다.
// 사용자가 "전체"라는 분류나 태그를 만들어도 필터의 "전체"와 섞이지 않는다.

export const ALL = Object.freeze({ all: true });

export function isSameOption(a, b) {
  if (!a || !b) return false;
  if (a.all || b.all) return Boolean(a.all) && Boolean(b.all);
  return a.value === b.value;
}

export function optionLabel(option) {
  return option && option.all ? '전체' : option.value;
}

function hasValue(v) {
  return typeof v === 'string' && v !== '';
}

/**
 * @param items     레코드 목록
 * @param valuesOf  item → 그 item의 값 배열
 * @param selected  { all: true } | { value }
 * @param presets   먼저 보일 값 순서. 나머지는 한국어 가나다순
 * @returns {{ options, selected, visible }}
 */
export function filterView(items, valuesOf, selected, presets = []) {
  const used = new Set();
  for (const item of items) {
    for (const v of valuesOf(item) ?? []) {
      if (hasValue(v)) used.add(v);
    }
  }
  const first = presets.filter((p) => used.has(p));
  const rest = [...used]
    .filter((v) => !presets.includes(v))
    .sort((a, b) => a.localeCompare(b, 'ko'));
  const options = [ALL, ...[...first, ...rest].map((value) => ({ value }))];

  const current = options.find((o) => isSameOption(o, selected)) || ALL;
  const visible = current.all
    ? [...items]
    : items.filter((item) => (valuesOf(item) ?? []).includes(current.value));
  return { options, selected: current, visible };
}
