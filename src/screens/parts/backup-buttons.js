// 백업 내보내기·공유 버튼 (요구사항 18.1~18.11, 19.3, 26.9).
// 백업 알림 띠(main-screen.js)와 설정 화면 백업 구역(settings.js)이 같이 쓴다.
// 파일은 기기 안에서만 만들어 내려받는다. 서버로 보내지 않는다.
import '../../styles/backup.css';

import { buildExport } from '../../db/backup.js';
import { updateSettings } from '../../db/settings.js';
import { flushAll } from '../../lib/autosave.js';
import { backupFileName } from '../../lib/backup-format.js';
import { h, toast } from '../../lib/dom.js';

const REVOKE_DELAY_MS = 60_000;
// NotAllowedError 뒤 만든 파일을 들고 있는 시간
const PENDING_SHARE_MS = 60_000;
// 공유 창 제목. 공유 실패(취소 제외) 안내 문구는 '공유하지 못했습니다'
const SHARE_TITLE = 'My Last Best Diary 백업';

/**
 * 저장 대기 중인 변경을 먼저 저장하고(18.11) 백업 파일을 만든다.
 * 실패하면 안내를 띄우고 null을 돌려준다(18.10).
 */
export async function exportBackupFile() {
  try {
    await flushAll();
    const parts = await buildExport();
    return new File(parts, backupFileName(new Date()), { type: 'application/json' });
  } catch (err) {
    console.error(err);
    toast('백업 파일을 만들지 못했습니다');
    return null;
  }
}

/** 파일을 기기에 내려받기 시작한다. object URL은 60초 뒤 놓아준다 */
function startDownload(file) {
  const url = URL.createObjectURL(file);
  const link = h('a', { href: url, download: file.name, hidden: true });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/**
 * 내보내기 버튼 줄(공유가 되는 기기면 '공유' 버튼도). 두 버튼은 같은 busy로 동시에 돌지 않는다.
 * 내려받기가 시작되면 lastBackupAt을 저장하고 onSaved(시각)을 부른다(18.8).
 * 파일을 만들지 못하면 lastBackupAt을 바꾸지 않는다(18.10).
 */
export function backupButtons({ onSaved } = {}) {
  let busy = false;
  const exportBtn = h(
    'button',
    { type: 'button', class: ['btn', 'btn-primary', 'backup-btn'], onclick: onExport },
    '백업 파일 내보내기',
  );

  const shareBtn = canShareFiles()
    ? h('button', { type: 'button', class: ['btn', 'backup-btn'], onclick: onShare }, '공유')
    : null;

  // NotAllowedError 뒤 다음 누름에서 바로 넘길 파일(60초 보관)
  let pendingFile = null;
  let pendingTimer = 0;

  function setBusy(value) {
    busy = value;
    exportBtn.disabled = value;
    if (shareBtn) shareBtn.disabled = value;
  }

  function keepPending(file) {
    clearTimeout(pendingTimer);
    pendingFile = file;
    pendingTimer = setTimeout(() => {
      pendingFile = null;
    }, PENDING_SHARE_MS);
  }

  function takePending() {
    const file = pendingFile;
    clearTimeout(pendingTimer);
    pendingFile = null;
    return file;
  }

  async function markSaved() {
    const at = Date.now();
    try {
      await updateSettings({ lastBackupAt: at });
    } catch (err) {
      console.error(err);
      return;
    }
    onSaved?.(at);
  }

  async function onExport() {
    if (busy) return;
    setBusy(true);
    try {
      const file = await exportBackupFile();
      if (!file) return;
      startDownload(file);
      await markSaved();
    } finally {
      setBusy(false);
    }
  }

  // 공유(18.6, 18.7, 18.9). 성공했을 때만 lastBackupAt을 저장한다(18.8).
  async function onShare() {
    if (busy) return;
    setBusy(true);
    try {
      const file = takePending() ?? (await exportBackupFile());
      if (!file) return;
      try {
        await navigator.share({ files: [file], title: SHARE_TITLE });
      } catch (err) {
        if (err?.name === 'AbortError') return;
        if (err?.name === 'NotAllowedError') {
          // 파일을 만드는 사이 사용자 동작이 만료됐다. 다음 누름에서 바로 넘긴다.
          keepPending(file);
          toast('파일을 준비했습니다. 공유를 한 번 더 눌러 주세요');
          return;
        }
        console.error(err);
        toast('공유하지 못했습니다');
        return;
      }
      await markSaved();
    } finally {
      setBusy(false);
    }
  }

  return h('div', { class: 'backup-buttons' }, exportBtn, shareBtn);
}

/** 이 기기에서 파일 공유가 되는지 빈 JSON 파일로 확인한다(Share_Capable, 18.6) */
function canShareFiles() {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
    return navigator.canShare?.({ files: [probe] }) === true;
  } catch {
    return false;
  }
}
