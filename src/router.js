// 해시 라우팅. 위쪽 순수 함수(parseHash, formatHash, navItemFor, decideStartRoute)는 DOM을 쓰지 않아 node에서 테스트할 수 있다.
//
// 경로 표:
//   #/library                        library      Nav 없음
//   #/library/new                    projectNew   Nav 없음
//   #/welcome                        welcome      Nav 없음 (첫 실행 안내)
//   #/guide                          guide        Nav 없음 (안내서)
//   #/guide/faq                      faq          Nav 없음 (자주 묻는 질문)
//   #/p/:pid/edit                    projectEdit  Nav 없음
//   #/p/:pid/main                    main         메인
//   #/p/:pid/diary                   diary        다이어리
//   #/p/:pid/diary/monthly[/:yyyy-mm] monthly     다이어리 (month: 'YYYY-MM' 또는 null)
//   #/p/:pid/diary/free              freePages    다이어리
//   #/p/:pid/diary/free/:pageId      freePage     다이어리 (pageId)
//   #/p/:pid/book                    book         설정집
//   #/p/:pid/book/characters         characters   설정집
//   #/p/:pid/book/characters/:cid    character    설정집
//   #/p/:pid/book/synopsis           synopsis     설정집
//   #/p/:pid/book/plot               plot         설정집
//   #/p/:pid/book/timeline           timeline     설정집
//   #/p/:pid/book/mandalart          mandalarts   설정집
//   #/p/:pid/book/mandalart/:mid     mandalart    설정집 (mandalartId)
//   #/p/:pid/book/episodes           episodes     설정집
//   #/p/:pid/book/episodes/:eid      episode      설정집 (episodeId)
//   #/p/:pid/book/storage            storage      설정집
//   #/p/:pid/book/storage/:sid       storageItem  설정집 (storageItemId)
//   #/p/:pid/settings                settings     설정
// 설정집 아래 경로는 BOOK_ROUTES 표 하나로 정한다. 구역을 더할 때는 표에 한 줄을 더한다.
import { flushAll } from './lib/autosave.js';
import { setCurrentProject } from './app-state.js';
import { isValidMonth } from './lib/calendar.js';

const LIBRARY = Object.freeze({ name: 'library' });

/**
 * 설정집 구역 id(주소에 쓰는 이름, BOOK_SECTIONS.id) → [목록 경로 name, 상세 경로 name, 상세 id 필드].
 * 상세 화면이 없는 구역은 null.
 */
export const BOOK_ROUTES = Object.freeze({
  characters: Object.freeze(['characters', 'character',   'characterId']),
  synopsis:   Object.freeze(['synopsis',   null,          null]),
  plot:       Object.freeze(['plot',       null,          null]),
  timeline:   Object.freeze(['timeline',   null,          null]),
  mandalart:  Object.freeze(['mandalarts', 'mandalart',   'mandalartId']),
  episodes:   Object.freeze(['episodes',   'episode',     'episodeId']),
  storage:    Object.freeze(['storage',    'storageItem', 'storageItemId']),
});

/** 경로 name → { section, detail, idField } (formatHash·navItemFor용 역참조) */
const BOOK_ROUTE_BY_NAME = new Map();
for (const [section, [listName, detailName, idField]] of Object.entries(BOOK_ROUTES)) {
  BOOK_ROUTE_BY_NAME.set(listName, { section, detail: false, idField: null });
  if (detailName) BOOK_ROUTE_BY_NAME.set(detailName, { section, detail: true, idField });
}

/** 주소의 구역 이름 → 표 줄. '__proto__' 같은 이름은 무시한다 */
function bookRouteFor(section) {
  return Object.hasOwn(BOOK_ROUTES, section) ? BOOK_ROUTES[section] : null;
}

