// 레코드 id·시각 규칙. 모든 쓰기는 이 두 함수를 거친다.
// Dexie 훅 대신 명시적 함수를 써서 시각이 찍히는 곳을 코드에서 바로 알 수 있게 한다.

/** 새 레코드: UUID id, createdAt = updatedAt = now */
export function newRecord(fields, now = Date.now(), id = crypto.randomUUID()) {
  return { ...fields, id, createdAt: now, updatedAt: now };
}

/** 수정 패치: id·createdAt은 바꾸지 않고 updatedAt만 갱신한다 */
export function touch(changes, now = Date.now()) {
  // eslint-disable-next-line no-unused-vars
  const { id, createdAt, ...rest } = changes;
  return { ...rest, updatedAt: now };
}

/*
 * 테이블별 새 레코드 기본값. 기획안 5.2절과 mlbd-book-sections 설계 Data Models 기준.
 * id·createdAt·updatedAt은 newRecord가 붙인다.
 *
 * PlotStructure (plotStructures)  — 작품당 1개, getOrCreatePlotStructure가 만든다
 *   { projectId, type: 'kishotenketsu', sections: ['기', '승', '전', '결'] }
 *   // type: 'kishotenketsu' | 'three-act' | 'custom'
 *
 * PlotCard (plotCards)  — 구간마다 order 0..n-1
 *   { projectId, sectionIndex, order, title: '', summary: '', episodeIds: [] }
 *
 * TimelineEvent (timelineEvents)
 *   { projectId, storyDateLabel: '', sortKey: nextSortKey(...), title: '', description: '',
 *     characterIds: [], episodeId: null }
 *
 * Mandalart (mandalarts)
 *   { projectId, title: '', cells: emptyCells(), note: '' }
 *   // cells: 81칸 { text, color }, color는 팔레트 value 또는 null
 *
 * Episode (episodes)
 *   { projectId, number: nextEpisodeNumber(...), title: '', keywords: [], characterIds: [], places: [],
 *     keyPoints: '', quotes: [], status: 'idea', targetChars: 0, actualChars: 0, publishDate: null,
 *     memo: '', links: [] }
 *   // status: 'idea' | 'draft' | 'revised' | 'scheduled' | 'published'
 *   // links: Reference_Link[] = [{ category: string, name: string, url: string }]
 *   //   url은 normalizeUrl 결과(href). schemaVersion 2에서 추가(migrations.js 규칙 2)
 *
 * StorageItem (storageItems)
 *   { projectId, kind, title: '', body: '', assetId: null, url: '', tags: [] }
 *   // kind: 'image' | 'note' | 'link'
 *
 * Page (pages)
 *   { projectId, kind, month: null, title: '', templateId: null, background: null, order: nextOrder(...) }
 *   // kind: 'main' | 'monthly' | 'free' 세 가지만 저장한다
 *   // month: monthly만 'YYYY-MM', main·free는 null. [projectId+kind+month] 고유 색인(Dexie version(2))
 *   // main: 작품당 1장(ensureMainPage), monthly: 작품·달마다 1장(ensureMonthlyPage),
 *   // free: 여러 장, title·order를 쓴다(빈 title은 화면에서 UNTITLED_PAGE)
 *   // templateId: PAGE_TEMPLATES id 'main' | 'monthly' | 'blank', 또는 null(이전 블록에서 만든 Page).
 *   //   만들 때 쓴 배치만 기록한다. 이미 있는 Page의 위젯 배치는 이 값으로 바꾸지 않는다
 *   // background: { pattern: PAGE_PATTERNS id, color: PAGE_BG_COLORS value('#rrggbb') | null } 또는 null.
 *   //   color null = 테마 종이색. 읽을 때 normalizeBackground(lib/page-style.js). Page_History에 넣지 않는다
 *   // 스키마 변경 없음(SCHEMA_VERSION 3 그대로): 두 필드는 처음부터 기본값에 있던 자리를 쓴다
 *
 * Widget (widgets)
 *   { pageId, type, x: 0, y: 0, w: 0, h: 0, z: 0, rotation: 0, style: {}, data: {} }
 *   // x, y, w, h: Page_Coordinates(1000 × 1414), z: 쌓는 순서(같으면 id 순)
 *   // type별 style·data:
 *   //   text          style { bg: MEMO_COLORS value }, data { title: '', body: '' }
 *   //   checklist     data { items: [{ id, text, done }] }
 *   //   image         data { assetId }            // Asset_GC가 참조로 센다
 *   //   calendar      data { month: 'YYYY-MM', memos: { 'DD': string } }  // Monthly_Page면 page.month를 쓴다
 *   //   characterCard data { characterId }
 *   //   episodeCard   data { mode: 'next' } 또는 { mode: 'fixed', episodeId }
 *   //   sticker       style {}, data { stickerId }  // lib/sticker-pack.js의 id. Asset이 아니라 Asset_GC가 세지 않는다
 *   // rotation: sticker만 바꾼다. 0 이상 360 미만, ROTATION_STEP(15)의 배수(0~345).
 *   //   읽을 때 normalizeRotation(lib/geometry.js). 다른 type은 0, 이전 블록 위젯은 필드가 없을 수 있다(→ 0)
 *
 * InkStroke (inkStrokes)  — Free_Page에만
 *   { pageId, tool: 'pen', color, size, points: [] }
 *   // tool: 'pen' | 'highlighter', color: INK_PALETTE value, size: INK_SIZES 값
 *   // points: [[x, y, 필압], ...] Page_Coordinates, 필압 0~1(펜이 아니면 INK_DEFAULT_PRESSURE)
 *
 * Asset (assets)
 *   { blob, mime, width, height, kind: 'image' }
 *   // kind: 'image' | 'sticker'
 *   // 동작은 Asset을 직접 지우지 않는다. 참조가 없어지면 Asset_GC(db/asset-gc.js)가 지운다
 *
 * Settings (settings)  — 단일 레코드, ensureSettings가 만든다
 *   { schemaVersion, lastBackupAt: null, defaultThemeId: null, onboardingDone: false,
 *     lastOpenedProjectId: null, snapGrid: false, penDetected: false, penOnly: false }
 *   // snapGrid·penDetected·penOnly: schemaVersion 3에서 추가(migrations.js 규칙 3)
 *   // lastBackupAt·penDetected·penOnly는 기기 설정이라 파일 복원 때 기기 값을 지킨다
 *   // defaultThemeId: THEMES id('paper' | 'bookshop') 또는 null(= DEFAULT_THEME_ID 'paper').
 *   //   사용자 취향이라 파일 복원 때 백업 파일의 값을 따른다
 *   // onboardingDone: 첫 실행 안내를 끝냈거나("예시 작품으로 시작"·"빈 서재로 시작") 건너뛰었거나
 *   //   파일 복원을 마치면 true. false이고 작품이 0개면 시작 화면이 welcome이다
 *
 * Snapshot (snapshots)  — 앱 전체(projectId 없음), 최근 SNAPSHOT_KEEP개
 *   { localDate: 'YYYY-MM-DD', reason: 'daily' | 'pre-restore', appVersion, schemaVersion,
 *     projectCount, fingerprint: string,
 *     data: { tables: { 테이블 이름: Record[] } },  // assets·snapshots를 뺀 13개 테이블, Blob 없음
 *     assetIds: string[] }                          // collectAssetRefs(data.tables), GC가 지킨다
 */
