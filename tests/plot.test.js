import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createDb } from '../src/db/db.js';
import {
  cardsBySection,
  moveCard,
  reduceSections,
  overflowCount,
  removeSection,
  structureSections,
  moveFlags,
} from '../src/lib/plot.js';
import {
  getOrCreatePlotStructure,
  updatePlotStructure,
  applyPlotStructure,
  listPlotCards,
  createPlotCard,
  updatePlotCard,
  deletePlotCard,
  savePlotCardPositions,
} from '../src/db/plot.js';

let n = 0;
const freshDb = () => createDb(`test-plot-${Date.now()}-${n++}`);

// 카드 목록: 구간 0..k-1, order는 임의 정수(겹치기도 함), createdAt은 서로 달라 정렬이 하나로 정해진다
const cardsArb = (k) =>
  fc
    .array(fc.record({ s: fc.integer({ min: 0, max: k - 1 }), o: fc.integer({ min: -5, max: 20 }) }), {
      maxLength: 12,
    })
    .map((list) =>
      list.map(({ s, o }, i) => ({ id: `c${i}`, sectionIndex: s, order: o, createdAt: i })),
    );

/** 갱신 목록을 적용한 새 카드 목록 */
function apply(cards, updates) {
  const byId = new Map(updates.map((u) => [u.id, u]));
  return cards.map((c) =>
    byId.has(c.id) ? { ...c, sectionIndex: byId.get(c.id).sectionIndex, order: byId.get(c.id).order } : c,
  );
}

/** 구간별 id 목록 */
const ids = (cards, k) => cardsBySection(cards, k).map((col) => col.map((c) => c.id));

/** 갱신 목록에는 실제로 바뀐 카드만 있다 */
function expectOnlyChanged(cards, updates) {
  for (const u of updates) {
    const c = cards.find((x) => x.id === u.id);
    expect(c.sectionIndex !== u.sectionIndex || c.order !== u.order).toBe(true);
  }
}

const orders = (col) => col.map((c) => c.order);
const range = (len) => Array.from({ length: len }, (_, i) => i);

