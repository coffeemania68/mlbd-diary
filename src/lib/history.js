// 페이지 실행 취소·다시 실행 기록. 불변 자료라 입력을 바꾸지 않고 새 객체를 돌려준다.
// 명령 모양과 적용은 lib/page-model.js.

import { HISTORY_LIMIT } from '../config.js';

/** 빈 기록 */
export function createHistory(limit = HISTORY_LIMIT) {
  return { limit, undo: [], redo: [] };
}

/** undo 끝에 넣는다. limit을 넘으면 가장 오래된 것을 버리고, redo는 비운다 */
export function push(h, cmd) {
  return { limit: h.limit, undo: [...h.undo, cmd].slice(-h.limit), redo: [] };
}

/**
 * { history, cmd | null }. cmd는 되돌릴 명령(적용은 inverseCommand로).
 * capture(원래 cmd)의 결과를 redo에 넣고 돌려준다(page-model.js captureLatest로 그 순간 레코드를 담는다)
 */
export function undo(h, capture = (c) => c) {
  if (h.undo.length === 0) return { history: h, cmd: null };
  const cmd = capture(h.undo[h.undo.length - 1]);
  return { history: { limit: h.limit, undo: h.undo.slice(0, -1), redo: [...h.redo, cmd] }, cmd };
}

/** { history, cmd | null }. cmd는 다시 적용할 명령. capture(원래 cmd)의 결과를 undo에 넣고 돌려준다 */
export function redo(h, capture = (c) => c) {
  if (h.redo.length === 0) return { history: h, cmd: null };
  const cmd = capture(h.redo[h.redo.length - 1]);
  return {
    history: { limit: h.limit, undo: [...h.undo, cmd].slice(-h.limit), redo: h.redo.slice(0, -1) },
    cmd,
  };
}

export const canUndo = (h) => h.undo.length > 0;
export const canRedo = (h) => h.redo.length > 0;
