// 설정 화면 (요구사항 16.5, 5.3, 18~21, 6.4, 6.5, 9.6, 10).
// 순서: 정보 목록(앱 버전, 데이터 버전, 저장소 영구 보존) → 테마 → 안내서 → 문의(버그 제보) → 백업·복원.
// 백업 파일은 기기 안에서만 만들고 읽는다. 서버로 보내지 않는다(26.9).
// 파일 복원 흐름·문구는 parts/restore-file.js(서재·첫 실행 안내와 공유)에 있다.
// 새 구역(.settings-block, .theme-*, .contact-note) 스타일은 styles/guide.css에 있다.
import '../styles/guide.css';

import { APP_VERSION, BUG_REPORT_URL, SCHEMA_VERSION, THEMES } from '../config.js';
import { getSettings, updateSettings } from '../db/settings.js';
import { listSnapshots, localDateOf, restoreSnapshot } from '../db/snapshots.js';
import { flushAll } from '../lib/autosave.js';
import { bugReportHref } from '../lib/contact.js';
import { confirmDialog, h, toast } from '../lib/dom.js';
import { resolveTheme } from '../lib/themes.js';
import { formatHash } from '../router.js';
import { getPersistenceStatus } from '../storage.js';
import { applyTheme } from '../theme.js';
import { backupButtons } from './parts/backup-buttons.js';
import {
  OVERWRITE_TEXT,
  RESTORE_FAILED_TEXT,
  finishRestore,
  lockWhileRestoring,
  restoreFileButton,
  runExclusive,
} from './parts/restore-file.js';

export const PERSISTENCE_TEXT = {
  granted: '허용됨',
  denied: '허용 안 됨',
  unsupported: '이 브라우저는 확인할 수 없음',
};

const NO_SNAPSHOT_TEXT = '자동 보관된 상태가 아직 없습니다';
const SNAPSHOT_REASON_TEXT = { daily: '자동 보관', 'pre-restore': '복원 직전' };

export const THEME_SAVE_FAILED_TEXT = '테마를 저장하지 못했습니다';
export const CONTACT_NOTE_TEXT = '개별 답변은 드리지 않습니다. 수정 사항은 공지로 알려 드립니다';
export const CONTACT_PENDING_TEXT = '제보 양식 주소는 후원자 공지에서 알려 드립니다';

function row(label, value) {
  return h(
    'li',
    { class: 'settings-row' },
    h('span', { class: 'settings-label' }, label),
    h('span', { class: 'settings-value' }, value),
  );
}

/** 테마 구역 (6.4, 6.5): 테마마다 aria-pressed 버튼 하나, 이름 + 바탕·강조 색 견본 */
function themeSection(settings) {
  let currentId = resolveTheme(settings?.defaultThemeId).id;
  let saving = false;

  const buttons = THEMES.map((theme) =>
    h(
      'button',
      {
        type: 'button',
        class: 'theme-choice',
        'aria-pressed': String(theme.id === currentId),
        dataset: { themeId: theme.id },
        onclick: () => choose(theme.id),
      },
      h('span', {
        class: 'theme-swatch',
        'aria-hidden': 'true',
        style: { '--swatch': theme.vars['--color-bg'] },
      }),
      h('span', {
        class: 'theme-swatch',
        'aria-hidden': 'true',
        style: { '--swatch': theme.vars['--color-accent'] },
      }),
      h('span', { class: 'theme-choice-label' }, theme.label),
    ),
  );

  function markPressed() {
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.themeId === currentId));
  }

  async function choose(id) {
    if (saving || id === currentId) return;
    saving = true;
    const previousId = currentId;
    try {
      await updateSettings({ defaultThemeId: id });
      currentId = applyTheme(id).id;
    } catch (err) {
      console.error(err);
      toast(THEME_SAVE_FAILED_TEXT);
      currentId = applyTheme(previousId).id;
    } finally {
      saving = false;
      markPressed();
    }
  }

  return h(
    'section',
    { class: 'settings-block', 'aria-labelledby': 'settings-theme-title' },
    h('h2', { id: 'settings-theme-title' }, '테마'),
    h('div', { class: 'theme-choices', role: 'group', 'aria-label': '테마 고르기' }, ...buttons),
  );
}

/** 안내서 구역 (9.6) */
function guideSection() {
  return h(
    'section',
    { class: 'settings-block', 'aria-labelledby': 'settings-guide-title' },
    h('h2', { id: 'settings-guide-title' }, '안내서'),
    h(
      'div',
      { class: 'settings-block-links' },
      h('a', { class: 'btn', href: formatHash({ name: 'guide' }) }, '안내서'),
      h('a', { class: 'btn', href: formatHash({ name: 'faq' }) }, '자주 묻는 질문'),
    ),
  );
}

