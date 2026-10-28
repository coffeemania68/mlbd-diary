// 만다라트 9×9 칸 계산. DOM 없는 순수 함수라 node에서 테스트한다.
// cells는 행 우선 81칸 배열이고, 칸은 { text, color }다. color는 팔레트 value 또는 null.
// 블록은 3×3 칸 묶음 9개(0~8, 행 우선), 블록 안 칸도 0~8(행 우선)이다.

export const SIZE = 9; // 9×9
export const CENTER_BLOCK = 4; // 가운데 블록

const COUNT = SIZE * SIZE;

const emptyCell = () => ({ text: '', color: null });

/** text '', color null 81칸 */
export function emptyCells() {
  return Array.from({ length: COUNT }, emptyCell);
}

/**
 * 블록 b(0~8)의 i번째 칸(0~8) → cells 배열 index(0~80)
 * row = floor(b/3)*3 + floor(i/3), col = (b%3)*3 + i%3, index = row*9 + col
 */
export function cellIndex(block, i) {
  const row = Math.floor(block / 3) * 3 + Math.floor(i / 3);
  const col = (block % 3) * 3 + (i % 3);
  return row * SIZE + col;
}

/** cellIndex의 반대. { row, col, block, i } */
export function cellPosition(index) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const block = Math.floor(row / 3) * 3 + Math.floor(col / 3);
  const i = (row % 3) * 3 + (col % 3);
  return { row, col, block, i };
}

/** 가운데 블록의 칸인지 */
export function isCenterCell(index) {
  return cellPosition(index).block === CENTER_BLOCK;
}

/** index 칸만 patch(text, color)로 바꾼 새 배열. 입력 배열은 바꾸지 않는다 */
export function setCell(cells, index, patch) {
  const next = [...cells];
  const cell = { ...cells[index] };
  if ('text' in patch) cell.text = patch.text;
  if ('color' in patch) cell.color = patch.color;
  next[index] = cell;
  return next;
}

function isCell(cell) {
  return (
    cell !== null &&
    typeof cell === 'object' &&
    typeof cell.text === 'string' &&
    (cell.color === null || typeof cell.color === 'string')
  );
}

/**
 * 81칸으로 맞춘다 (옛 데이터 방어). 모양이 맞는 칸은 { text, color }만 남겨 복사하고,
 * 모양이 다른 칸과 모자란 칸은 빈 칸으로 채운다. 81칸을 넘는 부분은 버린다.
 */
export function normalizeCells(cells) {
  const list = Array.isArray(cells) ? cells : [];
  return Array.from({ length: COUNT }, (_, i) => {
    const cell = list[i];
    return isCell(cell) ? { text: cell.text, color: cell.color } : emptyCell();
  });
}
