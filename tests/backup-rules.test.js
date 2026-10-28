import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  shouldShowReminder, fingerprint, shouldCreateSnapshot, snapshotsToDelete,
  collectAssetRefs, orphanAssetIds, keepDeviceSettings,
} from '../src/lib/backup-rules.js';
import { LIVE_TABLES } from '../src/lib/backup-format.js';
import { SNAPSHOT_KEEP } from '../src/config.js';

const RUNS = { numRuns: 100 };
const HOUR = 60 * 60 * 1000;
const FP_TABLES = LIVE_TABLES.filter((n) => n !== 'settings' && n !== 'assets');
const idPool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

describe('backup-rules 예시', () => {
  it('shouldShowReminder 경계: 정확히 168시간이면 참, 1ms 모자라면 거짓', () => {
    expect(shouldShowReminder({ lastBackupAt: 0, projectCount: 0, now: 168 * HOUR })).toBe(true);
    expect(shouldShowReminder({ lastBackupAt: 0, projectCount: 5, now: 168 * HOUR - 1 })).toBe(false);
    expect(shouldShowReminder({ lastBackupAt: null, projectCount: 0, now: 0 })).toBe(false);
    expect(shouldShowReminder({ lastBackupAt: null, projectCount: 1, now: 0 })).toBe(true);
  });

  it('fingerprint 모양과 settings·assets 제외', () => {
    const fp = JSON.parse(fingerprint({ projects: [{ id: 'p', updatedAt: 5 }, { id: 'q', updatedAt: 9 }] }));
    expect(fp.projects).toEqual([2, 9]);
    expect(fp.characters).toEqual([0, 0]);
    expect(fp).not.toHaveProperty('settings');
    expect(fp).not.toHaveProperty('assets');
  });

  it('collectAssetRefs는 image가 아닌 위젯과 null을 넣지 않는다', () => {
    const refs = collectAssetRefs({
      characters: [{ imageAssetId: 'x' }, { imageAssetId: null }],
      storageItems: [{ assetId: 'y' }],
      widgets: [{ type: 'image', data: { assetId: 'z' } }, { type: 'text', data: { assetId: 'q' } },
        { type: 'image', data: {} }],
    });
    expect(refs).toEqual(new Set(['x', 'y', 'z']));
  });
});

