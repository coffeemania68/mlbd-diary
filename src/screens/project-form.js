// 새 작품 폼과 작품 정보 편집 화면 (요구사항 8.3~8.5, 8.7, 8.8, 15.7).
// - 새 작품: 레코드가 아직 없으므로 "만들기" 버튼으로 만든다 → 그 작품의 메인으로.
// - 작품 편집: 저장 버튼 없이 Autosave. 머리의 .save-indicator가 상태를 보여 준다.
//   제목을 비우면 DB에는 "제목 없는 작품"으로 저장되지만 입력란은 비운 채 둔다.
//
// 만드는 클래스 이름 (스타일은 styles/library.css):
//   .project-form / .project-form-head / .project-form-fields
//   .form-field / .form-label
//   .cover-swatches / .cover-swatch / .cover-swatch-dot
//   .project-form-actions
import '../styles/library.css';

import { COVER_COLORS, UNTITLED_PROJECT } from '../config.js';
import { createProject, getProject, updateProject } from '../db/projects.js';
import { createAutosave, showStatus } from '../lib/autosave.js';
import { h, toast } from '../lib/dom.js';
import { navigate } from '../router.js';
import { getShell } from '../ui.js';

const FIELDS = [
  { key: 'title', label: '제목', placeholder: UNTITLED_PROJECT },
  { key: 'genre', label: '장르', placeholder: '예: 로맨스 판타지' },
  { key: 'platform', label: '연재처', placeholder: '예: 카카오페이지' },
  { key: 'logline', label: '로그라인', placeholder: '한두 문장으로 작품 소개', multiline: true },
];

/** 입력란 4개 + 표지 색 라디오 7개를 만든다. onChange(patch)는 값이 바뀔 때마다 불린다 */
function buildFields(values, onChange) {
  const inputs = {};
  const fields = FIELDS.map((f) => {
    const id = `project-${f.key}`;
    const attrs = {
      id,
      name: f.key,
      placeholder: f.placeholder,
      autocomplete: 'off',
      value: values[f.key] ?? '',
      oninput: (event) => onChange?.({ [f.key]: event.target.value }),
    };
    const input = f.multiline ? h('textarea', { ...attrs, rows: 3 }) : h('input', { ...attrs, type: 'text' });
    // textarea는 value 속성이 내용이 아니므로 프로퍼티로 다시 넣는다
    input.value = values[f.key] ?? '';
    inputs[f.key] = input;
    return h('div', { class: 'form-field' }, h('label', { class: 'form-label', for: id }, f.label), input);
  });

  const selected = COVER_COLORS.some((c) => c.value === values.coverColor)
    ? values.coverColor
    : COVER_COLORS[0].value;
  const swatches = h(
    'fieldset',
    { class: ['form-field', 'cover-swatches'] },
    h('legend', { class: 'form-label' }, '표지 색'),
    COVER_COLORS.map((c) =>
      h(
        'label',
        { class: 'cover-swatch', title: c.label },
        h('input', {
          type: 'radio',
          name: 'coverColor',
          value: c.value,
          checked: c.value === selected,
          onchange: (event) => {
            if (event.target.checked) onChange?.({ coverColor: c.value });
          },
        }),
        h('span', { class: 'cover-swatch-dot', style: { '--swatch': c.value }, 'aria-hidden': 'true' }),
        h('span', { class: 'visually-hidden' }, c.label),
      ),
    ),
  );

  function read() {
    const out = {};
    for (const f of FIELDS) out[f.key] = inputs[f.key].value;
    out.coverColor = swatches.querySelector('input[name="coverColor"]:checked')?.value ?? selected;
    return out;
  }

  return { fields: [...fields, swatches], inputs, read };
}

/** 새 작품 폼 */
function renderNew(el) {
  const { fields, inputs, read } = buildFields({ coverColor: COVER_COLORS[0].value });
  const submitBtn = h('button', { type: 'submit', class: ['btn', 'btn-primary'] }, '만들기');
  let busy = false;

  const form = h(
    'form',
    {
      class: 'project-form',
      onsubmit: async (event) => {
        event.preventDefault();
        if (busy) return;
        busy = true;
        submitBtn.disabled = true;
        try {
          const project = await createProject(read());
          navigate({ name: 'main', projectId: project.id });
        } catch (err) {
          console.error(err);
          toast('작품을 만들지 못했습니다');
          busy = false;
          submitBtn.disabled = false;
        }
      },
    },
    h('div', { class: 'project-form-head' }, h('h1', { class: 'screen-title' }, '새 작품')),
    h('div', { class: 'project-form-fields' }, fields),
    h(
      'div',
      { class: 'project-form-actions' },
      h('a', { class: 'btn', href: '#/library' }, '취소'),
      submitBtn,
    ),
  );
  el.replaceChildren(form);
  inputs.title.focus();
}

/** 작품 정보 편집 (자동 저장) */
async function renderEdit(el, route) {
  const id = route.projectId;
  const project = await getProject(id);
  if (!project) {
    navigate({ name: 'library' }, { replace: true });
    return undefined;
  }

  const indicator = h('span', { class: 'save-indicator', 'aria-live': 'polite' });
  const autosave = createAutosave({
    save: async (patch) => {
      const updated = await updateProject(id, patch);
      if ('title' in patch) getShell()?.setProjectTitle(updated.title);
    },
    onStatus: (status) => showStatus(indicator, status),
  });

  // 저장된 제목이 기본값이면 입력란은 비워 두고 안내 문구로 보여 준다
  const values = { ...project, title: project.title === UNTITLED_PROJECT ? '' : project.title };
  const { fields } = buildFields(values, (patch) => autosave.schedule(patch));

  el.replaceChildren(
    h(
      'form',
      { class: 'project-form', onsubmit: (event) => event.preventDefault() },
      h(
        'div',
        { class: 'project-form-head' },
        h('h1', { class: 'screen-title' }, '작품 정보'),
        indicator,
      ),
      h('div', { class: 'project-form-fields' }, fields),
    ),
  );

  // 라우터가 화면 교체 전에 flushAll()을 부르므로 여기서는 정리만 한다
  return () => autosave.dispose();
}

export const newProjectScreen = { render: renderNew };
export const editProjectScreen = { render: renderEdit };
