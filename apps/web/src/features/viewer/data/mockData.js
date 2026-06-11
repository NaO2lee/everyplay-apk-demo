// 백엔드 API가 준비되기 전 임시 목업 데이터.
// TODO(backend): 아래 데이터는 실제 API로 교체.
//  - VOD_GROUPS  -> GET /api/v1/public/events/{code}/clips (일자·종목별)
//  - SCHEDULE    -> 협회 대회 수집 데이터 (또는 우리 대회 일정 API)
//  - MY_DASHBOARD-> GET /api/v1/me, /me/heats, /me/awards, /me/clips, /me/practice

export const VOD_GROUPS = [
  {
    date: '2026. 6. 7. (오늘)',
    clips: [
      { id: 'v1', court: '코트 1 · HIT 12', who: '김서연 · 남자 9세부', type: '30초 스피드', dur: '2:14' },
      { id: 'v2', court: '코트 3 · HIT 15', who: '박지민 · 남자 15세부', type: '프리스타일', dur: '1:58' },
    ],
  },
  {
    date: '2026. 4. 11. KBSN컵',
    clips: [
      { id: 'v3', court: '코트 2 · 결승', who: '이준호 · 남자 12세부', type: '더블더치 스피드', dur: '2:30' },
      { id: 'v4', court: '코트 4 · HIT 22', who: '최유나 · 여자 9세부', type: '번갈아뛰기', dur: '3:02' },
    ],
  },
];

export const VOD_FILTERS = ['전체', '30초 스피드', '번갈아뛰기', '더블더치', '프리스타일'];

// 대회 일정 — 테니스타운 구조(월 페이징 + 상태/종목 필터 + 주차 그룹 + 날짜블록 카드)
export const SCHEDULE_MONTH = '7월';
export const SCHEDULE_STATUS_TABS = ['전체', '메인', '관심', '모집중', '모집예정', 'My'];
export const SCHEDULE_EVENT_TABS = ['전체', '스피드', '더블더치', '프리스타일', '단체전'];

// status: 신청 | 접수중 | 임박 | 대기 | 대진오픈 | 모집예정 | 마감 | LIVE
export const SCHEDULE = [
  {
    week: '1주',
    items: [
      { id: 'e1', day: '04', dow: '토', main: true, title: '2026 전국 한마당 줄넘기대회', sub: '전 종목 · 화성시', cap: '128/210', status: '접수중', event: '스피드', fav: true },
      { id: 'e2', day: '05', dow: '일', title: '경기 어울림 줄넘기대회', sub: '개인 스피드 · 수원시', cap: '22/24', status: '임박', event: '스피드', fav: false },
    ],
  },
  {
    week: '2주',
    items: [
      { id: 'e3', day: '11', dow: '토', title: '서울시 줄넘기 챔피언십', sub: '더블더치 · 서울 송파구', cap: '8/24', status: '접수중', event: '더블더치', fav: false },
      { id: 'e4', day: '12', dow: '일', title: '유소년 줄넘기 페스티벌', sub: '단체전 · 고양시', cap: '24/24', status: '대기', event: '단체전', fav: true },
      { id: 'e5', day: '14', dow: '화', title: '봄철 생활체육 줄넘기', sub: '프리스타일 · 성남시 수정구', cap: '—', status: '대진오픈', event: '프리스타일', fav: false },
    ],
  },
  {
    week: '3주',
    items: [
      { id: 'e6', day: '18', dow: '토', title: '더블더치 오픈 2026', sub: '더블더치 · 인천 남동구', cap: '0/32', status: '모집예정', event: '더블더치', fav: false },
      { id: 'e7', day: '19', dow: '일', title: '전국 줄넘기 선수권', sub: '개인 스피드 · 대전', cap: '—', status: 'LIVE', event: '스피드', fav: false },
    ],
  },
];

export const MY_DASHBOARD = {
  name: '김서연 선수',
  initial: '김',
  meta: '서울 줄넘기클럽 · 🇰🇷 한국 · 남자 9세부',
  stats: { entries: 12, awards: 3, best: 85 },
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
