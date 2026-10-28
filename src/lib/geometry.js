// 페이지 위젯의 위치·크기·쌓는 순서·배율 계산. DOM을 쓰지 않는다.
// 좌표는 모두 Page_Coordinates(가로 PAGE_W × 세로 PAGE_H)다.

import { PAGE_W, PAGE_H, SNAP_GRID, WIDGET_MIN_SIZE, ZOOM_MAX, ROTATION_STEP } from '../config.js';

export { PAGE_W, PAGE_H };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v) => (Number.isFinite(v) ? v : 0);

/** w,h ≥ min, 페이지 안. 값을 정수로 반올림한다 */
export function clampRect({ x, y, w, h }, { min = WIDGET_MIN_SIZE } = {}) {
  const cw = clamp(Math.round(num(w)), min, PAGE_W);
  const ch = clamp(Math.round(num(h)), min, PAGE_H);
  return {
    x: clamp(Math.round(num(x)), 0, PAGE_W - cw),
    y: clamp(Math.round(num(y)), 0, PAGE_H - ch),
    w: cw,
    h: ch,
  };
}

/**
 * 격자 배수로 반올림한다. 최소 크기는 ceil(min/g)*g, 최대는 floor(PAGE/g)*g,
 * 위치 상한은 floor((PAGE - w)/g)*g
 */
export function snapRect({ x, y, w, h }, grid = SNAP_GRID, { min = WIDGET_MIN_SIZE } = {}) {
  const g = grid;
  const snap = (v) => Math.round(num(v) / g) * g;
  const minSide = Math.ceil(min / g) * g;
  const sw = clamp(snap(w), minSide, Math.floor(PAGE_W / g) * g);
  const sh = clamp(snap(h), minSide, Math.floor(PAGE_H / g) * g);
  return {
    x: clamp(snap(x), 0, Math.floor((PAGE_W - sw) / g) * g),
    y: clamp(snap(y), 0, Math.floor((PAGE_H - sh) / g) * g),
    w: sw,
    h: sh,
  };
}

/** 편집 결과 하나로 정리: snap이면 snapRect, 아니면 clampRect. 두 번 적용해도 같다 */
export function normalizeRect(rect, { snap = false, grid = SNAP_GRID } = {}) {
  return snap ? snapRect(rect, grid) : clampRect(rect);
}

const toList = (widgets) => (widgets instanceof Map ? [...widgets.values()] : [...widgets]);

/** (z, id) 오름차순으로 정렬한 목록 */
function sortedByZ(widgets) {
  return toList(widgets).sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** [{id, z}] → Map<id, 순위 0..n-1>. (z, id) 오름차순. CSS z-index에는 순위를 쓴다 */
export function zRanks(widgets) {
  return new Map(sortedByZ(widgets).map((w, i) => [w.id, i]));
}

/** 원래 z와 다른 것만 [{ id, z }]로 */
function diffZ(sorted, finalZ) {
  return sorted.flatMap((w, i) => (finalZ[i] !== w.z ? [{ id: w.id, z: finalZ[i] }] : []));
}

/** 이웃(step = +1 위, −1 아래)과 z를 바꾼다. 같은 z가 있으면 순위로 먼저 다시 매긴다 */
function swapWithNeighbor(widgets, id, step) {
  const sorted = sortedByZ(widgets);
  const i = sorted.findIndex((w) => w.id === id);
  const j = i + step;
  if (i < 0 || j < 0 || j >= sorted.length) return [];
  const hasTie = sorted.some((w, k) => k > 0 && sorted[k - 1].z === w.z);
  const finalZ = hasTie ? sorted.map((_, k) => k + 1) : sorted.map((w) => w.z);
  [finalZ[i], finalZ[j]] = [finalZ[j], finalZ[i]];
  return diffZ(sorted, finalZ);
}

/** 바로 위 위젯과 z 교환. 바뀌는 위젯의 [{ id, z }]만(없으면 []) */
export function zForward(widgets, id) {
  return swapWithNeighbor(widgets, id, 1);
}

/** 바로 아래 위젯과 z 교환 */
export function zBackward(widgets, id) {
  return swapWithNeighbor(widgets, id, -1);
}

/** 맨 앞으로: max(z) + 1. 이미 맨 위면 [] */
export function zToFront(widgets, id) {
  const sorted = sortedByZ(widgets);
  const i = sorted.findIndex((w) => w.id === id);
  if (i < 0 || i === sorted.length - 1) return [];
  return [{ id, z: sorted[sorted.length - 1].z + 1 }];
}

/** 맨 뒤로: min(z) − 1. 이미 맨 아래면 [] */
export function zToBack(widgets, id) {
  const sorted = sortedByZ(widgets);
  const i = sorted.findIndex((w) => w.id === id);
  if (i <= 0) return [];
  return [{ id, z: sorted[0].z - 1 }];
}

/** 새 위젯 자리: 보이는 영역 가운데, 페이지 안, z = max + 1 (위젯이 없으면 1) */
export function placeNewWidget(visibleRect, size, widgets) {
  const rect = clampRect({
    x: visibleRect.x + (visibleRect.w - size.w) / 2,
    y: visibleRect.y + (visibleRect.h - size.h) / 2,
    w: size.w,
    h: size.h,
  });
  const list = toList(widgets);
  const z = list.length ? Math.max(...list.map((w) => w.z)) + 1 : 1;
  return { ...rect, z };
}

/** 확대 배율을 min~max로. 숫자가 아니면 min */
export function clampZoom(z, min = 1, max = ZOOM_MAX) {
  return Number.isFinite(z) ? clamp(z, min, max) : min;
}

/** 화면 좌표 → 페이지 좌표. rect는 stage의 getBoundingClientRect() */
export function clientToPage(point, rect, scale) {
  return { x: (point.x - rect.left) / scale, y: (point.y - rect.top) / scale };
}

/** 페이지 좌표 → 화면 좌표 */
export function pageToClient(point, rect, scale) {
  return { x: rect.left + point.x * scale, y: rect.top + point.y * scale };
}

/** 숫자가 아니거나 유한하지 않으면 0. 아니면 ((r % 360) + 360) % 360 (0 이상 360 미만) */
export function normalizeRotation(r) {
  if (typeof r !== 'number' || !Number.isFinite(r)) return 0;
  return ((r % 360) + 360) % 360;
}

/** dir: 1(오른쪽, 시계 방향) | -1(왼쪽). normalizeRotation(r + dir × step) */
export function rotateStep(r, dir, step = ROTATION_STEP) {
  return normalizeRotation(normalizeRotation(r) + dir * step);
}

/** 회전 명령. before·after에는 id와 rotation만 담는다(x, y, w, h, z는 넣지 않는다) */
export function rotationCommand(widget, dir) {
  return {
    type: 'updateWidgets',
    before: [{ id: widget.id, rotation: normalizeRotation(widget.rotation) }],
    after: [{ id: widget.id, rotation: rotateStep(widget.rotation, dir) }],
  };
}
