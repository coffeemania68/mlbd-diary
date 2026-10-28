// 안내서(#/guide)와 자주 묻는 질문(#/guide/faq) 화면 (요구사항 9.1~9.8, 10.1).
// 작품을 열지 않아도 열린다. 문구는 content/guide.js 상수이고 h() 텍스트 자식으로만 넣는다.
import { APP_VERSION, SCHEMA_VERSION } from '../config.js';
import { FAQ_ITEMS, GUIDE_SECTIONS } from '../content/guide.js';
import { h } from '../lib/dom.js';
import { formatHash, navigate } from '../router.js';
import '../styles/guide.css';

/** "돌아가기": 앞 화면이 있으면 그리로, 없으면(주소로 바로 연 경우) 서재로 (9.7) */
function backButton() {
  return h(
    'button',
    {
      type: 'button',
      class: ['btn', 'guide-back'],
      onclick: () => {
        if (history.length > 1) history.back();
        else navigate({ name: 'library' });
      },
    },
    '돌아가기',
  );
}

function header(title) {
  return h(
    'div',
    { class: 'guide-header' },
    h('h1', { class: 'screen-title' }, title),
    backButton(),
  );
}

function versionLine() {
  return h('p', { class: 'guide-version' }, `앱 버전 ${APP_VERSION} · 데이터 버전 ${SCHEMA_VERSION}`);
}

function sectionEl(section) {
  const titleId = `guide-${section.id}-title`;
  const steps = section.steps ?? [];
  return h(
    'section',
    { class: 'guide-section', id: `guide-${section.id}`, 'aria-labelledby': titleId },
    h('h2', { class: 'guide-section-title', id: titleId }, section.title),
    section.paragraphs.map((text) => h('p', { class: 'guide-text' }, text)),
    steps.length > 0 && h('ol', { class: 'guide-steps' }, steps.map((text) => h('li', {}, text))),
  );
}

export async function render(el) {
  el.replaceChildren(
    h(
      'article',
      { class: 'guide' },
      header('안내서'),
      GUIDE_SECTIONS.map(sectionEl),
      h(
        'p',
        { class: 'guide-links' },
        h('a', { class: ['btn', 'guide-link'], href: formatHash({ name: 'faq' }) }, '자주 묻는 질문'),
      ),
      versionLine(),
    ),
  );
}

async function renderFaq(el) {
  el.replaceChildren(
    h(
      'article',
      { class: ['guide', 'faq'] },
      header('자주 묻는 질문'),
      h(
        'div',
        { class: 'faq-list' },
        FAQ_ITEMS.map((item) =>
          h(
            'details',
            { class: 'faq-item' },
            h('summary', { class: 'faq-question' }, item.q),
            h('p', { class: 'faq-answer' }, item.a),
          ),
        ),
      ),
      h(
        'p',
        { class: 'guide-links' },
        h('a', { class: ['btn', 'guide-link'], href: formatHash({ name: 'guide' }) }, '안내서'),
      ),
      versionLine(),
    ),
  );
}

export const faqScreen = { render: renderFaq };
