// 타임라인 화면 (요구사항 1.4, 1.9, 10.1~10.13, 16.1~16.7)
// 사건(TimelineEvent)을 sortKey 순서의 세로 목록으로 보여 준다.
// 글·인물·회차 변경은 사건마다 recordAutosaves로 저장한다. sortKey는 패치에 넣지 않는다.
// ↑/↓는 swapTimeline → 메모리 반영 → 목록 다시 그리기 → saveTimelineOrder 순서다.
// 위치 키가 패치에 없으므로 대기 중인 글 저장과 순서 저장은 서로 덮어쓰지 않는다.
// 다시 그릴 때 입력란은 메모리의 events 값(입력할 때마다 같이 갱신)으로 채우므로 입력 중인 글이 남는다.
// 화면을 떠날 때 저장은 라우터의 flushAll()이 하고, 정리 함수는 dispose만 한다.
import '../styles/timeline.css';

import { listCharacters } from '../db/characters.js';
import { listEpisodes } from '../db/episodes.js';
import {
  createTimelineEvent,
  deleteTimelineEvent,
  listTimelineEvents,
  saveTimelineOrder,
  updateTimelineEvent,
} from '../db/timeline.js';
import { UNTITLED_EPISODE } from '../config.js';
import { confirmDialog, h, toast } from '../lib/dom.js';
import { moveFlags } from '../lib/plot.js';
import { sortTimeline, swapTimeline } from '../lib/timeline.js';
import { formatHash } from '../router.js';
import { characterPicker } from './parts/character-picker.js';
import { recordAutosaves } from './parts/record-autosaves.js';

const UNTITLED_EVENT = '제목 없는 사건';
const EMPTY_TEXT = '아직 사건이 없습니다. 첫 사건을 만들어 시간 흐름을 적어 보세요.';
const NO_EPISODE = '연결 없음';

// 메모리에서 지켜야 하는 입력 필드 (DB에서 다시 읽을 때 sortKey만 DB 값을 쓴다)
const TEXT_KEYS = ['storyDateLabel', 'title', 'description', 'characterIds', 'episodeId'];

const episodeLabel = (ep) => {
  const title = String(ep.title ?? '').trim() || UNTITLED_EPISODE;
  return `${ep.number}화 ${title}`;
};

