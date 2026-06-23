// 백엔드 API가 준비되기 전 임시 목업 데이터.
// TODO(backend): 아래 데이터는 실제 API로 교체.
//  - VOD_GROUPS  -> GET /api/v1/public/events/{code}/clips (일자·종목별)
//  - SCHEDULE    -> 협회 대회 수집 데이터 (또는 우리 대회 일정 API)
//  - MY_DASHBOARD-> GET /api/v1/me, /me/heats, /me/awards, /me/clips, /me/practice

// 기록 영상 — 대회·일차별 그룹. comp=대회명, date=날짜, day=일차(없으면 단일일).
export const VOD_GROUPS = [
  {
    id: 'd1', comp: '2026 전국 한마당 줄넘기대회', date: '6/7', day: '1일차',
    clips: [
      { id: 'v1', court: '코트 1 · HIT 12', who: '김서연 · 남자 9세부', type: '30초 스피드', dur: '2:14', award: '🥇' },
      { id: 'v2', court: '코트 3 · HIT 15', who: '박지민 · 남자 15세부', type: '프리스타일', dur: '1:58' },
      { id: 'v5', court: '코트 2 · HIT 9', who: '이나영 · 여자 고등부', type: '30초 스피드', dur: '0:33', award: '🥉' },
    ],
  },
  {
    id: 'd2', comp: '2026 전국 한마당 줄넘기대회', date: '6/8', day: '2일차',
    clips: [
      { id: 'v6', court: '코트 1 · 결승', who: '김서연 · 남자 9세부', type: '30초 스피드', dur: '0:32', award: '🥇' },
      { id: 'v7', court: '코트 4 · HIT 18', who: '강민재 · 중등부', type: '더블더치', dur: '2:10' },
    ],
  },
  {
    id: 'd3', comp: '2026 KBSN컵 선수권', date: '4/11', day: null,
    clips: [
      { id: 'v3', court: '코트 2 · 결승', who: '이준호 · 남자 12세부', type: '더블더치', dur: '2:30', award: '🥇' },
      { id: 'v4', court: '코트 4 · HIT 22', who: '최유나 · 여자 9세부', type: '번갈아뛰기', dur: '3:02' },
    ],
  },
];

export const VOD_FILTERS = ['전체', '🏅 수상', '30초 스피드', '번갈아뛰기', '더블더치', '프리스타일'];

// 코트 시청 데모 경기 정보 — TODO(backend): SSE heat 데이터(일차/종목/HIT/선수/국가)로 교체
export const DEMO_MATCH = {
  dayOf: 2,
  event: '30초 스피드 · 남자 9세부',
  hit: 12,
  players: [
    { name: '김서연', flag: '🇰🇷' }, { name: '박도윤', flag: '🇰🇷' }, { name: 'TANAKA', flag: '🇯🇵' },
    { name: '이준', flag: '🇰🇷' }, { name: 'WANG', flag: '🇨🇳' }, { name: '오시우', flag: '🇰🇷' },
  ],
};

// 코트 시청 응원 "댓글" — 실시간 푸시 대신 새로고침(폴링). 서버 부하↓ (백엔드 권고).
// TODO(backend): GET /events/{code}/courts/{id}/comments?after= (목록·새로고침), POST .../comments (등록)
export const CHEER_PRESETS = ['🔥 화이팅!', '👏 잘한다!', '💪 최고!', '🎉 축하해요', '😮 대박!'];
export const CHAT_SEED = [
  { id: 'c1', name: '응원단A', color: '#5BA8FF', text: '코트1 김서연 화이팅! 🔥', time: '14:21' },
  { id: 'c2', name: '점프맘', color: '#34D4A6', text: '와 속도 미쳤다 👏', time: '14:23' },
  { id: 'c3', name: '관전중', color: '#B49CFF', text: '이번 히트 신기록 가즈아 💪', time: '14:25' },
  { id: 'c4', name: '화성클럽', color: '#FFB648', text: '우리 선수 1등! 🎉', time: '14:27' },
];
// 새로고침 누를 때마다 서버에서 새로 불러온 것처럼 추가되는 댓글 (폴링 시뮬)
export const CHAT_MORE = [
  { id: 'n1', name: '줄넘기팬', color: '#FF7A66', text: '방금 그 더블언더 진짜 대박 😮', time: '14:29' },
  { id: 'n2', name: '서울점프', color: '#5BA8FF', text: '다음 코트도 기대돼요!', time: '14:30' },
  { id: 'n3', name: '코치맘', color: '#34D4A6', text: '우리 애 차례 곧이에요 두근두근', time: '14:31' },
];

