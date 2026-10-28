// 테마 적용. 값과 결정은 lib/themes.js(resolveTheme)가 맡고, 여기서는 문서에 쓰기만 한다.
import { resolveTheme, THEME_VAR_KEYS } from './lib/themes.js';

/**
 * 테마 변수 14개를 <html> style에 쓰고 data-theme을 바꾼다 (6.2, 6.3, 6.7)
 * 없거나 모르는 id는 기본 테마로 읽는다.
 * @param {string | null | undefined} id
 * @returns {{ id: string, label: string, vars: Record<string, string> }}
 */
export function applyTheme(id) {
  const theme = resolveTheme(id);
  const root = document.documentElement;
  for (const key of THEME_VAR_KEYS) {
    const value = theme.vars[key];
    if (typeof value === 'string') root.style.setProperty(key, value);
  }
  root.dataset.theme = theme.id;
  return theme;
}
