# 클립 추출 기능 스펙

## 1. 개요

대회 중 OBS가 녹화한 전체 영상에서 **히트(HIT) 단위로 구간을 잘라** 개별 클립 영상을 생성하고, 이를 선수·종목별로 분류하여 전달하는 기능.

### 핵심 목표
- 히트 시작/종료 시점에 기록된 타임코드를 기반으로 정확한 구간 추출
- 선수별·종목별 클립 자동 분류 및 네이밍
- OBS PC 에서 파이썬 설치 없이 exe 파일 하나로 실행
- 웹 클립 페이지에서 시각화 + 자르기 컨트롤

---

## 2. 아키텍처

```
[클립 페이지 (브라우저)]
    │ "자르기" 버튼 클릭
    ▼
[백엔드 API 서버]
    │ clip_status = 'pending' 마크
    │
    ▼ (워커가 주기적으로 GET 요청)
[clip-worker.exe (OBS PC)]
    │ 1. 대기 중인 히트 조회 (GET /api)
    │ 2. 로컬 녹화 파일에서 ffmpeg로 구간 추출
    │ 3. 결과 보고 (POST /api)
    ▼
[잘린 클립 mp4 (OBS PC 로컬)]
    │ (선택) Google Drive 업로드
    ▼
[공유 링크 → SMS 발송]
```

### 핵심 설계 원칙
- **워커는 DB 에 직접 접속하지 않음** — 백엔드 API 만 호출 (HTTP)
- **녹화 파일은 OBS PC 로컬에 존재** — 네트워크 전송 없이 로컬 ffmpeg 로 잘라냄
- **워커는 코트별 1개** — 각 OBS PC 에서 자기 코트의 히트만 처리

---

## 3. OBS PC 배포 구성

```
clip-worker/
├── clip-worker.exe    ← PyInstaller 빌드. 더블클릭 실행.
├── ffmpeg.exe         ← ffmpeg 공식 Windows 빌드
└── config.ini         ← 설정 파일
```

### config.ini 예시
```ini
[server]
# 백엔드 서버 주소 (Cloudflare 터널 또는 로컬 네트워크)
api_url = https://dev-play.everystof.com/api/v1

[worker]
# 이 PC가 담당하는 코트 ID (UUID)
court_id = ba950073-0e7c-4dd7-ad19-f6a0c5abaef0

# 잘린 클립 저장 폴더 (기본: 현재 폴더 아래 clips)
output_dir = ./clips

# 폴링 주기 (초)
poll_interval = 5

# ffmpeg 경로 (기본: 같은 폴더의 ffmpeg.exe)
ffmpeg_path = ./ffmpeg.exe
```

---

## 4. 워커 동작 플로우

```
시작
  ↓
[1] GET /heats/pending?court_id=X  ← 자를 히트 목록 조회
  ↓ (없으면 poll_interval 대기 후 반복)
[2] POST /heats/{id}/claim         ← 이 히트 "처리 중" 선점
  ↓
[3] ffmpeg 실행
    - 입력: 녹화 파일 경로 (API 응답에 포함)
    - 시작점: obs_timecode_start (또는 recording_offset_start) - 2초 여유
    - 길이: (end - start) + 4초 여유
    - 출력: {output_dir}/{네이밍규칙}.mp4
  ↓
[4] POST /heats/{id}/clip-complete  ← 결과 보고
    - 성공: clip_path = 로컬 경로, clip_status = ready
    - 실패: clip_status = failed, error_message
  ↓
[1] 로 돌아감
```

---

## 5. 필요한 API 엔드포인트

### 기존 (이미 있음)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/heats/{id}/extract` | 히트 clip_status 를 pending 으로 변경 |
| GET | `/events/{id}/heats` | 이벤트의 히트 목록 조회 (court_id 필터 지원) |

### 신규 (워커용 추가 필요)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/heats/pending` | `clip_status=pending` 히트 조회. `court_id` 필터. 녹화 파일 경로·오프셋 포함 |
| POST | `/heats/{id}/claim` | `clip_status` 를 `processing` 으로 전환 (중복 처리 방지). 이미 processing 이면 409 |
| POST | `/heats/{id}/clip-complete` | 추출 결과 보고 — `clip_path`, `clip_status` (ready / failed), `error_message` |

---

## 6. 클립 분류 체계 (카테고라이징)

### 현재 DB 에 있는 분류 정보

| 필드 | 위치 | 설명 | 예시 |
|------|------|------|------|
| `heat_number` | Heat | 히트 순번 | 1, 2, 3... |
| `court_number` | Court | 코트 번호 | 1~6 |
| `name` | Participant | 선수 이름 | "김도윤" |
| `team` | Participant | 소속/팀명 | "서울초등학교" |
| `category` | Participant | 종별/종목 | "개인줄넘기-초등" |
| `event.name` | Event | 대회명 | "2026 전국 줄넘기 대회" |
| `event.date` | Event | 대회 날짜 | "2026-05-02" |

### 클립 파일 네이밍 규칙 (안)

```
{대회날짜}_{코트번호}_{히트번호}_{종목}_{선수명들}.mp4
```

예시:
```
20260502_court1_heat03_개인줄넘기-초등_김도윤.mp4
20260502_court3_heat15_단체줄넘기-중등_서울중_이서연_박민준_정하은.mp4
```

### 폴더 구조 (안)

