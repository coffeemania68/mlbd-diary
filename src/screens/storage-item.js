// 보관함 자료 편집 화면 (요구사항 1.6, 1.8, 1.9, 13.4~13.14, 5.7, 16.1~16.6)
// 글 입력(제목·본문·태그·주소)은 모두 한 Autosave 인스턴스로 저장한다. 저장 버튼은 없고 머리에 Save_Indicator가 있다.
// 이미지 고르기·삭제 전에는 autosave.flush()로 대기 중인 글 변경을 먼저 저장한다.
// 링크 주소는 change(Enter·포커스 이동) 때 normalizeUrl로 검사하고, 통과한 값만 저장한다.
// 화면을 떠날 때 저장은 라우터의 flushAll()이 하고, 정리 함수는 dispose와 objectURL 해제만 한다.
import '../styles/storage.css';

import { UNTITLED_ITEM } from '../config.js';
import { requestAssetGc } from '../db/asset-gc.js';
import {
  deleteStorageItem,
  getAsset,
  getStorageItem,
  setStorageImage,
  updateStorageItem,
} from '../db/storage.js';
import { createAutosave, showStatus } from '../lib/autosave.js';
import { confirmDialog, h, toast } from '../lib/dom.js';
import { ImageLoadError, processImage } from '../lib/image.js';
import { linkHref, normalizeUrl } from '../lib/links.js';
import { formatHash, navigate } from '../router.js';
import { setLocationExtras } from '../ui.js';
import { chipInput } from './parts/chip-input.js';

const KIND_LABELS = Object.freeze({ image: '이미지', note: '메모', link: '링크' });
const URL_ERROR = 'http 또는 https 주소만 저장할 수 있습니다';

