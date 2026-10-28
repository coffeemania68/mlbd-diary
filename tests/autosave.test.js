import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { combineStatus, createAutosave, flushAll, indicatorState, statusLabel } from '../src/lib/autosave.js';

// Feature: mlbd-book-sections, Property 25: 저장 상태 합치기
// **Validates: Requirements 16.1, 16.3**
describe('combineStatus', () => {
  it('error > pending·saving > 모두 saved > 빈 목록 idle', () => {
    const status = fc.constantFrom('pending', 'saving', 'saved', 'error');
    fc.assert(
      fc.property(fc.array(status, { maxLength: 12 }), (statuses) => {
        const expected =
          statuses.length === 0
            ? 'idle'
            : statuses.includes('error')
              ? 'error'
              : statuses.some((s) => s === 'pending' || s === 'saving')
                ? 'saving'
                : 'saved';
        expect(combineStatus(statuses)).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  it('예시', () => {
    expect(combineStatus([])).toBe('idle');
    expect(combineStatus(['saved', 'saved'])).toBe('saved');
    expect(combineStatus(['saved', 'pending'])).toBe('saving');
    expect(combineStatus(['saving', 'error', 'saved'])).toBe('error');
  });
});

describe('autosave 기본 동작', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('500ms 디바운스 후 병합된 패치를 한 번 저장한다', async () => {
    const saves = [];
    const statuses = [];
    const a = createAutosave({ save: async (p) => saves.push(p), onStatus: (s) => statuses.push(s) });
    a.schedule({ title: 'a' });
    await vi.advanceTimersByTimeAsync(300);
    a.schedule({ title: 'b', genre: 'x' });
    await vi.advanceTimersByTimeAsync(499);
    expect(saves).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(saves).toEqual([{ title: 'b', genre: 'x' }]);
    expect(statuses.at(-1)).toBe('saved');
    a.dispose();
  });

  it('저장 중 입력은 끝난 뒤 따로 저장하고 동시에 두 번 돌지 않는다', async () => {
    let active = 0;
    let maxActive = 0;
    const saves = [];
    let release;
    const a = createAutosave({
      save: (p) => {
        active++;
        maxActive = Math.max(maxActive, active);
        saves.push(p);
        return new Promise((r) => { release = () => { active--; r(); }; });
      },
    });
    a.schedule({ x: 1 });
    await vi.advanceTimersByTimeAsync(500);
    a.schedule({ y: 2 });
    const done = a.flush();
    release();
    await vi.advanceTimersByTimeAsync(0);
    release();
    await done;
    expect(saves).toEqual([{ x: 1 }, { y: 2 }]);
    expect(maxActive).toBe(1);
    a.dispose();
  });

  it('실패하면 error 상태와 패치를 보존하고 다음 flush에 새 값과 함께 저장한다', async () => {
    let fail = true;
    const saves = [];
    const statuses = [];
    const a = createAutosave({
      save: async (p) => {
        if (fail) throw new Error('db');
        saves.push(p);
      },
      onStatus: (s) => statuses.push(s),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    a.schedule({ name: 'old', age: '3' });
    expect(await a.flush()).toBe(false);
    expect(statuses.at(-1)).toBe('error');
    fail = false;
    a.schedule({ name: 'new' });
    expect(await flushAll()).toBe(true);
    expect(saves).toEqual([{ name: 'new', age: '3' }]);
    expect(statuses.at(-1)).toBe('saved');
    a.dispose();
  });

  it('statusLabel 문구', () => {
    expect(statusLabel('pending')).toBe('저장 중');
    expect(statusLabel('saving')).toBe('저장 중');
    expect(statusLabel('saved')).toBe('저장됨');
    expect(statusLabel('error')).toBe('저장 실패');
    expect(statusLabel('idle')).toBe('');
  });

  it('indicatorState는 base.css가 쓰는 값만 낸다', () => {
    expect(indicatorState('pending')).toBe('saving');
    expect(indicatorState('saving')).toBe('saving');
    expect(indicatorState('saved')).toBe('saved');
    expect(indicatorState('error')).toBe('error');
    expect(indicatorState('idle')).toBe('');
  });
});
