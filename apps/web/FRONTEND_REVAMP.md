# 프론트엔드 디자인 리뉴얼 (dev_front) — 안내

> 브랜치 `dev_front` 에 담긴 프론트엔드 리뉴얼/신규 화면 설명입니다.
> **목표**: 5월 시스템을 WEPLAY 브랜드로 디자인 통일 + 신규 운영/사용자 화면 추가, 그리고 정석님 백엔드(`/api/v1`)에 그대로 붙일 수 있게 구성.

---

## 1. 설계 목적 / 원칙

- **WEPLAY 다크 브랜드 + 라이트 토글**: 딥네이비 배경 + 시안/블루/퍼플 글로우. 모든 화면이 **CSS 변수(토큰)** 만 바라보게 해서, 다크/라이트 전환과 향후 색 조정을 토큰 값만 바꾸면 되도록 함.
  - 사용자 앱: `features/viewer/ViewerApp.module.css` 의 `.app` 토큰 (+ `[data-theme="light"]`)
  - 관리자 콘솔: `features/admin/AdminConsole.module.css` 의 `.console` 토큰 (+ `:global([data-theme="light"])`)
  - 전역(기존 Tailwind 페이지): `src/styles/theme.css` 토큰 + 호환 레이어
- **CSS Modules** 로 화면별 스타일 격리 (Tailwind 기존 페이지와 충돌 없음).
- **데모 라우트 우선**: 백엔드 없이도 화면을 확인/공유할 수 있도록 목업 데이터로 도는 데모 경로 제공. 실데이터는 `// TODO(backend)` 지점만 교체.
- **모듈화**: 역할별 `features/{viewer,admin,ads}` 폴더로 분리.

---

## 2. 디렉토리 구조 (이번 리뉴얼 관련)

```
apps/web/src/
├─ App.jsx                         # 라우팅 (아래 라우트 추가됨)
├─ main.jsx                        # 첫 페인트 전 테마 적용(?theme/localStorage)
├─ styles/theme.css               # 전역 WEPLAY 토큰 + 기존 Tailwind 화면 다크/라이트 호환 레이어
├─ components/ThemeToggle.jsx      # 전역 다크/라이트 토글(우하단, /app 제외)
│
├─ features/viewer/               # 사용자(관객) 앱 — 모바일
│  ├─ ViewerApp.jsx               #  셸: 헤더 + 4탭 + 드로어 + 코트시트
│  ├─ ViewerApp.module.css        #  WEPLAY 다크/라이트 토큰 + 전 화면 스타일
│  ├─ tabs/ LiveTab · VodTab · ScheduleTab · MyTab
│  ├─ components/ AppHeader · BottomNav · Drawer · CourtCard · CourtSheet
│  └─ data/mockData.js            #  목업 + // TODO(backend) 엔드포인트 표시
│
├─ features/admin/                # 관리자/운영 콘솔 — PC
│  ├─ AdminLayout.jsx             #  공용 셸(헤더 + 사이드바 + 본문 슬롯)
│  ├─ AdminConsole.module.css     #  콘솔 다크/라이트 토큰 + 전 화면 스타일
│  ├─ AdminConsole.jsx            #  대시보드(협회/대회 목록)
│  ├─ EventConsole.jsx            #  대회 상세/운영 + 우측 중계로그 패널
│  ├─ BroadcastConsole.jsx        #  중계 방송 현황(코트별 OBS/시청자)
│  ├─ SwitcherConsole.jsx         #  중계 컨트롤룸(vMix식 멀티캠 + 키보드 단축키)
│  └─ OverlayManager.jsx          #  광고/오버레이 관리(위치·다중광고·휴식 플레이리스트)
│
└─ features/ads/                  # 관객용 광고/후원사 화면
   └─ SponsorScreen.jsx

apps/web/public/brand/           # 실제 로고 자산(WEPLAY 워드마크 white/navy/color, 아이콘, KRSA)
```

---

## 3. 화면 / 라우트