export async function render(el, route) {
  const { projectId, storageItemId } = route;
  const listRoute = { name: 'storage', projectId };

  const item = await getStorageItem(storageItemId);
  if (!item || item.projectId !== projectId) {
    navigate(listRoute, { replace: true });
    return undefined;
  }

  let initialAsset = null;
  if (item.kind === 'image' && item.assetId) {
    try {
      initialAsset = await getAsset(item.assetId);
    } catch (err) {
      console.error(err); // 축소판 없이 연다
    }
  }

  let disposed = false;
  let busy = false; // 이미지 처리·삭제 중에는 버튼을 막는다
  let hasImage = Boolean(initialAsset?.blob);
  /** 마지막으로 검사를 통과해 저장(예약)한 주소 */
  let savedUrl = String(item.url ?? '');
  const objectUrls = new Set();

  setLocationExtras(route, { recordTitle: item.title ?? '' });

  // ── 저장 상태 표시 ──
  const indicator = h('span', { class: 'save-indicator', 'aria-live': 'polite' });
  const autosave = createAutosave({
    save: (patch) => updateStorageItem(storageItemId, patch),
    onStatus: (status) => showStatus(indicator, status),
  });

  const fieldId = (name) => `storage-${name}`;
  const field = (name, label, ...controls) =>
    h('div', { class: 'si-field' }, h('label', { for: fieldId(name) }, label), ...controls);

  // ── 제목 ──
  const titleInput = h('input', {
    type: 'text',
    id: fieldId('title'),
    value: item.title ?? '',
    autocomplete: 'off',
    oninput: () => {
      autosave.schedule({ title: titleInput.value });
      setLocationExtras(route, { recordTitle: titleInput.value });
    },
  });

  // ── 본문 ──
  const bodyInput = h('textarea', { id: fieldId('body'), rows: 5 });
  bodyInput.value = item.body ?? '';
  bodyInput.addEventListener('input', () => autosave.schedule({ body: bodyInput.value }));

  // ── 태그 (앞뒤 공백 정리, 빈 값·중복은 더하지 않음) ──
  const tagsEl = chipInput({
    label: '태그',
    values: Array.isArray(item.tags) ? [...item.tags] : [],
    normalize: (s) => String(s ?? '').trim(),
    onChange: (tags) => autosave.schedule({ tags: [...tags] }),
  });

  // ── 링크 주소 ──
  let linkBlock = null;
  if (item.kind === 'link') {
    const urlError = h('p', { class: 'field-error', id: fieldId('url-error'), 'aria-live': 'polite' });
    const openSlot = h('div', { class: 'si-open' });
    const urlInput = h('input', {
      type: 'text',
      inputmode: 'url',
      id: fieldId('url'),
      value: savedUrl,
      placeholder: 'https://',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      'aria-describedby': fieldId('url-error'),
    });

    const drawOpen = () => {
      const href = linkHref(savedUrl);
      if (href) {
        openSlot.replaceChildren(
          h('a', { class: 'storage-open', href, target: '_blank', rel: 'noopener noreferrer' }, '주소 열기'),
        );
      } else {
        openSlot.replaceChildren();
      }
    };

    urlInput.addEventListener('change', () => {
      const result = normalizeUrl(urlInput.value);
      if (!result.ok) {
        urlError.textContent = URL_ERROR; // 저장하지 않는다. 저장된 값은 마지막 통과 값
        return;
      }
      urlError.textContent = '';
      urlInput.value = result.url;
      if (result.url === savedUrl) return;
      savedUrl = result.url;
      autosave.schedule({ url: savedUrl });
      drawOpen();
    });
    drawOpen();
    linkBlock = field('url', '주소', urlInput, urlError, openSlot);
  }

  // ── 이미지 ──
  let imageBlock = null;
  let pickBtn = null;
  const preview = h('div', { class: 'si-image-preview' });

  function revokeAll() {
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.clear();
  }

  function showImage(asset) {
    revokeAll();
    hasImage = Boolean(asset?.blob);
    if (hasImage) {
      const url = URL.createObjectURL(asset.blob);
      objectUrls.add(url);
      preview.replaceChildren(h('img', { src: url, alt: '자료 이미지' }));
    } else {
      preview.replaceChildren(h('p', { class: 'si-empty' }, '이미지가 없습니다'));
    }
  }

  if (item.kind === 'image') {
    const fileInput = h('input', {
      type: 'file',
      accept: 'image/*',
      class: 'visually-hidden',
      tabindex: '-1',
      'aria-hidden': 'true',
    });
    pickBtn = h('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, '이미지 고르기');

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
          updated = await setStorageImage(storageItemId, processed);
          requestAssetGc();
        } catch (err) {
          console.error(err);
          if (!disposed) toast('이미지를 저장하지 못했습니다');
          return;
        }
        const asset = await getAsset(updated.assetId);
        if (!disposed) showImage(asset);
      } catch (err) {
        console.error(err);
        if (!disposed) toast('이미지를 저장하지 못했습니다');
      } finally {
        if (!disposed) setBusy(false);
      }
    });

    showImage(initialAsset);
    imageBlock = h(
      'div',
      { class: 'si-image' },
      preview,
      h('div', { class: 'si-actions' }, pickBtn, fileInput),
    );
  }

  function setBusy(on) {
    busy = on;
    if (pickBtn) pickBtn.disabled = on;
    deleteBtn.disabled = on;
  }

  // ── 자료 삭제 ──
  const deleteBtn = h(
    'button',
    {
      type: 'button',
      class: ['btn', 'btn-danger'],
      onclick: async () => {
        if (busy) return;
        const title = titleInput.value.trim() || UNTITLED_ITEM;
        const extra = item.kind === 'image' && hasImage ? ' 이미지도 함께 삭제됩니다.' : '';
        const ok = await confirmDialog({
          title: '자료 삭제',
          message: `"${title}"을(를) 삭제할까요?${extra} 삭제하면 되돌릴 수 없습니다.`,
        });
        if (!ok || disposed) return;
        setBusy(true);
        try {
          await autosave.flush();
          autosave.dispose();
          await deleteStorageItem(storageItemId);
          requestAssetGc();
          navigate(listRoute, { replace: true });
        } catch (err) {
          console.error(err);
          if (!disposed) {
            toast('삭제하지 못했습니다');
            setBusy(false);
          }
        }
      },
    },
    '자료 삭제',
  );

  el.replaceChildren(
    h(
      'section',
      { class: 'storage-item' },
      h(
        'header',
        { class: 'si-header' },
        h('a', { class: 'si-back', href: formatHash(listRoute) }, '← 보관함'),
        indicator,
      ),
      h('h1', { class: 'screen-title visually-hidden' }, '자료 편집'),
      h(
        'p',
        { class: 'si-kind' },
        '종류 ',
        h('span', { class: 'si-kind-value' }, KIND_LABELS[item.kind] ?? item.kind),
      ),
      imageBlock,
      field('title', '제목', titleInput),
      linkBlock,
      field('body', item.kind === 'note' ? '메모' : '설명', bodyInput),
      tagsEl,
      h('div', { class: 'si-danger-zone' }, deleteBtn),
    ),
  );

  // 라우터가 flushAll()을 끝낸 뒤 부른다
  return () => {
    disposed = true;
    autosave.dispose();
    revokeAll();
  };
}
