// 페이지 화면 하단 도구 막대 (설계 2·5절).
//
// 편집 모드: 위젯 추가, 스티커, 배경(onBackground), 격자 맞춤(aria-pressed, 7.8), 실행 취소, 다시 실행.
//   위젯을 고르면 삭제(확인 창 없음, 6.7)와 앞으로·뒤로·맨 앞으로·맨 뒤로(8.2~8.5).
//   고른 위젯이 스티커면 왼쪽으로·오른쪽으로 돌리기(ROTATION_STEP, 실행 취소 가능)도 보인다.
//   맨 위면 앞으로·맨 앞으로, 맨 아래면 뒤로·맨 뒤로를 비활성화한다(8.7).
// 손글씨 모드: 펜, 형광펜, 선 지우개, INK_PALETTE 6색, INK_SIZES 굵기 3단계(14.9),
//   (펜 감지 시) "펜으로만 쓰기".
//   고른 도구·색·굵기는 page-screen 화면 상태이고 refreshInk로 표시만 맞춘다.
//   실행 취소·다시 실행은 편집·손글씨가 같이 쓴다.
// 보기 모드: 막대를 숨긴다.
//
// 위젯 추가 흐름(6.1, 6.2): choiceDialog(등록된 type의 한국어 이름) → 모듈의 pick?.(ctx)
//   (null이면 취소) → placeNewWidget(보이는 영역, WIDGET_DEFAULT_SIZES[type], 위젯들) + defaults(ctx)
//   → 새 Widget 레코드(rotation: 0)를 onAdd(widget)로 넘긴다(page-screen이 addWidget 명령으로 실행).
//   addFlow(presetType)에 type을 주면 choiceDialog를 건너뛴다. "스티커" 버튼은 addFlow('sticker')로
//   스티커 모듈의 pick(고르기 창)부터 시작하고, 배치·실행 취소는 같은 길을 쓴다(2.2, 2.5, 2.6, 2.8).
import { h, choiceDialog, toast } from '../../lib/dom.js';
import { placeNewWidget } from '../../lib/geometry.js';
import { newRecord } from '../../db/records.js';
import { WIDGET_DEFAULT_SIZES, INK_PALETTE, INK_SIZES } from '../../config.js';
import { availableTypes, getWidget } from '../widgets/index.js';

const FALLBACK_SIZE = { w: 400, h: 300 };

/**
 * @param {{ pageId: string,
 *           getBaseCtx: () => object,             위젯 모듈의 pick·defaults에 넘길 ctx
 *           getVisibleRect: () => {x,y,w,h},       보이는 영역 (Page_Coordinates)
 *           getWidgets: () => Map<string, object>,
 *           onAdd: (widget: object) => Promise<void> | void,
 *           onUndo: () => void, onRedo: () => void,
 *           onDelete: () => void, onToFront: () => void,
 *           onForward?: () => void, onBackward?: () => void, onToBack?: () => void,
 *           onRotateLeft?: () => void, onRotateRight?: () => void,  고른 스티커 회전
 *           onToggleSnap?: () => void,                    격자 맞춤 켜기/끄기
 *           onBackground?: () => void,                    "배경" 버튼 (무늬·배경색 고르기, 5.1)
 *           onInkTool?: (tool: 'pen'|'highlighter'|'eraser') => void,
 *           onInkColor?: (value: string) => void,         INK_PALETTE value
 *           onInkSize?: (size: number) => void,           INK_SIZES 값
 *           onPenOnly?: (on: boolean) => void }} options   "펜으로만 쓰기" (penDetected일 때만 보임)
 */
