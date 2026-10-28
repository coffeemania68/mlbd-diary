// 자주 고치는 값은 모두 여기에 둔다. CODE_GUIDE.md에서 이 파일을 가리킨다.

// vite.config.js의 define으로 package.json version 주입.
// vitest처럼 define이 없는 환경에서도 터지지 않도록 typeof로 확인한다.
export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev';
// 2: Episode.links 추가. 3: Settings.snapGrid·penDetected·penOnly, snapshots 테이블.
// 올릴 때 db/migrations.js에 규칙 추가
export const SCHEMA_VERSION = 3;
export const AUTOSAVE_DELAY_MS = 500;
export const IMAGE_MAX_SIDE = 1600;
export const IMAGE_WEBP_QUALITY = 0.85;
export const UNTITLED_PROJECT = '제목 없는 작품';

export const ROLE_PRESETS = ['주인공', '조연', '악역', '기타'];

// Project.coverColor에는 id가 아니라 value(16진 색)를 저장한다.
export const COVER_COLORS = [
  { id: 'rose',   label: '장미',   value: '#e8a0a8' },
  { id: 'peach',  label: '복숭아', value: '#f2c09b' },
  { id: 'butter', label: '버터',   value: '#efdc8f' },
  { id: 'sage',   label: '세이지', value: '#a9c4a0' },
  { id: 'sky',    label: '하늘',   value: '#9fc3e0' },
  { id: 'lilac',  label: '라일락', value: '#bfa9dc' },
  { id: 'ink',    label: '먹색',   value: '#4a4a58' },
];

export const NAV_ITEMS = [
  { id: 'main',     label: '메인',     icon: '🏠' },
  { id: 'diary',    label: '다이어리', icon: '📔' },
  { id: 'book',     label: '설정집',   icon: '📚' },
  { id: 'settings', label: '설정',     icon: '⚙️' },
];

export const BOOK_SECTIONS = [
  { id: 'characters', label: '캐릭터',   ready: true },
  { id: 'synopsis',   label: '시놉시스', ready: true },
  { id: 'plot',       label: '플롯',     ready: true },
  { id: 'timeline',   label: '타임라인', ready: true },
  { id: 'mandalart',  label: '만다라트', ready: true },
  { id: 'episodes',   label: '에피소드', ready: true },
  { id: 'storage',    label: '보관함',   ready: true },
];

// Episode.status에는 id를 저장한다. reserve: 비축분에 들어가는 상태
export const EPISODE_STATUSES = [
  { id: 'idea',      label: '아이디어', reserve: false },
  { id: 'draft',     label: '초고',     reserve: true },
  { id: 'revised',   label: '퇴고',     reserve: true },
  { id: 'scheduled', label: '예약',     reserve: true },
  { id: 'published', label: '발행',     reserve: false },
];

export const LINK_CATEGORY_PRESETS = ['장소', '음식', '의상', '기타'];

// Mandalart 칸 color에는 value(16진 색)를 저장한다. "색 없음"은 null
// 이미 쓴 value는 바꾸지 않는다(저장된 칸 색이 달라진다).
export const MANDALART_PALETTE = [
  { id: 'rose',   label: '장미',   value: '#f6d4d8' },
  { id: 'peach',  label: '복숭아', value: '#f9e0cc' },
  { id: 'butter', label: '버터',   value: '#f7efc4' },
  { id: 'sage',   label: '세이지', value: '#dbe8d6' },
  { id: 'sky',    label: '하늘',   value: '#d6e6f3' },
  { id: 'lilac',  label: '라일락', value: '#e6dcf2' },
  { id: 'gray',   label: '회색',   value: '#e4e4e8' },
];

// 플롯 구조별 기본 구간. custom은 현재 구간을 복사하므로 sections가 null
export const PLOT_STRUCTURES = [
  { id: 'kishotenketsu', label: '기승전결', sections: ['기', '승', '전', '결'] },
  { id: 'three-act',     label: '3막',     sections: ['1막', '2막', '3막'] },
  { id: 'custom',        label: '직접',     sections: null },
];
export const NEW_SECTION_NAME = '새 구간';

export const UNTITLED_MANDALART = '제목 없는 만다라트';
export const UNTITLED_ITEM = '제목 없는 자료';
export const UNTITLED_EPISODE = '제목 없음';

// ── 다이어리 페이지 (mlbd-pages-backup) ──

