// 캐릭터 상세 화면 (요구사항 11.1~11.7, 12.1·12.4~12.7, 13.1~13.4, 15.7)
// 글 입력은 모두 한 Autosave 인스턴스로 저장한다. 저장 버튼은 없고 머리에 Save_Indicator가 있다.
// 이미지 고르기·제거 전에는 autosave.flush()로 대기 중인 글 변경을 먼저 저장한다.
// 화면을 떠날 때 저장은 라우터의 flushAll()이 하고, 정리 함수는 dispose와 objectURL 해제만 한다.
import '../styles/character-detail.css';

import { ROLE_PRESETS } from '../config.js';
import { requestAssetGc } from '../db/asset-gc.js';
import {
  deleteCharacter,
  getAsset,
  getCharacter,
  removeCharacterImage,
  setCharacterImage,
  updateCharacter,
} from '../db/characters.js';
import { listEpisodesWithCharacter } from '../db/episodes.js';
import { createAutosave, showStatus } from '../lib/autosave.js';
import { confirmDialog, h, toast } from '../lib/dom.js';
import { ImageLoadError, processImage } from '../lib/image.js';
import { addQuote, removeQuote } from '../lib/quotes.js';
import { inputToRole, roleToInput } from '../lib/roles.js';
import { formatHash, navigate } from '../router.js';
import { setLocationExtras } from '../ui.js';

const CUSTOM_ROLE = 'custom';
const UNNAMED = '이름 없음';

// 글 상자 항목: [필드 이름, 라벨]. 메모는 대표 대사 아래에 따로 둔다
const TEXT_FIELDS = [
  ['appearance', '외모'],
  ['personality', '성격'],
  ['goal', '목표'],
  ['secret', '비밀'],
];

