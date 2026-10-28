// 체크리스트 위젯: 항목 추가·글 수정·체크·삭제 (요구 10.3, 10.4).
// data: { items: [{ id, text, done }] }
import { h } from '../../lib/dom.js';

export const label = '체크리스트';

export function defaults() {
  return { style: {}, data: { items: [] } };
}

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// 저장된 값이 이상해도 그릴 수 있게 정리한 사본
function readItems(widget) {
  const items = widget?.data?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === 'object' && item.id != null)
    .map((item) => ({
      id: String(item.id),
      text: typeof item.text === 'string' ? item.text : '',
      done: item.done === true,
    }));
}

export function render(el, ctx) {
  const isView = () => ctx.getMode() === 'view';
  let items = readItems(ctx.widget);
  const rows = new Map(); // id → { row, check, input }

  const list = h('ul', { class: 'checklist-items' });
  const addBtn = h(
    'button',
    { type: 'button', class: 'checklist-add', onclick: () => addItem() },
    '+ 항목 추가',
  );

  function save() {
    ctx.saveContent({ data: { ...(ctx.widget.data ?? {}), items: items.map((item) => ({ ...item })) } });
  }

  function makeRow(item) {
    const check = h('input', {
      type: 'checkbox',
      class: 'checklist-check',
      'aria-label': '완료',
      checked: item.done,
    });
    const input = h('input', {
      type: 'text',
      class: 'checklist-text',
      placeholder: '할 일',
      'aria-label': '항목 내용',
      value: item.text,
    });
    const removeBtn = h('button', {
      type: 'button',
      class: 'checklist-remove',
      'aria-label': '항목 삭제',
    }, '×');
    const row = h('li', { class: 'checklist-row', dataset: { done: item.done } }, check, input, removeBtn);

    check.addEventListener('change', () => {
      const target = items.find((it) => it.id === item.id);
      if (!isView() || !target) {
        check.checked = target ? target.done : false;
        return;
      }
      target.done = check.checked;
      row.dataset.done = String(target.done);
      save();
    });
    input.addEventListener('input', () => {
      if (!isView()) return;
      const target = items.find((it) => it.id === item.id);
      if (!target) return;
      target.text = input.value;
      save();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        addItem(item.id);
      }
    });
    removeBtn.addEventListener('click', () => {
      if (!isView()) return;
      items = items.filter((it) => it.id !== item.id);
      save();
      renderRows();
    });

    return { row, check, input };
  }

  // items 순서대로 줄을 맞춘다. 이미 있는 줄은 다시 쓰고(입력 중 커서 유지) 없어진 줄은 뺀다
  function renderRows() {
    const keep = new Set(items.map((it) => it.id));
    for (const id of [...rows.keys()]) if (!keep.has(id)) rows.delete(id);
    const nodes = items.map((item) => {
      let entry = rows.get(item.id);
      if (!entry) {
        entry = makeRow(item);
        rows.set(item.id, entry);
      }
      if (entry.check.checked !== item.done) entry.check.checked = item.done;
      if (entry.input.value !== item.text) entry.input.value = item.text;
      entry.row.dataset.done = String(item.done);
      return entry.row;
    });
    list.replaceChildren(...nodes);
  }

  // afterId 다음에 새 항목(없으면 맨 끝)
  function addItem(afterId = null) {
    if (!isView()) return;
    const item = { id: newId(), text: '', done: false };
    const index = afterId == null ? -1 : items.findIndex((it) => it.id === afterId);
    if (index < 0) items = [...items, item];
    else items = [...items.slice(0, index + 1), item, ...items.slice(index + 1)];
    save();
    renderRows();
    rows.get(item.id)?.input.focus();
  }

  el.classList.add('widget-checklist');
  el.replaceChildren(list, addBtn);
  renderRows();

  return {
    update(widget) {
      items = readItems(widget);
      renderRows();
    },
    dispose() {
      el.classList.remove('widget-checklist');
      rows.clear();
      el.replaceChildren();
    },
  };
}
