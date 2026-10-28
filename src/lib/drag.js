// 플롯 카드 끌어 놓기 (Pointer Events). 터치·S Pen·마우스가 같은 경로를 탄다.
// 라이브러리와 HTML5 drag API는 쓰지 않는다(안드로이드 터치에서 동작하지 않음).
//
// 마크업 약속
//   - itemSelector 요소: data-id = 카드 id
//   - columnSelector 요소: data-section = 구간 번호(0부터)
//   - 손잡이(handleSelector)에만 CSS `touch-action: none`
//
// 이 모듈이 붙이는 클래스 (스타일은 plot.css에서 정한다)
//   - .dragging     끌고 있는 카드. 반투명 + `pointer-events: none`(elementFromPoint가 카드를 통과해야 한다)
//                   위치는 인라인 `transform: translate()`로 움직인다
//   - .drop-marker  놓일 자리를 보여 주는 가로 막대(div). 카드 사이에 끼워 넣으므로
//                   레이아웃 높이가 거의 없게 둔다(예: height 4px; margin -2px 0)

const EDGE = 40; // 가장자리 자동 스크롤 영역(px)
const SCROLL_STEP = 12; // 한 프레임에 미는 양(px)

/**
 * 놓일 위치. itemMidpoints는 열 안 카드들(끄는 카드 제외)의 세로 가운데, 화면 순서.
 * 가운데가 pointerY보다 아래인 첫 카드의 순번, 없으면 길이 → moveCard의 toIndex와 같은 기준.
 */
export function dropIndex(itemMidpoints, pointerY) {
  const i = itemMidpoints.findIndex((mid) => mid > pointerY);
  return i === -1 ? itemMidpoints.length : i;
}

/** pos가 [start, end]의 가장자리 edge 안이면 -step(앞쪽) 또는 step(뒤쪽), 아니면 0 */
export function edgeScrollDelta(pos, start, end, edge = EDGE, step = SCROLL_STEP) {
  if (pos < start + edge) return -step;
  if (pos > end - edge) return step;
  return 0;
}

/**
 * container 안의 끌기 손잡이(handleSelector)를 누르면 시작한다.
 * 놓는 순간 pointer 좌표로 elementFromPoint를 불러 가장 가까운 columnSelector 요소의 data-section과
 * dropIndex로 구한 순번을 onDrop({ itemId, toSection, toIndex })로 넘긴다.
 * 열 밖에 놓기·pointercancel·Escape는 표시만 지우고 onDrop을 부르지 않는다.
 * scrollerSelector: 가로 스크롤 열 영역(기본 '.plot-columns')
 * @returns 해제 함수 (정리 함수에서 부른다)
 */
export function enableDrag(
  container,
  { handleSelector, itemSelector, columnSelector, onDrop, scrollerSelector = '.plot-columns' },
) {
  let drag = null;

  function scrollOffsets() {
    const s = drag.scroller;
    return {
      x: window.scrollX + (s ? s.scrollLeft : 0),
      y: window.scrollY + (s ? s.scrollTop : 0),
    };
  }

  function columnAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    const column = hit?.closest(columnSelector);
    if (!column || !container.contains(column)) return null;
    const section = Number(column.dataset.section);
    return Number.isInteger(section) ? { column, section } : null;
  }

  function targetAt(x, y) {
    const found = columnAt(x, y);
    if (!found) return null;
    const items = [...found.column.querySelectorAll(itemSelector)].filter((el) => el !== drag.item);
    const mids = items.map((el) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    const index = dropIndex(mids, y);
    return { ...found, items, index };
  }

  function placeMarker(target) {
    if (!target) {
      drag.marker.remove();
      return;
    }
    const { column, items, index } = target;
    const before = items[index];
    if (before) before.before(drag.marker);
    else if (items.length) items[items.length - 1].after(drag.marker);
    else column.append(drag.marker);
  }

  function update() {
    const { x, y } = drag.pointer;
    const now = scrollOffsets();
    const dx = x - drag.start.x + (now.x - drag.startScroll.x);
    const dy = y - drag.start.y + (now.y - drag.startScroll.y);
    drag.item.style.transform = `translate(${dx}px, ${dy}px)`;
    placeMarker(targetAt(x, y));
  }

  function autoScroll() {
    if (!drag) return;
    const { x, y } = drag.pointer;
    let moved = false;
    const s = drag.scroller;
    if (s && s.scrollWidth > s.clientWidth) {
      const r = s.getBoundingClientRect();
      const dxs = edgeScrollDelta(x, r.left, r.right);
      if (dxs) {
        const before = s.scrollLeft;
        s.scrollBy(dxs, 0);
        moved ||= s.scrollLeft !== before;
      }
    }
    const dyw = edgeScrollDelta(y, 0, window.innerHeight);
    if (dyw) {
      const before = window.scrollY;
      window.scrollBy(0, dyw);
      moved ||= window.scrollY !== before;
    }
    if (moved) update();
    drag.frame = requestAnimationFrame(autoScroll);
  }

  function end() {
    if (!drag) return;
    const { item, handle, pointerId, frame, marker } = drag;
    drag = null;
    cancelAnimationFrame(frame);
    marker.remove();
    item.classList.remove('dragging');
    item.style.transform = '';
    if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
    document.removeEventListener('keydown', onKeyDown);
  }

  function onPointerDown(e) {
    if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const handle = e.target.closest?.(handleSelector);
    if (!handle || !container.contains(handle)) return;
    const item = handle.closest(itemSelector);
    if (!item) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const marker = document.createElement('div');
    marker.className = 'drop-marker';
    marker.setAttribute('aria-hidden', 'true');
    drag = {
      item,
      handle,
      marker,
      pointerId: e.pointerId,
      scroller: item.closest(scrollerSelector),
      start: { x: e.clientX, y: e.clientY },
      pointer: { x: e.clientX, y: e.clientY },
      frame: 0,
    };
    drag.startScroll = scrollOffsets();
    item.classList.add('dragging');
    document.addEventListener('keydown', onKeyDown);
    drag.frame = requestAnimationFrame(autoScroll);
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.pointer = { x: e.clientX, y: e.clientY };
    update();
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const target = targetAt(e.clientX, e.clientY);
    const itemId = drag.item.dataset.id;
    end();
    if (target && itemId) onDrop({ itemId, toSection: target.section, toIndex: target.index });
  }

  function onPointerCancel(e) {
    if (drag && e.pointerId === drag.pointerId) end();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') end();
  }

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerCancel);
  container.addEventListener('lostpointercapture', onPointerCancel);

  return function dispose() {
    end();
    container.removeEventListener('pointerdown', onPointerDown);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
    container.removeEventListener('pointercancel', onPointerCancel);
    container.removeEventListener('lostpointercapture', onPointerCancel);
  };
}
