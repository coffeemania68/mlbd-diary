// db/episodes.js
// Episode CRUD와 삭제 연쇄, 캐릭터 상세의 등장 회차.
// 모든 함수의 마지막 인자 database는 테스트용이다. 앱에서는 생략한다.
import { db } from './db.js';
import { newRecord, touch } from './records.js';
import { computeAppearances } from '../lib/appearances.js';
import { sortEpisodes, nextEpisodeNumber } from '../lib/episodes.js';

/** 작품의 에피소드 목록. number 오름차순, 같으면 createdAt 오름차순 */
export async function listEpisodes(projectId, database = db) {
  const episodes = await database.episodes.where('projectId').equals(projectId).toArray();
  return sortEpisodes(episodes);
}

/** 에피소드 하나. 없으면 undefined */
export async function getEpisode(id, database = db) {
  return database.episodes.get(id);
}

/** 빈 에피소드를 만든다. number는 같은 작품의 가장 큰 번호 + 1 (비면 1). 만든 레코드를 돌려준다 */
export async function createEpisode(projectId, database = db) {
  return database.transaction('rw', database.episodes, async () => {
    const existing = await database.episodes.where('projectId').equals(projectId).toArray();
    const episode = newRecord({
      projectId,
      number: nextEpisodeNumber(existing),
      title: '',
      keywords: [],
      characterIds: [],
      places: [],
      keyPoints: '',
      quotes: [],
      status: 'idea',
      targetChars: 0,
      actualChars: 0,
      publishDate: null,
      memo: '',
      links: [],
    });
    await database.episodes.add(episode);
    return episode;
  });
}

/** 에피소드 일부를 바꾼다. 없으면 오류. 바뀐 레코드를 돌려준다 */
export async function updateEpisode(id, changes, database = db) {
  return database.transaction('rw', database.episodes, async () => {
    const current = await database.episodes.get(id);
    if (!current) throw new Error(`에피소드가 없습니다: ${id}`);
    const patch = touch(changes);
    await database.episodes.update(id, patch);
    return { ...current, ...patch };
  });
}

/**
 * 한 트랜잭션(episodes, plotCards, timelineEvents):
 *   1. 같은 작품 plotCards 중 episodeIds에 id가 있는 카드 → id를 뺀다 (touch)
 *   2. timelineEvents.where('episodeId').equals(id) → episodeId = null (touch)
 *   3. episodes.delete(id)
 * 없는 id면 아무것도 하지 않는다.
 */
export async function deleteEpisode(id, database = db) {
  return database.transaction(
    'rw',
    database.episodes,
    database.plotCards,
    database.timelineEvents,
    async () => {
      const current = await database.episodes.get(id);
      if (!current) return;
      const now = Date.now();
      await database.plotCards
        .where('projectId')
        .equals(current.projectId)
        .filter((card) => Array.isArray(card.episodeIds) && card.episodeIds.includes(id))
        .modify((card) => {
          Object.assign(card, touch({ episodeIds: card.episodeIds.filter((x) => x !== id) }, now));
        });
      await database.timelineEvents
        .where('episodeId')
        .equals(id)
        .modify((event) => {
          Object.assign(event, touch({ episodeId: null }, now));
        });
      await database.episodes.delete(id);
    },
  );
}

/**
 * 캐릭터가 등장하는 회차 목록. characterIds 다중 값 색인으로 찾은 뒤
 * 같은 작품만 남기고 number 오름차순으로 돌려준다. [{ id, number, title }]
 */
export async function listEpisodesWithCharacter(projectId, characterId, database = db) {
  const episodes = await database.episodes.where('characterIds').equals(characterId).toArray();
  return computeAppearances(episodes, projectId, characterId);
}
