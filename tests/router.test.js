import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { BOOK_ROUTES, decideStartRoute, formatHash, navItemFor, parseHash } from '../src/router.js';
import { sectionRoute } from '../src/screens/setting-book.js';
import { BOOK_SECTIONS } from '../src/config.js';

// 설정집 아래 경로: [name, 상세 id 필드 | null]
const BOOK_NAMES = [
  ['characters', null],
  ['character', 'characterId'],
  ['synopsis', null],
  ['episodes', null],
  ['episode', 'episodeId'],
  ['plot', null],
  ['timeline', null],
  ['mandalarts', null],
  ['mandalart', 'mandalartId'],
  ['storage', null],
  ['storageItem', 'storageItemId'],
];

const bookRouteArb = fc
  .tuple(fc.constantFrom(...BOOK_NAMES), fc.uuid(), fc.uuid())
  .map(([[name, idField], projectId, recordId]) =>
    idField ? { name, projectId, [idField]: recordId } : { name, projectId },
  );

const otherRouteArb = fc.oneof(
  fc.constant({ name: 'library' }),
  fc.constant({ name: 'projectNew' }),
  fc
    .tuple(fc.constantFrom('projectEdit', 'main', 'diary', 'book', 'settings'), fc.uuid())
    .map(([name, projectId]) => ({ name, projectId })),
);

describe('Property 1: 해시 경로 왕복', () => {
  // **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
  it('설정집 아래 경로는 parseHash(formatHash(r))가 r이고 Nav는 설정집', () => {
    fc.assert(
      fc.property(bookRouteArb, (route) => {
        expect(parseHash(formatHash(route))).toEqual(route);
        expect(navItemFor(route)).toBe('book');
      }),
    );
  });

  it('기존 경로도 왕복한다', () => {
    fc.assert(
      fc.property(otherRouteArb, (route) => {
        expect(parseHash(formatHash(route))).toEqual(route);
      }),
    );
  });
});

// 유효한 'YYYY-MM' (월 01~12)
const monthArb = fc
  .tuple(fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 1, max: 12 }))
  .map(([y, m]) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`);

const diaryRouteArb = fc.oneof(
  fc.tuple(fc.uuid(), monthArb).map(([projectId, month]) => ({ name: 'monthly', projectId, month })),
  fc.uuid().map((projectId) => ({ name: 'monthly', projectId, month: null })),
  fc.uuid().map((projectId) => ({ name: 'freePages', projectId })),
  fc
    .tuple(fc.uuid(), fc.string({ unit: 'grapheme', minLength: 1, maxLength: 20 }))
    .map(([projectId, pageId]) => ({ name: 'freePage', projectId, pageId })),
);

describe('Property 7: 다이어리 주소 왕복', () => {
  // Feature: mlbd-pages-backup, Property 7: 다이어리 주소 왕복
  // **Validates: Requirements 2.7, 2.8, 3.9**
  it('monthly·freePages·freePage는 parseHash(formatHash(r))가 r이고 Nav는 다이어리', () => {
    fc.assert(
      fc.property(diaryRouteArb, (route) => {
        expect(parseHash(formatHash(route))).toEqual(route);
        expect(navItemFor(route)).toBe('diary');
      }),
    );
  });

  it('YYYY-MM 형식이 아닌 달은 month null', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: 'grapheme', minLength: 1 }).filter((s) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(s)),
        (bad) => {
          const route = parseHash(`#/p/x/diary/monthly/${encodeURIComponent(bad)}`);
          expect(route).toEqual({ name: 'monthly', projectId: 'x', month: null });
        },
      ),
    );
  });
});

