import { describe, it, expect } from 'vitest';
import { roleFilterView, roleToInput, inputToRole, ALL_ROLES } from '../src/lib/roles.js';
import { addQuote, removeQuote } from '../src/lib/quotes.js';
import { computeAppearances } from '../src/lib/appearances.js';
import { ROLE_PRESETS } from '../src/config.js';

const [P0, P1] = ROLE_PRESETS;

describe('roleFilterView', () => {
  const chars = [
    { id: 'a', role: '전체' },
    { id: 'b', role: P1 },
    { id: 'c', role: '' },
    { id: 'd', role: P0 },
    { id: 'e', role: P1 },
  ];

  it('옵션은 전체 → 사용 중 프리셋(프리셋 순) → 직접 입력, 빈 역할 제외', () => {
    const v = roleFilterView(chars, ALL_ROLES);
    expect(v.options).toEqual([{ all: true }, { role: P0 }, { role: P1 }, { role: '전체' }]);
    expect(v.visible).toEqual(chars);
  });

  it('역할 선택 시 해당 역할만 순서 유지, 직접 입력 "전체"는 필터 전체와 구분', () => {
    expect(roleFilterView(chars, { role: P1 }).visible.map((c) => c.id)).toEqual(['b', 'e']);
    expect(roleFilterView(chars, { role: '전체' }).visible.map((c) => c.id)).toEqual(['a']);
  });

  it('없는 선택값은 전체로 되돌린다', () => {
    const v = roleFilterView(chars, { role: '없는역할' });
    expect(v.selected).toEqual({ all: true });
    expect(v.visible).toHaveLength(5);
  });
});

describe('roleToInput / inputToRole', () => {
  it('왕복하면 원래 역할', () => {
    for (const r of ['', ...ROLE_PRESETS, '악당']) expect(inputToRole(roleToInput(r))).toBe(r);
  });
  it('직접 입력은 trim', () => {
    expect(inputToRole({ choice: 'custom', custom: '  악당 ' })).toBe('악당');
  });
});

describe('quotes', () => {
  it('추가·삭제는 새 배열을 돌려준다', () => {
    const q = ['a'];
    const added = addQuote(q, 'b');
    expect(added).toEqual(['a', 'b']);
    expect(q).toEqual(['a']);
    expect(removeQuote(added, 0)).toEqual(['b']);
  });
});

describe('computeAppearances', () => {
  it('작품·캐릭터로 거르고 number 오름차순', () => {
    const eps = [
      { id: 1, projectId: 'p', number: 3, title: 'c', characterIds: ['x'] },
      { id: 2, projectId: 'q', number: 1, title: 'o', characterIds: ['x'] },
      { id: 3, projectId: 'p', number: 1, title: 'a', characterIds: ['x', 'y'] },
      { id: 4, projectId: 'p', number: 2, title: 'b', characterIds: ['y'] },
    ];
    expect(computeAppearances(eps, 'p', 'x')).toEqual([
      { id: 3, number: 1, title: 'a' },
      { id: 1, number: 3, title: 'c' },
    ]);
  });
});
