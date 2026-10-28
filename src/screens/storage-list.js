// 보관함 목록 화면 (요구사항 1.6, 13.1~13.3, 13.10, 13.15, 14.1~14.4, 16.4~16.7)
// 머리의 "새 자료" → 종류 버튼(이미지 / 메모 / 링크)·"취소"가 그 자리에 펼쳐진다.
// Tag_Filter 버튼 줄 + 카드 격자. 필터를 바꾸면 버튼 줄과 격자만 다시 그린다.
// 카드는 <article> 안에 편집 링크와 (링크 자료면) 형제 "주소 열기" 링크를 둔다. 링크 안에 링크를 넣지 않는다.
// 목록 화면이라 Autosave가 없다. 정리 함수는 축소판 objectURL 해제만 한다.
import '../styles/storage.css';

import { UNTITLED_ITEM } from '../config.js';
import { createStorageItem, getAsset, listStorageItems } from '../db/storage.js';
import { h, toast } from '../lib/dom.js';
import { ALL, filterView, isSameOption, optionLabel } from '../lib/filter.js';
import { linkHref, urlHost } from '../lib/links.js';
import { formatHash, navigate } from '../router.js';

const EMPTY_TEXT = '아직 자료가 없습니다. 참고할 이미지·메모·링크를 모아 보세요.';
const BODY_PREVIEW_CHARS = 80;

/** 자료 종류 → 표시 이름 (storage-item.js에도 같은 표가 있다) */
const KIND_LABELS = Object.freeze({ image: '이미지', note: '메모', link: '링크' });
const KINDS = ['image', 'note', 'link'];

const titleOf = (item) => String(item.title ?? '').trim();

function bodyPreview(body) {
  const text = String(body ?? '').trim();
  return text.length > BODY_PREVIEW_CHARS ? `${text.slice(0, BODY_PREVIEW_CHARS)}…` : text;
}

