// 테마 결정. DOM을 쓰지 않는다(적용은 src/theme.js).
import { DEFAULT_THEME_ID, THEMES } from '../config.js';

/** 테마마다 vars에 두는 CSS 변수 이름. styles/base.css :root 변수와 같다 */
export const THEME_VAR_KEYS = Object.freeze([
  '--color-bg',
  '--color-surface',
  '--color-surface-alt',
  '--color-border',
  '--color-text',
  '--color-text-muted',
  '--color-accent',
  '--color-accent-strong',
  '--color-accent-soft',
  '--color-on-accent',
  '--color-focus',
  '--page-paper',
  '--page-line',
  '--font-body',
]);

/**
 * 같은 id의 테마. 없거나 null이면 DEFAULT_THEME_ID 테마, 그것도 없으면 첫 테마 (6.7, 13.4)
 * @param {string | null | undefined} id
 * @param {{ id: string, label: string, vars: Record<string, string> }[]} [themes]
 */
export function resolveTheme(id, themes = THEMES) {
  if (typeof id === 'string') {
    const found = themes.find((t) => t.id === id);
    if (found) return found;
  }
  return themes.find((t) => t.id === DEFAULT_THEME_ID) ?? themes[0];
}
