// 에피소드 상세 화면 (요구사항 1.7~1.9, 3, 4, 5.7, 6.1·6.2, 15.3, 16.1~16.6)
// 모든 필드를 Autosave 하나로 저장한다. 저장 버튼은 없고 머리에 Save_Indicator가 있다.
// 같은 작품의 Episode 목록(회차 번호 중복 확인)과 Character 목록(등장인물 선택)을 함께 읽는다.
// 숫자 입력이 검사를 통과하지 못하면 입력란은 친 그대로 두고 안내만 보인다. 저장된 값은 마지막으로 통과한 값이다.
// 참고 링크의 <a>는 linkHref()를 통과한 주소로만 만든다. DB 값도 다시 검사한다.
// 화면을 떠날 때 저장은 라우터의 flushAll()이 하고, 정리 함수는 dispose만 한다.
import '../styles/episodes.css';

import { EPISODE_STATUSES, LINK_CATEGORY_PRESETS, UNTITLED_EPISODE } from '../config.js';
import { listCharacters } from '../db/characters.js';
import { deleteEpisode, getEpisode, listEpisodes, updateEpisode } from '../db/episodes.js';
import { createAutosave, showStatus } from '../lib/autosave.js';
import { confirmDialog, h, toast } from '../lib/dom.js';
import { dateInputToValue, isDuplicateNumber, normalizeKeyword, parseIntField } from '../lib/episodes.js';
import { ALL, isSameOption, optionLabel } from '../lib/filter.js';
import {
  categoryToInput,
  linkCategoryView,
  linkHref,
  linkLabel,
  removeLink,
  saveLink,
} from '../lib/links.js';
import { addQuote, removeQuote } from '../lib/quotes.js';
import { formatHash, navigate } from '../router.js';
import { setLocationExtras } from '../ui.js';
import { characterPicker } from './parts/character-picker.js';
import { chipInput } from './parts/chip-input.js';

const CUSTOM_CATEGORY = 'custom';
const MSG_NUMBER = '1 이상의 정수를 입력하세요';
const MSG_DUPLICATE = '같은 회차 번호가 이미 있습니다';
const MSG_CHARS = '0 이상의 정수를 입력하세요';
const MSG_URL = 'http 또는 https 주소만 저장할 수 있습니다';

/** 위치 문구·삭제 확인 창에 쓰는 "N화 제목" (제목이 비면 "N화") */
function recordTitle(number, title) {
  const t = String(title ?? '').trim();
  return t ? `${number}화 ${t}` : `${number}화`;
}

