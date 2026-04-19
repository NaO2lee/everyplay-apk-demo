# QA Checklist — everyone-play-safety

> 목적: 종팔 삼촌이 혼자 테스트를 돌려도 결과를 Claude(개발자)가 사후에 파일·로그·DB로 검증할 수 있도록 증적을 남긴다.

**작성일:** 2026-04-15
**대상 버전:** everyone-play-safety Day 2 (OBS 기반 MVP)
**테스트 대상 백엔드:** `http://localhost:20003`
**테스트 대상 DB:** `everyoneplay_safety` (MySQL)

---

## 사용 방법

1. 각 테스트 케이스를 순서대로 실행
2. **[체크]** 항목은 실제로 돌린 후 ✅/❌/⏭️ (스킵)으로 표시
3. **[비고]** 에 실패·의외 현상을 간단히 메모
4. 테스트 끝나면 이 파일을 저장하고 디스코드에 알림 → Claude가 증적 경로를 직접 확인

---

## 환경 사전 준비 (Precheck)

### P1. 백엔드 기동 확인
- [ ] `curl http://localhost:20003/api/v1/health` → `{"status":"healthy","database":"connected",...}`
- **증적 경로:** `/tmp/safety-api.log` (uvicorn 로그)
- **비고:**

### P2. DB 존재 확인
- [ ] `mysql -u root -p -e "USE everyoneplay_safety; SHOW TABLES;"` → events, courts, heats, participants, notifications, users 등 테이블 목록
- **증적 경로:** MySQL 쿼리 결과
- **비고:**

### P3. OBS Studio 설치·WebSocket 활성화
- [ ] OBS 28+ 설치됨
- [ ] OBS 메뉴: 도구 → WebSocket 서버 설정 → 활성화 체크 + 포트 4455 + 비밀번호 설정
- [ ] OBS 종료하지 말고 실행 상태 유지
- **증적 경로:** OBS 실행 상태 스크린샷 (선택)
- **비고:**

### P4. 테스트 PC IP 확인
- [ ] Windows: `ipconfig` 실행 → LAN IPv4 주소 기록
- [ ] 기록된 IP: `__________`
- **비고:**

---

## 1. API 단위 테스트 (CRUD)

### T1.1. 이벤트 생성
- [ ] `curl -X POST http://localhost:20003/api/v1/events -H "Content-Type: application/json" -d '{"name":"QA 테스트","date":"2026-05-02","court_count":3}'`
- **기대:** `success: true`, `data.id`, `data.event_code` (EP2026-XXX), `data.courts` 3개 자동 생성
- **증적 경로:**
  - API 응답의 `event_code` 값을 기록: `__________`
  - DB: `SELECT id, name, event_code, court_count FROM events WHERE name='QA 테스트';`
- **비고:**

### T1.2. 참가자 CSV 업로드
- [ ] 샘플 CSV 준비 (이름, 전화번호, 팀, 카테고리 등 한글 헤더)
- [ ] `curl -X POST http://localhost:20003/api/v1/events/{event_id}/participants/bulk -F "file=@sample.csv"`
- **기대:** `imported` 수량이 CSV 행 수와 일치
- **증적 경로:** `SELECT COUNT(*) FROM participants WHERE event_id='{event_id}';`
- **비고:**

### T1.3. 이벤트 목록 조회
- [ ] `curl http://localhost:20003/api/v1/events` → QA 테스트 이벤트가 items에 포함
- **비고:**

---

## 2. 코트 OBS 설정

### T2.1. OBS 설정 저장
- [ ] `curl -X PUT http://localhost:20003/api/v1/courts/{court_id}/obs-config -H "Content-Type: application/json" -d '{"obs_host":"실제IP","obs_port":4455,"obs_password":"설정한비번","youtube_stream_url":"https://youtube.com/live/test"}'`
- **기대:** `data.obs_configured: true`
- **증적 경로:** `SELECT id, court_number, obs_host, obs_port, obs_password FROM courts WHERE id='{court_id}';`
- **비고:**

### T2.2. 클라이언트 재로드
- [ ] `curl -X POST http://localhost:20003/api/v1/obs/reload` → `data.registered: 1` (또는 설정한 코트 수)
- **비고:**

