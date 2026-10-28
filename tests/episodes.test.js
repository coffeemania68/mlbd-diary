import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createDb } from '../src/db/db.js';
import {
  sortEpisodes,
  reserveCount,
  filterEpisodesByStatus,
  nextEpisodeNumber,
  parseIntField,
  isDuplicateNumber,
  normalizeKeyword,
  statusLabel,
  formatChars,
  dateInputToValue,
} from '../src/lib/episodes.js';
import {
  listEpisodes,
  getEpisode,
  createEpisode,
  updateEpisode,
  deleteEpisode,
} from '../src/db/episodes.js';

let n = 0;
const freshDb = () => createDb(`test-episodes-${Date.now()}-${n++}`);

const STATUSES = ['idea', 'draft', 'revised', 'scheduled', 'published'];
const statusArb = fc.constantFrom(...STATUSES);
const episodeArb = fc.record({
  id: fc.uuid(),
  number: fc.integer({ min: 1, max: 20 }),
  createdAt: fc.integer({ min: 0, max: 100 }),
  status: statusArb,
});
const projectArb = fc.constantFrom('p1', 'p2', 'p3');

describe('lib/episodes 예시', () => {
  it('formatChars, statusLabel, dateInputToValue, nextEpisodeNumber', () => {
    expect(formatChars({ actualChars: 1200, targetChars: 5000 })).toBe('1200 / 5000');
    expect(statusLabel('draft')).toBe('초고');
    expect(statusLabel('published')).toBe('발행');
    expect(statusLabel('unknown')).toBe('unknown');
    expect(dateInputToValue('')).toBeNull();
    expect(dateInputToValue('2026-10-29')).toBe('2026-10-29');
    expect(nextEpisodeNumber([])).toBe(1);
    expect(parseIntField(' 3 ', 1)).toEqual({ ok: true, value: 3 });
    expect(parseIntField('1e3', 0)).toEqual({ ok: false });
    expect(normalizeKeyword('  ## 복선 ')).toBe('복선');
  });
});

