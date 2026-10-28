// 텍스트 메모 위젯: 제목 input, 본문 textarea, 배경색 선택 (요구 10.1, 10.2).
// data: { title, body }, style: { bg } (bg는 MEMO_COLORS의 value)
import { h } from '../../lib/dom.js';
import { MEMO_COLORS } from '../../config.js';

export const label = '텍스트 메모';

export function defaults() {
  return { style: { bg: MEMO_COLORS[0].value }, data: { title: '', body: '' } };
}

function readData(widget) {
  const data = widget?.data ?? {};
  return {
    title: typeof data.title === 'string' ? data.title : '',
    body: typeof data.body === 'string' ? data.body : '',
  };
}

function readBg(widget) {
  const bg = widget?.style?.bg;
  return typeof bg === 'string' && bg ? bg : MEMO_COLORS[0].value;
}

// 입력 중인 칸은 값이 다를 때만 바꾼다(커서 유지)
function syncValue(input, value) {
  if (input.value !== value) input.value = value;
}

export function render(el, ctx) {
  const isView = () => ctx.getMode() === 'view';

  const titleInput = h('input', {
    type: 'text',
    class: 'memo-title',
    placeholder: '제목',
    'aria-label': '메모 제목',
    value: readData(ctx.widget).title,
  });
  const bodyInput = h('textarea', {
    class: 'memo-body',
    placeholder: '메모를 적어 주세요',
    'aria-label': '메모 본문',
  });
  bodyInput.value = readData(ctx.widget).body;

  function saveData() {
    if (!isView()) return;
    ctx.saveContent({ data: { ...(ctx.widget.data ?? {}), title: titleInput.value, body: bodyInput.value } });
  }
  titleInput.addEventListener('input', saveData);
  bodyInput.addEventListener('input', saveData);

  const swatches = MEMO_COLORS.map((color) =>
    h('button', {
      type: 'button',
      class: 'memo-swatch',
      style: { '--swatch': color.value },
      dataset: { value: color.value },
      'aria-label': `배경색 ${color.label}`,
      title: color.label,
      onclick: () => {
        if (!isView()) return;
        ctx.saveContent({ style: { ...(ctx.widget.style ?? {}), bg: color.value } });
        applyBg(color.value);
      },
    }),
  );
  const palette = h('div', { class: 'memo-colors', role: 'group', 'aria-label': '배경색' }, swatches);

  function applyBg(bg) {
    el.style.setProperty('--memo-bg', bg);
    for (const s of swatches) s.setAttribute('aria-pressed', String(s.dataset.value === bg));
  }

  el.classList.add('widget-memo');
  el.replaceChildren(titleInput, bodyInput, palette);
  applyBg(readBg(ctx.widget));

  return {
    update(widget) {
      const data = readData(widget);
      syncValue(titleInput, data.title);
      syncValue(bodyInput, data.body);
      applyBg(readBg(widget));
    },
    dispose() {
      el.classList.remove('widget-memo');
      el.style.removeProperty('--memo-bg');
      el.replaceChildren();
    },
  };
}
