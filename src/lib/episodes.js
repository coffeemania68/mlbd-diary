// lib/episodes.js
// 에피소드 목록·상세 화면이 쓰는 순수 함수. 입력을 바꾸지 않는다.
import { EPISODE_STATUSES } from '../config.js';

const RESERVE_IDS = new Set(EPISODE_STATUSES.filter((s) => s.reserve).map((s) => s.id));

/** number 오름차순, 같으면 createdAt 오름차순. 새 배열 */
export function sortEpisodes(episodes) {
  return [...episodes].sort((a, b) => a.number - b.number || a.createdAt - b.createdAt);
}

/** status가 EPISODE_STATUSES의 reserve: true인 Episode 수 */
export function reserveCount(episodes) {
  return episodes.filter((e) => RESERVE_IDS.has(e.status)).length;
}

/** status === 'all'이면 전체, 아니면 그 status만 */
export function filterEpisodesByStatus(episodes, status) {
  if (status === 'all') return [...episodes];
  return episodes.filter((e) => e.status === status);
}

/** max(number) + 1, 비면 1 */
export function nextEpisodeNumber(episodes) {
  if (episodes.length === 0) return 1;
  return Math.max(...episodes.map((e) => e.number)) + 1;
}

/** '12', ' 3 ' → { ok: true, value }. 소수·음수·빈 값·'1e3'·min 미만 → { ok: false } */
export function parseIntField(raw, min) {
  const text = String(raw ?? '').trim();
  if (!/^\d+$/.test(text)) return { ok: false };
  const value = Number(text);
  if (value < min) return { ok: false };
  return { ok: true, value };
}

/** 자기 자신(id)을 빼고 같은 number가 있으면 true */
export function isDuplicateNumber(episodes, id, number) {
  return episodes.some((e) => e.id !== id && e.number === number);
}

/** 앞뒤 공백 → 앞쪽 '#' 모두 → 다시 앞뒤 공백 제거 */
export function normalizeKeyword(raw) {
  let text = String(raw ?? '').trim();
  // '#' 제거 후 다시 공백을 지우면 그 뒤에 또 '#'이 나올 수 있어 멱등이 되도록 반복한다
  for (;;) {
    const next = text.replace(/^#+/, '').trim();
    if (next === text) return text;
    text = next;
  }
}

/** EPISODE_STATUSES label. 모르는 값은 그대로 */
export function statusLabel(status) {
  const found = EPISODE_STATUSES.find((s) => s.id === status);
  return found ? found.label : status;
}

/** `${actualChars} / ${targetChars}` */
export function formatChars(episode) {
  return `${episode.actualChars} / ${episode.targetChars}`;
}

/** <input type="date"> 값 → 'YYYY-MM-DD' 또는 null */
export function dateInputToValue(value) {
  const text = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}
