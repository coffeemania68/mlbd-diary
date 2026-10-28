// 앱 시작점. 시작 순서 (design.md "시작 순서"):
//   1. 영구 보존 요청 (기다리지 않음, 요구사항 5.1·5.2)
//   2. DB 열기·schemaVersion 변환. 실패하면 전체 화면 안내 후 중단 (요구사항 3.3)
//   3. 설정을 읽어 테마 적용 (applyTheme). 실패해도 기본 테마로 계속한다
//   4. 셸(상단 바·Nav) 만들기
//   5. 주소에 해시가 없으면 시작 화면 결정 후 replace (요구사항 7.2~7.4).
//      작품이 0개이고 onboardingDone이 아니면 첫 실행 안내(welcome). 3에서 읽은 설정을 쓴다
//   6. 라우터 시작
//   7. 하루 한 번 자동 보관 확인·Asset 정리
// 화면을 추가·교체할 때는 아래 SCREENS 표의 한 줄만 고친다.
import './styles/base.css';
import './styles/shell.css';
import './styles/screens.css';
// confirmDialog·toast(lib/dom.js) 스타일. 어느 화면으로 바로 들어와도 있도록 여기서 한 번만 불러온다
import './styles/dialog.css';

import { requestPersistence } from './storage.js';
import { openDatabase, DatabaseError } from './db/db.js';
import { getProject, listProjects } from './db/projects.js';
import { getSettings } from './db/settings.js';
import { requestAssetGc } from './db/asset-gc.js';
import { maybeCreateDailySnapshot } from './db/snapshots.js';
import { onProjectChange } from './app-state.js';
import { flushAll } from './lib/autosave.js';
import { mountShell } from './shell.js';
import { decideStartRoute, navigate, startRouter } from './router.js';
import { setShell, showRouteLocation } from './ui.js';
import { h } from './lib/dom.js';
import { applyTheme } from './theme.js';

import * as mainScreen from './screens/main-screen.js';
import * as diaryScreen from './screens/diary.js';
import * as monthlyPageScreen from './screens/monthly-page.js';
import * as freePageListScreen from './screens/free-page-list.js';
import * as freePageScreen from './screens/free-page.js';
import * as bookScreen from './screens/setting-book.js';
import * as settingsScreen from './screens/settings.js';
import * as libraryScreen from './screens/library.js';
import { newProjectScreen, editProjectScreen } from './screens/project-form.js';
import * as characterListScreen from './screens/character-list.js';
import * as characterDetailScreen from './screens/character-detail.js';
import * as synopsisScreen from './screens/synopsis.js';
import * as episodeListScreen from './screens/episode-list.js';
import * as episodeDetailScreen from './screens/episode-detail.js';
import * as plotScreen from './screens/plot.js';
import * as timelineScreen from './screens/timeline.js';
import * as mandalartListScreen from './screens/mandalart-list.js';
import * as mandalartScreen from './screens/mandalart.js';
import * as storageListScreen from './screens/storage-list.js';
import * as storageItemScreen from './screens/storage-item.js';
import * as welcomeScreen from './screens/welcome.js';
import * as guideScreen from './screens/guide.js';
import { faqScreen } from './screens/guide.js';

// 경로 name → 화면 모듈 ({ render(el, route) }). router.js의 경로 표와 같은 이름을 쓴다.
const SCREENS = {
  library:     libraryScreen,
  projectNew:  newProjectScreen,
  projectEdit: editProjectScreen,
  main:        mainScreen,
  diary:       diaryScreen,
  monthly:     monthlyPageScreen,
  freePages:   freePageListScreen,
  freePage:    freePageScreen,
  book:        bookScreen,
  characters:  characterListScreen,
  character:   characterDetailScreen,
  synopsis:    synopsisScreen,
  episodes:    episodeListScreen,
  episode:     episodeDetailScreen,
  plot:        plotScreen,
  timeline:    timelineScreen,
  mandalarts:  mandalartListScreen,
  mandalart:   mandalartScreen,
  storage:     storageListScreen,
  storageItem: storageItemScreen,
  settings:    settingsScreen,
  welcome:     welcomeScreen,
  guide:       guideScreen,
  faq:         faqScreen,
};

