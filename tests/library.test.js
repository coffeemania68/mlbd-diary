import { describe, expect, it } from 'vitest';
import { formatDate } from '../src/screens/library.js';

describe('formatDate (서재 카드 최근 수정일)', () => {
  it('YYYY.MM.DD로 바꾸고 월·일을 두 자리로 채운다', () => {
    expect(formatDate(new Date(2025, 0, 5, 13, 30).getTime())).toBe('2025.01.05');
    expect(formatDate(new Date(2026, 11, 31, 23, 59).getTime())).toBe('2026.12.31');
  });

  it('값이 없거나 이상하면 빈 문자열', () => {
    expect(formatDate(undefined)).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate('abc')).toBe('');
  });
});
