// 캐릭터 카드 위젯: Character의 이미지·이름·역할·첫 대표 대사 (요구 13.1, 13.3, 13.4, 13.6, 13.7).
// data: { characterId }
// 추가할 때 pick(ctx)이 Current_Project의 캐릭터 목록을 DB에서 읽어 choiceDialog로 고르게 한다(6.3, 26.6).
// 그릴 때마다 ctx.characters(page-screen이 화면을 열 때·위젯을 추가할 때 읽은 Current_Project 캐릭터)와
// ctx.assets의 현재 값을 쓴다. 이미지 URL은 ctx.assetUrl로 받고 해제하지 않는다.
// 보기 모드에서 누르면 Character_Detail_Screen. 대상이 없으면 "삭제된 항목"을 보이고 눌러도 이동하지 않는다.
// 사용자 글자는 textContent로만 넣는다(h의 문자열 자식은 텍스트 노드).
import { h, choiceDialog, toast } from '../../lib/dom.js';
import { listCharacters } from '../../db/characters.js';

export const label = '캐릭터 카드';

export const NO_NAME = '이름 없음';
export const DELETED_TEXT = '삭제된 항목';
export const NO_CHARACTERS_TEXT = '이 작품에 캐릭터가 없습니다. 설정집에서 먼저 만들어 주세요.';

export function defaults() {
  return { style: {}, data: { characterId: null } };
}

export function characterName(c) {
  const name = typeof c?.name === 'string' ? c.name.trim() : '';
  return name || NO_NAME;
}

/** 첫 번째 대표 대사(빈 문자열은 건너뛴다). 없으면 '' */
export function firstQuote(c) {
  const quotes = Array.isArray(c?.quotes) ? c.quotes : [];
  const found = quotes.find((q) => typeof q === 'string' && q.trim());
  return found ? found.trim() : '';
}

/** data.characterId가 가리키는 Current_Project의 Character. 없으면 null */
export function resolveCharacter(data, characters, projectId) {
  const id = data?.characterId;
  if (typeof id !== 'string' || !id || !characters?.has?.(id)) return null;
  const c = characters.get(id);
  if (!c || (projectId != null && c.projectId !== projectId)) return null;
  return c;
}

export async function pick(ctx) {
  const list = await listCharacters(ctx.projectId);
  if (list.length === 0) {
    toast(NO_CHARACTERS_TEXT);
    return null;
  }
  const characterId = await choiceDialog({
    title: '캐릭터 고르기',
    options: list.map((c) => ({
      value: c.id,
      label: c.role ? `${characterName(c)} · ${c.role}` : characterName(c),
    })),
  });
  if (characterId == null) return null;
  return { characterId };
}

export function render(el, ctx) {
  let current = null; // 지금 보이는 Character, 없으면 null

  function onClick() {
    if (ctx.getMode() !== 'view' || !current) return;
    ctx.open({ name: 'character', projectId: ctx.projectId, characterId: current.id });
  }

  function draw(widget) {
    current = resolveCharacter(widget?.data, ctx.characters, ctx.projectId);
    if (!current) {
      el.dataset.deleted = 'true';
      el.replaceChildren(h('div', { class: 'card-deleted' }, DELETED_TEXT));
      return;
    }
    delete el.dataset.deleted;
    const url = current.imageAssetId ? ctx.assetUrl(current.imageAssetId) : null;
    const thumb = url
      ? h('img', { class: 'ccard-thumb', src: url, alt: '', decoding: 'async' })
      : h('div', { class: ['ccard-thumb', 'is-empty'], 'aria-hidden': 'true' });
    const name = characterName(current);
    const quote = firstQuote(current);
    const button = h(
      'button',
      { type: 'button', class: 'card-btn ccard', 'aria-label': `${name} 캐릭터 열기`, onclick: onClick },
      thumb,
      h(
        'span',
        { class: 'ccard-text' },
        h('span', { class: ['ccard-name', name === NO_NAME ? 'is-empty' : null] }, name),
        current.role ? h('span', { class: 'ccard-role' }, current.role) : null,
        quote ? h('span', { class: 'ccard-quote' }, `“${quote}”`) : null,
      ),
    );
    el.replaceChildren(button);
  }

  el.classList.add('widget-card', 'widget-character-card');
  draw(ctx.widget);

  return {
    update(widget) {
      draw(widget);
    },
    dispose() {
      current = null;
      el.classList.remove('widget-card', 'widget-character-card');
      delete el.dataset.deleted;
      el.replaceChildren();
    },
  };
}
