// 문의(버그 제보) 주소 정리. DOM을 쓰지 않는다.

/** https: 주소로 해석되면 정리된 href, 아니면 null (10.3, 10.4) */
export function bugReportHref(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