// 대회 일정 — 테니스타운 구조(월 페이징 + 상태/종목 필터 + 주차 그룹 + 날짜블록 카드)
export const SCHEDULE_MONTH = '7월';
export const SCHEDULE_STATUS_TABS = ['전체', '메인', '관심', '모집중', '모집예정', 'My'];
export const SCHEDULE_EVENT_TABS = ['전체', '스피드', '더블더치', '프리스타일', '단체전'];

// status: 신청 | 접수중 | 임박 | 대기 | 대진오픈 | 모집예정 | 마감 | LIVE
export const SCHEDULE = [
  {
    week: '1주차',
    items: [
      { id: 'e1', date: '2026-07-04', day: '04', dow: '토', main: true, days: 3, period: '7.4~6', title: '2026 전국 한마당 줄넘기대회', sub: '전 종목 · 화성시', status: '접수중', event: '스피드', fav: true, applied: true },
      { id: 'e2', date: '2026-07-05', day: '05', dow: '일', title: '경기 어울림 줄넘기대회', sub: '개인 스피드 · 수원시', cap: '22/24', status: '임박', event: '스피드', fav: false },
    ],
  },
  {
    week: '2주차',
    items: [
      { id: 'e3', date: '2026-07-11', day: '11', dow: '토', title: '서울시 줄넘기 챔피언십', sub: '더블더치 · 서울 송파구', cap: '8/24', status: '접수중', event: '더블더치', fav: false },
      { id: 'e4', date: '2026-07-12', day: '12', dow: '일', title: '유소년 줄넘기 페스티벌', sub: '단체전 · 고양시', cap: '24/24', status: '대기', event: '단체전', fav: true, applied: true },
      { id: 'e5', date: '2026-07-14', day: '14', dow: '화', title: '봄철 생활체육 줄넘기', sub: '프리스타일 · 성남시 수정구', cap: '—', status: '대진오픈', event: '프리스타일', fav: false },
    ],
  },
  {
    week: '3주차',
    items: [
      { id: 'e6', date: '2026-07-18', day: '18', dow: '토', title: '더블더치 오픈 2026', sub: '더블더치 · 인천 남동구', cap: '0/32', status: '모집예정', event: '더블더치', fav: false },
      { id: 'e7', date: '2026-07-19', day: '19', dow: '일', days: 2, period: '7.19~20', dayOf: 2, title: '전국 줄넘기 선수권', sub: '개인 스피드 · 대전', status: 'LIVE', event: '스피드', fav: false },
    ],
  },
];

