# ARCHITECTURE — everyone-play-safety

문서 버전: 0.1
작성일: 2026-04-13

---

## 1. 핵심 원칙

1. **하드웨어 추상화는 OBS에 위임한다** — 카메라/오디오/GPU 인코더/캡처카드는 OBS가 처리. 우리는 다루지 않는다.
2. **네트워크는 신뢰할 수 없다** — 모든 장비 사이 통신은 재시도/타임아웃/상태확인을 전제로 설계.
3. **단일 코트 장애가 전체를 멈추지 않는다** — 코트별 격리.
4. **상태는 즉시 영속화한다** — 히트 시작/종료 시각, OBS 녹화 시작 시각 등 메타데이터는 발생 즉시 DB 커밋.
5. **운영자가 비개발자임을 가정한다** — 에러 메시지는 한국어, 다음 액션이 명확해야 함.

---

## 2. 시스템 다이어그램

```
                  ┌──────────────────────────┐
                  │   관리자 대시보드        │
                  │   (React + Vite)         │
                  │   - 이벤트/코트/참가자    │
                  │   - 히트 시작/종료        │
                  │   - OBS 상태 모니터링    │
                  └────────────┬─────────────┘
                               │ HTTP/SSE
                               ▼
            ┌──────────────────────────────────────┐
            │      백엔드 API (FastAPI)             │
            │  ─────────────────────────────────   │
            │  • REST: 이벤트/코트/히트/참가자     │
            │  • OBS WebSocket Client (코트당 1)    │
            │  • SSE: 오버레이 실시간 업데이트      │
            │  • 클립 추출 큐                       │
            │  • SMS 발송 (NHN Cloud)               │
            └────┬──────────────┬───────────┬──────┘
                 │              │           │
       OBS WS(1) │     DB(2)    │  HTTP(3)  │ SSE(4)
                 │              │           │
                 ▼              ▼           ▼
        ┌────────────┐  ┌───────────┐  ┌──────────────┐
        │ OBS Studio │  │ MySQL DB  │  │ overlay.html │
        │ (코트별 1) │  │           │  │ (정적 HTML)  │
        └─────┬──────┘  └───────────┘  └──────┬───────┘
              │                               │
        스트리밍                          OBS 브라우저 소스로 로드
              │                               │
              ▼                               ▼
        ┌──────────┐                  ┌──────────────┐
        │ YouTube  │                  │  OBS Studio  │
        │ Live     │                  │ (같은 PC)    │
        └──────────┘                  └──────────────┘

                ┌─────────────────────────┐
                │  Clip Worker (Python)    │
                │  - 히트 종료 트리거      │
                │  - OBS 녹화 파일 읽기    │
                │  - FFmpeg cut            │
                │  - SMS 발송 트리거       │
                └─────────────────────────┘
```

---

## 3. 컴포넌트 책임

### 3.1 백엔드 API (`apps/api`)

기존 `everyone-play_v2.0/apps/api`에서 가져와 단순화.

**유지:**
- DB 모델 (Event, Court, Participant, Heat)
- REST 엔드포인트 (이벤트/코트/참가자/히트 CRUD)
- CSV 일괄 업로드
- 히트 lifecycle 관리

**삭제:**
- 워커 WebSocket 매니저
- FFmpeg 스트림 컨트롤
- GPU 인코더 감지
- dshow/avfoundation 분기
- NDI 처리
- 캡처카드 중복 처리
- `/streams/`, `/workers/` 엔드포인트 일체

**신규:**
- `obs/client.py` — OBS WebSocket 클라이언트 (코트당 1개 인스턴스 풀)
- `obs/manager.py` — 모든 코트 OBS 연결 관리, 상태 broadcast
- `services/heat_lifecycle.py` — 히트 시작/종료 시 OBS 명령 + 타임스탬프 기록 동시 처리
- `api/v1/overlay.py` — 오버레이 페이지가 polling/SSE 하는 엔드포인트
- `api/v1/obs.py` — OBS 상태 조회 엔드포인트

### 3.2 관리자 대시보드 (`apps/web`)

기존 `everyone-play_v2.0/apps/web`에서 가져와 단순화.

**유지:**
- 이벤트/코트/참가자 관리 UI
- 히트 시작/종료 버튼
- CSV 업로드 UI

**삭제:**
- 워커 매핑 / 카메라 선택 UI
- 스트림 키 입력 UI
- 워커 연결 상태 표시
- 비트레이트/해상도 설정

**신규:**
- OBS 상태 카드 (각 코트별)
- OBS 연결 끊김 경고 배지
- 히트 진행 시간 (OBS 녹화 기준)

### 3.3 오버레이 페이지 (`apps/overlay`)

