// 에피소드 카드 위젯: Next_Episode 또는 고정 회차 (요구 1.5, 1.6, 6.4, 13.2, 13.3, 13.5, 13.6, 13.7).
// data: { mode: 'next' } 또는 { mode: 'fixed', episodeId }. mode가 없거나 모르는 값이면 'next'로 본다.
// 추가할 때 pick(ctx)이 Current_Project의 Episode를 DB에서 읽어 "다음 회차" + number 오름차순으로 고르게 한다(26.6).
// 그릴 때마다 ctx.episodes(page-screen이 화면을 열 때·이 위젯을 추가할 때 읽은 Current_Project Episode)를 쓴다.
//   next: nextEpisode(ctx.episodes, ctx.today). 없으면 "예정된 회차가 없습니다". 항상 "비축분 N편"
//   fixed: episodeId의 Episode. 없으면 "삭제된 항목", 눌러도 이동하지 않는다
// 보기 모드에서 누르면 보이는 회차의 Episode_Detail_Screen. 사용자 글자는 textContent로만 넣는다.
import { h, choiceDialog } from '../../lib/dom.js';
import { listEpisodes } from '../../db/episodes.js';
import { nextEpisode } from '../../lib/calendar.js';
import { reserveCount, statusLabel, formatChars } from '../../lib/episodes.js';
import { UNTITLED_EPISODE } from '../../config.js';

export const label = '에피소드 카드';

export const NEXT_VALUE = 'next';
export const DELETED_TEXT = '삭제된 항목';
export const NO_NEXT_TEXT = '예정된 회차가 없습니다';
export const NO_DATE_TEXT = '발행일 미정';

export function defaults() {
  return { style: {}, data: { mode: 'next' } };
}

export function episodeTitle(ep) {
  const title = typeof ep?.title === 'string' ? ep.title.trim() : '';
  return title || UNTITLED_EPISODE;
}

export function reserveText(episodes) {
  return `비축분 ${reserveCount(episodes)}편`;
}

/**
 * 카드가 보여 줄 것.
 *   { mode: 'next', episode: Episode | null }
 *   { mode: 'fixed', episode: Episode | null }   episode가 null이면 삭제된 항목
 */
export function resolveEpisodeCard(data, episodes, today) {
  const list = Array.isArray(episodes) ? episodes : [];
  if (data?.mode === 'fixed') {
    const id = data.episodeId;
    const episode = typeof id === 'string' && id ? (list.find((e) => e.id === id) ?? null) : null;
    return { mode: 'fixed', episode };
  }
  return { mode: 'next', episode: nextEpisode(list, today) };
}

export async function pick(ctx) {
  const list = await listEpisodes(ctx.projectId); // number 오름차순
  const value = await choiceDialog({
    title: '에피소드 카드',
    options: [
      { value: NEXT_VALUE, label: '다음 회차' },
      ...list.map((ep) => ({ value: ep.id, label: `${ep.number}화 · ${episodeTitle(ep)}` })),
    ],
  });
  if (value == null) return null;
  if (value === NEXT_VALUE) return { mode: 'next' };
  return { mode: 'fixed', episodeId: value };
}

export function render(el, ctx) {
  let current = null; // 지금 보이는 Episode, 없으면 null

  function onClick() {
    if (ctx.getMode() !== 'view' || !current) return;
    ctx.open({ name: 'episode', projectId: ctx.projectId, episodeId: current.id });
  }

  function episodeBody(ep) {
    const title = episodeTitle(ep);
    return [
      h(
        'span',
        { class: 'ecard-head' },
        h('span', { class: 'ecard-number' }, `${ep.number}화`),
        h('span', { class: ['ecard-title', title === UNTITLED_EPISODE ? 'is-empty' : null] }, title),
      ),
      h(
        'span',
        { class: 'ecard-meta' },
        h('span', { class: 'ecard-status', dataset: { status: String(ep.status ?? '') } }, statusLabel(ep.status)),
        h('span', { class: 'ecard-chars' }, `${formatChars(ep)}자`),
      ),
      h(
        'span',
        { class: 'ecard-date' },
        typeof ep.publishDate === 'string' && ep.publishDate ? `발행 예정 ${ep.publishDate}` : NO_DATE_TEXT,
      ),
    ];
  }

  function draw(widget) {
    const episodes = Array.isArray(ctx.episodes) ? ctx.episodes : [];
    const { mode, episode } = resolveEpisodeCard(widget?.data, episodes, ctx.today);
    current = episode;
    el.dataset.cardMode = mode;

    if (mode === 'fixed' && !episode) {
      el.dataset.deleted = 'true';
      el.replaceChildren(h('div', { class: 'card-deleted' }, DELETED_TEXT));
      return;
    }
    delete el.dataset.deleted;

    const parts = [
      mode === 'next' ? h('span', { class: 'ecard-label' }, '다음 회차') : null,
      ...(episode ? episodeBody(episode) : [h('span', { class: 'ecard-none' }, NO_NEXT_TEXT)]),
      mode === 'next' ? h('span', { class: 'ecard-reserve' }, reserveText(episodes)) : null,
    ];
    const box = episode
      ? h(
          'button',
          {
            type: 'button',
            class: 'card-btn ecard',
            'aria-label': `${episode.number}화 ${episodeTitle(episode)} 열기`,
            onclick: onClick,
          },
          parts,
        )
      : h('div', { class: 'ecard' }, parts);
    el.replaceChildren(box);
  }

  el.classList.add('widget-card', 'widget-episode-card');
  draw(ctx.widget);

  return {
    update(widget) {
      draw(widget);
    },
    dispose() {
      current = null;
      el.classList.remove('widget-card', 'widget-episode-card');
      delete el.dataset.deleted;
      delete el.dataset.cardMode;
      el.replaceChildren();
    },
  };
}
