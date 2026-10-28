import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_THEME_ID, THEMES } from '../src/config.js';
import { THEME_VAR_KEYS, resolveTheme } from '../src/lib/themes.js';
import { bugReportHref } from '../src/lib/contact.js';

const GENERIC_FAMILIES = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'];

describe('Property 8: 테마 정의와 결정', () => {
  // Feature: mlbd-final-block, Property 8: 테마 정의와 결정
  // **Validates: Requirements 6.1, 6.2, 6.3, 6.7**
  it('모든 테마는 정확히 THEME_VAR_KEYS를 갖고, 글꼴은 시스템 글꼴 이름과 일반 글꼴로 끝나며 url()이 없다', () => {
    expect(THEME_VAR_KEYS).toHaveLength(14);
    expect(THEMES.some((t) => t.id === DEFAULT_THEME_ID)).toBe(true);
    for (const theme of THEMES) {
      expect(Object.keys(theme.vars).sort()).toEqual([...THEME_VAR_KEYS].sort());
      for (const value of Object.values(theme.vars)) {
        expect(typeof value).toBe('string');
        expect(value.trim()).not.toBe('');
        expect(value).not.toMatch(/url\(/i);
      }
      const families = theme.vars['--font-body'].split(',').map((s) => s.trim());
      expect(GENERIC_FAMILIES).toContain(families.at(-1));
      for (const f of families) expect(f).toMatch(/^('[^'()]+'|[A-Za-z-]+)$/);
    }
  });

  it('resolveTheme은 같은 id의 테마, 없으면 기본 테마', () => {
    const idArb = fc.oneof(fc.constantFrom(...THEMES.map((t) => t.id)), fc.string(), fc.constant(null));
    fc.assert(
      fc.property(idArb, (id) => {
        const theme = resolveTheme(id);
        expect(THEMES).toContain(theme);
        const same = THEMES.find((t) => t.id === id);
        expect(theme.id).toBe(same ? id : DEFAULT_THEME_ID);
      }),
      { numRuns: 100 },
    );
  });

  it('예시: 모르는 id·null·__proto__는 paper, bookshop은 bookshop', () => {
    expect(resolveTheme(null).id).toBe('paper');
    expect(resolveTheme('__proto__').id).toBe('paper');
    expect(resolveTheme('bookshop').id).toBe('bookshop');
    // 축소안: bookshop이 없는 목록이면 paper로 돌아간다
    expect(resolveTheme('bookshop', THEMES.filter((t) => t.id !== 'bookshop')).id).toBe('paper');
  });
});

describe('Property 12: 버그 제보 주소', () => {
  // Feature: mlbd-final-block, Property 12: 버그 제보 주소
  // **Validates: Requirements 10.3, 10.4**
  it('결과는 null이거나 https://로 시작한다', () => {
    const rawArb = fc.oneof(
      fc.string(),
      fc.webUrl(),
      fc.string().map((s) => `javascript:${s}`),
      fc.string().map((s) => `https://${s}`),
    );
    fc.assert(
      fc.property(rawArb, (raw) => {
        const href = bugReportHref(raw);
        if (href !== null) expect(href.startsWith('https://')).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('https:// + 유효한 호스트 이름이면 null이 아니다', () => {
    fc.assert(
      fc.property(fc.domain(), (host) => {
        expect(bugReportHref(`https://${host}`)).not.toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('예시', () => {
    expect(bugReportHref('')).toBeNull();
    expect(bugReportHref('http://a.com')).toBeNull();
    expect(bugReportHref('javascript:alert(1)')).toBeNull();
    expect(bugReportHref('not a url')).toBeNull();
    expect(bugReportHref(null)).toBeNull();
    expect(bugReportHref('https://forms.example.com/bug')).toBe('https://forms.example.com/bug');
  });
});
