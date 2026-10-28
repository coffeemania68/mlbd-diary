// 직접 그린 스티커 도형 데이터. 외부 파일·주소·href·url() 없음. DOM 없음.
// Widget.data.stickerId에 id를 저장하므로 이미 쓴 id는 바꾸지 않는다(저장된 스티커가 사라진다).
// 모양: { tag, attrs, children? } — tag·속성은 lib/stickers.js의 SHAPE_TAGS·SHAPE_ATTRS 안에서만 쓴다.
// children은 g에만 둔다. 색은 config.js MEMO_COLORS·INK_PALETTE와 어울리는 파스텔·먹색.

const INK = '#2b2b33';
const YELLOW = '#f2c94c';
const YELLOW_DARK = '#c9a227';
const PINK = '#f4a7b1';
const RED = '#d9434f';
const BLUE = '#3a6fd8';
const BLUE_LIGHT = '#9cc3e6';
const GREEN = '#3f9a5c';
const GREEN_LIGHT = '#a8d5a2';
const ORANGE = '#ee8a2c';
const PURPLE = '#8a5cc8';
const PURPLE_LIGHT = '#c9b3e6';
const PAPER = '#fffdf7';
const BUTTER = '#fbf1c7';
const ROSE = '#f9dde0';
const SAGE = '#e1ecdc';
const SKY = '#dceaf6';
const LILAC = '#ebe2f5';
const BROWN = '#b98a5e';

const VB = '0 0 100 100';

const STAR_POINTS = '50,6 61,38 95,38 67,58 78,92 50,72 22,92 33,58 5,38 39,38';
const HEART_D = 'M50 86 C20 66 8 48 8 32 C8 18 19 9 31 9 C40 9 46 14 50 22 C54 14 60 9 69 9 C81 9 92 18 92 32 C92 48 80 66 50 86 Z';
const TAPE_POINTS = '12,36 88,36 84,43 88,50 84,57 88,64 12,64 16,57 12,50 16,43';

