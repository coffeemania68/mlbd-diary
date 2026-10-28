// 자동 저장(Autosave). 입력이 멈추고 AUTOSAVE_DELAY_MS가 지나면 save(patch)를 부른다.
//
// 사용법(편집 화면):
//   const autosave = createAutosave({
//     save: (patch) => updateCharacter(id, patch),
//     onStatus: (s) => showStatus(indicator, s),
//   });
//   input.addEventListener('input', () => autosave.schedule({ name: input.value }));
//   // 화면을 떠날 때: await autosave.flush(); autosave.dispose();
//
// 규칙
// - schedule(patch): 대기 패치에 합친다(같은 키는 나중 값). 타이머를 다시 건다. 상태 'pending'.
// - 타이머가 끝나거나 flush()가 불리면 대기 패치를 꺼내 save()를 부른다. 상태 'saving'.
// - 저장 중에 들어온 입력은 다음 패치로 모았다가 이번 저장이 끝난 뒤 저장한다.
//   한 인스턴스에서 save()가 동시에 두 번 돌지 않는다.
// - 성공: 'saved' (아직 대기 패치가 있으면 'pending').
// - 실패: 'error'. 꺼냈던 패치를 대기 패치 밑에 다시 합친다(새 입력이 우선).
//   다음 입력이나 다음 flush 때 함께 다시 저장한다. 화면 입력값은 건드리지 않는다.
// - dispose(): 타이머를 멈추고 flushAll 모음에서 뺀다. 저장은 하지 않는다.
//   그래서 화면은 "flush() 후 dispose()" 순서로 부른다(라우터는 화면 교체 전에 flushAll()을 부른다).

import { AUTOSAVE_DELAY_MS } from '../config.js';

// 살아 있는(dispose 전) 인스턴스 모음. flushAll()이 쓴다.
const live = new Set();

export function createAutosave({ save, onStatus, delay = AUTOSAVE_DELAY_MS }) {
  let pending = {};       // 아직 저장하지 않은 변경
  let timer = null;       // 디바운스 타이머
  let running = null;     // 진행 중인 저장 Promise (없으면 null)
  let disposed = false;

  const hasPending = () => Object.keys(pending).length > 0;

  function emit(status) {
    if (!disposed && typeof onStatus === 'function') onStatus(status);
  }

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  // 대기 패치 하나를 저장한다. 저장 중이면 끝난 뒤 이어서 한다.
  // 반환 Promise는 실패해도 reject하지 않고 성공 여부(boolean)로 끝난다.
  function saveOnce() {
    if (running) return running.then(() => saveOnce());
    if (!hasPending()) return Promise.resolve(true);

    const patch = pending;
    pending = {};
    emit('saving');

    running = (async () => {
      let ok = true;
      try {
        await save(patch);
      } catch (err) {
        ok = false;
        // 실패한 패치를 되살리되, 저장 중에 들어온 새 값이 이긴다.
        pending = { ...patch, ...pending };
        console.error('자동 저장 실패', err);
      }
      running = null;
      if (!ok) emit('error');
      else emit(hasPending() ? 'pending' : 'saved');
      return ok;
    })();
    return running;
  }

  function schedule(patch) {
    if (disposed || !patch) return;
    pending = { ...pending, ...patch };
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      saveOnce();
    }, delay);
    emit('pending');
  }

  // 기다리지 않고 지금 저장한다. 대기 패치가 모두 저장되거나 실패하면 끝난다.
  async function flush() {
    for (;;) {
      clearTimer();
      const ok = await saveOnce();
      if (!ok || !hasPending()) return ok;
    }
  }

  function dispose() {
    clearTimer();
    disposed = true;
    live.delete(instance);
  }

  const instance = { schedule, flush, dispose };
  live.add(instance);
  return instance;
}

// 살아 있는 모든 인스턴스를 즉시 저장한다. 하나라도 실패하면 false.
export async function flushAll() {
  const results = await Promise.all([...live].map((a) => a.flush()));
  return results.every(Boolean);
}

// 여러 Autosave 인스턴스의 상태를 화면 하나의 상태로 합친다 (플롯 카드·타임라인 사건처럼 레코드가 많은 화면).
// 하나라도 'error'면 'error', 하나라도 'pending'·'saving'이면 'saving', 모두 'saved'면 'saved', 비면 'idle'
export function combineStatus(statuses) {
  const list = [...(statuses ?? [])];
  if (list.length === 0) return 'idle';
  if (list.includes('error')) return 'error';
  if (list.includes('pending') || list.includes('saving')) return 'saving';
  if (list.every((s) => s === 'saved')) return 'saved';
  return 'idle';
}

// 상태 → Save_Indicator의 data-state 값 (base.css가 'saving'·'saved'·'error'만 꾸민다)
export function indicatorState(status) {
  if (status === 'pending' || status === 'saving') return 'saving';
  if (status === 'saved' || status === 'error') return status;
  return '';
}

// Save_Indicator 요소에 상태 문구와 data-state를 함께 반영한다
export function showStatus(indicator, status) {
  const state = indicatorState(status);
  if (state) indicator.dataset.state = state;
  else delete indicator.dataset.state;
  indicator.textContent = statusLabel(status);
}

// 상태 → Save_Indicator 문구
export function statusLabel(status) {
  switch (status) {
    case 'pending':
    case 'saving':
      return '저장 중';
    case 'saved':
      return '저장됨';
    case 'error':
      return '저장 실패';
    default:
      return '';
  }
}
