# MLBD 다이어리 코드 안내

혼자 이 앱을 고치는 사람을 위한 문서다. HTML·CSS·바닐라 JS를 안다고 가정한다.
React·TypeScript는 쓰지 않는다. 모든 코드는 `.js` ES 모듈이다.

## 1. 이 앱은 무엇인가

웹소설 작가용 설정집·다이어리 앱이다. 크롬에서 여는 PWA이고, 설치하면 오프라인에서도 열린다.
데이터는 그 기기의 IndexedDB(Dexie 라이브러리)에만 저장한다. 서버는 없다.

지금 있는 기능:

- 서재: 작품 카드 목록, 새 작품, 작품 정보 수정, 작품 삭제, 제목 줄의 "안내서" 링크. 작품이 없으면 "새 작품"과 "백업 파일로 복원" 버튼
- 첫 실행 안내(`#/welcome`): 카드 3장, 건너뛰기. 마지막 장에서 "예시 작품으로 시작", "빈 서재로 시작", "백업 파일로 복원"
- 예시 작품: 시놉시스, 캐릭터, 회차, 플롯, 타임라인, 메인 페이지, 스티커를 붙인 자유 페이지 "꾸미기 예시"
- 안내서(`#/guide`)와 자주 묻는 질문(`#/guide/faq`). 작품 없이도 열린다. 안내서 첫 구역은 백업 안내
- 설정집 → 캐릭터: 카드 목록, 역할 필터, 상세 입력, 이미지, 대표 대사, 등장 회차(누르면 에피소드 상세로 간다)
- 설정집 → 시놉시스: 로그라인, 짧은 시놉시스, 긴 시놉시스
- 설정집 → 에피소드: 회차 목록(번호순, 상태 필터, 비축분 수), 회차 상세(번호, 제목, 키워드, 등장 캐릭터, 장소, 핵심 내용, 대사, 상태, 목표·실제 글자수, 연재일, 메모, 참고 링크)
- 설정집 → 플롯: 구조(기승전결, 3막, 직접) 고르기, 구간별 카드, 카드 순서 바꾸기(끌기, ↑↓ 버튼, 구간 이동)
- 설정집 → 타임라인: 사건 목록(세로), 순서 바꾸기, 등장 캐릭터·회차 연결
- 설정집 → 만다라트: 목록, 9×9 칸 입력과 칸 색, 휴대폰에서는 블록 단위로 크게 보기
- 설정집 → 보관함: 이미지·메모·링크 자료, 태그와 태그 필터
- 메인: 작품마다 메인 페이지 1장(기본 배치: 에피소드 카드, 체크리스트, 텍스트 메모), 위쪽 백업 알림 띠
- 다이어리 → 월간: 달마다 1장(기본 배치: 달력, 텍스트 메모). 이전·다음 달 버튼. 달력에 발행일(publishDate) 회차 표시, 날짜 칸 메모(길게 누르기)
- 다이어리 → 자유 페이지: 목록, 새 페이지(템플릿 3종 "메인 기본", "월간 기본", "빈 페이지" 중 고르기), 이름 바꾸기, 삭제. 손글씨는 자유 페이지에서만 쓴다
- 페이지 위젯 7종: 텍스트 메모, 체크리스트, 이미지, 월간 달력, 캐릭터 카드, 에피소드 카드, 스티커(앱 안 스티커 30개)
- 페이지 편집 모드: 위젯 추가·이동·크기 조절·삭제, 앞뒤 순서(앞으로, 뒤로, 맨 앞, 맨 뒤), 격자 맞춤, 실행 취소·다시 실행(30단계), 두 손가락 확대(최대 3배), 스티커 회전(15도씩 왼쪽·오른쪽, 실행 취소 가능)
- 페이지 배경: 무늬 4종(무지, 줄, 모눈, 점)과 배경색. 메인·월간·자유 페이지 모두. 실행 취소 기록에는 넣지 않고 바로 저장한다
- 테마 2종: "종이"(기본), "책방"(크림색 바탕, 명조 글꼴). 기기 전체에 하나. 시스템 글꼴만 쓴다
- 손글씨 모드(자유 페이지): 펜·형광펜·선 지우개, 색 6개, 굵기 3단계, 처음 펜을 쓰면 "펜으로만 쓰기"가 켜진다
- 백업: 파일 내보내기(다운로드, 되면 공유), 파일로 복원, 7일 백업 알림
- 앱 안 자동 보관(스냅샷): 하루 한 번, 최근 7개. 설정 화면에서 골라 되돌리기
- 이미지 Asset 정리(Asset_GC): 아무 데서도 안 쓰는 사진만 지운다
- 자동 저장과 저장 상태 표시("저장 중", "저장됨", "저장 실패")
- 설정: 정보(앱 버전, 데이터 버전, 저장소 영구 보존 여부), 테마 고르기, 안내서·FAQ 링크, 문의(버그 제보 링크. 주소가 비어 있으면 안내 문구), 백업 구역(마지막 백업 날짜, 내보내기·공유, 파일 복원, 스냅샷 목록)

범위 밖(만들지 않음. 10/31 이후는 기능 동결이다, 15장):

- 내 이미지를 스티커로 등록, 스티커 팩 내려받기
- 테마 3종째, 작품별 테마(`Project.themeId`는 쓰지 않는다)
- 메인·월간 페이지 손글씨
- 계정·동기화
- 손글씨 올가미 선택, 위젯 묶기·정렬 도구
- 연재 D-day 위젯, 작품 하나만 내보내기
- 포모도로·타이머·작업 시간 기록. 이 앱에는 넣지 않는다
- 일간(매일) 계획 페이지. 페이지 종류(`Page.kind`)는 `main`, `monthly`, `free` 세 가지뿐이다
- 원고 편집기(본문을 쓰는 화면)
- 캐릭터 관계도
- 타임라인 가로 보기
- 작품 안 검색

### 축소안 (마지막 블록, 10/31)

일정이 늦으면 위에서부터 차례로 빼기로 했던 목록이다.

1. 예시 작품을 최소로(작품 1개, 시놉시스, 캐릭터 3명, 회차 5개만. 플롯·타임라인·메인 페이지 내용·예시 자유 페이지 빼기)
2. 페이지 배경 무늬(줄·모눈·점) 빼기. 배경색은 남긴다
3. 테마를 1종으로 줄이고 설정의 테마 선택 숨기기
4. 스티커 회전 버튼 빼기(저장된 rotation을 그리는 것은 남긴다)
5. 새 자유 페이지의 템플릿 선택 빼기(빈 페이지만)

실제로 적용한 항목: 없음. 1~5 모두 만들었다.

### 축소안 (페이지·백업 블록)

그 앞 블록에서 일정이 늦으면 위에서부터 차례로 빼기로 했던 목록이다.

1. 캐릭터 카드·에피소드 카드 위젯 → 2027년 업데이트(메인 기본 배치의 에피소드 카드는 텍스트 메모로)
2. 실행 취소·다시 실행을 1단계로
3. 내보내기의 공유 버튼 빼기(다운로드만)
4. 손글씨 형광펜과 굵기 3단계 빼기
5. 격자 맞춤 빼기
6. 앞뒤 순서를 "맨 앞으로" 하나로
7. 월간 달력 날짜 칸 메모 빼기
8. 스냅샷을 "복원 직전 1개"만(매일 스냅샷과 스냅샷 복원 화면 제거)

실제로 적용한 항목: 없음. 1~8 모두 만들었다. 실행 취소는 30단계(`HISTORY_LIMIT`) 그대로다.

### 알려진 한계

- 고침: 실행 취소·다시 실행이 위젯을 화면에서 뺄 때 그 순간의 레코드를 기록에 다시 담는다(`captureLatest`)

## 2. 명령

모두 `mlbd-diary` 폴더(저장소 루트)에서 실행한다.

| 명령 | 하는 일 |
|---|---|
| `npm install` | 의존 패키지 설치. 처음 한 번, 그리고 `package.json`을 바꾼 뒤 |
| `npm run dev` | 개발 서버 실행. 터미널에 나온 주소를 크롬으로 연다 |
| `npm test` | 테스트 한 번 실행(`vitest run`). 감시 모드는 쓰지 않는다 |
| `npm run build` | `dist/` 폴더에 배포용 파일을 만든다 |
| `npm run preview` | `dist/`를 로컬에서 띄워 본다. 오프라인·설치 확인은 여기서 한다 |
| `npm run icons` | `public/icons/icon-192.png`, `icon-512.png`를 다시 만든다. 아이콘을 바꿀 때만 |

개발 서버(`npm run dev`)에서는 서비스 워커가 동작하지 않는다. 오프라인 동작은 `npm run build` 후 `npm run preview`로 확인한다.

## 3. 배포 (GitHub Pages)

이 문서는 구성 B를 기준으로 한다. `mlbd-diary` 폴더의 내용이 저장소 맨 위에 온다.
`package.json`, `.github/`, `src/`가 저장소 루트에 바로 보여야 한다.

### 처음 한 번

1. GitHub에서 새 저장소를 만든다. 이름은 예를 들어 `mlbd-diary`. README 등은 추가하지 않는다.
2. `mlbd-diary` 폴더에서 아래 명령을 실행한다. `<id>`는 GitHub 아이디로 바꾼다.

   ```powershell
   git init
   git add .
   git commit -m "첫 커밋"
   git branch -M main
   git remote add origin https://github.com/<id>/mlbd-diary.git
   git push -u origin main
   ```

   `package-lock.json`은 반드시 커밋한다. CI의 `npm ci`가 이 파일을 쓴다.
   `node_modules`와 `dist`는 `.gitignore`에 있어서 올라가지 않는다.
   비밀번호나 토큰은 명령에 넣지 않는다. 로그인은 git이 띄우는 창에서 한다.

