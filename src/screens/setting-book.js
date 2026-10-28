// 설정집 화면 (요구사항 16.1, 16.2). BOOK_SECTIONS 7개 구역 목록.
// 구역마다 router.js BOOK_ROUTES 표의 목록 경로로 간다.
import { BOOK_SECTIONS } from '../config.js';
import { h } from '../lib/dom.js';
import { BOOK_ROUTES, formatHash } from '../router.js';
import { PENDING_TEXT } from './placeholder.js';

/** 구역 → 이동할 경로 객체 (구역의 목록 화면) */
export function sectionRoute(projectId, section) {
  return { name: BOOK_ROUTES[section.id][0], projectId };
}

export async function render(el, route) {
  const list = h(
    'ul',
    { class: 'section-list' },
    BOOK_SECTIONS.map((section) =>
      h(
        'li',
        {},
        h(
          'a',
          { class: 'section-link', href: formatHash(sectionRoute(route.projectId, section)) },
          h('span', { class: 'section-link-label' }, section.label),
          section.ready ? null : h('span', { class: 'section-link-status' }, PENDING_TEXT),
        ),
      ),
    ),
  );
  el.replaceChildren(
    h('section', { class: 'setting-book' }, h('h1', { class: 'screen-title' }, '설정집'), list),
  );
}