| 영역 | 라우트 | 설명 | 데이터 |
|---|---|---|---|
| 사용자 앱 | `/app/:eventCode` | 실제 대회(백엔드 이벤트). 4탭 | API(이벤트) + 탭별 목업 |
| 사용자 앱(데모) | `/app/demo` | 백엔드 없이 미리보기. `?tab=live\|vod\|cal\|my`, `?theme=light` | 목업 |
| 관리자 대시보드(데모) | `/console` | 협회/대회 목록 콘솔 | 목업 |
| 대회 상세/운영(데모) | `/console/event` | KPI·코트현황·히트 + 중계로그 패널 | 목업 |
| 중계 방송(데모) | `/console/broadcast` | 코트별 송출/OBS 상태 | 목업 |
| 중계 컨트롤룸(데모) | `/console/switcher` | 멀티캠 전환·휴식 송출 (키보드 지원) | 목업 |
| 광고/오버레이(데모) | `/console/overlay` | 오버레이 위치·다중광고·휴식 플레이리스트 | 목업 |
| 경기 진행(데모) | `/console/runner` | 히트 준비/시작/종료/다음자동 + R·S·E·N 단축키 | 목업 |
| 대진표·일정(데모) | `/console/brackets` | 종목별 시작 HIT 번호 편집 + 범위 자동계산 | 목업 |
| 참가자(데모) | `/console/participants` | 검색·체크인 토글·KPI | 목업 |
| 통계(데모) | `/console/stats` | KPI + 종목/요일 막대차트 | 목업 |
| 설정(데모) | `/console/settings` | 대회 정보·테마·알림·로고 | 목업 |
| 광고/후원사(데모) | `/sponsors` | 관객용 배너·후원사·KRSA | 목업 |
| 대회 상세(데모) | `/competition/demo` | 요강·종목·계좌복사 + 접수 CTA | 목업 |
| 접수 신청(데모) | `/apply/demo` | 토스식 단계형 + 완료/상태 타임라인 | 목업 |
| 대회 관리(실제) | `/admin/events` | 실제 대회 목록 (로그인 필요) | **API** `getEvents` |

> `/console/*`·`/sponsors`·`/app/demo` 는 **디자인 데모**(목업)라 백엔드 없이 열립니다. 버튼은 화면 이동 위주로 연결돼 있고, 실제 기능(저장·제어)은 백엔드 연결 시 활성화됩니다.

---

## 4. 백엔드 연결 방법 (정석님)

1. API 클라이언트는 기존 `src/services/api.js` (base `/api/v1`) 그대로 사용.
2. 각 화면은 지금 `data/mockData.js` 목업을 쓰며, 교체 지점마다 **`// TODO(backend)`** 주석이 있음.
   예) `ScheduleTab` → 대회일정 API, `VodTab` → `GET /public/events/{code}/clips`, `MyTab` → `/me/*`.
3. 그 한 줄(목업 import)을 `await api.xxx()` 호출로 바꾸면 연결됨. UI/상태 구조는 그대로 유지.
4. 컨트롤룸/광고의 "전환·저장·송출" 같은 동작도 핸들러 안에서 해당 API를 호출하면 됨(현재는 프론트 상태만 변경).

---

## 5. 실행

```
cd apps/web
npm install      # 최초 1회
npm run dev      # http://localhost:20102
```

라이트/다크: 화면 우하단 🌙/☀️ 토글, 또는 주소 뒤 `?theme=light`.

---

## 6. 중계 컨트롤룸 키보드 단축키 (`/console/switcher`)

`← →` 코트 선택 · `1·2·3` 카메라 미리보기(PVW) · `Enter`/`Space` 전환(TAKE) · `T` 전체 전환 · `B` 휴식 송출.
(단축키·UI는 프론트엔드. 실제 카메라/OBS 제어 명령만 백엔드 연결 필요.)

---

## 7. 남은 작업 (TODO)

- 광고/오버레이: 영상 재생·스크롤 티커 실제 송출, 저장→백엔드.
- 히트 라이프사이클(준비/시작/종료/다음 자동) + 키보드 단축키, 대진표(종목별 시작 heat 번호 편집).
- 참가자/대진·일정 콘솔, 나머지 관리자 페이지 콘솔화.
- 모바일 앱(Capacitor) 빌드, 실데이터 연결, 색감 미세 조정(라이트 회색 등).
