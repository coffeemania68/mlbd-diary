// 편집 모드 위젯 끌기·크기 조절 (설계 5절). lib/drag.js와 같은 Pointer Events 방식이다.
//
// 1. pointerdown(편집 모드, .widget 또는 .resize-handle): 선택, setPointerCapture, 시작 rect·포인터 저장.
//    마우스는 왼쪽 버튼만. 위젯 밖을 누르면 선택을 푼다(onSelect(null)).
// 2. pointermove: 최근 위치만 저장하고 rAF 한 번에 반영한다.
//    이동은 움직이는 위젯 하나에만 transform: translate(). 크기는 .resize-ghost 외곽선만 바꾼다.
//    다른 위젯은 건드리지 않고(17.3) DB에도 쓰지 않는다(7.2).
// 3. pointerup: normalizeRect(rect, { snap })로 최종 rect → 바뀌었으면 left/top/width/height 반영 후
//    onCommit({ type: 'updateWidgets', before: [{ id, x, y, w, h }], after: [...] }).
// 4. pointercancel·lostpointercapture·Escape·두 번째 손가락: 원위치.
// 5. MOVE_THRESHOLD(5px) 미만으로 움직이면 선택만 한다.
//
// 편집 모드인지는 stage 조상의 data-mode로 판단한다(page-screen은 data-mode만 바꾼다).
// 이 모듈이 쓰는 클래스: .widget(data-id), .resize-handle, .resize-ghost, .widget-dragging
import { normalizeRect } from '../../lib/geometry.js';
import { SNAP_GRID } from '../../config.js';

const MOVE_THRESHOLD = 5; // 화면 px
const GHOST_Z = 100000;   // 위젯 순위보다 위

const sameRect = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

/**
 * @param {HTMLElement} stageEl  위젯 요소들을 담은 무대
 * @param {{ getScale: () => number,
 *           getModel: () => { widgets: Map<string, object> },
 *           getSnap: () => boolean,
 *           onSelect: (id: string | null) => void,
 *           onCommit: (cmd: object) => void }} options
 * @returns {() => void} 해제 함수
 */
export function enableWidgetEditing(stageEl, { getScale, getModel, getSnap, onSelect, onCommit }) {
  let drag = null;

  const isEditMode = () => stageEl.closest('[data-mode]')?.dataset.mode === 'edit';

  /** 포인터 위치 → 정리된 rect (끄는 동안 보여 주는 값 = 놓을 때 저장할 값) */
  function rectFor(pointer) {
    const { start, rect, kind, scale } = drag;
    const dx = (pointer.x - start.x) / scale;
    const dy = (pointer.y - start.y) / scale;
    const raw = kind === 'move'
      ? { x: rect.x + dx, y: rect.y + dy, w: rect.w, h: rect.h }
      : { x: rect.x, y: rect.y, w: rect.w + dx, h: rect.h + dy };
    return normalizeRect(raw, { snap: drag.snap, grid: SNAP_GRID });
  }

  function paint() {
    drag.frame = 0;
    const next = rectFor(drag.pointer);
    if (drag.kind === 'move') {
      drag.el.style.transform = `translate(${next.x - drag.rect.x}px, ${next.y - drag.rect.y}px)`;
    } else {
      const g = drag.ghost;
      g.style.width = `${next.w}px`;
      g.style.height = `${next.h}px`;
    }
  }

  function startVisuals() {
    drag.el.classList.add('widget-dragging');
    if (drag.kind === 'resize') {
      const g = document.createElement('div');
      g.className = 'resize-ghost';
      g.setAttribute('aria-hidden', 'true');
      Object.assign(g.style, {
        left: `${drag.rect.x}px`,
        top: `${drag.rect.y}px`,
        width: `${drag.rect.w}px`,
        height: `${drag.rect.h}px`,
        zIndex: String(GHOST_Z),
      });
      (drag.el.parentElement ?? stageEl).append(g);
      drag.ghost = g;
    }
  }

  /** 표시를 지우고 포인터를 놓는다. 위치는 호출하는 쪽이 정한다 */
  function finish() {
    const d = drag;
    drag = null;
    if (d.frame) cancelAnimationFrame(d.frame);
    d.ghost?.remove();
    d.el.classList.remove('widget-dragging');
    d.el.style.transform = '';
    document.removeEventListener('keydown', onKeyDown);
    if (d.el.hasPointerCapture?.(d.pointerId)) d.el.releasePointerCapture(d.pointerId);
    return d;
  }

  /** 원위치 (4단계) */
  function cancel() {
    if (drag) finish();
  }

  function onPointerDown(e) {
    if (!isEditMode()) return;
    if (drag) {
      // 끄는 중에 다른 손가락이 닿으면(핀치 시작) 원위치
      if (e.pointerId !== drag.pointerId) cancel();
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = e.target.closest?.('.widget');
    if (!el || !stageEl.contains(el)) {
      onSelect(null);
      return;
    }
    const id = el.dataset.id;
    const widget = getModel().widgets.get(id);
    if (!widget) return;
    const scale = getScale();
    if (!(scale > 0)) return;
    e.preventDefault();
    onSelect(id);
    el.setPointerCapture?.(e.pointerId);
    drag = {
      id,
      el,
      kind: e.target.closest('.resize-handle') ? 'resize' : 'move',
      pointerId: e.pointerId,
      start: { x: e.clientX, y: e.clientY },
      pointer: { x: e.clientX, y: e.clientY },
      rect: { x: widget.x, y: widget.y, w: widget.w, h: widget.h },
      scale,
      snap: Boolean(getSnap()),
      moved: false,
      frame: 0,
      ghost: null,
    };
    document.addEventListener('keydown', onKeyDown);
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.pointer = { x: e.clientX, y: e.clientY };
    if (!drag.moved) {
      const dist = Math.hypot(e.clientX - drag.start.x, e.clientY - drag.start.y);
      if (dist < MOVE_THRESHOLD) return;
      drag.moved = true;
      startVisuals();
    }
    if (!drag.frame) drag.frame = requestAnimationFrame(paint);
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.moved) {
      finish(); // 5px 미만: 선택만
      return;
    }
    const next = rectFor({ x: e.clientX, y: e.clientY });
    const d = finish();
    if (sameRect(next, d.rect)) return;
    Object.assign(d.el.style, {
      left: `${next.x}px`,
      top: `${next.y}px`,
      width: `${next.w}px`,
      height: `${next.h}px`,
    });
    onCommit({
      type: 'updateWidgets',
      before: [{ id: d.id, ...d.rect }],
      after: [{ id: d.id, ...next }],
    });
  }

  function onPointerCancel(e) {
    if (drag && e.pointerId === drag.pointerId) cancel();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') cancel();
  }

  stageEl.addEventListener('pointerdown', onPointerDown);
  stageEl.addEventListener('pointermove', onPointerMove);
  stageEl.addEventListener('pointerup', onPointerUp);
  stageEl.addEventListener('pointercancel', onPointerCancel);
  stageEl.addEventListener('lostpointercapture', onPointerCancel);

  return function dispose() {
    cancel();
    stageEl.removeEventListener('pointerdown', onPointerDown);
    stageEl.removeEventListener('pointermove', onPointerMove);
    stageEl.removeEventListener('pointerup', onPointerUp);
    stageEl.removeEventListener('pointercancel', onPointerCancel);
    stageEl.removeEventListener('lostpointercapture', onPointerCancel);
  };
}