3. 저장소 Settings → Pages → Build and deployment → Source를 **"GitHub Actions"** 로 바꾼다. 한 번만 하면 된다.
4. Actions 탭에서 "Deploy mlbd-diary" 실행을 확인한다. 이 설정 전에 실패한 실행이 있으면 "Re-run jobs"를 누른다.

### 그다음부터

- `main` 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 자동으로 돈다.
- 순서: `npm ci` → `npm test` → `npm run build` → 배포.
- 테스트나 빌드가 실패하면 배포 단계는 실행되지 않는다. 이전 버전이 그대로 남는다. Actions 탭에서 빨간 실행을 눌러 로그를 본다.
- 주소: `https://<id>.github.io/mlbd-diary/`
- `vite.config.js`의 `base: './'` 덕분에 저장소 이름이 바뀌어도 경로를 고칠 필요가 없다.

### 구성 A 메모

`d:\2027Pnlanner` 전체를 저장소 하나로 쓰고 싶으면(구성 A), `deploy.yml`을 저장소 루트의 `.github/workflows/`로 옮긴다.
그리고 파일 안에 `# 구성 A:` 주석이 붙은 세 줄만 바꾼다(`working-directory`, `cache-dependency-path`, 업로드 `path`).

## 4. 폴더·파일별 역할

