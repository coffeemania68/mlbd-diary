import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  normalizeUrl,
  linkHref,
  urlHost,
  linkLabel,
  categoryToInput,
  inputToCategory,
  saveLink,
  removeLink,
  linkCategoryView,
} from '../src/lib/links.js';
import { ALL } from '../src/lib/filter.js';
import { LINK_CATEGORY_PRESETS } from '../src/config.js';

const RUNS = { numRuns: 100 };

// 검사 대상 문자열: 빈 값·공백, www. 대소문자, 위험 스킴, 스킴 없는 도메인, 유효 URL, 임의 문자열
const wwwPrefix = fc.constantFrom('www.', 'WWW.', 'Www.', 'wWw.');
const rawUrlArb = fc.oneof(
  fc.constantFrom('', ' ', '   ', '\t\n'),
  fc.tuple(wwwPrefix, fc.domain()).map(([w, d]) => w + d),
  fc.tuple(fc.constantFrom('javascript:', 'data:', 'file:', 'ftp:', 'JavaScript:'), fc.string()).map(
    ([s, rest]) => s + rest,
  ),
  fc.domain(),
  fc.webUrl({ validSchemes: ['http', 'https'] }),
  fc.tuple(fc.constantFrom('', ' ', '  '), fc.webUrl(), fc.constantFrom('', ' ', '\n')).map(
    ([a, u, b]) => a + u + b,
  ),
  fc.string(),
);

const categoryArb = fc.oneof(
  fc.constantFrom(...LINK_CATEGORY_PRESETS),
  fc.string({ minLength: 1, maxLength: 6 }).map((s) => s.trim()).filter((s) => s !== ''),
  fc.constant('전체'),
);
const linkArb = fc.record({
  category: categoryArb,
  name: fc.string({ maxLength: 5 }),
  url: fc.webUrl(),
});

describe('normalizeUrl 예시', () => {
  it("'www.Naver.com'은 https를 붙여 정리", () => {
    expect(normalizeUrl('www.Naver.com')).toEqual({ ok: true, url: 'https://www.naver.com/' });
  });
  it("'javascript:alert(1)'은 무효", () => {
    expect(normalizeUrl('javascript:alert(1)')).toEqual({ ok: false });
  });
  it("스킴 없는 'example.com'은 무효", () => {
    expect(normalizeUrl('example.com')).toEqual({ ok: false });
  });
  it("앞뒤 공백 ' https://a.b/c '는 잘라서 유효", () => {
    expect(normalizeUrl(' https://a.b/c ')).toEqual({ ok: true, url: 'https://a.b/c' });
  });
  it('빈 값·data:·file:·ftp:는 무효', () => {
    for (const s of ['', '   ', null, undefined, 'data:text/html,x', 'file:///c:/a', 'ftp://a.b/'])
      expect(normalizeUrl(s)).toEqual({ ok: false });
  });
  it('urlHost와 linkHref', () => {
    expect(urlHost('https://blog.naver.com/x')).toBe('blog.naver.com');
    expect(urlHost('javascript:alert(1)')).toBe('');
    expect(linkHref('javascript:alert(1)')).toBeNull();
  });
});

describe('linkLabel', () => {
  it('빈 name이면 url 표시', () => {
    expect(linkLabel({ name: '', url: 'https://a.b/' })).toBe('https://a.b/');
    expect(linkLabel({ name: '   ', url: 'https://a.b/' })).toBe('https://a.b/');
    expect(linkLabel({ name: '지도', url: 'https://a.b/' })).toBe('지도');
  });
});

describe('removeLink', () => {
  it('index 위치만 빼고 원래 배열은 그대로', () => {
    const links = [{ url: 'a' }, { url: 'b' }, { url: 'c' }];
    expect(removeLink(links, 1)).toEqual([{ url: 'a' }, { url: 'c' }]);
    expect(links).toHaveLength(3);
  });
});

