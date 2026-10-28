// 서재 화면 (요구사항 8.1, 8.2, 8.7, 8.9~8.11, 9.1).
// 작품 카드 격자: 표지 색 띠, 제목, 최근 수정일. 카드를 누르면 그 작품의 메인으로 간다.
// 카드의 "⋯" 메뉴(<details>)에서 수정·삭제. 끝에 "새 작품" 카드.
//
// 만드는 클래스 이름 (스타일은 styles/library.css):
//   .library / .library-grid / .library-empty / .library-empty-text
//   .library-head            제목 줄 (제목 + .library-guide-link "안내서" 링크)
//   .library-empty-actions   빈 상태 버튼 줄 ("새 작품" + "백업 파일로 복원")
//   .project-card            카드 <li> (--cover에 표지 색)
//   .project-card-link       카드 전체를 덮는 링크 (→ 메인)
//   .project-card-cover      표지 색 띠
//   .project-card-title / .project-card-date
//   .project-card-menu       "⋯" 메뉴 <details>
//   .project-card-menu-button / .project-card-menu-list / .project-card-menu-item
//   .project-card-new        "새 작품" 카드
import '../styles/library.css';

import { clearCurrentProject, getCurrentProjectId } from '../app-state.js';
import { requestAssetGc } from '../db/asset-gc.js';
import { deleteProjectCascade, listProjects } from '../db/projects.js';
import { confirmDialog, h, toast } from '../lib/dom.js';
import { formatHash } from '../router.js';
import { restoreFileButton } from './parts/restore-file.js';

/** 타임스탬프(ms) → 'YYYY.MM.DD' (기기 시간대 기준). 값이 이상하면 빈 문자열 */
export function formatDate(timestamp) {
  if (timestamp === null || timestamp === undefined || timestamp === '') return '';
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}.${mm}.${dd}`;
}

const NEW_PROJECT_HREF = formatHash({ name: 'projectNew' });
const GUIDE_HREF = formatHash({ name: 'guide' });

/** 열린 "⋯" 메뉴를 모두 닫는다 (except는 남긴다) */
function closeMenus(root, except = null) {
  for (const menu of root.querySelectorAll('.project-card-menu[open]')) {
    if (menu !== except) menu.open = false;
  }
}

function projectCard(project, onDelete) {
  const menu = h(
    'details',
    { class: 'project-card-menu' },
    h(
      'summary',
      { class: 'project-card-menu-button', 'aria-label': `${project.title} 메뉴` },
      h('span', { 'aria-hidden': 'true' }, '⋯'),
    ),
    h(
      'div',
      { class: 'project-card-menu-list' },
      h(
        'a',
        {
          class: 'project-card-menu-item',
          href: formatHash({ name: 'projectEdit', projectId: project.id }),
        },
        '수정',
      ),
      h(
        'button',
        {
          type: 'button',
          class: ['project-card-menu-item', 'project-card-menu-danger'],
          onclick: () => {
            menu.open = false;
            onDelete(project);
          },
        },
        '삭제',
      ),
    ),
  );

  return h(
    'li',
    { class: 'project-card', style: { '--cover': project.coverColor } },
    h(
      'a',
      { class: 'project-card-link', href: formatHash({ name: 'main', projectId: project.id }) },
      h('span', { class: 'project-card-cover', 'aria-hidden': 'true' }),
      h('span', { class: 'project-card-title' }, project.title),
      h('span', { class: 'project-card-date' }, formatDate(project.updatedAt)),
    ),
    menu,
  );
}

export async function render(el) {
  let alive = true;

  async function handleDelete(project) {
    const ok = await confirmDialog({
      title: project.title,
      message: '삭제하면 되돌릴 수 없습니다',
      confirmLabel: '삭제',
    });
    if (!ok) return;
    try {
      await deleteProjectCascade(project.id);
      requestAssetGc();
    } catch (err) {
      console.error(err);
      toast('삭제하지 못했습니다');
      return;
    }
    if (getCurrentProjectId() === project.id) clearCurrentProject();
    if (alive) await draw();
  }

  async function draw() {
    const projects = await listProjects();
    if (!alive) return;

    // 제목 줄: 제목 + "안내서" 링크. 작품이 있어도 없어도 보인다 (9.6)
    const title = h(
      'div',
      { class: 'library-head' },
      h('h1', { class: 'screen-title' }, '서재'),
      h('a', { class: ['btn', 'library-guide-link'], href: GUIDE_HREF }, '안내서'),
    );
    if (projects.length === 0) {
      el.replaceChildren(
        h(
          'section',
          { class: 'library' },
          title,
          h(
            'div',
            { class: 'library-empty' },
            h('p', { class: 'library-empty-text' }, '아직 작품이 없습니다. 첫 작품을 만들어 보세요.'),
            h(
              'div',
              { class: 'library-empty-actions' },
              h('a', { class: ['btn', 'btn-primary'], href: NEW_PROJECT_HREF }, '새 작품'),
              // 서재에서 서재로 navigate하면 hashchange가 없으므로 목록을 직접 다시 그린다 (11.5)
              restoreFileButton({
                onRestored: async () => {
                  if (alive) await draw();
                },
              }).el,
            ),
          ),
        ),
      );
      return;
    }

    const grid = h(
      'ul',
      { class: 'library-grid' },
      projects.map((p) => projectCard(p, handleDelete)),
      h(
        'li',
        { class: ['project-card', 'project-card-new'] },
        h(
          'a',
          { class: 'project-card-link', href: NEW_PROJECT_HREF },
          h('span', { class: 'project-card-new-icon', 'aria-hidden': 'true' }, '+'),
          h('span', { class: 'project-card-title' }, '새 작품'),
        ),
      ),
    );
    // 메뉴 하나를 열면 다른 메뉴는 닫는다
    grid.addEventListener(
      'toggle',
      (event) => {
        if (event.target.open) closeMenus(grid, event.target);
      },
      true,
    );
    el.replaceChildren(h('section', { class: 'library' }, title, grid));
  }

  // 메뉴 바깥을 누르면 열린 메뉴를 닫는다
  function onDocumentClick(event) {
    if (!event.target.closest?.('.project-card-menu')) closeMenus(el);
  }
  document.addEventListener('click', onDocumentClick);

  try {
    await draw();
  } catch (err) {
    document.removeEventListener('click', onDocumentClick);
    throw err;
  }

  return () => {
    alive = false;
    document.removeEventListener('click', onDocumentClick);
  };
}