describe('router 예시', () => {
  it('다이어리 경로 예시', () => {
    expect(parseHash('#/p/x/diary/monthly/2027-13')).toEqual({ name: 'monthly', projectId: 'x', month: null });
    expect(parseHash('#/p/x/diary/monthly/2027-03')).toEqual({ name: 'monthly', projectId: 'x', month: '2027-03' });
    expect(parseHash('#/p/x/diary/monthly')).toEqual({ name: 'monthly', projectId: 'x', month: null });
    expect(formatHash({ name: 'monthly', projectId: 'x', month: '2027-03' })).toBe('#/p/x/diary/monthly/2027-03');
    expect(formatHash({ name: 'monthly', projectId: 'x', month: null })).toBe('#/p/x/diary/monthly');
    expect(formatHash({ name: 'freePages', projectId: 'x' })).toBe('#/p/x/diary/free');
    expect(formatHash({ name: 'freePage', projectId: 'x', pageId: 'pg1' })).toBe('#/p/x/diary/free/pg1');
    expect(formatHash({ name: 'freePage', projectId: 'x' })).toBe('#/library');
    expect(formatHash({ name: 'freePage', projectId: 'x', pageId: '' })).toBe('#/library');
    expect(parseHash('#/p/x/diary/free/a/b')).toEqual({ name: 'library' });
    expect(parseHash('#/p/x/diary/other')).toEqual({ name: 'library' });
  });

  it('모르는 주소는 서재', () => {
    for (const hash of [
      '#/p/x/book/unknown',
      '#/p/x/book/section',
      '#/p/x/book/plot/abc',
      '#/p/x/book/synopsis/abc',
      '#/p/x/book/episodes/a/b',
      '#/p/x/book/__proto__',
      '#/p/x/book/constructor',
      '#/nowhere',
    ]) {
      expect(parseHash(hash)).toEqual({ name: 'library' });
    }
  });

  it('#/p/x/book/plot → plot 경로', () => {
    expect(parseHash('#/p/x/book/plot')).toEqual({ name: 'plot', projectId: 'x' });
  });

  it('주소의 구역 이름은 mandalart 단수, 경로 name은 목록·상세로 나뉜다', () => {
    expect(parseHash('#/p/x/book/mandalart')).toEqual({ name: 'mandalarts', projectId: 'x' });
    expect(parseHash('#/p/x/book/mandalart/m1')).toEqual({
      name: 'mandalart',
      projectId: 'x',
      mandalartId: 'm1',
    });
    expect(formatHash({ name: 'storageItem', projectId: 'x', storageItemId: 's1' })).toBe(
      '#/p/x/book/storage/s1',
    );
  });

  it('상세 id가 없거나 section 경로면 서재 주소', () => {
    expect(formatHash({ name: 'episode', projectId: 'x' })).toBe('#/library');
    expect(formatHash({ name: 'plot' })).toBe('#/library');
    expect(formatHash({ name: 'section', projectId: 'x', section: 'plot' })).toBe('#/library');
  });

  it('sectionRoute는 7개 구역마다 목록 경로를 돌려준다', () => {
    const results = BOOK_SECTIONS.map((s) => sectionRoute('p1', s));
    expect(results).toEqual([
      { name: 'characters', projectId: 'p1' },
      { name: 'synopsis', projectId: 'p1' },
      { name: 'plot', projectId: 'p1' },
      { name: 'timeline', projectId: 'p1' },
      { name: 'mandalarts', projectId: 'p1' },
      { name: 'episodes', projectId: 'p1' },
      { name: 'storage', projectId: 'p1' },
    ]);
    // 모든 구역이 BOOK_ROUTES에 있고, 목록 경로로 왕복한다
    for (const s of BOOK_SECTIONS) {
      expect(Object.hasOwn(BOOK_ROUTES, s.id)).toBe(true);
      expect(formatHash(sectionRoute('p1', s))).toBe(`#/p/p1/book/${s.id}`);
    }
  });
});

describe('Property 9: 시작 화면과 첫 실행 안내', () => {
  // Feature: mlbd-final-block, Property 9: 시작 화면과 첫 실행 안내
  // **Validates: Requirements 7.1, 7.2, 7.3**
  it('welcome은 작품 0개이고 onboardingDone false일 때만, 그 밖에는 main 또는 library', () => {
    const caseArb = fc
      .uniqueArray(fc.uuid(), { maxLength: 5 })
      .chain((ids) =>
        fc.tuple(
          fc.constant(ids),
          fc.oneof(
            ids.length ? fc.constantFrom(...ids) : fc.constant(null),
            fc.uuid().filter((id) => !ids.includes(id)),
            fc.constant(null),
          ),
          fc.boolean(),
        ),
      );
    fc.assert(
      fc.property(caseArb, ([ids, lastOpenedId, onboardingDone]) => {
        const projects = ids.map((id) => ({ id }));
        const route = decideStartRoute(projects, lastOpenedId, { onboardingDone });
        if (ids.length === 0 && !onboardingDone) {
          expect(route).toEqual({ name: 'welcome' });
        } else if (lastOpenedId && ids.includes(lastOpenedId)) {
          expect(route).toEqual({ name: 'main', projectId: lastOpenedId });
        } else {
          expect(route).toEqual({ name: 'library' });
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 10: 안내 주소 왕복', () => {
  // Feature: mlbd-final-block, Property 10: 안내 주소 왕복
  // **Validates: Requirements 9.5**
  it('welcome·guide·faq는 왕복하고 Nav는 null, 기존 작품 경로 왕복은 그대로', () => {
    const guideArb = fc.constantFrom({ name: 'welcome' }, { name: 'guide' }, { name: 'faq' });
    fc.assert(
      fc.property(guideArb, bookRouteArb, otherRouteArb, (guide, book, other) => {
        expect(parseHash(formatHash(guide))).toEqual(guide);
        expect(navItemFor(guide)).toBeNull();
        expect(parseHash(formatHash(book))).toEqual(book);
        expect(parseHash(formatHash(other))).toEqual(other);
      }),
      { numRuns: 100 },
    );
  });
});

describe('안내 경로 예시', () => {
  it('주소 해석', () => {
    expect(parseHash('#/welcome')).toEqual({ name: 'welcome' });
    expect(parseHash('#/guide')).toEqual({ name: 'guide' });
    expect(parseHash('#/guide/faq')).toEqual({ name: 'faq' });
    expect(parseHash('#/guide/x')).toEqual({ name: 'library' });
    expect(parseHash('#/guide/faq/more')).toEqual({ name: 'library' });
    expect(parseHash('#/welcome/x')).toEqual({ name: 'library' });
    expect(formatHash({ name: 'faq' })).toBe('#/guide/faq');
  });
  it('두 인자 decideStartRoute는 기존 결과 그대로', () => {
    expect(decideStartRoute([], null)).toEqual({ name: 'library' });
    expect(decideStartRoute([{ id: 'a' }], 'a')).toEqual({ name: 'main', projectId: 'a' });
    expect(decideStartRoute([{ id: 'a' }], 'b')).toEqual({ name: 'library' });
    expect(decideStartRoute([], null, { onboardingDone: false })).toEqual({ name: 'welcome' });
    expect(decideStartRoute([{ id: 'a' }], 'a', { onboardingDone: false }))
      .toEqual({ name: 'main', projectId: 'a' });
  });
});
