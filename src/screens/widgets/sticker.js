// 스티커 위젯: 앱에 든 스티커 팩(lib/sticker-pack.js)의 그림 하나를 위젯 크기에 맞춰 보인다.
// data: { stickerId }  // 팩의 id. Asset이 아니다
// 레코드의 rotation(0 이상 360 미만)을 svg 회전으로 그린다. 회전 버튼은 도구 막대가 맡는다.
//
// SVG는 document.createElementNS로만 만들고, sanitizeShape(lib/stickers.js)를 거친 도형만 그린다.
// 보기 모드에서 누를 것은 없다. 이동·크기·삭제·순서는 page-screen의 틀 코드가 맡는다.
import { h, pickerDialog } from '../../lib/dom.js';
import { getSticker, stickerList, sanitizeShape } from '../../lib/stickers.js';
import { normalizeRotation } from '../../lib/geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export const label = '스티커';

export function defaults() {
  return { style: {}, data: { stickerId: null } };
}

/** Sticker_Picker. 고른 { stickerId } 또는 null(닫음) */
export async function pick() {
  const id = await pickerDialog({
    title: '스티커 고르기',
    items: stickerList().map((s) => ({ value: s.id, label: s.label, render: () => stickerSvg(s) })),
  });
  return id ? { stickerId: id } : null;
}

// sanitizeShape를 거친 객체만 받는다
function buildShape(shape) {
  const el = document.createElementNS(SVG_NS, shape.tag);
  for (const [k, v] of Object.entries(shape.attrs)) el.setAttribute(k, String(v));
  for (const child of shape.children ?? []) el.append(buildShape(child));
  return el;
}

/** 스티커 하나를 <svg>로. 비율은 viewBox와 xMidYMid meet로 지킨다 */
export function stickerSvg(sticker) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const viewBox = typeof sticker?.viewBox === 'string' ? sticker.viewBox : '0 0 100 100';
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('sticker-svg');
  const shapes = Array.isArray(sticker?.shapes) ? sticker.shapes : [];
  svg.append(...shapes.map(sanitizeShape).filter(Boolean).map(buildShape));
  return svg;
}

function readStickerId(widget) {
  const id = widget?.data?.stickerId;
  return typeof id === 'string' && id ? id : null;
}

export function render(el, ctx) {
  let shownId;
  let svg = null;

  function applyRotation(widget) {
    if (svg) svg.style.transform = `rotate(${normalizeRotation(widget?.rotation)}deg)`;
  }

  function draw(widget) {
    const id = readStickerId(widget);
    shownId = id;
    const sticker = id ? getSticker(id) : null;
    if (!sticker) {
      svg = null;
      el.dataset.missing = 'true';
      el.replaceChildren(h('div', { class: 'sticker-missing' }, '없는 스티커'));
      return;
    }
    delete el.dataset.missing;
    svg = stickerSvg(sticker);
    applyRotation(widget);
    el.replaceChildren(svg);
  }

  el.classList.add('sticker-content');
  draw(ctx.widget);

  return {
    update(widget) {
      if (readStickerId(widget) !== shownId) draw(widget);
      else applyRotation(widget);
    },
    dispose() {
      el.classList.remove('sticker-content');
      delete el.dataset.missing;
      svg = null;
      el.replaceChildren();
    },
  };
}