function decode(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** '#/p/abc/book/characters/xyz' → 경로 객체. 모르는 주소 → { name: 'library' } */
export function parseHash(hash) {
  const raw = String(hash ?? '').replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  const parts = raw === '' ? [] : raw.split('/').map(decode);
  if (parts.some((p) => !p)) return { ...LIBRARY };

  if (parts[0] === 'library') {
    if (parts.length === 1) return { name: 'library' };
    if (parts.length === 2 && parts[1] === 'new') return { name: 'projectNew' };
    return { ...LIBRARY };
  }

  if (parts[0] === 'welcome') {
    return parts.length === 1 ? { name: 'welcome' } : { ...LIBRARY };
  }

  if (parts[0] === 'guide') {
    if (parts.length === 1) return { name: 'guide' };
    if (parts.length === 2 && parts[1] === 'faq') return { name: 'faq' };
    return { ...LIBRARY };
  }

  if (parts[0] !== 'p' || parts.length < 3) return { ...LIBRARY };
  const projectId = parts[1];
  const rest = parts.slice(2);

  if (rest.length === 1) {
    if (rest[0] === 'edit') return { name: 'projectEdit', projectId };
    if (rest[0] === 'main') return { name: 'main', projectId };
    if (rest[0] === 'diary') return { name: 'diary', projectId };
    if (rest[0] === 'book') return { name: 'book', projectId };
    if (rest[0] === 'settings') return { name: 'settings', projectId };
    return { ...LIBRARY };
  }

  if (rest[0] === 'diary') {
    if (rest[1] === 'monthly') {
      if (rest.length === 2) return { name: 'monthly', projectId, month: null };
      if (rest.length === 3) {
        return { name: 'monthly', projectId, month: isValidMonth(rest[2]) ? rest[2] : null };
      }
      return { ...LIBRARY };
    }
    if (rest[1] === 'free') {
      if (rest.length === 2) return { name: 'freePages', projectId };
      if (rest.length === 3) return { name: 'freePage', projectId, pageId: rest[2] };
    }
    return { ...LIBRARY };
  }

  if (rest[0] !== 'book') return { ...LIBRARY };
  const row = bookRouteFor(rest[1]);
  if (!row) return { ...LIBRARY };
  const [listName, detailName, idField] = row;
  if (rest.length === 2) return { name: listName, projectId };
  if (rest.length === 3 && detailName) return { name: detailName, projectId, [idField]: rest[2] };
  return { ...LIBRARY };
}

/** 경로 객체 → 해시 문자열. 모르는 경로는 '#/library' */
export function formatHash(route) {
  const enc = encodeURIComponent;
  const p = route && route.projectId != null ? `#/p/${enc(route.projectId)}` : null;
  const book = BOOK_ROUTE_BY_NAME.get(route?.name);
  if (book) {
    if (!p) return '#/library';
    const base = `${p}/book/${enc(book.section)}`;
    if (!book.detail) return base;
    const id = route[book.idField];
    return id != null && id !== '' ? `${base}/${enc(id)}` : '#/library';
  }
  switch (route?.name) {
    case 'library': return '#/library';
    case 'projectNew': return '#/library/new';
    case 'welcome': return '#/welcome';
    case 'guide': return '#/guide';
    case 'faq': return '#/guide/faq';
    case 'projectEdit': return p ? `${p}/edit` : '#/library';
    case 'main': return p ? `${p}/main` : '#/library';
    case 'diary': return p ? `${p}/diary` : '#/library';
    case 'monthly':
      if (!p) return '#/library';
      return isValidMonth(route.month) ? `${p}/diary/monthly/${route.month}` : `${p}/diary/monthly`;
    case 'freePages': return p ? `${p}/diary/free` : '#/library';
    case 'freePage':
      return p && route.pageId != null && route.pageId !== ''
        ? `${p}/diary/free/${enc(route.pageId)}`
        : '#/library';
    case 'book': return p ? `${p}/book` : '#/library';
    case 'settings': return p ? `${p}/settings` : '#/library';
    default: return '#/library';
  }
}

/** 경로에 해당하는 Nav 항목 id. 서재·새 작품·작품 편집·첫 실행 안내·안내서·FAQ는 null */
export function navItemFor(route) {
  if (BOOK_ROUTE_BY_NAME.has(route?.name)) return 'book';
  switch (route?.name) {
    case 'main': return 'main';
    case 'diary':
    case 'monthly':
    case 'freePages':
    case 'freePage':
      return 'diary';
    case 'book': return 'book';
    case 'settings': return 'settings';
    default: return null;
  }
}

/**
 * 해시가 없을 때 시작 화면. projects: [{ id }...], lastOpenedId: string | null.
 * 작품이 0개이고 onboardingDone이 false면 첫 실행 안내(welcome). 기본값 true라 두 인자 호출은 예전과 같다.
 */
export function decideStartRoute(projects, lastOpenedId, { onboardingDone = true } = {}) {
  const count = Array.isArray(projects) ? projects.length : 0;
  if (count === 0 && !onboardingDone) return { name: 'welcome' };
  if (lastOpenedId && Array.isArray(projects) && projects.some((p) => p.id === lastOpenedId)) {
    return { name: 'main', projectId: lastOpenedId };
  }
  return { name: 'library' };
}

/** 경로로 이동한다. replace면 방문 기록을 남기지 않는다. */
export function navigate(route, { replace = false } = {}) {
  const hash = formatHash(route);
  if (replace) {
    const url = `${location.pathname}${location.search}${hash}`;
    location.replace(url);
  } else {
    location.hash = hash;
  }
}

/**
 * hashchange를 감시하며 화면을 바꾼다. 처음 한 번은 바로 그린다.
 * @param {HTMLElement} screenEl  화면을 그릴 <main id="screen">
 * @param {Record<string, { render(el, route): (void | (() => void) | Promise<void | (() => void)>) }>} screens  경로 name → 화면 모듈
 * @param {{ projectExists?: (id: string) => Promise<boolean> | boolean,
 *           onRouteChange?: (route: object, navItem: string | null) => void }} [options]
 * @returns {() => void} 감시 해제 함수
 */
export function startRouter(screenEl, screens, { projectExists, onRouteChange } = {}) {
  let cleanup = null;
  let token = 0; // 겹친 이동은 마지막 해시만 그린다

  function runCleanup() {
    const fn = cleanup;
    cleanup = null;
    if (typeof fn === 'function') {
      try {
        fn();
      } catch (err) {
        console.error(err);
      }
    }
  }

  async function handle() {
    const my = ++token;
    const route = parseHash(location.hash);

    // 1. 떠나는 화면의 저장 대기분을 즉시 저장 (요구사항 9.2, 15.2)
    try {
      await flushAll();
    } catch (err) {
      console.error(err);
    }
    if (my !== token) return;

    // 2. 이전 화면 정리
    runCleanup();

    // 3. 작품 존재 확인. 없으면 서재로 replace (새 hashchange가 다시 그린다)
    if (route.projectId && projectExists) {
      let exists = false;
      try {
        exists = await projectExists(route.projectId);
      } catch (err) {
        console.error(err);
      }
      if (my !== token) return;
      if (!exists) {
        navigate({ name: 'library' }, { replace: true });
        return;
      }
    }

    // 4. 현재 작품 갱신 (lastOpenedProjectId 저장, 상단 바 갱신은 리스너가 함)
    await setCurrentProject(route.projectId ?? null);
    if (my !== token) return;

    // 5. 화면 그리기
    const screen = screens[route.name] ?? screens.library;
    screenEl.replaceChildren();
    let result;
    try {
      result = await screen?.render(screenEl, route);
    } catch (err) {
      console.error(err);
    }
    if (my !== token) {
      // 그리는 사이 다른 이동이 시작됐으면 이 화면의 정리 함수는 바로 실행한다
      if (typeof result === 'function') {
        try { result(); } catch (err) { console.error(err); }
      }
      return;
    }
    cleanup = typeof result === 'function' ? result : null;

    // 6. 위치 문구, Nav 선택 갱신
    onRouteChange?.(route, navItemFor(route));
  }

  window.addEventListener('hashchange', handle);
  handle();
  return () => {
    window.removeEventListener('hashchange', handle);
    token++;
    runCleanup();
  };
}
