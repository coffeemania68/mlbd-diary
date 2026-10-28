import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
import { fitWithin, processImage, ImageLoadError } from '../src/lib/image.js';

describe('fitWithin', () => {
  it('keeps small images unchanged', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it('shrinks landscape and portrait images by the long side', () => {
    expect(fitWithin(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 });
    expect(fitWithin(1000, 4000, 1600)).toEqual({ width: 400, height: 1600 });
  });

  it('never returns a side below 1', () => {
    expect(fitWithin(100000, 1, 1600)).toEqual({ width: 1600, height: 1 });
  });

  // Property 14: 이미지 크기 맞춤
  // **Validates: Requirements 12.1, 12.2**
  it('Property 14: long side is min(long, 1600) and ratio is preserved', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20000 }), fc.integer({ min: 1, max: 20000 }), (w, h) => {
        const r = fitWithin(w, h, 1600);
        const long = Math.max(w, h);
        expect(Math.max(r.width, r.height)).toBe(Math.min(long, 1600));
        expect(r.width).toBeGreaterThanOrEqual(1);
        expect(r.height).toBeGreaterThanOrEqual(1);
        if (long <= 1600) {
          expect(r).toEqual({ width: w, height: h });
        } else {
          const scale = 1600 / long;
          if (w >= h) expect(Math.abs(r.height - Math.max(1, h * scale))).toBeLessThanOrEqual(1);
          else expect(Math.abs(r.width - Math.max(1, w * scale))).toBeLessThanOrEqual(1);
        }
      }),
    );
  });
});

describe('processImage', () => {
  const original = globalThis.createImageBitmap;
  afterEach(() => {
    globalThis.createImageBitmap = original;
  });

  it('throws ImageLoadError when createImageBitmap rejects', async () => {
    globalThis.createImageBitmap = () => Promise.reject(new Error('decode failed'));
    await expect(processImage(new Blob(['not an image']))).rejects.toBeInstanceOf(ImageLoadError);
  });
});