// Page_Coordinates: 페이지 하나는 가로 1000 × 세로 1414 단위(A4 비율). lib/geometry.js가 다시 내보낸다.
export const PAGE_W = 1000;
export const PAGE_H = 1414;
export const SNAP_GRID = 25;          // 격자 맞춤 간격
export const WIDGET_MIN_SIZE = 60;    // 위젯 최소 가로·세로

// 위젯 추가 때 기본 크기 (Page_Coordinates)
export const WIDGET_DEFAULT_SIZES = {
  text:          { w: 400, h: 300 },
  checklist:     { w: 400, h: 450 },
  image:         { w: 400, h: 400 },
  calendar:      { w: 900, h: 900 },
  characterCard: { w: 400, h: 250 },
  episodeCard:   { w: 450, h: 250 },
  sticker:       { w: 150, h: 150 },
};

// 스티커 회전 한 번의 각도(도). Widget.rotation은 0 이상 360 미만, 이 값의 배수로 저장한다.
// 바꾸면 이미 저장한 각도가 배수에서 벗어날 수 있다.
export const ROTATION_STEP = 15;

// 페이지를 처음 만들 때의 위젯 배치. 빈 style·data는 위젯 모듈의 defaults()로 채우고 z는 1부터 순서대로.
export const DEFAULT_LAYOUTS = {
  main: [
    { type: 'episodeCard', x: 50,  y: 50,  w: 900, h: 300, data: { mode: 'next' } },
    { type: 'checklist',   x: 50,  y: 400, w: 425, h: 600 },
    { type: 'text',        x: 525, y: 400, w: 425, h: 600 },
  ],
  monthly: [
    { type: 'calendar', x: 50, y: 50,   w: 900, h: 900 },   // month는 page.month를 쓴다
    { type: 'text',     x: 50, y: 1000, w: 900, h: 350 },
  ],
  free: [],
};

// 새 페이지 템플릿. Page.templateId에는 id를 저장한다. layout은 DEFAULT_LAYOUTS 키.
// 이미 쓴 id는 바꾸지 않는다(저장된 Page.templateId가 가리킬 곳을 잃는다).
export const PAGE_TEMPLATES = [
  { id: 'main',    label: '메인 기본', layout: 'main' },
  { id: 'monthly', label: '월간 기본', layout: 'monthly' },
  { id: 'blank',   label: '빈 페이지', layout: 'free' },     // 위젯 0개
];

// 페이지 배경 무늬. Page.background.pattern에는 id를 저장한다. 모르는 id는 'plain'으로 읽는다.
// 이미 쓴 id는 바꾸지 않는다.
export const PAGE_PATTERNS = [
  { id: 'plain', label: '무지' },
  { id: 'lined', label: '줄' },
  { id: 'grid',  label: '모눈' },
  { id: 'dot',   label: '점' },
];
// 무늬 간격 (Page_Coordinates). styles/page.css의 50px과 같은 값이라 두 곳을 함께 고친다.
export const PAGE_PATTERN_GAP = 50;

// 페이지 배경색. Page.background.color에는 value(16진 색)를 저장한다. value null = 테마 종이색.
// 이미 쓴 value는 바꾸지 않는다(저장된 페이지 배경색이 달라진다).
export const PAGE_BG_COLORS = [
  { id: 'theme',  label: '테마 종이색', value: null },
  { id: 'white',  label: '흰색',       value: '#ffffff' },
  { id: 'cream',  label: '크림',       value: '#fbf6ea' },
  { id: 'butter', label: '버터',       value: '#fbf3d5' },
  { id: 'rose',   label: '장미',       value: '#f9e6e8' },
  { id: 'sage',   label: '세이지',     value: '#e6efe1' },
  { id: 'sky',    label: '하늘',       value: '#e3eef7' },
];

// 텍스트 메모 배경색. Widget.style.bg에는 value(16진 색)를 저장한다.
// 이미 쓴 value는 바꾸지 않는다(저장된 메모 색이 달라진다).
export const MEMO_COLORS = [
  { id: 'paper',  label: '종이',   value: '#fffdf7' },
  { id: 'butter', label: '버터',   value: '#fbf1c7' },
  { id: 'rose',   label: '장미',   value: '#f9dde0' },
  { id: 'sage',   label: '세이지', value: '#e1ecdc' },
  { id: 'sky',    label: '하늘',   value: '#dceaf6' },
  { id: 'lilac',  label: '라일락', value: '#ebe2f5' },
];

