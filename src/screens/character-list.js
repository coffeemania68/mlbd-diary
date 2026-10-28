// 캐릭터 목록 화면 (요구사항 10.1~10.9, 9.3, 18.3).
// 역할 필터(가로 칩 줄) + 카드 격자. 필터를 바꾸면 격자만 다시 그린다.
// 필터 선택은 아래 모듈 변수에 작품별로 기억한다. 새로고침하면 "전체"로 돌아간다.
import '../styles/characters.css';
import { listCharacters, createCharacter, getAsset } from '../db/characters.js';
import { roleFilterView, roleOptionLabel, isSameRoleOption, ALL_ROLES } from '../lib/roles.js';
import { h, toast } from '../lib/dom.js';
import { formatHash, navigate } from '../router.js';

const EMPTY_TEXT = '아직 캐릭터가 없습니다. 첫 캐릭터를 만들어 보세요.';
const NO_NAME = '이름 없음';

/** projectId → 마지막으로 고른 필터 선택값 ({ all: true } 또는 { role }) */
const selectedByProject = new Map();

export async function render(el, route) {
  const { projectId } = route;
  let disposed = false;
  /** assetId → object URL. 격자를 다시 그려도 재사용하고, 화면을 떠날 때 모두 해제한다 */
  const urls = new Map();

  async function onCreate(event) {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const character = await createCharacter(projectId);
      if (disposed) return;
      navigate({ name: 'character', projectId, characterId: character.id });
    } catch (err) {
      console.error(err);
      toast('캐릭터를 만들지 못했습니다');
      button.disabled = false;
    }
  }

  const newButton = () =>
    h('button', { type: 'button', class: ['btn', 'btn-primary'], onclick: onCreate }, '새 캐릭터');

  const characters = await listCharacters(projectId);
  if (disposed) return cleanup;

  // 캐릭터가 하나도 없으면 안내 문구 + 새 캐릭터 버튼 (요구사항 10.8)
  if (characters.length === 0) {
    el.replaceChildren(
      h(
        'section',
        { class: 'character-list' },
        h('h1', { class: 'screen-title' }, '캐릭터'),
        h('div', { class: 'character-empty' }, h('p', { class: 'character-empty-text' }, EMPTY_TEXT), newButton()),
      ),
    );
    return cleanup;
  }

  // 축소판 URL을 미리 만든다 (Asset을 못 읽으면 축소판 없이 그린다)
  await Promise.all(
    characters.map(async (c) => {
      if (!c.imageAssetId || urls.has(c.imageAssetId)) return;
      try {
        const asset = await getAsset(c.imageAssetId);
        if (asset?.blob && !urls.has(c.imageAssetId)) {
          urls.set(c.imageAssetId, URL.createObjectURL(asset.blob));
        }
      } catch (err) {
        console.error(err);
      }
    }),
  );
  if (disposed) return cleanup;

  const filterEl = h('div', { class: 'role-filter', role: 'group', 'aria-label': '역할 필터' });
  const gridEl = h('ul', { class: 'character-grid' });

  function card(c) {
    const url = c.imageAssetId ? urls.get(c.imageAssetId) : null;
    const thumb = url
      ? h('img', { class: 'character-thumb', src: url, alt: '', loading: 'lazy', decoding: 'async' })
      : h('div', { class: ['character-thumb', 'character-thumb-empty'], 'aria-hidden': 'true' });
    const name = c.name && c.name.trim() ? c.name : NO_NAME;
    return h(
      'li',
      {},
      h(
        'a',
        {
          class: 'character-card',
          href: formatHash({ name: 'character', projectId, characterId: c.id }),
        },
        thumb,
        h('span', { class: ['character-name', name === NO_NAME ? 'is-empty' : null] }, name),
        c.role ? h('span', { class: 'character-role' }, c.role) : null,
      ),
    );
  }

  /** 칩 눌림 상태와 격자만 다시 그린다. 선택지 자체는 이 화면에 있는 동안 바뀌지 않는다 */
  function drawGrid() {
    const view = roleFilterView(characters, selectedByProject.get(projectId) ?? ALL_ROLES);
    // 선택된 역할이 사라졌으면 "전체"로 돌아간 결과를 기억한다 (요구사항 10.7)
    selectedByProject.set(projectId, view.selected);
    for (const chip of chips) {
      chip.el.setAttribute('aria-pressed', isSameRoleOption(chip.option, view.selected) ? 'true' : 'false');
    }
    gridEl.replaceChildren(...view.visible.map(card));
  }

  const { options } = roleFilterView(characters, ALL_ROLES);
  const chips = options.map((option) => ({
    option,
    el: h(
      'button',
      {
        type: 'button',
        class: 'chip',
        'aria-pressed': 'false',
        onclick: () => {
          if (isSameRoleOption(option, selectedByProject.get(projectId))) return;
          selectedByProject.set(projectId, option);
          drawGrid();
        },
      },
      roleOptionLabel(option),
    ),
  }));
  filterEl.replaceChildren(...chips.map((c) => c.el));
  drawGrid();
  el.replaceChildren(
    h(
      'section',
      { class: 'character-list' },
      h('div', { class: 'character-list-head' }, h('h1', { class: 'screen-title' }, '캐릭터'), newButton()),
      filterEl,
      gridEl,
    ),
  );

  return cleanup;

  function cleanup() {
    disposed = true;
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
  }
}