// DB 오류 종류별 안내 문구 (design.md Error Handling)
const DB_ERROR_TEXT = {
  open: '데이터를 열 수 없습니다. 크롬에서 다시 열어 주세요.',
  migration: '업데이트 중 문제가 생겼습니다. 데이터는 바뀌지 않았습니다.',
  'newer-data': '앱을 최신 버전으로 다시 열어 주세요.',
};

/** 시작을 막는 오류를 #app 전체에 보여 준다. */
function showFatalError(rootEl, err) {
  const kind = err instanceof DatabaseError ? err.kind : 'open';
  const text = DB_ERROR_TEXT[kind] ?? DB_ERROR_TEXT.open;
  // 열기 실패는 원인 오류 이름(예: InvalidStateError)을 같이 보여 준다.
  const detail = kind === 'open' ? (err?.cause?.name ?? err?.name ?? '') : '';
  rootEl.replaceChildren(
    h(
      'div',
      { class: 'fatal-error', role: 'alert' },
      h('p', { class: 'fatal-error-text' }, text),
      detail ? h('p', { class: 'fatal-error-detail' }, detail) : null,
    ),
  );
}

export async function start() {
  const rootEl = document.getElementById('app');

  // 1. 기다리지 않는다. 결과는 설정 화면이 따로 확인한다.
  requestPersistence().catch((err) => console.error(err));

  // 2. DB 열기
  try {
    await openDatabase();
  } catch (err) {
    console.error(err);
    showFatalError(rootEl, err);
    return;
  }

  // 3. 테마. 설정 읽기나 적용이 실패해도 기본 테마(CSS 기본값)로 계속한다
  let settings = null;
  try {
    settings = await getSettings();
    applyTheme(settings?.defaultThemeId);
  } catch (err) {
    console.error(err);
  }

  // 4. 셸
  const shell = mountShell(rootEl);
  setShell(shell);

  // 작품이 바뀌면 상단 바 제목을 그 작품 제목으로 (늦게 온 결과는 버린다)
  let titleToken = 0;
  onProjectChange(async (id) => {
    const my = ++titleToken;
    if (id == null) return;
    try {
      const project = await getProject(id);
      if (my === titleToken) shell.setProjectTitle(project?.title);
    } catch (err) {
      console.error(err);
    }
  });

  // 5. 해시가 없으면 마지막 작품의 메인, 없으면 서재 (작품 0개·안내 전이면 첫 실행 안내)
  if (!location.hash || location.hash === '#') {
    try {
      const projects = await listProjects();
      navigate(
        decideStartRoute(projects, settings?.lastOpenedProjectId ?? null, {
          onboardingDone: Boolean(settings?.onboardingDone),
        }),
        { replace: true },
      );
    } catch (err) {
      console.error(err);
      navigate({ name: 'library' }, { replace: true });
    }
  }

  // 6. 라우터. 서재·새 작품에서는 Nav와 작품 전환 버튼을 숨긴다(작품 정보 편집에서는 보인다).
  startRouter(shell.screenEl, SCREENS, {
    projectExists: async (id) => Boolean(await getProject(id)),
    onRouteChange: (route, navItem) => {
      shell.updateNav(route.projectId ?? null, navItem);
      shell.setNoProject(!route.projectId);
      showRouteLocation(route);
    },
  });

  // 7. 시작 뒤 하루 한 번 자동 보관을 확인하고, 지난번에 정리하지 못한 Asset을 정리한다 (22.1, 24.6)
  setTimeout(() => maybeCreateDailySnapshot().finally(requestAssetGc), 0);

  // 앱을 내리거나 탭을 바꿀 때 저장 대기분을 즉시 저장 (요구사항 15.3).
  // 다시 보이면 자동 보관 조건을 확인한다 (22.2)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushAll().catch((err) => console.error(err));
    } else if (document.visibilityState === 'visible') {
      maybeCreateDailySnapshot();
    }
  });
}

start();