describe('links 속성', () => {
  // Feature: mlbd-book-sections, Property 11: URL 검사
  // **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 13.8, 13.9**
  it('Property 11: URL 검사', () => {
    fc.assert(
      fc.property(rawUrlArb, (raw) => {
        const r = normalizeUrl(raw);
        const t = raw.trim();
        if (r.ok) {
          expect(['http:', 'https:']).toContain(new URL(r.url).protocol);
          expect(normalizeUrl(r.url)).toEqual(r);
        }
        if (t === '') expect(r.ok).toBe(false);
        if (!/^www\./i.test(t) && !/^https?:/i.test(t)) expect(r.ok).toBe(false);
        if (/^www\./i.test(t)) expect(r).toEqual(normalizeUrl('https://' + t));
        expect(linkHref(raw)).toBe(r.ok ? r.url : null);
      }),
      RUNS,
    );
  });

  // Feature: mlbd-book-sections, Property 13: 링크 저장
  // **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
  it('Property 13: 링크 저장과 분류 입력 왕복', () => {
    const inputArb = fc.record({
      choice: fc.constantFrom(...LINK_CATEGORY_PRESETS, 'custom'),
      custom: fc.string({ maxLength: 6 }),
      name: fc.string({ maxLength: 6 }),
      url: rawUrlArb,
    });
    fc.assert(
      fc.property(
        fc.array(linkArb, { maxLength: 6 }).chain((links) =>
          fc.tuple(
            fc.constant(links),
            links.length ? fc.integer({ min: -1, max: links.length - 1 }) : fc.constant(-1),
            inputArb,
          ),
        ),
        ([links, index, input]) => {
          const before = structuredClone(links);
          const res = saveLink(links, index, input);
          const n = normalizeUrl(input.url);
          expect(links).toEqual(before);
          if (!n.ok) {
            expect(res.ok).toBe(false);
            expect(res.links).toEqual(before);
            return;
          }
          expect(res.ok).toBe(true);
          const at = index === -1 ? links.length : index;
          expect(res.links).toHaveLength(index === -1 ? links.length + 1 : links.length);
          expect(res.links[at]).toEqual({
            category: inputToCategory(input),
            name: input.name,
            url: n.url,
          });
          res.links.forEach((l, i) => {
            if (i !== at) expect(l).toEqual(links[i]);
          });
        },
      ),
      RUNS,
    );

    const cleanCategory = fc.oneof(
      fc.constantFrom(...LINK_CATEGORY_PRESETS),
      fc.string({ minLength: 1, maxLength: 8 }).filter((s) => s.trim() === s && s !== ''),
    );
    fc.assert(
      fc.property(cleanCategory, (c) => {
        expect(inputToCategory(categoryToInput(c))).toBe(c);
      }),
      RUNS,
    );
  });

  // Feature: mlbd-book-sections, Property 12: 분류·태그 필터 (linkCategoryView 부분)
  // **Validates: Requirements 4.6, 4.7, 4.8**
  it('Property 12: linkCategoryView 묶음은 visible과 같은 링크 집합', () => {
    fc.assert(
      fc.property(
        fc.array(linkArb, { maxLength: 10 }),
        fc.oneof(fc.constant(ALL), categoryArb.map((value) => ({ value }))),
        (links, selected) => {
          const view = linkCategoryView(links, selected);
          const flat = view.groups.flatMap((g) => g.items.map((it) => it.index)).sort((a, b) => a - b);
          const expected = links
            .map((l, i) => i)
            .filter((i) => view.selected.all || links[i].category === view.selected.value);
          expect(flat).toEqual(expected);
          for (const g of view.groups) {
            for (const it of g.items) {
              expect(it.link).toBe(links[it.index]);
              expect(it.link.category).toBe(g.category);
            }
          }
          // groups 순서는 options 순서와 같다
          const optionValues = view.options.filter((o) => !o.all).map((o) => o.value);
          const groupOrder = view.groups.map((g) => optionValues.indexOf(g.category));
          expect(groupOrder).toEqual([...groupOrder].sort((a, b) => a - b));
        },
      ),
      RUNS,
    );
  });
});
