import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { dropIndex, edgeScrollDelta } from '../src/lib/drag.js';
import { moveCard } from '../src/lib/plot.js';

describe('dropIndex', () => {
  const mids = [50, 150, 250];

  it('빈 열이면 0', () => {
    expect(dropIndex([], 100)).toBe(0);
  });

  it('첫 카드 가운데보다 위면 0', () => {
    expect(dropIndex(mids, 10)).toBe(0);
  });

  it('카드 사이면 아래 카드의 순번', () => {
    expect(dropIndex(mids, 100)).toBe(1);
    expect(dropIndex(mids, 200)).toBe(2);
  });

  it('마지막 카드 가운데보다 아래면 길이(끝)', () => {
    expect(dropIndex(mids, 400)).toBe(3);
  });

  it('가운데와 같은 높이면 그 카드 뒤', () => {
    expect(dropIndex(mids, 150)).toBe(2);
  });

  it('결과를 moveCard에 넣으면 pointer 위 카드 수만큼 앞에 카드가 남는다', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 2000 }), { maxLength: 10 }),
        fc.integer({ min: -100, max: 2100 }),
        (raw, y) => {
          const sorted = [...raw].sort((a, b) => a - b);
          const index = dropIndex(sorted, y);
          expect(index).toBe(sorted.filter((m) => m <= y).length);
          // 같은 구간 0번 열: 끄는 카드 'd' + 화면 순서대로 놓인 나머지 카드
          const others = sorted.map((_, i) => ({ id: `c${i}`, sectionIndex: 0, order: i + 1 }));
          const cards = [{ id: 'd', sectionIndex: 0, order: 0 }, ...others];
          const updates = moveCard(cards, 'd', 0, index);
          const order = updates.find((u) => u.id === 'd')?.order ?? 0;
          expect(order).toBe(index);
        },
      ),
    );
  });
});

describe('edgeScrollDelta', () => {
  it('앞쪽 가장자리 40px 안이면 음수', () => {
    expect(edgeScrollDelta(10, 0, 800)).toBeLessThan(0);
  });

  it('뒤쪽 가장자리 40px 안이면 양수', () => {
    expect(edgeScrollDelta(790, 0, 800)).toBeGreaterThan(0);
  });

  it('가운데면 0', () => {
    expect(edgeScrollDelta(400, 0, 800)).toBe(0);
    expect(edgeScrollDelta(40, 0, 800)).toBe(0);
    expect(edgeScrollDelta(760, 0, 800)).toBe(0);
  });
});
