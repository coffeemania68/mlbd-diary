// 역할 필터와 역할 입력 상태 계산 (요구사항 10.4~10.7, 11.2, 11.3)
// 필터 선택값은 문자열이 아니라 { all: true } 또는 { role: '…' } 객체다.
// 사용자가 직접 입력 역할로 "전체"를 적어도 필터의 "전체"와 섞이지 않는다.
import { ROLE_PRESETS } from '../config.js';

export const ALL_ROLES = Object.freeze({ all: true });

export function isSameRoleOption(a, b) {
  if (!a || !b) return false;
  if (a.all || b.all) return Boolean(a.all) && Boolean(b.all);
  return a.role === b.role;
}

export function roleOptionLabel(option) {
  return option && option.all ? '전체' : option.role;
}

export function roleFilterView(characters, selected) {
  const used = new Set();
  for (const c of characters) {
    if (c.role) used.add(c.role);
  }
  const presets = ROLE_PRESETS.filter((r) => used.has(r));
  const customs = [...used]
    .filter((r) => !ROLE_PRESETS.includes(r))
    .sort((a, b) => a.localeCompare(b, 'ko'));
  const options = [ALL_ROLES, ...[...presets, ...customs].map((role) => ({ role }))];

  const found = options.find((o) => isSameRoleOption(o, selected));
  const current = found || ALL_ROLES;
  const visible = current.all
    ? [...characters]
    : characters.filter((c) => c.role === current.role);
  return { options, selected: current, visible };
}

export function roleToInput(role) {
  if (!role) return { choice: '', custom: '' };
  if (ROLE_PRESETS.includes(role)) return { choice: role, custom: '' };
  return { choice: 'custom', custom: role };
}

export function inputToRole({ choice, custom }) {
  if (choice === 'custom') return (custom || '').trim();
  return choice || '';
}