export async function render(el, route) {
  const { projectId } = route;

  const [initialEvents, episodes, characters] = await Promise.all([
    listTimelineEvents(projectId),
    listEpisodes(projectId), // number 오름차순
    listCharacters(projectId),
  ]);

  let disposed = false;
  let creating = false;
  /** 메모리의 사건 목록. 항상 sortTimeline 순서 */
  let events = initialEvents.map((e) => ({ ...e, characterIds: [...(e.characterIds ?? [])] }));
  /** 순서 저장을 한 줄로 세워 먼저 누른 것이 먼저 저장되게 한다 */
  let orderChain = Promise.resolve();

  const episodeById = new Map(episodes.map((ep) => [ep.id, ep]));

  // ── 저장 상태 표시 ──
  const indicator = h('span', { class: 'save-indicator', 'aria-live': 'polite' });
  const autosaves = recordAutosaves({
    save: (id, patch) => updateTimelineEvent(id, patch),
    indicator,
  });

  const listEl = h('ol', { class: 'tl-list' });
  const emptyEl = h(
    'div',
    { class: 'tl-empty' },
    h('p', { class: 'tl-empty-text' }, EMPTY_TEXT),
    h('button', { type: 'button', class: ['btn', 'btn-primary'], onclick: () => addEvent() }, '새 사건 만들기'),
  );

  const findEvent = (id) => events.find((e) => e.id === id);

  /** 입력 변경: 메모리 반영 + 그 사건의 Autosave 예약 */
  function change(id, patch) {
    const event = findEvent(id);
    if (event) Object.assign(event, patch);
    autosaves.schedule(id, patch);
  }

  // ── 사건 줄 ──
  function buildRow(event, index) {
    const { id } = event;
    const fid = (name) => `tl-${id}-${name}`;
    const { up, down } = moveFlags(index, events.length);

    const dateInput = h('input', {
      type: 'text',
      id: fid('date'),
      class: 'tl-date',
      value: event.storyDateLabel ?? '',
      placeholder: '예: 3년 전 봄',
      autocomplete: 'off',
      oninput: () => change(id, { storyDateLabel: dateInput.value }),
    });

    const titleInput = h('input', {
      type: 'text',
      id: fid('title'),
      class: 'tl-title',
      value: event.title ?? '',
      placeholder: UNTITLED_EVENT,
      autocomplete: 'off',
      oninput: () => change(id, { title: titleInput.value }),
    });

    const descInput = h('textarea', { id: fid('desc'), class: 'tl-desc', rows: 3 });
    descInput.value = event.description ?? '';
    descInput.addEventListener('input', () => change(id, { description: descInput.value }));

    const picker = characterPicker({
      characters,
      selectedIds: event.characterIds ?? [],
      onChange: (ids) => change(id, { characterIds: [...ids] }),
    });

    // 회차: "연결 없음" + number 오름차순. 옆에 연결된 회차 상세 링크
    const episodeSelect = h(
      'select',
      { id: fid('episode') },
      h('option', { value: '' }, NO_EPISODE),
      episodes.map((ep) => h('option', { value: ep.id }, episodeLabel(ep))),
    );
    episodeSelect.value = episodeById.has(event.episodeId) ? event.episodeId : '';
    const episodeLinkSlot = h('span', { class: 'tl-episode-link-slot' });
    const drawEpisodeLink = (episodeId) => {
      const ep = episodeById.get(episodeId);
      // replaceChildren(null)은 "null" 글자 노드를 넣으므로 연결이 없으면 인자 없이 비운다
      if (!ep) {
        episodeLinkSlot.replaceChildren();
        return;
      }
      episodeLinkSlot.replaceChildren(
        h(
          'a',
          { class: 'tl-episode-link', href: formatHash({ name: 'episode', projectId, episodeId: ep.id }) },
          `${episodeLabel(ep)} 열기`,
        ),
      );
    };
    drawEpisodeLink(event.episodeId);
    episodeSelect.addEventListener('change', () => {
      const episodeId = episodeSelect.value || null;
      change(id, { episodeId });
      drawEpisodeLink(episodeId);
    });

    const upBtn = h(
      'button',
      {
        type: 'button',
        class: 'btn',
        'aria-label': '위로',
        disabled: !up,
        onclick: () => move(id, -1),
      },
      '↑',
    );
    const downBtn = h(
      'button',
      {
        type: 'button',
        class: 'btn',
        'aria-label': '아래로',
        disabled: !down,
        onclick: () => move(id, 1),
      },
      '↓',
    );
    const deleteBtn = h(
      'button',
      { type: 'button', class: ['btn', 'tl-delete'], onclick: () => remove(id) },
      '삭제',
    );

    const field = (name, label, control) =>
      h('div', { class: ['tl-field', `tl-field-${name}`] }, h('label', { for: fid(name) }, label), control);

    const li = h(
      'li',
      { class: 'tl-event', dataset: { id } },
      h(
        'div',
        { class: 'tl-row' },
        field('date', '작중 날짜', dateInput),
        field('title', '제목', titleInput),
      ),
      field('desc', '설명', descInput),
      h('div', { class: 'tl-field' }, h('span', { class: 'tl-label' }, '인물'), picker),
      h(
        'div',
        { class: 'tl-field' },
        h('label', { for: fid('episode') }, '연결 회차'),
        h('div', { class: 'tl-episode' }, episodeSelect, episodeLinkSlot),
      ),
      h('div', { class: 'tl-actions' }, upBtn, downBtn, deleteBtn),
    );

    return { li, focusables: { title: titleInput, up: upBtn, down: downBtn, delete: deleteBtn } };
  }

  /**
   * 목록만 다시 그린다. focus = { id, key } 이면 그 줄의 그 요소에 초점을 돌려놓는다.
   * key가 'up'·'down'인데 비활성이면 반대쪽 버튼으로 보낸다.
   */
  function renderList(focus = null) {
    if (disposed) return;
    emptyEl.hidden = events.length > 0;
    listEl.hidden = events.length === 0;
    let target = null;
    const rows = events.map((event, index) => {
      const row = buildRow(event, index);
      if (focus && focus.id === event.id) {
        const f = row.focusables;
        target = f[focus.key] ?? null;
        if (target?.disabled) target = focus.key === 'up' ? f.down : f.up;
        if (target?.disabled) target = f.delete;
      }
      return row.li;
    });
    listEl.replaceChildren(...rows);
    if (target) target.focus();
  }

  /** 순서 저장에 실패하면 DB의 순서로 되돌린다. 입력 중인 글은 메모리 값을 지킨다 */
  async function reloadOrder() {
    try {
      const fresh = await listTimelineEvents(projectId);
      if (disposed) return;
      const memory = new Map(events.map((e) => [e.id, e]));
      events = sortTimeline(
        fresh.map((f) => {
          const m = memory.get(f.id);
          if (!m) return { ...f, characterIds: [...(f.characterIds ?? [])] };
          const kept = Object.fromEntries(TEXT_KEYS.map((k) => [k, m[k]]));
          return { ...f, ...kept };
        }),
      );
      renderList();
    } catch (err) {
      console.error(err);
    }
  }

  // ── ↑/↓ ──
  function move(id, direction) {
    if (disposed) return;
    const index = events.findIndex((e) => e.id === id);
    const updates = swapTimeline(events, index, direction);
    if (updates.length === 0) return;
    const keyById = new Map(updates.map((u) => [u.id, u.sortKey]));
    events = sortTimeline(
      events.map((e) => (keyById.has(e.id) ? { ...e, sortKey: keyById.get(e.id) } : e)),
    );
    renderList({ id, key: direction < 0 ? 'up' : 'down' });
    orderChain = orderChain.then(async () => {
      try {
        await saveTimelineOrder(updates);
      } catch (err) {
        console.error(err);
        if (disposed) return;
        toast('순서를 저장하지 못했습니다');
        await reloadOrder();
      }
    });
  }

  // ── 새 사건: 끝에 추가하고 제목에 초점 ──
  async function addEvent() {
    if (creating || disposed) return;
    creating = true;
    try {
      // 대기 중인 순서 저장이 끝난 뒤 만들어야 nextSortKey가 맞다
      await orderChain;
      const event = await createTimelineEvent(projectId);
      if (disposed) return;
      events = sortTimeline([...events, { ...event, characterIds: [...event.characterIds] }]);
      renderList({ id: event.id, key: 'title' });
    } catch (err) {
      console.error(err);
      if (!disposed) toast('사건을 만들지 못했습니다');
    } finally {
      creating = false;
    }
  }

  // ── 삭제 ──
  async function remove(id) {
    const event = findEvent(id);
    if (!event || disposed) return;
    const title = String(event.title ?? '').trim() || UNTITLED_EVENT;
    const ok = await confirmDialog({
      title: '사건 삭제',
      message: `"${title}" 사건을 삭제할까요? 삭제하면 되돌릴 수 없습니다.`,
    });
    if (!ok || disposed) return;
    try {
      await autosaves.forget(id);
      await deleteTimelineEvent(id);
      if (disposed) return;
      const index = events.findIndex((e) => e.id === id);
      events = events.filter((e) => e.id !== id);
      // 초점은 다음 사건(없으면 앞 사건)의 삭제 버튼으로
      const next = events[Math.min(index, events.length - 1)];
      renderList(next ? { id: next.id, key: 'delete' } : null);
      if (!next) newBtn.focus();
    } catch (err) {
      console.error(err);
      if (!disposed) toast('사건을 삭제하지 못했습니다');
    }
  }

  const newBtn = h(
    'button',
    { type: 'button', class: ['btn', 'btn-primary'], onclick: () => addEvent() },
    '새 사건',
  );

  el.replaceChildren(
    h(
      'section',
      { class: 'timeline' },
      h(
        'header',
        { class: 'tl-header' },
        h('h1', { class: 'screen-title' }, '타임라인'),
        h('div', { class: 'tl-header-actions' }, indicator, newBtn),
      ),
      emptyEl,
      listEl,
    ),
  );
  renderList();

  // 라우터가 flushAll()을 끝낸 뒤 부른다
  return () => {
    disposed = true;
    autosaves.disposeAll();
  };
}