| 경로 | 역할 |
|---|---|
| `index.html` | 앱 진입 HTML. `<div id="app">` 하나와 `src/main.js` |
| `package.json` | 스크립트(dev, build, preview, test, icons)와 의존 패키지. `version`이 설정 화면의 앱 버전이 된다 |
| `package-lock.json` | 설치 버전 고정. CI가 쓴다 |
| `vite.config.js` | `base './'`, PWA(매니페스트·서비스 워커) 설정, vitest 설정(`test` 키), 앱 버전 주입 |
| `.gitignore` | `node_modules`, `dist` 제외 |
| `.github/workflows/deploy.yml` | GitHub Pages 배포 워크플로 |
| `scripts/make-icons.js` | Node 내장 모듈로 아이콘 PNG를 만든다(`npm run icons`) |
| `public/icons/icon-192.png`, `icon-512.png` | 앱 아이콘 |
| **src/** | |
| `src/main.js` | 시작 순서(영구 보존 요청 → DB 열기 → 설정 읽어 테마 적용 → 셸 → 시작 화면(첫 실행 안내 포함) → 라우터 → 스냅샷 확인·Asset 정리). `SCREENS` 표. DB 오류 안내 문구. 화면이 다시 보이면(visible) 스냅샷 확인 |
| `src/theme.js` | `applyTheme(id)`. 테마 변수 14개를 `<html>` style에 쓰고 `data-theme`을 바꾼다. 시작할 때, 설정에서 고를 때, 복원 뒤에 부른다 |
| `src/config.js` | 자주 고칠 상수 모음(5장 참고) |
| `src/app-state.js` | 현재 열린 작품 id. 바뀌면 `lastOpenedProjectId` 저장, 리스너에 알림 |
| `src/router.js` | 해시 주소 ↔ 경로 객체(`parseHash`, `formatHash`), 시작 화면 결정, 화면 교체(`startRouter`). 설정집 경로 표 `BOOK_ROUTES`. 다이어리 경로(`monthly`, `freePages`, `freePage`). 작품 없이 여는 경로(`welcome`, `guide`, `faq`). 파일 맨 위에 경로 표 주석이 있다 |
| `src/shell.js` | 상단 바(작품 전환 버튼, 위치 문구), Nav(레일/하단 탭), `<main id="screen">`. 위치 문구 함수 `locationLabel`(시작하기, 안내서 포함) |
| `src/ui.js` | 셸 인스턴스 보관. 화면이 위치 문구에 값(캐릭터 이름, 기록 제목)을 붙일 때 `setLocationExtras` |
| `src/storage.js` | 저장소 영구 보존 요청·상태 확인 |
| **src/content/** | 화면에 보이는 긴 문구. DOM 없음. 문구는 `h()` 텍스트로만 넣는다 |
| `src/content/guide.js` | 안내서 구역 `GUIDE_SECTIONS`(첫 구역은 백업 안내)과 자주 묻는 질문 `FAQ_ITEMS` |
| `src/content/onboarding.js` | 첫 실행 안내 카드 3장 `ONBOARDING_CARDS` |
| **src/db/** | |
| `src/db/db.js` | Dexie 테이블 15개 정의(`createDb`, `version(1)`과 snapshots를 더한 `version(2)`), `openDatabase()`, `DatabaseError` |
| `src/db/migrations.js` | schemaVersion 변환 규칙(`MIGRATIONS`)과 실행. 복원도 쓰는 `runMigrationSteps(tx, steps)` |
| `src/db/records.js` | `newRecord()`, `touch()`. id·`createdAt`·`updatedAt` 규칙. 테이블별 필드와 기본값 주석 |
| `src/db/settings.js` | Settings 단일 레코드 읽기·쓰기 |
| `src/db/projects.js` | 작품 생성·수정·목록·연쇄 삭제 |
| `src/db/characters.js` | 캐릭터 CRUD, 이미지 교체·제거. 삭제 때 에피소드·타임라인의 캐릭터 참조도 지운다 |
| `src/db/synopsis.js` | 시놉시스 읽기(없으면 생성)·저장 |
| `src/db/episodes.js` | 에피소드 CRUD, 삭제 때 플롯 카드·타임라인 참조 정리, 등장 회차 조회 |
| `src/db/plot.js` | 플롯 구조(작품당 1개)와 플롯 카드. 구조 바꾸기·카드 위치 저장은 트랜잭션 하나 |
| `src/db/timeline.js` | 타임라인 사건 CRUD, 순서 저장 |
| `src/db/mandalarts.js` | 만다라트 CRUD |
| `src/db/storage.js` | 보관함 자료 CRUD, 이미지 Asset 저장. Asset 삭제는 Asset 정리가 한다 |
| `src/db/pages.js` | Page: kind 검사, `ensureMainPage`, `ensureMonthlyPage`(기본 배치와 함께 만든다), 템플릿 위젯 만들기 `templateWidgets`, 자유 페이지 목록·만들기(`createFreePageFromTemplate`)·이름 바꾸기, 배경 저장 `setPageBackground`, `deletePage`(위젯·InkStroke 함께) |
| `src/db/sample.js` | `createSampleProject()`. 예시 작품을 트랜잭션 하나에서 저장한다. 실패하면 전부 되돌아간다 |
| `src/db/widgets.js` | 페이지의 위젯·InkStroke 읽기, 바뀐 것 한 번에 저장(`savePageOps`), 이미지 위젯 Asset 저장(`addAsset`) |
| `src/db/backup.js` | Live 데이터 읽기(`readLiveData`), 백업 파일 만들기(`buildExport`), 복원(`restoreData`) |
| `src/db/snapshots.js` | 스냅샷 만들기·하루 한 번 확인·목록·7개 남기기·스냅샷 복원 |
| `src/db/asset-gc.js` | Asset 정리(`runAssetGc`, `requestAssetGc`), 열린 페이지 핀(`setPinnedAssets`) |
| **src/lib/** | |
| `src/lib/dom.js` | `h()`(요소 만들기), `clear()`, `confirmDialog()`, `promptDialog()`, `choiceDialog()`, `pickerDialog()`(그림 격자에서 고르기. 스티커 피커), `toast()` |
| `src/lib/autosave.js` | `createAutosave()`, `flushAll()`, `showStatus()`, 상태 문구, 여러 상태 합치기 `combineStatus()` |
| `src/lib/image.js` | `fitWithin()`, `processImage()`. 이미지 축소·WebP 변환 |
| `src/lib/roles.js` | 역할 필터·역할 입력 상태 계산 |
| `src/lib/order.js` | `sortByOrder()`, `nextOrder()` |
| `src/lib/quotes.js` | `addQuote()`, `removeQuote()`. 대표 대사 배열 편집 |
| `src/lib/appearances.js` | `computeAppearances()`. 등장 회차 계산 |
| `src/lib/filter.js` | `filterView()`. 분류·태그 필터 버튼 줄 계산(공통) |
| `src/lib/tags.js` | `addUnique()`, `removeValue()`, `addId()`, `removeId()`. 칩 목록 편집 |
| `src/lib/links.js` | 참고 링크: 주소 검사 `normalizeUrl()`, `linkHref()`, 호스트 이름, 분류별 묶기 `linkCategoryView()` |
| `src/lib/episodes.js` | 회차 정렬, 비축분 수, 다음 회차 번호, 정수 입력 검사, 번호 중복 확인, 키워드 정리, 상태 이름 |
| `src/lib/plot.js` | 카드를 구간별로 묶기, 카드 이동, 구조 바꿀 때 구간 줄이기, 구간 삭제 |
| `src/lib/timeline.js` | 사건 정렬, 다음 `sortKey`, 이웃과 순서 바꾸기 |
| `src/lib/mandalart.js` | 81칸 만들기, 칸 번호 ↔ 위치 계산, 칸 고치기, 옛 데이터 칸 맞추기 |
| `src/lib/drag.js` | Pointer Events 끌어 놓기(플롯 카드, 타임라인). `lib/`에서 유일하게 DOM을 쓴다 |
| `src/lib/geometry.js` | 위젯 영역 정리(범위·최소 크기·격자, `normalizeRect`), 앞뒤 순서 연산, 새 위젯 위치, 확대 범위, 화면 ↔ 페이지 좌표, 회전(`normalizeRotation`, `rotateStep`, `rotationCommand`) |
| `src/lib/history.js` | 실행 취소·다시 실행 스택(최근 30단계). `undo`·`redo`의 `capture` 인자로 옮기는 명령을 다시 담는다(17장) |
| `src/lib/page-model.js` | 페이지 명령 5종 적용·되돌리기(`applyCommand`, `inverseCommand`), 위젯 레코드 다시 담기(`captureLatest`), 저장할 변경 계산, 기록이 쥔 Asset id |
| `src/lib/sticker-pack.js` | 스티커 30개의 도형 데이터 `STICKER_PACK`(`{ id, label, viewBox, shapes }`). 직접 그린 것. 외부 주소 없음 |
| `src/lib/stickers.js` | 허용 요소·속성(`SHAPE_TAGS`, `SHAPE_ATTRS`), 도형 정리 `sanitizeShape`, `getSticker(id)`, `stickerList()` |
| `src/lib/page-style.js` | 페이지 배경 정리 `normalizeBackground`, 그릴 값 `backgroundView`(색이 null이면 테마 종이색) |
| `src/lib/themes.js` | 테마 변수 이름 14개 `THEME_VAR_KEYS`, id → 테마 `resolveTheme`(모르는 id는 종이) |
| `src/lib/contact.js` | `bugReportHref(raw)`. https 주소일 때만 링크 주소를, 아니면 null |
| `src/lib/sample-data.js` | `buildSampleProject()`. 예시 작품 레코드 묶음을 만드는 순수 함수(DB 없음) |
| `src/lib/calendar.js` | 월 주소 검사, 달 이동, 달력 칸, 발행일별 회차, 날짜 메모 고치기, 다음 회차(`nextEpisode`) |
| `src/lib/ink-geometry.js` | 포인터 → 잉크 점(필압 포함), 선 경계 상자, 선 지우개 판정, perfect-freehand 외곽 → SVG 경로 |
| `src/lib/ink-input.js` | 잉크 입력 라우팅 상태 기계(펜·손가락·마우스, 두 손가락이면 선 취소, 펜으로만 쓰기) |
| `src/lib/backup-format.js` | 백업 파일: 테이블 목록, Base64 변환, 파일 이름, 만들기(`serializeBackup`)·검사(`parseBackup`) |
| `src/lib/backup-rules.js` | 백업 알림 조건, 스냅샷 지문·생성 조건·지울 목록, Asset 참조 모으기, 지울 Asset 고르기, 기기 설정 지키기 |
| **src/screens/** | |
| `src/screens/library.js` | 서재 카드 격자, 카드 메뉴(수정/삭제), 제목 줄 "안내서" 링크, 빈 상태("새 작품", "백업 파일로 복원" → `parts/restore-file.js`) |
| `src/screens/welcome.js` | 첫 실행 안내(`#/welcome`). 카드 3장, 건너뛰기, 마지막 장의 시작 방법 셋. 끝나면 `onboardingDone`을 true로 |
| `src/screens/guide.js` | 안내서(`#/guide`, `render`)와 자주 묻는 질문(`#/guide/faq`, `faqScreen`). 누르면 답이 펼쳐진다 |
| `src/screens/project-form.js` | 새 작품 폼, 작품 정보 편집(자동 저장) |
| `src/screens/main-screen.js` | 메인: 백업 알림 띠(`mountBackupReminder`) + 메인 페이지(손글씨 없음) |
| `src/screens/diary.js` | 다이어리 허브: 월간, 자유 페이지로 가는 두 링크 |
| `src/screens/monthly-page.js` | 월간 페이지: "YYYY년 M월" 머리글, 이전·다음 달, 페이지 화면(손글씨 없음). month가 없거나 잘못되면 이번 달로 주소를 바꾼다 |
| `src/screens/free-page-list.js` | 자유 페이지 목록, 새 페이지(템플릿 고르기 `choiceDialog`), 이름 바꾸기, 삭제(뒤에 Asset 정리) |
| `src/screens/free-page.js` | 자유 페이지 하나. 페이지 화면을 손글씨 켬으로 연다 |
| `src/screens/setting-book.js` | 설정집 7개 구역 목록. 구역 → 경로는 `sectionRoute` |
| `src/screens/character-list.js` | 캐릭터 카드 격자 + 역할 필터 |
| `src/screens/character-detail.js` | 캐릭터 상세 입력. 등장 회차는 에피소드 상세 링크 |
| `src/screens/synopsis.js` | 시놉시스 입력 |
| `src/screens/episode-list.js` | 에피소드 목록, 상태 필터, 비축분 수, 새 회차 |
| `src/screens/episode-detail.js` | 에피소드 상세 입력, 참고 링크 추가·수정·삭제 |
| `src/screens/plot.js` | 플롯 구조 선택, 구간 열, 카드 입력·이동 |
| `src/screens/timeline.js` | 타임라인 사건 목록, 입력, 순서 바꾸기 |
| `src/screens/mandalart-list.js` | 만다라트 목록, 새 만다라트 |
| `src/screens/mandalart.js` | 만다라트 9×9 칸 입력, 칸 색, 휴대폰 블록 보기 |
| `src/screens/storage-list.js` | 보관함 카드 격자, 태그 필터, 새 자료 |
| `src/screens/storage-item.js` | 보관함 자료 편집(이미지·메모·링크) |
| `src/screens/settings.js` | 설정: 정보(앱 버전, 데이터 버전, 영구 보존 여부), 테마 고르기(저장 실패면 되돌림), 안내서 링크, 문의(`BUG_REPORT_URL`, 비면 `CONTACT_PENDING_TEXT`), 백업 구역(파일 복원 버튼, 스냅샷 목록과 복원). 복원 흐름·문구는 `parts/restore-file.js` |
| `src/screens/placeholder.js` | "준비 중" 문구 `PENDING_TEXT`만 있다. 설정집 구역 목록(`setting-book.js`)이 쓴다 |
| **src/screens/page/** | 메인·월간·자유 페이지가 같이 쓰는 페이지 화면. DOM과 Pointer Events는 여기에만 있다 |
| `src/screens/page/page-screen.js` | `mountPageScreen()`. 모드(보기·편집·손글씨), 모델·기록(실행 취소 때 `captureLatest`), 저장, 스티커 회전, 배경 층 `.page-paper`와 배경 바꾸기(`setPageBackground`, 기록 없음), Asset 핀, 이미지 objectURL 관리(`ctx.assetUrl`로 만든 URL은 이 파일이 해제한다. 위젯은 해제하지 않는다) |
| `src/screens/page/stage.js` | 무대: 1000×1414 페이지를 화면 폭에 맞춰 배율 조정, 두 손가락 확대·이동, 보이는 영역 |
| `src/screens/page/edit-controller.js` | 편집 모드의 위젯 선택·이동·크기 조절(끌기) |
| `src/screens/page/toolbar.js` | 도구 막대: 모드 버튼, 위젯 추가, 배경, 실행 취소·다시 실행, 삭제, 앞뒤 순서, 스티커 왼쪽·오른쪽 돌리기, 격자, 손글씨 도구·색·굵기, 펜으로만 쓰기 |
| `src/screens/page/ink-controller.js` | 손글씨 캔버스 2장(그려 둔 선, 지금 긋는 선), 그리기·선 지우개 |
| **src/screens/widgets/** | 위젯 종류별 모듈. 등록표는 `index.js` |
| `src/screens/widgets/index.js` | 위젯 등록표(`WIDGETS`, `WIDGET_ORDER`, `getWidget`). 7종. 파일 맨 위에 위젯 모듈 모양과 `ctx` 설명이 있다 |
| `src/screens/widgets/text.js` | 텍스트 메모(배경색 `MEMO_COLORS`) |
| `src/screens/widgets/checklist.js` | 체크리스트 |
| `src/screens/widgets/image.js` | 이미지(고르기·교체, 사진 수 안내) |
| `src/screens/widgets/calendar.js` | 월간 달력(발행일 회차, 날짜 칸 메모) |
| `src/screens/widgets/character-card.js` | 캐릭터 카드(이름, 이미지, 첫 대표 대사. 누르면 캐릭터 상세) |
| `src/screens/widgets/episode-card.js` | 에피소드 카드(다음 회차 또는 고른 회차, 비축분. 누르면 에피소드 상세) |
| `src/screens/widgets/sticker.js` | 스티커(`data.stickerId`, `rotation`). 피커(`pickerDialog`)로 고르고, `sanitizeShape`을 거친 도형만 `createElementNS`로 그린다. 없는 id는 "없는 스티커" |
| **src/screens/parts/** | 여러 화면이 같이 쓰는 입력 조각 |
| `src/screens/parts/chip-input.js` | `chipInput()`. 문자열 칩 입력(에피소드 키워드, 보관함 태그) |
| `src/screens/parts/character-picker.js` | `characterPicker()`. 캐릭터 칩 고르기(에피소드, 타임라인) |
| `src/screens/parts/record-autosaves.js` | `recordAutosaves()`. 레코드마다 자동 저장 하나씩(플롯 카드, 타임라인 사건) |
| `src/screens/parts/backup-buttons.js` | `backupButtons()`. 내보내기·공유 버튼과 흐름. 백업 알림 띠와 설정 화면이 같이 쓴다 |
| `src/screens/parts/restore-file.js` | 파일 복원 공통: `restoreFileButton()`, `restoreFromFile()`, 복원 뒤 공통 `finishRestore()`, 앱 전체에서 복원을 하나만 돌리는 `runExclusive()`·`lockWhileRestoring()`, 백업 오류 문구 `BACKUP_ERROR_TEXT`. 서재 빈 상태, 첫 실행 안내, 설정이 쓴다 |
| **src/styles/** | |
| `src/styles/base.css` | 색·글꼴 변수(`:root`, 종이 테마 값. 테마를 고르면 `applyTheme`이 덮어쓴다), 44px 터치 규칙, 폼 요소, 저장 상태 표시 |
| `src/styles/shell.css` | 상단 바, 레일(폭 600px 이상), 하단 탭(600px 미만) |
| `src/styles/screens.css` | 화면 공통 제목, 준비 중 화면 등 공통 스타일 |
| `src/styles/dialog.css` | 확인 창과 toast |
| `src/styles/library.css` | 서재 카드 격자와 작품 폼 |
| `src/styles/characters.css` | 캐릭터 목록 |
| `src/styles/character-detail.css` | 캐릭터 상세 |
| `src/styles/synopsis.css` | 시놉시스 |
| `src/styles/parts.css` | 칩, 링크 목록, 필터 버튼 줄, 입력 오류 문구(`.field-error`) |
| `src/styles/episodes.css` | 에피소드 목록·상세 |
| `src/styles/plot.css` | 플롯 구간 열과 카드 |
| `src/styles/timeline.css` | 타임라인 |
| `src/styles/mandalart.css` | 만다라트 목록과 9×9 칸 |
| `src/styles/storage.css` | 보관함 목록·자료 편집 |
| `src/styles/page.css` | 페이지 화면(무대, `.page-paper` 배경 층과 무늬 50px, 도구 막대, 격자선 `.page-paper::after`, 잉크 캔버스), 다이어리 허브, 월간 머리글, 자유 페이지 목록 |
| `src/styles/widgets.css` | 위젯 7종(스티커 포함) |
| `src/styles/backup.css` | 백업 버튼, 알림 띠, 설정의 백업 구역 |
| `src/styles/guide.css` | 안내서·FAQ, 설정의 정보·테마·문의 구역 |
| `src/styles/welcome.css` | 첫 실행 안내 카드 |
| **tests/** | vitest 테스트(`*.test.js`). DB 테스트는 `fake-indexeddb`를 쓴다 |
| `tests/db.test.js` | DB 열기, schemaVersion 변환·되돌림 |
| `tests/projects.test.js` | 작품 생성·수정·연쇄 삭제 |
| `tests/characters.test.js` | 캐릭터 CRUD, 이미지, 삭제 때 참조 정리 |
| `tests/synopsis.test.js` | 시놉시스, 로그라인 동기화 |
| `tests/pages.test.js` | Page kind 제한, 기본 배치, 페이지 유일성, 자유 페이지, `deletePage` 범위, `savePageOps`, 템플릿으로 만들기, 배경 저장 |
| `tests/autosave.test.js` | 자동 저장, `combineStatus` |
| `tests/image.test.js` | 이미지 크기 계산·처리 |
| `tests/roles.test.js` | 역할 필터, 대표 대사, 등장 회차 |
| `tests/library.test.js` | 서재 날짜 표시 |
| `tests/ui.test.js` | 위치 문구(시작하기, 안내서 포함) |
| `tests/router.test.js` | 주소 ↔ 경로, `BOOK_ROUTES`, 안내서·첫 실행 안내 경로, 시작 화면 결정(`onboardingDone`) |
| `tests/filter-tags.test.js` | `filterView`, 칩 목록 편집 |
| `tests/links.test.js` | 주소 검사, 참고 링크 저장·분류 |
| `tests/episodes.test.js` | 에피소드 계산과 DB(번호, 비축분, 삭제 때 참조 정리) |
| `tests/plot.test.js` | 플롯 카드 이동, 구조 바꾸기, 구간 삭제 |
| `tests/timeline.test.js` | 타임라인 정렬, 순서 바꾸기 |
| `tests/mandalart.test.js` | 만다라트 칸 계산과 DB |
| `tests/storage.test.js` | 보관함 자료와 이미지 Asset |
| `tests/drag.test.js` | 끌어 놓기 위치 계산 |
| `tests/geometry.test.js` | 위젯 영역 정리, 앞뒤 순서, 새 위젯 배치, 좌표 변환·확대 범위, 회전 명령 |
| `tests/history.test.js` | 실행 취소 스택, 명령 왕복, `captureLatest`(내용 편집 뒤 실행 취소·다시 실행, 이미지 핀) |
| `tests/calendar.test.js` | 달 이동, 달력 칸, 발행일, 날짜 메모, 다음 회차 |
| `tests/ink.test.js` | 필압, 선 지우개 판정, 경로 만들기, 잉크 입력 라우팅 |
| `tests/backup-format.test.js` | Base64, 파일 이름, 백업 파일 만들기·검사 |
| `tests/backup-rules.test.js` | 백업 알림, 스냅샷 조건·지울 목록, Asset 참조, 기기 설정 지키기 |
| `tests/asset-gc.test.js` | Asset 정리(Live·스냅샷·핀 보호) |
| `tests/backup.test.js` | 내보내기 → 복원 왕복, 복원 실패 되돌림, 스냅샷 만들기·복원, 작품 0개에서 파일 복원 |
| `tests/widget-calendar.test.js` | 달력 위젯이 쓸 달 고르기 |
| `tests/widget-cards.test.js` | 캐릭터 카드·에피소드 카드 표시 값 |
| `tests/stickers.test.js` | 스티커 팩 검사(모든 스티커가 `sanitizeShape`을 거쳐도 그대로), `sanitizeShape`, `getSticker` |
| `tests/page-style.test.js` | 페이지 배경 정리 `normalizeBackground`, `backgroundView` |
| `tests/themes.test.js` | 테마 정의(변수 14개)와 `resolveTheme`, `bugReportHref` |
| `tests/sample.test.js` | 예시 작품 만들기(`buildSampleProject`, `createSampleProject`) |
| `tests/content.test.js` | 안내서 구역(첫 구역 백업)과 FAQ 문구 |

`main.js`가 `base.css`, `shell.css`, `screens.css`, `dialog.css`를 불러온다.
화면 전용 CSS는 그 화면 파일 맨 위에서 `import`한다(예: `synopsis.js` → `synopsis.css`, `welcome.js` → `welcome.css`). `guide.css`는 `guide.js`와 `settings.js`가 불러온다.
`parts.css`는 `screens/parts/*.js` 파일들이 불러온다(`backup-buttons.js`만 `backup.css`).
`page.css`는 `page/stage.js`와 다이어리 화면들이, `widgets.css`는 `widgets/index.js`가 불러온다.

## 5. 자주 고칠 곳

| 고칠 것 | 위치 |
|---|---|
| 테이블·색인 정의 | `src/db/db.js`의 `database.version(n).stores({...})` |
| 테이블별 필드와 기본값 | `src/db/records.js` 주석, 각 `src/db/*.js` |
| 데이터 변환 규칙 | `src/db/migrations.js`의 `MIGRATIONS` |
| 역할 프리셋(주인공, 조연, 악역, 기타) | `src/config.js`의 `ROLE_PRESETS` |
| 표지 색 목록 | `src/config.js`의 `COVER_COLORS`. DB에는 `value`(색 코드)가 저장되므로 이미 쓴 `value`는 바꾸지 않는다 |
| Nav 항목(메인, 다이어리, 설정집, 설정) | `src/config.js`의 `NAV_ITEMS` |
| 설정집 구역과 준비 여부 | `src/config.js`의 `BOOK_SECTIONS`(`ready`) |
| 설정집 경로(구역 → 목록·상세 경로) | `src/router.js`의 `BOOK_ROUTES` |
| 에피소드 상태 이름(아이디어, 초고, 퇴고, 예약, 발행)과 비축분 포함 여부 | `src/config.js`의 `EPISODE_STATUSES`. DB에는 `id`가 저장되므로 `id`는 바꾸지 않는다. `label`, `reserve`는 바꿔도 된다 |
| 참고 링크 분류 프리셋(장소, 음식, 의상, 기타) | `src/config.js`의 `LINK_CATEGORY_PRESETS` |
| 만다라트 칸 색 | `src/config.js`의 `MANDALART_PALETTE`. DB에는 `value`가 저장되므로 이미 쓴 `value`는 바꾸지 않는다 |
| 플롯 구조별 기본 구간 이름(기승전결, 3막) | `src/config.js`의 `PLOT_STRUCTURES` |
| 구간 추가 때 새 구간 이름 | `src/config.js`의 `NEW_SECTION_NAME` |
| 자동 저장 대기 시간 | `src/config.js`의 `AUTOSAVE_DELAY_MS`(지금 500ms) |
| 이미지 최대 변 길이·WebP 품질 | `src/config.js`의 `IMAGE_MAX_SIDE`, `IMAGE_WEBP_QUALITY` |
| 제목을 비웠을 때 이름 | `src/config.js`의 `UNTITLED_PROJECT`, `UNTITLED_EPISODE`, `UNTITLED_MANDALART`, `UNTITLED_ITEM` |
| 격자 맞춤 간격 | `src/config.js`의 `SNAP_GRID`(지금 25. 페이지 좌표 단위) |
| 위젯 추가 때 기본 크기 | `src/config.js`의 `WIDGET_DEFAULT_SIZES` |
| 페이지 종류별 기본 배치 | `src/config.js`의 `DEFAULT_LAYOUTS`. 이미 만든 페이지는 바뀌지 않는다 |
| 텍스트 메모 배경색 | `src/config.js`의 `MEMO_COLORS`. DB에는 `value`가 저장되므로 이미 쓴 `value`는 바꾸지 않는다 |
| 손글씨 색 6개 | `src/config.js`의 `INK_PALETTE`. DB에는 `value`가 저장되므로 이미 쓴 `value`는 바꾸지 않는다 |
| 손글씨 굵기 3단계 | `src/config.js`의 `INK_SIZES` |
| 필압 없는 입력(손가락·마우스)의 고정 필압 | `src/config.js`의 `INK_DEFAULT_PRESSURE`(지금 0.5) |
| 사진 수 안내 기준(페이지당 image 위젯 수) | `src/config.js`의 `IMAGE_WIDGET_WARN`(지금 10) |
| 실행 취소 단계 수, 최대 확대 배율 | `src/config.js`의 `HISTORY_LIMIT`(30), `ZOOM_MAX`(3) |
| 스냅샷 보관 개수 | `src/config.js`의 `SNAPSHOT_KEEP`(지금 7) |
| 백업 알림 일수 | `src/config.js`의 `BACKUP_REMINDER_DAYS`(지금 7) |
| 백업 파일 `format` 값 | `src/config.js`의 `BACKUP_FORMAT_ID`. 바꾸면 예전 백업 파일을 못 읽으므로 바꾸지 않는다 |
| 백업 파일 검사 오류 문구, 복원 확인·실패 문구 | `src/screens/parts/restore-file.js`의 `BACKUP_ERROR_TEXT`, `OVERWRITE_TEXT`, `RESTORE_FAILED_TEXT` |
| 스티커 팩(그림 추가·수정) | `src/lib/sticker-pack.js`의 `STICKER_PACK`. DB에는 `id`가 저장되므로 이미 쓴 `id`는 바꾸거나 지우지 않는다(16장) |
| 스티커 기본 크기 | `src/config.js`의 `WIDGET_DEFAULT_SIZES.sticker`(지금 150×150) |
| 스티커 회전 각도 | `src/config.js`의 `ROTATION_STEP`(지금 15). 바꾸면 이미 저장한 각도가 배수에서 벗어날 수 있다 |
| 새 자유 페이지 템플릿 | `src/config.js`의 `PAGE_TEMPLATES`(배치는 `DEFAULT_LAYOUTS`). 이미 쓴 `id`는 바꾸지 않는다 |
| 페이지 배경 무늬와 간격 | `src/config.js`의 `PAGE_PATTERNS`, `PAGE_PATTERN_GAP`(50). 간격은 `src/styles/page.css`의 50px과 함께 고친다. 이미 쓴 무늬 `id`는 바꾸지 않는다 |
| 페이지 배경색 | `src/config.js`의 `PAGE_BG_COLORS`. DB에는 `value`가 저장되므로 이미 쓴 `value`는 바꾸지 않는다 |
| 테마 목록과 CSS 변수 값, 기본 테마 | `src/config.js`의 `THEMES`, `DEFAULT_THEME_ID`. 변수 이름은 `src/lib/themes.js`의 `THEME_VAR_KEYS`(18장) |
| 안내서·FAQ 문구 | `src/content/guide.js`의 `GUIDE_SECTIONS`, `FAQ_ITEMS`. 첫 구역(백업 안내)은 첫 자리에 둔다 |
| 첫 실행 안내 문구 | `src/content/onboarding.js`의 `ONBOARDING_CARDS` |
| 버그 제보 양식 주소 | `src/config.js`의 `BUG_REPORT_URL`(지금 빈 값 → 설정에 안내 문구). https 주소만 링크가 된다 |
| 문의 안내 문구 | `src/screens/settings.js`의 `CONTACT_NOTE_TEXT`, `CONTACT_PENDING_TEXT` |
| 예시 작품 내용 | `src/lib/sample-data.js`의 `buildSampleProject` |
| 위젯 종류 추가 | `src/screens/widgets/`에 모듈 하나 + `index.js`의 `WIDGETS`, `WIDGET_ORDER` + `config.js`의 `WIDGET_DEFAULT_SIZES` |
| 화면 추가·교체 | `src/main.js`의 `SCREENS` 표 |
| 주소(경로) | 설정집 아래는 `src/router.js`의 `BOOK_ROUTES`, 그 밖은 `parseHash`, `formatHash`, `navItemFor` |
| 위치 문구 | `src/shell.js`의 `locationLabel` |
| 색·글꼴 | `src/styles/base.css`의 `:root` 변수 |
| DB 오류 안내 문구 | `src/main.js`의 `DB_ERROR_TEXT` |
| 앱 버전 | `package.json`의 `version` |
| 서비스 워커·매니페스트(앱 이름, 색, 아이콘) | `vite.config.js`의 `VitePWA({...})` |

`sw.js` 파일은 직접 쓰지 않는다. `npm run build` 때 vite-plugin-pwa가 `vite.config.js` 설정으로 만든다.
캐시할 파일 종류는 `workbox.globPatterns`에서 고친다.

## 6. 삭제할 때 함께 정리되는 것

다른 레코드가 가리키는 id를 지우면, 가리키던 쪽도 같은 트랜잭션 안에서 고친다. 실패하면 전부 되돌아가고 toast "삭제하지 못했습니다"가 뜬다.

| 삭제 대상 | 함께 정리 | 함수 |
|---|---|---|
| Episode | PlotCard.episodeIds에서 id 제거, TimelineEvent.episodeId → null | `src/db/episodes.js`의 `deleteEpisode` |
| Character | Episode.characterIds·TimelineEvent.characterIds에서 id 제거. 캐릭터 카드 위젯은 "삭제된 항목"으로 보인다 | `src/db/characters.js`의 `deleteCharacter` |
| StorageItem | 없음 | `src/db/storage.js`의 `deleteStorageItem` |
| Page | 그 Page의 Widget·InkStroke | `src/db/pages.js`의 `deletePage` |
| Widget | 없음. 페이지 화면에서 지우고, 실행 취소로 되살릴 수 있다 | `src/db/widgets.js`의 `savePageOps` |
| PlotCard, TimelineEvent, Mandalart | 없음 (다른 레코드가 참조하지 않음) | 각 delete 함수 |
| Project | 모든 테이블의 그 작품 레코드(pages의 widgets·inkStrokes 포함). Snapshot은 건드리지 않는다 | `src/db/projects.js`의 `deleteProjectCascade` |

Asset(이미지)은 위 함수들이 직접 지우지 않는다. 이미지 교체·제거도 마찬가지다. 동작이 끝난 뒤 화면이 `requestAssetGc()`를 부르고, Asset 정리가 아무 데서도 가리키지 않는 Asset만 지운다(9장).

| 동작 | 끝난 뒤 `requestAssetGc()`를 부르는 곳 |
|---|---|
| 캐릭터 이미지 교체·제거, 캐릭터 삭제 | `character-detail.js` |
| 보관함 이미지 교체, 자료 삭제 | `storage-item.js` |
| 파일 복원, 스냅샷 복원(설정 화면) | `parts/restore-file.js`의 `finishRestore` |
| 스냅샷이 지워짐(7개 넘음), 스냅샷 복원 | `src/db/snapshots.js` |
| 작품 삭제 | `library.js` |
| image 위젯 교체, 위젯 삭제, 페이지 화면 떠나기 | `page/page-screen.js` |
| 자유 페이지 삭제 | `free-page-list.js` |

부르는 것을 잊어도 다음 앱 시작 때 Asset 정리가 돈다.

새 테이블이 다른 레코드의 id를 갖게 되면 위 표의 함수에 정리 코드를 더하고, 테스트도 더한다.

삭제 전에는 항상 확인 창(`confirmDialog`)을 띄운다. 에피소드 상세의 참고 링크 하나를 지울 때도 확인 창을 띄운다(사용자가 정한 규칙). 링크는 레코드가 아니라 `Episode.links` 배열의 한 칸이지만, 되돌릴 수 없으므로 똑같이 묻는다.
페이지 화면의 위젯 삭제와 선 지우개는 실행 취소로 되돌릴 수 있어서 확인 창을 띄우지 않는다.

## 7. 백업 파일 구조

내보내기는 `src/screens/parts/backup-buttons.js` → `src/db/backup.js`의 `buildExport` → `src/lib/backup-format.js`의 `serializeBackup` 순서다. 파일은 기기 안에서만 만들고 서버로 보내지 않는다.

```json
{
  "format": "mlbd-diary-backup",
  "appVersion": "0.2.0",
  "schemaVersion": 3,
  "exportedAt": "2027-10-30T12:34:56.000Z",
  "tables": {
    "projects": [...], "characters": [...], "synopses": [...], "plotStructures": [...],
    "plotCards": [...], "timelineEvents": [...], "mandalarts": [...], "episodes": [...],
    "storageItems": [...], "pages": [...], "widgets": [...], "inkStrokes": [...], "settings": [...],
    "assets": [{ "id": "...", "mime": "image/webp", "width": 1600, "height": 900,
                 "kind": "image", "createdAt": 0, "updatedAt": 0, "data": "<Base64>" }]
  }
}
```

- `format`은 `BACKUP_FORMAT_ID`, 파일 이름은 `MyLastBestDiary-백업-YYYY-MM-DD.json`(기기 날짜)이다.
- `tables`는 snapshots를 뺀 14개 테이블이다(`LIVE_TABLES`). 손글씨는 `inkStrokes`에 들어 있다.
- `assets`에는 Live 데이터가 가리키는 이미지만 넣는다(Character.imageAssetId, StorageItem.assetId, image 위젯 `data.assetId`). 이미지는 Base64 문자열이다.
- 내보내기 전에 `flushAll()`로 대기 중인 입력을 먼저 저장한다. 테이블은 읽기 트랜잭션 하나에서 읽어 같은 시점의 데이터가 된다.
- 다운로드를 누른 직후, 또는 공유가 성공한 뒤 `Settings.lastBackupAt`을 지금 시각으로 바꾼다. 7일 백업 알림은 이 값을 본다. 공유 제목은 "My Last Best Diary 백업"이고, 공유가 실패하면(사용자가 취소한 경우는 빼고) toast "공유하지 못했습니다"가 뜬다.

불러올 때 `parseBackup`이 검사하는 순서:

1. JSON이 아니거나 `format`이 다르다 → "이 앱의 백업 파일이 아닙니다"
2. `appVersion`이 문자열이 아니거나 `schemaVersion`이 1 이상 정수가 아니다 → "백업 파일이 손상되었습니다"
3. `schemaVersion`이 앱의 `SCHEMA_VERSION`보다 크다 → "더 새 버전 앱에서 만든 백업입니다. 앱을 업데이트한 뒤 불러오세요"
4. 테이블이 하나라도 배열이 아니거나, 레코드에 문자열 `id`가 없거나, Base64를 해석할 수 없다 → "백업 파일이 손상되었습니다"

어느 경우든 Live 데이터는 그대로다. 문구는 `src/screens/parts/restore-file.js`의 `BACKUP_ERROR_TEXT`에 있다.

스티커는 그림이 아니라 `widgets`의 `data.stickerId`만 들어간다. 그림은 앱 코드(`sticker-pack.js`)에 있어서 파일에 넣지 않는다. 테마(`Settings.defaultThemeId`)는 `settings`에 들어가고, 복원하면 파일의 테마를 따른다.

## 8. 스냅샷(앱 안 자동 보관) 생성·보관 규칙

스냅샷은 `snapshots` 테이블에 저장하는, 그 시점 Live 데이터의 복사본이다. 파일 백업과 따로 도는 안전장치이고 `lastBackupAt`을 바꾸지 않는다. 코드는 `src/db/snapshots.js`, 판단 규칙은 `src/lib/backup-rules.js`에 있다.

- 확인 시점(`src/main.js`): 시작할 때 `setTimeout(() => maybeCreateDailySnapshot().finally(requestAssetGc), 0)`, 그리고 화면이 다시 보일 때(`visibilitychange`가 visible) `maybeCreateDailySnapshot()`.
- 만드는 조건(`shouldCreateSnapshot`): 오늘(기기 날짜, `localDate`) 스냅샷이 없고, 마지막 스냅샷 뒤 데이터가 바뀌었을 때. 바뀌었는지는 테이블별 (레코드 수, 가장 큰 updatedAt) 지문(`fingerprint`)으로 본다. settings는 지문에서 뺀다. 스냅샷이 하나도 없으면 작품이 1개 이상일 때 만든다.
- 이유(`reason`)는 `daily`(자동 보관)와 `pre-restore`(복원 직전) 두 가지다.
- 내용: assets를 뺀 13개 테이블 레코드(`data.tables`)와, 그 데이터가 가리키는 Asset id 목록(`assetIds`). 이미지 자체는 복사하지 않는다.
- 보관: 만들 때마다 createdAt이 최근인 `SNAPSHOT_KEEP`(7)개만 남기고 지운다. 지운 것이 있으면 Asset 정리를 부른다. 스냅샷 복원 중에는 복원 대상을 지우지 않는다.
- 실패하면 `console.error`만 남기고 앱은 계속 쓸 수 있다. 같은 시점에 두 번 불러도 한 번만 돈다.
- 알려진 빈틈: updatedAt을 바꾸지 않는 변환 규칙과 기기 시계가 뒤로 간 경우에는 지문이 같아 그날 스냅샷 하나를 건너뛸 수 있다.

## 9. Asset 정리(Asset_GC) 규칙

코드는 `src/db/asset-gc.js`다. Asset은 아래 세 곳 중 하나라도 가리키면 남기고, 셋 다 아니면 지운다.

1. Live 참조: Character.imageAssetId, StorageItem.assetId, image 위젯 `data.assetId`(`collectAssetRefs`)
2. 스냅샷: 모든 Snapshot의 `assetIds`
3. 열린 페이지 핀: 페이지 화면이 `setPinnedAssets(ids)`로 넘긴 id. 화면의 모델과 실행 취소 기록이 쥔 이미지, 처리 중인 새 이미지가 들어 있다. 위젯을 지운 뒤 실행 취소하면 사진이 돌아오는 것은 이 핀 덕분이다. 화면을 떠나면 핀을 비우고 정리를 부른다.

- 참조 모으기와 삭제는 rw 트랜잭션 하나(assets, characters, storageItems, widgets, snapshots)라 실패하면 아무것도 지워지지 않는다. 오류는 `console.error`로 남는다.
- `requestAssetGc()`는 1초 안에 여러 번 불러도 한 번만 돈다. 앱 DB(`db`)만 정리한다. 테스트용 DB에는 `runAssetGc(database, { pins })`를 직접 부른다. 스냅샷 함수도 테스트 DB에서는 정리를 부르지 않는다.
- 새 테이블이나 위젯이 Asset id를 갖게 되면 `collectAssetRefs`(`src/lib/backup-rules.js`)와 `runAssetGc` 트랜잭션의 테이블 목록에 더한다. 빠뜨리면 쓰고 있는 사진이 지워진다.

## 10. 복원 순서

파일 복원(`src/screens/parts/restore-file.js`의 `restoreFromFile` → `src/db/backup.js`의 `restoreData`). 서재 빈 상태, 첫 실행 안내 마지막 장, 설정 화면의 "백업 파일로 복원" 버튼이 모두 이 흐름을 쓴다. 파일 복원과 스냅샷 복원은 `runExclusive`로 앱 전체에서 한 번에 하나만 돌고, 그동안 `lockWhileRestoring`으로 등록한 버튼은 비활성화된다.

1. 파일을 읽고 `parseBackup`으로 검사한다(7장). 실패면 안내만 띄우고 끝.
2. 확인 창: 백업 날짜, 작품 수, "현재 데이터를 모두 덮어씁니다. 덮어쓰기 전 현재 상태를 앱 안에 자동 보관합니다".
3. `flushAll()` → `createSnapshot('pre-restore')`. 실패면 "복원 전 자동 보관에 실패해 복원을 멈췄습니다", 끝.
4. Base64 → Blob 변환을 트랜잭션 밖에서 먼저 끝낸다(Dexie 트랜잭션 안에서 다른 비동기 작업을 기다리면 트랜잭션이 닫힌다).
5. `restoreData`: Live 14개 테이블 rw 트랜잭션 하나 안에서
   1. 이 기기의 Settings에서 `lastBackupAt`, `penDetected`, `penOnly`를 기억한다.
   2. assets를 뺀 13개 테이블을 비우고 파일의 레코드를 넣는다.
   3. 파일의 Asset을 `bulkPut`한다. assets 테이블은 비우지 않는다(스냅샷이 가리키는 사진을 지키기 위해서다. 남는 것은 Asset 정리가 지운다).
   4. 파일의 schemaVersion이 낮으면 같은 트랜잭션에서 변환 규칙을 돌린다(`runMigrationSteps`).
   5. Settings에 기억한 세 값을 다시 넣고 schemaVersion을 지금 값으로 맞춘다.
6. 어느 단계든 실패하면 트랜잭션 전체가 되돌아가고 "복원하지 못했습니다. 데이터는 그대로입니다"가 뜬다.
7. 성공(`finishRestore`): "복원했습니다", 현재 작품 지우기, `onboardingDone`을 true로, 복원된 설정의 테마를 다시 적용(`applyTheme`), `requestAssetGc()`, 그다음 `onRestored`가 있으면 그것을, 없으면 서재로 이동.

스냅샷 복원(`src/db/snapshots.js`의 `restoreSnapshot`)도 같다. 다른 점은 이것뿐이다.

- 확인 창에는 스냅샷 날짜·시각을 보인다.
- pre-restore 스냅샷을 만들 때 복원 대상을 보호해 7개 정리에서 지워지지 않게 한다.
- `restoreData(대상.data, null)`로 부른다. assets 테이블은 건드리지 않는다. 대상이 가리키던 Asset은 Asset 정리가 지켜 왔으므로 그대로 있다.
- 끝나면 보호 없이 7개 정리를 다시 하고 Asset 정리를 부른다. 그 뒤 설정 화면이 `finishRestore()`를 부른다(7단계와 같다).

## 11. 화면 하나 추가하는 법

예: 설정집에 새 구역 "용어집"(`#/p/:pid/book/glossary`)을 더하기.

1. `src/screens/glossary.js`를 만든다. 모양은 아래와 같다.

   ```js
   import { createAutosave, showStatus } from '../lib/autosave.js';
   import { h } from '../lib/dom.js';

   export async function render(el, route) {
     const projectId = route.projectId;
     const data = await loadSomething(projectId);          // db/*.js 함수

     const indicator = h('span', { class: 'save-indicator', 'aria-live': 'polite' });
     const autosave = createAutosave({
       save: (patch) => saveSomething(projectId, patch),   // db/*.js 함수
       onStatus: (status) => showStatus(indicator, status),
     });

     const input = h('textarea', {
       value: data.text ?? '',
       oninput: (e) => autosave.schedule({ text: e.target.value }),
     });

     el.replaceChildren(h('section', {}, h('h1', { class: 'screen-title' }, '용어집'), indicator, input));

     // 정리 함수. 떠날 때 저장은 라우터가 flushAll()로 먼저 한다.
     return () => autosave.dispose();
   }
   ```

   - `render(el, route)`는 `el` 안에 화면을 그리고, 정리 함수를 돌려준다(없으면 아무것도 안 돌려줘도 된다).
   - 사용자 입력은 `h()`나 `textContent`로만 넣는다. `innerHTML`은 쓰지 않는다.
   - `replaceChildren()`에 배열을 넘길 때는 꼭 펼친다: `el.replaceChildren(...list)`. 배열을 그대로 넘기면 `[object HTMLElement]` 같은 글자가, `null`을 넘기면 `null`이라는 글자가 화면에 나온다. `h()`의 자식은 배열과 `null`을 알아서 처리하지만 `replaceChildren()`·`append()`는 그렇지 않다.
   - 실제 예시는 `src/screens/synopsis.js`가 가장 짧다. 목록·상세가 있는 구역은 `episode-list.js`, `episode-detail.js`를 본다.

2. `src/router.js`의 `BOOK_ROUTES`에 한 줄을 더한다: `glossary: Object.freeze(['glossary', null, null]),`. 상세 화면이 있으면 `[목록 name, 상세 name, 상세 id 필드]`로 쓴다(예: `episodes`). `parseHash`, `formatHash`, `navItemFor`는 이 표를 읽으므로 고치지 않는다. 파일 맨 위 경로 표 주석은 고친다.
   설정집 밖의 주소(예: 다이어리 월간 `#/p/:pid/diary/monthly`)라면 `parseHash`, `formatHash`, `navItemFor`를 직접 고친다.
3. `src/main.js`에서 화면을 `import`하고 `SCREENS`에 `glossary: glossaryScreen,` 한 줄을 넣는다. 이름은 `BOOK_ROUTES`의 경로 name과 같아야 한다.
4. `src/shell.js`의 `locationLabel`에 `case 'glossary':`를 더한다(목록은 "설정집 › 구역" 줄에, 상세는 `detail(...)`).
5. `src/config.js`의 `BOOK_SECTIONS`에 `{ id: 'glossary', label: '용어집', ready: true }`를 더한다. `id`는 `BOOK_ROUTES`의 키와 같아야 한다.
6. 화면 전용 CSS가 필요하면 `src/styles/`에 만들고 화면 파일 맨 위에서 `import`한다.
7. `npm test`.

## 12. schemaVersion 올리는 절차

저장된 데이터 모양을 바꿀 때(예: 캐릭터에 `tags` 필드 추가) 한다.

1. `src/config.js`의 `SCHEMA_VERSION`을 1 올린다(예: 3 → 4). 위 주석에 무엇을 바꿨는지 한 줄 적는다.
2. `src/db/migrations.js`의 `MIGRATIONS`에 같은 번호의 규칙을 추가한다. 파일 안 주석 예시를 참고한다.

   ```js
   export const MIGRATIONS = {
     // 2, 3: ... (이미 있는 규칙)
     4: async (tx) => {
       await tx.table('characters').toCollection().modify((c) => { c.tags ??= []; });
     },
   };
   ```

3. 테이블이나 색인이 바뀌면 `src/db/db.js`에 `database.version(n+1).stores({...})`를 추가한다. 지금 마지막은 `version(2)`다. 기존 `version(1)`, `version(2)` 줄은 지우지 않는다. 필드만 추가하고 색인이 안 바뀌면 이 단계는 건너뛴다.
4. `src/lib/backup-format.js`의 `backupTablesFor`가 새 번호를 알게 고친다(지금은 1~3만 받는다. 고치지 않으면 새 버전 백업 파일을 "손상"으로 본다). 새 테이블을 만들었으면 `LIVE_TABLES`에도 넣고, 옛 번호에는 그 테이블이 없게 한다. 새 테이블이 Asset id를 가지면 9장도 본다.
5. `tests/db.test.js`에 변환 테스트를 추가하고 `npm test`를 실행한다.

실제 사례:

- schemaVersion 2는 Episode에 `links`(참고 링크 배열)를 추가했다. 규칙 2는 `links`가 없는 Episode에 `[]`만 넣고 `updatedAt`은 바꾸지 않는다. 색인이 아니라서 Dexie `version(1)`은 그대로다.
- schemaVersion 3은 Settings에 `snapGrid`·`penDetected`·`penOnly`(없으면 모두 `false`)를 넣고, Dexie `version(2)`로 `snapshots` 테이블과 pages의 고유 색인 `&[projectId+kind+month]`를 더했다. 다른 Record와 `updatedAt`은 그대로다.
- 마지막 블록(10/31)은 schemaVersion을 올리지 않았다(기존 필드 사용). 스티커는 Widget `type: 'sticker'`와 `rotation`, 템플릿·배경은 `Page.templateId`·`Page.background`, 테마·첫 실행 안내는 `Settings.defaultThemeId`·`Settings.onboardingDone`을 쓴다. 이 필드들은 처음부터 레코드에 있었다.

규칙은 트랜잭션 하나 안에서 돈다. 중간에 실패하면 데이터와 schemaVersion이 모두 되돌아가고, 사용자는 "업데이트 중 문제가 생겼습니다" 안내를 본다.
번호가 빠진 규칙이 있으면 아무것도 실행하지 않고 오류가 난다.
옛 백업 파일이나 스냅샷을 복원할 때도 같은 규칙이 복원 트랜잭션 안에서 돈다(10장). 그래서 규칙은 `tx.table(...)`만 쓰고 다른 비동기 작업을 기다리지 않는다.

## 13. 버그가 났을 때 찾는 순서

1. 크롬 개발자 도구(F12) → Console에서 빨간 오류를 본다. 대부분의 오류는 `console.error`로 남는다.
2. 화면이 이상하다(안 보임, 버튼 안 됨, 배치 깨짐) → 그 화면의 `src/screens/*.js`와 `src/styles/*.css`. 칩·캐릭터 고르기·링크 목록이면 `src/screens/parts/*.js`와 `parts.css`.
3. 화면에 `[object HTMLElement]`, `[object Object]`, `null` 같은 글자가 보인다 → `replaceChildren()`이나 `append()`에 배열이나 `null`을 그대로 넘긴 곳이다. `...list`로 펼치고 `null`은 빼고 넘긴다(11장 참고).
4. 다른 화면이 뜨거나 서재·목록으로 튕긴다 → `src/router.js`(`parseHash`, `BOOK_ROUTES`, 작품 존재 확인). 상세 화면은 id가 없거나 다른 작품 것이면 목록으로 돌아간다.
5. 상단 바·Nav·위치 문구가 이상하다 → `src/shell.js`, `src/ui.js`.
6. 저장이 안 되거나 "저장 실패"가 뜬다 → `src/db/*.js`, `src/lib/autosave.js`. 플롯·타임라인은 `src/screens/parts/record-autosaves.js`도 본다. 개발자 도구 → Application → IndexedDB → `mlbd-diary`에서 실제 데이터를 본다.
7. 지운 회차·캐릭터가 다른 화면에 남아 있다 → 6장 표의 삭제 함수.
8. 끌어 놓기가 안 되거나 엉뚱한 곳에 놓인다 → `src/lib/drag.js`, 위치 계산은 `src/lib/plot.js`, `src/lib/timeline.js`.
9. 앱이 아예 안 열리고 안내 문구만 뜬다 → `src/db/db.js`의 `openDatabase`, `src/db/migrations.js`.
10. 페이지의 위젯이 안 움직이거나, 엉뚱한 곳에 놓이거나, 격자에 안 맞는다 → `src/screens/page/edit-controller.js`, 계산은 `src/lib/geometry.js`. 확대·배율은 `src/screens/page/stage.js`.
11. 실행 취소가 이상하다 → `src/lib/history.js`, `src/lib/page-model.js`(`captureLatest`, 17장), 저장은 `src/db/widgets.js`의 `savePageOps`.
12. 위젯 하나만 이상하다(메모, 체크리스트, 사진, 달력, 카드, 스티커) → `src/screens/widgets/` 그 종류 파일과 `widgets.css`. 위젯 사진이 깨지면 `page/page-screen.js`의 objectURL 관리.
13. 손글씨가 안 써지거나, 손가락에 선이 그어지거나, 지우개가 안 먹는다 → `src/screens/page/ink-controller.js`, `src/lib/ink-input.js`(입력 라우팅), `src/lib/ink-geometry.js`(필압, 지우개 판정).
14. 백업 파일이 안 만들어지거나 복원이 안 된다 → `src/screens/parts/backup-buttons.js`, `src/screens/parts/restore-file.js`, `src/db/backup.js`, 파일 검사는 `src/lib/backup-format.js`.
15. 스냅샷이 안 생기거나 너무 많다 → `src/db/snapshots.js`, 조건은 `src/lib/backup-rules.js`.
16. 쓰던 사진이 사라졌다 → `src/db/asset-gc.js`와 `collectAssetRefs`(9장). 사진이 안 지워지고 쌓이면 `requestAssetGc()` 호출 위치(6장).
17. 스티커가 안 보이거나 "없는 스티커"로 나온다 → `src/screens/widgets/sticker.js`, 도형은 `src/lib/sticker-pack.js`, 정리 규칙은 `src/lib/stickers.js`(허용 밖 요소·속성은 소리 없이 빠진다). 저장된 `stickerId`가 팩에 있는지 본다. 회전이 이상하면 `src/lib/geometry.js`의 `rotateStep`·`rotationCommand`와 `page/page-screen.js`.
18. 테마가 안 바뀌거나 새로고침 뒤 되돌아간다 → `src/theme.js`의 `applyTheme`, `src/lib/themes.js`, `src/config.js`의 `THEMES`. 개발자 도구에서 `<html>`의 `data-theme`과 style 변수를 본다. 일부 색만 안 바뀌면 그 CSS가 `:root` 변수 대신 색 값을 직접 쓰는 곳이다.
19. 첫 실행 안내가 안 뜨거나 계속 뜬다 → `src/main.js`의 시작 순서, `src/router.js`의 `decideStartRoute`, `src/screens/welcome.js`. IndexedDB의 `settings` 레코드에서 `onboardingDone`을 본다(19장).
20. 안내서·FAQ 화면이 이상하거나 문구를 고치고 싶다 → `src/screens/guide.js`, 문구는 `src/content/guide.js`, 스타일은 `src/styles/guide.css`.
21. 페이지 배경 무늬·색이 안 보이거나 무늬 간격이 격자와 어긋난다 → `src/lib/page-style.js`, `page/page-screen.js`의 `.page-paper` 층, `src/styles/page.css`(무늬 50px, 격자선 `.page-paper::after`). `PAGE_PATTERN_GAP`과 CSS 50px이 같은지 본다.
22. 서재 빈 상태·첫 실행 안내·설정의 "백업 파일로 복원"이 안 눌리거나 반응이 없다 → `src/screens/parts/restore-file.js`(`runExclusive`가 다른 복원이 도는 동안 막는다).
23. 오프라인·설치·아이콘 문제 → `vite.config.js`(PWA 설정). `npm run build` 후 `npm run preview`로 재현한다.
24. 배포가 안 된다 → GitHub Actions 탭의 실패 로그, `.github/workflows/deploy.yml`.

고친 뒤에는 `npm test`. 기능 동결 기간에는 15장 순서대로 고친다(실패하는 테스트를 먼저 쓴다).

## 14. 새 버전이 안 보일 때

서비스 워커는 `registerType: 'prompt'`로 설정돼 있다(`vite.config.js`). 새 버전은 내려받아 두기만 하고, 앱을 처음부터 다시 실행할 때 적용된다. 쓰는 도중에 화면이 바뀌지 않게 하려는 설정이다.

1. 휴대폰·태블릿: 최근 실행 목록에서 앱을 위로 밀어 완전히 닫는다. 다시 연다.
2. 그래도 그대로면 한 번 더 닫았다 연다(첫 실행에서 내려받고, 다음 실행에서 적용될 수 있다).
3. 설정 화면의 앱 버전으로 확인한다. 버전은 `package.json`의 `version`이므로 배포할 때 올려 두면 구분이 쉽다.
4. PC 크롬에서는 개발자 도구 → Application → Service Workers에서 상태를 볼 수 있다.

데이터는 IndexedDB에 있어서 앱을 닫거나 업데이트해도 지워지지 않는다. 브라우저의 "사이트 데이터 삭제"는 데이터까지 지우므로 쓰지 않는다.

## 15. 기능 동결

10/31 블록으로 기능 만들기를 끝냈다. 앱 버전은 `1.0.0`(`package.json`의 `version`)이다.
10/31 이후 12/25까지는 새 기능을 만들지 않고 버그만 고친다.

버그를 고치는 순서:

1. 재현한다. 어떤 기기·브라우저에서, 무엇을 누르면 생기는지 적는다(13장에서 볼 파일을 찾는다).
2. `tests/`에 그 버그로 실패하는 테스트를 먼저 쓴다. `npm test`로 실패하는지 확인한다. 화면에서만 재현되면 계산을 `src/lib/`의 순수 함수로 떼어 내고 그 함수를 테스트한다.
3. 고친다. 고칠 곳만 고친다. 주변 코드를 정리하지 않는다.
4. `npm test`와 `npm run build`가 둘 다 성공하는지 본다.
5. `package.json`의 `version`을 올린다(버그 수정은 끝자리: `1.0.0` → `1.0.1`). `package-lock.json` 맨 위 `version` 두 곳도 같이 고친다(`npm install`을 한 번 돌리면 맞춰진다).
6. 커밋하고 `main`에 푸시한다. Actions 탭에서 배포가 끝났는지 본다(3장).

저장된 데이터 모양을 바꿔야만 고칠 수 있는 버그라면 12장 절차대로 schemaVersion을 올린다. 변환 테스트를 꼭 더하고, 옛 백업 파일 복원도 확인한다.

하지 않는 것:

- 새 위젯 종류, 새 화면, 새 경로
- 새 의존 패키지(런타임 의존성은 `dexie`, `perfect-freehand` 둘뿐이다)
- 포모도로·타이머·작업 시간 기록
- 일간(매일) 페이지. `Page.kind`는 `main`, `monthly`, `free` 그대로
- 동기화·계정·서버
- 테마 3종째, 작품별 테마, 내 이미지 스티커
- 메인·월간 페이지 손글씨, 손글씨 올가미, 위젯 묶기·정렬 도구, 연재 D-day 위젯, 작품 하나만 내보내기
- 버그와 관계없는 리팩터링, 디자인 바꾸기
- 백업 파일 `format` 값과 이미 쓴 id·value(스티커, 템플릿, 무늬, 색, 테마, 에피소드 상태) 바꾸기

문구 오타 고치기와 안내서·FAQ 문구 보충(`src/content/guide.js`)은 버그 수정으로 친다.

## 16. 스티커 추가하는 법

스티커 그림은 `src/lib/sticker-pack.js`의 `STICKER_PACK`에 도형 데이터로 직접 적는다. 이미지 파일이나 외부 주소는 쓰지 않는다. 위젯은 `data.stickerId`만 저장한다.

1. `STICKER_PACK` 맨 뒤에 하나를 더한다.

   ```js
   { id: 'cloud', label: '구름', viewBox: '0 0 100 100', shapes: [
     { tag: 'ellipse', attrs: { cx: 50, cy: 55, rx: 38, ry: 22, fill: '#ffffff', stroke: INK, 'stroke-width': 3 } },
   ] },
   ```

   - `id`는 다른 스티커와 겹치지 않게 짓는다. 이미 쓴 `id`는 바꾸거나 지우지 않는다. 지우면 그 스티커를 붙인 페이지에 "없는 스티커"가 보인다.
   - 좌표는 `viewBox` `0 0 100 100` 안에서 잡는다. 위젯 크기에 맞춰 늘어난다.
2. 쓸 수 있는 요소는 `src/lib/stickers.js`의 `SHAPE_TAGS`(path, circle, ellipse, rect, polygon, polyline, line, g), 속성은 `SHAPE_ATTRS`뿐이다. `children`은 `g`에만 둔다.
   값은 문자열이나 유한한 수여야 하고, `url(`, `javascript:`, `data:`, `http:`, `https:`, `href`가 들어가면 빠진다. 색은 `#rrggbb`로 쓴다.
   `sanitizeShape`이 허용 밖 요소·속성을 소리 없이 빼므로, 그림 일부가 안 나오면 이 목록을 먼저 본다. 화면은 `sanitizeShape`을 거친 결과만 `createElementNS`로 그린다(`widgets/sticker.js`).
3. `npm test`. `tests/stickers.test.js`가 모든 스티커가 `sanitizeShape`을 거쳐도 그대로인지, `id`가 겹치지 않는지, 개수가 28~32개인지 본다. 32개를 넘기려면 이 테스트의 상한도 고친다.
4. `npm run dev`로 편집 모드 → 위젯 추가 → 스티커에서 피커에 보이는지 확인한다.

## 17. 실행 취소 기록이 위젯 레코드를 다시 담는 규칙

페이지의 실행 취소 기록(`src/lib/history.js`)에는 명령이 들어 있다. `addWidget`·`deleteWidget` 명령은 위젯 레코드 전체를 들고 있다.
메모 글, 체크리스트 항목처럼 위젯 안 내용은 명령 없이 바로 저장되므로, 명령이 든 레코드는 시간이 지나면 낡는다.

그래서 실행 취소·다시 실행이 명령을 반대쪽 기록으로 옮길 때, 그 명령이 화면에서 위젯을 빼는 경우에는 `captureLatest(model, cmd)`(`src/lib/page-model.js`)로 그 순간 화면 모델의 레코드로 바꿔 담는다.
`page/page-screen.js`가 `undo(history, (c) => captureLatest(model, c))`, `redo(...)`처럼 `capture` 인자로 넘긴다.

- 다시 담는 것: `addWidget`·`deleteWidget`이고 모델에 같은 id 위젯이 있을 때. 그 밖(이동·크기 `updateWidgets`, 손글씨 명령, 모델에 없는 위젯)은 명령 그대로다.
- 예: 위젯 추가 → 메모에 글 입력 → 실행 취소 → 다시 실행. 글이 남는다.
- 다시 담은 레코드가 이미지를 가리키면 기록이 쥔 Asset으로 핀에 들어간다(`historyAssetIds`, 9장).
- 새 명령 종류를 만들고 그 명령이 레코드 전체를 든다면 `captureLatest`에도 더하고 `tests/history.test.js`에 왕복 테스트를 더한다.

## 18. 테마 추가·수정하는 법

테마는 `src/config.js`의 `THEMES`에 있다. 테마마다 `{ id, label, vars }`이고, `vars`에는 CSS 변수 14개(`src/lib/themes.js`의 `THEME_VAR_KEYS`)를 모두 적는다.
`applyTheme`(`src/theme.js`)이 이 값을 `<html>` style에 쓰고 `data-theme`을 테마 id로 바꾼다. 시작할 때, 설정에서 고를 때, 복원 뒤에 돈다. 고른 테마는 `Settings.defaultThemeId`에 저장되고, 기기 전체에 하나다.

- 색 고치기: `THEMES`에서 그 테마의 값을 바꾼다. 종이 테마 값을 바꾸면 `src/styles/base.css`의 `:root` 값도 같게 맞춘다(첫 화면이 그려질 때 쓰인다).
- 테마 추가: `THEMES`에 하나를 더한다. 14개 변수를 빠짐없이 적는다. 설정 화면의 테마 고르기는 `THEMES`를 읽으므로 고치지 않는다. 다만 15장대로 동결 기간에는 테마를 더하지 않는다.
- 변수 추가: `THEME_VAR_KEYS`에 이름을 더하고, `base.css` `:root`와 모든 테마의 `vars`에 값을 넣는다. CSS에서는 `var(--이름)`으로만 쓴다.
- 글꼴은 기기에 있는 글꼴 이름만 쓰고 맨 끝에 `serif`나 `sans-serif`를 둔다. 글꼴 파일과 `url()`은 쓰지 않는다.
- 이미 쓴 테마 `id`는 바꾸지 않는다. 모르는 id는 기본 테마(`DEFAULT_THEME_ID`, 지금 `paper`)로 읽는다.
- `npm test`. `tests/themes.test.js`가 모든 테마의 변수가 `THEME_VAR_KEYS`와 꼭 같은지, 글꼴 규칙, `url()`이 없는지 본다.

## 19. 첫 실행 안내가 보이는 조건

`src/main.js`는 주소에 해시가 없을 때(`#`만 있을 때 포함)만 시작 화면을 정한다. `src/router.js`의 `decideStartRoute`가 정한다.

- 작품이 0개이고 `Settings.onboardingDone`이 false → 첫 실행 안내(`#/welcome`)
- 그 밖 → 마지막에 연 작품의 메인, 없으면 서재. 작품이 있는 기기(기존 사용자)에는 안내가 뜨지 않는다.

`onboardingDone`이 true가 되는 경우: "건너뛰기", "빈 서재로 시작", "예시 작품으로 시작"(예시 작품을 만든 뒤), 백업 파일·스냅샷 복원 성공(`finishRestore`). 예시 작품 만들기가 실패하면 그대로 false다.
저장에 실패해도 앱은 계속 쓰고, 다음 시작에 안내가 다시 뜰 뿐이다. 안내를 다시 보고 싶으면 주소창에 `#/welcome`을 직접 연다. 카드 문구는 `src/content/onboarding.js`에 있다.