describe('lib/plot', () => {
  it('moveFlags: 처음·끝·하나뿐', () => {
    expect(moveFlags(0, 1)).toEqual({ up: false, down: false });
    expect(moveFlags(0, 3)).toEqual({ up: false, down: true });
    expect(moveFlags(1, 3)).toEqual({ up: true, down: true });
    expect(moveFlags(2, 3)).toEqual({ up: true, down: false });
  });

  // **Validates: Requirements 8.3, 8.4, 8.5**
  it('Property 16: 플롯 구조 구간', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ maxLength: 4 }), { minLength: 1, maxLength: 6 }),
        fc.constantFrom('kishotenketsu', 'three-act', 'custom'),
        (current, type) => {
          const before = [...current];
          const result = structureSections(type, current);
          if (type === 'kishotenketsu') expect(result).toEqual(['기', '승', '전', '결']);
          if (type === 'three-act') expect(result).toEqual(['1막', '2막', '3막']);
          if (type === 'custom') {
            expect(result).toEqual(current);
            expect(result).not.toBe(current);
          }
          expect(current).toEqual(before);
        },
      ),
    );
  });

  // **Validates: Requirements 8.7, 8.8, 8.9**
  it('Property 17: reduceSections 재배치', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }).chain((k) =>
          fc.tuple(fc.constant(k), cardsArb(k), fc.integer({ min: 1, max: k - 1 })),
        ),
        ([k, cards, newCount]) => {
          const snapshot = JSON.stringify(cards);
          const updates = reduceSections(cards, newCount);
          expect(JSON.stringify(cards)).toBe(snapshot);
          expectOnlyChanged(cards, updates);
          const after = apply(cards, updates);

          expect(after.length).toBe(cards.length);
          expect(after.every((c) => c.sectionIndex < newCount)).toBe(true);
          expect(overflowCount(cards, newCount)).toBe(
            cards.filter((c) => c.sectionIndex >= newCount).length,
          );

          const beforeCols = ids(cards, k);
          const afterCols = ids(after, newCount);
          // 앞 구간들은 그대로
          for (let s = 0; s < newCount - 1; s++) expect(afterCols[s]).toEqual(beforeCols[s]);
          // 마지막 구간 = 원래 마지막 구간 + 넘친 구간들 (sectionIndex, order 순서)
          const expected = beforeCols.slice(newCount - 1).flat();
          expect(afterCols[newCount - 1]).toEqual(expected);
          const lastCol = cardsBySection(after, newCount)[newCount - 1];
          if (overflowCount(cards, newCount) > 0) expect(orders(lastCol)).toEqual(range(lastCol.length));
        },
      ),
    );
  });

  // **Validates: Requirements 8.7, 8.8, 8.9**
  it('Property 17: removeSection 재배치', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }).chain((k) =>
          fc.tuple(fc.constant(k), cardsArb(k), fc.integer({ min: 0, max: k - 1 })),
        ),
        ([k, cards, index]) => {
          const sections = range(k).map((i) => `s${i}`);
          const snapshot = JSON.stringify(cards);
          const result = removeSection(sections, cards, index);
          expect(JSON.stringify(cards)).toBe(snapshot);
          expect(sections).toEqual(range(k).map((i) => `s${i}`));

          if (k === 1) {
            expect(result.sections).toEqual(sections);
            expect(result.updates).toEqual([]);
            return;
          }
          expectOnlyChanged(cards, result.updates);
          expect(result.sections).toEqual(sections.filter((_, i) => i !== index));

          const after = apply(cards, result.updates);
          expect(after.length).toBe(cards.length);
          expect(after.every((c) => c.sectionIndex >= 0 && c.sectionIndex < k - 1)).toBe(true);

          const beforeCols = ids(cards, k);
          const afterCols = ids(after, k - 1);
          const target = index === 0 ? 0 : index - 1;
          const oldTarget = index === 0 ? 1 : index - 1;
          expect(afterCols[target]).toEqual([...beforeCols[oldTarget], ...beforeCols[index]]);
          const targetCol = cardsBySection(after, k - 1)[target];
          if (beforeCols[index].length > 0) expect(orders(targetCol)).toEqual(range(targetCol.length));
          // 나머지 구간: 앞은 그대로, 뒤는 한 칸 당겨짐
          for (let s = 0; s < k - 1; s++) {
            if (s === target) continue;
            const old = s < index ? s : s + 1;
            expect(afterCols[s]).toEqual(beforeCols[old]);
          }
        },
      ),
    );
  });

  // **Validates: Requirements 9.1, 9.4, 9.5, 9.6**
  it('Property 18: 카드 이동', () => {
    const indexArb = fc.oneof(
      fc.integer({ min: -3, max: 15 }),
      fc.constantFrom(Infinity, -Infinity),
    );
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }).chain((k) =>
          fc.tuple(
            fc.constant(k),
            cardsArb(k).filter((c) => c.length > 0),
            fc.nat(),
            fc.integer({ min: 0, max: k - 1 }),
            indexArb,
          ),
        ),
        ([k, cards, pick, t, j]) => {
          const card = cards[pick % cards.length];
          const snapshot = JSON.stringify(cards);
          const updates = moveCard(cards, card.id, t, j);
          expect(JSON.stringify(cards)).toBe(snapshot);
          expectOnlyChanged(cards, updates);
          const after = apply(cards, updates);
          expect(after.length).toBe(cards.length);

          const s = card.sectionIndex;
          const beforeCols = ids(cards, k);
          const afterCols = ids(after, k);
          const without = (list) => list.filter((id) => id !== card.id);
          const targetRest = without(beforeCols[t]);
          const pos = Math.min(Math.max(j, 0), targetRest.length);
          const expectedTarget = [...targetRest];
          expectedTarget.splice(pos, 0, card.id);
          expect(afterCols[t]).toEqual(expectedTarget);
          if (s !== t) expect(afterCols[s]).toEqual(without(beforeCols[s]));

          const full = cardsBySection(after, k);
          for (const sec of new Set([s, t])) expect(orders(full[sec])).toEqual(range(full[sec].length));
          for (let x = 0; x < k; x++) {
            if (x === s || x === t) continue;
            expect(full[x]).toEqual(cardsBySection(cards, k)[x]);
          }

          // 위로·아래로 = 이웃과 자리 바꾸기, 구간 이동(Infinity) = 끝
          const col = beforeCols[s];
          const i = col.indexOf(card.id);
          const flags = moveFlags(i, col.length);
          if (flags.up) {
            const swapped = [...col];
            [swapped[i - 1], swapped[i]] = [swapped[i], swapped[i - 1]];
            expect(ids(apply(cards, moveCard(cards, card.id, s, i - 1)), k)[s]).toEqual(swapped);
          }
          if (flags.down) {
            const swapped = [...col];
            [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
            expect(ids(apply(cards, moveCard(cards, card.id, s, i + 1)), k)[s]).toEqual(swapped);
          }
          const toEnd = ids(apply(cards, moveCard(cards, card.id, t, Infinity)), k)[t];
          expect(toEnd[toEnd.length - 1]).toBe(card.id);
        },
      ),
    );
  });
});

