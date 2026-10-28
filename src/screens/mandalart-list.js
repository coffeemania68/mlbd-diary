// 만다라트 목록 화면 (요구사항 11.1~11.4, 11.6, 1.5).
// createdAt 오름차순 상세 링크 목록 + "새 만다라트". 삭제는 상세 화면에서만 한다.
// 목록 화면이라 Autosave가 없다. 정리 함수는 disposed만 표시한다.
import '../styles/mandalart.css';
import { createMandalart, listMandalarts } from '../db/mandalarts.js';
import { UNTITLED_MANDALART } from '../config.js';
import { h, toast } from '../lib/dom.js';
import { formatHash, navigate } from '../router.js';

const TITLE = '만다라트';
const EMPTY_TEXT = '아직 만다라트가 없습니다. 첫 만다라트를 만들어 보세요.';

export async function render(el, route) {
  const { projectId } = route;
  let disposed = false;

  async function onCreate(event) {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const mandalart = await createMandalart(projectId);
      if (disposed) return;
      navigate({ name: 'mandalart', projectId, mandalartId: mandalart.id });
    } catch (err) {
      console.error(err);
      if (!disposed) {
        toast('만다라트를 만들지 못했습니다');
        button.disabled = false;
      }
    }
  }

  const newButton = () =>
    h('button', { type: 'button', class: ['btn', 'btn-primary'], onclick: onCreate }, '새 만다라트');

  const mandalarts = await listMandalarts(projectId);
  if (disposed) return cleanup;

  const head = h(
    'div',
    { class: 'md-list-head' },
    h('h1', { class: 'screen-title' }, TITLE),
    mandalarts.length > 0 ? newButton() : null,
  );

  // 하나도 없으면 안내 문구 + 새 만다라트 버튼 (요구사항 11.6)
  if (mandalarts.length === 0) {
    el.replaceChildren(
      h(
        'section',
        { class: 'md-list' },
        head,
        h('div', { class: 'md-empty' }, h('p', { class: 'md-empty-text' }, EMPTY_TEXT), newButton()),
      ),
    );
    return cleanup;
  }

  const items = mandalarts.map((m) => {
    const hasTitle = Boolean(m.title && m.title.trim());
    return h(
      'li',
      {},
      h(
        'a',
        {
          class: ['md-list-link', hasTitle ? null : 'is-empty'],
          href: formatHash({ name: 'mandalart', projectId, mandalartId: m.id }),
        },
        hasTitle ? m.title : UNTITLED_MANDALART,
      ),
    );
  });

  el.replaceChildren(h('section', { class: 'md-list' }, head, h('ul', { class: 'md-list-items' }, items)));
  return cleanup;

  function cleanup() {
    disposed = true;
  }
}
