// 에피소드 목록 화면 (요구사항 2.1~2.12, 16.4~16.7).
// 머리(제목, 비축분 N편, 새 에피소드) + 상태 필터 버튼 6개 + 5열 표.
// 필터를 바꾸면 표만 다시 그린다. 선택값은 화면 변수라 새로 열면 "전체"로 돌아간다.
// 목록 화면이라 Autosave가 없다. 정리 함수는 disposed만 표시한다.
import '../styles/episodes.css';
import { listEpisodes, createEpisode } from '../db/episodes.js';
import { reserveCount, filterEpisodesByStatus, statusLabel, formatChars } from '../lib/episodes.js';
import { EPISODE_STATUSES, UNTITLED_EPISODE } from '../config.js';
import { h, toast } from '../lib/dom.js';
import { formatHash, navigate } from '../router.js';

const TITLE = '에피소드';
const EMPTY_TEXT = '아직 에피소드가 없습니다';
const EMPTY_FILTER_TEXT = '이 상태의 에피소드가 없습니다';
const NO_DATE = '-';
const ALL = 'all';

/** 필터 버튼 6개: 전체 + 상태 5개 */
const FILTERS = [{ id: ALL, label: '전체' }, ...EPISODE_STATUSES.map((s) => ({ id: s.id, label: s.label }))];

/** 표 열. data-label은 휴대폰 카드에서 ::before로 보이는 고정 라벨이다 */
const COLUMNS = [
  { key: 'number', label: '회차' },
  { key: 'title', label: '제목' },
  { key: 'status', label: '상태' },
  { key: 'chars', label: '글자수' },
  { key: 'date', label: '발행일' },
];

export async function render(el, route) {
  const { projectId } = route;
  let disposed = false;
  let status = ALL;

  async function onCreate(event) {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const episode = await createEpisode(projectId);
      if (disposed) return;
      navigate({ name: 'episode', projectId, episodeId: episode.id });
    } catch (err) {
      console.error(err);
      toast('에피소드를 만들지 못했습니다');
      button.disabled = false;
    }
  }

  const newButton = () =>
    h('button', { type: 'button', class: ['btn', 'btn-primary'], onclick: onCreate }, '새 에피소드');

  // listEpisodes는 이미 number → createdAt 순으로 정렬해 돌려준다 (sortEpisodes)
  const episodes = await listEpisodes(projectId);
  if (disposed) return cleanup;

  // 비축분은 필터와 관계없이 전체 목록으로 계산한다 (요구사항 2.5, 2.6)
  const head = h(
    'div',
    { class: 'ep-list-head' },
    h('h1', { class: 'screen-title' }, TITLE),
    h('p', { class: 'ep-reserve' }, `비축분 ${reserveCount(episodes)}편`),
    episodes.length > 0 ? newButton() : null,
  );

  // 에피소드가 하나도 없으면 표 대신 안내 문구 + 새 에피소드 버튼 (요구사항 2.11)
  if (episodes.length === 0) {
    el.replaceChildren(
      h(
        'section',
        { class: 'ep-list' },
        head,
        h('div', { class: 'ep-empty' }, h('p', { class: 'ep-empty-text' }, EMPTY_TEXT), newButton()),
      ),
    );
    return cleanup;
  }

  const bodyEl = h('div', { class: 'ep-table-wrap' });

  function cell(key, label, ...children) {
    return h('td', { class: `ep-col-${key}`, 'data-label': label }, ...children);
  }

  function row(ep) {
    const title = ep.title && ep.title.trim() ? ep.title : UNTITLED_EPISODE;
    return h(
      'tr',
      {},
      cell('number', COLUMNS[0].label, `${ep.number}화`),
      cell(
        'title',
        COLUMNS[1].label,
        // ::after가 행 전체를 덮어 행 어디를 눌러도 열린다 (요구사항 2.10)
        h(
          'a',
          {
            class: ['ep-link', title === UNTITLED_EPISODE ? 'is-empty' : null],
            href: formatHash({ name: 'episode', projectId, episodeId: ep.id }),
          },
          title,
        ),
      ),
      cell('status', COLUMNS[2].label, h('span', { class: ['ep-status', `ep-status-${ep.status}`] }, statusLabel(ep.status))),
      cell('chars', COLUMNS[3].label, formatChars(ep)),
      cell('date', COLUMNS[4].label, ep.publishDate || NO_DATE),
    );
  }

  /** 필터 버튼 눌림 상태와 표만 다시 그린다 */
  function drawTable() {
    for (const b of buttons) b.el.setAttribute('aria-pressed', b.id === status ? 'true' : 'false');
    const rows = filterEpisodesByStatus(episodes, status);
    if (rows.length === 0) {
      bodyEl.replaceChildren(h('p', { class: 'ep-empty-filter' }, EMPTY_FILTER_TEXT));
      return;
    }
    bodyEl.replaceChildren(
      h(
        'table',
        { class: 'ep-table' },
        h('thead', {}, h('tr', {}, ...COLUMNS.map((c) => h('th', { scope: 'col', class: `ep-col-${c.key}` }, c.label)))),
        h('tbody', {}, ...rows.map(row)),
      ),
    );
  }

  const buttons = FILTERS.map((f) => ({
    id: f.id,
    el: h(
      'button',
      {
        type: 'button',
        class: 'chip',
        'aria-pressed': 'false',
        onclick: () => {
          if (status === f.id) return;
          status = f.id;
          drawTable();
        },
      },
      f.label,
    ),
  }));

  drawTable();
  el.replaceChildren(
    h(
      'section',
      { class: 'ep-list' },
      head,
      h('div', { class: 'ep-filter', role: 'group', 'aria-label': '상태 필터' }, ...buttons.map((b) => b.el)),
      bodyEl,
    ),
  );

  return cleanup;

  function cleanup() {
    disposed = true;
  }
}