export async function render(el, route) {
  const { projectId, characterId } = route;
  const listRoute = { name: 'characters', projectId };

  const character = await getCharacter(characterId);
  if (!character || character.projectId !== projectId) {
    navigate(listRoute, { replace: true });
    return undefined;
  }

  const [initialAsset, appearances] = await Promise.all([
    getAsset(character.imageAssetId),
    listEpisodesWithCharacter(projectId, characterId),
  ]);

  let disposed = false;
  let busy = false; // 이미지 처리·삭제 중에는 버튼을 막는다
  let quotes = Array.isArray(character.quotes) ? [...character.quotes] : [];
  const objectUrls = new Set();

  setLocationExtras(route, { characterName: character.name });

  // ── 저장 상태 표시 ──
  const indicator = h('span', { class: 'save-indicator', 'aria-live': 'polite' });
  const autosave = createAutosave({
    save: (patch) => updateCharacter(characterId, patch),
    onStatus: (status) => showStatus(indicator, status),
  });

  const fieldId = (name) => `character-${name}`;
  const field = (name, label, control) =>
    h('div', { class: 'cd-field' }, h('label', { for: fieldId(name) }, label), control);

  // ── 이름 ──
  const nameInput = h('input', {
    type: 'text',
    id: fieldId('name'),
    value: character.name ?? '',
    autocomplete: 'off',
    oninput: () => {
      autosave.schedule({ name: nameInput.value });
      setLocationExtras(route, { characterName: nameInput.value });
    },
  });

  // ── 역할 ──
  const roleState = roleToInput(character.role);
  const roleSelect = h(
    'select',
    { id: fieldId('role') },
    h('option', { value: '' }, '선택 안 함'),
    ROLE_PRESETS.map((role) => h('option', { value: role }, role)),
    h('option', { value: CUSTOM_ROLE }, '직접 입력'),
  );
  roleSelect.value = roleState.choice;
  const customRoleInput = h('input', {
    type: 'text',
    id: fieldId('role-custom'),
    class: 'cd-role-custom',
    value: roleState.custom,
    placeholder: '역할 직접 입력',
    'aria-label': '직접 입력 역할',
    autocomplete: 'off',
  });
  customRoleInput.hidden = roleState.choice !== CUSTOM_ROLE;
  const saveRole = () =>
    autosave.schedule({
      role: inputToRole({ choice: roleSelect.value, custom: customRoleInput.value }),
    });
  roleSelect.addEventListener('change', () => {
    const isCustom = roleSelect.value === CUSTOM_ROLE;
    customRoleInput.hidden = !isCustom;
    saveRole();
    if (isCustom) customRoleInput.focus();
  });
  customRoleInput.addEventListener('input', saveRole);

  // ── 나이 ──
  const ageInput = h('input', {
    type: 'text',
    id: fieldId('age'),
    value: character.age ?? '',
    placeholder: '예: 17세',
    autocomplete: 'off',
    oninput: () => autosave.schedule({ age: ageInput.value }),
  });

  // ── 글 상자 (외모·성격·목표·비밀·메모) ──
  const textarea = (name) => {
    const ta = h('textarea', { id: fieldId(name), rows: 3 });
    ta.value = character[name] ?? '';
    ta.addEventListener('input', () => autosave.schedule({ [name]: ta.value }));
    return ta;
  };

  // ── 대표 대사 ──
  const quoteList = h('ul', { class: 'cd-quotes' });
  const saveQuotes = () => autosave.schedule({ quotes: [...quotes] });
  function renderQuotes(focusIndex = -1) {
    quoteList.replaceChildren(
      ...quotes.map((text, index) => {
        const input = h('input', {
          type: 'text',
          value: text ?? '',
          'aria-label': `대표 대사 ${index + 1}`,
          autocomplete: 'off',
          oninput: () => {
            quotes[index] = input.value;
            saveQuotes();
          },
        });
        const remove = h(
          'button',
          {
            type: 'button',
            class: 'btn',
            'aria-label': `대표 대사 ${index + 1} 삭제`,
            onclick: () => {
              quotes = removeQuote(quotes, index);
              saveQuotes();
              renderQuotes();
            },
          },
          '삭제',
        );
        if (index === focusIndex) queueMicrotask(() => input.focus());
        return h('li', { class: 'cd-quote' }, input, remove);
      }),
    );
  }
  renderQuotes();
  const addQuoteBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn',
      onclick: () => {
        quotes = addQuote(quotes, '');
        saveQuotes();
        renderQuotes(quotes.length - 1);
      },
    },
    '대사 추가',
  );

  // ── 이미지 ──
  const preview = h('div', { class: 'cd-image-preview' });
  const fileInput = h('input', {
    type: 'file',
    accept: 'image/*',
    class: 'visually-hidden',
    tabindex: '-1',
    'aria-hidden': 'true',
  });
  const pickBtn = h(
    'button',
    { type: 'button', class: 'btn', onclick: () => fileInput.click() },
    '이미지 고르기',
  );
  const removeImageBtn = h('button', { type: 'button', class: 'btn' }, '이미지 제거');

  function revokeAll() {
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.clear();
  }

  function showImage(asset) {
    revokeAll();
    if (asset?.blob) {
      const url = URL.createObjectURL(asset.blob);
      objectUrls.add(url);
      preview.replaceChildren(h('img', { src: url, alt: '캐릭터 이미지' }));
      removeImageBtn.hidden = false;
    } else {
      preview.replaceChildren(h('p', { class: 'cd-empty' }, '이미지가 없습니다'));
      removeImageBtn.hidden = true;
    }
  }
  showImage(initialAsset);

  function setBusy(on) {
    busy = on;
    pickBtn.disabled = on;
    removeImageBtn.disabled = on;
    deleteBtn.disabled = on;
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file || busy) return;
    setBusy(true);
    try {
      await autosave.flush();
      let processed;
      try {
        processed = await processImage(file);
      } catch (err) {
        console.error(err);
        if (!disposed) toast(err instanceof ImageLoadError ? '이미지를 불러올 수 없습니다' : '이미지를 저장하지 못했습니다');
        return;
      }
      let updated;
      try {
        updated = await setCharacterImage(characterId, processed);
        requestAssetGc();
      } catch (err) {
        console.error(err);
        if (!disposed) toast('이미지를 저장하지 못했습니다');
        return;
      }
      const asset = await getAsset(updated.imageAssetId);
      if (!disposed) showImage(asset);
    } finally {
      if (!disposed) setBusy(false);
    }
  });

  removeImageBtn.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try {
      await autosave.flush();
      await removeCharacterImage(characterId);
      requestAssetGc();
      if (!disposed) showImage(null);
    } catch (err) {
      console.error(err);
      if (!disposed) toast('이미지를 저장하지 못했습니다');
    } finally {
      if (!disposed) setBusy(false);
    }
  });

  // ── 등장 회차 (읽기만, 화면을 열 때마다 계산) ──
  const appearanceBlock =
    appearances.length === 0
      ? h('p', { class: 'cd-empty' }, '아직 등장한 회차가 없습니다')
      : h(
          'ol',
          { class: 'cd-appearances' },
          appearances.map((ep) =>
            h(
              'li',
              {},
              h(
                'a',
                {
                  class: 'cd-episode-link',
                  href: formatHash({ name: 'episode', projectId, episodeId: ep.id }),
                },
                h('span', { class: 'cd-episode-number' }, `${ep.number}화`),
                ' ',
                h('span', { class: 'cd-episode-title' }, ep.title || '제목 없음'),
              ),
            ),
          ),
        );

  // ── 캐릭터 삭제 ──
  const deleteBtn = h(
    'button',
    {
      type: 'button',
      class: ['btn', 'btn-danger'],
      onclick: async () => {
        if (busy) return;
        const name = nameInput.value.trim() || UNNAMED;
        const ok = await confirmDialog({
          title: '캐릭터 삭제',
          message: `"${name}" 캐릭터를 삭제할까요? 이미지와 회차·타임라인의 인물 태그도 함께 삭제됩니다.`,
        });
        if (!ok || disposed) return;
        setBusy(true);
        try {
          await autosave.flush();
          autosave.dispose();
          await deleteCharacter(characterId);
          requestAssetGc();
          navigate(listRoute, { replace: true });
        } catch (err) {
          console.error(err);
          if (!disposed) {
            toast('캐릭터를 삭제하지 못했습니다');
            setBusy(false);
          }
        }
      },
    },
    '캐릭터 삭제',
  );

  el.replaceChildren(
    h(
      'section',
      { class: 'character-detail' },
      h(
        'header',
        { class: 'cd-header' },
        h('a', { class: 'cd-back', href: formatHash(listRoute) }, '← 캐릭터 목록'),
        indicator,
      ),
      h('h1', { class: 'screen-title visually-hidden' }, '캐릭터 상세'),
      h(
        'div',
        { class: 'cd-top' },
        h(
          'div',
          { class: 'cd-image' },
          preview,
          h('div', { class: 'cd-actions' }, pickBtn, removeImageBtn, fileInput),
        ),
        h(
          'div',
          { class: 'cd-basic' },
          field('name', '이름', nameInput),
          h(
            'div',
            { class: 'cd-field' },
            h('label', { for: fieldId('role') }, '역할'),
            roleSelect,
            customRoleInput,
          ),
          field('age', '나이', ageInput),
        ),
      ),
      TEXT_FIELDS.map(([name, label]) => field(name, label, textarea(name))),
      h(
        'div',
        { class: 'cd-field' },
        h('h2', { class: 'cd-subtitle' }, '대표 대사'),
        quoteList,
        h('div', { class: 'cd-actions' }, addQuoteBtn),
      ),
      field('memo', '메모', textarea('memo')),
      h('div', { class: 'cd-field' }, h('h2', { class: 'cd-subtitle' }, '등장 회차'), appearanceBlock),
      h('div', { class: 'cd-danger-zone' }, deleteBtn),
    ),
  );

  // 라우터가 flushAll()을 끝낸 뒤 부른다
  return () => {
    disposed = true;
    autosave.dispose();
    revokeAll();
  };
}
