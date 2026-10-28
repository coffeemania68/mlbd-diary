// 메인 화면 (요구사항 1.1~1.4, 19.1~19.5). 작품의 Main_Page를 찾거나 기본 배치로 만든 뒤 페이지 화면으로 연다.
// 메인·월간 페이지는 손글씨를 쓰지 않는다(14.11).
// 위쪽 .backup-reminder-slot에 백업 알림 띠를 그린다. 페이지 화면을 여는 것은 기다리지 않는다.
import '../styles/page.css';

import { BACKUP_REMINDER_DAYS } from '../config.js';
import { db } from '../db/db.js';
import { ensureMainPage } from '../db/pages.js';
import { getSettings } from '../db/settings.js';
import { localDateOf } from '../db/snapshots.js';
import { shouldShowReminder } from '../lib/backup-rules.js';
import { h } from '../lib/dom.js';
import { formatHash, parseHash } from '../router.js';
import { backupButtons } from './parts/backup-buttons.js';
import { mountPageScreen } from './page/page-screen.js';

/** 백업 알림 띠. 조건(19.1, 19.2, 19.5)에 맞을 때만 slot에 그린다. 저장되면 없앤다(19.4) */
export async function mountBackupReminder(slot) {
  try {
    const [settings, projectCount] = await Promise.all([getSettings(), db.projects.count()]);
    const lastBackupAt = settings?.lastBackupAt ?? null;
    if (!slot.isConnected) return;
    if (!shouldShowReminder({ lastBackupAt, projectCount, now: Date.now() })) {
      slot.replaceChildren();
      return;
    }
    const message =
      lastBackupAt == null
        ? '아직 백업하지 않았습니다'
        : `마지막 백업: ${localDateOf(lastBackupAt)} · ${BACKUP_REMINDER_DAYS}일이 지났습니다`;
    slot.replaceChildren(
      h(
        'div',
        { class: 'backup-reminder', role: 'status' },
        h('p', { class: 'backup-reminder-text' }, message),
        backupButtons({ onSaved: () => slot.replaceChildren() }),
      ),
    );
  } catch (err) {
    // 알림 띠가 없어도 메인 화면은 쓸 수 있다
    console.error(err);
  }
}

export async function render(el, route) {
  const page = await ensureMainPage(route.projectId);
  // 기다리는 사이 다른 화면으로 갔으면 그리지 않는다
  if (formatHash(parseHash(location.hash)) !== formatHash(route)) return undefined;

  const banner = h('div', { class: 'backup-reminder-slot' });
  const pageEl = h('div', { class: 'page-host' });
  el.replaceChildren(banner, pageEl);
  mountBackupReminder(banner);
  // 정리 함수를 그대로 돌려준다. 그리는 사이 이동했으면 라우터가 바로 실행한다
  return mountPageScreen(pageEl, { route, page, inkEnabled: false });
}