export const MY_DASHBOARD = {
  name: '김서연 선수',
  initial: '김',
  meta: '서울 줄넘기클럽 · 🇰🇷 한국 · 남자 9세부',
  level: 'Lv.7',
  compEntries: 8,
  stats: { entries: 12, awards: 3, best: 85 },
  // 이번 주 훈련 리포트 — TODO(backend): GET /me/weekly (연습 로그 집계)
  weekly: { range: '6/15 – 6/21', sessions: 4, prevSessions: 3, jumps: 1240, minutes: 86, best: 85, goal: 5 },
  // 훈련 플랜/루틴 (개인 목표) — TODO(backend): GET /me/plans
  plans: [
    { id: 'pl1', name: '30초 스피드 +5회', sub: 'D-9 전국 한마당 대비', goal: '목표 85회', pct: 60, today: '오늘 미션: 30초 × 5세트 (풀스피드)', color: 'cyan' },
    { id: 'pl2', name: '더블언더 30회 도전', sub: '연속 더블언더 늘리기', goal: '현재 최고 22회', pct: 40, today: '오늘 미션: 더블언더 인터벌 10분', color: 'purple' },
    { id: 'pl3', name: '지구력 5분 연속', sub: '쉬지 않고 5분 뛰기', goal: '현재 3분 20초', pct: 35, today: '오늘 미션: 4분 페이스 유지', color: 'mint' },
  ],
  // 인사이트 (데이터 기반 자동 코칭) — TODO(backend): GET /me/insights
  insights: [
    { ic: '🔥', text: '최근 3주 연속 상승세 — 연습 평균 +6회', tone: 'mint' },
    { ic: '⏱', text: '전국 한마당 D-9 — 실전 페이스 훈련을 권장해요', tone: 'butter' },
    { ic: '💪', text: '이번 주 연습 4회로 주간 목표의 80% 달성', tone: 'blue' },
  ],
  // 주식차트식 기록 그래프 — 일/주/월 토글. min=최저, max=최고, avgLo/avgHi=평균대.
  // day 는 recs(그날 기록들) → 1개면 점, 2개 이상이면 막대(범위). comps.wi = 버킷 인덱스.
  // TODO(backend): GET /me/records?period=day|week|month , GET /me/heats(대회 결과)
  records: {
    event: '30초 스피드',
    day: {
      buckets: [
        { label: '6/15', recs: [70] },
        { label: '6/16', recs: [72, 75] },
        { label: '6/17', recs: [74] },
        { label: '6/18', recs: [76, 79, 73] },
        { label: '6/19', recs: [78] },
        { label: '6/20', recs: [80, 83] },
        { label: '6/21', recs: [82] },
      ],
      comps: [{ wi: 3, name: '주말 기록회', date: '6/18', val: 74 }],
    },
    week: {
      buckets: [
        { label: '5월3주', min: 58, max: 70, avgLo: 61, avgHi: 67 },
        { label: '5월4주', min: 60, max: 73, avgLo: 63, avgHi: 70 },
        { label: '6월1주', min: 63, max: 76, avgLo: 66, avgHi: 72 },
        { label: '6월2주', min: 66, max: 79, avgLo: 69, avgHi: 75 },
        { label: '6월3주', min: 64, max: 77, avgLo: 68, avgHi: 73, down: true },
        { label: '6월4주', min: 70, max: 85, avgLo: 74, avgHi: 80, sel: true },
        { label: '7월1주', min: 72, max: 84, avgLo: 75, avgHi: 81 },
      ],
      comps: [
        { wi: 1, name: '봄철 생활체육 줄넘기', date: '5/16', val: 62 },
        { wi: 3, name: '2026 KBSN컵 선수권', date: '6/8', val: 68 },
        { wi: 5, name: '경기 어울림 줄넘기', date: '6/27', val: 73 },
      ],
    },
    month: {
      buckets: [
        { label: '2월', min: 55, max: 68, avgLo: 59, avgHi: 64 },
        { label: '3월', min: 58, max: 72, avgLo: 62, avgHi: 68 },
        { label: '4월', min: 62, max: 76, avgLo: 66, avgHi: 72 },
        { label: '5월', min: 66, max: 80, avgLo: 70, avgHi: 76 },
        { label: '6월', min: 70, max: 85, avgLo: 74, avgHi: 81, sel: true },
      ],
      comps: [
        { wi: 1, name: '봄철 생활체육', date: '3/8', val: 60 },
        { wi: 3, name: '경기 어울림', date: '5/16', val: 73 },
        { wi: 4, name: '전국 한마당', date: '6/7', val: 80 },
      ],
    },
  },
  nextHeat: { court: '코트 1 · HIT 12 · 30초 스피드', note: '곧 시작 · 코트로 이동해 주세요' },
  practice: [
    { id: 'p1', type: '30초 스피드', date: '2026. 6. 6. 연습', score: '82회' },
    { id: 'p2', type: '30초 스피드', date: '2026. 6. 4. 연습', score: '78회' },
    { id: 'p3', type: '더블언더', date: '2026. 6. 2. 연습', score: '64회' },
    { id: 'p4', type: '30초 스피드', date: '2026. 5. 30. 연습', score: '80회' },
    { id: 'p5', type: '번갈아뛰기', date: '2026. 5. 28. 연습', score: '3:05' },
  ],
  clips: [
    { id: 'c1', type: '30초 스피드', from: '전국 한마당 · HIT 12', dur: '2:14' },
    { id: 'c2', type: '프리스타일', from: '전국 한마당 · HIT 4', dur: '1:48' },
    { id: 'c3', type: '번갈아뛰기', from: 'KBSN컵 · 결승', dur: '2:30' },
  ],
  // 참가한 대회 — 누르면 종목별 결과(events)·수상🏅·영상🎬·공유. TODO(backend): GET /me/heats
  history: [
    { id: 'h1', rank: '🥇', medal: true, title: '2026 전국 한마당 줄넘기대회', sub: '2026. 6. 7. · 30초 스피드 · 남자 9세부', date: '2026. 6. 7.', score: '85회', hasVideo: true,
      events: [{ ev: '30초 스피드', result: '85회', medal: '🥇' }, { ev: '개인 프리스타일', result: '9.2점', medal: '🥉' }] },
    { id: 'h2', rank: '🥉', medal: true, title: '2026 KBSN컵 선수권', sub: '2026. 4. 11. · 번갈아뛰기', date: '2026. 4. 11.', score: '76회', hasVideo: true,
      events: [{ ev: '번갈아뛰기', result: '76회', medal: '🥉' }] },
    { id: 'h3', rank: '4위', medal: false, title: '경희대 라이언스컵 OPEN', sub: '2026. 3. 8. · 프리스타일', date: '2026. 3. 8.', score: '9.2점', hasVideo: false,
      events: [{ ev: '개인 프리스타일', result: '9.2점', medal: '' }] },
    { id: 'h4', rank: '🥈', medal: true, title: '경기 어울림 줄넘기대회', sub: '2026. 2. 22. · 30초 스피드', date: '2026. 2. 22.', score: '79회', hasVideo: true,
      events: [{ ev: '30초 스피드', result: '79회', medal: '🥈' }] },
    { id: 'h5', rank: '5위', medal: false, title: '겨울 줄넘기 페스티벌', sub: '2026. 1. 18. · 더블더치', date: '2026. 1. 18.', score: '결승', hasVideo: false,
      events: [{ ev: '더블더치', result: '결승 진출', medal: '' }] },
  ],
  // 현재 신청한(참가 예정) 경기 — 없으면 빈 상태. TODO(backend): GET /me/upcoming
  registered: { title: '2026 전국 한마당 줄넘기대회', date: '2026. 7. 17.(금)', dday: 'D-25', events: ['30초 스피드', '개인 프리스타일'], status: '입금 확인 완료',
    prep: ['줄넘기 줄(개인)', '실내 운동화', '선수 등록증', '편한 운동복'] },
};