const round = { 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
const badge = (fill, stroke) => ({ tag: 'circle', attrs: { cx: 50, cy: 50, r: 42, fill, stroke, 'stroke-width': 3 } });

export const STICKER_PACK = [
  { id: 'star', label: '별', viewBox: VB,
    shapes: [{ tag: 'polygon', attrs: { points: STAR_POINTS, fill: YELLOW, stroke: YELLOW_DARK, 'stroke-width': 3, 'stroke-linejoin': 'round' } }] },

  { id: 'star-outline', label: '빈 별', viewBox: VB,
    shapes: [{ tag: 'polygon', attrs: { points: STAR_POINTS, fill: PAPER, stroke: ORANGE, 'stroke-width': 5, 'stroke-linejoin': 'round' } }] },

  { id: 'heart', label: '하트', viewBox: VB,
    shapes: [{ tag: 'path', attrs: { d: HEART_D, fill: PINK, stroke: RED, 'stroke-width': 3 } }] },

  { id: 'heart-outline', label: '빈 하트', viewBox: VB,
    shapes: [{ tag: 'path', attrs: { d: HEART_D, fill: 'none', stroke: RED, 'stroke-width': 5, 'stroke-linejoin': 'round' } }] },

  { id: 'sparkle', label: '반짝', viewBox: VB,
    shapes: [
      { tag: 'path', attrs: { d: 'M46 10 Q50 46 86 50 Q50 54 46 90 Q42 54 6 50 Q42 46 46 10 Z', fill: YELLOW, stroke: YELLOW_DARK, 'stroke-width': 3 } },
      { tag: 'path', attrs: { d: 'M80 8 Q82 18 92 20 Q82 22 80 32 Q78 22 68 20 Q78 18 80 8 Z', fill: BUTTER, stroke: YELLOW_DARK, 'stroke-width': 2 } },
    ] },

  { id: 'flower', label: '꽃', viewBox: VB,
    shapes: [
      { tag: 'g', attrs: { fill: ROSE, stroke: PINK, 'stroke-width': 3 }, children: [
        { tag: 'circle', attrs: { cx: 50, cy: 28, r: 16 } },
        { tag: 'circle', attrs: { cx: 70.9, cy: 43.2, r: 16 } },
        { tag: 'circle', attrs: { cx: 62.9, cy: 67.8, r: 16 } },
        { tag: 'circle', attrs: { cx: 37.1, cy: 67.8, r: 16 } },
        { tag: 'circle', attrs: { cx: 29.1, cy: 43.2, r: 16 } },
      ] },
      { tag: 'circle', attrs: { cx: 50, cy: 50, r: 12, fill: YELLOW, stroke: YELLOW_DARK, 'stroke-width': 3 } },
    ] },

  { id: 'tulip', label: '튤립', viewBox: VB,
    shapes: [
      { tag: 'line', attrs: { x1: 50, y1: 56, x2: 50, y2: 94, stroke: GREEN, 'stroke-width': 5, 'stroke-linecap': 'round' } },
      { tag: 'path', attrs: { d: 'M50 84 Q30 80 24 62 Q42 64 50 84 Z', fill: GREEN_LIGHT, stroke: GREEN, 'stroke-width': 2 } },
      { tag: 'path', attrs: { d: 'M30 20 L40 34 L50 16 L60 34 L70 20 L70 44 Q70 60 50 60 Q30 60 30 44 Z', fill: PINK, stroke: RED, 'stroke-width': 3, 'stroke-linejoin': 'round' } },
    ] },

  { id: 'leaf', label: '잎', viewBox: VB,
    shapes: [
      { tag: 'path', attrs: { d: 'M18 82 Q16 20 82 18 Q84 80 18 82 Z', fill: GREEN_LIGHT, stroke: GREEN, 'stroke-width': 3 } },
      { tag: 'path', attrs: { d: 'M18 82 Q46 54 68 32', fill: 'none', stroke: GREEN, 'stroke-width': 3, 'stroke-linecap': 'round' } },
    ] },

  { id: 'clover', label: '네잎클로버', viewBox: VB,
    shapes: [
      { tag: 'path', attrs: { d: 'M54 56 Q58 78 72 92', fill: 'none', stroke: GREEN, 'stroke-width': 5, 'stroke-linecap': 'round' } },
      { tag: 'g', attrs: { fill: GREEN_LIGHT, stroke: GREEN, 'stroke-width': 3 }, children: [
        { tag: 'circle', attrs: { cx: 36, cy: 34, r: 15 } },
        { tag: 'circle', attrs: { cx: 64, cy: 34, r: 15 } },
        { tag: 'circle', attrs: { cx: 36, cy: 62, r: 15 } },
        { tag: 'circle', attrs: { cx: 64, cy: 62, r: 15 } },
      ] },
      { tag: 'circle', attrs: { cx: 50, cy: 48, r: 5, fill: GREEN } },
    ] },

  { id: 'sun', label: '해', viewBox: VB,
    shapes: [
      { tag: 'g', attrs: { stroke: ORANGE, 'stroke-width': 5, 'stroke-linecap': 'round' }, children: [
        { tag: 'line', attrs: { x1: 78, y1: 50, x2: 92, y2: 50 } },
        { tag: 'line', attrs: { x1: 69.8, y1: 69.8, x2: 79.7, y2: 79.7 } },
        { tag: 'line', attrs: { x1: 50, y1: 78, x2: 50, y2: 92 } },
        { tag: 'line', attrs: { x1: 30.2, y1: 69.8, x2: 20.3, y2: 79.7 } },
        { tag: 'line', attrs: { x1: 22, y1: 50, x2: 8, y2: 50 } },
        { tag: 'line', attrs: { x1: 30.2, y1: 30.2, x2: 20.3, y2: 20.3 } },
        { tag: 'line', attrs: { x1: 50, y1: 22, x2: 50, y2: 8 } },
        { tag: 'line', attrs: { x1: 69.8, y1: 30.2, x2: 79.7, y2: 20.3 } },
      ] },
      { tag: 'circle', attrs: { cx: 50, cy: 50, r: 20, fill: YELLOW, stroke: ORANGE, 'stroke-width': 3 } },
    ] },

  { id: 'moon', label: '달', viewBox: VB,
    shapes: [
      { tag: 'path', attrs: { d: 'M60 8 A42 42 0 1 0 92 64 A32 32 0 1 1 60 8 Z', fill: BUTTER, stroke: YELLOW_DARK, 'stroke-width': 3, 'stroke-linejoin': 'round' } },
    ] },

  { id: 'cloud', label: '구름', viewBox: VB,
    shapes: [
      { tag: 'path', attrs: { d: 'M26 74 Q8 74 10 58 Q12 44 28 46 Q30 26 50 26 Q68 26 72 42 Q90 40 92 58 Q92 74 74 74 Z', fill: SKY, stroke: BLUE, 'stroke-width': 3 } },
    ] },

  { id: 'rain', label: '비', viewBox: VB,
    shapes: [
      { tag: 'path', attrs: { d: 'M26 56 Q8 56 10 42 Q12 30 28 32 Q30 14 50 14 Q68 14 72 28 Q90 26 92 42 Q92 56 74 56 Z', fill: SKY, stroke: BLUE, 'stroke-width': 3 } },
      { tag: 'g', attrs: { fill: BLUE }, children: [
        { tag: 'path', attrs: { d: 'M32 66 Q26 78 32 82 Q38 78 32 66 Z' } },
        { tag: 'path', attrs: { d: 'M52 70 Q46 82 52 86 Q58 82 52 70 Z' } },
        { tag: 'path', attrs: { d: 'M72 66 Q66 78 72 82 Q78 78 72 66 Z' } },
      ] },
    ] },

  { id: 'snowflake', label: '눈송이', viewBox: VB,
    shapes: [
      { tag: 'g', attrs: { stroke: BLUE, 'stroke-width': 5, 'stroke-linecap': 'round' }, children: [
        { tag: 'line', attrs: { x1: 50, y1: 10, x2: 50, y2: 90 } },
        { tag: 'line', attrs: { x1: 15.4, y1: 30, x2: 84.6, y2: 70 } },
        { tag: 'line', attrs: { x1: 15.4, y1: 70, x2: 84.6, y2: 30 } },
        { tag: 'polyline', attrs: { points: '42,16 50,24 58,16', fill: 'none' } },
        { tag: 'polyline', attrs: { points: '42,84 50,76 58,84', fill: 'none' } },
      ] },
      { tag: 'circle', attrs: { cx: 50, cy: 50, r: 7, fill: SKY, stroke: BLUE, 'stroke-width': 3 } },
    ] },

  { id: 'check', label: '체크', viewBox: VB,
    shapes: [
      badge(SAGE, GREEN),
      { tag: 'polyline', attrs: { points: '28,52 44,68 74,34', fill: 'none', stroke: GREEN, 'stroke-width': 9, ...round } },
    ] },

  { id: 'cross', label: '엑스', viewBox: VB,
    shapes: [
      badge(ROSE, RED),
      { tag: 'path', attrs: { d: 'M32 32 L68 68 M68 32 L32 68', fill: 'none', stroke: RED, 'stroke-width': 9, ...round } },
    ] },

  { id: 'arrow-right', label: '화살표', viewBox: VB,
    shapes: [
      { tag: 'polygon', attrs: { points: '8,40 58,40 58,20 92,50 58,80 58,60 8,60', fill: SKY, stroke: BLUE, 'stroke-width': 3, 'stroke-linejoin': 'round' } },
    ] },

  { id: 'arrow-curve', label: '굽은 화살표', viewBox: VB,
    shapes: [
      { tag: 'path', attrs: { d: 'M14 82 Q18 30 66 30', fill: 'none', stroke: PURPLE, 'stroke-width': 7, 'stroke-linecap': 'round' } },
      { tag: 'polygon', attrs: { points: '62,14 90,30 62,46', fill: PURPLE, stroke: PURPLE, 'stroke-width': 3, 'stroke-linejoin': 'round' } },
    ] },

  { id: 'exclaim', label: '느낌표', viewBox: VB,
    shapes: [
      badge(BUTTER, ORANGE),
      { tag: 'rect', attrs: { x: 44, y: 18, width: 12, height: 42, rx: 6, fill: INK } },
      { tag: 'circle', attrs: { cx: 50, cy: 74, r: 7, fill: INK } },
    ] },

  { id: 'question', label: '물음표', viewBox: VB,
    shapes: [
      badge(LILAC, PURPLE),
      { tag: 'path', attrs: { d: 'M36 38 Q36 22 50 22 Q66 22 66 37 Q66 48 50 52 L50 60', fill: 'none', stroke: INK, 'stroke-width': 9, ...round } },
      { tag: 'circle', attrs: { cx: 50, cy: 76, r: 6, fill: INK } },
    ] },

  { id: 'speech', label: '말풍선', viewBox: VB,
    shapes: [
      { tag: 'path', attrs: { d: 'M14 20 Q14 12 22 12 L78 12 Q86 12 86 20 L86 60 Q86 68 78 68 L44 68 L24 88 L28 68 L22 68 Q14 68 14 60 Z', fill: PAPER, stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' } },
      { tag: 'g', attrs: { fill: INK }, children: [
        { tag: 'circle', attrs: { cx: 34, cy: 40, r: 5 } },
        { tag: 'circle', attrs: { cx: 50, cy: 40, r: 5 } },
        { tag: 'circle', attrs: { cx: 66, cy: 40, r: 5 } },
      ] },
    ] },

  { id: 'thought', label: '생각 풍선', viewBox: VB,
    shapes: [
      { tag: 'ellipse', attrs: { cx: 54, cy: 40, rx: 38, ry: 28, fill: PAPER, stroke: INK, 'stroke-width': 3 } },
      { tag: 'circle', attrs: { cx: 26, cy: 76, r: 7, fill: PAPER, stroke: INK, 'stroke-width': 3 } },
      { tag: 'circle', attrs: { cx: 13, cy: 90, r: 4, fill: PAPER, stroke: INK, 'stroke-width': 3 } },
    ] },

  { id: 'tape-pink', label: '분홍 테이프', viewBox: VB,
    shapes: [
      { tag: 'polygon', attrs: { points: TAPE_POINTS, fill: PINK, 'fill-opacity': 0.85, transform: 'rotate(-12 50 50)' } },
      { tag: 'g', attrs: { stroke: ROSE, 'stroke-width': 3, transform: 'rotate(-12 50 50)' }, children: [
        { tag: 'line', attrs: { x1: 30, y1: 36, x2: 22, y2: 64 } },
        { tag: 'line', attrs: { x1: 50, y1: 36, x2: 42, y2: 64 } },
        { tag: 'line', attrs: { x1: 70, y1: 36, x2: 62, y2: 64 } },
      ] },
    ] },

  { id: 'tape-blue', label: '파랑 테이프', viewBox: VB,
    shapes: [
      { tag: 'polygon', attrs: { points: TAPE_POINTS, fill: BLUE_LIGHT, 'fill-opacity': 0.85, transform: 'rotate(10 50 50)' } },
      { tag: 'g', attrs: { fill: SKY, transform: 'rotate(10 50 50)' }, children: [
        { tag: 'circle', attrs: { cx: 30, cy: 50, r: 5 } },
        { tag: 'circle', attrs: { cx: 50, cy: 50, r: 5 } },
        { tag: 'circle', attrs: { cx: 70, cy: 50, r: 5 } },
      ] },
    ] },

  { id: 'pin', label: '압정', viewBox: VB,
    shapes: [
      { tag: 'line', attrs: { x1: 50, y1: 54, x2: 50, y2: 92, stroke: INK, 'stroke-width': 4, 'stroke-linecap': 'round' } },
      { tag: 'circle', attrs: { cx: 50, cy: 34, r: 24, fill: RED, stroke: '#a8323c', 'stroke-width': 3 } },
      { tag: 'circle', attrs: { cx: 41, cy: 25, r: 7, fill: ROSE } },
    ] },

  { id: 'bookmark', label: '책갈피', viewBox: VB,
    shapes: [
      { tag: 'path', attrs: { d: 'M28 8 L72 8 L72 92 L50 74 L28 92 Z', fill: PURPLE_LIGHT, stroke: PURPLE, 'stroke-width': 3, 'stroke-linejoin': 'round' } },
      { tag: 'line', attrs: { x1: 38, y1: 22, x2: 62, y2: 22, stroke: PURPLE, 'stroke-width': 3, 'stroke-linecap': 'round' } },
    ] },

  { id: 'pencil', label: '연필', viewBox: VB,
    shapes: [
      { tag: 'g', attrs: { transform: 'rotate(-45 50 50)', 'stroke-width': 3, 'stroke-linejoin': 'round' }, children: [
        { tag: 'rect', attrs: { x: 10, y: 40, width: 12, height: 20, fill: PINK, stroke: RED } },
        { tag: 'rect', attrs: { x: 22, y: 40, width: 48, height: 20, fill: YELLOW, stroke: YELLOW_DARK } },
        { tag: 'polygon', attrs: { points: '70,40 90,50 70,60', fill: '#f1dcc0', stroke: BROWN } },
        { tag: 'polygon', attrs: { points: '83,46.5 90,50 83,53.5', fill: INK } },
      ] },
    ] },

  { id: 'book', label: '책', viewBox: VB,
    shapes: [
      { tag: 'path', attrs: { d: 'M50 24 Q32 14 10 18 L10 82 Q32 78 50 88 Z', fill: SKY, stroke: BLUE, 'stroke-width': 3, 'stroke-linejoin': 'round' } },
      { tag: 'path', attrs: { d: 'M50 24 Q68 14 90 18 L90 82 Q68 78 50 88 Z', fill: PAPER, stroke: BLUE, 'stroke-width': 3, 'stroke-linejoin': 'round' } },
      { tag: 'path', attrs: { d: 'M60 36 Q70 31 80 32 M60 48 Q70 43 80 44 M60 60 Q70 55 80 56', fill: 'none', stroke: BLUE_LIGHT, 'stroke-width': 3, 'stroke-linecap': 'round' } },
    ] },

  { id: 'coffee', label: '커피', viewBox: VB,
    shapes: [
      { tag: 'path', attrs: { d: 'M36 26 Q30 18 36 10 M52 26 Q46 18 52 10', fill: 'none', stroke: BROWN, 'stroke-width': 4, 'stroke-linecap': 'round' } },
      { tag: 'path', attrs: { d: 'M71 46 Q88 46 86 60 Q84 72 68 70', fill: 'none', stroke: INK, 'stroke-width': 5, 'stroke-linecap': 'round' } },
      { tag: 'path', attrs: { d: 'M20 36 L72 36 L66 84 Q64 90 58 90 L34 90 Q28 90 26 84 Z', fill: PAPER, stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' } },
      { tag: 'ellipse', attrs: { cx: 46, cy: 40, rx: 24, ry: 3, fill: BROWN } },
    ] },

  { id: 'ribbon', label: '리본', viewBox: VB,
    shapes: [
      { tag: 'g', attrs: { fill: PINK, stroke: RED, 'stroke-width': 3, 'stroke-linejoin': 'round' }, children: [
        { tag: 'polygon', attrs: { points: '46,50 30,92 40,86 46,94 52,54' } },
        { tag: 'polygon', attrs: { points: '54,50 70,92 60,86 54,94 48,54' } },
        { tag: 'path', attrs: { d: 'M50 44 Q24 14 12 28 Q4 48 18 62 Q32 66 50 44 Z' } },
        { tag: 'path', attrs: { d: 'M50 44 Q76 14 88 28 Q96 48 82 62 Q68 66 50 44 Z' } },
      ] },
      { tag: 'circle', attrs: { cx: 50, cy: 44, r: 9, fill: RED } },
    ] },
];