/** 문의(버그 제보) 구역 (10.2~10.4) */
function contactSection() {
  const href = bugReportHref(BUG_REPORT_URL);
  return h(
    'section',
    { class: 'settings-block', 'aria-labelledby': 'settings-contact-title' },
    h('h2', { id: 'settings-contact-title' }, '문의(버그 제보)'),
    h('p', { class: 'contact-note' }, CONTACT_NOTE_TEXT),
    href
      ? h(
          'a',
          { class: 'btn', href, target: '_blank', rel: 'noopener noreferrer' },
          '버그 제보 양식 열기',
        )
      : h('p', { class: 'contact-note' }, CONTACT_PENDING_TEXT),
  );
}

/** "마지막 백업: YYYY-MM-DD" / "마지막 백업: 없음" (19.6) */
function lastBackupText(lastBackupAt) {
  return `마지막 백업: ${lastBackupAt == null ? '없음' : localDateOf(lastBackupAt)}`;
}

/** createdAt → 'YYYY-MM-DD HH:MM' (기기 지역 시각) */
function dateTimeText(time) {
  const d = new Date(time);
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${localDateOf(time)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** '2027-10-30 21:04 · 자동 보관 · 작품 2개' (23.1) */
function snapshotLineText(snapshot) {
  const reason = SNAPSHOT_REASON_TEXT[snapshot.reason] ?? SNAPSHOT_REASON_TEXT.daily;
  return `${dateTimeText(snapshot.createdAt)} · ${reason} · 작품 ${snapshot.projectCount ?? 0}개`;
}

/** 스냅샷 하나로 복원한다 (23.2~23.9). 성공하면 true */
async function restoreFromSnapshot(snapshot) {
  const ok = await confirmDialog({
    title: '자동 보관 상태로 복원',
    message: `${dateTimeText(snapshot.createdAt)} 상태. ${OVERWRITE_TEXT}`,
    confirmLabel: '복원',
  });
  if (!ok) return false;
  try {
    await flushAll();
    await restoreSnapshot(snapshot.id);
  } catch (err) {
    console.error(err);
    toast(RESTORE_FAILED_TEXT);
    return false;
  }
  await finishRestore();
  return true;
}

function backupSection(settings, snapshots) {
  const dateEl = h('p', { class: 'backup-last' }, lastBackupText(settings?.lastBackupAt ?? null));

  // 파일 복원과 스냅샷 복원은 한 번에 하나만 (runExclusive가 앱 전체에서 막는다)
  const restoreFile = restoreFileButton();

  const snapshotList =
    snapshots.length === 0
      ? h('p', { class: 'snapshot-empty' }, NO_SNAPSHOT_TEXT)
      : h(
          'ul',
          { class: 'snapshot-list' },
          snapshots.map((snapshot) => {
            const btn = h(
              'button',
              {
                type: 'button',
                class: ['btn', 'backup-btn', 'snapshot-restore-btn'],
                'aria-label': `${dateTimeText(snapshot.createdAt)} 상태로 복원`,
                onclick: () => runExclusive(() => restoreFromSnapshot(snapshot)),
              },
              '복원',
            );
            lockWhileRestoring(btn);
            return h(
              'li',
              { class: 'snapshot-row' },
              h('span', { class: 'snapshot-text' }, snapshotLineText(snapshot)),
              btn,
            );
          }),
        );

  return h(
    'section',
    { class: 'backup-section', 'aria-labelledby': 'backup-section-title' },
    h('h2', { class: 'backup-section-title', id: 'backup-section-title' }, '백업·복원'),
    dateEl,
    backupButtons({
      onSaved: (at) => {
        dateEl.textContent = lastBackupText(at);
      },
    }),
    h('div', { class: 'backup-buttons' }, restoreFile.el),
    h('h3', { class: 'snapshot-title' }, '앱 안 자동 보관'),
    snapshotList,
  );
}

export async function render(el) {
  const [status, settings, snapshots] = await Promise.all([
    getPersistenceStatus(),
    getSettings(),
    listSnapshots().catch((err) => {
      console.error(err);
      return [];
    }),
  ]);
  el.replaceChildren(
    h(
      'section',
      { class: 'settings' },
      h('h1', { class: 'screen-title' }, '설정'),
      h(
        'ul',
        { class: 'settings-list' },
        row('앱 버전', APP_VERSION),
        row('데이터 버전', String(SCHEMA_VERSION)),
        row('저장소 영구 보존', PERSISTENCE_TEXT[status] ?? PERSISTENCE_TEXT.unsupported),
      ),
      themeSection(settings),
      guideSection(),
      contactSection(),
      backupSection(settings, snapshots),
    ),
  );
}
