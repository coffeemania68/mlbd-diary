import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ALL, filterView, isSameOption, optionLabel } from '../src/lib/filter.js';
import { addUnique, removeValue, addId, removeId } from '../src/lib/tags.js';
import { BOOK_SECTIONS, LINK_CATEGORY_PRESETS } from '../src/config.js';

const RUNS = { numRuns: 100 };
const trim = (s) => String(s ?? '').trim();

// 값: 프리셋, "전체", 빈 문자열, 짧은 임의 문자열 (중복이 잘 생기도록 좁게)
const valueArb = fc.oneof(
  fc.constantFrom(...LINK_CATEGORY_PRESETS, '전체', ''),
  fc.string({ minLength: 1, maxLength: 3 }),
);
const itemArb = fc.record({ id: fc.uuid(), tags: fc.array(valueArb, { maxLength: 4 }) });
const selectedArb = fc.oneof(fc.constant(ALL), valueArb.map((value) => ({ value })));

describe('config', () => {
  it('BOOK_SECTIONS 7개 모두 ready', () => {
    expect(BOOK_SECTIONS).toHaveLength(7);
    expect(BOOK_SECTIONS.every((s) => s.ready === true)).toBe(true);
  });
});

describe('filterView 예시', () => {
  const items = [
    { id: 'a', tags: ['전체'] },
    { id: 'b', tags: ['의상', '가'] },
    { id: 'c', tags: [] },
    { id: 'd', tags: ['장소', '의상'] },
  ];
  const view = (sel) => filterView(items, (i) => i.tags, sel, LINK_CATEGORY_PRESETS);

  it('옵션은 전체 → 사용 중 프리셋(프리셋 순) → 나머지 가나다순', () => {
    expect(view(ALL).options).toEqual([ALL, { value: '장소' }, { value: '의상' }, { value: '가' }, { value: '전체' }]);
    expect(view(ALL).visible).toEqual(items);
  });
  it('"전체"라는 값은 필터의 전체와 구분', () => {
    expect(view({ value: '전체' }).visible.map((i) => i.id)).toEqual(['a']);
    expect(isSameOption(ALL, { value: '전체' })).toBe(false);
    expect(optionLabel(ALL)).toBe('전체');
    expect(optionLabel({ value: '의상' })).toBe('의상');
  });
  it('없는 선택값은 전체로', () => {
    expect(view({ value: '없음' }).selected).toBe(ALL);
  });
});

describe('filter·tags 속성', () => {
  // Feature: mlbd-book-sections, Property 12: 분류·태그 필터
  // **Validates: Requirements 4.6, 4.7, 4.8, 14.1, 14.2, 14.3, 14.4**
  it('Property 12: filterView', () => {
    fc.assert(
      fc.property(fc.array(itemArb, { maxLength: 8 }), selectedArb, (items, selected) => {
        const v = filterView(items, (i) => i.tags, selected, LINK_CATEGORY_PRESETS);
        const used = new Set(items.flatMap((i) => i.tags).filter((t) => t !== ''));
        expect(v.options[0]).toBe(ALL);
        const values = v.options.slice(1).map((o) => o.value);
        expect(v.options.slice(1).every((o) => !o.all)).toBe(true);
        expect(new Set(values).size).toBe(values.length);
        expect(new Set(values)).toEqual(used);
        const inOptions = v.options.some((o) => isSameOption(o, selected));
        if (!inOptions) expect(v.selected).toBe(ALL);
        if (v.selected.all) expect(v.visible).toEqual(items);
        else expect(v.visible).toEqual(items.filter((i) => i.tags.includes(v.selected.value)));
      }),
      RUNS,
    );
  });

  // Feature: mlbd-book-sections, Property 9: 키워드·태그 추가 (addUnique 부분, trim 정리 함수)
  // **Validates: Requirements 3.5, 3.6, 3.7, 13.11**
  it('Property 9: addUnique', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ maxLength: 3 }).map(trim).filter((s) => s !== ''), { maxLength: 6 }),
        fc.oneof(fc.string({ maxLength: 4 }), fc.constantFrom('', '   ', ' a ')),
        (list, raw) => {
          const before = [...list];
          const out = addUnique(list, raw, trim);
          expect(list).toEqual(before);
          const n = trim(raw);
          if (n === '' || list.includes(n)) expect(out).toEqual(list);
          else expect(out).toEqual([...list, n]);
        },
      ),
      RUNS,
    );
  });

  // Feature: mlbd-book-sections, Property 10: id 태그 추가·제거
  // **Validates: Requirements 3.9, 3.10, 3.11, 9.8, 10.8**
  it('Property 10: addId / removeId', () => {
    const idArb = fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f');
    fc.assert(
      fc.property(fc.uniqueArray(idArb, { maxLength: 6 }), idArb, (ids, x) => {
        const before = [...ids];
        const added = addId(ids, x);
        expect(added.filter((i) => i === x)).toHaveLength(1);
        expect(added.filter((i) => i !== x)).toEqual(ids.filter((i) => i !== x));
        const removed = removeId(ids, x);
        expect(removed).not.toContain(x);
        expect(removed).toEqual(ids.filter((i) => i !== x));
        expect(ids).toEqual(before);
      }),
      RUNS,
    );
  });
});

describe('removeValue', () => {
  it('값을 뺀 새 배열', () => {
    const list = ['a', 'b'];
    expect(removeValue(list, 'a')).toEqual(['b']);
    expect(list).toEqual(['a', 'b']);
  });
});
