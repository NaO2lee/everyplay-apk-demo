# everyone-play-safety

모두의플레이 줄넘기 대회 라이브 스트리밍 시스템 — **OBS 위임 기반 안정성 우선 버전**

## 핵심 결정

- 스트리밍 송출은 **OBS Studio**에 위임 (자체 FFmpeg 송출 코드 제거)
- 자체 앱 역할: **오버레이 컨트롤러 + 히트 관리 + 타임스탬프 기록 + 클립 추출 + 알림 발송**
- 하드웨어 추상화(카메라, GPU 인코더, 캡처카드)는 OBS가 처리

## 디렉토리 구조

```
everyone-play-safety/
├── README.md
├── docs/
│   ├── ARCHITECTURE.md      # 시스템 아키텍처
│   ├── PRD.md               # 제품 요구사항
│   └── REHEARSAL.md         # 리허설 체크리스트 (TBD)
├── apps/
│   ├── api/                 # FastAPI 백엔드
│   ├── web/                 # 관리자 대시보드 (React + Vite)
│   ├── overlay/             # OBS 브라우저 소스용 정적 HTML
│   └── clip-worker/         # 히트 종료 후 클립 추출 워커
└── scripts/
    └── setup-laptop/        # 코트별 랩탑 OBS/워커 셋업 스크립트
```

## 참조 코드베이스

기존 코드 재사용 (스키마/UI/CSV/SMS 등):
- `/home/weplay/dev/everyone-play_v2.0/apps/api/` — DB 스키마, FastAPI 구조
- `/home/weplay/dev/everyone-play_v2.0/apps/web/` — 대시보드 UI 컴포넌트
- `/home/weplay/dev/everyone-play/` — Legacy SMS 모듈 (NHN Cloud)

## 일정

- 4/13 ~ 4/19 (1주): 개발 완료
- 4/20 ~ 4/26: 리허설 + 버그 수정
- 5/2: 행사 당일

## 문서

먼저 [`docs/PRD.md`](docs/PRD.md)와 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)를 읽으세요.
