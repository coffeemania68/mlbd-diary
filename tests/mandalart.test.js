import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createDb } from '../src/db/db.js';
import { MANDALART_PALETTE } from '../src/config.js';
import {
  SIZE,
  CENTER_BLOCK,
  emptyCells,
  cellIndex,
  cellPosition,
  isCenterCell,
  setCell,
  normalizeCells,
} from '../src/lib/mandalart.js';
import {
  listMandalarts,
  getMandalart,
  createMandalart,
  updateMandalart,
  deleteMandalart,
} from '../src/db/mandalarts.js';

let n = 0;
const freshDb = () => createDb(`test-mandalart-${Date.now()}-${n++}`);

const colorArb = fc.constantFrom(null, ...MANDALART_PALETTE.map((p) => p.value));
const cellArb = fc.record({ text: fc.string({ maxLength: 6 }), color: colorArb });
const cellsArb = fc.array(cellArb, { minLength: 81, maxLength: 81 });

describe('lib/mandalart', () => {
  it('emptyCells: 81칸 빈 칸, 서로 다른 객체', () => {
    const cells = emptyCells();
    expect(SIZE).toBe(9);
    expect(CENTER_BLOCK).toBe(4);
    expect(cells).toHaveLength(81);
    expect(cells.every((c) => c.text === '' && c.color === null)).toBe(true);
    expect(cells[0]).not.toBe(cells[1]);
  });

  it('normalizeCells: 짧은 배열·잘못된 칸·긴 배열·배열 아님을 81칸으로 맞춘다', () => {
    const short = normalizeCells([{ text: '목표', color: '#f6d4d8' }, null, { text: 3 }, 'x']);
    expect(short).toHaveLength(81);
    expect(short[0]).toEqual({ text: '목표', color: '#f6d4d8' });
    expect(short.slice(1)).toEqual(emptyCells().slice(1));

    const long = normalizeCells(Array.from({ length: 90 }, () => ({ text: 'a', color: null, extra: 1 })));
    expect(long).toHaveLength(81);
    expect(long[80]).toEqual({ text: 'a', color: null });

    expect(normalizeCells(undefined)).toEqual(emptyCells());
    expect(normalizeCells({})).toEqual(emptyCells());
  });

  // Feature: mlbd-book-sections, Property 20: 만다라트 칸 위치
  // **Validates: Requirements 12.2, 12.3, 12.11**
  it('Property 20: 만다라트 칸 위치', () => {
    const seen = new Set();
    for (let b = 0; b < 9; b++) for (let i = 0; i < 9; i++) seen.add(cellIndex(b, i));
    expect(seen.size).toBe(81);

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 8 }),
        fc.integer({ min: 0, max: 8 }),
        fc.integer({ min: 0, max: 80 }),
        (b, i, index) => {
          const idx = cellIndex(b, i);
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThanOrEqual(80);
          expect(cellPosition(idx)).toMatchObject({ block: b, i });

          const pos = cellPosition(index);
          expect(pos.row * 9 + pos.col).toBe(index);
          expect(cellIndex(pos.block, pos.i)).toBe(index);
          const inMiddle = pos.row >= 3 && pos.row <= 5 && pos.col >= 3 && pos.col <= 5;
          expect(isCenterCell(index)).toBe(inMiddle);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: mlbd-book-sections, Property 21: 만다라트 칸 값 바꾸기
  // **Validates: Requirements 12.6, 12.7**
  it('Property 21: 만다라트 칸 값 바꾸기', () => {
    fc.assert(
      fc.property(
        cellsArb,
        fc.integer({ min: 0, max: 80 }),
        fc.record({ text: fc.string(), color: colorArb }, { requiredKeys: [] }),
        (cells, index, patch) => {
          const snapshot = JSON.stringify(cells);
          const result = setCell(cells, index, patch);
          expect(JSON.stringify(cells)).toBe(snapshot);
          expect(result).toHaveLength(81);
          expect(result[index]).toEqual({ ...cells[index], ...patch });
          for (let k = 0; k < 81; k++) if (k !== index) expect(result[k]).toEqual(cells[k]);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('db/mandalarts', () => {
  it('새 만다라트 기본값, 고치기, 다시 읽기, 삭제', async () => {
    const database = freshDb();
    const m = await createMandalart('p1', database);
    expect(m).toMatchObject({ projectId: 'p1', title: '', note: '' });
    expect(m.cells).toEqual(emptyCells());
    expect(typeof m.id).toBe('string');

    const cells = setCell(m.cells, cellIndex(CENTER_BLOCK, 4), { text: '데뷔', color: MANDALART_PALETTE[0].value });
    const updated = await updateMandalart(m.id, { title: '목표', note: '메모', cells, projectId: 'p2' }, database);
    expect(updated).toMatchObject({ projectId: 'p1', title: '목표', note: '메모' });
    expect(await getMandalart(m.id, database)).toEqual(updated);
    expect((await getMandalart(m.id, database)).cells[40]).toEqual({ text: '데뷔', color: MANDALART_PALETTE[0].value });

    await expect(updateMandalart('missing', { title: 'x' }, database)).rejects.toThrow();

    await deleteMandalart(m.id, database);
    expect(await getMandalart(m.id, database)).toBeUndefined();
    expect(await listMandalarts('p1', database)).toEqual([]);
  });

  it('getMandalart: 옛 데이터의 짧은 cells를 81칸으로 맞춘다', async () => {
    const database = freshDb();
    await database.mandalarts.add({ id: 'old', projectId: 'p1', title: '', note: '', cells: [{ text: 'a', color: null }], createdAt: 1, updatedAt: 1 });
    const m = await getMandalart('old', database);
    expect(m.cells).toHaveLength(81);
    expect(m.cells[0]).toEqual({ text: 'a', color: null });
  });

  it('listMandalarts: createdAt 오름차순', async () => {
    const database = freshDb();
    const base = { projectId: 'p1', title: '', note: '', cells: emptyCells() };
    await database.mandalarts.bulkAdd([
      { ...base, id: 'c', createdAt: 30, updatedAt: 30 },
      { ...base, id: 'a', createdAt: 10, updatedAt: 10 },
      { ...base, id: 'b', createdAt: 20, updatedAt: 20 },
    ]);
    expect((await listMandalarts('p1', database)).map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  // Feature: mlbd-book-sections, Property 24: 작품 격리
  // **Validates: Requirements 16.7**
  it('Property 24: listMandalarts 작품 격리', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom('p1', 'p2', 'p3'), { maxLength: 10 }),
        fc.constantFrom('p1', 'p2', 'p3'),
        async (projects, target) => {
          const database = freshDb();
          const created = [];
          for (const p of projects) created.push(await createMandalart(p, database));
          const listed = await listMandalarts(target, database);
          expect(listed.every((m) => m.projectId === target)).toBe(true);
          expect(listed.map((m) => m.id).sort()).toEqual(
            created.filter((m) => m.projectId === target).map((m) => m.id).sort(),
          );
          database.close();
        },
      ),
      { numRuns: 25 },
    );
  });
});
