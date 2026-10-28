// 플롯 화면 (요구사항 8.1~8.11, 9.1~9.14, 16.1~16.7)
// 구조(기승전결·3막·직접)와 구간 열, 구간마다 카드. 카드는 끌기(lib/drag.js) 또는 ↑·↓·구간 이동으로 옮긴다.
//
// 저장 규칙
// - 글 입력(구간 이름, 카드 제목·요약·연결 회차)은 recordAutosaves 하나로 레코드마다 저장한다.
//   구조 레코드도 같은 묶음에 넣어 Save_Indicator 하나에 상태를 합쳐 보인다.
// - 카드 위치(sectionIndex, order)는 autosave 패치에 넣지 않는다. 순서 변경은 savePlotCardPositions,
//   구조 변경은 applyPlotStructure로 바로 쓴다. 그래서 대기 중인 제목 저장과 순서 저장이 서로 덮어쓰지 않는다.
// - 구조를 바꾸기 전에는 구조 Autosave를 flush()한다(대기 중인 구간 이름이 새 구조를 덮어쓰지 않게).
// - 다시 그리기는 열 영역만 한다. 입력란 값은 메모리의 cards·structure(입력할 때마다 같이 갱신)에서 채운다.
// - 정리 함수는 disposeAll과 끌기 해제만 한다. 저장은 라우터의 flushAll()이 먼저 한다.
import '../styles/plot.css';

import { NEW_SECTION_NAME, PLOT_STRUCTURES, UNTITLED_EPISODE } from '../config.js';
import { listEpisodes } from '../db/episodes.js';
import {
  applyPlotStructure,
  createPlotCard,
  deletePlotCard,
  getOrCreatePlotStructure,
  listPlotCards,
  savePlotCardPositions,
  updatePlotCard,
  updatePlotStructure,
} from '../db/plot.js';
import { flushAll } from '../lib/autosave.js';
import { confirmDialog, h, toast } from '../lib/dom.js';
import { enableDrag } from '../lib/drag.js';
import {
  cardsBySection,
  moveCard,
  moveFlags,
  overflowCount,
  reduceSections,
  removeSection,
  structureSections,
} from '../lib/plot.js';
import { addId, removeId } from '../lib/tags.js';
import { formatHash } from '../router.js';
import { recordAutosaves } from './parts/record-autosaves.js';

const UNTITLED_CARD = '제목 없는 카드';
const MSG_ORDER_FAIL = '순서를 저장하지 못했습니다';
const MSG_STRUCTURE_FAIL = '구조를 저장하지 못했습니다';
const MSG_DELETE_FAIL = '삭제하지 못했습니다';

const episodeLabel = (ep) => `${ep.number}화 ${ep.title || UNTITLED_EPISODE}`;

