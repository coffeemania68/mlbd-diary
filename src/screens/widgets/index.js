// 위젯 등록표. type → 위젯 모듈.
// 틀(.widget, data-id, left/top/width/height, zIndex)·선택 표시·손잡이는 page-screen.js가 만들고,
// 내용(.widget-content 안)은 여기 등록된 모듈이 그린다. 등록되지 않은 type은 page-screen이 빈 틀로 둔다.
//
// ── 위젯 모듈의 모양 ──
//   export const label: string                       위젯 추가 목록에 보이는 한국어 이름
//   export function defaults(ctx?): { style, data }  새 위젯·빈 style/data를 채울 기본값 (매번 새 객체)
//   export function pick?(ctx): Promise<object|null> 선택. 추가 전에 고를 것이 있으면 data 일부를 돌려준다. null이면 추가 취소
//   export function render(el, ctx): { update?(widget), dispose?() }
//     el      .widget-content 요소 (page-screen이 만들어 넘긴다. 모듈은 el의 자식만 바꾼다)
//     update  같은 위젯의 Widget Record가 바깥에서 바뀌었을 때(실행 취소·다시 실행 등) 새 Record로 부른다.
//             모듈은 DOM을 새 값에 맞춘다. 입력 중인 칸(document.activeElement)은 값이 같으면 건드리지 않는다
//     dispose 위젯이 사라지거나 화면을 떠날 때 부른다
//
// ── 이 작업(text, checklist)이 기대는 WidgetCtx 약속 (5.3 page-screen.js가 구현) ──
//   ctx.widget        이 위젯의 현재 Widget Record ({ id, pageId, type, x, y, w, h, z, style, data }).
//                     getter로 항상 모델의 최신 값을 돌려준다(saveContent·update 뒤에도 최신).
//                     style·data가 비어 있으면({} 또는 없음) 모듈이 defaults()로 메워 그린다
//   ctx.getMode()     'view' | 'edit'. 내용 입력은 'view'에서만 한다.
//                     모드가 바뀌어도 render를 다시 부르지 않는다(page-screen은 data-mode만 바꾼다).
//                     그래서 모듈은 이벤트 처리 때마다 getMode()를 확인하고, widgets.css가
//                     [data-mode="edit"] 조상 아래의 .widget-content 입력을 막는다
//   ctx.saveContent({ data?, style? })
//                     넘긴 키의 객체를 통째로 바꾼다(얕은 병합 아님: 모듈은 항상 전체 data/전체 style을 넘긴다).
//                     page-screen은 모델의 해당 위젯을 갱신하고 Page_Writer.schedule(500ms 디바운스)만 한다.
//                     render·update를 다시 부르지 않는다(입력 중 커서 유지)
//   (나머지 ctx.page, projectId, assets, characters, episodes, open(route), pickImage(file), today는
//    설계 4절대로 두되 text·checklist는 쓰지 않는다)
//   image    ctx.assetUrl(assetId)(URL은 page-screen이 해제), ctx.pickImage(file)
//   calendar ctx.page(kind·month), ctx.episodes, ctx.projectId, ctx.open(route), ctx.today
//   characterCard ctx.characters, ctx.assetUrl(assetId), ctx.projectId, ctx.open(route). pick은 DB에서 목록을 읽는다
//   episodeCard   ctx.episodes, ctx.today, ctx.projectId, ctx.open(route). pick은 DB에서 목록을 읽는다
//   sticker       ctx.widget(data.stickerId, rotation)만 쓴다. pick은 pickerDialog로 팩에서 고른다. 없는 id는 "없는 스티커"

import '../../styles/widgets.css';
import * as text from './text.js';
import * as checklist from './checklist.js';
import * as image from './image.js';
import * as calendar from './calendar.js';
import * as characterCard from './character-card.js';
import * as episodeCard from './episode-card.js';
import * as sticker from './sticker.js';

export const WIDGETS = { text, checklist, image, calendar, characterCard, episodeCard, sticker };

export const WIDGET_ORDER = ['text', 'checklist', 'image', 'calendar', 'characterCard', 'episodeCard', 'sticker'];

export function getWidget(type) {
  return Object.prototype.hasOwnProperty.call(WIDGETS, type) ? WIDGETS[type] : null;
}

// 등록된 type만, WIDGET_ORDER 순서로
export function availableTypes() {
  return WIDGET_ORDER.filter((type) => getWidget(type) !== null);
}
