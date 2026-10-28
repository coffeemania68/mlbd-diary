// 만다라트 상세 화면 (요구사항 11.3, 11.5, 12.1~12.13, 1.7~1.9).
// 제목·메모·칸은 Autosave 하나로 저장한다. cells 패치는 매번 setCell 결과 배열 전체다.
// DOM은 태블릿용 .md-grid(81칸)와 휴대폰용 .md-phone(개요 9블록 ↔ 확대 9칸)을 함께 만들고
// CSS 미디어 쿼리로 하나만 보인다. 칸 하나가 여러 요소에 있으므로 cellEls에 모아 paintCell로 함께 고친다.
// 화면을 떠날 때 저장은 라우터의 flushAll()이 하고, 정리 함수는 dispose만 한다.
import '../styles/mandalart.css';

import { MANDALART_PALETTE, UNTITLED_MANDALART } from '../config.js';
import { deleteMandalart, getMandalart, updateMandalart } from '../db/mandalarts.js';
import { createAutosave, showStatus } from '../lib/autosave.js';
import { confirmDialog, h, toast } from '../lib/dom.js';
import { CENTER_BLOCK, SIZE, cellIndex, cellPosition, isCenterCell, setCell } from '../lib/mandalart.js';
import { formatHash, navigate } from '../router.js';
import { setLocationExtras } from '../ui.js';

// 블록 번호(0~8, 행 우선) → 위치 이름
const BLOCK_NAMES = ['왼쪽 위', '위', '오른쪽 위', '왼쪽', '가운데', '오른쪽', '왼쪽 아래', '아래', '오른쪽 아래'];
const CELLS_IN_BLOCK = 9;

/** "가운데 블록 · 5번 칸" */
function positionLabel(index) {
  const { block, i } = cellPosition(index);
  return `${BLOCK_NAMES[block]} 블록 · ${i + 1}번 칸`;
}