describe('db/plot', () => {
  it('getOrCreatePlotStructure: 기본값 기승전결, 두 번 불러도 1개', async () => {
    const database = freshDb();
    const first = await getOrCreatePlotStructure('p1', database);
    expect(first).toMatchObject({ projectId: 'p1', type: 'kishotenketsu', sections: ['기', '승', '전', '결'] });
    expect(await getOrCreatePlotStructure('p1', database)).toEqual(first);
    expect(await database.plotStructures.where('projectId').equals('p1').count()).toBe(1);

    const renamed = await updatePlotStructure(first.id, { sections: ['가', '승', '전', '결'] }, database);
    expect(renamed.sections).toEqual(['가', '승', '전', '결']);
    expect((await getOrCreatePlotStructure('p1', database)).sections).toEqual(['가', '승', '전', '결']);
  });

  it('카드 만들기·고치기·위치 저장·삭제', async () => {
    const database = freshDb();
    const a = await createPlotCard('p1', 0, database);
    const b = await createPlotCard('p1', 0, database);
    const c = await createPlotCard('p1', 1, database);
    expect(a).toMatchObject({ sectionIndex: 0, order: 0, title: '', summary: '', episodeIds: [] });
    expect(b.order).toBe(1);
    expect(c.order).toBe(0);

    const updated = await updatePlotCard(a.id, { title: '시작', episodeIds: ['e1'] }, database);
    expect(updated).toMatchObject({ title: '시작', episodeIds: ['e1'], sectionIndex: 0, order: 0 });

    const cards = await listPlotCards('p1', database);
    await savePlotCardPositions(moveCard(cards, a.id, 1, Infinity), database);
    const after = await listPlotCards('p1', database);
    expect(after.map((x) => [x.id, x.sectionIndex, x.order])).toEqual([
      [b.id, 0, 0],
      [c.id, 1, 0],
      [a.id, 1, 1],
    ]);
    expect(after[2].title).toBe('시작');

    await deletePlotCard(b.id, database);
    expect((await listPlotCards('p1', database)).map((x) => x.id)).toEqual([c.id, a.id]);
  });

  it('applyPlotStructure: 구조와 카드 위치를 함께 바꾸고, 실패하면 둘 다 되돌린다', async () => {
    const database = freshDb();
    const structure = await getOrCreatePlotStructure('p1', database);
    const card = await createPlotCard('p1', 3, database);

    await expect(
      applyPlotStructure(
        structure.id,
        { type: 'three-act', sections: ['1막', '2막', '3막'] },
        [{ id: card.id, sectionIndex: 2, order: 0 }, { id: 'missing', sectionIndex: 0, order: 0 }],
        database,
      ),
    ).rejects.toThrow();
    expect(await database.plotStructures.get(structure.id)).toEqual(structure);
    expect(await database.plotCards.get(card.id)).toEqual(card);

    const cards = await listPlotCards('p1', database);
    const result = await applyPlotStructure(
      structure.id,
      { type: 'three-act', sections: ['1막', '2막', '3막'] },
      reduceSections(cards, 3),
      database,
    );
    expect(result).toMatchObject({ type: 'three-act', sections: ['1막', '2막', '3막'] });
    expect(await database.plotCards.get(card.id)).toMatchObject({ sectionIndex: 2, order: 0 });
  });

  // **Validates: Requirements 15.1, 15.2, 15.3**
  it('Property 24: listPlotCards 작품 격리', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({ projectId: fc.constantFrom('p1', 'p2', 'p3'), sectionIndex: fc.integer({ min: 0, max: 3 }) }),
          { maxLength: 10 },
        ),
        fc.constantFrom('p1', 'p2', 'p3'),
        async (specs, target) => {
          const database = freshDb();
          const created = [];
          for (const s of specs) created.push(await createPlotCard(s.projectId, s.sectionIndex, database));
          const listed = await listPlotCards(target, database);
          expect(listed.every((c) => c.projectId === target)).toBe(true);
          expect(listed.map((c) => c.id).sort()).toEqual(
            created.filter((c) => c.projectId === target).map((c) => c.id).sort(),
          );
          database.close();
        },
      ),
      { numRuns: 25 },
    );
  });
});
