// 스티커 조회와 도형 정리. DOM 없음.
// 화면은 sanitizeShape를 거친 도형만 SVG 요소로 만든다(screens/widgets/sticker.js).
import { STICKER_PACK } from './sticker-pack.js';

// 허용 요소. g만 children을 가진다.
export const SHAPE_TAGS = ['path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line', 'g'];
// 허용 속성. 이벤트(on*)·href·style 같은 속성은 없다.
export const SHAPE_ATTRS = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'points',
  'x1', 'y1', 'x2', 'y2', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width',
  'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'opacity', 'transform'];

const DANGEROUS = /url\(|javascript:|data:|https?:|href/i;

function safeValue(v) {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return !DANGEROUS.test(v);
  return false;
}

/** 허용 요소가 아니면 null. 허용 속성 중 값이 문자열·유한 수이고
 *  위험 문자열에 걸리지 않는 것만 남긴다. g만 children(재귀 정리)을 가진다 */
export function sanitizeShape(shape) {
  if (!shape || typeof shape !== 'object') return null;
  const { tag } = shape;
  if (typeof tag !== 'string' || !SHAPE_TAGS.includes(tag)) return null;
  const attrs = {};
  const src = shape.attrs;
  if (src && typeof src === 'object' && !Array.isArray(src)) {
    for (const [k, v] of Object.entries(src)) {
      if (SHAPE_ATTRS.includes(k) && safeValue(v)) attrs[k] = v;
    }
  }
  if (tag !== 'g') return { tag, attrs };
  const children = Array.isArray(shape.children)
    ? shape.children.map(sanitizeShape).filter(Boolean)
    : [];
  return { tag, attrs, children };
}

/** 팩에서 id로 찾는다. 없으면 null */
export function getSticker(id) {
  return STICKER_PACK.find((s) => s.id === id) ?? null;
}

/** 팩 전체(Sticker_Picker 순서) */
export function stickerList() {
  return STICKER_PACK.slice();
}
