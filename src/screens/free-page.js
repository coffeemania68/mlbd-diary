// 자유 페이지 화면 (요구사항 3.9, 3.10, 14.1). 주소의 pageId로 연다.
// 없거나 다른 작품·다른 종류의 Page면 자유 페이지 목록으로 replace한다.
// 자유 페이지만 손글씨 모드와 잉크 층을 쓴다(inkEnabled: true).
import '../styles/page.css';

import { getPage } from '../db/pages.js';
import { formatHash, navigate, parseHash } from '../router.js';
import { setLocationExtras } from '../ui.js';
import { mountPageScreen } from './page/page-screen.js';

export async function render(el, route) {
  const { projectId, pageId } = route;
  const page = await getPage(pageId);
  if (!page || page.projectId !== projectId || page.kind !== 'free') {
    navigate({ name: 'freePages', projectId }, { replace: true });
    return undefined;
  }
  if (formatHash(parseHash(location.hash)) !== formatHash(route)) return undefined;

  // 위치 문구 "다이어리 › 자유 페이지 › 제목" (비면 shell이 "제목 없는 페이지", 3.3)
  setLocationExtras(route, { recordTitle: page.title ?? '' });
  return mountPageScreen(el, { route, page, inkEnabled: true });
}
