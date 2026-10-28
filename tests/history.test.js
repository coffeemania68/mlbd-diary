import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createHistory, push, undo, redo, canUndo, canRedo } from '../src/lib/history.js';
import { applyCommand, inverseCommand, commandOps, historyAssetIds, captureLatest } from '../src/lib/page-model.js';
import { HISTORY_LIMIT } from '../src/config.js';

/** 비교용: updatedAt을 뺀 레코드를 id 순으로 */
function plain(model) {
  const strip = (map) => [...map.values()]
    .map(({ updatedAt, ...rest }) => rest) // eslint-disable-line no-unused-vars
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  return { widgets: strip(model.widgets), strokes: strip(model.strokes) };
}

const widgetFields = fc.record({
  x: fc.integer({ min: 0, max: 940 }), y: fc.integer({ min: 0, max: 1354 }),
  w: fc.integer({ min: 60, max: 400 }), h: fc.integer({ min: 60, max: 400 }), z: fc.integer({ min: -5, max: 20 }),
});
const makeWidget = (id, f) => ({ id, pageId: 'p1', type: 'text', rotation: 0, style: {}, data: { title: id }, updatedAt: 1, ...f });
const makeStroke = (id, n) => ({ id, pageId: 'p1', tool: 'pen', color: '#000', size: 6, points: [[n, n, 0.5]], updatedAt: 1 });

const modelArb = fc.tuple(fc.array(widgetFields, { maxLength: 5 }), fc.nat(4)).map(([ws, ns]) => ({
  widgets: new Map(ws.map((f, i) => [`w${i}`, makeWidget(`w${i}`, f)])),
  strokes: new Map(Array.from({ length: ns }, (_, i) => [`s${i}`, makeStroke(`s${i}`, i)])),
}));

const stepArb = fc.record({
  kind: fc.constantFrom('addWidget', 'deleteWidget', 'updateWidgets', 'addStroke', 'deleteStrokes'),
  pick: fc.nat(),
  count: fc.integer({ min: 1, max: 3 }),
  fields: widgetFields,
  rotation: fc.integer({ min: 0, max: 23 }).map((k) => k * 15),
});

/** 현재 모델의 id에서 골라 명령을 만든다. 적용할 수 없으면 null */
function buildCommand(model, step, n) {
  const ws = [...model.widgets.values()];
  const ss = [...model.strokes.values()];
  switch (step.kind) {
    case 'addWidget': return { type: 'addWidget', widget: makeWidget(`new-w${n}`, step.fields) };
    case 'addStroke': return { type: 'addStroke', stroke: makeStroke(`new-s${n}`, n) };
    case 'deleteWidget':
      return ws.length ? { type: 'deleteWidget', widget: ws[step.pick % ws.length] } : null;
    case 'deleteStrokes': {
      if (!ss.length) return null;
      const start = step.pick % ss.length;
      return { type: 'deleteStrokes', strokes: ss.slice(start, start + step.count) };
    }
    case 'updateWidgets': {
      if (!ws.length) return null;
      const start = step.pick % ws.length;
      const targets = ws.slice(start, start + step.count);
      return {
        type: 'updateWidgets',
        before: targets.map(({ id, x, y, w, h, z, rotation }) => ({ id, x, y, w, h, z, rotation })),
        after: targets.map(({ id }) => ({ id, ...step.fields, rotation: step.rotation })),
      };
    }
  }
}

// Feature: mlbd-pages-backup, Property 4: 명령 실행 취소 왕복
describe('Property 4: 명령 실행 취소 왕복', () => {
  it('apply 뒤 inverse를 apply하면 원래 모델, 위젯 명령은 strokes 불변', () => {
    /** **Validates: Requirements 9.2, 9.3, 6.6, 14.10** */
    fc.assert(fc.property(modelArb, fc.array(stepArb, { maxLength: 15 }), (start, steps) => {
      let model = start;
      steps.forEach((step, n) => {
        const cmd = buildCommand(model, step, n);
        if (!cmd) return;
        const snapshot = plain(model);
        const applied = applyCommand(model, cmd, 1000 + n);
        if (cmd.type.endsWith('Widget') || cmd.type === 'updateWidgets') {
          expect(applied.strokes).toEqual(model.strokes);
        }
        const back = applyCommand(applied, inverseCommand(cmd), 2000 + n);
        expect(plain(back)).toEqual(snapshot);
        expect(plain(model)).toEqual(snapshot); // 입력 불변
        model = applied;
      });
    }), { numRuns: 200 });
  });
});

