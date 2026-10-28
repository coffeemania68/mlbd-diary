// 페이지 무대와 배율 (설계 3절).
//
// viewport (overflow: auto, 폭 = 화면 폭)
// └─ sizer (width = viewportWidth × zoom, height = width × PAGE_H / PAGE_W)
//    └─ stage (PAGE_W × PAGE_H, transform-origin 0 0, transform: scale(fitScale × zoom))
//
// - fitScale = viewport.clientWidth / PAGE_W. ResizeObserver로 폭이 바뀌면 다시 계산하고
//   onScaleChange를 부른다(잉크 캔버스 다시 만들기, 16.6). zoom만 바뀔 때는 onZoomChange.
// - 핀치는 Touch Events 두 손가락. 시작 때 가운데 점 아래의 페이지 좌표를 기억하고,
//   움직이는 동안 그 페이지 좌표가 현재 가운데 점 아래에 남도록 scrollLeft/Top을 고친다.
//   (확대와 두 손가락 이동이 한 계산으로 처리된다.) 핀치 중에는 preventDefault로 브라우저 스크롤을 막는다.
// - 확대 허용: setMode(mode)가 "Phone_Layout이거나 ink 모드"로 정한다. setZoomEnabled로 직접 바꿀 수도 있다
//   (다음 setMode나 화면 폭 기준 변경 때 다시 계산된다).
// - 손글씨 모드에서는 확대가 꺼져 있어도 두 손가락 이동을 직접 한다(touch-action: none이라).
//   setInkPan(true)이면(penOnly, 9.1) 한 손가락 이동도 viewport.scrollBy로 한다.
//   S펜이 만드는 touch(touchType 'stylus')는 손가락 수에 넣지 않는다.
// - 손글씨 확대 중 캔버스 해상도는 그대로다(fitScale에만 맞춘다).
import '../../styles/page.css';

import { PAGE_W, PAGE_H } from '../../config.js';
import { clampZoom, clientToPage } from '../../lib/geometry.js';

const PHONE_QUERY = '(max-width: 599px)';
const MODES = ['view', 'edit', 'ink'];

/** 손가락 touch만 (S펜 stylus 제외) */
function fingers(touchList) {
  return [...touchList].filter((t) => t.touchType !== 'stylus');
}

