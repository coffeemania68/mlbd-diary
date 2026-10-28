// 만다라트(Mandalart). 다른 레코드가 참조하지 않으므로 삭제 연쇄 정리는 없다.
// 모든 함수의 마지막 인자 database는 테스트용이다. 앱에서는 생략한다.
import { db } from './db.js';
import { newRecord, touch } from './records.js';
import { emptyCells, normalizeCells } from '../lib/mandalart.js';

const withCells = (record) => ({ ...record, cells: normalizeCells(record.cells) });

/** 작품의 만다라트 목록. createdAt 오름차순 */
export async function listMandalarts(projectId, database = db) {
  const list = await database.mandalarts.where('projectId').equals(projectId).toArray();
  return list.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)).map(withCells);
}

/** 만다라트 하나. 없으면 undefined. cells는 normalizeCells로 81칸을 맞춘다 */
export async function getMandalart(id, database = db) {
  const record = await database.mandalarts.get(id);
  return record ? withCells(record) : undefined;
}

/** 빈 만다라트를 만든다 */
export async function createMandalart(projectId, database = db) {
  const record = newRecord({ projectId, title: '', cells: emptyCells(), note: '' });
  await database.mandalarts.add(record);
  return record;
}

/** 일부(title, note, cells)를 바꾼다. 없으면 오류. 바뀐 레코드를 돌려준다 */
export async function updateMandalart(id, changes, database = db) {
  return database.transaction('rw', database.mandalarts, async () => {
    const current = await database.mandalarts.get(id);
    if (!current) throw new Error(`만다라트가 없습니다: ${id}`);
    // eslint-disable-next-line no-unused-vars
    const { projectId, ...rest } = changes;
    const patch = touch(rest);
    await database.mandalarts.update(id, patch);
    return withCells({ ...current, ...patch });
  });
}

/** 만다라트를 지운다 */
export async function deleteMandalart(id, database = db) {
  await database.mandalarts.delete(id);
}
