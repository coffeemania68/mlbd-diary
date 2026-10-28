// 화면 틀: 상단 바(작품 전환 버튼, 위치 문구), Nav(레일/탭), <main id="screen">.
// DOM은 mountShell()에서 한 번만 만든다. 폭에 따른 레일 ↔ 하단 탭 전환은 styles/shell.css의
// 미디어 쿼리만 맡으므로, 화면 폭이 바뀌어도 #screen 안의 입력 내용은 그대로 남는다(요구사항 6.4).
//
// 만드는 클래스 이름 (스타일은 styles/shell.css):
//   .app                 전체 틀. .no-project가 붙으면 Nav와 작품 전환 버튼을 숨긴다
//   .top-bar             상단 바
//   .project-switcher    작품 제목 버튼 (누르면 서재로)
//   .project-title       버튼 안 제목 글자
//   .location            현재 화면 위치 문구
//   .nav / .nav-item     Nav와 항목 (선택된 항목은 aria-current="page")
//   .nav-icon / .nav-label
//   #screen              화면 모듈이 그리는 자리
//
// locationLabel()은 DOM을 쓰지 않는 순수 함수라 node에서 테스트할 수 있다.
import {
  BOOK_SECTIONS,
  NAV_ITEMS,
  UNTITLED_EPISODE,
  UNTITLED_ITEM,
  UNTITLED_MANDALART,
  UNTITLED_PAGE,
  UNTITLED_PROJECT,
} from './config.js';
import { isValidMonth, monthLabel } from './lib/calendar.js';
import { h } from './lib/dom.js';
import { BOOK_ROUTES, formatHash, navigate } from './router.js';

const SEP = ' › ';
const UNNAMED_CHARACTER = '이름 없는 캐릭터';
const FREE_PAGES = '자유 페이지';

function navLabel(id) {
  return NAV_ITEMS.find((item) => item.id === id)?.label ?? '';
}

function sectionLabel(id) {
  return BOOK_SECTIONS.find((s) => s.id === id)?.label ?? '';
}

/** 경로 name(목록·상세) → 설정집 구역 id. 예: 'mandalarts' → 'mandalart' */
function sectionIdFor(routeName) {
  for (const [section, [listName, detailName]] of Object.entries(BOOK_ROUTES)) {
    if (routeName === listName || routeName === detailName) return section;
  }
  return null;
}

/**
 * 상단 바 위치 문구. 예: { name: 'characters' } → '설정집 › 캐릭터'
 * @param {{ name: string }} route  router.parseHash() 결과
 * @param {{ characterName?: string, recordTitle?: string }} [extras]
 *   상세 화면에서 덧붙일 이름. 캐릭터는 characterName, 에피소드·만다라트·보관함 자료·자유 페이지는 recordTitle
 * @returns {string}
 */
export function locationLabel(route, extras = {}) {
  const book = navLabel('book');
  const detail = (fallback) => {
    const title = String(extras?.recordTitle ?? '').trim() || fallback;
    return book + SEP + sectionLabel(sectionIdFor(route.name)) + SEP + title;
  };
  switch (route?.name) {
    case 'library': return '서재';
    case 'projectNew': return '새 작품';
    case 'projectEdit': return '작품 정보';
    case 'welcome': return '시작하기';
    case 'guide': return '안내서';
    case 'faq': return '안내서' + SEP + '자주 묻는 질문';
    case 'main':
    case 'diary':
    case 'book':
    case 'settings':
      return navLabel(route.name);
    case 'monthly': {
      const base = navLabel('diary') + SEP + '월간';
      return isValidMonth(route.month) ? base + SEP + monthLabel(route.month) : base;
    }
    case 'freePages': return navLabel('diary') + SEP + FREE_PAGES;
    case 'freePage': {
      const title = String(extras?.recordTitle ?? '').trim() || UNTITLED_PAGE;
      return navLabel('diary') + SEP + FREE_PAGES + SEP + title;
    }
    case 'characters':
    case 'synopsis':
    case 'episodes':
    case 'plot':
    case 'timeline':
    case 'mandalarts':
    case 'storage':
      return book + SEP + sectionLabel(sectionIdFor(route.name));
    case 'character': {
      const name = String(extras?.characterName ?? '').trim() || UNNAMED_CHARACTER;
      return book + SEP + sectionLabel('characters') + SEP + name;
    }
    case 'episode': return detail(UNTITLED_EPISODE);
    case 'mandalart': return detail(UNTITLED_MANDALART);
    case 'storageItem': return detail(UNTITLED_ITEM);
    default: return '';
  }
}

/** Nav 항목 href. 작품이 없으면 서재로 */
function navHref(projectId, navItemId) {
  if (projectId == null) return '#/library';
  return formatHash({ name: navItemId, projectId });
}

/**
 * 화면 틀을 rootEl 안에 한 번 만든다.
 * @param {HTMLElement} rootEl  index.html의 #app
 * @returns {{ appEl: HTMLElement, screenEl: HTMLElement,
 *             setProjectTitle(title: string): void,
 *             updateNav(projectId: string | null, navItemId: string | null): void,
 *             setLocation(text: string): void,
 *             setNoProject(on: boolean): void }}
 */
export function mountShell(rootEl) {
  const titleEl = h('span', { class: 'project-title' }, UNTITLED_PROJECT);
  const switcher = h(
    'button',
    {
      type: 'button',
      class: 'project-switcher',
      'aria-label': '작품 바꾸기 (서재로 이동)',
      onclick: () => navigate({ name: 'library' }),
    },
    titleEl,
    h('span', { class: 'project-switcher-caret', 'aria-hidden': 'true' }, '▾'),
  );
  const locationEl = h('span', { class: 'location', 'aria-live': 'polite' });
  const topBar = h('header', { class: 'top-bar' }, switcher, locationEl);

  const navLinks = new Map();
  const nav = h(
    'nav',
    { class: 'nav', 'aria-label': '주 메뉴' },
    NAV_ITEMS.map((item) => {
      const link = h(
        'a',
        { class: 'nav-item', href: '#/library', dataset: { nav: item.id } },
        h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, item.icon),
        h('span', { class: 'nav-label' }, item.label),
      );
      navLinks.set(item.id, link);
      return link;
    }),
  );

  const screenEl = h('main', { id: 'screen' });
  const appEl = h('div', { class: ['app', 'no-project'] }, topBar, nav, screenEl);
  rootEl.replaceChildren(appEl);

  function setProjectTitle(title) {
    const text = String(title ?? '').trim() || UNTITLED_PROJECT;
    titleEl.textContent = text;
    switcher.title = text;
  }

  function updateNav(projectId, navItemId) {
    for (const [id, link] of navLinks) {
      link.setAttribute('href', navHref(projectId, id));
      if (id === navItemId) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  function setLocation(text) {
    locationEl.textContent = String(text ?? '');
  }

  function setNoProject(on) {
    appEl.classList.toggle('no-project', Boolean(on));
  }

  return { appEl, screenEl, setProjectTitle, updateNav, setLocation, setNoProject };
}
