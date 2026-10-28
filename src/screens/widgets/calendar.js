// 월간 달력 위젯: 일요일부터 7열 달력, 칸마다 그날 발행일인 회차 "N화" (요구 12.1~12.8, 26.6).
// data: { month: 'YYYY-MM', memos: { 'DD': string } }
//   month: Monthly_Page면 page.month를 쓰고 data.month는 보지 않는다(12.2).
//          다른 Page면 data.month, 없거나 잘못됐으면 이번 달(12.3. 만들 때 defaults가 저장한다).
//   memos: 날짜 메모. Monthly_Page여도 메모는 이 Widget의 data.memos에 둔다(12.11).
// Episode는 ctx.episodes(Current_Project의 Episode만, 화면을 열 때 읽음)를 그릴 때마다 쓴다(12.6, 26.6).
// 칸 누르기(보기 모드): Episode 1개면 상세, 2개 이상이면 choiceDialog로 고른 뒤 상세(12.7, 12.8),
//   0개면 메모 입력(12.9). 길게 누르기(LONG_PRESS_MS, 10px 넘게 움직이면 취소)는 항상 메모(12.10).
// 메모 저장은 setDayMemo(40자, 빈 값이면 키 삭제, 12.11·12.12) → ctx.saveContent({ data }).
// 메모 글자는 textContent로만 넣는다.
import { h, choiceDialog, promptDialog } from '../../lib/dom.js';
import { isValidMonth, currentMonth, monthLabel, monthGrid, episodesByDay, setDayMemo } from '../../lib/calendar.js';
import { UNTITLED_EPISODE, LONG_PRESS_MS, CALENDAR_MEMO_MAX } from '../../config.js';

const MOVE_CANCEL_PX = 10;

export const label = '월간 달력';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function defaults() {
  return { style: {}, data: { month: currentMonth(), memos: {} } };
}

/** 이 위젯이 보여 줄 month */
export function resolveMonth(page, widget) {
  if (page?.kind === 'monthly' && isValidMonth(page.month)) return page.month;
  const month = widget?.data?.month;
  return isValidMonth(month) ? month : currentMonth();
}

const pad2 = (n) => String(n).padStart(2, '0');

function episodeTitle(ep) {
  const title = typeof ep.title === 'string' ? ep.title.trim() : '';
  return title || UNTITLED_EPISODE;
}