describe('commandOps', () => {
  const w = makeWidget('a', { x: 0, y: 0, w: 100, h: 100, z: 1 });
  const s = makeStroke('s1', 1);
  const model = { widgets: new Map([['a', w]]), strokes: new Map([['s1', s]]) };

  it('삭제 값은 null', () => {
    expect(commandOps(model, { type: 'deleteWidget', widget: w })).toEqual({ 'w:a': null });
    expect(commandOps(model, { type: 'deleteStrokes', strokes: [s] })).toEqual({ 's:s1': null });
  });

  it('추가·수정 값은 모델의 레코드 전체', () => {
    const cmd = { type: 'updateWidgets', before: [{ id: 'a', x: 0 }], after: [{ id: 'a', x: 50 }] };
    const next = applyCommand(model, cmd, 5);
    expect(commandOps(next, cmd)).toEqual({ 'w:a': { ...w, x: 50, updatedAt: 5 } });
    expect(commandOps(model, { type: 'addStroke', stroke: s })).toEqual({ 's:s1': s });
  });

  it('historyAssetIds는 기록 안 image 위젯의 assetId를 모은다', () => {
    const img = { ...w, id: 'i', type: 'image', data: { assetId: 'asset-1' } };
    let h = push(createHistory(), { type: 'addWidget', widget: img });
    h = push(h, { type: 'addStroke', stroke: s });
    expect([...historyAssetIds(undo(h).history)]).toEqual(['asset-1']);
  });
});

// Feature: mlbd-pages-backup, Property 5: 기록 스택
describe('Property 5: 기록 스택', () => {
  const opArb = fc.oneof(
    fc.record({ op: fc.constant('push'), n: fc.nat() }),
    fc.record({ op: fc.constant('undo') }),
    fc.record({ op: fc.constant('redo') }),
  );

  it('limit 이하, 넘치면 최근 것, push 뒤 redo 없음, undo 뒤 redo는 같은 명령', () => {
    /** **Validates: Requirements 9.1, 9.4, 9.5** */
    fc.assert(fc.property(fc.array(opArb, { maxLength: 80 }), (ops) => {
      let h = createHistory(HISTORY_LIMIT);
      for (const o of ops) {
        const prev = h;
        if (o.op === 'push') {
          const cmd = { type: 'addStroke', stroke: { id: `c${o.n}` } };
          h = push(h, cmd);
          expect(canRedo(h)).toBe(false);
          expect(h.undo).toEqual([...prev.undo, cmd].slice(-HISTORY_LIMIT));
        } else if (o.op === 'undo') {
          const r = undo(h);
          h = r.history;
          if (r.cmd) expect(redo(h).cmd).toBe(r.cmd);
          else expect(canUndo(prev)).toBe(false);
        } else {
          h = redo(h).history;
        }
        expect(h.undo.length).toBeLessThanOrEqual(HISTORY_LIMIT);
      }
    }), { numRuns: 200 });
  });

  it('31번 넣으면 가장 오래된 것이 빠진다', () => {
    let h = createHistory();
    for (let i = 0; i < 31; i++) h = push(h, { i });
    expect(h.undo).toHaveLength(30);
    expect(h.undo[0]).toEqual({ i: 1 });
  });
});

// ── mlbd-final-block: 실행 취소가 그 순간 레코드를 다시 담는다(captureLatest) ──

/** 화면처럼: 기록 없이 모델 위젯의 data·style만 바꾼다(saveContent) */
function contentEdit(model, id, data, style) {
  const widgets = new Map(model.widgets);
  widgets.set(id, { ...model.widgets.get(id), data, style, updatedAt: 9 });
  return { ...model, widgets };
}

/** page-screen의 undoAction·redoAction과 같은 길. capture=false면 기존 동작 */
function doUndo(model, h, capture = true) {
  const r = capture ? undo(h, (c) => captureLatest(model, c)) : undo(h);
  return r.cmd ? { model: applyCommand(model, inverseCommand(r.cmd), 3000), history: r.history } : { model, history: h };
}
function doRedo(model, h, capture = true) {
  const r = capture ? redo(h, (c) => captureLatest(model, c)) : redo(h);
  return r.cmd ? { model: applyCommand(model, r.cmd, 4000), history: r.history } : { model, history: h };
}

const editArb = fc.record({ text: fc.string({ maxLength: 8 }), color: fc.constantFrom('#000000', '#c0392b', '#2e86de') });
const mixedStepArb = fc.oneof(
  fc.record({ op: fc.constant('command'), step: stepArb }),
  fc.record({ op: fc.constant('edit'), pick: fc.nat(), edit: editArb }),
  fc.record({ op: fc.constant('undo') }),
  fc.record({ op: fc.constant('redo') }),
);

