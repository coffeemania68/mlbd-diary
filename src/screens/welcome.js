// 첫 실행 안내 화면 (요구사항 7.4~7.10, 8.1, 8.6, 9.6). 경로 #/welcome.
// 카드 3장(content/onboarding.js)을 이전·다음으로 넘긴다. 모든 장에 "건너뛰기".
// 마지막 장에는 "다음" 대신 시작 방법 셋("예시 작품으로 시작", "빈 서재로 시작", "백업 파일로 복원")과
// "안내서 보기" 링크. 문구는 모두 h() 텍스트 자식으로만 넣는다(7.10).
//
// 만드는 클래스 이름 (스타일은 styles/welcome.css):
//   .welcome                화면 전체 (카드를 가운데에)
//   .welcome-card           카드 하나
//   .welcome-step           "N / 3"
//   .welcome-title          카드 제목 h2
//   .welcome-body           본문 문단
//   .welcome-nav            이전·다음·건너뛰기 줄
//   .welcome-start          마지막 장 시작 방법 버튼 줄
//   .welcome-guide          "안내서 보기" 링크
import '../styles/welcome.css';

import { ONBOARDING_CARDS } from '../content/onboarding.js';
import { createSampleProject } from '../db/sample.js';
import { updateSettings } from '../db/settings.js';
import { h, toast } from '../lib/dom.js';
import { formatHash, navigate } from '../router.js';
import { lockWhileRestoring, restoreFileButton, runExclusive } from './parts/restore-file.js';

const SAMPLE_FAILED_TEXT = '예시 작품을 만들지 못했습니다';

/** onboardingDone을 저장한다. 실패해도 이어 간다(다음 시작에 안내가 다시 뜰 뿐) */
async function markDone() {
  try {
    await updateSettings({ onboardingDone: true });
  } catch (err) {
    console.error(err);
  }
}

export async function render(el) {
  let index = 0;
  let alive = true;
  const total = ONBOARDING_CARDS.length;

  // "건너뛰기"·"빈 서재로 시작" (7.6, 7.8)
  async function goLibrary() {
    await markDone();
    if (alive) navigate({ name: 'library' });
  }

  // "예시 작품으로 시작" (8.1, 8.6). runExclusive 안에서 돌아 복원과 겹치지 않고,
  // lockWhileRestoring으로 등록한 버튼(시작 방법 셋·건너뛰기)이 그동안 비활성화된다
  function startWithSample() {
    return runExclusive(async () => {
      let project;
      try {
        project = await createSampleProject();
      } catch (err) {
        console.error(err);
        toast(SAMPLE_FAILED_TEXT);
        return;
      }
      await markDone();
      if (alive) navigate({ name: 'main', projectId: project.id });
    });
  }

  function lockable(button) {
    lockWhileRestoring(button);
    return button;
  }

  function draw() {
    const card = ONBOARDING_CARDS[index];
    const isFirst = index === 0;
    const isLast = index === total - 1;

    const prev = h(
      'button',
      {
        type: 'button',
        class: 'btn',
        onclick: () => {
          if (index > 0) {
            index -= 1;
            draw();
          }
        },
      },
      '이전',
    );
    prev.disabled = isFirst;

    const next = isLast
      ? null
      : h(
          'button',
          {
            type: 'button',
            class: ['btn', 'btn-primary'],
            onclick: () => {
              if (index < total - 1) {
                index += 1;
                draw();
              }
            },
          },
          '다음',
        );

    const skip = lockable(
      h('button', { type: 'button', class: ['btn', 'welcome-skip'], onclick: goLibrary }, '건너뛰기'),
    );

    let start = null;
    let guide = null;
    if (isLast) {
      const sample = lockable(
        h(
          'button',
          { type: 'button', class: ['btn', 'btn-primary'], onclick: startWithSample },
          '예시 작품으로 시작',
        ),
      );
      const empty = lockable(
        h('button', { type: 'button', class: 'btn', onclick: goLibrary }, '빈 서재로 시작'),
      );
      // onRestored 없음 → 복원 뒤 서재로. onboardingDone은 finishRestore가 저장한다 (7.9)
      const restore = restoreFileButton();
      start = h('div', { class: 'welcome-start' }, sample, empty, restore.el);
      guide = h('a', { class: 'welcome-guide', href: formatHash({ name: 'guide' }) }, '안내서 보기');
    }

    const content = h(
      'section',
      { class: 'welcome-card', 'aria-labelledby': 'welcome-title' },
      h('p', { class: 'welcome-step' }, `${index + 1} / ${total}`),
      h('h2', { class: 'welcome-title', id: 'welcome-title' }, card.title),
      ...card.body.map((text) => h('p', { class: 'welcome-body' }, text)),
      start,
      guide,
      h('div', { class: 'welcome-nav' }, prev, next, skip),
    );
    el.replaceChildren(h('div', { class: 'welcome' }, content));
  }

  draw();
  return () => {
    alive = false;
  };
}