describe('lib/episodes 속성', () => {
  // Feature: mlbd-book-sections, Property 3: 에피소드 정렬
  it('Property 3: sortEpisodes는 순열이고 (number, createdAt) 순이며 입력을 바꾸지 않는다', () => {
    fc.assert(
      fc.property(fc.array(episodeArb, { maxLength: 15 }), (eps) => {
        const copy = structuredClone(eps);
        const sorted = sortEpisodes(eps);
        expect(eps).toEqual(copy);
        expect([...sorted].map((e) => e.id).sort()).toEqual([...eps].map((e) => e.id).sort());
        expect(sorted).toHaveLength(eps.length);
        for (let i = 1; i < sorted.length; i++) {
          const a = sorted[i - 1];
          const b = sorted[i];
          expect(a.number < b.number || (a.number === b.number && a.createdAt <= b.createdAt)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: mlbd-book-sections, Property 4: 비축분 수
  it('Property 4: reserveCount는 draft·revised·scheduled 수이고 필터와 무관하다', () => {
    fc.assert(
      fc.property(fc.array(episodeArb, { maxLength: 15 }), fc.constantFrom('all', ...STATUSES), (eps, sel) => {
        const expected = eps.filter((e) => ['draft', 'revised', 'scheduled'].includes(e.status)).length;
        expect(reserveCount(eps)).toBe(expected);
        filterEpisodesByStatus(eps, sel);
        expect(reserveCount(eps)).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: mlbd-book-sections, Property 5: 상태 필터
  it('Property 5: filterEpisodesByStatus', () => {
    fc.assert(
      fc.property(fc.array(episodeArb, { maxLength: 15 }), fc.constantFrom('all', ...STATUSES), (eps, sel) => {
        const result = filterEpisodesByStatus(eps, sel);
        if (sel === 'all') expect(result).toEqual(eps);
        else expect(result).toEqual(eps.filter((e) => e.status === sel));
      }),
      { numRuns: 100 },
    );
  });

  // Feature: mlbd-book-sections, Property 6: 새 에피소드 번호
  it('Property 6: nextEpisodeNumber는 비면 1, 아니면 max + 1', () => {
    fc.assert(
      fc.property(fc.array(episodeArb, { maxLength: 15 }), (eps) => {
        const expected = eps.length === 0 ? 1 : Math.max(...eps.map((e) => e.number)) + 1;
        expect(nextEpisodeNumber(eps)).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: mlbd-book-sections, Property 7: 정수 입력 검사
  it('Property 7: parseIntField', () => {
    const rawArb = fc.oneof(
      fc.string(),
      fc.integer({ min: -50, max: 100000 }).map(String),
      fc.tuple(fc.constantFrom('', ' ', '  '), fc.nat(9999), fc.constantFrom('', ' ')).map(([a, v, b]) => `${a}${v}${b}`),
      fc.constantFrom('', ' ', '1.5', '-3', '1e3', '0x1', '12a', '+4', '0', '00'),
    );
    fc.assert(
      fc.property(rawArb, fc.constantFrom(0, 1), (raw, min) => {
        const t = raw.trim();
        const valid = /^\d+$/.test(t) && Number(t) >= min;
        const result = parseIntField(raw, min);
        if (valid) expect(result).toEqual({ ok: true, value: Number(t) });
        else expect(result).toEqual({ ok: false });
      }),
      { numRuns: 100 },
    );
  });

  // Feature: mlbd-book-sections, Property 8: 중복 회차 번호
  it('Property 8: isDuplicateNumber는 자기 자신을 뺀 같은 번호가 있을 때만 true', () => {
    fc.assert(
      fc.property(
        fc.array(episodeArb, { minLength: 1, maxLength: 10 }),
        fc.nat(),
        fc.integer({ min: 1, max: 20 }),
        (eps, k, num) => {
          const id = eps[k % eps.length].id;
          const expected = eps.some((e) => e.id !== id && e.number === num);
          expect(isDuplicateNumber(eps, id, num)).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: mlbd-book-sections, Property 9: 키워드·태그 추가 (normalizeKeyword 부분)
  it('Property 9: normalizeKeyword는 앞뒤 공백·앞 "#"이 없고 멱등이다', () => {
    const rawArb = fc
      .array(fc.constantFrom('#', ' ', '\t', 'a', '가', '복선', '#'), { maxLength: 8 })
      .map((parts) => parts.join(''));
    fc.assert(
      fc.property(fc.oneof(fc.string(), rawArb), (raw) => {
        const k = normalizeKeyword(raw);
        expect(k).toBe(k.trim());
        expect(k.startsWith('#')).toBe(false);
        expect(normalizeKeyword(k)).toBe(k);
      }),
      { numRuns: 100 },
    );
  });
});

describe('db/episodes', () => {
  it('createEpisode 기본값, updateEpisode, getEpisode', async () => {
    const database = freshDb();
    const a = await createEpisode('p1', database);
    expect(a).toMatchObject({
      projectId: 'p1', number: 1, title: '', keywords: [], characterIds: [], places: [], keyPoints: '',
      quotes: [], status: 'idea', targetChars: 0, actualChars: 0, publishDate: null, memo: '', links: [],
    });
    const updated = await updateEpisode(a.id, { title: '1화', id: 'x', createdAt: 1 }, database);
    const stored = await getEpisode(a.id, database);
    expect(stored.title).toBe('1화');
    expect(stored.createdAt).toBe(a.createdAt);
    expect(updated).toEqual(stored);
    await expect(updateEpisode('missing', { title: 'x' }, database)).rejects.toThrow();
  });

  // Feature: mlbd-book-sections, Property 6: 새 에피소드 번호 (createEpisode)
  it('Property 6: createEpisode는 같은 작품 번호만 보고 status idea, 빈 links로 만든다', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ projectId: projectArb, number: fc.integer({ min: 1, max: 50 }) }), { maxLength: 6 }),
        projectArb,
        async (seed, p) => {
          const database = freshDb();
          await database.episodes.bulkAdd(
            seed.map((s, i) => ({ ...s, id: `e${i}`, createdAt: i, updatedAt: i, characterIds: [] })),
          );
          const expected = nextEpisodeNumber(seed.filter((s) => s.projectId === p));
          const created = await createEpisode(p, database);
          const stored = await getEpisode(created.id, database);
          expect(stored.number).toBe(expected);
          expect(stored.status).toBe('idea');
          expect(stored.links).toEqual([]);
          database.close();
          await database.delete();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: mlbd-book-sections, Property 24: 작품 격리 (listEpisodes 부분)
  it('Property 24: listEpisodes(P)는 P의 에피소드 전부만 돌려준다', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ projectId: projectArb, number: fc.integer({ min: 1, max: 9 }) }), { maxLength: 8 }),
        projectArb,
        async (seed, p) => {
          const database = freshDb();
          const records = seed.map((s, i) => ({ ...s, id: `e${i}`, createdAt: i, updatedAt: i, characterIds: [] }));
          await database.episodes.bulkAdd(records);
          const listed = await listEpisodes(p, database);
          expect(listed.every((e) => e.projectId === p)).toBe(true);
          expect(listed.map((e) => e.id).sort()).toEqual(records.filter((r) => r.projectId === p).map((r) => r.id).sort());
          expect(listed).toEqual(sortEpisodes(listed));
          database.close();
          await database.delete();
        },
      ),
      { numRuns: 100 },
    );
  });

  // 여러 작품의 Episode·PlotCard·TimelineEvent와 지울 대상 index
  const worldArb = fc
    .array(projectArb, { minLength: 1, maxLength: 5 })
    .chain((epProjects) => {
      const ids = epProjects.map((_, i) => `e${i}`);
      return fc.record({
        episodes: fc.constant(epProjects.map((projectId, i) => ({
          id: ids[i], projectId, number: i + 1, characterIds: [], createdAt: i, updatedAt: i,
        }))),
        cards: fc.array(
          fc.record({ projectId: projectArb, episodeIds: fc.subarray(ids), title: fc.string({ maxLength: 4 }) }),
          { maxLength: 6 },
        ),
        events: fc.array(
          fc.record({
            projectId: projectArb,
            episodeId: fc.option(fc.constantFrom(...ids), { nil: null }),
            title: fc.string({ maxLength: 4 }),
            sortKey: fc.nat(10),
          }),
          { maxLength: 6 },
        ),
        target: fc.nat(epProjects.length - 1),
      });
    })
    .map((w) => ({
      ...w,
      cards: w.cards.map((c, i) => ({ ...c, id: `c${i}`, createdAt: 0, updatedAt: 0 })),
      events: w.events.map((ev, i) => ({ ...ev, id: `t${i}`, characterIds: [], createdAt: 0, updatedAt: 0 })),
    }));

  async function seedWorld(database, w) {
    await database.episodes.bulkAdd(structuredClone(w.episodes));
    await database.plotCards.bulkAdd(structuredClone(w.cards));
    await database.timelineEvents.bulkAdd(structuredClone(w.events));
  }

  const snapshot = async (database) => ({
    episodes: await database.episodes.orderBy('id').toArray(),
    cards: await database.plotCards.orderBy('id').toArray(),
    events: await database.timelineEvents.orderBy('id').toArray(),
  });

  const withoutUpdatedAt = ({ updatedAt: _u, ...rest }) => rest;

  // Feature: mlbd-book-sections, Property 14: 에피소드 삭제 연쇄
  it('Property 14: deleteEpisode는 같은 작품 카드의 episodeIds와 사건의 episodeId를 정리한다', async () => {
    await fc.assert(
      fc.asyncProperty(worldArb, async (w) => {
        const database = freshDb();
        await seedWorld(database, w);
        const e = w.episodes[w.target];
        await deleteEpisode(e.id, database);

        expect(await getEpisode(e.id, database)).toBeUndefined();
        const after = await snapshot(database);
        expect(after.episodes).toEqual(w.episodes.filter((x) => x.id !== e.id));

        for (const before of w.cards) {
          const card = after.cards.find((c) => c.id === before.id);
          const affected = before.projectId === e.projectId && before.episodeIds.includes(e.id);
          if (affected) {
            expect(withoutUpdatedAt(card)).toEqual(
              withoutUpdatedAt({ ...before, episodeIds: before.episodeIds.filter((x) => x !== e.id) }),
            );
          } else {
            expect(card).toEqual(before);
          }
        }
        // 같은 작품 카드에는 e.id가 남지 않는다 (episodeIds는 같은 작품 에피소드만 담는 것이 정상)
        expect(after.cards.filter((c) => c.projectId === e.projectId).some((c) => c.episodeIds.includes(e.id))).toBe(false);

        for (const before of w.events) {
          const ev = after.events.find((x) => x.id === before.id);
          if (before.episodeId === e.id) {
            expect(ev.episodeId).toBeNull();
            expect(withoutUpdatedAt(ev)).toEqual(withoutUpdatedAt({ ...before, episodeId: null }));
          } else {
            expect(ev).toEqual(before);
          }
        }
        database.close();
        await database.delete();
      }),
      { numRuns: 100 },
    );
  });

  // Feature: mlbd-book-sections, Property 14: 에피소드 삭제 연쇄 (실패 시 전체 되돌림)
  it('Property 14: 트랜잭션 도중 오류가 나면 세 테이블이 모두 그대로다', async () => {
    const failingWorld = worldArb.map((w) => {
      const e = w.episodes[w.target];
      // 오류를 일으킬 사건이 반드시 하나 있도록 넣는다
      const events = [
        ...w.events,
        { id: 'tx', projectId: e.projectId, episodeId: e.id, title: '', sortKey: 0, characterIds: [], createdAt: 0, updatedAt: 0 },
      ];
      return { ...w, events };
    });
    await fc.assert(
      fc.asyncProperty(failingWorld, async (w) => {
        const database = freshDb();
        await seedWorld(database, w);
        const before = await snapshot(database);
        database.timelineEvents.hook('updating', () => {
          throw new Error('boom');
        });
        await expect(deleteEpisode(w.episodes[w.target].id, database)).rejects.toThrow();
        expect(await snapshot(database)).toEqual(before);
        database.close();
        await database.delete();
      }),
      { numRuns: 100 },
    );
  });

  it('없는 id의 deleteEpisode는 아무것도 하지 않는다', async () => {
    const database = freshDb();
    const a = await createEpisode('p1', database);
    await deleteEpisode('missing', database);
    expect(await getEpisode(a.id, database)).toEqual(a);
  });
});
