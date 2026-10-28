import { describe, it, expect } from 'vitest';
import { resolveMonth, defaults } from '../src/screens/widgets/calendar.js';
import { currentMonth } from '../src/lib/calendar.js';

describe('calendar widget resolveMonth', () => {
  it('Monthly_Page면 page.month를 쓴다 (12.2)', () => {
    expect(resolveMonth({ kind: 'monthly', month: '2027-03' }, { data: { month: '2026-01' } })).toBe('2027-03');
  });

  it('다른 Page면 data.month를 쓴다 (12.3)', () => {
    expect(resolveMonth({ kind: 'free', month: null }, { data: { month: '2026-11' } })).toBe('2026-11');
    expect(resolveMonth({ kind: 'main', month: null }, { data: { month: '2026-02' } })).toBe('2026-02');
  });

  it('data.month가 없거나 잘못되면 이번 달', () => {
    expect(resolveMonth({ kind: 'free' }, { data: {} })).toBe(currentMonth());
    expect(resolveMonth({ kind: 'free' }, { data: { month: '2026-13' } })).toBe(currentMonth());
  });

  it('defaults는 이번 달과 빈 메모를 새 객체로 준다', () => {
    const a = defaults();
    expect(a.data).toEqual({ month: currentMonth(), memos: {} });
    expect(defaults().data).not.toBe(a.data);
  });
});
