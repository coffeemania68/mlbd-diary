// 플롯 구조(PlotStructure)와 카드(PlotCard).
// 구조 변경과 카드 위치 갱신은 한 트랜잭션으로 묶어 중간 상태가 남지 않게 한다.
// 모든 함수의 마지막 인자 database는 테스트용이다. 앱에서는 생략한다.
import { db } from './db.js';
import { newRecord, touch } from './records.js';
import { nextOrder } from '../lib/order.js';
import { PLOT_STRUCTURES } from '../config.js';

const DEFAULT_TYPE = 'kishotenketsu';

/** 없으면 kishotenketsu + ['기','승','전','결']로 만든다 (트랜잭션) */
export async function getOrCreatePlotStructure(projectId, database = db) {
  return database.transaction('rw', database.plotStructures, async () => {
    const existing = await database.plotStructures.where('projectId').equals(projectId).first();
    if (existing) return existing;
    const sections = [...PLOT_STRUCTURES.find((s) => s.id === DEFAULT_TYPE).sections];
    const structure = newRecord({ projectId, type: DEFAULT_TYPE, sections });
    await database.plotStructures.add(structure);
    return structure;
  });
}

/** 트랜잭션 안에서 구조를 바꾼다. 없으면 오류 */
async function patchStructure(id, changes, database, now) {
  const current = await database.plotStructures.get(id);
  if (!current) throw new Error(`플롯 구조가 없습니다: ${id}`);
  // eslint-disable-next-line no-unused-vars
  const { projectId, ...rest } = changes;
  const patch = touch(rest, now);
  await database.plotStructures.update(id, patch);
  return { ...current, ...patch };
}

/** 트랜잭션 안에서 카드 위치를 바꾼다. 없는 카드가 있으면 오류(트랜잭션 전체 되돌림) */
async function writePositions(updates, database, now) {
  for (const { id, sectionIndex, order } of updates) {
    const current = await database.plotCards.get(id);
    if (!current) throw new Error(`플롯 카드가 없습니다: ${id}`);
    await database.plotCards.update(id, touch({ sectionIndex, order }, now));
  }
}

/** 구조 일부를 바꾼다 (구간 이름 Autosave용). 바뀐 레코드를 돌려준다 */
export async function updatePlotStructure(id, changes, database = db) {
  return database.transaction('rw', database.plotStructures, () =>
    patchStructure(id, changes, database, Date.now()),
  );
}

/** 구조 변경 + 카드 위치 갱신을 한 트랜잭션(plotStructures, plotCards)에서. 바뀐 구조를 돌려준다 */
export async function applyPlotStructure(id, changes, cardUpdates, database = db) {
  return database.transaction('rw', database.plotStructures, database.plotCards, async () => {
    const now = Date.now();
    const structure = await patchStructure(id, changes, database, now);
    await writePositions(cardUpdates, database, now);
    return structure;
  });
}

/** 작품의 카드 목록. sectionIndex, order 오름차순 */
export async function listPlotCards(projectId, database = db) {
  const cards = await database.plotCards.where('projectId').equals(projectId).toArray();
  return cards.sort(
    (a, b) =>
      a.sectionIndex - b.sectionIndex ||
      a.order - b.order ||
      (a.createdAt ?? 0) - (b.createdAt ?? 0),
  );
}

/** 빈 카드를 sectionIndex 구간 끝에 만든다. order = 그 구간 카드들의 nextOrder */
export async function createPlotCard(projectId, sectionIndex, database = db) {
  return database.transaction('rw', database.plotCards, async () => {
    const existing = await database.plotCards
      .where('[projectId+sectionIndex]')
      .equals([projectId, sectionIndex])
      .toArray();
    const card = newRecord({
      projectId,
      sectionIndex,
      order: nextOrder(existing),
      title: '',
      summary: '',
      episodeIds: [],
    });
    await database.plotCards.add(card);
    return card;
  });
}

/** 카드 일부(title, summary, episodeIds)를 바꾼다. 바뀐 레코드를 돌려준다 */
export async function updatePlotCard(id, changes, database = db) {
  return database.transaction('rw', database.plotCards, async () => {
    const current = await database.plotCards.get(id);
    if (!current) throw new Error(`플롯 카드가 없습니다: ${id}`);
    const patch = touch(changes);
    await database.plotCards.update(id, patch);
    return { ...current, ...patch };
  });
}

/** 카드를 지운다. 다른 레코드가 참조하지 않으므로 연쇄 정리는 없다 */
export async function deletePlotCard(id, database = db) {
  await database.plotCards.delete(id);
}

/** [{ id, sectionIndex, order }]를 한 트랜잭션에서 (touch) */
export async function savePlotCardPositions(updates, database = db) {
  if (updates.length === 0) return;
  return database.transaction('rw', database.plotCards, () =>
    writePositions(updates, database, Date.now()),
  );
}
