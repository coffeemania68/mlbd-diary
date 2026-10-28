// 저장소 영구 보존 요청과 상태 확인 (요구사항 5.1, 5.2, 5.3)
// navigator가 없는 환경(node 테스트)에서도 오류 없이 'unsupported'를 돌려준다.

function getStorageManager() {
  return globalThis.navigator?.storage;
}

/**
 * 저장소 영구 보존을 요청한다.
 * @returns {Promise<'granted' | 'denied' | 'unsupported'>}
 */
export async function requestPersistence() {
  const storage = getStorageManager();
  if (typeof storage?.persist !== 'function') return 'unsupported'; // 요구사항 5.2
  try {
    return (await storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/**
 * 현재 영구 보존 허용 여부를 확인한다. 설정 화면 표시용 (요구사항 5.3).
 * @returns {Promise<'granted' | 'denied' | 'unsupported'>}
 */
export async function getPersistenceStatus() {
  const storage = getStorageManager();
  if (typeof storage?.persisted !== 'function') return 'unsupported';
  try {
    return (await storage.persisted()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}
