// 문자열 칩 입력 (에피소드 키워드, 보관함 태그).
// 칩 목록 + 입력란 + 추가 버튼. Enter로도 추가한다. 칩의 × 버튼으로 지운다.
// 값은 직접 저장하지 않고 onChange(새 배열)로 알린다. 입력 배열은 바꾸지 않는다.
//
// 클래스 이름 (스타일은 styles/parts.css):
//   .chip-input        바깥 묶음
//   .chip-input-label  라벨
//   .chip-list         칩 줄
//   .chip-removable    × 버튼이 붙은 칩
//   .chip-remove       × 버튼
//   .chip-input-row    입력란 + 추가 버튼 줄
import '../../styles/parts.css';

import { h } from '../../lib/dom.js';
import { addUnique, removeValue } from '../../lib/tags.js';

let nextId = 0;

/**
 * @param {object} opts
 * @param {string} opts.label            라벨 글자 (예: '키워드')
 * @param {string[]} opts.values         처음 값
 * @param {(raw: string) => string} [opts.normalize]  추가 전 정리 함수 (기본: trim)
 * @param {(v: string) => string} [opts.format]       칩 글자 (예: v => `#${v}`)
 * @param {(values: string[]) => void} opts.onChange
 * @returns {HTMLElement}
 */
export function chipInput({ label, values, normalize = (s) => String(s ?? '').trim(), format = (v) => v, onChange }) {
  let current = Array.isArray(values) ? values : [];
  const inputId = `chip-input-${++nextId}`;

  const list = h('div', { class: 'chip-list' });
  const input = h('input', { id: inputId, type: 'text', autocomplete: 'off', enterkeyhint: 'done' });
  const addBtn = h('button', { type: 'button', class: 'btn', onclick: add }, '추가');

  input.addEventListener('keydown', (event) => {
    // 한글 조합 중 Enter는 조합 확정이므로 건너뛴다
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      add();
    }
  });

  function update(next) {
    if (next === current) return;
    current = next;
    draw();
    if (typeof onChange === 'function') onChange(current);
  }

  function add() {
    const next = addUnique(current, input.value, normalize);
    input.value = '';
    update(next);
    input.focus();
  }

  function draw() {
    list.replaceChildren(
      ...current.map((value) => {
        const text = format(value);
        return h(
          'span',
          { class: ['chip', 'chip-removable'] },
          h('span', { class: 'chip-text' }, text),
          h(
            'button',
            {
              type: 'button',
              class: 'chip-remove',
              'aria-label': `${text} 지우기`,
              onclick: () => update(removeValue(current, value)),
            },
            '×',
          ),
        );
      }),
    );
    list.hidden = current.length === 0;
  }

  draw();
  return h(
    'div',
    { class: 'chip-input' },
    h('label', { class: 'chip-input-label', for: inputId }, label),
    list,
    h('div', { class: 'chip-input-row' }, input, addBtn),
  );
}
