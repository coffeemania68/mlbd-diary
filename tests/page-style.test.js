import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { normalizeBackground, backgroundView } from '../src/lib/page-style.js';
import { PAGE_PATTERNS, PAGE_BG_COLORS } from '../src/config.js';

const patternIds = PAGE_PATTERNS.map((p) => p.id);
const colorValues = PAGE_BG_COLORS.map((c) => c.value).filter((v) => v !== null);

const validBg = fc.record({
  pattern: fc.constantFrom(...patternIds),
  color: fc.constantFrom(null, ...colorValues),
});
const anyValue = fc.oneof(
  validBg,
  fc.constantFrom(null, undefined, 0, 42, '', 'dot', true),
  fc.string(),
  fc.double(),
  fc.object(),
  fc.record({
    pattern: fc.oneof(fc.constantFrom(...patternIds), fc.string(), fc.integer(), fc.constant(null)),
    color: fc.oneof(fc.constantFrom(...colorValues), fc.string(), fc.integer(), fc.constant(undefined)),
  }, { requiredKeys: [] }),
);

// Feature: mlbd-final-block, Property 7: 페이지 배경 정리
// **Validates: Requirements 5.5, 5.6, 13.4**
describe('페이지 배경 정리 (Property 7)', () => {
  it('결과는 목록 안의 pattern·color이고 다시 적용해도 같다', () => {
    fc.assert(fc.property(anyValue, (bg) => {
      const out = normalizeBackground(bg);
      expect(patternIds).toContain(out.pattern);
      expect(out.color === null || colorValues.includes(out.color)).toBe(true);
      expect(normalizeBackground(out)).toEqual(out);
    }), { numRuns: 100 });
  });

  it('이미 유효한 { pattern, color }는 그대로', () => {
    fc.assert(fc.property(validBg, (bg) => {
      expect(normalizeBackground(bg)).toEqual(bg);
    }), { numRuns: 100 });
  });

  it('예시', () => {
    expect(backgroundView(null)).toEqual({ pattern: 'plain', colorCss: 'var(--page-paper)' });
    expect(normalizeBackground({ pattern: 'dot', color: '#123456' })).toEqual({ pattern: 'dot', color: null });
    expect(backgroundView({ pattern: 'grid', color: '#ffffff' })).toEqual({ pattern: 'grid', colorCss: '#ffffff' });
  });
});
