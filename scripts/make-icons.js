// 앱 아이콘 PNG를 만든다. Node 내장 모듈(zlib, fs)만 쓴다.
// 실행: node scripts/make-icons.js  →  public/icons/icon-192.png, icon-512.png
// 종이색 바탕 위에 보라색 공책 하나. 모양은 maskable 안전 영역(가운데 80% 원) 안에 둔다.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// src/styles/base.css의 색 변수와 맞춘다
const BG = [0xf7, 0xf4, 0xef]; // --color-bg
const COVER = [0x6b, 0x4f, 0x8a]; // --color-accent
const SPINE = [0x55, 0x3d, 0x70]; // --color-accent-strong
const LABEL = [0xff, 0xff, 0xff]; // --color-surface
const LINE = [0xdd, 0xd5, 0xc8]; // --color-border
const RIBBON = [0xb4, 0x41, 0x3c]; // --color-danger (책갈피 끈)

// 좌표는 0~1 비율. 가운데에서 가장 먼 점(공책 모서리)도 반지름 0.4 안에 든다.
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// 한 점의 색. 아래층부터 차례로 덮는다.
function colorAt(x, y) {
  let c = BG;
  const book = inRoundRect(x, y, 0.3, 0.24, 0.7, 0.76, 0.045);
  if (book) {
    c = COVER;
    if (x < 0.37) c = SPINE; // 왼쪽 책등
    if (inRoundRect(x, y, 0.44, 0.34, 0.64, 0.48, 0.02)) {
      c = LABEL; // 표지 이름표
      if (x > 0.47 && x < 0.61 && ((y > 0.385 && y < 0.395) || (y > 0.425 && y < 0.435))) c = LINE;
    }
  }
  // 공책 아래로 늘어진 책갈피 끈. 끝은 V자로 파여 있다 (가운데 0.795, 양끝 0.82)
  if (x > 0.58 && x < 0.63 && y > 0.7) {
    const bottom = 0.82 - 0.025 * (1 - Math.abs(x - 0.605) / 0.025);
    if (y < bottom) c = RIBBON;
  }
  return c;
}

// 가장자리를 부드럽게: 픽셀마다 4x4 표본 평균
function render(size) {
  const S = 4;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let p = 0;
  for (let py = 0; py < size; py++) {
    raw[p++] = 0; // 필터 없음
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const c = colorAt((px + (sx + 0.5) / S) / size, (py + (sy + 0.5) / S) / size);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      raw[p++] = Math.round(r / (S * S));
      raw[p++] = Math.round(g / (S * S));
      raw[p++] = Math.round(b / (S * S));
    }
  }
  return raw;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function makePng(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 비트 깊이
  ihdr[9] = 2; // RGB
  ihdr[10] = 0; // 압축
  ihdr[11] = 0; // 필터
  ihdr[12] = 0; // 인터레이스 없음
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(render(size), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, makePng(size));
  console.log(`만듦: ${file}`);
}