// 디자인 미리보기/공유용 데모 대회 (백엔드 없이 /app/demo 로 렌더). 실제 운영엔 사용 안 함.
export const DEMO_EVENT = {
  id: 'demo',
  code: 'demo',
  name: '2026 전국 한마당 줄넘기대회',
  date: '2026-07-17',
  status: 'active',
  stations: [
    { id: 'demo-1', station_number: 1, youtube_stream_url: null },
    { id: 'demo-2', station_number: 2, youtube_stream_url: null },
    { id: 'demo-3', station_number: 3, youtube_stream_url: null },
    { id: 'demo-4', station_number: 4, youtube_stream_url: null },
  ],
};

// 알림함 (🔔) — TODO(backend): GET /me/notifications
export const NOTIFICATIONS = [
  { id: 'nt1', ic: '⏱', title: '곧 출전이에요 — 코트 1 · HIT 12 · 30초 스피드', time: '2분 전', unread: true },
  { id: 'nt2', ic: '🥇', title: '경기 결과: 30초 스피드 85회 — 1위 축하해요!', time: '1시간 전', unread: true },
  { id: 'nt3', ic: '🏆', title: '시상식 안내 — 잠시 후 시상대로 와주세요', time: '1시간 전', unread: true },
  { id: 'nt4', ic: '📢', title: '전국 한마당 줄넘기대회 접수 마감 D-3', time: '어제', unread: false },
  { id: 'nt5', ic: '💬', title: '내 응원 댓글에 답글이 달렸어요', time: '2일 전', unread: false },
];

// 선수/영상 검색 (🔍) — TODO(backend): GET /public/events/{code}/participants?q=
export const SEARCH_PLAYERS = [
  { id: 'sp1', name: '김서연', club: '서울 줄넘기클럽', div: '남자 9세부', best: '30초 스피드 85회', clips: 3 },
  { id: 'sp2', name: '박지민', club: '화성 점프', div: '남자 15세부', best: '프리스타일 92점', clips: 2 },
  { id: 'sp3', name: '이나영', club: '광주 줄넘기', div: '여자 고등부', best: '30초 스피드 78회', clips: 1 },
  { id: 'sp4', name: '이준호', club: '대전 로프', div: '남자 12세부', best: '더블더치 결승', clips: 2 },
  { id: 'sp5', name: '최유나', club: '인천 점프', div: '여자 9세부', best: '번갈아뛰기 3:02', clips: 1 },
  { id: 'sp6', name: '강민재', club: '제주 점프', div: '중등부', best: '더블언더 62회', clips: 1 },
];

export const DRAWER_MENU = [
  {
    section: '내 활동',
    items: [
      { ic: '👤', label: '로그인 / 회원가입' },
      { ic: '⭐', label: '즐겨찾기 선수' },
      { ic: '🔔', label: '알림 설정', badge: '3' },
      { ic: '🎬', label: '내 출전 영상' },
    ],
  },
  {
    section: '둘러보기',
    items: [
      { ic: '🏆', label: '대회 선택 / 전체 대회' },
      { ic: '📅', label: '대회 일정' },
      { ic: '🎞️', label: '기록 영상' },
    ],
  },
  {
    section: '기타',
    items: [
      { ic: '🌐', label: '언어 (한국어/English)' },
      { ic: '🔗', label: '공유하기' },
      { ic: '💬', label: '고객센터 / 도움말' },
      { ic: '⚙️', label: '설정' },
    ],
  },
];
