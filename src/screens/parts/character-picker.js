// Character_Tag_Picker: 레코드에 등장인물(캐릭터 id)을 붙이고 떼는 입력.
// <select>("인물 추가…" + 아직 고르지 않은 캐릭터) + 이름 칩(× 버튼).
// characters가 비면 "먼저 캐릭터를 만들어 주세요" 안내만 보인다.
// selectedIds 중 characters에 없는 id(지워진 캐릭터)는 칩을 그리지 않는다. 값은 그대로 넘긴다.
// 값은 직접 저장하지 않고 onChange(새 id 배열)로 알린다. 입력 배열은 바꾸지 않는다.
//
// 클래스 이름 (스타일은 styles/parts.css):
//   .character-picker        바깥 묶음
//   .character-picker-empty  캐릭터가 없을 때 안내
//   .chip-list / .chip-removable / .chip-remove  (chip-input.js와 같음)
import '../../styles/parts.css';

import { h } from '../../lib/dom.js';
import { addId, removeId } from '../../lib/tags.js';

const EMPTY_TEXT = '먼저 캐릭터를 만들어 주세요';
const ADD_PROMPT = '인물 추가…';
const NO_NAME = '이름 없음';

const nameOf = (c) => String(c?.name ?? '').trim() || NO_NAME;

/**
 * @param {object} opts
 * @param {{ id: string, name: string }[]} opts.characters  이 작품의 캐릭터
 * @param {string[]} opts.selectedIds
 * @param {(ids: string[]) => void} opts.onChange
 * @returns {HTMLElement}
 */
export function characterPicker({ characters, selectedIds, onChange }) {
  const all = Array.isArray(characters) ? characters : [];
  let current = Array.isArray(selectedIds) ? selectedIds : [];

  if (all.length === 0) {
    return h('div', { class: 'character-picker' }, h('p', { class: 'character-picker-empty' }, EMPTY_TEXT));
  }

  const byId = new Map(all.map((c) => [c.id, c]));
  const list = h('div', { class: 'chip-list' });
  const select = h('select', {
    'aria-label': ADD_PROMPT,
    onchange: () => {
      const id = select.value;
      if (id) update(addId(current, id));
    },
  });

  function update(next) {
    if (next !== current) {
      current = next;
      if (typeof onChange === 'function') onChange(current);
    }
    draw();
  }

  function draw() {
    const chips = current
      .filter((id) => byId.has(id))
      .map((id) => {
        const name = nameOf(byId.get(id));
        return h(
          'span',
          { class: ['chip', 'chip-removable'] },
          h('span', { class: 'chip-text' }, name),
          h(
            'button',
            {
              type: 'button',
              class: 'chip-remove',
              'aria-label': `${name} 빼기`,
              onclick: () => update(removeId(current, id)),
            },
            '×',
          ),
        );
      });
    list.replaceChildren(...chips);
    list.hidden = chips.length === 0;

    const remaining = all.filter((c) => !current.includes(c.id));
    select.replaceChildren(
      h('option', { value: '' }, ADD_PROMPT),
      ...remaining.map((c) => h('option', { value: c.id }, nameOf(c))),
    );
    select.value = '';
    select.disabled = remaining.length === 0;
  }

  draw();
  return h('div', { class: 'character-picker' }, list, select);
}
