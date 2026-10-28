// 백업 파일 복원 공유 흐름 (요구사항 11, 20, 21, 7.9). 설정·서재·첫 실행 안내가 같이 쓴다.
// 백업 파일은 기기 안에서만 읽는다. 서버로 보내지 않는다(26.9).
//
// 만드는 클래스 이름 (스타일은 styles/backup.css의 .backup-btn을 그대로 쓴다):
//   .restore-file           버튼과 숨은 file input을 감싸는 <span> (display: contents라 줄 배치에 끼지 않는다)
//   .backup-file-input      숨은 file input
import '../../styles/backup.css';

import { setCurrentProject } from '../../app-state.js';
import { requestAssetGc } from '../../db/asset-gc.js';
import { restoreData } from '../../db/backup.js';
import { getSettings, updateSettings } from '../../db/settings.js';
import { createSnapshot, localDateOf } from '../../db/snapshots.js';
import { flushAll } from '../../lib/autosave.js';
import { parseBackup } from '../../lib/backup-format.js';
import { confirmDialog, h, toast } from '../../lib/dom.js';
import { navigate } from '../../router.js';
import { applyTheme } from '../../theme.js';

/** parseBackup 오류 종류 → 안내 문구 (20.2, 20.3, 20.4, 20.5) */
export const BACKUP_ERROR_TEXT = {
  'not-backup': '이 앱의 백업 파일이 아닙니다',
  corrupt: '백업 파일이 손상되었습니다',
  newer: '더 새 버전 앱에서 만든 백업입니다. 앱을 업데이트한 뒤 불러오세요',
};

export const OVERWRITE_TEXT =
  '현재 데이터를 모두 덮어씁니다. 덮어쓰기 전 현재 상태를 앱 안에 자동 보관합니다';
export const RESTORE_FAILED_TEXT = '복원하지 못했습니다. 데이터는 그대로입니다';
export const RESTORED_TEXT = '복원했습니다';

// 파일 복원과 스냅샷 복원은 앱 전체에서 한 번에 하나만 (11.8)
let restoring = false;
const lockButtons = new Set();

/** 복원 중 비활성화할 버튼을 등록한다. 화면에서 빠진 버튼은 다음 실행 때 지운다 */
export function lockWhileRestoring(button) {
  lockButtons.add(button);
  button.disabled = restoring;
}

function setLocked(locked) {
  for (const b of lockButtons) {
    if (!b.isConnected && !locked) {
      lockButtons.delete(b);
      continue;
    }
    b.disabled = locked;
  }
}

/** task를 실행한다. 다른 복원이 진행 중이면 아무것도 하지 않는다 */
export async function runExclusive(task) {
  if (restoring) return;
  restoring = true;
  setLocked(true);
  try {
    await task();
  } finally {
    restoring = false;
    setLocked(false);
  }
}

/** 백업 파일의 exportedAt → 기기 지역 날짜. 읽을 수 없으면 '날짜 모름' */
function exportedDateText(exportedAt) {
  const time = typeof exportedAt === 'string' ? Date.parse(exportedAt) : NaN;
  return Number.isNaN(time) ? '날짜 모름' : localDateOf(time);
}

/** 고른 파일로 복원한다 (이전 블록 설계 11절 1~5단계). 성공하면 true */
export async function restoreFromFile(file, { onRestored } = {}) {
  // 1. 검사. Live_Data를 바꾸기 전에 끝낸다(20.1)
  let text;
  try {
    text = await file.text();
  } catch (err) {
    console.error(err);
    toast(BACKUP_ERROR_TEXT.corrupt);
    return false;
  }
  const parsed = parseBackup(text);
  text = null;
  if (!parsed.ok) {
    toast(BACKUP_ERROR_TEXT[parsed.error] ?? BACKUP_ERROR_TEXT.corrupt);
    return false;
  }
  const { meta, tables, assets } = parsed.value;

  // 2. 확인 (21.1)
  const ok = await confirmDialog({
    title: '백업 파일로 복원',
    message: `${exportedDateText(meta.exportedAt)} 백업 · 작품 ${tables.projects.length}개. ${OVERWRITE_TEXT}`,
    confirmLabel: '복원',
  });
  if (!ok) return false;

  // 3. 저장 대기 변경을 먼저 저장하고 지금 상태를 앱 안에 보관한다 (21.2, 21.3, 11.4)
  try {
    await flushAll();
    await createSnapshot('pre-restore');
  } catch (err) {
    console.error(err);
    toast('복원 전 자동 보관에 실패해 복원을 멈췄습니다');
    return false;
  }

  // 4. Base64에서 되살린 bytes → Blob은 트랜잭션 전에 만든다 (21.4~21.7)
  try {
    const assetRecords = assets.map(({ bytes, ...rest }) => ({
      ...rest,
      blob: new Blob([bytes], { type: rest.mime }),
    }));
    await restoreData({ schemaVersion: meta.schemaVersion, tables }, assetRecords);
  } catch (err) {
    console.error(err);
    toast(RESTORE_FAILED_TEXT);
    return false;
  }

  // 5. 끝 (21.8, 21.9)
  await finishRestore({ onRestored });
  return true;
}

/**
 * 복원 성공 뒤 공통 (21.8, 21.9, 23.9, 11.5, 11.6, 7.9):
 * 안내 → 현재 작품 비우기 → onboardingDone 저장 → 복원된 테마 적용(6.8) → Asset 정리
 *  → onRestored가 있으면 onRestored(), 없으면 navigate({ name: 'library' })
 */
export async function finishRestore({ onRestored } = {}) {
  toast(RESTORED_TEXT);
  await setCurrentProject(null);
  try {
    await updateSettings({ onboardingDone: true });
  } catch (err) {
    console.error(err);
  }
  // 테마는 사용자 취향이라 백업 파일의 값을 따른다 (6.8)
  try {
    const settings = await getSettings();
    applyTheme(settings?.defaultThemeId);
  } catch (err) {
    console.error(err);
  }
  requestAssetGc();
  if (onRestored) await onRestored();
  else navigate({ name: 'library' });
}

/**
 * "백업 파일로 복원" 버튼 + 숨은 file input. 파일을 고르면 restoreFromFile을 실행하고,
 * 누르는 동안 버튼을 비활성화한다(runExclusive). 돌려주는 값: { el, button }
 */
export function restoreFileButton({ label = '백업 파일로 복원', className, onRestored } = {}) {
  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'backup-file-input',
    hidden: true,
    onchange: () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;
      runExclusive(() => restoreFromFile(file, { onRestored }));
    },
  });
  const button = h(
    'button',
    {
      type: 'button',
      class: ['btn', 'backup-btn', className],
      onclick: () => {
        if (!restoring) fileInput.click();
      },
    },
    label,
  );
  lockWhileRestoring(button);
  const el = h('span', { class: 'restore-file', style: { display: 'contents' } }, button, fileInput);
  return { el, button };
}
