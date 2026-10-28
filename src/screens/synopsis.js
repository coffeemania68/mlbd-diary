// 시놉시스 화면 (요구사항 14.1~14.4, 15.7).
// 로그라인(input), 짧은 시놉시스(textarea), 긴 시놉시스(textarea, 내용 길이만큼 늘어남).
// 저장 버튼은 없다. 입력하면 자동 저장하고 머리의 Save_Indicator에 상태를 보여 준다.
// 라우터가 화면 교체 전에 flushAll()을 부르므로 정리 함수는 dispose()만 한다.
import '../styles/synopsis.css';

import { getOrCreateSynopsis, updateSynopsis } from '../db/synopsis.js';
import { createAutosave, showStatus } from '../lib/autosave.js';
import { h } from '../lib/dom.js';

// 입력란 정의: Synopsis 필드 이름, 라벨, 요소 종류
const FIELDS = [
  { key: 'logline', label: '로그라인', tag: 'input' },
  { key: 'short', label: '짧은 시놉시스', tag: 'textarea' },
  { key: 'long', label: '긴 시놉시스', tag: 'textarea' },
];

export async function render(el, route) {
  const projectId = route.projectId;
  // 없으면 빈 레코드를 만든 뒤 표시한다 (요구사항 14.3)
  const synopsis = await getOrCreateSynopsis(projectId);

  const indicator = h('span', { class: 'save-indicator', 'aria-live': 'polite' });
  const autosave = createAutosave({
    save: (patch) => updateSynopsis(projectId, patch),
    onStatus: (status) => showStatus(indicator, status),
  });

  const fields = FIELDS.map(({ key, label, tag }) => {
    const id = `synopsis-${key}`;
    const control = h(tag, {
      id,
      class: ['synopsis-input', `synopsis-${key}`],
      value: synopsis[key] ?? '',
      ...(tag === 'input' ? { type: 'text' } : {}),
      oninput: (event) => autosave.schedule({ [key]: event.target.value }),
    });
    return h('div', { class: 'synopsis-field' }, h('label', { for: id }, label), control);
  });

  el.replaceChildren(
    h(
      'section',
      { class: 'synopsis' },
      h(
        'header',
        { class: 'synopsis-header' },
        h('h1', { class: 'screen-title' }, '시놉시스'),
        indicator,
      ),
      fields,
    ),
  );

  return () => autosave.dispose();
}
