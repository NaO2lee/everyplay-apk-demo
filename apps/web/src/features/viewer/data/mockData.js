// 백엔드 API가 준비되기 전 임시 목업 데이터.
// TODO(backend): 아래 데이터는 실제 API로 교체.
//  - VOD_GROUPS  -> GET /api/v1/public/events/{code}/clips (일자·종목별)
//  - SCHEDULE    -> 협회 대회 수집 데이터 (또는 우리 대회 일정 API)
//  - MY_DASHBOARD-> GET /api/v1/me, /me/heats, /me/awards, /me/clips, /me/practice

export const VOD_GROUPS = [
  {
    date: '2026. 6. 7. (오늘)',
    clips: [
      { id: 'v1', court: '코트 1 · HIT 12', who: '김서연 · 남자 9세부', type: '30초 스피드', dur: '2:14', award: '🥇' },
      { id: 'v2', court: '코트 3 · HIT 15', who: '박지민 · 남자 15세부', type: '프리스타일', dur: '1:58' },
      { id: 'v5', court: '코트 2 · HIT 9', who: '이나영 · 여자 고등부', type: '30초 스피드', dur: '0:33', award: '🥉' },
    ],
  },
  {
    date: '2026. 4. 11. KBSN컵',
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
      { id: 'e1', date: '2026-07-04', day: '04', dow: '토', main: true, days: 3, period: '7.4~6', title: '2026 전국 한마당 줄넘기대회', sub: '전 종목 · 화성시', status: '접수중', event: '스피드', fav: true },
      { id: 'e2', date: '2026-07-05', day: '05', dow: '일', title: '경기 어울림 줄넘기대회', sub: '개인 스피드 · 수원시', cap: '22/24', status: '임박', event: '스피드', fav: false },
    ],
  },
  {
    week: '2주차',
    items: [
      { id: 'e3', date: '2026-07-11', day: '11', dow: '토', title: '서울시 줄넘기 챔피언십', sub: '더블더치 · 서울 송파구', cap: '8/24', status: '접수중', event: '더블더치', fav: false },
      { id: 'e4', date: '2026-07-12', day: '12', dow: '일', title: '유소년 줄넘기 페스티벌', sub: '단체전 · 고양시', cap: '24/24', status: '대기', event: '단체전', fav: true },
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
  // 주식차트식 기록 그래프 — 주 단위 (min=최저, max=최고, avgLo/avgHi=평균대)
  records: {
    event: '30초 스피드',
    weeks: [
      { label: '5월3주', min: 58, max: 70, avgLo: 61, avgHi: 67 },
      { label: '5월4주', min: 60, max: 73, avgLo: 63, avgHi: 70 },
      { label: '6월1주', min: 63, max: 76, avgLo: 66, avgHi: 72 },
      { label: '6월2주', min: 66, max: 79, avgLo: 69, avgHi: 75 },
      { label: '6월3주', min: 64, max: 77, avgLo: 68, avgHi: 73, down: true },
      { label: '6월4주', min: 70, max: 85, avgLo: 74, avgHi: 80, sel: true },
      { label: '7월1주', min: 72, max: 84, avgLo: 75, avgHi: 81 },
    ],
    // 대회(실전) 기록 — 연습 그래프 위에 겹쳐 표시. wi=주 인덱스. 보통 연습보다 낮게 나옴.
    // TODO(backend): GET /me/heats (출전 대회별 결과)
    comps: [
      { wi: 1, name: '봄철 생활체육 줄넘기', date: '5/16', val: 62 },
      { wi: 3, name: '2026 KBSN컵 선수권', date: '6/8', val: 68 },
      { wi: 5, name: '경기 어울림 줄넘기', date: '6/27', val: 73 },
    ],
  },
  nextHeat: { court: '코트 1 · HIT 12 · 30초 스피드', note: '곧 시작 · 코트로 이동해 주세요' },
  practice: [
    { id: 'p1', type: '30초 스피드', date: '2026. 6. 6. 연습', score: '82회' },
    { id: 'p2', type: '30초 스피드', date: '2026. 6. 4. 연습', score: '78회' },
  ],
  clips: [
    { id: 'c1', type: '30초 스피드', from: '전국 한마당 · HIT 12', dur: '2:14' },
    { id: 'c2', type: '프리스타일', from: '전국 한마당 · HIT 4', dur: '1:48' },
    { id: 'c3', type: '번갈아뛰기', from: 'KBSN컵 · 결승', dur: '2:30' },
  ],
  history: [
    { id: 'h1', rank: '🥇', medal: true, title: '전국 한마당 줄넘기대회', sub: '2026. 6. 7. · 30초 스피드 · 남자 9세부', score: '85회' },
    { id: 'h2', rank: '🥉', medal: true, title: '2026 KBSN컵 선수권', sub: '2026. 4. 11. · 번갈아뛰기', score: '76회' },
    { id: 'h3', rank: '4위', medal: false, title: '경희대 라이언스컵 OPEN', sub: '2026. 3. 8. · 프리스타일', score: '9.2점' },
  ],
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
