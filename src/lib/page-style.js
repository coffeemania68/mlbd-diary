// 페이지 배경(무늬·색) 정리. DOM을 쓰지 않는다.
// Page.background는 { pattern, color } 또는 null. 값이 없거나 이상하면 읽을 때 여기서 정리한다.

import { PAGE_PATTERNS, PAGE_BG_COLORS } from '../config.js';

const PATTERN_IDS = new Set(PAGE_PATTERNS.map((p) => p.id));
const COLOR_VALUES = new Set(PAGE_BG_COLORS.map((c) => c.value).filter((v) => v !== null));

/**
 * 어떤 값이든 { pattern, color }로. pattern이 PAGE_PATTERNS id가 아니면 'plain',
 * color가 PAGE_BG_COLORS의 null 아닌 value가 아니면 null(테마 종이색). 멱등
 */
export function normalizeBackground(bg) {
  const src = bg && typeof bg === 'object' ? bg : {};
  const pattern = typeof src.pattern === 'string' && PATTERN_IDS.has(src.pattern) ? src.pattern : 'plain';
  const color = typeof src.color === 'string' && COLOR_VALUES.has(src.color) ? src.color : null;
  return { pattern, color };
}

/** 화면용: { pattern, colorCss }. color가 null이면 테마 종이색 변수 */
export function backgroundView(bg) {
  const { pattern, color } = normalizeBackground(bg);
  return { pattern, colorCss: color ?? 'var(--page-paper)' };
}
