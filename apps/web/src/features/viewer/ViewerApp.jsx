import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { resolveTheme } from '../../lib/theme';
import { DEMO_EVENT } from './data/mockData';
import styles from './ViewerApp.module.css';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { Drawer } from './components/Drawer';
import { CourtSheet } from './components/CourtSheet';
import { extractYouTubeId } from './hooks/useStationHeat';
import { NotifSheet, SearchSheet } from './components/AppSheets';
import { HomeTab } from './tabs/HomeTab';
import { LiveTab } from './tabs/LiveTab';
import { VodTab } from './tabs/VodTab';
import { ScheduleTab } from './tabs/ScheduleTab';
import { MyTab } from './tabs/MyTab';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

// 사용자 앱 셸: 헤더 + 4탭 + 햄버거 드로어 + 코트 바텀시트
export function ViewerApp() {
  const { eventCode } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 초기 탭/테마: URL 파라미터(?tab=, ?theme=)로 딥링크 가능 (미리보기·공유용)
  const [tab, setTab] = useState(() => {
    const q = new URLSearchParams(window.location.search).get('tab');
    return ['home', 'live', 'vod', 'cal', 'my'].includes(q) ? q : 'home';
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openCourt, setOpenCourt] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const scrollRef = useRef(null);
  // 탭 바꾸면 스크롤 맨 위로 (다가오는 대회→일정 등에서 중간부터 보이는 문제 방지)
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [tab]);

  // 드로어 메뉴 → 화면 이동 (탭 전환 또는 라우트)
  const onDrawerItem = (it) => {
    setDrawerOpen(false);
    const L = it.label || '';
    if (L.includes('로그인')) navigate('/signup');
    else if (L.includes('알림')) navigate('/alarm/demo');
    else if (L.includes('설정')) navigate('/settings/demo');
    else if (L.includes('대회 일정') || L.includes('즐겨찾기')) setTab('cal');
    else if (L.includes('영상')) setTab('vod');
    else if (L.includes('대회 선택') || L.includes('전체 대회')) setTab('home');
    else if (L.includes('공유')) { try { navigator.share?.({ title: '모두의플레이', url: window.location.href }); } catch { /* ignore */ } }
  };

  // 다크/라이트 테마 (기본 다크) — 선택 유지
  // 테마는 설정(/settings/demo)에서 관리. 여기선 적용 값만 읽어 .app data-theme에 반영.
  const [theme] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('theme');
      if (q === 'light' || q === 'dark') return q;
    } catch { /* ignore */ }
    return resolveTheme(); // 모드(다크/라이트/시스템) 해석 → 실제 적용 테마
  });

  useEffect(() => {
    let alive = true;
    // 디자인 공유용 미리보기: /app/demo 는 백엔드 없이 목업 대회로 렌더
    if (eventCode === 'demo') {
      setEvent(DEMO_EVENT);
      setLoading(false);
      return () => { alive = false; };
    }
    (async () => {
      try {
        const res = await api.getPublicEventByCode(eventCode);
        if (alive) setEvent(res.data);
      } catch (e) {
        if (alive) setError(e.message || '대회를 불러올 수 없습니다');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [eventCode]);

  const courts = useMemo(
    () => (event?.stations || []).slice().sort((a, b) => a.station_number - b.station_number),
    [event],
  );
  // 실제 라이브 중계 중 여부 = 영상 송출 중인 코트가 하나라도 있을 때만 (event.status='active'만으론 부족)
  const liveNow = courts.some((c) => !!extractYouTubeId(c.youtube_stream_url));

  if (loading) {
    return <div className={styles.center} data-theme={theme}><div><div className={styles.spinner} />로딩 중...</div></div>;
  }
  if (error || !event) {
    return (
      <div className={styles.center} data-theme={theme}>
        <div>
          <p style={{ marginBottom: 12 }}>{error || '대회를 찾을 수 없습니다'}</p>
          <button className={styles.linkBtn} onClick={() => navigate('/')}>목록으로 돌아가기</button>
        </div>
      </div>
    );
  }

  const HEAD = {
    home: { title: '모두의플레이', subtitle: '줄넘기 대회 · 실시간 중계', live: liveNow },
    live: { title: event.name, subtitle: `${formatDate(event.date)} · 코트 ${courts.length}개`, live: liveNow },
    vod: { title: '대회 영상', subtitle: '지난 대회 다시보기', live: false },
    cal: { title: '대회 일정', subtitle: '국내 대회 한눈에', live: false },
    my: { title: '마이페이지', subtitle: '내 기록 · 영상 · 참가내역', live: false },
  }[tab];

  return (
    <div className={styles.app} data-theme={theme}>
      <AppHeader
        title={HEAD.title}
        subtitle={HEAD.subtitle}
        live={HEAD.live}
        onMenu={() => setDrawerOpen(true)}
        onBell={() => setNotifOpen(true)}
        onProfile={tab !== 'my' ? () => setTab('my') : undefined}
      />

      <div className={styles.scroll} ref={scrollRef}>
        {tab === 'home' && <HomeTab event={event} onGo={setTab} live={liveNow} />}
        {tab === 'live' && <LiveTab courts={courts} onOpenCourt={setOpenCourt} live={event.status === 'active'} liveNow={liveNow} />}
        {tab === 'vod' && <VodTab />}
        {tab === 'cal' && <ScheduleTab />}
        {tab === 'my' && <MyTab />}
      </div>

      {tab === 'live' && (
        <button className={styles.fab} onClick={() => setSearchOpen(true)} aria-label="검색">🔍</button>
      )}

      <BottomNav active={tab} onChange={setTab} />

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onItem={onDrawerItem} />

      <CourtSheet station={openCourt} open={!!openCourt} onClose={() => setOpenCourt(null)} live={event.status === 'active'} />
      <NotifSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export default ViewerApp;