### T2.3. OBS 연결 시도 (실제 OBS 필요)
- [ ] `curl -X POST http://localhost:20003/api/v1/obs/courts/{court_id}/connect` → `data.connected: true`
- **실패 시:** `last_error` 메시지를 비고에 기록
- **증적 경로:** `curl http://localhost:20003/api/v1/obs/status` 응답 JSON 전체 저장
- **비고:**

---

## 3. OBS 녹화·스트리밍 제어

### T3.1. 이벤트 운영 시작
- [ ] 최소 1 코트가 `obs_configured=true` 이고 `connected=true` 상태
- [ ] `curl -X POST http://localhost:20003/api/v1/obs/events/{event_id}/start`
- **기대:** 각 코트가 녹화·스트리밍 시작. 응답 `data.results[{court_id}].recording: true`
- **증적 경로:**
  - OBS Studio에서 녹화 버튼이 켜지고 타이머가 돌아가야 함
  - `SELECT id, court_number, recording_started_at, status FROM courts WHERE event_id='{event_id}';` — recording_started_at이 NULL 아니어야 함
- **비고:**

### T3.2. OBS 상태 폴링
- [ ] `curl http://localhost:20003/api/v1/obs/status` → recording: true, streaming: true
- **비고:**

### T3.3. 이벤트 운영 종료
- [ ] `curl -X POST http://localhost:20003/api/v1/obs/events/{event_id}/stop`
- **기대:** `results[{court_id}].recording_path` 에 OBS 녹화 파일 경로 반환
- **증적 경로:**
  - `SELECT recording_path FROM courts WHERE event_id='{event_id}';`
  - 실제 파일이 해당 경로에 존재하는지 Windows 탐색기로 확인
  - 파일 크기가 0이 아니어야 함
- **비고:**

---

## 4. 히트 lifecycle (타임스탬프 기록)

### T4.1. 히트 시작
- [ ] (운영 시작 상태에서) `curl -X POST http://localhost:20003/api/v1/courts/{court_id}/heats/start -d '{"heat_number":1,"participant_ids":[]}'`
- **기대:** `data.id`, `data.started_at`
- **증적 경로:**
  - `SELECT id, heat_number, started_at, recording_offset_start FROM heats WHERE court_id='{court_id}' ORDER BY started_at DESC LIMIT 1;`
  - `recording_offset_start`가 숫자여야 함 (NULL ❌)
  - 숫자가 0에 가깝거나 양수여야 함
- **비고:**

### T4.2. 히트 종료
- [ ] `curl -X POST http://localhost:20003/api/v1/heats/{heat_id}/end`
- **기대:** `data.ended_at`, `data.clip_status: pending`
- **증적 경로:** `SELECT ended_at, recording_offset_end, clip_status FROM heats WHERE id='{heat_id}';`
- **비고:**

### T4.3. 여러 히트 연속 처리
- [ ] 코트 1개에 히트 3개 연속 진행 (시작 → 10초 경과 → 종료 × 3회)
- [ ] 각 히트 간격 5초 이상
- **증적 경로:** `SELECT heat_number, started_at, ended_at, recording_offset_start, recording_offset_end FROM heats WHERE court_id='{court_id}' ORDER BY heat_number;`
- **비고:**

---

## 5. 오버레이 (SSE)

### T5.1. overlay.html 브라우저에서 로드
- [ ] Chrome에서 `file:///.../apps/overlay/overlay.html?court={court_id}&api=http://localhost:20003` 접속
- **기대:** 좌상단에 "코트 N", 우하단에 타이머 "00:00.00" 표시
- **증적 경로:** 스크린샷 1장 저장 → `/tmp/overlay_idle.png` 등
- **비고:**

### T5.2. 히트 시작 시 오버레이 반영
- [ ] overlay.html 열린 상태에서 T4.1을 실행
- **기대:** 오버레이에 즉시 "LIVE" 뱃지 + "HIT 1" + 참가자 이름 + 타이머 동작
- **증적 경로:** 스크린샷 1장 → `/tmp/overlay_live.png`
- **비고:**