describe('backup-rules 속성', () => {
  // Feature: mlbd-pages-backup, Property 17: Asset 정리 대상
  it('Property 17: collectAssetRefs와 orphanAssetIds', () => {
    /** **Validates: Requirements 24.3, 24.4, 22.5** */
    const refArb = fc.option(fc.constantFrom(...idPool), { nil: null });
    const tablesArb = fc.record({
      characters: fc.array(fc.record({ id: fc.string(), imageAssetId: refArb }), { maxLength: 5 }),
      storageItems: fc.array(fc.record({ id: fc.string(), assetId: refArb }), { maxLength: 5 }),
      widgets: fc.array(
        fc.record({ id: fc.string(), type: fc.constantFrom('image', 'text', 'checklist'), ref: refArb })
          .map(({ id, type, ref }) => ({ id, type, data: { assetId: ref } })),
        { maxLength: 5 },
      ),
    });
    const sub = fc.subarray(idPool);
    fc.assert(
      fc.property(tablesArb, sub, fc.array(sub, { maxLength: 3 }), sub, (tables, assetIds, snaps, pinned) => {
        const refs = collectAssetRefs(tables);
        const want = new Set([
          ...tables.characters.map((c) => c.imageAssetId),
          ...tables.storageItems.map((s) => s.assetId),
          ...tables.widgets.filter((w) => w.type === 'image').map((w) => w.data.assetId),
        ].filter((id) => id !== null));
        expect(refs).toEqual(want);

        const orphans = orphanAssetIds(assetIds, { liveRefs: refs, snapshotRefs: snaps, pinned: new Set(pinned) });
        const snapIds = new Set(snaps.flat());
        const expected = assetIds.filter((id) => !refs.has(id) && !snapIds.has(id) && !pinned.includes(id));
        expect(new Set(orphans)).toEqual(new Set(expected));
        // 스냅샷 id를 펼친 목록으로 줘도 같다
        expect(new Set(orphanAssetIds(assetIds, { liveRefs: refs, snapshotRefs: [...snapIds], pinned })))
          .toEqual(new Set(expected));
      }),
      RUNS,
    );
  });

  // Feature: mlbd-pages-backup, Property 21: 백업 알림 조건
  it('Property 21: shouldShowReminder', () => {
    /** **Validates: Requirements 19.1, 19.2, 19.5** */
    const t = fc.integer({ min: 0, max: 4_000_000_000_000 });
    fc.assert(
      fc.property(fc.option(t, { nil: null }), t, fc.nat({ max: 20 }), (lastBackupAt, now, projectCount) => {
        const want = lastBackupAt === null
          ? projectCount >= 1
          : now - lastBackupAt >= 168 * HOUR;
        expect(shouldShowReminder({ lastBackupAt, projectCount, now })).toBe(want);
      }),
      RUNS,
    );
  });

  // Feature: mlbd-pages-backup, Property 22: 스냅샷 생성 조건과 지문
  it('Property 22: shouldCreateSnapshot 조건', () => {
    /** **Validates: Requirements 22.3, 22.4** */
    const fpArb = fc.constantFrom('f1', 'f2', 'f3');
    fc.assert(
      fc.property(
        fc.boolean(), fc.option(fpArb.map((fingerprint) => ({ fingerprint })), { nil: null }), fpArb, fc.nat({ max: 5 }),
        (hasTodaySnapshot, latest, currentFingerprint, projectCount) => {
          const want = !hasTodaySnapshot
            && (latest === null ? projectCount >= 1 : latest.fingerprint !== currentFingerprint);
          expect(shouldCreateSnapshot({ hasTodaySnapshot, latest, currentFingerprint, projectCount })).toBe(want);
        },
      ),
      RUNS,
    );
  });

  it('Property 22: fingerprint는 추가·삭제·updatedAt 증가에 바뀌고 settings에는 그대로', () => {
    /** **Validates: Requirements 22.3, 22.4** */
    const recordsArb = fc.uniqueArray(
      fc.record({ id: fc.string({ maxLength: 6 }), updatedAt: fc.nat({ max: 1e12 }) }),
      { selector: (r) => r.id, maxLength: 4 },
    );
    const tablesArb = fc.record(Object.fromEntries([...FP_TABLES, 'settings', 'assets'].map((n) => [n, recordsArb])));
    const changeArb = fc.oneof(
      fc.constant('add'), fc.constant('delete'), fc.constant('update'), fc.constant('settings'),
    );
    fc.assert(
      fc.property(tablesArb, fc.constantFrom(...FP_TABLES), changeArb, fc.nat(), fc.nat({ max: 1e6 }),
        (tables, name, change, idx, delta) => {
          const before = fingerprint(tables);
          const next = { ...tables, [name]: [...tables[name]] };
          const list = next[name];
          const max = list.reduce((m, r) => Math.max(m, r.updatedAt), 0);
          if (change === 'add') {
            list.push({ id: `new-${list.length}`, updatedAt: delta });
          } else if (change === 'delete') {
            if (list.length === 0) return;
            list.splice(idx % list.length, 1);
          } else if (change === 'update') {
            if (list.length === 0) return;
            const i = idx % list.length;
            list[i] = { ...list[i], updatedAt: max + 1 + delta };
          } else {
            next.settings = [{ id: 'settings', updatedAt: delta, lastOpenedProjectId: String(idx) }];
            expect(fingerprint(next)).toBe(before);
            return;
          }
          expect(fingerprint(next)).not.toBe(before);
        }),
      RUNS,
    );
  });

  // Feature: mlbd-pages-backup, Property 23: 스냅샷 7개 회전
  it('Property 23: snapshotsToDelete', () => {
    /** **Validates: Requirements 22.6, 23.4** */
    const snapsArb = fc.uniqueArray(
      fc.record({ id: fc.string({ minLength: 1, maxLength: 4 }), createdAt: fc.nat({ max: 50 }) }),
      { selector: (s) => s.id, maxLength: 15 },
    );
    fc.assert(
      fc.property(snapsArb, fc.nat(), fc.array(fc.nat(), { maxLength: 3 }), (snaps, seed, picks) => {
        const protectIds = snaps.length ? picks.map((p) => snaps[(p + seed) % snaps.length].id) : [];
        const removed = snapshotsToDelete(snaps, SNAPSHOT_KEEP, protectIds);
        const removedSet = new Set(removed);
        const kept = snaps.filter((s) => !removedSet.has(s.id));
        // 겹치지 않게 나눈다
        expect(removed.length).toBe(removedSet.size);
        expect(removed.every((id) => snaps.some((s) => s.id === id))).toBe(true);
        expect(kept.length + removed.length).toBe(snaps.length);
        // 최근 7개(같은 createdAt이면 어느 쪽이든)와 보호 id는 남는다
        const sortedTimes = snaps.map((s) => s.createdAt).sort((a, b) => b - a);
        const cutoff = sortedTimes[SNAPSHOT_KEEP - 1];
        if (cutoff !== undefined) {
          for (const s of snaps) if (s.createdAt > cutoff) expect(removedSet.has(s.id)).toBe(false);
        } else {
          expect(removed).toEqual([]);
        }
        const keptRecent = kept.filter((s) => !protectIds.includes(s.id));
        expect(keptRecent.length).toBeLessThanOrEqual(SNAPSHOT_KEEP);
        for (const id of protectIds) expect(removedSet.has(id)).toBe(false);
        // 남은 것 중 보호가 아닌 것은 지운 것보다 오래되지 않았다
        for (const s of keptRecent) {
          for (const id of removed) expect(s.createdAt).toBeGreaterThanOrEqual(snaps.find((x) => x.id === id).createdAt);
        }
        // 보호가 아닌 남은 것 + 보호 id 수로, 최근 7개를 다 채운다
        expect(kept.length).toBeGreaterThanOrEqual(Math.min(snaps.length, SNAPSHOT_KEEP));
      }),
      RUNS,
    );
  });

  // Feature: mlbd-pages-backup, Property 24: 기기 설정 유지
  it('Property 24: keepDeviceSettings', () => {
    /** **Validates: Requirements 21.7, 23.8** */
    const settingsArb = fc.record({
      id: fc.constant('settings'),
      lastBackupAt: fc.option(fc.nat(), { nil: null }),
      penDetected: fc.boolean(),
      penOnly: fc.boolean(),
      snapGrid: fc.boolean(),
      schemaVersion: fc.integer({ min: 1, max: 3 }),
      lastOpenedProjectId: fc.option(fc.string(), { nil: null }),
    });
    fc.assert(
      fc.property(settingsArb, settingsArb, (imported, device) => {
        const out = keepDeviceSettings(imported, device);
        expect(out.lastBackupAt).toBe(device.lastBackupAt);
        expect(out.penDetected).toBe(device.penDetected);
        expect(out.penOnly).toBe(device.penOnly);
        for (const key of ['id', 'snapGrid', 'schemaVersion', 'lastOpenedProjectId']) {
          expect(out[key]).toBe(imported[key]);
        }
      }),
      RUNS,
    );
  });
});
