// Page_Model과 실행 취소 명령. DOM을 쓰지 않는다.
//
// Page_Model: { widgets: Map<id, Widget>, strokes: Map<id, InkStroke> }
// 명령 5종(평범한 객체):
//   { type: 'addWidget', widget }            { type: 'deleteWidget', widget }
//   { type: 'updateWidgets', before: [{ id, ...fields }], after: [{ id, ...fields }] }  // 이동·크기·z
//   { type: 'addStroke', stroke }            { type: 'deleteStrokes', strokes: [...] }
// deleteStrokes(지우개 한 번에 여러 선)를 되돌리는 addStroke는 stroke 대신 strokes 배열을 갖는다.
// 위젯 명령은 strokes를, 선 명령은 widgets를 바꾸지 않는다.
// 실행 취소·다시 실행이 명령을 반대쪽 기록으로 옮길 때 captureLatest로 위젯의 그 순간 레코드를 다시 담는다.

/** addStroke·deleteStrokes가 다루는 선 목록 */
const strokesOf = (cmd) => cmd.strokes ?? [cmd.stroke];

function unknown(cmd) {
  return new Error(`알 수 없는 명령: ${cmd?.type}`);
}

/** 되돌리는 명령. add ↔ delete, updateWidgets는 before/after 교환 */
export function inverseCommand(cmd) {
  switch (cmd.type) {
    case 'addWidget': return { type: 'deleteWidget', widget: cmd.widget };
    case 'deleteWidget': return { type: 'addWidget', widget: cmd.widget };
    case 'updateWidgets': return { type: 'updateWidgets', before: cmd.after, after: cmd.before };
    case 'addStroke': return { type: 'deleteStrokes', strokes: strokesOf(cmd) };
    case 'deleteStrokes': return { type: 'addStroke', strokes: cmd.strokes };
    default: throw unknown(cmd);
  }
}

/**
 * addWidget·deleteWidget이고 model에 같은 id 위젯이 있으면 그 현재 레코드로 바꾼 새 명령.
 * 그 밖(다른 명령, model에 위젯 없음)은 cmd 그대로. 입력을 바꾸지 않는다
 */
export function captureLatest(model, cmd) {
  if (cmd.type !== 'addWidget' && cmd.type !== 'deleteWidget') return cmd;
  const current = model.widgets.get(cmd.widget.id);
  return current ? { ...cmd, widget: current } : cmd;
}

/** 명령을 적용한 새 model. 입력 model은 바꾸지 않는다. updateWidgets는 필드만 덮고 updatedAt을 갱신한다 */
export function applyCommand(model, cmd, now = Date.now()) {
  switch (cmd.type) {
    case 'addWidget': {
      const widgets = new Map(model.widgets);
      widgets.set(cmd.widget.id, cmd.widget);
      return { ...model, widgets };
    }
    case 'deleteWidget': {
      const widgets = new Map(model.widgets);
      widgets.delete(cmd.widget.id);
      return { ...model, widgets };
    }
    case 'updateWidgets': {
      const widgets = new Map(model.widgets);
      for (const { id, ...fields } of cmd.after) {
        const current = widgets.get(id);
        if (current) widgets.set(id, { ...current, ...fields, updatedAt: now });
      }
      return { ...model, widgets };
    }
    case 'addStroke': {
      const strokes = new Map(model.strokes);
      for (const s of strokesOf(cmd)) strokes.set(s.id, s);
      return { ...model, strokes };
    }
    case 'deleteStrokes': {
      const strokes = new Map(model.strokes);
      for (const s of cmd.strokes) strokes.delete(s.id);
      return { ...model, strokes };
    }
    default: throw unknown(cmd);
  }
}

/**
 * Page_Writer에 넘길 ops. 키는 'w:<id>'·'s:<id>', 값은 레코드 전체 또는 null(삭제).
 * model은 applyCommand를 마친 뒤의 model이다.
 */
export function commandOps(model, cmd) {
  switch (cmd.type) {
    case 'addWidget':
      return { [`w:${cmd.widget.id}`]: model.widgets.get(cmd.widget.id) ?? cmd.widget };
    case 'deleteWidget':
      return { [`w:${cmd.widget.id}`]: null };
    case 'updateWidgets':
      return Object.fromEntries(cmd.after.map(({ id }) => [`w:${id}`, model.widgets.get(id) ?? null]));
    case 'addStroke':
      return Object.fromEntries(strokesOf(cmd).map((s) => [`s:${s.id}`, model.strokes.get(s.id) ?? s]));
    case 'deleteStrokes':
      return Object.fromEntries(cmd.strokes.map((s) => [`s:${s.id}`, null]));
    default: throw unknown(cmd);
  }
}

/** undo·redo 기록 안 위젯이 가리키는 data.assetId 모음(Set). Asset_GC 핀에 넣는다 */
export function historyAssetIds(h) {
  const ids = new Set();
  const add = (w) => { if (w?.data?.assetId) ids.add(w.data.assetId); };
  for (const cmd of [...h.undo, ...h.redo]) {
    if (cmd.type === 'addWidget' || cmd.type === 'deleteWidget') add(cmd.widget);
    else if (cmd.type === 'updateWidgets') { cmd.before.forEach(add); cmd.after.forEach(add); }
  }
  return ids;
}
