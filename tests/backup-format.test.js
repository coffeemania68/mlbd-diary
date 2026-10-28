import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  LIVE_TABLES, backupTablesFor, bytesToBase64, base64ToBytes, backupFileName,
  serializeBackup, parseBackup,
} from '../src/lib/backup-format.js';
import { collectAssetRefs } from '../src/lib/backup-rules.js';
import { BACKUP_FORMAT_ID, SCHEMA_VERSION } from '../src/config.js';

const RUNS = { numRuns: 100 };
const RECORD_TABLES = LIVE_TABLES.filter((n) => n !== 'assets');
const jsonRoundTrip = (v) => JSON.parse(JSON.stringify(v));

// JSON으로 표현 가능한 값과 문자열 id를 가진 Record 배열
const recordsArb = fc.uniqueArray(
  fc.record({ id: fc.string({ maxLength: 8 }), value: fc.jsonValue({ maxDepth: 2 }) }),
  { selector: (r) => r.id, maxLength: 4 },
);
const tablesArb = fc.record(Object.fromEntries(RECORD_TABLES.map((n) => [n, recordsArb])));
const makeAssetArb = (minBytes) => fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }),
  mime: fc.constantFrom('image/webp', 'image/png', 'image/jpeg'),
  width: fc.nat({ max: 4000 }),
  height: fc.nat({ max: 4000 }),
  kind: fc.constant('image'),
  createdAt: fc.nat(),
  updatedAt: fc.nat(),
  bytes: fc.uint8Array({ minLength: minBytes, maxLength: 64 }),
});
const assetArb = makeAssetArb(0);
const assetsArb = fc.uniqueArray(assetArb, { selector: (a) => a.id, maxLength: 4 });
const metaArb = fc.record({
  appVersion: fc.string({ maxLength: 10 }),
  schemaVersion: fc.integer({ min: 1, max: SCHEMA_VERSION }),
  exportedAt: fc.date({ noInvalidDate: true, min: new Date(0), max: new Date(4102444800000) })
    .map((d) => d.toISOString()),
});

const joinParts = (parts) => parts.join('');

// 정상 백업 파일 객체(직접 만든다). 이미지가 하나 이상 있어 Base64를 망가뜨릴 수 있다
const backupObjArb = fc
  .tuple(metaArb, tablesArb, fc.uniqueArray(makeAssetArb(1), {
    selector: (a) => a.id, minLength: 1, maxLength: 3,
  }))
  .map(([meta, tables, assets]) => ({
    format: BACKUP_FORMAT_ID,
    ...meta,
    tables: {
      ...tables,
      assets: assets.map(({ bytes, ...rest }) => ({ ...rest, data: bytesToBase64(bytes) })),
    },
  }));

