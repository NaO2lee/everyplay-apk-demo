# 이슈 리스트 — everyone-play-safety

작성일: 2026-04-15
검사 방식: 3회 전수검사 (1차 API 호출 정합성, 2차 데이터 정합성, 3차 런타임/논리)
총 발견: **BUG 17건, WARN 16건 (총 33건)**

상태 표기: 🔴 critical / 🟠 high / 🟡 medium / 🟢 low
진행 표기: `[ ]` 미수정, `[x]` 수정 완료, `[→]` 진행 중, `[~]` 부분 수정

---

## 🔴 Critical

- [x] **C1. `requirements.txt` 에 `email-validator` 누락** — `schemas/auth.py:4` 의 `EmailStr` import 실패 가능. 운영 환경에 우연히 설치된 상태에서만 동작.
- [x] **C2. 관리자 엔드포인트 전면 무인증** — `/events`, `/courts/*/obs-config`, `/obs/*`, `/heats/*` 모두 `verify_token` 의존성 없음. 함수는 정의돼있지만 사용처 없음.
- [ ] **C3. `admin/admin` 기본 크리덴셜** — `auth.py:12-13` 환경변수 미설정 시 자동 통과. `.env.example`에도 누락.
- [x] **C4. DB 패스워드 소스 하드코딩** — `core/config.py:11` `mysql+aiomysql://root:weplay08*@localhost...`
- [x] **C5. `clip-worker/requirements.txt` 의존성 부족** — `app.models` 로드 연쇄로 `pydantic-settings`, `python-jose`, `passlib` 필요한데 누락 → ImportError.

---

## 🟠 High (기능 오동작)

- [x] **H1. `api.js:161 this.getToken()` 미정의** — CSV 업로드 즉시 TypeError. `ParticipantList.jsx:120` 에서 호출.
- [x] **H2. `CourtResponse` 에서 `obs_password` 제외되지만 프론트가 이를 읽어 `obs_configured` 재계산** — 재로드 후 뱃지 사라짐.
- [x] **H3. `HeatResponse` 에 `recording_offset_start/end` 누락** — 계산하고 저장하지만 응답에 미포함.
- [x] **H4. `/heats/{heat_id}/notify` 라우트 중복** — `heats.py:174` 와 `notifications.py:21`. 시그니처 불일치로 프론트 호출 시 422 가능.
- [x] **H5. `stop_event_operation` 이 `recording_started_at`/`stream_started_at` 리셋 안 함** — 재운영 시 오프셋 오염.
- [x] **H6. 운영 시작 없이 히트 시작·종료 시 `clip_status=pending` 조건부 설정 안 됨** — 클립 조용히 누락.
- [x] **H7. `start_event_operation` 부분 실패 시 롤백 없음** — 일부 코트만 녹화 진행되는 일관성 깨짐.
- [x] **H8. `clip_status` 값 불일치** — 코드 일부 `"done"`, 워커 `"ready"`, 모델 주석 `ready/sent`. `clip_service.py:50` 점검 필요.
- [x] **H9. Overlay SSE 엔드포인트 DB 세션 누수** — `Depends(get_db)` 를 SSE 연결 동안 점유.
- [x] **H10. `Dashboard.jsx` `activeHeats` 로컬 state** — F5 시 유실 → 중복 히트 생성 위험.
- [x] **H11. `obs/client.py` `stop_record` 응답 속성명 추정 오류** — `output_path` vs `outputPath` (obsws-python 실제 응답 확인 필요).
- [x] **H12. `clip-worker/worker.py` 코트 필터 + atomic 락 부재** — 다중 워커 실행 시 같은 히트 처리 경합.
- [x] **H13. `Home.jsx:54`, `PublicNav.jsx` 에 정의 안 된 라우트 navigate** — `/events/:eventCode`, `/scoreboard/*`, `/viewer/*`, `/results/*` 모두 `App.jsx` 에 없음.

---

## 🟡 Medium (정확도 / UX)

- [x] **M1. YouTube URL 파싱 단순 split** — `heat_service.py:109` `.split("/")[-1]` 이 `watch?v=abc` 형태에서 깨짐.
- [x] **M2. `clip_service.py:20` `mkdir(parents=False, exist_ok=True)`** — 중첩 경로 지정 시 import 단계에서 실패.
- [x] **M3. `CLIP_URL_PREFIX` 미설정 시 로컬 경로가 SMS 본문에 노출** — 절대 경로 leak.
- [x] **M4. `event_service.py` 의 `get_event_by_code` 중복 정의** — 48행과 77행, 동일 본문.
- [x] **M5. `save_overlay_config` 엔드포인트 인증 + 입력 타입 검증 부재** — 관리자 엔드포인트가 무인증.
- [x] **M6. 참가자 CSV bulk import 부분 실패 시 rollback 없음** — 실패 row가 session에 남아 IntegrityError.
- [x] **M7. `get_db()` 가 yield 후 자동 commit** — HTTPException 발생 시 의도치 않은 부분 commit.
- [x] **M8. `auth.py` `active_tokens` 프로세스 메모리** — 재시작 시 전 사용자 로그아웃, 멀티 워커 시 401.
- [x] **M9. CSV 업로드 파일 크기 제한 없음** — DoS 가능.
- [x] **M10. `Dashboard.jsx` OBS 폴링 실패 조용히 무시** — 네트워크 다운 시 사용자 모름.
- [x] **M11. 운영 시작 중간 실패 시 이미 연결된 OBS 끊는 보상 로직 없음** — 부분 연결 상태.

---

## 🟢 Low (클린업 / UX)

- [x] **L1. Dead code: `HeatControlPanel.jsx`** — import 안 되는 컴포넌트.
- [x] **L2. Dead code: `eventStore.js`, `heatStore.js`** — 사용 안 되는 store.
- [x] **L3. Dead code: `PublicNav.jsx`** — 사용 안 됨.
- [x] **L4. `.env.example` 이 PostgreSQL URL + 다수 키 누락** — 코드와 불일치.
- [x] **L5. `/tmp/` 고정 경로** — Windows 실행 불가. `audit.py`, `clip_service.py`.
- [x] **L6. `alert()`/`confirm()`/`prompt()` 광범위 사용** — 운영 UI 부적절.
- [x] **L7. `Dashboard.jsx` 히트 시작이 `prompt()` 입력** — NaN 가능.
- [x] **L8. lucide-react 미사용 import 다수** — lint 경고 수준.
- [x] **L9. `EventInfo.jsx:80` "스트림 키 설정 초기화" 문구 잔재** — v2 잔재.
- [x] **L10. `notifications.py` 클립 URL 미지원** — `youtube_link` 에만 의존.

---

## 진행 상황

- 3회 검사 완료: 2026-04-15 12:00
- 이슈 리스트 작성: 2026-04-15 12:30
- Critical 수정 진행: 시작 대기

## 수정 순서

1. C1 → C5 (Critical 5건, 예상 30분)
2. H1 → H13 (High 13건, 예상 2시간)
3. M1 → M11 (Medium, 행사 전)
4. L1 → L10 (Low, 행사 후)