### T5.3. OBS 브라우저 소스로 overlay 로드
- [ ] OBS → 소스 추가 → 브라우저 → URL에 overlay.html 경로, 1920x1080
- [ ] OBS 미리보기 화면에서 카메라 영상 위에 오버레이 합성 확인
- **증적 경로:** OBS 전체화면 스크린샷 → `/tmp/obs_preview.png`
- **비고:**

### T5.4. 구독자 수 확인
- [ ] `curl http://localhost:20003/api/v1/overlay/status` → `data.courts.{court_id}: 1` (1명 구독 중)
- **비고:**

---

## 6. 클립 추출

### T6.1. 클립 워커 기동
- [ ] `CLIP_OUTPUT_DIR=/tmp/clips DATABASE_URL=mysql+aiomysql://root:weplay08*@localhost:3306/everyoneplay_safety python apps/clip-worker/worker.py`
- **기대:** "clip-worker 시작" 로그 출력, 5초 간격 폴링
- **증적 경로:** 터미널 출력 저장 → `/tmp/clip-worker.log`
- **비고:**

### T6.2. pending 히트 자동 처리
- [ ] T4.2에서 만든 히트 → 워커가 폴링 시 처리 → 파일 생성
- **기대:** `/tmp/clips/court{N}_heat{M}_*.mp4` 파일 생성
- **증적 경로:**
  - `ls -la /tmp/clips/`
  - `SELECT clip_path, clip_status FROM heats WHERE id='{heat_id}';` → `clip_status='ready'`, `clip_path`가 실제 경로
  - 파일을 Windows 미디어 플레이어로 열어서 재생되는지 확인
- **비고:**

### T6.3. 오프셋 정확도 검증
- [ ] 히트 종료 시각을 수동으로 측정 (예: 스톱워치로 10초 녹화 후 종료)
- [ ] 생성된 클립의 실제 길이 확인 (Windows 속성 → 자세히 → 길이)
- **기대:** 클립 길이 = 측정 시간 ±4초 이내 (앞뒤 2초 버퍼 때문)
- **비고:**

---

## 7. 웹 대시보드 (통합 UI 테스트)

### T7.1. dev 서버 기동
- [ ] `cd apps/web && npm run dev`
- [ ] 브라우저 `http://localhost:5173` 접속
- **비고:**

### T7.2. 이벤트 상세 → OBS 설정 탭
- [ ] 이벤트 클릭 → "코트설정" 탭
- [ ] 각 코트에 OBS Host/Port/비밀번호/YouTube URL 입력 → 저장
- [ ] "설정됨" 뱃지 표시 확인
- **비고:**

### T7.3. 운영 시작 버튼
- [ ] OBS 설정된 코트가 최소 1개 있으면 "운영 시작" 버튼 활성화
- [ ] 클릭 → 운영 대시보드로 자동 이동
- **증적 경로:** 개발자 도구 Network 탭에서 `/obs/reload`, `/obs/courts/{id}/connect`, `/obs/events/{id}/start` 호출 확인
- **비고:**

### T7.4. 운영 대시보드 폴링
- [ ] 대시보드에서 3초마다 OBS 상태가 갱신되는지 확인
- [ ] 코트 카드에 "연결됨", "LIVE", "● REC" 표시
- **비고:**

### T7.5. 히트 시작/종료 (UI에서)
- [ ] "히트 시작" 버튼 클릭 → 히트 번호 입력 → 히트 카드에 "HIT N" 표시
- [ ] "히트 종료" 버튼 클릭 → 상태 복귀
- **비고:**

### T7.6. 운영 종료
- [ ] "운영 종료" 버튼 → 확인 → 모든 코트 OBS 녹화 중지 → 이벤트 상세로 이동
- **비고:**

---

## 8. Google Drive · SMS (서비스 계정 준비 후)

### T8.1. Drive 서비스 계정 설정
- [ ] GCP 서비스 계정 JSON 파일 준비 → `.env`의 `GOOGLE_SERVICE_ACCOUNT_FILE` 경로 지정
- [ ] Google Drive 공유 폴더 생성 → 서비스 계정 이메일에 편집자 권한
- [ ] `.env`의 `GOOGLE_DRIVE_FOLDER_ID` 설정
- **비고:**

