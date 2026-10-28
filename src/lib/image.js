// 캐릭터 이미지 처리: 긴 변을 IMAGE_MAX_SIDE 이하로 줄이고 WebP로 변환한다.
// 저장은 하지 않는다. 처리에 실패하면 DB를 건드리지 않으므로 기존 이미지가 남는다(요구사항 12.7).
import { IMAGE_MAX_SIDE, IMAGE_WEBP_QUALITY } from '../config.js';

export function fitWithin(width, height, maxSide = IMAGE_MAX_SIDE) {
  const long = Math.max(width, height);
  if (long <= maxSide) return { width, height };
  const scale = maxSide / long;
  return width >= height
    ? { width: maxSide, height: Math.max(1, Math.round(height * scale)) }
    : { width: Math.max(1, Math.round(width * scale)), height: maxSide };
}

export class ImageLoadError extends Error {
  constructor(message = '이미지를 불러올 수 없습니다.', options) {
    super(message, options);
    this.name = 'ImageLoadError';
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function processImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    throw new ImageLoadError(undefined, { cause: err });
  }

  let width;
  let height;
  let canvas;
  try {
    ({ width, height } = fitWithin(bitmap.width, bitmap.height));
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageLoadError();
    ctx.drawImage(bitmap, 0, 0, width, height);
  } catch (err) {
    if (err instanceof ImageLoadError) throw err;
    throw new ImageLoadError(undefined, { cause: err });
  } finally {
    bitmap.close?.();
  }

  const blob = await canvasToBlob(canvas, 'image/webp', IMAGE_WEBP_QUALITY);
  if (!blob || blob.type !== 'image/webp') throw new ImageLoadError();

  return { blob, mime: 'image/webp', width, height, kind: 'image' };
}
