// 현재 열린 작품 id 하나만 들고 있다. 바뀌면 Settings.lastOpenedProjectId에 저장하고 리스너에 알린다.
import { updateSettings } from './db/settings.js';

let currentProjectId = null;
const listeners = new Set();

export function getCurrentProjectId() {
  return currentProjectId;
}

function notify() {
  for (const fn of listeners) {
    try {
      fn(currentProjectId);
    } catch (err) {
      console.error(err);
    }
  }
}

/**
 * 현재 작품을 바꾼다. 같은 id면 아무것도 하지 않는다.
 * id가 있으면 다음 시작 때 바로 열 수 있도록 lastOpenedProjectId로 저장한다(요구사항 7.1).
 * null을 넘기면(서재 등) 저장값은 그대로 두고 현재 작품만 비운다.
 */
export async function setCurrentProject(id) {
  const next = id ?? null;
  if (next === currentProjectId) return;
  currentProjectId = next;
  if (next !== null) {
    try {
      await updateSettings({ lastOpenedProjectId: next });
    } catch (err) {
      // 저장 실패가 화면 이동을 막지는 않는다.
      console.error(err);
    }
  }
  notify();
}

/** 작품 삭제 시 부른다. 저장값 정리는 deleteProjectCascade가 맡는다. */
export function clearCurrentProject() {
  if (currentProjectId === null) return;
  currentProjectId = null;
  notify();
}

/** 현재 작품이 바뀔 때 fn(id)을 부른다. 돌려준 함수를 부르면 해제된다. */
export function onProjectChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
