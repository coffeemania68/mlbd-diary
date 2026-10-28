// db/sample.js
// 예시 작품(Sample_Project)을 한 트랜잭션에서 만든다 (요구사항 8.5, 8.6).
// 내용은 lib/sample-data.js의 buildSampleProject가 정한다. 중간에 실패하면 모든 테이블이 되돌아간다.
// 마지막 인자 database는 테스트용이다. 앱에서는 생략한다.
import { db } from './db.js';
import { nextOrder } from '../lib/order.js';
import { buildSampleProject } from '../lib/sample-data.js';

/** buildSampleProject가 채우는 테이블. 비어 있는 테이블도 트랜잭션에 넣는다 */
const SAMPLE_TABLES = [
  'projects',
  'synopses',
  'characters',
  'episodes',
  'plotStructures',
  'plotCards',
  'timelineEvents',
  'pages',
  'widgets',
];

/** 예시 작품을 서재 맨 뒤(order = nextOrder)에 만들고 만든 Project를 돌려준다 */
export async function createSampleProject({ now, today } = {}, database = db) {
  const tables = SAMPLE_TABLES.map((name) => database.table(name));
  return database.transaction('rw', tables, async () => {
    const existing = await database.projects.toArray();
    const sample = buildSampleProject({ now, today, order: nextOrder(existing) });
    for (const name of SAMPLE_TABLES) {
      const records = sample.tables[name] ?? [];
      if (records.length > 0) await database.table(name).bulkAdd(records);
    }
    return sample.tables.projects[0];
  });
}
