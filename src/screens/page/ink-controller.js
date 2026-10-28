// 손글씨 층 (설계 8절). 자유 페이지에서만 만든다(14.11).
//
// 캔버스 2장(.ink-canvas)을 stage 안 위젯 층 위에 1000×1414 CSS 크기로 둔다(14.1, 14.2).
//   .ink-cache: 완성된 선 전체(Ink_Cache)  .ink-live: 그리는 중인 선 하나와 입력 받기
// 픽셀 크기는 round(PAGE × fitScale × dpr), dpr = min(devicePixelRatio, INK_DPR_MAX).
// 그릴 때 setTransform(k, 0, 0, k, 0, 0)이라 경로는 Page_Coordinates 그대로다.
// 손글씨 확대(zoom) 중에는 해상도를 바꾸지 않는다(fitScale에만 맞춘다).
//
// Ink_Cache 다시 그리기 규칙(16.2~16.6):
//   열 때 전체 1회(redraw), 새 선은 그 선만 더함(appendStroke),
//   삭제·실행 취소·다시 실행(redraw), 배율 변경(onScaleChange → 크기를 바꾸고 redraw).
// 라이브 캔버스는 rAF마다 지우고 그리는 선 하나만 그린다(16.3).
//
// 입력: routeInk(lib/ink-input.js)가 start·cancelStroke·end·ignore를 정한다.
//   up·cancel은 window에서 받는다(무시한 손가락도 touches 목록에서 빠지게).
//   선 지우개는 끄는 동안 닿은 선을 화면에서 빼고(rAF마다 Ink_Cache 다시) 손을 떼면 onErase 한 번(14.8).
import { getStroke } from 'perfect-freehand';
import { PAGE_W, PAGE_H, INK_DPR_MAX, INK_HIGHLIGHTER_ALPHA, ERASER_RADIUS } from '../../config.js';
import { toInkPoint, strokeBounds, strokeHit, outlineToPathData } from '../../lib/ink-geometry.js';
import { createInkInputState, routeInk } from '../../lib/ink-input.js';

const FREEHAND = { thinning: 0.5, smoothing: 0.5, streamline: 0.4, simulatePressure: false };

/** 선 하나의 Path2D. 점이 없으면 null */
function strokePath(points, size, last) {
  if (!points || points.length === 0) return null;
  const d = outlineToPathData(getStroke(points, { ...FREEHAND, size, last }));
  return d ? new Path2D(d) : null;
}

function fillPath(ctx, path, tool, color) {
  ctx.globalAlpha = tool === 'highlighter' ? INK_HIGHLIGHTER_ALPHA : 1; // 14.7
  ctx.fillStyle = color;
  ctx.fill(path);
  ctx.globalAlpha = 1;
}

/** 그리는 순서: createdAt, 같으면 id */
function byCreated(a, b) {
  return (a.createdAt ?? 0) - (b.createdAt ?? 0) || String(a.id).localeCompare(String(b.id));
}

/**
 * @param {HTMLElement} stageEl  stage(1000×1414). 캔버스를 append한다
 * @param {{ getScale: () => number,                 화면 px / 페이지 단위 (fitScale × zoom)
 *           getFitScale?: () => number,             캔버스 해상도용 (없으면 getScale)
 *           getStageRect: () => DOMRect,
 *           getStrokes: () => Map<string, object> | Iterable<object>,
 *           getTool: () => { tool: 'pen'|'highlighter'|'eraser', color: string, size: number },
 *           getPenOnly: () => boolean,
 *           onStrokeDone: (s: { tool, color, size, points }) => void,
 *           onErase: (strokes: object[]) => void }} options
 */