**완전 신규.** React 대시보드와 분리된 정적 HTML.

- 단일 파일 `overlay.html` + `overlay.css` + `overlay.js`
- URL 파라미터: `?court=<id>` (어느 코트인지)
- 백엔드 SSE 구독: `/api/v1/overlay/sse?court=<id>`
- 표시 요소: 코트 라벨, 진행 상태 뱃지, 히트 번호, 선수 정보, 타이머
- OBS 브라우저 소스가 로드 (1920x1080 투명 배경)

### 3.4 클립 워커 (`apps/clip-worker`)

**신규.** Python 단일 파일 스크립트.

- 백엔드에서 히트 종료 시 작업 큐 push (DB 테이블 또는 Redis)
- 워커가 큐에서 작업 가져와서 처리:
  1. 히트의 OBS 녹화 파일 경로 확인
  2. OBS 녹화 시작 시각 기준 오프셋 계산 (`heat_started - obs_recording_started`)
  3. FFmpeg `-ss <시작> -to <종료> -c copy <input> <output>`
  4. 결과 파일을 정해진 디렉토리에 저장
  5. 백엔드 API에 클립 준비 완료 통지
  6. 백엔드가 SMS 발송 트리거

### 3.5 OBS Studio (외부 의존성)

각 코트 PC에 1개씩 설치.

- **버전:** 28+ (WebSocket 5.x 내장)
- **설정:**
  - 비디오: 1920x1080, 30fps
  - 출력: 6000kbps, h264 (HW encoder는 OBS가 자동 선택)
  - 녹화: MKV (안전성), 같은 인코더 재사용
  - 소스: 비디오 캡처 1개 (카메라/캡처카드) + 브라우저 소스 1개 (오버레이)
  - 스트리밍: YouTube RTMP, 코트별 다른 스트림키
- **WebSocket:** 활성화, 비밀번호 설정, 백엔드만 접근

---

## 4. 데이터 모델

기존 스키마를 거의 그대로 사용. 변경/추가는 다음:

### Event (변경 없음)
- id, name, date, status, event_code, ...
- overlay_config (JSON) — 색상/폰트 등 오버레이 스타일

### Court (단순화)
**제거:** stream_key, rtmp_url, worker_id, device_path, device_name
**추가:**
- `obs_host` (str) — OBS WebSocket 호스트 (예: `192.168.0.10`)
- `obs_port` (int) — 기본 4455
- `obs_password` (str) — WebSocket 비밀번호
- `youtube_stream_url` (str, 시청자용) — 기존 유지
- `recording_path` (str) — 마지막 OBS 녹화 파일 경로 (런타임 갱신)
- `recording_started_at` (datetime) — OBS가 녹화 시작한 시각 (오프셋 계산 기준)

### Heat (확장)
**기존:** id, court_id, heat_number, participant_id, started_at, ended_at, status
**추가:**
- `recording_offset_start` (float, seconds) — OBS 녹화 시작 기준 시작 오프셋
- `recording_offset_end` (float, seconds) — OBS 녹화 시작 기준 종료 오프셋
- `clip_path` (str) — 추출된 클립 파일 경로
- `clip_status` (enum) — pending/processing/ready/failed/sent
- `sms_sent_at` (datetime)
- `sms_status` (enum) — pending/sent/failed

### Participant (변경 없음)
- id, event_id, name, team, phone, ...

---

## 5. 핵심 흐름

### 5.1 행사 시작 흐름

1. 운영자가 대시보드에서 이벤트 선택
2. 코트 6개의 OBS 연결 상태 확인 (모두 ✅이어야 진행 가능)
3. "운영 시작" 버튼 클릭
4. 백엔드가 모든 코트의 OBS에 동시 명령:
   - 녹화 시작
   - 스트리밍 시작
5. 각 OBS가 응답한 녹화 시작 시각을 DB의 `Court.recording_started_at`에 저장
6. 대시보드가 "운영 중" 상태로 전환

### 5.2 히트 운영 흐름

1. 운영자가 코트 N에서 다음 참가자 선택 → "히트 시작" 클릭
2. 백엔드:
   - `now()` 시각 기록
   - `Heat` 생성: `started_at = now`, `recording_offset_start = (now - court.recording_started_at)` (초)
   - 오버레이 SSE로 히트 정보 broadcast
3. 오버레이 페이지가 즉시 갱신 → OBS 화면에 반영
4. 경기 진행 (운영자 대시보드에서 진행 시간 카운터 표시)
5. 운영자가 "히트 종료" 클릭
6. 백엔드:
   - `Heat.ended_at = now`, `recording_offset_end = (now - court.recording_started_at)`
   - 오버레이 SSE로 종료 상태 broadcast
   - 클립 추출 큐에 작업 등록 (`heat_id`)

