// lib/calendar.js
// 월간 페이지·달력 위젯·에피소드 카드가 쓰는 순수 함수. 입력을 바꾸지 않는다.
// month는 'YYYY-MM', 날짜는 'YYYY-MM-DD' 문자열, 날짜 메모 키는 'DD'(두 자리) 문자열이다.
import { CALENDAR_MEMO_MAX } from '../config.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const pad2 = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM' 형식이고 월이 01~12이면 true */
export function isValidMonth(value) {
  return typeof value === 'string' && MONTH_RE.test(value);
}

/** month에서 n달 이동한 'YYYY-MM'. addMonths('2027-12', 1) → '2028-01' */
export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + n;
  const year = Math.floor(index / 12);
  return `${String(year).padStart(4, '0')}-${pad2(index - year * 12 + 1)}`;
}

/** 기기 지역 날짜 기준 'YYYY-MM' */
export function currentMonth(date = new Date()) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad2(date.getMonth() + 1)}`;
}

/** '2027-03' → '2027년 3월' */
export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return `${y}년 ${m}월`;
}

/** 그 달 일수 */
function daysInMonth(year, month1) {
  return new Date(year, month1, 0).getDate();
}

/**
 * 일요일 시작 7열 달력 칸. 날짜 칸은 1~말일 숫자, 앞뒤 빈칸은 null.
 * 길이는 7의 배수다.
 */
export function monthGrid(month) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay(); // 일요일 = 0
  const cells = Array(first).fill(null);
  const days = daysInMonth(y, m);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * publishDate가 month에 속한 Episode를 날짜별로 모은다.
 * 결과는 { 'DD': Episode[] }, 날짜 안에서는 number 오름차순.
 */
export function episodesByDay(episodes, month) {
  const prefix = `${month}-`;
  const byDay = {};
  for (const ep of episodes) {
    const date = ep.publishDate;
    if (typeof date !== 'string' || !date.startsWith(prefix)) continue;
    const day = date.slice(prefix.length);
    if (!/^\d{2}$/.test(day)) continue;
    (byDay[day] ??= []).push(ep);
  }
  for (const list of Object.values(byDay)) list.sort((a, b) => a.number - b.number);
  return byDay;
}

/**
 * 날짜 메모를 바꾼 새 메모 객체. 앞뒤 공백을 빼고 CALENDAR_MEMO_MAX자까지 자른다.
 * 빈 값이면 그 날짜 키를 뺀다. day는 'DD' 또는 숫자.
 */
export function setDayMemo(memos, day, text) {
  const key = pad2(day);
  const next = { ...(memos ?? {}) };
  let value = String(text ?? '').trim();
  if (value.length > CALENDAR_MEMO_MAX) {
    value = value.slice(0, CALENDAR_MEMO_MAX);
    // 이모지 같은 서로게이트 쌍이 반으로 잘리지 않게 한다
    const last = value.charCodeAt(value.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) value = value.slice(0, -1);
  }
  if (value === '') delete next[key];
  else next[key] = value;
  return next;
}

/**
 * Next_Episode: status가 published가 아니고 publishDate ≥ today인 Episode 중
 * (publishDate, number)가 가장 작은 것. 없으면 null. today는 'YYYY-MM-DD'.
 */
export function nextEpisode(episodes, today) {
  let best = null;
  for (const ep of episodes) {
    if (ep.status === 'published') continue;
    if (typeof ep.publishDate !== 'string' || ep.publishDate < today) continue;
    if (
      best === null ||
      ep.publishDate < best.publishDate ||
      (ep.publishDate === best.publishDate && ep.number < best.number)
    ) {
      best = ep;
    }
  }
  return best;
}
