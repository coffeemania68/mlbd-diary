// 안내서·FAQ 문구 데이터 예시 테스트 (요구사항 9.1, 9.2, 9.4, 9.8). 화면 표시는 최종 점검에서 본다.
import { describe, expect, it } from 'vitest';
import { FAQ_ITEMS, GUIDE_SECTIONS } from '../src/content/guide.js';

const isText = (v) => typeof v === 'string' && v.trim() !== '';

describe('GUIDE_SECTIONS', () => {
  it('첫 구역은 백업 안내다', () => {
    expect(GUIDE_SECTIONS[0].id).toBe('backup');
    expect(GUIDE_SECTIONS[0].title).toContain('백업');
  });

  it('설계의 구역 7개가 순서대로 있고 id가 서로 다르다', () => {
    const ids = GUIDE_SECTIONS.map((s) => s.id);
    expect(ids).toEqual(['backup', 'library', 'book', 'pages', 'ink', 'theme', 'install']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('모든 문구가 빈 문자열이 아닌 문자열이다', () => {
    for (const s of GUIDE_SECTIONS) {
      expect(isText(s.title)).toBe(true);
      expect(s.paragraphs.length).toBeGreaterThan(0);
      for (const p of s.paragraphs) expect(isText(p)).toBe(true);
      for (const step of s.steps ?? []) expect(isText(step)).toBe(true);
    }
  });
});

describe('FAQ_ITEMS', () => {
  const find = (word) => FAQ_ITEMS.find((item) => item.q.includes(word));

  it('필수 질문이 있다', () => {
    for (const word of ['사라졌', '다른 기기', '새 버전', '아이폰', '동기화', '문의']) {
      expect(find(word), word).toBeDefined();
    }
  });

  it('문의 답에 개별 답변 안내가 있다', () => {
    expect(find('문의').a).toContain('개별 답변');
    expect(find('문의').a).toContain('공지');
  });

  it('모든 질문과 답이 빈 문자열이 아닌 문자열이다', () => {
    expect(FAQ_ITEMS.length).toBe(8);
    for (const item of FAQ_ITEMS) {
      expect(isText(item.q)).toBe(true);
      expect(isText(item.a)).toBe(true);
    }
  });
});