// 손글씨. InkStroke.color에는 value, size에는 INK_SIZES 값을 저장한다.
export const INK_PALETTE = [
  { id: 'black',  label: '검정', value: '#2b2b33' },
  { id: 'red',    label: '빨강', value: '#d9434f' },
  { id: 'blue',   label: '파랑', value: '#3a6fd8' },
  { id: 'green',  label: '초록', value: '#3f9a5c' },
  { id: 'orange', label: '주황', value: '#ee8a2c' },
  { id: 'purple', label: '보라', value: '#8a5cc8' },
];
export const INK_SIZES = [3, 6, 12];          // 굵기 3단계. 핵심 막대는 INK_SIZES[1]
export const INK_DEFAULT_PRESSURE = 0.5;      // 필압이 없는 입력(손가락·마우스)의 고정 필압
export const INK_HIGHLIGHTER_ALPHA = 0.35;    // 형광펜 불투명도
export const INK_DPR_MAX = 2;                 // 잉크 캔버스 devicePixelRatio 상한
export const ERASER_RADIUS = 12;              // 선 지우개 판정 반경 (Page_Coordinates)

export const HISTORY_LIMIT = 30;              // 페이지 실행 취소 단계 수
export const ZOOM_MAX = 3;                    // 핀치 확대 최대 배율
export const IMAGE_WIDGET_WARN = 10;          // 페이지당 image 위젯이 이 수를 넘으면 안내
export const CALENDAR_MEMO_MAX = 40;          // 달력 날짜 메모 최대 글자 수
export const LONG_PRESS_MS = 500;             // 달력 칸 길게 누르기 시간

// ── 백업·스냅샷 ──
export const SNAPSHOT_KEEP = 7;               // 앱 안에 보관하는 스냅샷 수
export const BACKUP_REMINDER_DAYS = 7;        // 마지막 백업 뒤 이 일수가 지나면 알림 띠
export const BACKUP_FORMAT_ID = 'mlbd-diary-backup';  // 백업 파일 format 값

export const UNTITLED_PAGE = '제목 없는 페이지';

// ── 테마 ──
// Settings.defaultThemeId에는 id를 저장한다. null이나 모르는 id는 DEFAULT_THEME_ID로 읽는다.
// 이미 쓴 id는 바꾸지 않는다(저장된 테마 선택을 잃는다).
// vars는 styles/base.css :root 변수를 덮어쓴다. 테마마다 같은 14개 키를 둔다(lib/themes.js THEME_VAR_KEYS).
// paper 값은 base.css :root 값과 같게 둔다.
export const DEFAULT_THEME_ID = 'paper';
export const THEMES = [
  { id: 'paper', label: '종이', vars: {
    '--color-bg': '#f7f4ef',
    '--color-surface': '#ffffff',
    '--color-surface-alt': '#efeae2',
    '--color-border': '#ddd5c8',
    '--color-text': '#2b2733',
    '--color-text-muted': '#6f6878',
    '--color-accent': '#6b4f8a',
    '--color-accent-strong': '#553d70',
    '--color-accent-soft': '#ece4f4',
    '--color-on-accent': '#ffffff',
    '--color-focus': '#8a6bb0',
    '--page-paper': '#fffdf8',
    '--page-line': '#e4ddd1',
    '--font-body': "system-ui, -apple-system, 'Segoe UI', 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
  } },
  { id: 'bookshop', label: '책방', vars: {
    '--color-bg': '#f2eadc',
    '--color-surface': '#fffaf1',
    '--color-surface-alt': '#e8ddca',
    '--color-border': '#d6c6ad',
    '--color-text': '#2f261f',
    '--color-text-muted': '#6b5d4e',
    '--color-accent': '#8a4b2f',
    '--color-accent-strong': '#6e3a23',
    '--color-accent-soft': '#f2e1d5',
    '--color-on-accent': '#ffffff',
    '--color-focus': '#b0704f',
    '--page-paper': '#fffaf0',
    '--page-line': '#e2d4bf',
    '--font-body': "'Noto Serif KR', 'Noto Serif CJK KR', 'Nanum Myeongjo', 'AppleMyungjo', 'Batang', serif",
  } },
];

// ── 문의 ──
// 버그 제보 양식 주소. 펀딩 페이지가 생기면 https 주소를 넣는다. 비어 있으면 안내 문구만 보인다
export const BUG_REPORT_URL = '';
