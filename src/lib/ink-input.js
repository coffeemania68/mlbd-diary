// 손글씨 입력 라우팅 순수 상태 기계 (설계 8절 표, 15.1~15.4). DOM을 쓰지 않는다.
//
// state: { drawingId: number|null, drawingType: string|null, touches: Set<number> }
// event: { kind: 'down'|'up'|'cancel', pointerId, pointerType }
// → { state, action: 'start' | 'cancelStroke' | 'end' | 'ignore' }
// 입력 state는 바꾸지 않고 새 state를 돌려준다.

export function createInkInputState() {
  return { drawingId: null, drawingType: null, touches: new Set() };
}

function result(state, touches, drawingId, drawingType, action) {
  return { state: { ...state, drawingId, drawingType, touches }, action };
}

export function routeInk(state, event, { penOnly = false } = {}) {
  const { kind, pointerId, pointerType } = event;
  const touches = new Set(state.touches);
  const drawing = state.drawingId !== null;

  if (kind === 'down') {
    if (pointerType === 'touch') {
      const otherTouches = touches.size > 0;
      touches.add(pointerId);
      // touch로 그리는 중 두 번째 touch → 선 버림, 두 손가락 이동·확대 (15.3)
      if (state.drawingType === 'touch' && state.drawingId !== pointerId) {
        return result(state, touches, null, null, 'cancelStroke');
      }
      // pen·mouse가 그리는 중(손바닥), penOnly(15.4), 다른 손가락이 이미 있음 → 무시
      if (drawing || penOnly || otherTouches) {
        return result(state, touches, state.drawingId, state.drawingType, 'ignore');
      }
      return result(state, touches, pointerId, 'touch', 'start'); // 15.1
    }
    // pen·mouse: 그리는 선이 없으면 시작. 동시에 그리는 선은 하나뿐
    if (drawing) {
      return result(state, touches, state.drawingId, state.drawingType, 'ignore');
    }
    return result(state, touches, pointerId, pointerType, 'start');
  }

  // up·cancel
  if (pointerType === 'touch') touches.delete(pointerId);
  if (drawing && pointerId === state.drawingId) {
    return result(state, touches, null, null, kind === 'up' ? 'end' : 'cancelStroke');
  }
  return result(state, touches, state.drawingId, state.drawingType, 'ignore');
}
