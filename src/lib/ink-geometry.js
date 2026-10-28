// 손글씨 순수 계산. DOM을 쓰지 않는다.
// 점은 Page_Coordinates 기준 [x, y, 필압]이다.
import { INK_DEFAULT_PRESSURE } from '../config.js';

const round2 = (n) => Math.round(n * 100) / 100;

/** 필압: pen이고 0 < pressure ≤ 1일 때만 그 값, 아니면 INK_DEFAULT_PRESSURE (14.6) */
export function inkPressure(pointerType, pressure) {
  if (pointerType === 'pen' && typeof pressure === 'number' && pressure > 0 && pressure <= 1) {
    // 반올림으로 0이 되지 않게 0.01 이상으로 둔다
    return Math.max(0.01, round2(pressure));
  }
  return INK_DEFAULT_PRESSURE;
}

/**
 * 포인터 샘플({ clientX, clientY, pointerType, pressure })을 [x, y, p]로.
 * stageRect는 배율이 적용된 stage의 화면 위치({ left, top }), scale은 화면 px / 페이지 단위.
 */
export function toInkPoint(sample, stageRect, scale) {
  const x = round2((sample.clientX - stageRect.left) / scale);
  const y = round2((sample.clientY - stageRect.top) / scale);
  return [x, y, inkPressure(sample.pointerType, sample.pressure)];
}

/** 선의 점 경계 상자 { minX, minY, maxX, maxY }. 점이 없으면 null */
export function strokeBounds(stroke) {
  const points = stroke.points ?? [];
  if (points.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** 점 (px, py)에서 선분 (ax, ay)–(bx, by)까지의 거리 */
export function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * 선 지우개 판정 (14.8). point는 { x, y } 또는 [x, y].
 * 경계 상자로 먼저 거르고, 선분까지 거리 ≤ radius + size/2이면 닿음. 점 1개 선은 그 점까지의 거리.
 * bounds를 넘기면(캐시) 다시 계산하지 않는다.
 */
export function strokeHit(stroke, point, radius, bounds = strokeBounds(stroke)) {
  if (!bounds) return false;
  const px = Array.isArray(point) ? point[0] : point.x;
  const py = Array.isArray(point) ? point[1] : point.y;
  const reach = radius + stroke.size / 2;
  // 부동소수 오차로 결과가 바뀌지 않도록 거르기는 조금 넉넉하게 한다
  const margin = reach + 1e-6;
  if (px < bounds.minX - margin || px > bounds.maxX + margin ||
      py < bounds.minY - margin || py > bounds.maxY + margin) {
    return false;
  }
  const points = stroke.points;
  if (points.length === 1) {
    return Math.hypot(px - points[0][0], py - points[0][1]) <= reach;
  }
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    if (segmentDistance(px, py, ax, ay, bx, by) <= reach) return true;
  }
  return false;
}

/** perfect-freehand 외곽 다각형 → 이차 곡선 SVG path 문자열. 빈 외곽이면 '' */
export function outlineToPathData(outline) {
  if (!outline || outline.length === 0) return '';
  const parts = ['M', round2(outline[0][0]), round2(outline[0][1]), 'Q'];
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    parts.push(round2(x0), round2(y0), round2((x0 + x1) / 2), round2((y0 + y1) / 2));
  }
  parts.push('Z');
  return parts.join(' ');
}
