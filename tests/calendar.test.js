import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CALENDAR_MEMO_MAX, EPISODE_STATUSES } from '../src/config.js';
import {
  isValidMonth,
  addMonths,
  currentMonth,
  monthLabel,
  monthGrid,
  episodesByDay,
  setDayMemo,
  nextEpisode,
} from '../src/lib/calendar.js';

const pad2 = (n) => String(n).padStart(2, '0');
const monthArb = fc
  .record({ y: fc.integer({ min: 1900, max: 2200 }), m: fc.integer({ min: 1, max: 12 }) })
  .map(({ y, m }) => `${y}-${pad2(m)}`);
const daysIn = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

// 발행일이 좁은 범위(2027-01-01 ~ 2027-03-31)에 몰리게 만들어 같은 날·경계가 자주 나온다
const dateArb = fc
  .record({ m: fc.integer({ min: 1, max: 3 }), d: fc.integer({ min: 1, max: 31 }) })
  .map(({ m, d }) => `2027-${pad2(m)}-${pad2(Math.min(d, daysIn(`2027-${pad2(m)}`)))}`);
const episodesArb = fc
  .array(
    fc.record({
      publishDate: fc.option(dateArb, { nil: null }),
      number: fc.integer({ min: 1, max: 20 }),
      status: fc.constantFrom(...EPISODE_STATUSES.map((s) => s.id)),
    }),
    { maxLength: 15 },
  )
  .map((list) => list.map((e, i) => ({ id: `e${i}`, ...e })));

describe('lib/calendar 예시', () => {
  it('isValidMonth', () => {
    expect(isValidMonth('2027-03')).toBe(true);
    expect(isValidMonth('2027-13')).toBe(false);
    expect(isValidMonth('2027-00')).toBe(false);
    expect(isValidMonth('2027-3')).toBe(false);
    expect(isValidMonth(null)).toBe(false);
  });

  it('addMonths: 해 넘기기', () => {
    expect(addMonths('2027-12', 1)).toBe('2028-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2027-03', 0)).toBe('2027-03');
  });

  it('currentMonth·monthLabel', () => {
    expect(currentMonth(new Date(2027, 0, 31))).toBe('2027-01');
    expect(currentMonth(new Date(2027, 11, 1))).toBe('2027-12');
    expect(monthLabel('2027-03')).toBe('2027년 3월');
  });

  it('monthGrid: 2027-02는 28일, 2028-02는 29일', () => {
    expect(monthGrid('2027-02').filter((c) => c !== null)).toHaveLength(28);
    expect(monthGrid('2028-02').filter((c) => c !== null)).toHaveLength(29);
  });

  it('monthGrid: 1일이 토요일인 달(2027-05)', () => {
    const grid = monthGrid('2027-05');
    expect(grid.indexOf(1)).toBe(6);
    expect(grid.slice(0, 6).every((c) => c === null)).toBe(true);
    expect(grid.length % 7).toBe(0);
  });

  it('setDayMemo: 입력을 바꾸지 않는다', () => {
    const memos = Object.freeze({ '01': 'a' });
    expect(setDayMemo(memos, '02', ' b ')).toEqual({ '01': 'a', '02': 'b' });
    expect(setDayMemo(memos, '01', '   ')).toEqual({});
    expect(setDayMemo(undefined, 3, 'x')).toEqual({ '03': 'x' });
  });

  it('nextEpisode: 없으면 null', () => {
    expect(nextEpisode([], '2027-01-01')).toBeNull();
    expect(
      nextEpisode([{ id: 'a', number: 1, status: 'published', publishDate: '2027-02-01' }], '2027-01-01'),
    ).toBeNull();
  });
});

