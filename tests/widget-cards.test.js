// 캐릭터 카드·에피소드 카드의 순수 함수 (요구 1.5, 1.6, 13.1, 13.2, 13.6)
import { describe, it, expect } from 'vitest';
import { resolveCharacter, firstQuote, characterName, NO_NAME } from '../src/screens/widgets/character-card.js';
import { resolveEpisodeCard, reserveText, defaults } from '../src/screens/widgets/episode-card.js';

const ep = (id, number, status, publishDate) => ({ id, number, status, publishDate, title: '' });

describe('character card', () => {
  const chars = new Map([
    ['c1', { id: 'c1', projectId: 'p1', name: '  ', quotes: ['', ' 첫 대사 ', '둘째'] }],
    ['c2', { id: 'c2', projectId: 'p2', name: '남', quotes: [] }],
  ]);

  it('Current_Project의 Character만 찾고, 없으면 null', () => {
    expect(resolveCharacter({ characterId: 'c1' }, chars, 'p1')?.id).toBe('c1');
    expect(resolveCharacter({ characterId: 'c2' }, chars, 'p1')).toBeNull();
    expect(resolveCharacter({ characterId: 'gone' }, chars, 'p1')).toBeNull();
    expect(resolveCharacter({}, chars, 'p1')).toBeNull();
  });

  it('빈 이름은 "이름 없음", 첫 대표 대사는 빈 값을 건너뛴다', () => {
    expect(characterName(chars.get('c1'))).toBe(NO_NAME);
    expect(firstQuote(chars.get('c1'))).toBe('첫 대사');
    expect(firstQuote(chars.get('c2'))).toBe('');
  });
});

describe('episode card', () => {
  const today = '2026-10-30';
  const list = [
    ep('e1', 1, 'published', '2026-10-01'),
    ep('e2', 2, 'scheduled', '2026-11-05'),
    ep('e3', 3, 'draft', '2026-11-01'),
    ep('e4', 4, 'idea', null),
  ];

  it('기본 data는 next 모드', () => {
    expect(defaults().data).toEqual({ mode: 'next' });
  });

  it('next 모드(또는 mode 없음)는 Next_Episode를 고른다', () => {
    expect(resolveEpisodeCard({ mode: 'next' }, list, today)).toEqual({ mode: 'next', episode: list[2] });
    expect(resolveEpisodeCard({}, list, today).episode?.id).toBe('e3');
    expect(resolveEpisodeCard({ mode: 'next' }, [list[0]], today)).toEqual({ mode: 'next', episode: null });
  });

  it('fixed 모드는 episodeId의 회차, 없으면 null(삭제된 항목)', () => {
    expect(resolveEpisodeCard({ mode: 'fixed', episodeId: 'e1' }, list, today).episode?.id).toBe('e1');
    expect(resolveEpisodeCard({ mode: 'fixed', episodeId: 'gone' }, list, today)).toEqual({
      mode: 'fixed',
      episode: null,
    });
  });

  it('비축분 N편', () => {
    expect(reserveText(list)).toBe('비축분 2편');
    expect(reserveText([])).toBe('비축분 0편');
  });
});