export function createToolbar({
  pageId, getBaseCtx, getVisibleRect, getWidgets, onAdd, onUndo, onRedo, onDelete, onToFront,
  onForward, onBackward, onToBack, onRotateLeft, onRotateRight, onToggleSnap, onBackground,
  onInkTool, onInkColor, onInkSize, onPenOnly,
}) {
  let adding = false;

  const btn = (label, onclick, extra = {}) =>
    h('button', { type: 'button', class: ['btn', 'toolbar-btn', extra.class], onclick, ...extra.attrs }, label);

  const addBtn = btn('위젯 추가', () => addFlow(), { class: 'btn-primary' });
  const stickerBtn = btn('스티커', () => addFlow('sticker'));
  const undoBtn = btn('실행 취소', () => onUndo(), { attrs: { disabled: true } });
  const redoBtn = btn('다시 실행', () => onRedo(), { attrs: { disabled: true } });
  const deleteBtn = btn('삭제', () => onDelete(), { class: 'toolbar-danger' });
  const forwardBtn = btn('앞으로', () => onForward?.());
  const backwardBtn = btn('뒤로', () => onBackward?.());
  const frontBtn = btn('맨 앞으로', () => onToFront());
  const backBtn = btn('맨 뒤로', () => onToBack?.());
  // 스티커를 골랐을 때만 보인다(refresh의 selectedType)
  const rotateLeftBtn = btn('왼쪽으로 돌리기', () => onRotateLeft?.(), {
    class: 'toolbar-rotate',
    attrs: { 'aria-label': '왼쪽으로 돌리기', hidden: true },
  });
  const rotateRightBtn = btn('오른쪽으로 돌리기', () => onRotateRight?.(), {
    class: 'toolbar-rotate',
    attrs: { 'aria-label': '오른쪽으로 돌리기', hidden: true },
  });
  const snapBtn = btn('격자 맞춤', () => onToggleSnap?.(), {
    class: 'toolbar-snap',
    attrs: { 'aria-pressed': 'false' },
  });

  const backgroundBtn = btn('배경', () => onBackground?.());

  const editGroup = h('div', { class: 'toolbar-group toolbar-edit' }, addBtn, stickerBtn, backgroundBtn, snapBtn);
  const historyGroup = h('div', { class: 'toolbar-group toolbar-history' }, undoBtn, redoBtn);
  const selectionGroup = h(
    'div',
    { class: 'toolbar-group toolbar-selection', hidden: true, role: 'group', 'aria-label': '선택한 위젯' },
    deleteBtn,
    forwardBtn,
    backwardBtn,
    frontBtn,
    backBtn,
    rotateLeftBtn,
    rotateRightBtn,
  );
  // ── 손글씨 묶음 (5.8, 14.9, 15.6~15.8) ──
  const toolBtn = (tool, label) =>
    btn(label, () => onInkTool?.(tool), { class: 'ink-tool-btn', attrs: { 'aria-pressed': 'false', dataset: { tool } } });
  const inkToolBtns = [toolBtn('pen', '펜'), toolBtn('highlighter', '형광펜'), toolBtn('eraser', '선 지우개')];
  const SIZE_LABELS = ['가늘게', '보통', '굵게'];
  const sizeBtns = INK_SIZES.map((size, i) =>
    h(
      'button',
      {
        type: 'button',
        class: 'ink-size-btn',
        'aria-label': `굵기 ${SIZE_LABELS[i] ?? size}`,
        title: SIZE_LABELS[i] ?? String(size),
        'aria-pressed': 'false',
        dataset: { size: String(size) },
        onclick: () => onInkSize?.(size),
      },
      h('span', { class: 'ink-size-dot', style: { '--dot': `${Math.min(size * 2, 28)}px` } }),
    ),
  );
  const swatches = INK_PALETTE.map((c) =>
    h('button', {
      type: 'button',
      class: 'ink-swatch',
      'aria-label': c.label,
      title: c.label,
      'aria-pressed': 'false',
      dataset: { color: c.value },
      style: { '--swatch': c.value },
      onclick: () => onInkColor?.(c.value),
    }),
  );
  const penOnlyBtn = btn('펜으로만 쓰기', () => onPenOnly?.(penOnlyBtn.getAttribute('aria-pressed') !== 'true'), {
    class: 'ink-pen-only',
    attrs: { 'aria-pressed': 'false', hidden: true },
  });
  const inkTools = h('div', { class: 'ink-tools', role: 'group', 'aria-label': '손글씨 도구' }, ...inkToolBtns);
  const inkColors = h('div', { class: 'ink-colors', role: 'group', 'aria-label': '색' }, ...swatches);
  const inkSizes = h('div', { class: 'ink-sizes', role: 'group', 'aria-label': '굵기' }, ...sizeBtns);
  const inkGroup = h(
    'div',
    { class: 'toolbar-group toolbar-ink', hidden: true },
    inkTools,
    inkColors,
    inkSizes,
    penOnlyBtn,
  );

  const el = h(
    'div',
    { class: 'page-toolbar', role: 'toolbar', 'aria-label': '페이지 도구', hidden: true },
    editGroup,
    inkGroup,
    selectionGroup,
    historyGroup,
  );

  let mode = 'view';

  /** @param {string} [presetType] 주면 type 선택 창을 건너뛴다 */
  async function addFlow(presetType) {
    if (adding || mode !== 'edit') return;
    if (presetType && !getWidget(presetType)) return;
    adding = true;
    try {
      const type = presetType
        ? presetType
        : await choiceDialog({
            title: '위젯 추가',
            options: availableTypes().map((t) => ({ value: t, label: getWidget(t).label })),
          });
      if (!type) return;
      const mod = getWidget(type);
      if (!mod) return;
      const ctx = getBaseCtx();
      let picked = {};
      if (typeof mod.pick === 'function') {
        picked = await mod.pick(ctx);
        if (picked === null || picked === undefined) return; // 선택 취소
      }
      const base = mod.defaults?.(ctx) ?? {};
      const place = placeNewWidget(getVisibleRect(), WIDGET_DEFAULT_SIZES[type] ?? FALLBACK_SIZE, getWidgets());
      const widget = newRecord({
        pageId,
        type,
        ...place,
        rotation: 0,
        style: { ...(base.style ?? {}) },
        data: { ...(base.data ?? {}), ...picked },
      });
      await onAdd(widget);
    } catch (err) {
      console.error('위젯 추가 실패', err);
      toast('위젯을 추가하지 못했습니다');
    } finally {
      adding = false;
    }
  }

  return {
    el,
    editGroup,
    selectionGroup,
    inkGroup,
    /** 'view'는 막대 숨김, 'edit'는 편집 묶음, 'ink'는 손글씨 묶음 */
    setMode(next) {
      mode = next;
      el.hidden = next === 'view';
      editGroup.hidden = next !== 'edit';
      inkGroup.hidden = next !== 'ink';
      if (next !== 'edit') selectionGroup.hidden = true;
    },
    /**
     * 버튼 상태. selected: 고른 위젯이 있는지, isTop·isBottom: 맨 위·맨 아래인지(8.7),
     * snap: 격자 맞춤이 켜졌는지(생략하면 그대로), selectedType: 고른 위젯 type(sticker면 회전 버튼)
     */
    refresh({
      canUndo = false, canRedo = false, selected = false, isTop = false, isBottom = false, snap,
      selectedType = null,
    } = {}) {
      const isSticker = selected && selectedType === 'sticker';
      rotateLeftBtn.hidden = !isSticker;
      rotateRightBtn.hidden = !isSticker;
      undoBtn.disabled = !canUndo;
      redoBtn.disabled = !canRedo;
      selectionGroup.hidden = !(selected && mode === 'edit');
      forwardBtn.disabled = isTop;
      frontBtn.disabled = isTop;
      backwardBtn.disabled = isBottom;
      backBtn.disabled = isBottom;
      if (typeof snap === 'boolean') snapBtn.setAttribute('aria-pressed', String(snap));
    },
    /** 손글씨 묶음 상태. penDetected가 아니면 "펜으로만 쓰기"를 숨긴다(15.8) */
    refreshInk({
      tool = 'pen', color = INK_PALETTE[0].value, size = INK_SIZES[1], penDetected = false, penOnly = false,
    } = {}) {
      for (const b of inkToolBtns) b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
      for (const s of swatches) s.setAttribute('aria-pressed', String(s.dataset.color === color));
      for (const b of sizeBtns) b.setAttribute('aria-pressed', String(Number(b.dataset.size) === size));
      inkColors.classList.toggle('is-disabled', tool === 'eraser');
      inkSizes.classList.toggle('is-disabled', tool === 'eraser');
      penOnlyBtn.hidden = !penDetected;
      penOnlyBtn.setAttribute('aria-pressed', String(penDetected && penOnly));
    },
    dispose() {
      el.remove();
    },
  };
}
