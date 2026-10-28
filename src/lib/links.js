// Link_Validator와 참고 링크 목록 계산 (요구사항 4, 5, 13.8, 13.9)
// 화면에 <a>를 그리거나 저장하기 전에 반드시 이 파일의 함수를 거친다.
// DB 값도 다시 검사한다. 나중에 검사하지 않은 값이 들어올 수 있기 때문이다.
import { LINK_CATEGORY_PRESETS } from '../config.js';
import { filterView } from './filter.js';

const DEFAULT_CATEGORY = '기타';

/**
 * URL 문자열 검사·정리
 * 1. 앞뒤 공백 제거. 비면 무효
 * 2. 대소문자 구분 없이 'www.'로 시작하면 'https://'를 앞에 붙임
 * 3. new URL()로 해석 못 하면 무효 (스킴 없는 'example.com'도 여기서 걸림)
 * 4. http:, https:가 아니면 무효 (javascript:, data:, file: 등)
 * 5. hostname이 비면 무효
 * 6. 유효: 정리된 href
 * @returns {{ ok: true, url: string } | { ok: false }}
 */
export function normalizeUrl(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return { ok: false };
  if (/^www\./i.test(s)) s = 'https://' + s;
  // new URL()은 앞의 제어 문자를 건너뛰므로, 스킴은 글자 그대로 먼저 확인한다
  if (!/^https?:/i.test(s)) return { ok: false };
  let parsed;
  try {
    parsed = new URL(s);
  } catch {
    return { ok: false };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { ok: false };
  if (!parsed.hostname) return { ok: false };
  return { ok: true, url: parsed.href };
}

/** 검사를 통과하면 정리된 url, 아니면 null (a 대신 글자로 그림) */
export function linkHref(raw) {
  const r = normalizeUrl(raw);
  return r.ok ? r.url : null;
}

/** 링크 자료 카드의 호스트 이름. 무효면 '' */
export function urlHost(raw) {
  const href = linkHref(raw);
  return href ? new URL(href).hostname : '';
}

/** 링크 이름. name.trim()이 비면 url */
export function linkLabel(link) {
  const name = String(link?.name ?? '').trim();
  return name || String(link?.url ?? '');
}

/** 저장 값 → 분류 입력 상태 */
export function categoryToInput(category) {
  if (!category) return { choice: DEFAULT_CATEGORY, custom: '' };
  if (LINK_CATEGORY_PRESETS.includes(category)) return { choice: category, custom: '' };
  return { choice: 'custom', custom: category };
}

/** 분류 입력 상태 → 저장 값. 직접 입력이 비면 '기타' */
export function inputToCategory({ choice, custom }) {
  if (choice === 'custom') return String(custom ?? '').trim() || DEFAULT_CATEGORY;
  return LINK_CATEGORY_PRESETS.includes(choice) ? choice : DEFAULT_CATEGORY;
}

/**
 * 링크 하나 저장 (index가 -1이면 끝에 추가, 아니면 그 위치 수정)
 * @param input { choice, custom, name, url }
 * @returns {{ ok: boolean, links: object[] }} 실패하면 원래 배열
 */
export function saveLink(links, index, input) {
  const r = normalizeUrl(input.url);
  if (!r.ok) return { ok: false, links };
  const link = {
    category: inputToCategory(input),
    name: String(input.name ?? ''),
    url: r.url,
  };
  if (index === -1) return { ok: true, links: [...links, link] };
  return { ok: true, links: links.map((l, i) => (i === index ? link : l)) };
}

/** index 위치 링크를 뺀 새 배열 (확인 창은 화면에서 띄운다) */
export function removeLink(links, index) {
  return links.filter((_, i) => i !== index);
}

/**
 * 분류 필터 + category별 묶음. groups 순서는 options 순서와 같다.
 * items의 index는 links 배열 안 위치 (수정·삭제용)
 */
export function linkCategoryView(links, selected) {
  const entries = links.map((link, index) => ({ link, index }));
  const view = filterView(entries, (e) => [e.link.category], selected, LINK_CATEGORY_PRESETS);
  const order = new Map(view.options.filter((o) => !o.all).map((o, i) => [o.value, i]));
  const byCategory = new Map();
  for (const e of view.visible) {
    const category = e.link.category;
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(e);
  }
  const rank = (c) => (order.has(c) ? order.get(c) : Infinity);
  const groups = [...byCategory.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([category, items]) => ({ category, items }));
  return { options: view.options, selected: view.selected, groups };
}