### 5.3 클립 추출 및 발송 흐름

1. 클립 워커가 큐에서 `heat_id` 가져옴
2. Heat 정보 조회 → court의 `recording_path` + `recording_offset_start/end` 확인
3. FFmpeg 실행:
   ```
   ffmpeg -ss <offset_start> -to <offset_end> -i <recording_path> -c copy <clip_path>
   ```
4. 성공 시 `Heat.clip_path` 저장, `clip_status = ready`
5. 백엔드 API 호출 → SMS 발송 트리거
6. SMS 본문 생성 + NHN Cloud API 호출
7. `Heat.sms_status = sent`, `sms_sent_at = now`

### 5.4 행사 종료 흐름

1. 운영자가 "운영 종료" 클릭
2. 백엔드가 모든 OBS에 녹화 중지 + 스트리밍 중지 명령
3. 미발송 클립이 있으면 처리 완료 대기
4. 모든 클립 처리 완료 후 운영 종료 마킹

---

## 6. 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 백엔드 | FastAPI (Python 3.11+) | 기존 코드 재사용, 비동기 처리 |
| DB | MySQL 8 (또는 PostgreSQL) | 기존 스택 유지, JSON 컬럼 지원 |
| ORM | SQLAlchemy 2 + Alembic | 기존 마이그레이션 재사용 |
| 프론트 | React 18 + Vite + TS | 기존 컴포넌트 재사용 |
| OBS 연동 | obsws-python (WebSocket 5.x) | OBS 28+ 공식 표준 |
| 클립 처리 | FFmpeg (`-c copy`) | 재인코딩 없음, 빠름 |
| 작업 큐 | DB 폴링 (단순) 또는 Redis (선택) | 단순화 우선 |
| SMS | NHN Cloud SMS API | 기존 모듈 재사용 |
| 패키지 관리 | uv (Python), pnpm (Node) | 빠른 설치 |

---

## 7. 배포 토폴로지

### 행사장 네트워크 구조 (확정)

```
                       [공유기/라우터]
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
  [백엔드 PC]           [코트 1 PC]    ...    [코트 6 PC]
  - FastAPI             - OBS Studio          - OBS Studio
  - MySQL               - 카메라              - 카메라
  - 대시보드            - 클립 워커           - 클립 워커
  - SMS 발송 (NHN)
  - Drive 업로드 (Google API)

  [백엔드 백업 노트북]   ← 백엔드 PC 장애 시 핫 스왑
  - 동일 구성, DB 동기화 대기
```

- 백엔드 PC 1대에 FastAPI + DB + 대시보드 + SMS + Google Drive 업로드
- 코트 PC 6대 각각에 OBS + 카메라 + 클립 워커 (1 PC : 1 OBS : 1 코트)
- 같은 LAN. OBS 제어는 모두 사설 IP 통신
- 인터넷 의존: OBS의 YouTube 송출 / Google Drive 업로드 / SMS 발송
- 인터넷 끊기면 → OBS 송출/Drive 업로드/SMS는 일시 정지, **녹화는 계속 진행**, **클립 추출 큐는 인터넷 복구 후 자동 처리**

### 장애 격리

- 코트 PC 1대 다운 → 해당 코트만 영향, 다른 코트 영향 없음
- 백엔드 PC 다운 → 백업 노트북으로 핫 스왑
- DB 백업: 매 5분 자동 dump → 백업 노트북에 동기화

### 클립 전달 (Google Drive)

- 클립 워커가 FFmpeg cut 후 백엔드에 통지
- 백엔드가 Google Drive Service Account로 업로드
- 비공개 파일 + "링크 있는 사용자 보기" 권한 자동 설정
- 파일명: `[이벤트명]/[코트번호]/[히트번호]_[선수명].mp4`
- 업로드 완료 후 Drive 링크를 SMS 본문에 포함하여 발송

---

## 8. 보안

- OBS WebSocket 비밀번호 필수 설정
- DB 비밀번호는 환경변수 또는 시크릿 파일
- SMS API 키는 시크릿 파일
- 행사장 네트워크는 사설 LAN (외부 노출 없음)

---

## 9. 다음 단계

1. PRD 합의 (미해결 질문 확정)
2. 백엔드 스켈레톤 코드 작성 (기존 코드 복사 + 정리)
3. OBS 연동 모듈 구현 (`obsws-python` 기반)
4. 오버레이 페이지 작성
5. 클립 워커 작성
6. 통합 테스트 (3코트 시뮬레이션)
7. 리허설 (6코트 실제 하드웨어)
