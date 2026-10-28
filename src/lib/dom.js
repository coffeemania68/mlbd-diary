// 작은 DOM 헬퍼.
// 사용자 입력은 textContent·텍스트 노드로만 넣는다. innerHTML은 쓰지 않는다.
//
// 이 파일이 만드는 클래스 이름 (스타일은 styles/screens.css에서 정한다):
//   .dialog          확인 창 <dialog>
//   .dialog-title    확인 창 제목 <h2>
//   .dialog-message  확인 창 본문 <p>
//   .dialog-actions  버튼 줄
//   .dialog-form     promptDialog의 <form>
//   .dialog-input    promptDialog의 입력란
//   .dialog-choices  choiceDialog의 선택지 목록 <ul>
//   .dialog-choice   선택지 버튼
//   .dialog-picker   pickerDialog의 그림 칸 격자 (.dialog-picker-cell 안에 .dialog-picker-item 버튼)
//   .btn             버튼 공통
//   .btn-danger      확정(삭제) 버튼
//   .toast           화면 아래 잠깐 뜨는 안내
//   .toast-visible   toast가 보이는 동안 붙는 클래스 (나타남·사라짐 전환용)

const TOAST_DURATION_MS = 2500;
const TOAST_FADE_MS = 200;

// h('button', { class: 'btn', onclick: fn }, '저장')
// attrs:
//   class      문자열 또는 배열 (빈 값은 건너뜀)
//   onXxx      함수면 addEventListener('xxx', fn)
//   style      문자열 또는 객체 ({ color: 'red', '--accent': '#fff' })
//   dataset    객체 → data-* 속성
//   true/false 불리언 속성 (true면 빈 값으로 붙이고, false·null·undefined면 붙이지 않음)
//   value·checked·selected 등은 프로퍼티로도 넣어 입력란 상태가 바로 반영되게 한다
// children: 문자열·숫자는 텍스트 노드, Node는 그대로, 배열은 펼침, null·undefined·false·true는 건너뜀
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    setAttr(el, key, value);
  }
  appendChildren(el, children);
  return el;
}

const PROPERTY_KEYS = new Set(['value', 'checked', 'selected', 'disabled', 'multiple']);

function setAttr(el, key, value) {
  if (value === null || value === undefined || value === false) {
    if (PROPERTY_KEYS.has(key) && value === false) el[key] = false;
    return;
  }
  if (key === 'class' || key === 'className') {
    const names = Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value);
    if (names) el.className = names;
    return;
  }
  if (key.startsWith('on') && typeof value === 'function') {
    el.addEventListener(key.slice(2).toLowerCase(), value);
    return;
  }
  if (key === 'style') {
    if (typeof value === 'string') {
      el.setAttribute('style', value);
    } else {
      for (const [prop, v] of Object.entries(value)) {
        if (v === null || v === undefined || v === false) continue;
        if (prop.startsWith('--')) el.style.setProperty(prop, String(v));
        else el.style[prop] = String(v);
      }
    }
    return;
  }
  if (key === 'dataset') {
    for (const [name, v] of Object.entries(value)) {
      if (v === null || v === undefined || v === false) continue;
      el.dataset[name] = String(v);
    }
    return;
  }
  if (PROPERTY_KEYS.has(key)) {
    el[key] = value;
    if (value === true) el.setAttribute(key, '');
    else if (key === 'value') el.setAttribute(key, String(value));
    return;
  }
  if (value === true) {
    el.setAttribute(key, '');
    return;
  }
  el.setAttribute(key, String(value));
}

function appendChildren(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === true) continue;
    if (Array.isArray(child)) {
      appendChildren(el, child);
    } else if (child instanceof Node) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(String(child)));
    }
  }
}

// 자식을 모두 지운다. 지운 요소를 그대로 돌려준다.
export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

// <dialog> 기반 확인 창. 확정하면 true, 취소·Esc·바깥 누름이면 false
export function confirmDialog({ title, message, confirmLabel = '삭제' } = {}) {
  return new Promise((resolve) => {
    let settled = false;

    const cancelBtn = h('button', { type: 'button', class: 'btn', onclick: () => finish(false) }, '취소');
    const confirmBtn = h(
      'button',
      { type: 'button', class: ['btn', 'btn-danger'], onclick: () => finish(true) },
      confirmLabel,
    );
    const dialog = h(
      'dialog',
      { class: 'dialog', 'aria-labelledby': 'confirm-dialog-title' },
      title ? h('h2', { class: 'dialog-title', id: 'confirm-dialog-title' }, title) : null,
      message ? h('p', { class: 'dialog-message' }, message) : null,
      h('div', { class: 'dialog-actions' }, cancelBtn, confirmBtn),
    );

    function finish(result) {
      if (settled) return;
      settled = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(result);
    }

    // Esc 키
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(false);
    });
    // 다른 경로로 닫힌 경우
    dialog.addEventListener('close', () => finish(false));
    // 바깥(배경) 누름
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) finish(false);
    });

    document.body.appendChild(dialog);
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    // 실수로 지우지 않도록 처음 초점은 취소 버튼에 둔다
    cancelBtn.focus();
  });
}

let dialogSeq = 0;

/**
 * confirmDialog와 같은 방식으로 <dialog>를 연다: Esc·바깥 누름·다른 경로로 닫힘은 onDismiss.
 * finish(result)를 돌려준다. 한 번만 resolve되고 창은 DOM에서 지운다.
 */
