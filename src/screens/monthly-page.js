// 월간 페이지 화면 (요구사항 2.1~2.8). 달마다 한 장.
// month가 없거나 잘못된 주소(router가 null로 줌)면 이번 달로 주소를 replace해 새로고침해도 같은 달을 연다.
// 머리글: "YYYY년 M월"과 이전·다음 달 버튼. 아래는 페이지 화면(손글씨 없음, 14.11).
import '../styles/page.css';

import { ensureMonthlyPage } from '../db/pages.js';
import { addMonths, currentMonth, isValidMonth, monthLabel } from '../lib/calendar.js';
import { h } from '../lib/dom.js';
import { formatHash, navigate, parseHash } from '../router.js';
import { mountPageScreen } from './page/page-screen.js';

export async function render(el, route) {
  const { projectId } = route;
  if (!isValidMonth(route.month)) {
    navigate({ name: 'monthly', projectId, month: currentMonth() }, { replace: true });
    return undefined;
  }
  const { month } = route;

  const page = await ensureMonthlyPage(projectId, month);
  if (formatHash(parseHash(location.hash)) !== formatHash(route)) return undefined;

  const go = (n) => navigate({ name: 'monthly', projectId, month: addMonths(month, n) });
  const head = h(
    'div',
    { class: 'monthly-head' },
    h('button', { type: 'button', class: ['btn', 'monthly-nav'], onclick: () => go(-1) }, '이전 달'),
    h('h1', { class: 'monthly-title' }, monthLabel(month)),
    h('button', { type: 'button', class: ['btn', 'monthly-nav'], onclick: () => go(1) }, '다음 달'),
  );
  const pageEl = h('div', { class: 'page-host' });
  el.replaceChildren(head, pageEl);
  return mountPageScreen(pageEl, { route, page, inkEnabled: false });
}