export function enableInk(stageEl, { getScale, getFitScale = getScale, getStageRect, getStrokes, getTool, getPenOnly, onStrokeDone, onErase }) {
  const cache = document.createElement('canvas');
  cache.className = 'ink-canvas ink-cache';
  cache.setAttribute('aria-hidden', 'true');
  const live = document.createElement('canvas');
  live.className = 'ink-canvas ink-live';
  live.setAttribute('aria-hidden', 'true');
  stageEl.append(cache, live);
  const cacheCtx = cache.getContext('2d');
  const liveCtx = live.getContext('2d');

  const paths = new Map();   // strokeId → Path2D (완성된 선)
  const bounds = new Map();  // strokeId → 경계 상자 (지우개 판정)
  let k = 0;                 // 캔버스 px / 페이지 단위
  let enabled = false;
  let disposed = false;
  let input = createInkInputState();

  // 그리는 중: { kind: 'draw', tool, color, size, points, rect, scale }
  //          | { kind: 'erase', erased: Map<id, stroke>, rect, scale }
  let active = null;
  let raf = 0;
  let cacheDirty = false;

  const strokeList = () => {
    const s = getStrokes();
    return [...(s instanceof Map ? s.values() : s ?? [])];
  };

  function pathOf(stroke) {
    let p = paths.get(stroke.id);
    if (!p) {
      p = strokePath(stroke.points, stroke.size, true);
      if (p) paths.set(stroke.id, p);
    }
    return p;
  }

  function boundsOf(stroke) {
    if (!bounds.has(stroke.id)) bounds.set(stroke.id, strokeBounds(stroke));
    return bounds.get(stroke.id);
  }

  function prepare(ctx, canvas) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
  }

  /** 캔버스 픽셀 크기를 fitScale·dpr에 맞춘다. 바뀌었으면 true */
  function resize() {
    const fit = getFitScale() || 0;
    const dpr = Math.min(window.devicePixelRatio || 1, INK_DPR_MAX);
    const w = Math.round(PAGE_W * fit * dpr);
    const hgt = Math.round(PAGE_H * fit * dpr);
    k = w > 0 ? w / PAGE_W : 0;
    if (cache.width === w && cache.height === hgt) return false;
    for (const c of [cache, live]) {
      c.width = w;
      c.height = hgt;
    }
    return true;
  }

  /** Ink_Cache 전체 다시 (지우개로 빼는 중인 선 제외) */
  function redraw() {
    if (disposed) return;
    cacheDirty = false;
    prepare(cacheCtx, cache);
    const list = strokeList();
    const ids = new Set(list.map((s) => s.id));
    for (const id of [...paths.keys()]) if (!ids.has(id)) paths.delete(id);
    for (const id of [...bounds.keys()]) if (!ids.has(id)) bounds.delete(id);
    if (!k) return;
    const hidden = active?.kind === 'erase' ? active.erased : null;
    for (const s of list.sort(byCreated)) {
      if (hidden?.has(s.id)) continue;
      const p = pathOf(s);
      if (p) fillPath(cacheCtx, p, s.tool, s.color);
    }
  }

  /** 새 선 하나만 Ink_Cache에 더한다 (16.4) */
  function appendStroke(stroke) {
    if (disposed || !k || !stroke) return;
    const p = pathOf(stroke);
    if (p) fillPath(cacheCtx, p, stroke.tool, stroke.color);
  }

  function drawLive() {
    raf = 0;
    if (disposed) return;
    if (cacheDirty) redraw();
    prepare(liveCtx, live);
    if (!k || active?.kind !== 'draw') return;
    const p = strokePath(active.points, active.size, false);
    if (p) fillPath(liveCtx, p, active.tool, active.color);
  }

  function requestFrame() {
    if (!raf && !disposed) raf = requestAnimationFrame(drawLive);
  }

  function clearLive() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    prepare(liveCtx, live);
  }

  // ── 입력 ──
  function addSample(sample) {
    const pt = toInkPoint(sample, active.rect, active.scale);
    if (active.kind === 'draw') {
      const prev = active.points[active.points.length - 1];
      if (prev && prev[0] === pt[0] && prev[1] === pt[1]) return;
      active.points.push(pt);
    } else {
      for (const s of strokeList()) {
        if (active.erased.has(s.id)) continue;
        if (strokeHit(s, pt, ERASER_RADIUS, boundsOf(s))) {
          active.erased.set(s.id, s);
          cacheDirty = true;
        }
      }
    }
  }

  function begin(e) {
    const scale = getScale();
    if (!scale) return false;
    const tool = getTool() ?? {};
    const rect = getStageRect();
    if (tool.tool === 'eraser') {
      active = { kind: 'erase', erased: new Map(), rect, scale };
    } else {
      active = {
        kind: 'draw',
        tool: tool.tool === 'highlighter' ? 'highlighter' : 'pen',
        color: tool.color,
        size: tool.size,
        points: [],
        rect,
        scale,
      };
    }
    addSample(e);
    requestFrame();
    return true;
  }

  /** 그리던 선을 버린다 (15.3). 지우개는 빼던 선을 되살린다 */
  function cancelActive() {
    if (!active) return;
    const wasErase = active.kind === 'erase' && active.erased.size > 0;
    active = null;
    clearLive();
    if (wasErase) redraw();
  }

  function finish() {
    const done = active;
    active = null;
    clearLive();
    if (!done) return;
    if (done.kind === 'draw') {
      if (done.points.length > 0) {
        onStrokeDone({ tool: done.tool, color: done.color, size: done.size, points: done.points });
      }
    } else if (done.erased.size > 0) {
      onErase([...done.erased.values()]); // 화면 쪽이 deleteStrokes 후 redraw
    } else if (cacheDirty) {
      redraw();
    }
  }

  function onPointerDown(e) {
    if (!enabled || disposed) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const { state, action } = routeInk(
      input,
      { kind: 'down', pointerId: e.pointerId, pointerType: e.pointerType },
      { penOnly: getPenOnly() },
    );
    input = state;
    if (action === 'start') {
      if (!begin(e)) {
        input = createInkInputState();
        return;
      }
      e.preventDefault();
      try {
        live.setPointerCapture(e.pointerId);
      } catch {
        /* 이미 놓인 포인터 */
      }
    } else if (action === 'cancelStroke') {
      cancelActive();
    }
  }

  function onPointerMove(e) {
    if (!active || e.pointerId !== input.drawingId) return;
    const samples = e.getCoalescedEvents?.() ?? [];
    for (const s of samples.length ? samples : [e]) addSample(s);
    requestFrame();
  }

  function onPointerEnd(e) {
    if (disposed) return;
    const known = e.pointerId === input.drawingId || input.touches.has(e.pointerId);
    if (!known) return;
    const kind = e.type === 'pointerup' ? 'up' : 'cancel';
    const { state, action } = routeInk(input, { kind, pointerId: e.pointerId, pointerType: e.pointerType }, { penOnly: getPenOnly() });
    input = state;
    if (action === 'end') {
      if (active) addSample(e);
      finish();
    } else if (action === 'cancelStroke') {
      cancelActive();
    }
  }

  function onLostCapture(e) {
    // pointerup 없이 캡처를 잃으면(다른 요소가 가져감) 선을 버린다
    if (e.pointerId === input.drawingId) onPointerEnd({ type: 'pointercancel', pointerId: e.pointerId, pointerType: e.pointerType });
  }

  live.addEventListener('pointerdown', onPointerDown);
  live.addEventListener('pointermove', onPointerMove);
  live.addEventListener('lostpointercapture', onLostCapture);
  window.addEventListener('pointerup', onPointerEnd);
  window.addEventListener('pointercancel', onPointerEnd);

  resize();
  redraw(); // 16.2

  return {
    /** Ink_Cache 전체 다시 (삭제·실행 취소·다시 실행, 16.5) */
    redraw,
    /** 새 선 하나만 더한다 (16.4) */
    appendStroke,
    /** 표시 배율이 바뀌면(ResizeObserver) 해상도를 맞추고 다시 그린다 (16.6) */
    onScaleChange() {
      if (disposed) return;
      if (resize()) {
        redraw();
        if (active?.kind === 'draw') requestFrame();
      }
    },
    /** 손글씨 모드 켜기/끄기. 끄면 그리던 선을 버리고 입력 상태를 비운다 */
    setEnabled(on) {
      enabled = Boolean(on);
      if (!enabled) {
        cancelActive();
        input = createInkInputState();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      active = null;
      live.removeEventListener('pointerdown', onPointerDown);
      live.removeEventListener('pointermove', onPointerMove);
      live.removeEventListener('lostpointercapture', onLostCapture);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      paths.clear();
      bounds.clear();
      cache.remove();
      live.remove();
    },
  };
}
