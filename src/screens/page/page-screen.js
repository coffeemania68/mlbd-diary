// 페이지 화면 (설계 2절). 메인·월간·자유 페이지 화면이 Page를 구한 뒤 mountPageScreen을 부른다.
//
// 1. 읽기(17.1): 이 Page의 위젯, image 위젯·캐릭터 카드가 쓰는 Asset, 캐릭터 카드의 Character,
//    달력·에피소드 카드가 있으면 작품 Episode 목록 한 번, Settings, 자유 페이지면 이 Page의 InkStroke(16.1).
// 2. Page_Model: { widgets: Map<id, Widget>, strokes: Map<id, InkStroke> }
// 3. DOM: 모드 선택(보기·편집, 자유 페이지는 손글씨까지) + Save_Indicator,
//    viewport > sizer > stage(1000×1414) > .page-paper(배경 무늬·색, 첫 자식) + .page-widget-layer > .widget들,
//    하단 도구 막대. 배경 바꾸기(chooseBackground)는 기록에 넣지 않고 setPageBackground로 바로 저장한다(5.8).
//    자유 페이지(inkEnabled)는 잉크 캔버스 2장(.ink-canvas, ink-controller.js)을 위젯 층 뒤에 더한다.
//    선(addStroke·deleteStrokes)도 위젯과 같은 명령 길로 저장·기록한다. 펜 감지는 stage pointerdown(capture).
// 4. 상태: mode(시작 'view', 5.5), selectedId, history = createHistory(HISTORY_LIMIT)
// 5. Page_Writer: createAutosave({ save: (ops) => savePageOps(page.id, ops) }).
//    위젯 내용 입력은 schedule만(500ms, 5.9). 위치·크기·순서·추가·삭제는 schedule 직후 flush(7.3).
//    실패하면 Autosave가 ops를 다시 모아 두고 "저장 실패"를 보인다. 화면은 그대로(16.7, 26.5).
// 6. 정리 함수: 컨트롤러 해제, object URL 해제, setPinnedAssets([]), requestAssetGc()(24.5).
//    기록은 화면과 함께 사라진다(9.6).
//
// 한 동작의 길: applyCommand → commandOps → writer.schedule + flush → push(history)
//   → 해당 위젯 DOM만 반영 → setPinnedAssets(모델 assetId ∪ historyAssetIds ∪ 처리 중 id).
// 실행 취소·다시 실행은 undo/redo로 꺼낸 명령(실행 취소는 inverseCommand)을 같은 길로 적용한다(기록에는 넣지 않음).
//   이때 captureLatest로 화면에서 빠지는 위젯의 그 순간 레코드를 반대쪽 기록에 다시 담는다(내용 편집 보존).
//
// 모드 전환은 data-mode(화면 루트와 viewport)만 바꾸고 위젯을 다시 만들지 않는다.
//
// ── WidgetCtx (설계 4절, widgets/index.js 머리 주석) ──
//   widget (getter, 모델의 최신 값), page, projectId, getMode(), saveContent({ data?, style? }),
//   assets: Map<id, Asset>, characters: Map<id, Character>, episodes (getter, Episode[]),
//   assetUrl(assetId) → object URL 또는 null. 이 화면이 만들고 정리 함수에서 해제한다(모듈은 해제하지 않는다),
//   open(route) (보기 모드에서만 navigate), pickImage(file) → Promise<boolean>, today('YYYY-MM-DD')
import { h, toast, choiceDialog } from '../../lib/dom.js';
import { backgroundView, normalizeBackground } from '../../lib/page-style.js';
import { setPageBackground } from '../../db/pages.js';
import { createAutosave, showStatus } from '../../lib/autosave.js';
import { processImage, ImageLoadError } from '../../lib/image.js';
import { zRanks, zForward, zBackward, zToFront, zToBack, rotationCommand } from '../../lib/geometry.js';
import { createHistory, push, undo, redo, canUndo, canRedo } from '../../lib/history.js';
import { applyCommand, inverseCommand, commandOps, historyAssetIds, captureLatest } from '../../lib/page-model.js';
import { listWidgets, listInkStrokes, savePageOps, addAsset } from '../../db/widgets.js';
import { newRecord } from '../../db/records.js';
import { getAsset, getCharacter } from '../../db/characters.js';
import { listEpisodes } from '../../db/episodes.js';
import { getSettings, updateSettings } from '../../db/settings.js';
import { setPinnedAssets, requestAssetGc } from '../../db/asset-gc.js';
import { navigate } from '../../router.js';
import {
  HISTORY_LIMIT, IMAGE_WIDGET_WARN, INK_PALETTE, INK_SIZES, PAGE_PATTERNS, PAGE_BG_COLORS,
} from '../../config.js';
import { getWidget } from '../widgets/index.js';
import { createStage } from './stage.js';
import { enableWidgetEditing } from './edit-controller.js';
import { createToolbar } from './toolbar.js';
import { enableInk } from './ink-controller.js';