function midpoint(a, b) {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

function distance(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/**
 * @param {HTMLElement} el  무대를 넣을 부모. viewport를 append한다
 * @param {{ onScaleChange?: (s: {scale:number, fitScale:number, zoom:number}) => void,
 *           onZoomChange?: (s: {scale:number, fitScale:number, zoom:number}) => void }} [options]
 */
export function createStage(el, { onScaleChange, onZoomChange } = {}) {
  const viewport = document.createElement('div');
  viewport.className = 'page-viewport';
  const sizer = document.createElement('div');
  sizer.className = 'page-sizer';
  const stage = document.createElement('div');
  stage.className = 'page-stage';
  sizer.append(stage);
  viewport.append(sizer);
  el.append(viewport);

  const phoneMq = window.matchMedia(PHONE_QUERY);
  let mode = 'view';
  let fitScale = 0;
  let viewportWidth = 0;
  let zoom = 1;
  let zoomEnabled = false;
  let inkPan = false;

  const scaleInfo = () => ({ scale: fitScale * zoom, fitScale, zoom });

  function applyLayout() {
    const w = viewportWidth * zoom;
    sizer.style.width = `${w}px`;
    sizer.style.height = `${(w * PAGE_H) / PAGE_W}px`;
    stage.style.transform = `scale(${fitScale * zoom})`;
  }

  /** zoom을 바꾸고, pagePoint가 clientPoint 아래에 오도록 스크롤을 고친다 */
  function zoomAt(nextZoom, pagePoint, clientPoint) {
    const z = clampZoom(nextZoom);
    const changed = z !== zoom;
    zoom = z;
    if (changed) applyLayout();
    const rect = stage.getBoundingClientRect();
    const s = fitScale * zoom;
    viewport.scrollLeft += rect.left + pagePoint.x * s - clientPoint.x;
    viewport.scrollTop += rect.top + pagePoint.y * s - clientPoint.y;
    if (changed) onZoomChange?.(scaleInfo());
  }

  /** 보이는 영역의 왼쪽 위 화면 좌표 (viewport와 창이 겹치는 곳) */
  function visibleClientBox() {
    const r = viewport.getBoundingClientRect();
    const left = Math.max(r.left + viewport.clientLeft, 0);
    const top = Math.max(r.top + viewport.clientTop, 0);
    const right = Math.min(r.left + viewport.clientLeft + viewport.clientWidth, window.innerWidth);
    const bottom = Math.min(r.top + viewport.clientTop + viewport.clientHeight, window.innerHeight);
    return { left, top, right, bottom };
  }

  function setZoom(nextZoom) {
    if (!fitScale) {
      zoom = clampZoom(nextZoom);
      return;
    }
    const box = visibleClientBox();
    const anchor = { x: box.left, y: box.top };
    const p = clientToPage(anchor, stage.getBoundingClientRect(), fitScale * zoom);
    zoomAt(nextZoom, p, anchor);
  }

  function measure() {
    const w = viewport.clientWidth;
    if (w <= 0 || Math.abs(w - viewportWidth) < 0.5) return;
    viewportWidth = w;
    fitScale = w / PAGE_W;
    applyLayout();
    onScaleChange?.(scaleInfo());
  }

  function setZoomEnabled(on) {
    zoomEnabled = Boolean(on);
    if (!zoomEnabled && zoom !== 1) setZoom(1);
  }

  function refreshZoomAllowed() {
    setZoomEnabled(mode === 'ink' || phoneMq.matches);
  }

  /** data-mode를 바꾸고 확대 허용을 다시 정한다 */
  function setMode(next) {
    mode = MODES.includes(next) ? next : 'view';
    viewport.dataset.mode = mode;
    refreshZoomAllowed();
  }

  // ── 터치 제스처 ──
  // gesture: null | { kind: 'pinch', zoom0, dist0, page } | { kind: 'pan', x, y }
  let gesture = null;
  let pending = null; // rAF에서 처리할 최근 손가락 목록
  let raf = 0;

  const twoFingerActive = () => zoomEnabled || mode === 'ink';

  function startGesture(list) {
    if (list.length >= 2 && twoFingerActive() && fitScale) {
      const [a, b] = list;
      const mid = midpoint(a, b);
      gesture = {
        kind: 'pinch',
        zoom0: zoom,
        dist0: Math.max(distance(a, b), 1),
        page: clientToPage(mid, stage.getBoundingClientRect(), fitScale * zoom),
      };
    } else if (list.length === 1 && inkPan && mode === 'ink') {
      gesture = { kind: 'pan', x: list[0].clientX, y: list[0].clientY };
    } else {
      gesture = null;
    }
  }

  function processMove() {
    raf = 0;
    const list = pending;
    pending = null;
    if (!gesture || !list) return;
    if (gesture.kind === 'pinch' && list.length >= 2) {
      const [a, b] = list;
      const nextZoom = zoomEnabled ? gesture.zoom0 * (distance(a, b) / gesture.dist0) : zoom;
      zoomAt(nextZoom, gesture.page, midpoint(a, b));
    } else if (gesture.kind === 'pan' && list.length === 1) {
      const t = list[0];
      viewport.scrollBy(gesture.x - t.clientX, gesture.y - t.clientY);
      gesture.x = t.clientX;
      gesture.y = t.clientY;
    }
  }

  function onTouchStart(e) {
    startGesture(fingers(e.touches));
  }

  function onTouchMove(e) {
    if (!gesture) return;
    const list = fingers(e.touches);
    if (gesture.kind === 'pinch' && e.cancelable) e.preventDefault();
    pending = list;
    if (!raf) raf = requestAnimationFrame(processMove);
  }

  function onTouchEnd(e) {
    // 손가락 수가 바뀌면 남은 손가락으로 다시 시작한다(두 손가락 → 한 손가락 이동 등)
    if (raf) {
      cancelAnimationFrame(raf);
      processMove();
    }
    startGesture(fingers(e.touches));
  }

  viewport.addEventListener('touchstart', onTouchStart, { passive: true });
  viewport.addEventListener('touchmove', onTouchMove, { passive: false });
  viewport.addEventListener('touchend', onTouchEnd, { passive: true });
  viewport.addEventListener('touchcancel', onTouchEnd, { passive: true });

  const ro = new ResizeObserver(() => measure());
  ro.observe(viewport);
  phoneMq.addEventListener('change', refreshZoomAllowed);

  setMode('view');
  measure();

  return {
    viewport,
    sizer,
    stage,
    /** 현재 표시 배율 (fitScale × zoom) */
    getScale: () => fitScale * zoom,
    getFitScale: () => fitScale,
    getZoom: () => zoom,
    /** 제스처 시작 때 한 번 읽어 clientToPage에 넘긴다 */
    getStageRect: () => stage.getBoundingClientRect(),
    /** viewport에서 보이는 영역을 Page_Coordinates로 (페이지 범위로 자름) */
    visiblePageRect() {
      const s = fitScale * zoom;
      if (!s) return { x: 0, y: 0, w: PAGE_W, h: PAGE_H };
      const box = visibleClientBox();
      const rect = stage.getBoundingClientRect();
      const a = clientToPage({ x: box.left, y: box.top }, rect, s);
      const b = clientToPage({ x: box.right, y: box.bottom }, rect, s);
      const x = Math.max(0, Math.min(a.x, PAGE_W));
      const y = Math.max(0, Math.min(a.y, PAGE_H));
      const w = Math.min(b.x, PAGE_W) - x;
      const h = Math.min(b.y, PAGE_H) - y;
      if (w <= 0 || h <= 0) return { x: 0, y: 0, w: PAGE_W, h: PAGE_H };
      return { x, y, w, h };
    },
    setMode,
    getMode: () => mode,
    setZoomEnabled,
    isZoomEnabled: () => zoomEnabled,
    setZoom,
    /** penOnly일 때 손글씨 모드 한 손가락 이동 (9.1에서 켬) */
    setInkPan(on) {
      inkPan = Boolean(on);
      if (!inkPan && gesture?.kind === 'pan') gesture = null;
    },
    /** 두 손가락 핀치·이동 또는 한 손가락 이동 중인지 */
    isGesturing: () => gesture !== null,
    dispose() {
      ro.disconnect();
      phoneMq.removeEventListener('change', refreshZoomAllowed);
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', onTouchEnd);
      viewport.removeEventListener('touchcancel', onTouchEnd);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      gesture = null;
    },
  };
}