```
clips/
├── 20260502_전국줄넘기대회/
│   ├── court1/
│   │   ├── 20260502_court1_heat01_개인줄넘기-초등_김도윤.mp4
│   │   ├── 20260502_court1_heat02_개인줄넘기-초등_이서연.mp4
│   │   └── ...
│   ├── court2/
│   └── ...
```

---

## 7. 타임코드 기준 (이중 저장)

히트에는 두 세트의 타임코드가 저장됨:

| 필드 | 용도 | 정확도 |
|------|------|--------|
| `recording_offset_start/end` | 서버 시계 기반 계산 (기존) | 1~2초 오차 가능 |
| `obs_timecode_start/end` | OBS 녹화 파일 내부 시간 직접 조회 | 정확 |
| `obs_stream_timecode_start/end` | OBS 스트림 내부 시간 직접 조회 | 유튜브 VOD 기준 정확 |

**클립 추출 시 우선순위:**
1. `obs_timecode_start/end` (OBS 직접) — 최우선
2. `recording_offset_start/end` (서버 계산) — 폴백

**유튜브 링크 생성 시:**
1. `obs_stream_timecode_start` + `event.youtube_offset_seconds` 보정
2. 서버 시계 계산 (폴백)

---

## 8. ffmpeg 명령어

```bash
ffmpeg -y \
  -ss {start_offset - 2.0} \
  -t {(end_offset - start_offset) + 4.0} \
  -i "{recording_path}" \
  -c copy \
  -movflags +faststart \
  "{output_path}"
```

- `-ss` 를 `-i` 앞에 두어 키프레임 기준 빠른 탐색
- `-c copy` 로 재인코딩 없이 추출 (빠르고 무손실)
- `-movflags +faststart` 로 브라우저 스트리밍 재생 지원
- 앞뒤 2초 여유: 키프레임 경계 + 장면 전환 버퍼

### OBS 녹화 설정 권장
- **포맷**: mp4 (또는 mkv 후 remux)
- **키프레임 간격**: 2초 이하 (잘림 정확도 향상)
- **저장 경로**: SSD 권장 (I/O 속도)

---

## 9. 클립 페이지 UI (구현 완료)

경로: `/admin/events/{eventId}/clips`

| 영역 | 내용 |
|------|------|
| 상단 | 코트 탭, 녹화 파일 경로, "전체 자르기" 버튼 |
| 중앙 | 가로 타임라인 막대. 히트가 색 블록으로 위치·길이대로 표시 |
| 하단 | 히트 테이블 — 번호, 참가자, 구간, 길이, 상태, 자르기/다운로드 버튼 |

상태별 색상:
- 노랑 = 대기 (pending)
- 파랑 = 자르는 중 (processing)
- 초록 = 완료 (ready)
- 빨강 = 실패 (failed)
- 보라 = 발송됨 (sent)

대기/자르는 중 상태가 있으면 5초마다 자동 새로고침.

---

## 10. 열린 질문 (대회 구조 조사 후 결정)

1. **종목(category) 체계**: 현재 Participant 에 `category` 필드 하나만 있음. 실제 대회에서 종목이 어떻게 구분되는지에 따라:
   - 종목 = "개인줄넘기", "단체줄넘기", "더블더치" 등?
   - 종별 = "초등", "중등", "고등", "일반" 등?
   - 종목 + 종별 조합으로 히트가 그룹핑되는지?
   - 종목별 전용 테이블이 필요한지, 아니면 `category` 문자열로 충분한지?

2. **히트와 선수 매핑**: 한 히트에 선수가 여러 명 (단체전). 현재 다대다 관계 테이블 있음. 히트 시작 시 참가자를 어떤 방식으로 지정하는지? (CSV 사전 등록 → 히트별 배정 vs 현장 즉석 입력)

3. **대회 진행 순서**: 종목별로 코트가 정해져 있는지, 아니면 한 코트에서 여러 종목이 순차 진행되는지?

4. **핵심 선수 vs 일반 선수**: 핵심 선수에게만 Google Drive 클립 전달, 나머지는 YouTube VOD 링크만. 핵심 선수 구분 기준은?

5. **클립 전달 시점**: 행사 끝나고 일괄 전달? 실시간(히트 끝나자마자) 전달?

6. **녹화 세션 관리**: 한 코트에서 녹화 중단·재시작 시 파일 여러 개 생김. 현재는 마지막 파일 경로만 저장. 복수 세션 관리 필요한지?

---

## 11. 구현 로드맵

| 단계 | 내용 | 상태 |
|------|------|------|
| 1 | 히트별 OBS 타임코드(녹화 + 스트리밍) 이중 저장 | 완료 |
| 2 | 클립 페이지 UI (타임라인 시각화 + 자르기 버튼) | 완료 |
| 3 | 유튜브 VOD 보정 오프셋 (이벤트 설정) | 완료 |
| 4 | 워커를 API 기반으로 리팩토링 (DB 직접 접속 제거) | 미착수 |
| 5 | PyInstaller 로 exe 빌드 + ffmpeg 동봉 | 미착수 |
| 6 | 클립 네이밍·폴더 분류 적용 (종목/선수명) | 미착수 — 대회 구조 조사 후 |
| 7 | Google Drive 업로드 연동 (핵심 선수 전용) | 미착수 |
| 8 | SMS 발송 연동 (클립 완료 → 링크 → 문자) | 미착수 |
| 9 | 녹화 세션 복수 관리 | 미착수 — 필요 시 |