export async function render(el, route) {
  const { projectId } = route;

  let structure = await getOrCreatePlotStructure(projectId);
  let [cards, episodes] = await Promise.all([listPlotCards(projectId), listEpisodes(projectId)]);
  cards = cards.map((c) => ({ ...c, episodeIds: Array.isArray(c.episodeIds) ? [...c.episodeIds] : [] }));

  let disposed = false;
  let busy = false; // 구조 변경·구간 삭제 중에는 같은 종류 조작을 막는다
  let writing = Promise.resolve(); // 순서 저장을 차례대로

  const indicator = h('span', { class: 'save-indicator', 'aria-live': 'polite' });
  const autosaves = recordAutosaves({
    indicator,
    save: (id, patch) =>
      id === structure.id ? updatePlotStructure(id, patch) : updatePlotCard(id, patch),
  });
  const structureAutosave = {
    schedule: (patch) => autosaves.schedule(structure.id, patch),
    flush: () => autosaves.flush(structure.id),
  };

  const episodeById = () => new Map(episodes.map((ep) => [ep.id, ep]));
  const sectionName = (i) => structure.sections[i] ?? '';
  const isCustom = () => structure.type === 'custom';

  // ── 구조 버튼 ──
  const structureBar = h('div', { class: 'plot-structure', role: 'group', 'aria-label': '플롯 구조' });

  function renderStructureBar() {
    structureBar.replaceChildren(
      h('span', { class: 'plot-structure-label' }, '구조'),
      ...PLOT_STRUCTURES.map((s) =>
        h(
          'button',
          {
            type: 'button',
            class: 'chip',
            'aria-pressed': String(structure.type === s.id),
            onclick: () => chooseStructure(s.id),
          },
          s.label,
        ),
      ),
    );
  }

  // ── 열 영역 ──
  const columnsEl = h('div', { class: 'plot-columns' });

  /**
   * 열 영역만 다시 그린다. focusKey가 있으면 그 컨트롤로 초점을 돌려놓는다
   * (없거나 비활성이면 fallbackKey).
   */
  function renderColumns(focusKey = null, fallbackKey = null) {
    const focusables = new Map();
    const mark = (key, node) => {
      focusables.set(key, node);
      return node;
    };
    const columns = cardsBySection(cards, structure.sections.length);
    const byId = episodeById();
    const custom = isCustom();

    const columnEls = structure.sections.map((name, s) => {
      const head = custom
        ? h(
            'div',
            { class: 'plot-column-head' },
            mark(
              `section:${s}:name`,
              h('input', {
                type: 'text',
                class: 'plot-section-name',
                value: name,
                'aria-label': `${s + 1}번째 구간 이름`,
                autocomplete: 'off',
                oninput: (event) => renameSection(s, event.target.value),
              }),
            ),
            h(
              'button',
              {
                type: 'button',
                class: ['btn', 'plot-section-delete'],
                disabled: structure.sections.length <= 1,
                'aria-label': `구간 삭제`,
                onclick: () => deleteSection(s),
              },
              '삭제',
            ),
          )
        : h('div', { class: 'plot-column-head' }, h('h2', { class: 'plot-section-title' }, name));

      const list = columns[s];
      const cardEls = list.map((card, i) => renderCard(card, s, i, list.length, byId, mark));

      return h(
        'section',
        { class: 'plot-column', dataset: { section: s }, 'aria-label': `구간 ${name}` },
        head,
        cardEls,
        mark(
          `section:${s}:new`,
          h(
            'button',
            { type: 'button', class: ['btn', 'plot-new-card'], onclick: () => newCard(s) },
            '+ 새 카드',
          ),
        ),
      );
    });

    columnsEl.replaceChildren(
      ...columnEls,
      ...(custom
        ? [
            h(
              'div',
              { class: 'plot-add-section' },
              mark(
                'section:add',
                h('button', { type: 'button', class: 'btn', onclick: addSection }, '구간 추가'),
              ),
            ),
          ]
        : []),
    );

    for (const key of [focusKey, fallbackKey]) {
      const node = key ? focusables.get(key) : null;
      if (node && !node.disabled) {
        node.focus({ preventScroll: false });
        break;
      }
    }
  }

  function renderCard(card, s, i, length, byId, mark) {
    const flags = moveFlags(i, length);
    const key = (part) => `${card.id}:${part}`;

    const titleInput = h('input', {
      type: 'text',
      class: 'plot-card-title',
      value: card.title ?? '',
      placeholder: '제목',
      'aria-label': '카드 제목',
      autocomplete: 'off',
      oninput: () => {
        card.title = titleInput.value;
        autosaves.schedule(card.id, { title: card.title });
      },
    });
    const summary = h('textarea', {
      class: 'plot-card-summary',
      rows: 3,
      placeholder: '요약',
      'aria-label': '카드 요약',
    });
    summary.value = card.summary ?? '';
    summary.addEventListener('input', () => {
      card.summary = summary.value;
      autosaves.schedule(card.id, { summary: card.summary });
    });

    // 연결 회차 칩 (없는 회차 id는 그리지 않는다)
    const linked = card.episodeIds.map((id) => byId.get(id)).filter(Boolean);
    const chips = linked.length
      ? h(
          'div',
          { class: ['chip-list', 'plot-card-episodes'] },
          linked.map((ep) => {
            const label = episodeLabel(ep);
            return h(
              'span',
              { class: ['chip', 'chip-removable'] },
              h(
                'a',
                {
                  class: 'chip-text plot-episode-link',
                  href: formatHash({ name: 'episode', projectId, episodeId: ep.id }),
                },
                label,
              ),
              mark(
                key(`unlink:${ep.id}`),
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'chip-remove',
                    'aria-label': `${label} 연결 해제`,
                    onclick: () => setEpisodeIds(card, removeId(card.episodeIds, ep.id), key('link')),
                  },
                  '×',
                ),
              ),
            );
          }),
        )
      : null;

    // 회차 연결 select: 아직 연결 안 된 회차만, number 오름차순(listEpisodes 순서)
    const unlinked = episodes.filter((ep) => !card.episodeIds.includes(ep.id));
    const linkSelect = h(
      'select',
      {
        class: 'plot-link-select',
        'aria-label': '회차 연결',
        disabled: unlinked.length === 0,
        onchange: (event) => {
          const id = event.target.value;
          if (id) setEpisodeIds(card, addId(card.episodeIds, id), key('link'));
        },
      },
      h('option', { value: '' }, unlinked.length ? '회차 연결…' : '연결할 회차 없음'),
      unlinked.map((ep) => h('option', { value: ep.id }, episodeLabel(ep))),
    );
    linkSelect.value = '';

    // 구간 이동 select: 지금 구간을 뺀 구간들
    const moveSelect = h(
      'select',
      {
        class: 'plot-move-select',
        'aria-label': '구간 이동',
        disabled: structure.sections.length <= 1,
        onchange: (event) => {
          const t = Number(event.target.value);
          if (event.target.value !== '' && Number.isInteger(t)) {
            reorder(card.id, t, Infinity, key('handle'));
          }
        },
      },
      h('option', { value: '' }, '구간 이동…'),
      structure.sections.map((name, t) =>
        t === s ? null : h('option', { value: String(t), dataset: { sectionOption: t } }, name),
      ),
    );
    moveSelect.value = '';

    return h(
      'article',
      { class: 'plot-card', dataset: { id: card.id } },
      h(
        'div',
        { class: 'plot-card-top' },
        mark(
          key('handle'),
          h(
            'button',
            { type: 'button', class: 'plot-handle', 'aria-label': '끌어서 옮기기' },
            '⠿',
          ),
        ),
        mark(key('title'), titleInput),
      ),
      summary,
      chips,
      mark(key('link'), linkSelect),
      h(
        'div',
        { class: 'plot-card-actions' },
        mark(
          key('up'),
          h(
            'button',
            {
              type: 'button',
              class: 'btn',
              disabled: !flags.up,
              'aria-label': '위로',
              onclick: () => reorder(card.id, s, i - 1, key('up'), key('down')),
            },
            '↑',
          ),
        ),
        mark(
          key('down'),
          h(
            'button',
            {
              type: 'button',
              class: 'btn',
              disabled: !flags.down,
              'aria-label': '아래로',
              onclick: () => reorder(card.id, s, i + 1, key('down'), key('up')),
            },
            '↓',
          ),
        ),
        mark(key('move'), moveSelect),
        h(
          'button',
          { type: 'button', class: ['btn', 'plot-card-delete'], onclick: () => deleteCard(card) },
          '삭제',
        ),
      ),
    );
  }

  // ── DB에서 다시 읽기 (저장 실패 뒤) ──
  async function reload() {
    // 대기 중인 글 변경을 먼저 저장해, 다시 읽은 값이 입력 중인 글을 지우지 않게 한다
    await flushAll();
    if (disposed) return;
    try {
      const [s, list, eps] = await Promise.all([
        getOrCreatePlotStructure(projectId),
        listPlotCards(projectId),
        listEpisodes(projectId),
      ]);
      if (disposed) return;
      structure = s;
      cards = list.map((c) => ({ ...c, episodeIds: Array.isArray(c.episodeIds) ? [...c.episodeIds] : [] }));
      episodes = eps;
      renderStructureBar();
      renderColumns();
    } catch (err) {
      console.error(err);
    }
  }

  /** 위치 갱신 목록을 메모리 카드에 반영한다 */
  function applyUpdates(updates) {
    const byId = new Map(updates.map((u) => [u.id, u]));
    for (const card of cards) {
      const u = byId.get(card.id);
      if (u) {
        card.sectionIndex = u.sectionIndex;
        card.order = u.order;
      }
    }
  }

  // ── 순서 변경 (버튼·끌기 공통) ──
  function reorder(cardId, toSection, toIndex, focusKey, fallbackKey = `${cardId}:handle`) {
    if (disposed) return;
    const updates = moveCard(cards, cardId, toSection, toIndex);
    if (updates.length === 0) {
      renderColumns(focusKey, fallbackKey);
      return;
    }
    applyUpdates(updates);
    renderColumns(focusKey, fallbackKey);
    writing = writing.then(async () => {
      try {
        await savePlotCardPositions(updates);
      } catch (err) {
        console.error(err);
        if (disposed) return;
        toast(MSG_ORDER_FAIL);
        await reload();
      }
    });
  }

  // ── 카드 ──
  async function newCard(s) {
    try {
      const card = await createPlotCard(projectId, s);
      if (disposed) return;
      cards.push({ ...card, episodeIds: [...card.episodeIds] });
      renderColumns(`${card.id}:title`);
    } catch (err) {
      console.error(err);
      if (!disposed) toast('카드를 만들지 못했습니다');
    }
  }

  function setEpisodeIds(card, ids, focusKey) {
    if (ids === card.episodeIds) return;
    card.episodeIds = ids;
    autosaves.schedule(card.id, { episodeIds: [...ids] });
    renderColumns(focusKey);
  }

  async function deleteCard(card) {
    const title = (card.title ?? '').trim() || UNTITLED_CARD;
    const ok = await confirmDialog({
      title: '카드 삭제',
      message: `"${title}" 카드를 삭제할까요?`,
    });
    if (!ok || disposed) return;
    try {
      await autosaves.forget(card.id);
      await writing;
      await deletePlotCard(card.id);
      if (disposed) return;
      const s = card.sectionIndex;
      cards = cards.filter((c) => c.id !== card.id);
      renderColumns(`section:${s}:new`);
    } catch (err) {
      console.error(err);
      if (!disposed) toast(MSG_DELETE_FAIL);
    }
  }

  // ── 구조 변경 ──
  /** 구조 + 카드 위치를 한 트랜잭션으로 쓴다. 성공하면 메모리 반영 후 다시 그린다 */
  async function writeStructure(changes, updates, focusKey) {
    try {
      await writing;
      structure = await applyPlotStructure(structure.id, changes, updates);
      if (disposed) return;
      applyUpdates(updates);
      renderStructureBar();
      renderColumns(focusKey);
    } catch (err) {
      console.error(err);
      if (disposed) return;
      toast(MSG_STRUCTURE_FAIL);
      await reload();
    }
  }

  async function chooseStructure(type) {
    if (busy || disposed || type === structure.type) return;
    busy = true;
    try {
      await structureAutosave.flush();
      const sections = structureSections(type, structure.sections);
      const n = sections.length;
      const moving = n < structure.sections.length ? overflowCount(cards, n) : 0;
      if (moving > 0) {
        const ok = await confirmDialog({
          title: '구조 바꾸기',
          message: `카드 ${moving}장이 마지막 구간 '${sections[n - 1]}'으로 옮겨집니다.`,
          confirmLabel: '바꾸기',
        });
        if (!ok || disposed) return;
      }
      await writeStructure({ type, sections }, reduceSections(cards, n));
    } finally {
      busy = false;
    }
  }

  function renameSection(index, value) {
    const sections = [...structure.sections];
    sections[index] = value;
    structure = { ...structure, sections };
    structureAutosave.schedule({ sections: [...sections] });
    // 다른 카드의 "구간 이동" 선택지 글자만 고친다 (열을 다시 그리면 입력 초점이 사라진다)
    for (const option of columnsEl.querySelectorAll(`option[data-section-option="${index}"]`)) {
      option.textContent = value;
    }
    const column = columnsEl.querySelector(`.plot-column[data-section="${index}"]`);
    column?.setAttribute('aria-label', `구간 ${value}`);
  }

  async function deleteSection(index) {
    if (busy || disposed || structure.sections.length <= 1) return;
    busy = true;
    try {
      await structureAutosave.flush();
      const count = cards.filter((c) => c.sectionIndex === index).length;
      if (count > 0) {
        const target = index === 0 ? sectionName(1) : sectionName(index - 1);
        const ok = await confirmDialog({
          title: '구간 삭제',
          message: `'${sectionName(index)}' 구간을 삭제할까요? 카드 ${count}장이 '${target}' 구간으로 옮겨집니다.`,
        });
        if (!ok || disposed) return;
      }
      const { sections, updates } = removeSection(structure.sections, cards, index);
      const focusIndex = Math.max(0, index - 1);
      await writeStructure({ sections }, updates, `section:${focusIndex}:name`);
    } finally {
      busy = false;
    }
  }

  async function addSection() {
    if (busy || disposed) return;
    busy = true;
    try {
      await structureAutosave.flush();
      const sections = [...structure.sections, NEW_SECTION_NAME];
      await writeStructure({ sections }, [], `section:${sections.length - 1}:name`);
    } finally {
      busy = false;
    }
  }

  // ── 끌기 ──
  const disableDrag = enableDrag(columnsEl, {
    handleSelector: '.plot-handle',
    itemSelector: '.plot-card',
    columnSelector: '.plot-column',
    scrollerSelector: '.plot-columns',
    onDrop: ({ itemId, toSection, toIndex }) => reorder(itemId, toSection, toIndex, `${itemId}:handle`),
  });

  renderStructureBar();
  renderColumns();

  el.replaceChildren(
    h(
      'section',
      { class: 'plot' },
      h(
        'header',
        { class: 'plot-header' },
        h('h1', { class: 'screen-title' }, '플롯'),
        indicator,
      ),
      structureBar,
      columnsEl,
    ),
  );

  // 라우터가 flushAll()을 끝낸 뒤 부른다
  return () => {
    disposed = true;
    autosaves.disposeAll();
    disableDrag();
  };
}
