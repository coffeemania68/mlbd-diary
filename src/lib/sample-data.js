// lib/sample-data.js
// 예시 작품(Sample_Project) Record 묶음을 만드는 순수 함수. DOM·DB를 쓰지 않는다.
// 레코드 필드는 createProject, getOrCreateSynopsis, createCharacter, createEpisode,
// getOrCreatePlotStructure, createPlotCard, createTimelineEvent, newPage·layoutWidgets(db/pages.js)의 기본 레코드와 같다.
// db/pages.js는 DB를 불러오므로 가져오지 않고 같은 모양을 여기서 만든다.
// 저장은 db/sample.js의 createSampleProject가 한 트랜잭션에서 한다 (요구사항 8.5).
import { COVER_COLORS, DEFAULT_LAYOUTS, MEMO_COLORS, PLOT_STRUCTURES } from '../config.js';
import { newRecord } from '../db/records.js';

const pad2 = (n) => String(n).padStart(2, '0');

/** date에서 days일 옮긴 기기 지역 날짜 'YYYY-MM-DD' */
function localDate(date, days = 0) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  return `${String(d.getFullYear()).padStart(4, '0')}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const LOGLINE = '밤에만 문을 여는 서점에서 일하게 된 대학생이, 책 속으로 사라진 사람들을 찾아 나선다.';

const CHARACTERS = [
  {
    name: '한서윤',
    role: '주인공',
    age: '22세',
    appearance: '늘 가방에 문고본을 넣고 다니는 휴학생',
    personality: '겁이 많지만 궁금한 건 끝까지 확인한다',
    goal: '실종된 언니가 마지막으로 들른 서점의 비밀을 밝힌다',
    secret: '책을 펼치면 가끔 글자가 움직이는 게 보인다',
    quotes: ['펼쳐 보기 전에는 아무것도 모르는 거잖아요.', '이 책, 아까랑 결말이 달라요.'],
    memo: '',
  },
  {
    name: '도하',
    role: '조연',
    age: '나이 불명',
    appearance: '낡은 카디건을 입은 서점 주인',
    personality: '말수가 적고 농담이 서툴다',
    goal: '서점이 지키는 책들을 다음 주인에게 넘긴다',
    secret: '백 년 전 책 속에서 걸어 나왔다',
    quotes: ['자정이 지나면 책장은 손님을 고릅니다.'],
    memo: '',
  },
  {
    name: '윤마르',
    role: '악역',
    age: '30대',
    appearance: '검은 장갑을 낀 고서 수집가',
    personality: '정중하지만 원하는 건 반드시 손에 넣는다',
    goal: '사람을 가두는 마지막 책을 완성한다',
    secret: '서윤의 언니를 책 속에 가둔 장본인이다',
    quotes: ['좋은 이야기는 등장인물을 놓아주지 않죠.', '값은 넉넉히 치르겠습니다.'],
    memo: '',
  },
];

const EPISODES = [
  {
    title: '자정의 서점',
    keywords: ['첫 출근', '자정'],
    places: ['달빛 서점'],
    keyPoints: '서윤이 언니의 영수증을 들고 서점을 찾아가 아르바이트를 시작한다.',
    status: 'published',
    offset: -7,
    targetChars: 5000,
    actualChars: 5230,
    cast: [0, 1],
  },
  {
    title: '움직이는 글자',
    keywords: ['책장', '첫 이상 현상'],
    places: ['달빛 서점', '서고'],
    keyPoints: '서윤이 펼친 책의 문장이 바뀌고, 도하가 서점의 규칙을 알려 준다.',
    status: 'scheduled',
    offset: 0,
    targetChars: 5000,
    actualChars: 5050,
    cast: [0, 1],
  },
  {
    title: '검은 장갑의 손님',
    keywords: ['수집가', '거래'],
    places: ['달빛 서점'],
    keyPoints: '윤마르가 찾아와 금서를 팔라고 제안한다. 도하는 거절한다.',
    status: 'revised',
    offset: 7,
    targetChars: 5000,
    actualChars: 4800,
    cast: [0, 1, 2],
  },
  {
    title: '언니의 책갈피',
    keywords: ['단서'],
    places: ['서고'],
    keyPoints: '서윤이 서고에서 언니의 책갈피가 꽂힌 책을 발견한다.',
    status: 'draft',
    offset: null,
    targetChars: 5000,
    actualChars: 2100,
    cast: [0, 2],
  },
  {
    title: '책 속으로',
    keywords: ['결심'],
    places: ['책 속 세계'],
    keyPoints: '서윤이 언니를 찾으려고 책 속으로 들어가기로 한다.',
    status: 'idea',
    offset: null,
    targetChars: 5000,
    actualChars: 0,
    cast: [0, 1, 2],
  },
];

const PLOT_TYPE = 'kishotenketsu';

// 구간(기·승·전·결)마다 1장. episodes는 EPISODES 인덱스
const PLOT_CARDS = [
  { title: '자정의 아르바이트', summary: '서윤이 언니의 영수증을 따라 달빛 서점에서 일하기 시작한다.', episodes: [0] },
  { title: '서점의 규칙', summary: '책 속 문장이 바뀌고, 도하가 서점이 지키는 책들의 비밀을 털어놓는다.', episodes: [1, 2] },
  { title: '언니의 흔적', summary: '서고에서 언니의 책갈피가 꽂힌 책을 찾고, 윤마르가 그 책을 노린다.', episodes: [3] },
  { title: '책 속으로', summary: '서윤이 언니를 데려오려고 직접 이야기 속에 들어간다.', episodes: [4] },
];

// cast는 CHARACTERS 인덱스, episode는 EPISODES 인덱스(없으면 null)
const TIMELINE_EVENTS = [
  { storyDateLabel: '석 달 전', title: '언니 실종', description: '언니가 달빛 서점 영수증만 남기고 사라진다.', cast: [0, 2], episode: null },
  { storyDateLabel: '3월 2일 자정', title: '첫 출근', description: '서윤이 달빛 서점에서 아르바이트를 시작한다.', cast: [0, 1], episode: 0 },
  { storyDateLabel: '3월 9일 밤', title: '수집가의 방문', description: '윤마르가 금서를 사겠다고 찾아온다.', cast: [0, 1, 2], episode: 2 },
];

// 메인 페이지 체크리스트 [text, done]
const CHECKLIST_ITEMS = [
  ['1화 댓글 답장하기', true],
  ['2화 예약 확인', false],
  ['3화 퇴고 마무리', false],
];

const MAIN_MEMO = {
  title: '이번 주 메모',
  body: '2화 예약 시간을 확인하고, 3화 마지막 장면에서 윤마르의 대사를 다듬기.',
};

const FREE_MEMO = {
  title: '꾸미기 예시',
  body: '편집 모드에서 옮겨 보세요. 스티커를 고르고 돌려 볼 수도 있어요.',
};

// [stickerId, x, y, rotation]. id는 lib/sticker-pack.js의 것
const FREE_STICKERS = [
  ['star', 620, 60, 0],
  ['moon', 800, 160, 15],
  ['book', 120, 440, 345],
  ['heart', 380, 460, 0],
];

/**
 * 예시 작품 Record 묶음. ids()는 새 id를 돌려주는 함수(테스트는 고정 생성기).
 * → { projectId, tables: { projects, synopses, characters, episodes, plotStructures, plotCards,
 *                          timelineEvents, pages, widgets } }  (없는 테이블은 [])
 * 2화 publishDate가 today라서 nextEpisode가 2화를 찾고, 이번 달 달력에 2화가 보인다 (8.4).
 */
export function buildSampleProject({
  now = Date.now(),
  today = new Date(),
  order = 0,
  ids = () => crypto.randomUUID(),
} = {}) {
  const record = (fields) => newRecord(fields, now, ids());

  const project = record({
    title: '예시 · 달빛 서점의 비밀',
    genre: '현대 판타지',
    platform: '예시',
    logline: LOGLINE,
    coverColor: (COVER_COLORS[3] ?? COVER_COLORS[0]).value,
    themeId: null,
    order,
  });
  const projectId = project.id;

  const synopsis = record({
    projectId,
    logline: LOGLINE,
    short:
      '휴학생 한서윤은 실종된 언니의 영수증을 따라 자정에만 여는 달빛 서점에 들어간다. ' +
      '그곳의 책들은 읽는 사람을 이야기 속으로 데려간다. 서윤은 서점 주인 도하와 함께 언니를 찾기로 한다.',
    long:
      '언니가 사라진 지 석 달, 서윤은 언니의 가방에서 "달빛 서점"이라고 적힌 영수증을 찾는다. ' +
      '자정에 문을 여는 그 서점에서 아르바이트를 시작한 서윤은 책 속 문장이 저절로 바뀌는 것을 보고, ' +
      '이 서점이 사람을 삼킨 책들을 지키는 곳이라는 걸 알게 된다. 고서 수집가 윤마르가 서점의 금서를 노리며 ' +
      '다가오고, 서윤은 언니의 책갈피가 꽂힌 책을 단서로 직접 이야기 속에 들어가기로 결심한다.',
  });

  const characters = CHARACTERS.map((c, index) =>
    record({
      projectId,
      name: c.name,
      role: c.role,
      age: c.age,
      appearance: c.appearance,
      personality: c.personality,
      goal: c.goal,
      secret: c.secret,
      quotes: [...c.quotes],
      imageAssetId: null,
      relations: [],
      tags: [],
      memo: c.memo,
      order: index,
    }),
  );

  const episodes = EPISODES.map((e, index) =>
    record({
      projectId,
      number: index + 1,
      title: e.title,
      keywords: [...e.keywords],
      characterIds: e.cast.map((i) => characters[i].id),
      places: [...e.places],
      keyPoints: e.keyPoints,
      quotes: [],
      status: e.status,
      targetChars: e.targetChars,
      actualChars: e.actualChars,
      publishDate: e.offset == null ? null : localDate(today, e.offset),
      memo: '',
      links: [],
    }),
  );

  // ── 확장 (6.3): 플롯, 타임라인, 메인 페이지, 꾸미기 예시 페이지 ──

  // getOrCreatePlotStructure와 같은 필드
  const plotStructure = record({
    projectId,
    type: PLOT_TYPE,
    sections: [...PLOT_STRUCTURES.find((s) => s.id === PLOT_TYPE).sections],
  });

  // createPlotCard와 같은 필드. 구간마다 1장(order 0)
  const plotCards = PLOT_CARDS.map((c, sectionIndex) =>
    record({
      projectId,
      sectionIndex,
      order: 0,
      title: c.title,
      summary: c.summary,
      episodeIds: c.episodes.map((i) => episodes[i].id),
    }),
  );

  // createTimelineEvent와 같은 필드. sortKey는 nextSortKey처럼 0부터 1씩
  const timelineEvents = TIMELINE_EVENTS.map((e, sortKey) =>
    record({
      projectId,
      storyDateLabel: e.storyDateLabel,
      sortKey,
      title: e.title,
      description: e.description,
      characterIds: e.cast.map((i) => characters[i].id),
      episodeId: e.episode == null ? null : episodes[e.episode].id,
    }),
  );

  // newPage(pages.js)와 같은 필드. main은 month null이라 ensureMainPage가 [projectId+kind]로 찾아 쓴다
  const page = (kind, templateId, fields = {}) =>
    record({ projectId, kind, month: null, title: '', templateId, background: null, order: 0, ...fields });
  // layoutWidgets(pages.js)와 같은 필드
  const widget = (pageId, z, item) =>
    record({
      pageId,
      type: item.type,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      z,
      rotation: item.rotation ?? 0,
      style: structuredClone(item.style ?? {}),
      data: structuredClone(item.data ?? {}),
    });

  const mainPage = page('main', 'main');
  const mainWidgets = DEFAULT_LAYOUTS.main.map((item, i) => {
    if (item.type === 'checklist') {
      const items = CHECKLIST_ITEMS.map(([text, done]) => ({ id: ids(), text, done }));
      return widget(mainPage.id, i + 1, { ...item, data: { ...(item.data ?? {}), items } });
    }
    if (item.type === 'text') {
      return widget(mainPage.id, i + 1, { ...item, data: { ...(item.data ?? {}), ...MAIN_MEMO } });
    }
    return widget(mainPage.id, i + 1, item);
  });

  const freePage = page('free', 'blank', { title: '꾸미기 예시', background: { pattern: 'dot', color: null } });
  const freeWidgets = [
    {
      type: 'text', x: 50, y: 50, w: 500, h: 320,
      style: { bg: (MEMO_COLORS[1] ?? MEMO_COLORS[0]).value },
      data: FREE_MEMO,
    },
    ...FREE_STICKERS.map(([stickerId, x, y, rotation]) => ({
      type: 'sticker', x, y, w: 150, h: 150, rotation, data: { stickerId },
    })),
  ].map((item, i) => widget(freePage.id, i + 1, item));

  return {
    projectId,
    tables: {
      projects: [project],
      synopses: [synopsis],
      characters,
      episodes,
      plotStructures: [plotStructure],
      plotCards,
      timelineEvents,
      pages: [mainPage, freePage],
      widgets: [...mainWidgets, ...freeWidgets],
    },
  };
}