describe('backup-format 예시', () => {
  it('LIVE_TABLES는 snapshots를 뺀 14개, backupTablesFor 1~3은 같은 목록', () => {
    expect(LIVE_TABLES).toHaveLength(14);
    expect(LIVE_TABLES).not.toContain('snapshots');
    for (const v of [1, 2, 3]) expect(backupTablesFor(v)).toEqual(LIVE_TABLES);
    expect(backupTablesFor(4)).toBeNull();
  });

  it('3MB 바이트 bytesToBase64가 호출 스택 오류 없이 끝나고 되돌아온다', () => {
    const bytes = new Uint8Array(3 * 1024 * 1024);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i * 31 + 7) & 0xff;
    const text = bytesToBase64(bytes);
    expect(text).toBe(Buffer.from(bytes).toString('base64'));
    const back = base64ToBytes(text);
    expect(back.length).toBe(bytes.length);
    expect(Buffer.from(back).equals(Buffer.from(bytes))).toBe(true);
  });

  it('base64ToBytes는 형식이 틀리면 null', () => {
    expect(base64ToBytes('abc')).toBeNull();
    expect(base64ToBytes('ab!c')).toBeNull();
    expect(base64ToBytes('A===')).toBeNull();
    expect(base64ToBytes(42)).toBeNull();
    expect(Array.from(base64ToBytes(''))).toEqual([]);
    expect(Array.from(base64ToBytes('AQI='))).toEqual([1, 2]);
  });

  it('backupFileName은 기기 지역 날짜', () => {
    expect(backupFileName(new Date(2027, 9, 30))).toBe('MyLastBestDiary-백업-2027-10-30.json');
    expect(backupFileName(new Date(2028, 0, 5, 23, 59))).toBe('MyLastBestDiary-백업-2028-01-05.json');
  });

  it('serializeBackup은 Record마다 조각을 나눈다', () => {
    const parts = serializeBackup({
      appVersion: '0.2.0', schemaVersion: 3, exportedAt: '2027-10-30T12:34:56.000Z',
      tables: { projects: [{ id: 'p1' }, { id: 'p2' }] }, assets: [],
    });
    expect(parts.length).toBeGreaterThan(RECORD_TABLES.length);
    const obj = JSON.parse(parts.join(''));
    expect(obj.format).toBe(BACKUP_FORMAT_ID);
    expect(obj.tables.projects).toEqual([{ id: 'p1' }, { id: 'p2' }]);
    expect(obj.tables.characters).toEqual([]);
    expect(obj.tables.assets).toEqual([]);
  });

  it('검사 순서: newer보다 corrupt(정수 아님)가 먼저', () => {
    const text = JSON.stringify({ format: BACKUP_FORMAT_ID, appVersion: '1', schemaVersion: 3.5, tables: {} });
    expect(parseBackup(text)).toEqual({ ok: false, error: 'corrupt' });
  });
});

