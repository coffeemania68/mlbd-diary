// 플롯 카드 위치 계산 (순수 함수).
// 모든 함수는 입력을 바꾸지 않는다. 카드 위치 변경은 { id, sectionIndex, order } 갱신 목록으로 돌려주고,
// 실제로 값이 바뀐 카드만 담는다. 영향을 받은 구간의 order는 0부터 빈틈없이 다시 매긴다.
import { PLOT_STRUCTURES } from '../config.js';
import { sortByOrder } from './order.js';

/** 한 구간의 카드들. order 오름차순 */
function sectionCards(cards, sectionIndex, excludeId) {
  return sortByOrder(cards.filter((c) => c.sectionIndex === sectionIndex && c.id !== excludeId));
}

/** list를 sectionIndex 구간의 0..n-1로 다시 매기고, 값이 바뀐 카드만 updates에 넣는다 */
function renumber(list, sectionIndex, updates) {
  list.forEach((card, order) => {
    if (card.sectionIndex !== sectionIndex || card.order !== order) {
      updates.push({ id: card.id, sectionIndex, order });
    }
  });
}

/** 구간별 카드 배열. 각 구간 안은 sortByOrder. 길이 = sectionCount. 범위 밖 카드는 가까운 구간에 넣는다 */
export function cardsBySection(cards, sectionCount) {
  const columns = Array.from({ length: sectionCount }, () => []);
  if (sectionCount === 0) return columns;
  for (const card of cards) {
    const s = Math.min(Math.max(card.sectionIndex ?? 0, 0), sectionCount - 1);
    columns[s].push(card);
  }
  return columns.map(sortByOrder);
}

/**
 * 카드 하나를 toSection 구간의 toIndex 위치로 옮긴다.
 * toIndex는 "옮길 카드를 뺀 뒤의 목록"에서의 위치. 0 미만은 0, 길이 이상은 끝으로 맞춘다.
 *   위로:      moveCard(cards, id, s, i - 1)
 *   아래로:    moveCard(cards, id, s, i + 1)
 *   구간 이동: moveCard(cards, id, t, Infinity)
 */
export function moveCard(cards, cardId, toSection, toIndex) {
  const card = cards.find((c) => c.id === cardId);
  if (!card) return [];
  const from = card.sectionIndex;
  const target = sectionCards(cards, toSection, cardId);
  const raw = Number.isNaN(toIndex) ? 0 : toIndex;
  const at = Math.min(Math.max(raw, 0), target.length);
  const position = Number.isFinite(at) ? Math.trunc(at) : target.length;
  target.splice(position, 0, card);

  const updates = [];
  if (from !== toSection) renumber(sectionCards(cards, from, cardId), from, updates);
  renumber(target, toSection, updates);
  return updates;
}

/** 옮겨질 카드: sectionIndex >= newCount, (sectionIndex, order) 순서 */
function overflowCards(cards, newCount) {
  return [...cards]
    .filter((c) => c.sectionIndex >= newCount)
    .sort(
      (a, b) =>
        a.sectionIndex - b.sectionIndex ||
        a.order - b.order ||
        (a.createdAt ?? 0) - (b.createdAt ?? 0),
    );
}

/** sectionIndex >= newCount인 카드를 (sectionIndex, order) 순서대로 마지막 구간(newCount-1) 끝에 붙인다 */
export function reduceSections(cards, newCount) {
  const overflow = overflowCards(cards, newCount);
  if (overflow.length === 0 || newCount < 1) return [];
  const last = newCount - 1;
  const updates = [];
  renumber([...sectionCards(cards, last), ...overflow], last, updates);
  return updates;
}

/** reduceSections로 옮겨질 카드 수 (확인 창 문구용) */
export function overflowCount(cards, newCount) {
  return cards.filter((c) => c.sectionIndex >= newCount).length;
}

/**
 * 직접 구간 index를 지운다. sections.length가 1이면 { sections, updates: [] } 그대로.
 * 지우는 구간의 카드는 index-1 구간 끝에 (index가 0이면 새 첫 구간 끝에) 붙는다.
 * index보다 뒤 구간 카드는 sectionIndex가 1 줄어든다.
 */
export function removeSection(sections, cards, index) {
  if (sections.length <= 1 || index < 0 || index >= sections.length) {
    return { sections, updates: [] };
  }
  const nextSections = sections.filter((_, i) => i !== index);
  const removed = sectionCards(cards, index);
  // 지운 카드가 붙을 구간: 옛 번호 기준 index-1, index가 0이면 옛 1번(새 0번)
  const oldTarget = index === 0 ? 1 : index - 1;
  const newTarget = index === 0 ? 0 : index - 1;

  const updates = [];
  renumber([...sectionCards(cards, oldTarget), ...removed], newTarget, updates);
  for (const card of cards) {
    if (card.sectionIndex > index && card.sectionIndex !== oldTarget) {
      updates.push({ id: card.id, sectionIndex: card.sectionIndex - 1, order: card.order });
    }
  }
  return { sections: nextSections, updates };
}

/** 구조 종류를 바꿀 때 새 구간 목록. custom(또는 모르는 종류)은 current 복사본 */
export function structureSections(type, currentSections) {
  const preset = PLOT_STRUCTURES.find((s) => s.id === type)?.sections;
  return preset ? [...preset] : [...currentSections];
}

/** { up, down } — 첫 카드면 up false, 마지막이면 down false (타임라인도 같이 씀) */
export function moveFlags(index, length) {
  return { up: index > 0, down: index < length - 1 };
}