const MODE_LABELS = { view: '보기', edit: '편집', ink: '손글씨' };

const Z_OPS = { forward: zForward, backward: zBackward, front: zToFront, back: zToBack };

const isId = (v) => typeof v === 'string' && v !== '';

/** 기기 지역 날짜 'YYYY-MM-DD' */
function localToday(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function positionFrame(frame, w) {
  frame.style.left = `${w.x}px`;
  frame.style.top = `${w.y}px`;
  frame.style.width = `${w.w}px`;
  frame.style.height = `${w.h}px`;
}

/**
 * @param {HTMLElement} el
 * @param {{ route: object, page: object, inkEnabled?: boolean }} options
 * @returns {Promise<() => void>} 정리 함수
 */
export async function mountPageScreen(el, { route, page, inkEnabled = false }) {
  const projectId = page.projectId ?? route?.projectId;

  // ── 1. 읽기 ──
  const [widgetList, settings, strokeList] = await Promise.all([
    listWidgets(page.id),
    getSettings(),
    inkEnabled ? listInkStrokes(page.id) : Promise.resolve([]), // 16.1: 자유 페이지만, 이 Page의 선만
  ]);
  const assets = new Map();
  const characters = new Map();
  let episodes = [];
  let episodesLoaded = false;

  /** 위젯들이 쓰는 Character·Asset·Episode 중 아직 없는 것만 읽는다 */
  async function loadSources(widgets) {
    const charIds = [
      ...new Set(
        widgets
          .filter((w) => w.type === 'characterCard')
          .map((w) => w.data?.characterId)
          .filter((id) => isId(id) && !characters.has(id)),
      ),
    ];
    const chars = await Promise.all(charIds.map((id) => getCharacter(id)));
    for (const c of chars) {
      if (c && c.projectId === projectId) characters.set(c.id, c); // 26.6
    }
    const assetIds = [
      ...new Set([
        ...widgets.filter((w) => w.type === 'image').map((w) => w.data?.assetId),
        ...charIds.map((id) => characters.get(id)?.imageAssetId),
      ]),
    ].filter((id) => isId(id) && !assets.has(id));
    const found = await Promise.all(assetIds.map((id) => getAsset(id)));
    for (const a of found) if (a) assets.set(a.id, a);
    if (!episodesLoaded && widgets.some((w) => w.type === 'calendar' || w.type === 'episodeCard')) {
      episodes = await listEpisodes(projectId);
      episodesLoaded = true;
    }
  }
  await loadSources(widgetList);

  // ── 2. Page_Model, 4. 상태 ──
  let model = {
    widgets: new Map(widgetList.map((w) => [w.id, w])),
    strokes: new Map(strokeList.map((s) => [s.id, s])),
  };
  let history = createHistory(HISTORY_LIMIT);
  let mode = 'view';
  let selectedId = null;
  let snap = settings?.snapGrid === true;
  let imageWarned = false;
  // 손글씨 도구·색·굵기 (화면 상태로만, 저장하지 않는다. 14.9)
  const inkTool = { tool: 'pen', color: INK_PALETTE[0].value, size: INK_SIZES[1] };
  let penDetected = settings?.penDetected === true;
  let penOnlySetting = settings?.penOnly === true;
  const penOnly = () => penDetected && penOnlySetting; // 펜 감지 기록이 없으면 꺼짐 취급(15.8)
  let disposed = false;
  const processing = new Set(); // 처리 중인 새 이미지 Asset id
  const objectUrls = new Map(); // assetId → object URL
  const entries = new Map();    // widgetId → { frame, content, view }
  const today = localToday();

  // ── 3. DOM ──
  const indicator = h('span', { class: 'save-indicator', 'aria-live': 'polite' });
  const modeTypes = inkEnabled ? ['view', 'edit', 'ink'] : ['view', 'edit'];
  const modeButtons = new Map(
    modeTypes.map((m) => [
      m,
      h('button', { type: 'button', class: ['btn', 'page-mode-btn'], 'aria-pressed': 'false', onclick: () => setMode(m) }, MODE_LABELS[m]),
    ]),
  );
  const bar = h(
    'div',
    { class: 'page-bar' },
    h('div', { class: 'page-modes', role: 'group', 'aria-label': '페이지 모드' }, ...modeButtons.values()),
    indicator,
  );
  const stageHost = h('div', { class: 'page-stage-host' });
  const root = h('div', { class: 'page-screen', dataset: { mode } }, bar, stageHost);
  el.replaceChildren(root);

  let ink = null; // 손글씨 층 (자유 페이지만, 14.11). 아래에서 만든다
  // createStage가 만드는 중에 onScaleChange를 바로 부를 수 있어 let으로 먼저 둔다. 처음 배율은 아래 applyScale이 맞춘다
  let stage = null;
  stage = createStage(stageHost, { onScaleChange: applyScale, onZoomChange: applyScale });
  // 종이 층: stage 첫 자식, 위젯 층·잉크 캔버스 아래(5.4). 입력은 받지 않는다(pointer-events: none)
  const paper = h('div', { class: 'page-paper', 'aria-hidden': 'true' });
  const widgetLayer = h('div', { class: 'page-widget-layer' });
  stage.stage.prepend(paper);
  stage.stage.append(widgetLayer);

  /** Page.background를 종이 층에 그린다. null·이상한 값은 무지·테마 종이색(5.5, 5.6) */
  function applyBackground(bg) {
    const view = backgroundView(bg);
    paper.dataset.pattern = view.pattern;
    paper.style.setProperty('--page-bg', view.colorCss);
  }
  applyBackground(page.background);
  stage.stage.dataset.snap = String(snap);

  function applyScale({ scale }) {
    if (!stage) return;
    if (scale > 0) stage.stage.style.setProperty('--inv-scale', String(1 / scale));
    ink?.onScaleChange(); // fitScale이 바뀌었을 때만 캔버스를 다시 만든다(16.6)
  }
  applyScale({ scale: stage.getScale() });

  // ── 5. Page_Writer ──
  const writer = createAutosave({
    save: (ops) => savePageOps(page.id, ops),
    onStatus: (s) => showStatus(indicator, s),
  });

  // ── 핀 ──
  function refreshPins() {
    if (disposed) return;
    const ids = new Set(historyAssetIds(history));
    for (const w of model.widgets.values()) if (isId(w.data?.assetId)) ids.add(w.data.assetId);
    for (const id of processing) ids.add(id);
    setPinnedAssets([...ids]);
  }

  function assetUrl(assetId) {
    if (!isId(assetId)) return null;
    if (objectUrls.has(assetId)) return objectUrls.get(assetId);
    const blob = assets.get(assetId)?.blob;
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    objectUrls.set(assetId, url);
    return url;
  }

  function checkImageCount() {
    if (imageWarned) return;
    let n = 0;
    for (const w of model.widgets.values()) if (w.type === 'image') n += 1;
    if (n > IMAGE_WIDGET_WARN) {
      imageWarned = true;
      toast('사진이 많으면 페이지가 느려질 수 있습니다');
    }
  }

  // ── 위젯 내용 저장과 이미지 ──
  function setWidget(next) {
    const widgets = new Map(model.widgets);
    widgets.set(next.id, next);
    model = { ...model, widgets };
  }

  function saveContent(id, changes = {}) {
    if (disposed) return;
    const current = model.widgets.get(id);
    if (!current) return;
    const next = { ...current, updatedAt: Date.now() };
    if ('data' in changes) next.data = changes.data;
    if ('style' in changes) next.style = changes.style;
    setWidget(next);
    writer.schedule({ [`w:${id}`]: next });
  }

  async function pickImage(id, file) {
    if (!file) return false;
    let processed;
    try {
      processed = await processImage(file);
    } catch (err) {
      if (!(err instanceof ImageLoadError)) console.error('이미지 처리 실패', err);
      toast('이미지를 불러올 수 없습니다'); // 11.4: 모델은 그대로
      return false;
    }
    if (disposed) return false;
    const assetId = crypto.randomUUID();
    processing.add(assetId);
    refreshPins();
    try {
      const asset = await addAsset(processed, assetId);
      if (disposed) return false;
      assets.set(asset.id, asset);
      const current = model.widgets.get(id);
      if (!current) return false;
      const hadImage = isId(current.data?.assetId);
      const next = { ...current, data: { ...(current.data ?? {}), assetId }, updatedAt: Date.now() };
      setWidget(next);
      writer.schedule({ [`w:${id}`]: next });
      await writer.flush();
      if (disposed) return true;
      entries.get(id)?.view?.update?.(next);
      if (hadImage) requestAssetGc(); // 이전 Asset은 GC가 판단한다(11.3)
      return true;
    } catch (err) {
      console.error('이미지 저장 실패', err);
      toast('이미지를 불러올 수 없습니다');
      return false;
    } finally {
      processing.delete(assetId);
      refreshPins();
    }
  }

  function makeCtx(id) {
    let last = model.widgets.get(id);
    return {
      get widget() {
        const w = model.widgets.get(id);
        if (w) last = w;
        return last;
      },
      page,
      projectId,
      getMode: () => mode,
      saveContent: (changes) => saveContent(id, changes),
      assets,
      characters,
      get episodes() {
        return episodes;
      },
      assetUrl,
      open(nextRoute) {
        if (mode === 'view') navigate(nextRoute);
      },
      pickImage: (file) => pickImage(id, file),
      today,
    };
  }

  /** 위젯 추가 선택(pick)·기본값(defaults)용. 아직 위젯이 없다 */
  function baseCtx() {
    return {
      page,
      projectId,
      getMode: () => mode,
      assets,
      characters,
      get episodes() {
        return episodes;
      },
      today,
    };
  }

  // ── 위젯 틀 ──
  function mountWidget(widget) {
    const content = h('div', { class: 'widget-content' });
    const handle = h('div', { class: 'resize-handle', 'aria-hidden': 'true' });
    const frame = h('div', { class: 'widget', dataset: { id: widget.id, type: widget.type } }, content, handle);
    positionFrame(frame, widget);
    let view = null;
    const mod = getWidget(widget.type);
    if (mod) {
      try {
        view = mod.render(content, makeCtx(widget.id)) ?? null;
      } catch (err) {
        console.error('위젯을 그리지 못했습니다', widget.type, err);
      }
    } else {
      frame.classList.add('widget-unknown'); // 등록되지 않은 type은 빈 틀
    }
    widgetLayer.append(frame);
    entries.set(widget.id, { frame, content, view });
  }

  function unmountWidget(id) {
    const entry = entries.get(id);
    if (!entry) return;
    try {
      entry.view?.dispose?.();
    } catch (err) {
      console.error(err);
    }
    entry.frame.remove();
    entries.delete(id);
  }

  function applyRanks() {
    for (const [id, rank] of zRanks(model.widgets)) {
      const entry = entries.get(id);
      if (entry) entry.frame.style.zIndex = String(rank);
    }
  }

  // ── 선택 ──
  function zState() {
    if (!selectedId || !model.widgets.has(selectedId)) {
      return { selected: false, isTop: false, isBottom: false, selectedType: null };
    }
    const ranks = zRanks(model.widgets);
    const r = ranks.get(selectedId);
    return {
      selected: true,
      isTop: r === ranks.size - 1,
      isBottom: r === 0,
      selectedType: model.widgets.get(selectedId).type,
    };
  }

  function refreshToolbar() {
    toolbar.refresh({ canUndo: canUndo(history), canRedo: canRedo(history), snap, ...zState() });
  }

  function select(id) {
    const next = id && model.widgets.has(id) ? id : null;
    if (next === selectedId) return;
    if (selectedId) entries.get(selectedId)?.frame.classList.remove('selected');
    selectedId = next;
    if (selectedId) entries.get(selectedId)?.frame.classList.add('selected');
    refreshToolbar();
  }

  // ── 한 동작의 길 ──
  function reflect(cmd, record) {
    switch (cmd.type) {
      case 'addWidget': {
        const w = model.widgets.get(cmd.widget.id);
        if (w && !entries.has(w.id)) mountWidget(w);
        applyRanks();
        checkImageCount();
        break;
      }
      case 'deleteWidget':
        if (selectedId === cmd.widget.id) select(null);
        unmountWidget(cmd.widget.id);
        applyRanks();
        break;
      case 'updateWidgets': {
        let zChanged = false;
        for (const change of cmd.after) {
          const w = model.widgets.get(change.id);
          const entry = entries.get(change.id);
          if (w && entry) positionFrame(entry.frame, w);
          // 회전(스티커)은 위젯 모듈이 그린다. 실행 취소·다시 실행도 같은 길(3.5, 3.6)
          if (w && entry && 'rotation' in change) {
            try {
              entry.view?.update?.(w);
            } catch (err) {
              console.error('위젯을 다시 그리지 못했습니다', w.type, err);
            }
          }
          if ('z' in change) zChanged = true;
        }
        if (zChanged) applyRanks();
        break;
      }
      case 'addStroke':
        // 새로 그린 선은 그 선만 더하고(16.4), 실행 취소·다시 실행으로 돌아온 선은 전체 다시(16.5)
        if (record && cmd.stroke) ink?.appendStroke(model.strokes.get(cmd.stroke.id));
        else ink?.redraw();
        break;
      case 'deleteStrokes':
        ink?.redraw(); // 16.5
        break;
      default:
        break;
    }
  }

  function execute(cmd, { record }) {
    if (disposed) return;
    model = applyCommand(model, cmd);
    writer.schedule(commandOps(model, cmd));
    writer.flush();
    if (record) history = push(history, cmd);
    reflect(cmd, record);
    refreshPins();
    refreshToolbar();
  }

  const run = (cmd) => execute(cmd, { record: true });

  function undoAction() {
    const { history: next, cmd } = undo(history, (c) => captureLatest(model, c));
    if (!cmd) return;
    history = next;
    execute(inverseCommand(cmd), { record: false });
  }

  function redoAction() {
    const { history: next, cmd } = redo(history, (c) => captureLatest(model, c));
    if (!cmd) return;
    history = next;
    execute(cmd, { record: false });
  }

  /** 앞뒤 순서 연산('forward' | 'backward' | 'front' | 'back')을 updateWidgets 명령으로 (8.2~8.6) */
  function reorder(op) {
    const fn = Z_OPS[op];
    if (!fn || !selectedId || !model.widgets.has(selectedId)) return;
    const after = fn(model.widgets, selectedId);
    if (after.length === 0) return;
    const before = after.map(({ id }) => ({ id, z: model.widgets.get(id).z }));
    run({ type: 'updateWidgets', before, after });
  }

  /** 고른 스티커를 ROTATION_STEP만큼 돌린다. dir: -1 왼쪽, 1 오른쪽. sticker가 아니면 아무것도 하지 않는다 */
  function rotateSelected(dir) {
    const w = selectedId ? model.widgets.get(selectedId) : null;
    if (!w || w.type !== 'sticker') return;
    run(rotationCommand(w, dir));
  }

  function deleteSelected() {
    const w = selectedId ? model.widgets.get(selectedId) : null;
    if (w) run({ type: 'deleteWidget', widget: w }); // 확인 창 없음(6.7)
  }

  async function addWidget(widget) {
    await loadSources([widget]);
    if (disposed) return;
    run({ type: 'addWidget', widget });
    select(widget.id);
  }

  // ── 격자 맞춤 (7.8, 7.9) ──
  async function toggleSnap() {
    snap = !snap;
    stage.stage.dataset.snap = String(snap);
    refreshToolbar();
    try {
      await updateSettings({ snapGrid: snap });
    } catch (err) {
      console.error('격자 맞춤 설정 저장 실패', err);
    }
    return snap;
  }

  // ── 페이지 배경 (5.2, 5.3, 5.8). Page_History에 넣지 않고 Page Record에 바로 저장 ──
  let choosingBackground = false;
  async function chooseBackground() {
    if (choosingBackground || disposed || mode !== 'edit') return;
    choosingBackground = true;
    try {
      const pattern = await choiceDialog({
        title: '배경 무늬',
        options: PAGE_PATTERNS.map((p) => ({ value: p.id, label: p.label })),
      });
      if (!pattern || disposed) return;
      // 색 value는 null(테마 종이색)일 수 있어 id로 고르고 다시 value로 바꾼다
      const colorId = await choiceDialog({
        title: '배경색',
        options: PAGE_BG_COLORS.map((c) => ({ value: c.id, label: c.label })),
      });
      if (!colorId || disposed) return;
      const color = PAGE_BG_COLORS.find((c) => c.id === colorId);
      if (!color) return;
      const previous = normalizeBackground(page.background);
      try {
        const saved = await setPageBackground(page.id, { pattern, color: color.value });
        if (disposed) return;
        page.background = saved;
        applyBackground(saved);
      } catch (err) {
        console.error('배경 저장 실패', err);
        if (!disposed) applyBackground(previous);
        toast('배경을 저장하지 못했습니다');
      }
    } finally {
      choosingBackground = false;
    }
  }

  // ── 모드 ──
  function setMode(next) {
    if (!modeTypes.includes(next) || disposed) return;
    if (next !== 'view' && root.contains(document.activeElement)) document.activeElement.blur?.();
    mode = next;
    root.dataset.mode = next;
    stage.setMode(next);
    for (const [m, b] of modeButtons) b.setAttribute('aria-pressed', String(m === next));
    if (next !== 'edit') select(null);
    ink?.setEnabled(next === 'ink');
    if (next === 'ink') {
      stage.setZoomEnabled(true); // 손글씨 모드는 모든 기기에서 확대(15.2)
      stage.setInkPan(penOnly()); // penOnly면 한 손가락은 화면 이동(15.4)
    }
    toolbar.setMode(next);
    refreshToolbar();
    refreshInkBar();
  }

  // ── 손글씨 도구·펜 감지 ──
  function refreshInkBar() {
    toolbar.refreshInk({
      tool: inkTool.tool, color: inkTool.color, size: inkTool.size, penDetected, penOnly: penOnly(),
    });
  }

  function setInkSize(size) {
    if (!INK_SIZES.includes(size)) return;
    inkTool.size = size;
    if (inkTool.tool === 'eraser') inkTool.tool = 'pen'; // 굵기를 고르면 펜으로 돌아간다
    refreshInkBar();
  }

  function setInkTool(tool) {
    inkTool.tool = tool;
    refreshInkBar();
  }

  function setInkColor(value) {
    inkTool.color = value;
    if (inkTool.tool === 'eraser') inkTool.tool = 'pen'; // 색을 고르면 펜으로 돌아간다
    refreshInkBar();
  }

  async function setPenOnly(on) {
    penOnlySetting = Boolean(on);
    stage.setInkPan(penOnly());
    refreshInkBar();
    try {
      await updateSettings({ penOnly: penOnlySetting }); // 15.7
    } catch (err) {
      console.error('펜으로만 쓰기 설정 저장 실패', err);
    }
  }

  /** 처음 pen 입력을 보면 펜 감지를 저장하고 펜으로만 쓰기를 켠다 (15.5) */
  function onStagePointerDown(e) {
    if (e.pointerType !== 'pen' || penDetected || disposed) return;
    penDetected = true;
    penOnlySetting = true;
    if (mode === 'ink') stage.setInkPan(true);
    refreshInkBar();
    updateSettings({ penDetected: true, penOnly: true }).catch((err) => console.error('펜 감지 저장 실패', err));
  }
  stage.stage.addEventListener('pointerdown', onStagePointerDown, { capture: true });

  function strokeDone({ tool, color, size, points }) {
    const stroke = newRecord({ pageId: page.id, tool, color, size, points });
    run({ type: 'addStroke', stroke }); // 14.4. 저장 실패해도 모델·화면에 남는다(16.7)
  }

  function erase(strokes) {
    const list = strokes.filter((s) => model.strokes.has(s.id));
    if (list.length > 0) run({ type: 'deleteStrokes', strokes: list }); // 14.8
    else ink?.redraw();
  }

  // ── 도구 막대, 편집 컨트롤러 ──
  const toolbar = createToolbar({
    pageId: page.id,
    getBaseCtx: baseCtx,
    getVisibleRect: () => stage.visiblePageRect(),
    getWidgets: () => model.widgets,
    onAdd: addWidget,
    onUndo: undoAction,
    onRedo: redoAction,
    onDelete: deleteSelected,
    onToFront: () => reorder('front'),
    onForward: () => reorder('forward'),
    onBackward: () => reorder('backward'),
    onToBack: () => reorder('back'),
    onRotateLeft: () => rotateSelected(-1),
    onRotateRight: () => rotateSelected(1),
    onToggleSnap: () => void toggleSnap(),
    onBackground: () => void chooseBackground(),
    onInkTool: setInkTool,
    onInkColor: setInkColor,
    onInkSize: setInkSize,
    onPenOnly: setPenOnly,
  });
  root.append(toolbar.el);

  if (inkEnabled) {
    // 위젯 층 뒤에 캔버스를 붙여 모든 위젯 위에 온다(14.1). 모든 모드에서 보인다(14.2)
    ink = enableInk(stage.stage, {
      getScale: () => stage.getScale(),
      getFitScale: () => stage.getFitScale(),
      getStageRect: () => stage.getStageRect(),
      getStrokes: () => model.strokes,
      getTool: () => ({ ...inkTool }),
      getPenOnly: penOnly,
      onStrokeDone: strokeDone,
      onErase: erase,
    });
  }

  const disposeEditing = enableWidgetEditing(stage.stage, {
    getScale: () => stage.getScale(),
    getModel: () => model,
    getSnap: () => snap,
    onSelect: select,
    onCommit: run,
  });

  for (const w of model.widgets.values()) mountWidget(w);
  applyRanks();
  setMode('view');
  refreshPins();
  checkImageCount();

  // ── 6. 정리 함수 ──
  return function dispose() {
    if (disposed) return;
    // 라우터가 화면 교체 전에 flushAll()을 이미 불렀다. 남은 것이 있으면 저장을 시작만 한다
    void writer.flush();
    disposed = true;
    writer.dispose();
    disposeEditing();
    stage.stage.removeEventListener('pointerdown', onStagePointerDown, { capture: true });
    ink?.dispose();
    ink = null;
    for (const id of [...entries.keys()]) unmountWidget(id);
    toolbar.dispose();
    stage.dispose();
    for (const url of objectUrls.values()) URL.revokeObjectURL(url);
    objectUrls.clear();
    setPinnedAssets([]);
    requestAssetGc();
  };
}
