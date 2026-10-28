import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { INK_DEFAULT_PRESSURE } from '../src/config.js';
import {
  toInkPoint, strokeBounds, strokeHit, segmentDistance, outlineToPathData,
} from '../src/lib/ink-geometry.js';
import { routeInk, createInkInputState } from '../src/lib/ink-input.js';

const rect = { left: 100, top: 50 };

describe('toInkPoint', () => {
  it('화면 좌표를 배율로 나눠 페이지 좌표로, 소수 둘째 자리 반올림', () => {
    const p = toInkPoint({ clientX: 100 + 10, clientY: 50 + 10, pointerType: 'pen', pressure: 0.123 }, rect, 3);
    expect(p).toEqual([3.33, 3.33, 0.12]);
  });

  it('손가락·마우스는 고정 필압', () => {
    expect(toInkPoint({ clientX: 0, clientY: 0, pointerType: 'touch', pressure: 0.8 }, rect, 1)[2])
      .toBe(INK_DEFAULT_PRESSURE);
    expect(toInkPoint({ clientX: 0, clientY: 0, pointerType: 'mouse', pressure: 0.5 }, rect, 1)[2])
      .toBe(INK_DEFAULT_PRESSURE);
  });

  // Feature: mlbd-pages-backup, Property 14: 필압 값
  // **Validates: Requirements 14.6**
  it('Property 14: 필압은 0 초과 1 이하, pen이 아니거나 0·없음이면 기본값', () => {
    const pressureArb = fc.oneof(
      fc.constant(0), fc.constant(undefined), fc.constant(NaN),
      fc.double({ min: -5, max: 5, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
    );
    fc.assert(fc.property(
      fc.constantFrom('pen', 'touch', 'mouse', ''),
      pressureArb,
      fc.double({ min: -1000, max: 3000, noNaN: true }),
      fc.double({ min: -1000, max: 3000, noNaN: true }),
      fc.double({ min: 0.1, max: 6, noNaN: true }),
      (pointerType, pressure, clientX, clientY, scale) => {
        const [, , p] = toInkPoint({ clientX, clientY, pointerType, pressure }, rect, scale);
        expect(p).toBeGreaterThan(0);
        expect(p).toBeLessThanOrEqual(1);
        if (pointerType !== 'pen' || !pressure) expect(p).toBe(INK_DEFAULT_PRESSURE);
      },
    ), { numRuns: 300 });
  });
});

describe('strokeHit', () => {
  it('점 1개 선은 그 점까지의 거리로 판정', () => {
    const stroke = { size: 6, points: [[100, 100, 0.5]] };
    // reach = 12 + 3 = 15
    expect(strokeHit(stroke, { x: 115, y: 100 }, 12)).toBe(true);
    expect(strokeHit(stroke, { x: 115.1, y: 100 }, 12)).toBe(false);
    expect(strokeHit(stroke, [100, 90], 12)).toBe(true);
  });

  it('선분 가운데 근처도 닿음', () => {
    const stroke = { size: 2, points: [[0, 0, 0.5], [100, 0, 0.5]] };
    expect(strokeHit(stroke, { x: 50, y: 10 }, 9)).toBe(true);
    expect(strokeHit(stroke, { x: 50, y: 10.5 }, 9)).toBe(false);
  });

  it('strokeBounds', () => {
    expect(strokeBounds({ points: [[5, 7, 1], [-2, 9, 1], [3, 1, 1]] }))
      .toEqual({ minX: -2, minY: 1, maxX: 5, maxY: 9 });
  });

  // Feature: mlbd-pages-backup, Property 15: 선 지우개 판정
  // **Validates: Requirements 14.8**
  it('Property 15: 경계 상자 거르기와 무관하게 직접 계산한 최소 거리 판정과 같다', () => {
    const coord = fc.double({ min: 0, max: 1000, noNaN: true });
    const pointArb = fc.tuple(coord, coord, fc.double({ min: 0.01, max: 1, noNaN: true }));
    fc.assert(fc.property(
      fc.array(pointArb, { minLength: 1, maxLength: 12 }),
      fc.constantFrom(3, 6, 12),
      fc.double({ min: -50, max: 1050, noNaN: true }),
      fc.double({ min: -50, max: 1050, noNaN: true }),
      fc.double({ min: 0, max: 200, noNaN: true }),
      (points, size, x, y, radius) => {
        const stroke = { size, points };
        const reach = radius + size / 2;
        let min;
        if (points.length === 1) {
          min = Math.hypot(x - points[0][0], y - points[0][1]);
        } else {
          min = Infinity;
          for (let i = 1; i < points.length; i++) {
            const [ax, ay] = points[i - 1];
            const [bx, by] = points[i];
            min = Math.min(min, segmentDistance(x, y, ax, ay, bx, by));
          }
        }
        expect(strokeHit(stroke, { x, y }, radius)).toBe(min <= reach);
      },
    ), { numRuns: 300 });
  });
});

describe('outlineToPathData', () => {
  it('빈 외곽이면 빈 문자열', () => {
    expect(outlineToPathData([])).toBe('');
  });

  it('이차 곡선으로 닫힌 경로', () => {
    const d = outlineToPathData([[0, 0], [10, 0], [10, 10]]);
    expect(d.startsWith('M 0 0 Q')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });
});

describe('routeInk', () => {
  const ev = (kind, pointerId, pointerType) => ({ kind, pointerId, pointerType });

  it('touch로 그리는 중 두 번째 touch → cancelStroke, 그 뒤 그리는 선 없음', () => {
    let s = createInkInputState();
    let r = routeInk(s, ev('down', 10, 'touch'), { penOnly: false });
    expect(r.action).toBe('start');
    r = routeInk(r.state, ev('down', 11, 'touch'), { penOnly: false });
    expect(r.action).toBe('cancelStroke');
    expect(r.state.drawingId).toBeNull();
    r = routeInk(r.state, ev('up', 10, 'touch'), { penOnly: false });
    expect(r.action).toBe('ignore');
    r = routeInk(r.state, ev('down', 12, 'touch'), { penOnly: false });
    expect(r.action).toBe('ignore'); // 11이 아직 닿아 있음
  });

  it('pen이 그리는 중 touch는 무시, pen up은 end', () => {
    let r = routeInk(createInkInputState(), ev('down', 1, 'pen'), { penOnly: true });
    expect(r.action).toBe('start');
    r = routeInk(r.state, ev('down', 10, 'touch'), { penOnly: false });
    expect(r.action).toBe('ignore');
    r = routeInk(r.state, ev('up', 1, 'pen'), { penOnly: false });
    expect(r.action).toBe('end');
    expect(r.state.drawingId).toBeNull();
  });

  it('penOnly면 touch는 시작하지 않고 mouse는 시작', () => {
    const s = createInkInputState();
    expect(routeInk(s, ev('down', 10, 'touch'), { penOnly: true }).action).toBe('ignore');
    expect(routeInk(s, ev('down', 2, 'mouse'), { penOnly: true }).action).toBe('start');
  });

  // Feature: mlbd-pages-backup, Property 16: 잉크 입력 라우팅
  // **Validates: Requirements 15.1, 15.2, 15.3, 15.4**
  it('Property 16: 라우팅 규칙과 동시에 하나의 선', () => {
    const eventArb = fc.oneof(
      fc.record({ kind: fc.constantFrom('down', 'up', 'cancel'), pointerId: fc.constant(1), pointerType: fc.constant('pen') }),
      fc.record({ kind: fc.constantFrom('down', 'up', 'cancel'), pointerId: fc.constant(2), pointerType: fc.constant('mouse') }),
      fc.record({ kind: fc.constantFrom('down', 'up', 'cancel'), pointerId: fc.integer({ min: 10, max: 13 }), pointerType: fc.constant('touch') }),
    );
    fc.assert(fc.property(fc.array(eventArb, { maxLength: 40 }), fc.boolean(), (events, penOnly) => {
      let state = createInkInputState();
      for (const e of events) {
        const before = state;
        const { state: next, action } = routeInk(before, e, { penOnly });
        const isTouchDown = e.kind === 'down' && e.pointerType === 'touch';

        if (penOnly && isTouchDown) expect(action).not.toBe('start');
        if (before.drawingType === 'pen' && e.pointerType === 'touch') {
          expect(action).toBe('ignore');
          expect(next.drawingId).toBe(before.drawingId);
        }
        if (before.drawingType === 'touch' && isTouchDown && e.pointerId !== before.drawingId) {
          expect(action).toBe('cancelStroke');
          expect(next.drawingId).toBeNull();
        }
        // 동시에 그리는 선은 하나: start는 그리는 선이 없을 때만
        if (action === 'start') {
          expect(before.drawingId).toBeNull();
          expect(next.drawingId).toBe(e.pointerId);
        }
        if (action === 'end' || action === 'cancelStroke') expect(next.drawingId).toBeNull();
        expect(next.drawingId === null).toBe(next.drawingType === null);
        // 입력 state는 바뀌지 않는다
        expect(before.touches).not.toBe(next.touches);
        state = next;
      }
    }), { numRuns: 300 });
  });
});