### T8.2. Drive 업로드 테스트
- [ ] 클립 워커가 파일 생성 후 자체적으로 Drive 업로드 시도 (향후 구현 예정, Day 3에 통합)
- [ ] 또는 `google_drive_service.py` 를 직접 import 해서 단독 업로드 테스트
- **증적 경로:** Drive 폴더에 파일 생성 확인 + `clip_url` 컬럼에 URL 저장 확인
- **비고:**

### T8.3. SMS 발송
- [ ] NHN Cloud 설정 (`NHN_APP_KEY`, `NHN_SECRET_KEY`, `SMS_SENDER_NUMBER`)
- [ ] `curl -X POST http://localhost:20003/api/v1/heats/{heat_id}/notify`
- **기대:** 참가자 전화번호로 실제 SMS 수신
- **증적 경로:** `SELECT * FROM notifications WHERE heat_id='{heat_id}';`
- **비고:**

---

## 9. 장애·복구 시나리오

### T9.1. OBS 강제 종료 감지
- [ ] 운영 중 OBS Studio를 강제 종료
- [ ] 10초 이내에 대시보드에 "연결 끊김" 표시가 나타나는지 확인
- **증적 경로:** `GET /obs/status` 응답의 `connected: false`
- **비고:**

### T9.2. 백엔드 재시작
- [ ] 운영 중 백엔드 uvicorn 프로세스 종료 후 재시작
- [ ] 재시작 후 `/obs/reload` 호출 → 클라이언트 다시 로드
- [ ] 기존 OBS와 재연결 되는지 확인
- **비고:**

### T9.3. 네트워크 끊김 시뮬레이션
- [ ] 와이파이 끄고 10초 후 다시 켜기
- [ ] OBS 연결 자동 복구 확인
- **비고:**

---

## 10. 성능·리소스

### T10.1. 3코트 동시 운영 CPU/메모리
- [ ] 실제 3 코트 + 3 OBS 동시 운영 중 작업관리자 확인
- [ ] 각 PC의 CPU 사용률 기록: `_______%`, 메모리: `_______ MB`
- **기대:** CPU 80% 미만 (GPU 인코더 사용 시)
- **비고:**

### T10.2. 30분 연속 운영
- [ ] 3 코트를 30분간 연속 운영 + 히트 10개 이상 처리
- **기대:** 드롭 프레임 < 1%, 클립 생성 모두 성공, 메모리 누수 없음
- **증적 경로:** 종료 후 백엔드 로그 `/tmp/safety-api.log` 에서 ERROR 검색
- **비고:**

---

## 종합 판정

- [ ] 모든 P (환경) 통과
- [ ] T1~T4 (API 및 코어 플로우) 통과
- [ ] T5~T7 (오버레이 + UI) 통과
- [ ] T6 (클립 추출) 통과
- [ ] T8 (Drive + SMS) 최소 1건 성공
- [ ] T9 (장애 복구) 검증
- [ ] T10 (성능) 기준 만족

**Day 3 테스트 완료 판정:** ☐ PASS / ☐ 조건부 PASS / ☐ FAIL

---

## 사후 증적 수집 방법 (종팔 삼촌이 Claude에게 전달할 것)

테스트 끝난 후 다음을 한번에 모아서 디스코드에 공유:

1. **이 파일 (QA_CHECKLIST.md)** — 체크박스·비고가 기록된 상태
2. **백엔드 로그** — `tail -500 /tmp/safety-api.log`
3. **DB 덤프 (간략)** — `mysqldump --no-create-info everyoneplay_safety events courts heats notifications > /tmp/qa_state.sql`
4. **생성된 클립 목록** — `ls -la /tmp/clips/`
5. **Windows 탐색기 스크린샷** — 녹화 파일 존재, 크기 확인용
6. **스크린샷 3장** — overlay.html idle, overlay.html live, OBS 브라우저 소스 합성

위 자료만 있으면 Claude가 사후에 전 과정 재검증 가능.
