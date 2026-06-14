# 백엔드 연동 가이드 — dev_front 프론트엔드 통합

> 대상: 백엔드 담당자. 7월 프론트엔드 작업(`dev_front`)을 5월 시스템(`dev`)에 합치는 방법 + API 연결 지점.
> 핵심: **`dev_front`는 `dev`의 깨끗한 후손(fast-forward)** — 충돌 없음, 전부 추가(additive).

---

## 1. 병합 (충돌 없음)

- 레포: `weplay21c/platform_test` · 통합 브랜치 `dev` · 작업 브랜치 `dev_front`
- 관계: `dev_front`는 `dev` 기준 **0 behind / 19 ahead** (merge-base == dev HEAD). → **fast-forward 병합, 충돌 0.**
- 바뀐 파일 55개 = **전부 신규 추가 + 디자인 파일**. 5월 기능 로직(.py·기존 페이지 동작)은 **건드리지 않음**.

```bash
git fetch
git switch dev && git merge --ff-only origin/dev_front   # 또는 GitHub PR(dev_front→dev) 머지
```

> 기존 5월 페이지(JudgeGrid·OperatorPanel·Scoreboard·Dashboard 등)는 **그대로 살아있음**. 새 화면은 별도 라우트로 추가됨(아래). 즉, 합쳐도 5월 동작은 안 깨짐 → **머지부터 안전하게 하고, API는 화면별로 점진 연결**하면 됨.

---

## 2. 폴더 구조 (추가된 것)

```
apps/web/src/
├─ App.jsx                  # 라우트만 추가 (기존 라우트 유지)
├─ main.jsx                 # 첫 페인트 테마 적용 1줄 추가
├─ styles/theme.css         # ★ 전역 디자인 토큰 + Tailwind 콘솔 스킨 (신규)
├─ components/ThemeToggle.jsx
├─ services/api.js          # ★ 변경 없음 (기존 그대로 사용)
└─ features/                # ★ 신규 화면은 전부 여기 (역할별)
   ├─ viewer/               # 사용자 앱 (라이브/VOD/일정/MY/응원채팅)
   ├─ competition/          # 대회 상세 · 접수신청
   ├─ ads/                  # 관객 광고/후원사
   ├─ admin/                # 콘솔(대시보드/대회/중계/광고/경기진행/대진/참가자/통계/설정/시상/OBS)
   ├─ judge/                # 심판 채점
   ├─ operator/             # AI 음성 호명
   └─ scoreboard/           # 전광판(TV)
```

- 각 feature = `XxxScreen.jsx` + `Xxx.module.css`(CSS Module, 스타일 격리). 공통 셸 = `features/admin/AdminLayout.jsx`.
- 데이터: 화면은 임시 **mock**(`features/viewer/data/mockData.js` 등)을 쓰고, 교체 지점마다 **`// TODO(backend)`** 주석.

---

## 3. 추가된 라우트

| 라우트 | 화면 | 데이터 상태 |
|---|---|---|
| `/app/:eventCode` | 사용자 앱(4탭) | 이벤트=API, 탭=mock |
| `/app/demo` | 앱 데모(백엔드 불필요) | mock |
| `/competition/demo` `/apply/demo` | 대회상세·접수 | mock |
| `/sponsors` | 광고/후원사 | mock |
| `/console` `…/event` `…/broadcast` `…/switcher` `…/overlay` `…/runner` `…/brackets` `…/participants` `…/stats` `…/settings` `…/awards` `…/stations` | 관리자 콘솔 | mock(데모) |
| `/judge-app` | 심판 채점 | **실 API** (기존 엔드포인트) |
| `/operate-app` | AI 음성 호명 | **실 API** (기존 엔드포인트) |
| `/scoreboard-demo` | 전광판 | mock(데모) |

> 기존 5월 라우트(`/judge-grid`·`/operate`·`/admin/...` 등)는 **그대로 유지**.

---

## 4. API 연결 지점 (코드의 `// TODO(backend)`)

이미 기존 `services/api.js` + `/api/v1` 사용. 화면별 교체 지점:

| 화면 | mock → 연결할 API |
|---|---|
| viewer ScheduleTab | 대회 일정 API (또는 협회 수집) |
| viewer VodTab | `GET /public/events/{code}/clips` |
| viewer MyTab | `GET /me`, `/me/records`, `/me/heats`, `/me/clips`, `/me/practice` |
| viewer CourtSheet(응원·경기정보) | SSE heat 데이터 + 채팅(SSE/WS) |
| competition Detail/Apply | 대회 상세 API · 접수 신청 API(+담당자 메일/상태) |
| admin AwardsConsole | `/api/v1/awards/from-heat`, `/awards/event/{id}`, transition |
| admin StationConsole | `api.setStationObsConfig` (obs_host/port/pw·youtube) |
| admin BracketConsole | programs/heat 배정 API |
| scoreboard | 이벤트 stations + 코트별 SSE(`/overlay/sse?station=`) |
| **judge `/judge-app`** | **이미 연결**: `/api/v1/judge/scores`, `/events/{id}/heats`, 오프라인 큐 |
| **operator `/operate-app`** | **이미 연결**: `/api/v1/operator/no-shows`, `handled`, TTS |

> judge·operator는 5월 로직을 그대로 가져와 **바로 동작**(로그인 토큰 필요). 나머지 콘솔/뷰어는 mock → 위 API로 한 줄씩 교체.

---

## 5. 실행

```bash
cd apps/web && npm install && npm run dev   # http://localhost:20102
```
- 백엔드 없이 보려면: `/app/demo`, `/console`, `/scoreboard-demo`, `/sponsors` (mock).
- 다크/라이트: 우하단 🌙/☀️ 또는 `?theme=light`.

---

## 6. 요약 (담당자께)

1. **`dev_front` → `dev` fast-forward 머지** (충돌 없음, 5월 동작 안 깨짐).
2. 새 화면은 `features/*` + 새 라우트로 **추가만** 됨.
3. judge·operator는 기존 API라 바로 됨. 나머지는 `// TODO(backend)` 지점에서 mock을 `api.*` 호출로 교체.
4. 5월 기존 페이지는 살아있으니, **급한 7월 운영은 기존 페이지로 + 새 디자인 화면을 병행 전환** 가능.
