import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  PAGE_W, PAGE_H, clampRect, snapRect, normalizeRect, zRanks,
  zForward, zBackward, zToFront, zToBack, placeNewWidget,
  clampZoom, clientToPage, pageToClient,
  normalizeRotation, rotateStep, rotationCommand,
} from '../src/lib/geometry.js';
import { applyCommand } from '../src/lib/page-model.js';
import { WIDGET_MIN_SIZE, SNAP_GRID, ZOOM_MAX, WIDGET_DEFAULT_SIZES } from '../src/config.js';

const coord = fc.double({ min: -3000, max: 3000, noNaN: true });
const rectArb = fc.record({ x: coord, y: coord, w: coord, h: coord });

function inPage(r) {
  return r.w >= WIDGET_MIN_SIZE && r.h >= WIDGET_MIN_SIZE
    && r.x >= 0 && r.x + r.w <= PAGE_W && r.y >= 0 && r.y + r.h <= PAGE_H;
}

/** 변경 [{id, z}]를 목록에 적용 */
function applyZ(widgets, changes) {
  const m = new Map(changes.map((c) => [c.id, c.z]));
  return widgets.map((w) => (m.has(w.id) ? { ...w, z: m.get(w.id) } : w));
}

const orderOf = (widgets) => [...zRanks(widgets)].sort((a, b) => a[1] - b[1]).map(([id]) => id);

describe('clampRect · snapRect', () => {
  it('작은 크기는 최소 크기로, 넘친 위치는 페이지 안으로', () => {
    expect(clampRect({ x: 990, y: -5, w: 10, h: 20.4 })).toEqual({ x: 940, y: 0, w: 60, h: 60 });
  });

  it('격자 맞춤은 최소 75, 세로 최대 1400', () => {
    expect(snapRect({ x: 12, y: 0, w: 10, h: 5000 })).toEqual({ x: 0, y: 0, w: 75, h: 1400 });
  });
});

// Feature: mlbd-pages-backup, Property 1: 위젯 영역 정리
describe('Property 1: 위젯 영역 정리', () => {
  it('normalizeRect는 페이지 안·최소 크기·격자 배수이고 멱등이다', () => {
    /** **Validates: Requirements 7.5, 7.6, 7.7** */
    fc.assert(fc.property(rectArb, fc.boolean(), (rect, snap) => {
      const opts = { snap, grid: SNAP_GRID };
      const r = normalizeRect(rect, opts);
      expect(inPage(r)).toBe(true);
      if (snap) for (const v of [r.x, r.y, r.w, r.h]) expect(v % SNAP_GRID).toBe(0);
      expect(normalizeRect(r, opts)).toEqual(r);
    }), { numRuns: 300 });
  });
});

// Feature: mlbd-pages-backup, Property 2: 앞뒤 순서 연산
describe('Property 2: 앞뒤 순서 연산', () => {
  const widgetsArb = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 8 })
    .chain((ids) => fc.tuple(
      fc.constant(ids),
      fc.array(fc.integer({ min: -3, max: 3 }), { minLength: ids.length, maxLength: ids.length }),
      fc.nat(ids.length - 1),
    ))
    .map(([ids, zs, t]) => ({ widgets: ids.map((id, i) => ({ id, z: zs[i] })), target: ids[t] }));

  it('대상만 정해진 순위로 가고 나머지 상대 순서는 그대로다', () => {
    /** **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.7** */
    fc.assert(fc.property(widgetsArb, ({ widgets, target }) => {
      const n = widgets.length;
      const before = orderOf(widgets);
      const rank = before.indexOf(target);
      const rest = before.filter((id) => id !== target);
      const cases = [
        [zForward, Math.min(rank + 1, n - 1)],
        [zBackward, Math.max(rank - 1, 0)],
        [zToFront, n - 1],
        [zToBack, 0],
      ];
      for (const [op, expected] of cases) {
        const after = orderOf(applyZ(widgets, op(widgets, target)));
        expect(after.indexOf(target)).toBe(expected);
        expect(after.filter((id) => id !== target)).toEqual(rest);
      }
    }), { numRuns: 300 });
  });

  it('맨 위에서 앞으로는 변경이 없다', () => {
    const ws = [{ id: 'a', z: 1 }, { id: 'b', z: 2 }];
    expect(zForward(ws, 'b')).toEqual([]);
    expect(zToFront(ws, 'b')).toEqual([]);
  });

  it('같은 z가 있으면 순위로 다시 매긴 변경도 돌려준다', () => {
    const ws = [{ id: 'a', z: 1 }, { id: 'b', z: 1 }, { id: 'c', z: 1 }];
    expect(zForward(ws, 'a')).toEqual([{ id: 'a', z: 2 }, { id: 'c', z: 3 }]);
  });
});

// Feature: mlbd-pages-backup, Property 3: 새 위젯 배치
describe('Property 3: 새 위젯 배치', () => {
  it('결과는 페이지 안이고 z는 모든 z보다 크다', () => {
    /** **Validates: Requirements 6.2** */
    const visibleArb = fc.record({
      x: fc.integer({ min: 0, max: PAGE_W - 1 }),
      y: fc.integer({ min: 0, max: PAGE_H - 1 }),
      w: fc.integer({ min: 1, max: PAGE_W }),
      h: fc.integer({ min: 1, max: PAGE_H }),
    });
    const listArb = fc.array(fc.record({ id: fc.uuid(), z: fc.integer({ min: -50, max: 50 }) }), { maxLength: 10 });
    fc.assert(fc.property(visibleArb, fc.constantFrom(...Object.keys(WIDGET_DEFAULT_SIZES)), listArb, (vis, type, list) => {
      const r = placeNewWidget(vis, WIDGET_DEFAULT_SIZES[type], list);
      expect(inPage(r)).toBe(true);
      for (const w of list) expect(r.z).toBeGreaterThan(w.z);
    }), { numRuns: 200 });
  });

  it('위젯이 없으면 z = 1', () => {
    expect(placeNewWidget({ x: 0, y: 0, w: 1000, h: 1414 }, { w: 400, h: 300 }, []))
      .toEqual({ x: 300, y: 557, w: 400, h: 300, z: 1 });
  });
});

