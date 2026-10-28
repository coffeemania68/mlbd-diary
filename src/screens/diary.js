// 다이어리 허브 (요구사항 2.1, 3.1). 월간 페이지와 자유 페이지 목록으로 가는 두 링크.
// 월간은 month 없이 연다. monthly-page.js가 기기 지역 날짜의 이번 달로 주소를 바꾼다.
import '../styles/page.css';

import { h } from '../lib/dom.js';
import { formatHash } from '../router.js';

const HUB_ITEMS = [
  { name: 'monthly', label: '월간 페이지', note: '이번 달 연재 일정과 메모' },
  { name: 'freePages', label: '자유 페이지', note: '주제별로 꾸미는 페이지' },
];

export async function render(el, route) {
  const { projectId } = route;
  const links = HUB_ITEMS.map((item) =>
    h(
      'li',
      {},
      h(
        'a',
        { class: 'diary-hub-link', href: formatHash({ name: item.name, projectId, month: null }) },
        h('span', { class: 'diary-hub-label' }, item.label),
        h('span', { class: 'diary-hub-note' }, item.note),
      ),
    ),
  );
  el.replaceChildren(
    h(
      'section',
      { class: 'diary-hub' },
      h('h1', { class: 'screen-title' }, '다이어리'),
      h('ul', { class: 'diary-hub-items' }, ...links),
    ),
  );
}
