// 레코드가 많은 화면(플롯 카드, 타임라인 사건)의 자동 저장 묶음.
// 레코드 id마다 Autosave 인스턴스를 하나씩 만들고, 상태를 합쳐 화면 하나의 Save_Indicator에 보여 준다.
// 인스턴스는 createAutosave로 만들므로 라우터의 flushAll()에 저절로 들어간다.
//
// 사용법:
//   const autosaves = recordAutosaves({ save: (id, patch) => updatePlotCard(id, patch), indicator });
//   input.addEventListener('input', () => autosaves.schedule(card.id, { title: input.value }));
//   // 레코드를 지우기 전: await autosaves.forget(card.id);
//   // 정리 함수에서: autosaves.disposeAll();
import '../../styles/parts.css';

import { combineStatus, createAutosave, showStatus } from '../../lib/autosave.js';

/**
 * @param {object} opts
 * @param {(id: string, patch: object) => Promise<unknown>} opts.save
 * @param {HTMLElement} opts.indicator  .save-indicator 요소
 */
export function recordAutosaves({ save, indicator }) {
  /** @type {Map<string, ReturnType<typeof createAutosave>>} */
  const autosaves = new Map();
  /** @type {Map<string, string>} */
  const statuses = new Map();

  function render() {
    if (indicator) showStatus(indicator, combineStatus([...statuses.values()]));
  }

  function get(id) {
    let autosave = autosaves.get(id);
    if (!autosave) {
      autosave = createAutosave({
        save: (patch) => save(id, patch),
        onStatus: (status) => {
          statuses.set(id, status);
          render();
        },
      });
      autosaves.set(id, autosave);
    }
    return autosave;
  }

  // id의 인스턴스가 없으면 만든다
  function schedule(id, patch) {
    get(id).schedule(patch);
  }

  // 그 레코드만 즉시 저장한다. 인스턴스가 없으면 저장할 것도 없다.
  async function flush(id) {
    const autosave = autosaves.get(id);
    return autosave ? autosave.flush() : true;
  }

  // 레코드를 지우기 전에 부른다: 저장 후 dispose하고 모음에서 뺀다
  async function forget(id) {
    const autosave = autosaves.get(id);
    if (!autosave) return true;
    const ok = await autosave.flush();
    autosave.dispose();
    autosaves.delete(id);
    statuses.delete(id);
    render();
    return ok;
  }

  // 정리 함수에서 부른다. 저장은 라우터의 flushAll()이 먼저 한다.
  function disposeAll() {
    for (const autosave of autosaves.values()) autosave.dispose();
    autosaves.clear();
    statuses.clear();
  }

  return { schedule, flush, forget, disposeAll };
}
