// 이미지 위젯: 기기 사진을 원래 비율대로 위젯 안에 보인다 (요구 11.1, 11.2, 11.3, 11.5).
// data: { assetId }
//
// object URL: ctx.assetUrl(assetId)로 받는다. URL은 page-screen이 만들고 화면을 떠날 때 해제하므로
// 이 모듈은 URL을 만들지도 해제하지도 않는다(dispose는 <img> src만 비운다).
// 이미지 처리·Asset 저장·data.assetId 저장·실패 안내(11.4)는 ctx.pickImage(file)가 한다.
// 성공하면 page-screen이 update(next)를 부른다.
import { h } from '../../lib/dom.js';

export const label = '이미지';

export function defaults() {
  return { style: {}, data: { assetId: null } };
}

function readAssetId(widget) {
  const id = widget?.data?.assetId;
  return typeof id === 'string' && id ? id : null;
}

export function render(el, ctx) {
  const isView = () => ctx.getMode() === 'view';
  let busy = false;
  let shownId = null;

  const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'image-file', hidden: true });
  const img = h('img', { class: 'image-photo', alt: '' });
  const pickBtn = h('button', { type: 'button', class: 'image-pick' }, '사진 고르기');
  const changeBtn = h('button', { type: 'button', class: 'image-change' }, '다른 사진');

  function openPicker() {
    if (!isView() || busy) return;
    fileInput.value = '';
    fileInput.click();
  }
  pickBtn.addEventListener('click', openPicker);
  changeBtn.addEventListener('click', openPicker);

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file || busy) return;
    busy = true;
    el.dataset.busy = 'true';
    try {
      await ctx.pickImage(file);
    } finally {
      busy = false;
      delete el.dataset.busy;
    }
  });

  // Asset이 사라졌거나 그림으로 읽을 수 없으면 "사진 고르기"
  img.addEventListener('error', () => showEmpty());

  function showEmpty() {
    shownId = null;
    img.removeAttribute('src');
    el.dataset.empty = 'true';
    el.replaceChildren(pickBtn, fileInput);
  }

  function show(widget) {
    const assetId = readAssetId(widget);
    const url = assetId ? ctx.assetUrl(assetId) : null;
    if (!url) {
      showEmpty();
      return;
    }
    if (shownId === assetId && img.getAttribute('src') === url) return;
    shownId = assetId;
    img.src = url;
    delete el.dataset.empty;
    el.replaceChildren(img, changeBtn, fileInput);
  }

  el.classList.add('widget-image');
  show(ctx.widget);

  return {
    update(widget) {
      show(widget);
    },
    dispose() {
      el.classList.remove('widget-image');
      delete el.dataset.empty;
      delete el.dataset.busy;
      img.removeAttribute('src');
      el.replaceChildren();
    },
  };
}
