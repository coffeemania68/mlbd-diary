// 캐릭터 등장 회차 계산 (요구사항 11.4)
// projectId가 같고 characterIds에 characterId가 있는 Episode만, number 오름차순.
export function computeAppearances(episodes, projectId, characterId) {
  return episodes
    .filter(
      (e) =>
        e.projectId === projectId &&
        Array.isArray(e.characterIds) &&
        e.characterIds.includes(characterId),
    )
    .map((e) => ({ id: e.id, number: e.number, title: e.title }))
    .sort((a, b) => a.number - b.number);
}