export async function render(el, route) {
  const { projectId } = route;
  let disposed = false;
  let creating = false;
  /** Tag_Filter 선택값 ({ all: true } 또는 { value }). 화면을 다시 열면 "전체" */
  let selected = ALL;
  /** assetId → object URL. 화면을 떠날 때 모두 해제한다 */
  const urls = new Map();

  const items = await listStorageItems(projectId); // createdAt 내림차순
  if (disposed) return cleanup;

  // 이미지 자료의 축소판만 읽는다 (Asset을 못 읽으면 축소판 없이 그린다)
  await Promise.all(
    items.map(async (item) => {
      if (item.kind !== 'image' || !item.assetId || urls.has(item.assetId)) return;
      try {
        const asset = await getAsset(item.assetId);
        if (asset?.blob && !urls.has(item.assetId)) urls.set(item.assetId, URL.createObjectURL(asset.blob));
      } catch (err) {
        console.error(err);
      }
    }),
  );
  if (disposed) return cleanup;

  // ── 새 자료: 버튼 하나 ↔ 종류 버튼 3개 + 취소 ──
  function newArea() {
    const area = h('div', { class: 'storage-new' });
    const openBtn = h(
      'button',
      { type: 'button', class: ['btn', 'btn-primary'], 'aria-expanded': 'false', onclick: () => expand(true) },
      '새 자료',
    );
    const kindButtons = KINDS.map((kind) =>
      h(
        'button',
        { type: 'button', class: ['btn', 'btn-primary'], onclick: (event) => onCreate(kind, event.currentTarget) },
        KIND_LABELS[kind],
      ),
    );
    const cancelBtn = h('button', { type: 'button', class: 'btn', onclick: () => expand(false) }, '취소');
    const choices = h(
      'div',
      { class: 'storage-new-kinds', role: 'group', 'aria-label': '자료 종류 고르기' },
      kindButtons,
      cancelBtn,
    );

    function expand(on) {
      openBtn.hidden = on;
      choices.hidden = !on;
      openBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) kindButtons[0].focus();
      else openBtn.focus();
    }

    openBtn.hidden = false;
    choices.hidden = true;
    area.append(openBtn, choices);
    return area;
  }

  async function onCreate(kind, button) {
    if (creating) return;
    creating = true;
    button.disabled = true;
    try {
      const item = await createStorageItem(projectId, kind);
      if (disposed) return;
      navigate({ name: 'storageItem', projectId, storageItemId: item.id });
    } catch (err) {
      console.error(err);
      if (!disposed) {
        toast('자료를 만들지 못했습니다');
        button.disabled = false;
      }
    } finally {
      creating = false;
    }
  }

  const head = h('div', { class: 'storage-head' }, h('h1', { class: 'screen-title' }, '보관함'), newArea());

  // 자료가 하나도 없으면 안내 문구 + 새 자료 만들기 (요구사항 13.15)
  if (items.length === 0) {
    el.replaceChildren(
      h(
        'section',
        { class: 'storage-list' },
        head,
        h('div', { class: 'storage-empty' }, h('p', { class: 'storage-empty-text' }, EMPTY_TEXT)),
      ),
    );
    return cleanup;
  }

  // ── 카드 ──
  function card(item) {
    const title = titleOf(item);
    const parts = [];
    if (item.kind === 'image') {
      const url = item.assetId ? urls.get(item.assetId) : null;
      parts.push(
        url
          ? h('img', { class: 'storage-thumb', src: url, alt: '', loading: 'lazy', decoding: 'async' })
          : h('div', { class: ['storage-thumb', 'storage-thumb-empty'], 'aria-hidden': 'true' }, '이미지 없음'),
      );
    }
    parts.push(h('span', { class: 'storage-kind' }, KIND_LABELS[item.kind] ?? item.kind));
    parts.push(h('span', { class: ['storage-title', title ? null : 'is-empty'] }, title || UNTITLED_ITEM));
    if (item.kind === 'note') {
      const preview = bodyPreview(item.body);
      if (preview) parts.push(h('span', { class: 'storage-body' }, preview));
    }
    if (item.kind === 'link') {
      const host = urlHost(item.url);
      if (host) parts.push(h('span', { class: 'storage-host' }, host));
    }

    const href = item.kind === 'link' ? linkHref(item.url) : null;
    return h(
      'li',
      {},
      h(
        'article',
        { class: ['storage-card', `storage-card-${item.kind}`] },
        h(
          'a',
          { class: 'storage-card-link', href: formatHash({ name: 'storageItem', projectId, storageItemId: item.id }) },
          parts,
        ),
        href
          ? h(
              'a',
              { class: 'storage-open', href, target: '_blank', rel: 'noopener noreferrer' },
              '주소 열기',
            )
          : null,
      ),
    );
  }

  // ── Tag_Filter + 격자 ──
  const filterEl = h('div', { class: ['filter-row', 'storage-filter'], role: 'group', 'aria-label': '태그 필터' });
  const gridEl = h('ul', { class: 'storage-grid' });
  const noMatchEl = h('p', { class: 'storage-empty-text' }, '이 태그의 자료가 없습니다');

  function draw() {
    const view = filterView(items, (s) => s.tags ?? [], selected);
    // 선택한 태그가 사라졌으면 "전체"로 돌아간 결과를 기억한다 (요구사항 14.4)
    selected = view.selected;
    filterEl.replaceChildren(
      ...view.options.map((option) =>
        h(
          'button',
          {
            type: 'button',
            class: 'chip',
            'aria-pressed': isSameOption(option, view.selected) ? 'true' : 'false',
            onclick: () => {
              if (isSameOption(option, selected)) return;
              selected = option;
              draw();
            },
          },
          optionLabel(option),
        ),
      ),
    );
    gridEl.replaceChildren(...view.visible.map(card));
    noMatchEl.hidden = view.visible.length > 0;
  }
  draw();

  el.replaceChildren(h('section', { class: 'storage-list' }, head, filterEl, gridEl, noMatchEl));
  return cleanup;

  function cleanup() {
    disposed = true;
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
  }
}