// Feature: mlbd-pages-backup, Property 6: 좌표 변환과 확대 범위
describe('Property 6: 좌표 변환과 확대 범위', () => {
  it('clientToPage(pageToClient(p)) = p', () => {
    /** **Validates: Requirements 5.1, 5.2, 5.3** */
    const rectArb2 = fc.record({ left: coord, top: coord });
    const scaleArb = fc.double({ min: 0.05, max: 10, noNaN: true });
    const pArb = fc.record({ x: fc.double({ min: 0, max: PAGE_W, noNaN: true }), y: fc.double({ min: 0, max: PAGE_H, noNaN: true }) });
    fc.assert(fc.property(rectArb2, scaleArb, pArb, (rect, scale, p) => {
      const q = clientToPage(pageToClient(p, rect, scale), rect, scale);
      expect(q.x).toBeCloseTo(p.x, 6);
      expect(q.y).toBeCloseTo(p.y, 6);
    }), { numRuns: 300 });
  });

  it('clampZoom은 1 이상 ZOOM_MAX 이하', () => {
    fc.assert(fc.property(fc.double(), (z) => {
      const r = clampZoom(z);
      expect(r >= 1 && r <= ZOOM_MAX).toBe(true);
    }), { numRuns: 300 });
  });
});

// Feature: mlbd-final-block, Property 3: 스티커 회전 계산
// **Validates: Requirements 3.3, 3.4, 3.7, 3.8**
describe('스티커 회전 (Property 3)', () => {
  const anyRotation = fc.oneof(
    fc.integer({ min: -100000, max: 100000 }),
    fc.double(),
    fc.constantFrom(NaN, Infinity, -Infinity, undefined, null),
    fc.string(),
  );
  // 되돌림이 정확히 같아야 하는 값: 정수와 1/4 단위 실수(이진 표현이 정확)
  const exactRotation = fc.oneof(
    fc.integer({ min: -100000, max: 100000 }),
    fc.integer({ min: -400000, max: 400000 }).map((n) => n / 4),
  );
  const dirArb = fc.constantFrom(1, -1);

  it('rotateStep은 0 이상 360 미만', () => {
    fc.assert(fc.property(anyRotation, dirArb, (r, dir) => {
      const out = rotateStep(r, dir);
      expect(out >= 0 && out < 360).toBe(true);
    }), { numRuns: 100 });
  });

  it('반대 방향으로 한 번 더 돌리면 normalizeRotation(r)', () => {
    fc.assert(fc.property(fc.oneof(exactRotation, fc.constantFrom(NaN, Infinity, undefined, 'x')), dirArb, (r, dir) => {
      expect(rotateStep(rotateStep(r, dir), -dir)).toBe(normalizeRotation(r));
    }), { numRuns: 100 });
  });

  it('수가 아니거나 유한하지 않은 값의 normalizeRotation은 0', () => {
    fc.assert(fc.property(
      fc.oneof(fc.string(), fc.constantFrom(NaN, Infinity, -Infinity, undefined, null), fc.object()),
      (r) => { expect(normalizeRotation(r)).toBe(0); },
    ), { numRuns: 100 });
  });

  it('회전 명령의 before·after는 id와 rotation만 담고, 적용해도 x, y, w, h, z는 그대로', () => {
    const widgetArb = fc.record({
      id: fc.uuid(),
      x: fc.integer({ min: 0, max: 900 }), y: fc.integer({ min: 0, max: 1300 }),
      w: fc.integer({ min: 50, max: 500 }), h: fc.integer({ min: 50, max: 500 }),
      z: fc.integer({ min: -50, max: 50 }),
      rotation: anyRotation,
    });
    fc.assert(fc.property(widgetArb, dirArb, (w, dir) => {
      const cmd = rotationCommand(w, dir);
      expect(cmd.type).toBe('updateWidgets');
      expect(cmd.before).toEqual([{ id: w.id, rotation: normalizeRotation(w.rotation) }]);
      expect(cmd.after).toEqual([{ id: w.id, rotation: rotateStep(w.rotation, dir) }]);
      for (const entry of [...cmd.before, ...cmd.after]) {
        expect(Object.keys(entry).sort()).toEqual(['id', 'rotation']);
      }
      const model = { widgets: new Map([[w.id, { ...w, type: 'sticker' }]]), strokes: new Map() };
      const next = applyCommand(model, cmd, 1).widgets.get(w.id);
      expect([next.x, next.y, next.w, next.h, next.z]).toEqual([w.x, w.y, w.w, w.h, w.z]);
      expect(next.rotation).toBe(rotateStep(w.rotation, dir));
    }), { numRuns: 100 });
  });

  it('예: 0에서 왼쪽은 345, 345에서 오른쪽은 0', () => {
    expect(rotateStep(0, -1)).toBe(345);
    expect(rotateStep(345, 1)).toBe(0);
    expect(normalizeRotation(-15)).toBe(345);
    expect(normalizeRotation('90')).toBe(0);
  });
});