describe('captureLatest', () => {
  const w = makeWidget('a', { x: 0, y: 0, w: 100, h: 100, z: 1 });

  it('모델에 있는 위젯이면 현재 레코드로 바꾼 새 명령, 입력은 그대로', () => {
    const edited = { ...w, data: { title: '새 글' } };
    const model = { widgets: new Map([['a', edited]]), strokes: new Map() };
    const cmd = { type: 'addWidget', widget: w };
    const out = captureLatest(model, cmd);
    expect(out).toEqual({ type: 'addWidget', widget: edited });
    expect(cmd.widget).toBe(w);
  });

  it('모델에 없거나 다른 명령이면 cmd 그대로', () => {
    const empty = { widgets: new Map(), strokes: new Map() };
    const del = { type: 'deleteWidget', widget: w };
    expect(captureLatest(empty, del)).toBe(del);
    const upd = { type: 'updateWidgets', before: [{ id: 'a', x: 0 }], after: [{ id: 'a', x: 5 }] };
    expect(captureLatest({ widgets: new Map([['a', w]]), strokes: new Map() }, upd)).toBe(upd);
  });

  it('추가 → 메모 입력 → 실행 취소 → 다시 실행 → 입력한 data', () => {
    let model = { widgets: new Map(), strokes: new Map() };
    const cmd = { type: 'addWidget', widget: w };
    model = applyCommand(model, cmd);
    let h = push(createHistory(), cmd);
    model = contentEdit(model, 'a', { title: '메모' }, { color: '#c0392b' });
    ({ model, history: h } = doUndo(model, h));
    expect(model.widgets.has('a')).toBe(false);
    ({ model, history: h } = doRedo(model, h));
    expect(model.widgets.get('a').data).toEqual({ title: '메모' });
    expect(model.widgets.get('a').style).toEqual({ color: '#c0392b' });
  });

  it('삭제 → 실행 취소 → 편집 → 다시 실행 → 실행 취소 → 편집한 data', () => {
    let model = { widgets: new Map([['a', w]]), strokes: new Map() };
    const cmd = { type: 'deleteWidget', widget: w };
    model = applyCommand(model, cmd);
    let h = push(createHistory(), cmd);
    ({ model, history: h } = doUndo(model, h));
    model = contentEdit(model, 'a', { title: '고친 글' }, {});
    ({ model, history: h } = doRedo(model, h));
    expect(model.widgets.has('a')).toBe(false);
    ({ model, history: h } = doUndo(model, h));
    expect(model.widgets.get('a').data).toEqual({ title: '고친 글' });
  });
});

// Feature: mlbd-final-block, Property 4: 내용 편집을 포함한 실행 취소 왕복
describe('Property 4: 내용 편집을 포함한 실행 취소 왕복', () => {
  it('도달한 상태마다 undo→redo, redo→undo 왕복이 같은 모델, 스택 길이는 capture 없을 때와 같다', () => {
    /** **Validates: Requirements 12.1, 12.2, 12.3, 12.5, 3.6** */
    fc.assert(fc.property(modelArb, fc.array(mixedStepArb, { maxLength: 25 }), (start, steps) => {
      let model = start;
      let h = createHistory(HISTORY_LIMIT);
      let hNo = createHistory(HISTORY_LIMIT); // capture 없이 같은 수열
      steps.forEach((s, n) => {
        if (s.op === 'command') {
          const cmd = buildCommand(model, s.step, n);
          if (!cmd) return;
          model = applyCommand(model, cmd, 1000 + n);
          h = push(h, cmd);
          hNo = push(hNo, cmd);
        } else if (s.op === 'edit') {
          const ws = [...model.widgets.keys()];
          if (!ws.length) return;
          model = contentEdit(model, ws[s.pick % ws.length], { title: s.edit.text }, { color: s.edit.color });
        } else if (s.op === 'undo') {
          ({ model, history: h } = doUndo(model, h));
          hNo = undo(hNo).history;
        } else {
          ({ model, history: h } = doRedo(model, h));
          hNo = redo(hNo).history;
        }
        expect(h.undo.length).toBe(hNo.undo.length);
        expect(h.redo.length).toBe(hNo.redo.length);

        const snapshot = plain(model);
        if (canUndo(h)) {
          const u = doUndo(model, h);
          const back = doRedo(u.model, u.history);
          expect(plain(back.model)).toEqual(snapshot);
        }
        if (canRedo(h)) {
          const r = doRedo(model, h);
          const back = doUndo(r.model, r.history);
          expect(plain(back.model)).toEqual(snapshot);
        }
      });
    }), { numRuns: 200 });
  });
});

// Feature: mlbd-final-block, Property 5: 다시 담은 기록의 이미지 핀
describe('Property 5: 다시 담은 기록의 이미지 핀', () => {
  it('추가 뒤 assetId를 바꾸고 추가를 실행 취소하면 historyAssetIds에 그 id가 있다', () => {
    /** **Validates: Requirements 12.4** */
    fc.assert(fc.property(widgetFields, fc.string({ minLength: 1, maxLength: 20 }), (f, assetId) => {
      const w = { ...makeWidget('img', f), type: 'image', data: { assetId: null } };
      const cmd = { type: 'addWidget', widget: w };
      let model = applyCommand({ widgets: new Map(), strokes: new Map() }, cmd);
      const h = push(createHistory(), cmd);
      model = contentEdit(model, 'img', { assetId }, {});
      const { history } = doUndo(model, h);
      expect(historyAssetIds(history).has(assetId)).toBe(true);
    }), { numRuns: 200 });
  });
});