describe('lib/calendar 속성', () => {
  // Feature: mlbd-pages-backup, Property 8: 달 이동
  // **Validates: Requirements 2.3**
  it('Property 8: addMonths는 유효한 달을 내고 되돌리면 같다', () => {
    fc.assert(
      fc.property(monthArb, fc.integer({ min: -1200, max: 1200 }), (month, n) => {
        const moved = addMonths(month, n);
        expect(isValidMonth(moved)).toBe(true);
        expect(addMonths(moved, -n)).toBe(month);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: mlbd-pages-backup, Property 9: 달력 칸과 발행일
  // **Validates: Requirements 12.1, 12.4**
  it('Property 9: monthGrid 칸 배치', () => {
    fc.assert(
      fc.property(monthArb, (month) => {
        const grid = monthGrid(month);
        const [y, m] = month.split('-').map(Number);
        expect(grid.length % 7).toBe(0);
        expect(grid.indexOf(1)).toBe(new Date(y, m - 1, 1).getDay());
        const days = grid.filter((c) => c !== null);
        expect(days).toEqual(Array.from({ length: daysIn(month) }, (_, i) => i + 1));
        // 날짜 칸은 한 덩어리로 이어진다
        const first = grid.indexOf(1);
        expect(grid.slice(first, first + days.length)).toEqual(days);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: mlbd-pages-backup, Property 9: 달력 칸과 발행일
  // **Validates: Requirements 12.1, 12.4**
  it('Property 9: episodesByDay는 그 달 Episode만 한 번씩 그 날짜에 담는다', () => {
    fc.assert(
      fc.property(episodesArb, fc.constantFrom('2027-01', '2027-02', '2027-03'), (episodes, month) => {
        const byDay = episodesByDay(episodes, month);
        const placed = Object.entries(byDay).flatMap(([day, list]) =>
          list.map((e) => {
            expect(e.publishDate).toBe(`${month}-${day}`);
            return e.id;
          }),
        );
        const expected = episodes.filter((e) => e.publishDate?.startsWith(`${month}-`)).map((e) => e.id);
        expect([...placed].sort()).toEqual([...expected].sort());
        expect(new Set(placed).size).toBe(placed.length);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: mlbd-pages-backup, Property 10: 날짜 메모
  // **Validates: Requirements 12.11, 12.12**
  it('Property 10: setDayMemo 길이·빈 값·다른 날짜', () => {
    const dayArb = fc.integer({ min: 1, max: 31 }).map(pad2);
    const memosArb = fc.dictionary(dayArb, fc.string({ minLength: 1, maxLength: 40 }), { maxKeys: 8 });
    const textArb = fc.oneof(
      fc.string({ maxLength: 80 }),
      fc.string({ maxLength: 60, unit: 'grapheme' }),
      fc.constantFrom('', '   ', '\n\t'),
    );
    fc.assert(
      fc.property(memosArb, dayArb, textArb, (memos, day, text) => {
        const before = { ...memos };
        const result = setDayMemo(memos, day, text);
        expect(memos).toEqual(before);
        if (text.trim() === '') {
          expect(Object.hasOwn(result, day)).toBe(false);
        } else {
          expect(result[day].length).toBeLessThanOrEqual(CALENDAR_MEMO_MAX);
          expect(text.trim().startsWith(result[day])).toBe(true);
        }
        for (const [k, v] of Object.entries(memos)) {
          if (k !== day) expect(result[k]).toBe(v);
        }
        expect(Object.keys(result).filter((k) => k !== day).sort()).toEqual(
          Object.keys(memos).filter((k) => k !== day).sort(),
        );
      }),
      { numRuns: 200 },
    );
  });

  // Feature: mlbd-pages-backup, Property 11: 다음 회차
  // **Validates: Requirements 1.5, 1.6**
  it('Property 11: nextEpisode', () => {
    fc.assert(
      fc.property(episodesArb, dateArb, (episodes, today) => {
        const result = nextEpisode(episodes, today);
        const candidates = episodes.filter(
          (e) => e.status !== 'published' && e.publishDate !== null && e.publishDate >= today,
        );
        if (candidates.length === 0) {
          expect(result).toBeNull();
          return;
        }
        expect(candidates).toContain(result);
        for (const e of candidates) {
          const earlier =
            e.publishDate < result.publishDate ||
            (e.publishDate === result.publishDate && e.number < result.number);
          expect(earlier).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });
});