export function render(el, ctx) {
  const isView = () => ctx.getMode() === 'view';
  let byDay = {};
  let memos = {};
  let choosing = false; // 선택 창이나 메모 창이 열려 있는 동안 true
  let press = null; // 길게 누르기 대기: { timer, pointerId, x, y }
  let suppressClick = false; // 길게 누르기가 메모를 연 뒤 따라오는 click 하나를 버린다

  const title = h('div', { class: 'cal-title' });
  const head = h(
    'div',
    { class: 'cal-head', 'aria-hidden': 'true' },
    WEEKDAYS.map((d, i) => h('div', { class: ['cal-weekday', i === 0 ? 'is-sun' : null, i === 6 ? 'is-sat' : null] }, d)),
  );
  const grid = h('div', { class: 'cal-grid' });

  async function editMemo(day) {
    if (!isView() || choosing) return;
    const key = pad2(day);
    choosing = true;
    let text;
    try {
      text = await promptDialog({
        title: `${day}일 메모`,
        value: memos[key] ?? '',
        maxLength: CALENDAR_MEMO_MAX,
      });
    } finally {
      choosing = false;
    }
    if (text == null) return;
    const widget = ctx.widget;
    const data = widget?.data ?? {};
    const current = data.memos && typeof data.memos === 'object' ? data.memos : {};
    const next = setDayMemo(current, key, text);
    if ((current[key] ?? '') === (next[key] ?? '')) return;
    ctx.saveContent({ data: { ...data, memos: next } });
    draw(ctx.widget);
  }

  function cancelPress() {
    if (press) clearTimeout(press.timer);
    press = null;
  }

  function onPointerDown(event, day) {
    suppressClick = false;
    cancelPress();
    if (!isView() || choosing) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const start = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    start.timer = setTimeout(() => {
      press = null;
      if (!isView() || choosing) return;
      suppressClick = true;
      editMemo(day);
    }, LONG_PRESS_MS);
    press = start;
  }

  function onPointerMove(event) {
    if (!press || event.pointerId !== press.pointerId) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_CANCEL_PX) cancelPress();
  }

  function onPointerEnd(event) {
    if (press && event.pointerId === press.pointerId) cancelPress();
  }

  function onClick(day) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    onDayPress(day);
  }

  async function onDayPress(day) {
    if (!isView() || choosing) return;
    const list = byDay[pad2(day)] ?? [];
    if (list.length === 0) {
      editMemo(day);
      return;
    }
    let episodeId = list[0].id;
    if (list.length > 1) {
      choosing = true;
      try {
        episodeId = await choiceDialog({
          title: `${day}일 회차`,
          options: list.map((ep) => ({ value: ep.id, label: `${ep.number}화 · ${episodeTitle(ep)}` })),
        });
      } finally {
        choosing = false;
      }
      if (episodeId == null) return;
    }
    ctx.open({ name: 'episode', projectId: ctx.projectId, episodeId });
  }

  function makeDay(day, month, column) {
    const list = byDay[pad2(day)] ?? [];
    const chips = list.map((ep) =>
      h(
        'span',
        {
          class: ['cal-ep', ep.status === 'published' ? 'is-published' : 'is-planned'],
          title: episodeTitle(ep),
        },
        `${ep.number}화`,
      ),
    );
    const memo = typeof memos[pad2(day)] === 'string' ? memos[pad2(day)] : '';
    let memoEl = null;
    if (memo) {
      memoEl = h('span', { class: 'cal-memo' });
      memoEl.textContent = memo;
      memoEl.title = memo;
    }
    const desc = [
      ...list.map((ep) => `${ep.number}화${ep.status === 'published' ? ' 발행됨' : ''}`),
      memo ? `메모 ${memo}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    return h(
      'button',
      {
        type: 'button',
        class: [
          'cal-day',
          column === 0 ? 'is-sun' : null,
          column === 6 ? 'is-sat' : null,
          `${month}-${pad2(day)}` === ctx.today ? 'is-today' : null,
          list.length > 0 ? 'has-ep' : null,
          memo ? 'has-memo' : null,
        ],
        dataset: { day: pad2(day) },
        'aria-label': desc ? `${day}일, ${desc}` : `${day}일`,
        onclick: () => onClick(day),
        onpointerdown: (event) => onPointerDown(event, day),
        onpointermove: onPointerMove,
        onpointerup: onPointerEnd,
        onpointercancel: onPointerEnd,
        onpointerleave: onPointerEnd,
        // 보기 모드에서 Android 길게 누르기 메뉴가 뜨지 않게 한다
        oncontextmenu: (event) => {
          if (isView()) event.preventDefault();
        },
      },
      h('span', { class: 'cal-num' }, String(day)),
      chips.length > 0 ? h('span', { class: 'cal-eps' }, chips) : null,
      memoEl,
    );
  }

  function draw(widget) {
    const month = resolveMonth(ctx.page, widget);
    byDay = episodesByDay(Array.isArray(ctx.episodes) ? ctx.episodes : [], month);
    const m = widget?.data?.memos;
    memos = m && typeof m === 'object' ? m : {};
    cancelPress();
    title.textContent = monthLabel(month);
    const cells = monthGrid(month).map((day, i) =>
      day === null ? h('div', { class: 'cal-day is-blank', 'aria-hidden': 'true' }) : makeDay(day, month, i % 7),
    );
    grid.replaceChildren(...cells);
  }

  el.classList.add('widget-calendar');
  el.replaceChildren(title, head, grid);
  draw(ctx.widget);

  return {
    update(widget) {
      draw(widget);
    },
    dispose() {
      cancelPress();
      el.classList.remove('widget-calendar');
      byDay = {};
      memos = {};
      el.replaceChildren();
    },
  };
}