function openModal(dialog, resolve, dismissValue) {
  let settled = false;
  function finish(result) {
    if (settled) return;
    settled = true;
    if (dialog.open) dialog.close();
    dialog.remove();
    resolve(result);
  }
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    finish(dismissValue);
  });
  dialog.addEventListener('close', () => finish(dismissValue));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) finish(dismissValue);
  });
  document.body.appendChild(dialog);
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
  return finish;
}

/**
 * 글 한 줄을 받는 창. 확정하면 입력한 문자열(가공하지 않음), 취소·Esc·바깥 누름이면 null.
 * @param {{ title?: string, value?: string, maxLength?: number, confirmLabel?: string }} [options]
 * @returns {Promise<string | null>}
 */
export function promptDialog({ title, value = '', maxLength, confirmLabel = '저장' } = {}) {
  return new Promise((resolve) => {
    const titleId = `prompt-dialog-title-${++dialogSeq}`;
    const input = h('input', {
      type: 'text',
      class: 'dialog-input',
      value: String(value ?? ''),
      maxlength: Number.isInteger(maxLength) && maxLength > 0 ? maxLength : null,
      'aria-labelledby': title ? titleId : null,
      'aria-label': title ? null : '입력',
      enterkeyhint: 'done',
    });
    const cancelBtn = h('button', { type: 'button', class: 'btn', onclick: () => finish(null) }, '취소');
    const confirmBtn = h('button', { type: 'submit', class: ['btn', 'btn-primary'] }, confirmLabel);
    const form = h(
      'form',
      {
        class: 'dialog-form',
        onsubmit: (event) => {
          event.preventDefault();
          finish(input.value);
        },
      },
      input,
      h('div', { class: 'dialog-actions' }, cancelBtn, confirmBtn),
    );
    const dialog = h(
      'dialog',
      { class: 'dialog', 'aria-labelledby': title ? titleId : null },
      title ? h('h2', { class: 'dialog-title', id: titleId }, title) : null,
      form,
    );
    const finish = openModal(dialog, resolve, null);
    input.focus();
    input.select?.();
  });
}

/**
 * 선택지 중 하나를 고르는 창. 고른 선택지의 value, 취소·Esc·바깥 누름이면 null.
 * @param {{ title?: string, options?: { value: any, label: string }[] }} [options]
 * @returns {Promise<any | null>}
 */
export function choiceDialog({ title, options = [] } = {}) {
  return new Promise((resolve) => {
    const titleId = `choice-dialog-title-${++dialogSeq}`;
    const list = h(
      'ul',
      { class: 'dialog-choices', role: 'list' },
      (Array.isArray(options) ? options : []).map((opt) =>
        h(
          'li',
          {},
          h(
            'button',
            { type: 'button', class: ['btn', 'dialog-choice'], onclick: () => finish(opt.value) },
            String(opt.label ?? ''),
          ),
        ),
      ),
    );
    const cancelBtn = h('button', { type: 'button', class: 'btn', onclick: () => finish(null) }, '취소');
    const dialog = h(
      'dialog',
      { class: 'dialog', 'aria-labelledby': title ? titleId : null },
      title ? h('h2', { class: 'dialog-title', id: titleId }, title) : null,
      list,
      h('div', { class: 'dialog-actions' }, cancelBtn),
    );
    const finish = openModal(dialog, resolve, null);
    (list.querySelector('button') ?? cancelBtn).focus();
  });
}

/**
 * 그림 칸 중 하나를 고르는 창(스티커 고르기). 고른 칸의 value, 취소·Esc·바깥 누름이면 null.
 * 칸 버튼은 64×64px, 이름(label)은 aria-label·title로 붙이고 버튼 안에는 render()가 돌려준 Node를 넣는다.
 * @param {{ title?: string, items?: { value: any, label: string, render?: () => Node }[] }} [options]
 * @returns {Promise<any | null>}
 */
export function pickerDialog({ title, items = [] } = {}) {
  return new Promise((resolve) => {
    const titleId = `picker-dialog-title-${++dialogSeq}`;
    const buttons = (Array.isArray(items) ? items : []).map((item) => {
      const name = String(item.label ?? '');
      const content = typeof item.render === 'function' ? item.render() : null;
      return h(
        'button',
        {
          type: 'button',
          class: 'dialog-picker-item',
          'aria-label': name,
          title: name,
          onclick: () => finish(item.value),
        },
        content instanceof Node ? content : name,
      );
    });
    const grid = h('div', { class: 'dialog-picker', role: 'list' },
      ...buttons.map((btn) => h('div', { role: 'listitem', class: 'dialog-picker-cell' }, btn)));
    const cancelBtn = h('button', { type: 'button', class: 'btn', onclick: () => finish(null) }, '취소');
    const dialog = h(
      'dialog',
      { class: ['dialog', 'dialog-picker-dialog'], 'aria-labelledby': title ? titleId : null },
      title ? h('h2', { class: 'dialog-title', id: titleId }, title) : null,
      grid,
      h('div', { class: 'dialog-actions' }, cancelBtn),
    );
    const finish = openModal(dialog, resolve, null);
    (buttons[0] ?? cancelBtn).focus();
  });
}

// 화면 아래 잠깐 뜨는 안내 (예: "이미지를 불러올 수 없습니다"). 시간이 지나면 저절로 사라진다.
export function toast(message) {
  const el = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }, message);
  document.body.appendChild(el);
  // 다음 프레임에 보이는 클래스를 붙여 CSS 전환이 걸리게 한다
  requestAnimationFrame(() => el.classList.add('toast-visible'));
  setTimeout(() => {
    el.classList.remove('toast-visible');
    setTimeout(() => el.remove(), TOAST_FADE_MS);
  }, TOAST_DURATION_MS);
  return el;
}
