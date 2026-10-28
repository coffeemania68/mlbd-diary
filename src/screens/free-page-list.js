// 자유 페이지 목록 화면 (요구사항 3.1~3.8, 4.1~4.3, mlbd-final-block 4.3·4.4·4.6).
// 새 페이지 버튼은 템플릿 선택 창(choiceDialog)을 띄우고 고른 템플릿으로 만든다.
// order 오름차순으로 제목(비면 "제목 없는 페이지")과 최근 수정일. 항목을 누르면 그 페이지로 간다.
// 항목마다 이름 바꾸기(promptDialog → renamePage)와 삭제(confirmDialog → deletePage → requestAssetGc).
// 목록 화면이라 Autosave가 없다. 정리 함수는 alive만 끈다.
//
// 만드는 클래스 이름 (스타일은 styles/page.css):
//   .fp-list / .fp-list-head / .fp-list-items / .fp-item / .fp-item-link
//   .fp-item-title / .fp-item-date / .fp-item-actions / .fp-empty / .fp-empty-text
import '../styles/page.css';

import { PAGE_TEMPLATES, UNTITLED_PAGE } from '../config.js';
import { requestAssetGc } from '../db/asset-gc.js';
import { createFreePageFromTemplate, deletePage, listFreePages, renamePage } from '../db/pages.js';
import { choiceDialog, confirmDialog, h, promptDialog, toast } from '../lib/dom.js';
import { formatHash, navigate } from '../router.js';
import { formatDate } from './library.js';

const TITLE = '자유 페이지';
const EMPTY_TEXT = '아직 자유 페이지가 없습니다. 첫 페이지를 만들어 보세요.';

const pageTitle = (page) => String(page.title ?? '').trim() || UNTITLED_PAGE;

export async function render(el, route) {
  const { projectId } = route;
  let alive = true;

  async function onCreate(event) {
    const button = event.currentTarget;
    button.disabled = true;
    // 템플릿 고르기 (4.3). 닫으면 아무것도 만들지 않는다 (4.6)
    const templateId = await choiceDialog({
      title: '새 페이지 템플릿',
      options: PAGE_TEMPLATES.map((t) => ({ value: t.id, label: t.label })),
    });
    if (!alive) return;
    if (templateId === null) {
      button.disabled = false;
      return;
    }
    try {
      const page = await createFreePageFromTemplate(projectId, templateId);
      if (!alive) return;
      navigate({ name: 'freePage', projectId, pageId: page.id });
    } catch (err) {
      console.error(err);
      if (alive) {
        toast('페이지를 만들지 못했습니다');
        button.disabled = false;
      }
    }
  }

  async function onRename(page) {
    const value = await promptDialog({ title: '페이지 이름 바꾸기', value: page.title ?? '' });
    if (value === null) return;
    try {
      await renamePage(page.id, value);
    } catch (err) {
      console.error(err);
      toast('이름을 바꾸지 못했습니다');
      return;
    }
    if (alive) await draw();
  }

  async function onDelete(page) {
    const ok = await confirmDialog({
      title: pageTitle(page),
      message: '삭제하면 되돌릴 수 없습니다',
      confirmLabel: '삭제',
    });
    if (!ok) return;
    try {
      await deletePage(page.id);
    } catch (err) {
      console.error(err);
      toast('삭제하지 못했습니다');
      return;
    }
    requestAssetGc();
    if (alive) await draw();
  }

  const newButton = () =>
    h('button', { type: 'button', class: ['btn', 'btn-primary'], onclick: onCreate }, '새 페이지');

  function item(page) {
    const hasTitle = Boolean(String(page.title ?? '').trim());
    const name = pageTitle(page);
    return h(
      'li',
      { class: 'fp-item' },
      h(
        'a',
        { class: 'fp-item-link', href: formatHash({ name: 'freePage', projectId, pageId: page.id }) },
        h('span', { class: ['fp-item-title', hasTitle ? null : 'is-empty'] }, name),
        h('span', { class: 'fp-item-date' }, formatDate(page.updatedAt)),
      ),
      h(
        'div',
        { class: 'fp-item-actions' },
        h(
          'button',
          { type: 'button', class: 'btn', 'aria-label': `${name} 이름 바꾸기`, onclick: () => onRename(page) },
          '이름 바꾸기',
        ),
        h(
          'button',
          { type: 'button', class: ['btn', 'fp-item-delete'], 'aria-label': `${name} 삭제`, onclick: () => onDelete(page) },
          '삭제',
        ),
      ),
    );
  }

  async function draw() {
    const pages = await listFreePages(projectId);
    if (!alive) return;

    const head = h(
      'div',
      { class: 'fp-list-head' },
      h('h1', { class: 'screen-title' }, TITLE),
      pages.length > 0 ? newButton() : null,
    );

    // 하나도 없으면 안내 문구 + 새 페이지 버튼 (3.8)
    const body =
      pages.length === 0
        ? h('div', { class: 'fp-empty' }, h('p', { class: 'fp-empty-text' }, EMPTY_TEXT), newButton())
        : h('ul', { class: 'fp-list-items' }, ...pages.map(item));

    el.replaceChildren(h('section', { class: 'fp-list' }, head, body));
  }

  await draw();

  return () => {
    alive = false;
  };
}