export async function render(el, route) {
  const { projectId, mandalartId } = route;
  const listRoute = { name: 'mandalarts', projectId };

  const mandalart = await getMandalart(mandalartId);
  if (!mandalart || mandalart.projectId !== projectId) {
    navigate(listRoute, { replace: true });
    return undefined;
  }

  let disposed = false;
  let busy = false;
  let cells = mandalart.cells; // getMandalart가 normalizeCells로 81칸을 맞춰 준다
  let selected = -1; // 편집 중인 칸 index. 없으면 -1
  let zoomBlock = -1; // 휴대폰에서 확대 중인 블록. 개요면 -1

  setLocationExtras(route, { recordTitle: mandalart.title });

  // ── 저장 상태 표시 ──
  const indicator = h('span', { class: 'save-indicator', 'aria-live': 'polite' });
  const autosave = createAutosave({
    save: (patch) => updateMandalart(mandalartId, patch),
    onStatus: (status) => showStatus(indicator, status),
  });

  // ── 제목 ──
  const titleInput = h('input', {
    type: 'text',
    id: 'mandalart-title',
    value: mandalart.title ?? '',
    placeholder: UNTITLED_MANDALART,
    autocomplete: 'off',
    oninput: () => {
      autosave.schedule({ title: titleInput.value });
      setLocationExtras(route, { recordTitle: titleInput.value });
    },
  });

  // ── 메모 ──
  const noteInput = h('textarea', { id: 'mandalart-note', rows: 4 });
  noteInput.value = mandalart.note ?? '';
  noteInput.addEventListener('input', () => autosave.schedule({ note: noteInput.value }));

  // ── 칸 요소 모음 ──
  /** index → 그 칸을 보여 주는 요소들(태블릿 칸, 휴대폰 확대 칸, 블록 가운데 칸이면 개요 버튼) */
  const cellEls = new Map();
  const register = (index, element) => {
    if (!cellEls.has(index)) cellEls.set(index, []);
    cellEls.get(index).push(element);
  };

  /** 칸 요소 하나: 글자 span + 배경색. aria-label에 위치와 전체 글자를 담는다 */
  function paintElement(element, index) {
    const { text, color } = cells[index];
    element.querySelector('.md-cell-text').textContent = text;
    element.style.backgroundColor = color ?? '';
    element.classList.toggle('has-color', Boolean(color));
    if (element.classList.contains('md-cell')) {
      element.setAttribute('aria-label', text ? `${positionLabel(index)}: ${text}` : `${positionLabel(index)} (비어 있음)`);
    }
  }

  function paintCell(index) {
    for (const element of cellEls.get(index) ?? []) paintElement(element, index);
  }

  function cellButton(index) {
    const { row, col } = cellPosition(index);
    const button = h(
      'button',
      {
        type: 'button',
        class: [
          'md-cell',
          col === 2 || col === 5 ? 'edge-right' : null,
          row === 2 || row === 5 ? 'edge-bottom' : null,
          isCenterCell(index) ? 'center' : null,
        ],
        dataset: { index },
        'aria-pressed': 'false',
        onclick: () => openEditor(index),
      },
      h('span', { class: 'md-cell-text' }),
    );
    register(index, button);
    return button;
  }

  // ── 태블릿: 81칸 (행 우선, 0번이 왼쪽 위) ──
  const grid = h(
    'div',
    { class: 'md-grid', role: 'group', 'aria-label': '만다라트 9×9 칸' },
    Array.from({ length: SIZE * SIZE }, (_, index) => cellButton(index)),
  );

  // ── 휴대폰: 개요(블록 9개) ↔ 확대(고른 블록의 9칸) ──
  const overview = h(
    'div',
    { class: 'md-overview', role: 'group', 'aria-label': '블록 고르기' },
    BLOCK_NAMES.map((name, block) => {
      const centerIndex = cellIndex(block, 4);
      const button = h(
        'button',
        {
          type: 'button',
          class: ['md-block', block === CENTER_BLOCK ? 'center' : null],
          'aria-label': `${name} 블록 펼치기`,
          onclick: () => showZoom(block),
        },
        h('span', { class: 'md-cell-text' }),
      );
      register(centerIndex, button);
      return button;
    }),
  );

  // 블록 9개의 확대 칸을 미리 만들어 두고, 고른 블록만 보인다
  const zoomBlocks = BLOCK_NAMES.map((name, block) =>
    h(
      'div',
      { class: 'md-zoom-cells', role: 'group', 'aria-label': `${name} 블록`, hidden: true },
      Array.from({ length: CELLS_IN_BLOCK }, (_, i) => cellButton(cellIndex(block, i))),
    ),
  );
  const zoomTitle = h('h2', { class: 'md-zoom-title' });
  const zoom = h(
    'div',
    { class: 'md-zoom', hidden: true },
    h(
      'div',
      { class: 'md-zoom-head' },
      h('button', { type: 'button', class: 'btn', onclick: showOverview }, '← 개요로'),
      zoomTitle,
    ),
    zoomBlocks,
  );
  const phone = h('div', { class: 'md-phone' }, overview, zoom);

  function showZoom(block) {
    zoomBlock = block;
    zoomBlocks.forEach((element, b) => {
      element.hidden = b !== block;
    });
    zoomTitle.textContent = `${BLOCK_NAMES[block]} 블록`;
    overview.hidden = true;
    zoom.hidden = false;
  }

  function showOverview() {
    const block = zoomBlock;
    zoomBlock = -1;
    zoom.hidden = true;
    overview.hidden = false;
    closeEditor();
    if (block >= 0) overview.children[block]?.focus();
  }

  for (let index = 0; index < SIZE * SIZE; index += 1) paintCell(index);

  // ── 칸 편집 패널 ──
  const editorTitle = h('h2', { class: 'md-editor-title', id: 'md-editor-title' });
  const cellText = h('textarea', { id: 'md-cell-text', rows: 3 });
  cellText.addEventListener('input', () => updateSelected({ text: cellText.value }));

  const swatches = [
    ...MANDALART_PALETTE.map((p) => ({ value: p.value, label: p.label })),
    { value: null, label: '색 없음' },
  ].map((option) => ({
    value: option.value,
    el: h(
      'button',
      {
        type: 'button',
        class: ['md-swatch', option.value === null ? 'is-none' : null],
        'aria-pressed': 'false',
        onclick: () => {
          updateSelected({ color: option.value });
          paintSwatches();
        },
      },
      h('span', { class: 'md-swatch-color', style: { backgroundColor: option.value }, 'aria-hidden': 'true' }),
      h('span', { class: 'md-swatch-label' }, option.label),
    ),
  }));

  const editor = h(
    'div',
    { class: 'md-editor', role: 'region', 'aria-labelledby': 'md-editor-title', hidden: true },
    h(
      'div',
      { class: 'md-editor-head' },
      editorTitle,
      h('button', { type: 'button', class: 'btn', onclick: () => closeEditor(true) }, '닫기'),
    ),
    h('label', { for: 'md-cell-text' }, '칸 글자'),
    cellText,
    h(
      'div',
      { class: 'md-palette', role: 'group', 'aria-label': '칸 색' },
      swatches.map((s) => s.el),
    ),
  );
  editor.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeEditor(true);
    }
  });

  function markSelected(index, on) {
    for (const element of cellEls.get(index) ?? []) {
      if (!element.classList.contains('md-cell')) continue;
      element.classList.toggle('is-selected', on);
      element.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function paintSwatches() {
    const color = selected >= 0 ? cells[selected].color : undefined;
    for (const s of swatches) s.el.setAttribute('aria-pressed', s.value === color ? 'true' : 'false');
  }

  function openEditor(index) {
    if (selected >= 0) markSelected(selected, false);
    selected = index;
    markSelected(index, true);
    editorTitle.textContent = positionLabel(index);
    cellText.value = cells[index].text;
    paintSwatches();
    editor.hidden = false;
    cellText.focus();
    editor.scrollIntoView?.({ block: 'nearest' });
  }

  /** 패널을 닫는다. returnFocus면 닫기 전에 고른 칸으로 초점을 돌린다 */
  function closeEditor(returnFocus = false) {
    if (selected < 0) return;
    const index = selected;
    markSelected(index, false);
    selected = -1;
    editor.hidden = true;
    if (returnFocus) {
      const target = (cellEls.get(index) ?? []).find((element) => element.classList.contains('md-cell') && element.offsetParent);
      target?.focus();
    }
  }

  function updateSelected(patch) {
    if (selected < 0) return;
    cells = setCell(cells, selected, patch);
    paintCell(selected);
    autosave.schedule({ cells });
  }

  // ── 삭제 ──
  const deleteBtn = h(
    'button',
    {
      type: 'button',
      class: ['btn', 'btn-danger'],
      onclick: async () => {
        if (busy) return;
        const title = titleInput.value.trim() || UNTITLED_MANDALART;
        const ok = await confirmDialog({
          title: '만다라트 삭제',
          message: `"${title}" 만다라트를 삭제할까요?`,
        });
        if (!ok || disposed) return;
        busy = true;
        deleteBtn.disabled = true;
        try {
          await autosave.flush();
          autosave.dispose();
          await deleteMandalart(mandalartId);
          navigate(listRoute, { replace: true });
        } catch (err) {
          console.error(err);
          if (!disposed) {
            toast('삭제하지 못했습니다');
            busy = false;
            deleteBtn.disabled = false;
          }
        }
      },
    },
    '만다라트 삭제',
  );

  el.replaceChildren(
    h(
      'section',
      { class: 'mandalart' },
      h(
        'header',
        { class: 'md-header' },
        h('a', { class: 'md-back', href: formatHash(listRoute) }, '← 만다라트 목록'),
        indicator,
      ),
      h('h1', { class: 'screen-title visually-hidden' }, '만다라트'),
      h('div', { class: 'md-field' }, h('label', { for: 'mandalart-title' }, '제목'), titleInput),
      h('div', { class: 'md-board' }, grid, phone),
      editor,
      h('div', { class: 'md-field' }, h('label', { for: 'mandalart-note' }, '메모'), noteInput),
      h('div', { class: 'md-danger-zone' }, deleteBtn),
    ),
  );

  // 라우터가 flushAll()을 끝낸 뒤 부른다
  return () => {
    disposed = true;
    autosave.dispose();
  };
}