export async function render(el, route) {
  const { projectId, episodeId } = route;
  const listRoute = { name: 'episodes', projectId };

  const episode = await getEpisode(episodeId);
  if (!episode || episode.projectId !== projectId) {
    navigate(listRoute, { replace: true });
    return undefined;
  }

  const [episodes, characters] = await Promise.all([listEpisodes(projectId), listCharacters(projectId)]);

  let disposed = false;
  let busy = false; // 삭제 중에는 버튼을 막는다
  let savedNumber = episode.number; // 마지막으로 검사를 통과한 회차 번호
  let title = episode.title ?? '';
  let places = Array.isArray(episode.places) ? [...episode.places] : [];
  let quotes = Array.isArray(episode.quotes) ? [...episode.quotes] : [];
  let links = Array.isArray(episode.links) ? [...episode.links] : []; // 변환 전 레코드 방어 (15.3)
  let linkFilter = ALL;
  let editingIndex = -1; // -1이면 새 링크 추가

  const updateLocation = () => setLocationExtras(route, { recordTitle: recordTitle(savedNumber, title) });
  updateLocation();

  // ── 저장 상태 표시 ──
  const indicator = h('span', { class: 'save-indicator', 'aria-live': 'polite' });
  const autosave = createAutosave({
    save: (patch) => updateEpisode(episodeId, patch),
    onStatus: (status) => showStatus(indicator, status),
  });

  const fieldId = (name) => `episode-${name}`;
  const errorText = () => h('p', { class: 'field-error', 'aria-live': 'polite' });
  const field = (name, label, ...controls) =>
    h('div', { class: 'ed-field' }, h('label', { for: fieldId(name) }, label), ...controls);
  const group = (label, ...controls) =>
    h('div', { class: 'ed-field' }, h('h2', { class: 'ed-subtitle' }, label), ...controls);

  // ── 회차 번호 ──
  const numberError = errorText();
  const numberInput = h('input', {
    type: 'text',
    inputmode: 'numeric',
    id: fieldId('number'),
    class: 'ed-number',
    value: String(episode.number ?? ''),
    autocomplete: 'off',
    oninput: () => {
      const r = parseIntField(numberInput.value, 1);
      if (!r.ok) {
        numberError.textContent = MSG_NUMBER;
        return;
      }
      // 중복이어도 경고만 보이고 저장한다 (3.4)
      numberError.textContent = isDuplicateNumber(episodes, episodeId, r.value) ? MSG_DUPLICATE : '';
      savedNumber = r.value;
      autosave.schedule({ number: r.value });
      updateLocation();
    },
  });
  if (isDuplicateNumber(episodes, episodeId, savedNumber)) numberError.textContent = MSG_DUPLICATE;

  // ── 제목 ──
  const titleInput = h('input', {
    type: 'text',
    id: fieldId('title'),
    value: title,
    placeholder: UNTITLED_EPISODE,
    autocomplete: 'off',
    oninput: () => {
      title = titleInput.value;
      autosave.schedule({ title });
      updateLocation();
    },
  });

  // ── 키워드 ──
  const keywordInput = chipInput({
    label: '키워드',
    values: Array.isArray(episode.keywords) ? episode.keywords : [],
    normalize: normalizeKeyword,
    format: (v) => `#${v}`,
    onChange: (keywords) => autosave.schedule({ keywords: [...keywords] }),
  });

  // ── 등장인물 ──
  const picker = characterPicker({
    characters,
    selectedIds: Array.isArray(episode.characterIds) ? episode.characterIds : [],
    onChange: (characterIds) => autosave.schedule({ characterIds: [...characterIds] }),
  });

  // ── 문자열 목록 (장소·배경, 명대사) ──
  // get/set으로 화면 변수를 바꾸고 key 필드에 저장한다
  function stringList({ key, itemLabel, addLabel, get, set }) {
    const list = h('ul', { class: 'ed-lines' });
    const save = () => autosave.schedule({ [key]: [...get()] });
    function draw(focusIndex = -1) {
      list.replaceChildren(
        ...get().map((text, index) => {
          const input = h('input', {
            type: 'text',
            value: text ?? '',
            'aria-label': `${itemLabel} ${index + 1}`,
            autocomplete: 'off',
            oninput: () => {
              const next = [...get()];
              next[index] = input.value;
              set(next);
              save();
            },
          });
          const remove = h(
            'button',
            {
              type: 'button',
              class: 'btn',
              'aria-label': `${itemLabel} ${index + 1} 삭제`,
              onclick: () => {
                set(removeQuote(get(), index));
                save();
                draw();
              },
            },
            '삭제',
          );
          if (index === focusIndex) queueMicrotask(() => input.focus());
          return h('li', { class: 'ed-line' }, input, remove);
        }),
      );
    }
    draw();
    const addBtn = h(
      'button',
      {
        type: 'button',
        class: 'btn',
        onclick: () => {
          set(addQuote(get(), ''));
          save();
          draw(get().length - 1);
        },
      },
      addLabel,
    );
    return [list, h('div', { class: 'ed-actions' }, addBtn)];
  }

  const placeList = stringList({
    key: 'places',
    itemLabel: '장소·배경',
    addLabel: '장소 추가',
    get: () => places,
    set: (next) => {
      places = next;
    },
  });
  const quoteList = stringList({
    key: 'quotes',
    itemLabel: '명대사',
    addLabel: '대사 추가',
    get: () => quotes,
    set: (next) => {
      quotes = next;
    },
  });

  // ── 글 상자 (핵심 포인트, 메모) ──
  const textarea = (name, rows = 3) => {
    const ta = h('textarea', { id: fieldId(name), rows });
    ta.value = episode[name] ?? '';
    ta.addEventListener('input', () => autosave.schedule({ [name]: ta.value }));
    return ta;
  };

  // ── 상태 ──
  const statusSelect = h(
    'select',
    {
      id: fieldId('status'),
      onchange: () => autosave.schedule({ status: statusSelect.value }),
    },
    EPISODE_STATUSES.map((s) => h('option', { value: s.id }, s.label)),
  );
  statusSelect.value = episode.status ?? EPISODE_STATUSES[0].id;

  // ── 목표·실제 글자수 ──
  function charsInput(name) {
    const error = errorText();
    const input = h('input', {
      type: 'text',
      inputmode: 'numeric',
      id: fieldId(name),
      value: String(episode[name] ?? 0),
      autocomplete: 'off',
      oninput: () => {
        const r = parseIntField(input.value, 0);
        if (!r.ok) {
          error.textContent = MSG_CHARS;
          return;
        }
        error.textContent = '';
        autosave.schedule({ [name]: r.value });
      },
    });
    return [input, error];
  }

  // ── 발행 예정일 ──
  const dateInput = h('input', {
    type: 'date',
    id: fieldId('publishDate'),
    value: episode.publishDate ?? '',
  });
  const saveDate = () => autosave.schedule({ publishDate: dateInputToValue(dateInput.value) });
  dateInput.addEventListener('input', saveDate);
  dateInput.addEventListener('change', saveDate);

  // ── 참고 링크 ──
  const linkFilterRow = h('div', { class: ['filter-row', 'ed-link-filter'], role: 'group', 'aria-label': '링크 분류 필터' });
  const linkGroups = h('div', { class: 'ed-link-groups' });

  function drawLinks() {
    const view = linkCategoryView(links, linkFilter);
    linkFilter = view.selected; // 선택한 분류가 사라지면 "전체"로 (4.7)
    linkFilterRow.hidden = links.length === 0;
    linkFilterRow.replaceChildren(
      ...view.options.map((option) =>
        h(
          'button',
          {
            type: 'button',
            class: 'chip',
            'aria-pressed': isSameOption(option, view.selected) ? 'true' : 'false',
            onclick: () => {
              if (isSameOption(option, linkFilter)) return;
              linkFilter = option;
              drawLinks();
            },
          },
          optionLabel(option),
        ),
      ),
    );
    if (links.length === 0) {
      linkGroups.replaceChildren(h('p', { class: 'ed-empty' }, '아직 참고 링크가 없습니다'));
      return;
    }
    linkGroups.replaceChildren(
      ...view.groups.map(({ category, items }) =>
        h(
          'section',
          { class: 'ed-link-group' },
          h('h3', { class: 'ed-link-category' }, category || '분류 없음'),
          h('ul', { class: 'link-list' }, ...items.map(({ link, index }) => linkRow(link, index))),
        ),
      ),
    );
  }

  function linkRow(link, index) {
    const label = linkLabel(link);
    const href = linkHref(link.url);
    const text = href
      ? h('a', { class: 'ref-link', href, target: '_blank', rel: 'noopener noreferrer' }, label)
      : h('span', { class: 'ref-link ref-link-invalid' }, label);
    return h(
      'li',
      { class: ['link-item', 'ed-link-item', index === editingIndex ? 'is-editing' : null] },
      text,
      h(
        'button',
        { type: 'button', class: 'btn', 'aria-label': `${label} 링크 수정`, onclick: () => startEdit(index) },
        '수정',
      ),
      h(
        'button',
        { type: 'button', class: 'btn', 'aria-label': `${label} 링크 삭제`, onclick: () => askRemove(index) },
        '삭제',
      ),
    );
  }

  async function askRemove(index) {
    const link = links[index];
    if (!link) return;
    const ok = await confirmDialog({
      title: '참고 링크 삭제',
      message: `"${linkLabel(link)}"(${link.category}) 링크를 삭제할까요? 삭제하면 되돌릴 수 없습니다.`,
    });
    // 확인 창이 떠 있는 동안 목록이 바뀌었으면 지우지 않는다
    if (!ok || disposed || links[index] !== link) return;
    links = removeLink(links, index);
    if (editingIndex === index) resetForm();
    else if (editingIndex > index) editingIndex -= 1;
    autosave.schedule({ links: [...links] });
    drawLinks();
  }

  // 입력 폼: 분류(프리셋 4개 + 직접 입력), 이름, 주소
  const linkError = errorText();
  const categorySelect = h(
    'select',
    { id: fieldId('link-category') },
    LINK_CATEGORY_PRESETS.map((c) => h('option', { value: c }, c)),
    h('option', { value: CUSTOM_CATEGORY }, '직접 입력'),
  );
  const customCategoryInput = h('input', {
    type: 'text',
    id: fieldId('link-custom'),
    placeholder: '분류 직접 입력',
    'aria-label': '직접 입력 분류',
    autocomplete: 'off',
  });
  const linkNameInput = h('input', { type: 'text', id: fieldId('link-name'), autocomplete: 'off', placeholder: '비우면 주소를 보여 줍니다' });
  const linkUrlInput = h('input', {
    type: 'url',
    id: fieldId('link-url'),
    autocomplete: 'off',
    inputmode: 'url',
    placeholder: 'https://',
  });
  const submitBtn = h('button', { type: 'submit', class: ['btn', 'btn-primary'] }, '추가');
  const cancelBtn = h('button', { type: 'button', class: 'btn', onclick: () => resetForm() }, '취소');

  function setCategoryInput(category) {
    const state = categoryToInput(category);
    categorySelect.value = state.choice;
    customCategoryInput.value = state.custom;
    customCategoryInput.hidden = state.choice !== CUSTOM_CATEGORY;
  }
  categorySelect.addEventListener('change', () => {
    const isCustom = categorySelect.value === CUSTOM_CATEGORY;
    customCategoryInput.hidden = !isCustom;
    if (isCustom) customCategoryInput.focus();
  });

  function resetForm() {
    editingIndex = -1;
    setCategoryInput(LINK_CATEGORY_PRESETS[0]);
    linkNameInput.value = '';
    linkUrlInput.value = '';
    linkError.textContent = '';
    submitBtn.textContent = '추가';
    cancelBtn.hidden = true;
    drawLinks();
  }

  function startEdit(index) {
    const link = links[index];
    if (!link) return;
    editingIndex = index;
    setCategoryInput(link.category);
    linkNameInput.value = link.name ?? '';
    linkUrlInput.value = link.url ?? '';
    linkError.textContent = '';
    submitBtn.textContent = '저장';
    cancelBtn.hidden = false;
    drawLinks();
    linkNameInput.focus();
  }

  const linkForm = h(
    'form',
    {
      class: 'ed-link-form',
      novalidate: true, // 검사는 Link_Validator가 한다 (www. 주소도 받기 위해)
      onsubmit: (event) => {
        event.preventDefault();
        const r = saveLink(links, editingIndex, {
          choice: categorySelect.value,
          custom: customCategoryInput.value,
          name: linkNameInput.value,
          url: linkUrlInput.value,
        });
        if (!r.ok) {
          linkError.textContent = MSG_URL;
          linkUrlInput.focus();
          return;
        }
        links = r.links;
        autosave.schedule({ links: [...links] });
        resetForm();
      },
    },
    h(
      'div',
      { class: 'ed-link-form-grid' },
      h(
        'div',
        { class: 'ed-field' },
        h('label', { for: fieldId('link-category') }, '분류'),
        categorySelect,
        customCategoryInput,
      ),
      field('link-name', '이름', linkNameInput),
      field('link-url', '주소', linkUrlInput),
    ),
    linkError,
    h('div', { class: 'ed-actions' }, submitBtn, cancelBtn),
  );
  resetForm(); // 폼 초기 상태 + 목록 그리기

  // ── 에피소드 삭제 ──
  const deleteBtn = h(
    'button',
    {
      type: 'button',
      class: ['btn', 'btn-danger'],
      onclick: async () => {
        if (busy) return;
        const ok = await confirmDialog({
          title: '에피소드 삭제',
          message: `"${recordTitle(savedNumber, title)}"을 삭제할까요? 삭제하면 되돌릴 수 없습니다.`,
        });
        if (!ok || disposed) return;
        busy = true;
        deleteBtn.disabled = true;
        try {
          await autosave.flush();
          autosave.dispose();
          await deleteEpisode(episodeId);
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
    '에피소드 삭제',
  );

  const [targetInput, targetError] = charsInput('targetChars');
  const [actualInput, actualError] = charsInput('actualChars');

  el.replaceChildren(
    h(
      'section',
      { class: 'episode-detail' },
      h(
        'header',
        { class: 'ed-header' },
        h('a', { class: 'ed-back', href: formatHash(listRoute) }, '← 에피소드 목록'),
        indicator,
      ),
      h('h1', { class: 'screen-title visually-hidden' }, '에피소드 상세'),
      h(
        'div',
        { class: 'ed-row' },
        h('div', { class: ['ed-field', 'ed-field-number'] }, h('label', { for: fieldId('number') }, '회차 번호'), numberInput, numberError),
        h('div', { class: ['ed-field', 'ed-field-grow'] }, h('label', { for: fieldId('title') }, '제목'), titleInput),
      ),
      h(
        'div',
        { class: 'ed-row' },
        field('status', '상태', statusSelect),
        field('publishDate', '발행 예정일', dateInput),
      ),
      h(
        'div',
        { class: 'ed-row' },
        field('targetChars', '목표 글자수', targetInput, targetError),
        field('actualChars', '실제 글자수', actualInput, actualError),
      ),
      h('div', { class: 'ed-field' }, keywordInput),
      group('등장인물', picker),
      group('장소·배경', ...placeList),
      field('keyPoints', '핵심 포인트', textarea('keyPoints', 4)),
      group('명대사', ...quoteList),
      field('memo', '메모', textarea('memo')),
      h(
        'div',
        { class: ['ed-field', 'ed-links'] },
        h('h2', { class: 'ed-subtitle' }, '참고 링크'),
        linkFilterRow,
        linkGroups,
        linkForm,
      ),
      h('div', { class: 'ed-danger-zone' }, deleteBtn),
    ),
  );

  // 라우터가 flushAll()을 끝낸 뒤 부른다
  return () => {
    disposed = true;
    autosave.dispose();
  };
}
