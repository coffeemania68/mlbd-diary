import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { setShell, setLocationExtras, showRouteLocation } from '../src/ui.js';
import { locationLabel } from '../src/shell.js';

// 경로 name → 구역 이름. 상세 경로는 대체 문구도 함께
const LIST_ROUTES = {
  episodes: '에피소드',
  plot: '플롯',
  timeline: '타임라인',
  mandalarts: '만다라트',
  storage: '보관함',
};
const DETAIL_ROUTES = {
  episode: ['에피소드', '제목 없음'],
  mandalart: ['만다라트', '제목 없는 만다라트'],
  storageItem: ['보관함', '제목 없는 자료'],
};

// 빈 문자열, 공백만 포함, 앞뒤 공백 섞인 임의 문자열
const titleArb = fc.oneof(
  fc.constant(''),
  fc.stringMatching(/^[ \t\n]{1,5}$/),
  fc.string(),
  fc.tuple(fc.stringMatching(/^[ \t]{0,3}$/), fc.string({ minLength: 1 }), fc.stringMatching(/^[ \t]{0,3}$/))
    .map(([a, b, c]) => a + b + c),
);

describe('locationLabel 설정집 새 경로', () => {
  // Feature: mlbd-book-sections, Property 2: 위치 문구
  // **Validates: Requirements 1.9, 11.3**
  it('Property 2: 목록은 "설정집 › 구역", 상세는 recordTitle.trim() 또는 대체 문구를 덧붙인다', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(LIST_ROUTES)),
        fc.constantFrom(...Object.keys(DETAIL_ROUTES)),
        titleArb,
        (listName, detailName, recordTitle) => {
          expect(locationLabel({ name: listName, projectId: 'p' }, { recordTitle }))
            .toBe('설정집 › ' + LIST_ROUTES[listName]);
          const [section, fallback] = DETAIL_ROUTES[detailName];
          const shown = recordTitle.trim() || fallback;
          expect(locationLabel({ name: detailName, projectId: 'p' }, { recordTitle }))
            .toBe('설정집 › ' + section + ' › ' + shown);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('recordTitle이 없으면 대체 문구, 기존 경로는 그대로', () => {
    expect(locationLabel({ name: 'mandalart', projectId: 'p', mandalartId: 'm' })).toBe('설정집 › 만다라트 › 제목 없는 만다라트');
    expect(locationLabel({ name: 'episode', projectId: 'p' }, { recordTitle: '3화 첫 만남' })).toBe('설정집 › 에피소드 › 3화 첫 만남');
    expect(locationLabel({ name: 'characters', projectId: 'p' })).toBe('설정집 › 캐릭터');
    expect(locationLabel({ name: 'synopsis', projectId: 'p' })).toBe('설정집 › 시놉시스');
    expect(locationLabel({ name: 'section', projectId: 'p', section: 'plot' })).toBe('');
  });
});

describe('locationLabel 다이어리 새 경로', () => {
  it('월간·자유 페이지 위치 문구', () => {
    expect(locationLabel({ name: 'monthly', projectId: 'p', month: '2027-03' })).toBe('다이어리 › 월간 › 2027년 3월');
    expect(locationLabel({ name: 'monthly', projectId: 'p', month: '2027-12' })).toBe('다이어리 › 월간 › 2027년 12월');
    expect(locationLabel({ name: 'monthly', projectId: 'p', month: null })).toBe('다이어리 › 월간');
    expect(locationLabel({ name: 'freePages', projectId: 'p' })).toBe('다이어리 › 자유 페이지');
    expect(locationLabel({ name: 'freePage', projectId: 'p', pageId: 'g' }, { recordTitle: '  아이디어  ' }))
      .toBe('다이어리 › 자유 페이지 › 아이디어');
  });

  it('자유 페이지 제목이 없거나 비었거나 공백뿐이면 "제목 없는 페이지"', () => {
    const route = { name: 'freePage', projectId: 'p', pageId: 'g' };
    for (const extras of [undefined, {}, { recordTitle: '' }, { recordTitle: '   \t' }]) {
      expect(locationLabel(route, extras)).toBe('다이어리 › 자유 페이지 › 제목 없는 페이지');
    }
  });
});

function recordingShell() {
  const texts = [];
  return { texts, setLocation: (t) => texts.push(t) };
}

describe('ui 위치 문구', () => {
  it('render 도중 정한 extras가 onRouteChange 때 반영된다', () => {
    const shell = recordingShell();
    setShell(shell);
    const route = { name: 'character', projectId: 'p', characterId: 'c' };
    setLocationExtras(route, { characterName: '서윤' });
    showRouteLocation(route);
    expect(shell.texts.at(-1)).toBe('설정집 › 캐릭터 › 서윤');
  });

  it('다른 경로로 넘어가면 이전 extras를 쓰지 않고, 늦은 호출도 무시한다', () => {
    const shell = recordingShell();
    setShell(shell);
    const a = { name: 'character', projectId: 'p', characterId: 'c' };
    const b = { name: 'character', projectId: 'p', characterId: 'd' };
    showRouteLocation(a);
    setLocationExtras(a, { characterName: '서윤' });
    showRouteLocation(b);
    expect(shell.texts.at(-1)).toBe('설정집 › 캐릭터 › 이름 없는 캐릭터');
    const count = shell.texts.length;
    setLocationExtras(a, { characterName: '늦음' });
    expect(shell.texts.length).toBe(count);
  });
});

describe('locationLabel 안내 경로', () => {
  it('시작하기·안내서·자주 묻는 질문', () => {
    expect(locationLabel({ name: 'welcome' })).toBe('시작하기');
    expect(locationLabel({ name: 'guide' })).toBe('안내서');
    expect(locationLabel({ name: 'faq' })).toBe('안내서 › 자주 묻는 질문');
  });
});