describe('backup-format 속성', () => {
  // Feature: mlbd-pages-backup, Property 18: 백업 직렬화 왕복
  it('Property 18: serializeBackup → parseBackup 왕복', () => {
    /** **Validates: Requirements 18.2, 18.3, 20.1** */
    fc.assert(
      fc.property(metaArb, tablesArb, assetsArb, (meta, tables, assets) => {
        const text = joinParts(serializeBackup({ ...meta, tables, assets }));
        const res = parseBackup(text);
        expect(res.ok).toBe(true);
        expect(res.value.meta).toEqual({ format: BACKUP_FORMAT_ID, ...meta });
        for (const name of RECORD_TABLES) {
          expect(res.value.tables[name]).toEqual(jsonRoundTrip(tables[name]));
        }
        expect(res.value.assets).toHaveLength(assets.length);
        res.value.assets.forEach((got, i) => {
          const { bytes, ...metaWant } = assets[i];
          const { bytes: gotBytes, ...metaGot } = got;
          expect(metaGot).toEqual(metaWant);
          expect(Array.from(gotBytes)).toEqual(Array.from(bytes));
        });
      }),
      RUNS,
    );
  });

  // Feature: mlbd-pages-backup, Property 19: 손상된 백업 거부
  it('Property 19: 손상된 백업은 정해진 오류로 거부된다', () => {
    /** **Validates: Requirements 20.2, 20.3, 20.4, 20.5** */
    const notJson = fc.string().filter((s) => {
      try {
        JSON.parse(s);
        return false;
      } catch {
        return true;
      }
    });
    const mutationArb = fc.oneof(
      notJson.map((s) => ({ text: s, error: 'not-backup' })),
      fc.string().filter((s) => s !== BACKUP_FORMAT_ID)
        .map((f) => ({ set: (o) => { o.format = f; }, error: 'not-backup' })),
      fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined))
        .map((v) => ({ set: (o) => { o.appVersion = v; }, error: 'corrupt' })),
      fc.oneof(
        fc.integer({ max: 0 }),
        fc.double({ noNaN: true, noDefaultInfinity: true }).filter((d) => !Number.isInteger(d)),
        fc.string(),
        fc.constant(null),
      ).map((v) => ({ set: (o) => { o.schemaVersion = v; }, error: 'corrupt' })),
      fc.tuple(
        fc.constantFrom(...LIVE_TABLES),
        fc.oneof(fc.object({ maxDepth: 1 }), fc.string(), fc.integer(), fc.constant(null), fc.constant(undefined)),
      ).map(([name, v]) => ({ set: (o) => { o.tables[name] = v; }, error: 'corrupt' })),
      fc.tuple(fc.nat(), fc.nat(), fc.constantFrom('!', '-', '_', ' ', '*', '.', '한'))
        .map(([ai, ci, ch]) => ({
          set: (o) => {
            const asset = o.tables.assets[ai % o.tables.assets.length];
            const i = ci % asset.data.length;
            asset.data = asset.data.slice(0, i) + ch + asset.data.slice(i + 1);
          },
          error: 'corrupt',
        })),
      fc.integer({ min: SCHEMA_VERSION + 1, max: 1000 })
        .map((v) => ({ set: (o) => { o.schemaVersion = v; }, error: 'newer' })),
    );
    fc.assert(
      fc.property(backupObjArb, mutationArb, (obj, m) => {
        expect(parseBackup(JSON.stringify(obj)).ok).toBe(true);
        let text = m.text;
        if (text === undefined) {
          m.set(obj);
          text = JSON.stringify(obj);
        }
        expect(parseBackup(text)).toEqual({ ok: false, error: m.error });
      }),
      RUNS,
    );
  });

  // Feature: mlbd-pages-backup, Property 20: 내보내는 Asset
  it('Property 20: 내보내는 Asset은 참조 ∩ 존재하는 Asset', () => {
    /** **Validates: Requirements 18.3, 18.4** */
    const pool = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
    const refArb = fc.option(fc.constantFrom(...pool), { nil: null });
    const arb = fc.record({
      characters: fc.array(refArb.map((imageAssetId) => ({ imageAssetId })), { maxLength: 4 }),
      storageItems: fc.array(refArb.map((assetId) => ({ assetId })), { maxLength: 4 }),
      widgets: fc.array(
        fc.record({ type: fc.constantFrom('image', 'text'), assetId: refArb })
          .map(({ type, assetId }) => ({ type, data: { assetId } })),
        { maxLength: 4 },
      ),
      existing: fc.subarray(pool),
    });
    fc.assert(
      fc.property(arb, ({ characters, storageItems, widgets, existing }) => {
        const withIds = (list, p) => list.map((r, i) => ({ id: `${p}${i}`, ...r }));
        const tables = {
          characters: withIds(characters, 'c'),
          storageItems: withIds(storageItems, 's'),
          widgets: withIds(widgets, 'w'),
        };
        const assets = existing.map((id) => ({
          id, mime: 'image/webp', width: 1, height: 1, kind: 'image', createdAt: 0, updatedAt: 0,
          bytes: new Uint8Array([1, 2, 3]),
        }));
        // 내보내기와 같은 방식: 참조된 Asset만 담는다
        const refs = collectAssetRefs(tables);
        const exported = assets.filter((a) => refs.has(a.id));
        const res = parseBackup(joinParts(serializeBackup({
          appVersion: '0.2.0', schemaVersion: SCHEMA_VERSION, exportedAt: '2027-10-30T00:00:00.000Z',
          tables, assets: exported,
        })));
        expect(res.ok).toBe(true);
        const want = new Set([
          ...characters.map((c) => c.imageAssetId),
          ...storageItems.map((s) => s.assetId),
          ...widgets.filter((w) => w.type === 'image').map((w) => w.data.assetId),
        ].filter((id) => id !== null && existing.includes(id)));
        expect(new Set(res.value.assets.map((a) => a.id))).toEqual(want);
      }),
      RUNS,
    );
  });
});
