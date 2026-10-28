import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { STICKER_PACK } from '../src/lib/sticker-pack.js';
import { SHAPE_TAGS, SHAPE_ATTRS, sanitizeShape, getSticker, stickerList } from '../src/lib/stickers.js';

const RUNS = { numRuns: 100 };
const DANGER_RE = /url\(|href|http:|https:|javascript:|data:/i;

function allShapes(shapes) {
  return shapes.flatMap((s) => [s, ...allShapes(s.children ?? [])]);
}

// 결과 도형이 허용 요소·허용 속성·안전한 값만 담는지 재귀로 확인
function isClean(shape) {
  if (!SHAPE_TAGS.includes(shape.tag)) return false;
  for (const [k, v] of Object.entries(shape.attrs)) {
    if (!SHAPE_ATTRS.includes(k)) return false;
    if (typeof v === 'number' ? !Number.isFinite(v) : typeof v !== 'string') return false;
    if (typeof v === 'string' && DANGER_RE.test(v)) return false;
  }
  if (shape.tag !== 'g') return shape.children === undefined;
  return Array.isArray(shape.children) && shape.children.every(isClean);
}

describe('sticker pack', () => {
  // Feature: mlbd-final-block, Property 1: 스티커 팩 유효성
  // **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
  it('Property 1: every pack sticker is valid and survives sanitizeShape unchanged', () => {
    expect(STICKER_PACK.length).toBeGreaterThanOrEqual(28);
    expect(STICKER_PACK.length).toBeLessThanOrEqual(32);
    expect(new Set(STICKER_PACK.map((s) => s.id)).size).toBe(STICKER_PACK.length);
    fc.assert(
      fc.property(fc.constantFrom(...STICKER_PACK), (s) => {
        expect(typeof s.id).toBe('string');
        expect(s.label.trim().length).toBeGreaterThan(0);
        const nums = s.viewBox.trim().split(/\s+/).map(Number);
        expect(nums).toHaveLength(4);
        expect(nums.every(Number.isFinite)).toBe(true);
        expect(s.shapes.length).toBeGreaterThan(0);
        for (const shape of s.shapes) expect(sanitizeShape(shape)).toEqual(shape);
        for (const shape of allShapes(s.shapes)) {
          for (const v of Object.values(shape.attrs)) expect(DANGER_RE.test(String(v))).toBe(false);
        }
      }),
      RUNS,
    );
  });

  it('every sticker in the pack survives sanitizeShape unchanged', () => {
    for (const s of STICKER_PACK) {
      for (const shape of s.shapes) expect(sanitizeShape(shape), s.id).toEqual(shape);
    }
  });

  it('getSticker and stickerList', () => {
    expect(getSticker('없는-id')).toBeNull();
    expect(getSticker('star').label).toBe('별');
    expect(stickerList().map((s) => s.id)).toEqual(STICKER_PACK.map((s) => s.id));
  });
});

describe('sanitizeShape', () => {
  const tagArb = fc.oneof(
    fc.constantFrom(...SHAPE_TAGS, 'script', 'image', 'use', 'a', 'foreignObject', 'style'),
    fc.string(),
  );
  const nameArb = fc.oneof(
    fc.constantFrom(...SHAPE_ATTRS, 'onclick', 'onload', 'href', 'xlink:href', 'style'),
    fc.string({ maxLength: 8 }),
  );
  const valueArb = fc.oneof(
    fc.string(),
    fc.constantFrom('#f2c94c', 'rotate(10 50 50)', 'M0 0 L10 10', 'url(#x)', 'javascript:alert(1)',
      'data:text/html,x', 'https://evil.example', 'HTTP://x', 'xlink:HREF'),
    fc.double(),
    fc.constantFrom(NaN, Infinity, -Infinity, 0, 12),
    fc.constant(null),
    fc.boolean(),
    fc.object({ maxDepth: 1 }),
    fc.array(fc.integer(), { maxLength: 3 }),
  );
  const { shape: shapeArb } = fc.letrec((tie) => ({
    shape: fc.record({
      tag: tagArb,
      attrs: fc.oneof(fc.dictionary(nameArb, valueArb, { maxKeys: 6 }), fc.constant(undefined), fc.string()),
      children: fc.oneof(
        { depthSize: 'small' },
        fc.constant(undefined),
        fc.array(fc.oneof(tie('shape'), fc.string(), fc.constant(null)), { maxLength: 3 }),
      ),
    }, { requiredKeys: ['tag'] }),
  }));

  // Feature: mlbd-final-block, Property 2: 도형 정리
  // **Validates: Requirements 1.4, 1.6**
  it('Property 2: result is null or a clean shape keeping every safe allowed attr', () => {
    fc.assert(
      fc.property(shapeArb, (input) => {
        const out = sanitizeShape(input);
        if (!SHAPE_TAGS.includes(input.tag)) {
          expect(out).toBeNull();
          return;
        }
        expect(out).not.toBeNull();
        expect(out.tag).toBe(input.tag);
        expect(isClean(out)).toBe(true);
        const src = input.attrs && typeof input.attrs === 'object' ? input.attrs : {};
        for (const [k, v] of Object.entries(src)) {
          const safe = SHAPE_ATTRS.includes(k)
            && ((typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && !DANGER_RE.test(v)));
          if (safe) expect(out.attrs[k]).toBe(v);
        }
      }),
      RUNS,
    );
  });

  it('drops a script child inside g', () => {
    const out = sanitizeShape({
      tag: 'g', attrs: { fill: '#fff' },
      children: [{ tag: 'script', attrs: {}, children: [] }, { tag: 'circle', attrs: { r: 4 } }],
    });
    expect(out).toEqual({ tag: 'g', attrs: { fill: '#fff' }, children: [{ tag: 'circle', attrs: { r: 4 } }] });
  });

  it('drops an onclick attribute', () => {
    const out = sanitizeShape({ tag: 'rect', attrs: { width: 10, onclick: 'alert(1)' } });
    expect(out).toEqual({ tag: 'rect', attrs: { width: 10 } });
  });

  it('returns null for a disallowed tag or non-object', () => {
    expect(sanitizeShape({ tag: 'script', attrs: {} })).toBeNull();
    expect(sanitizeShape(null)).toBeNull();
    expect(sanitizeShape('path')).toBeNull();
  });
});
