import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { DEMO_EVENT } from './data/mockData';
import styles from './ViewerApp.module.css';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { Drawer } from './components/Drawer';
import { CourtSheet } from './components/CourtSheet';
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

  // 드로어 메뉴 → 화면 이동 (탭 전환 또는 라우트)
  const onDrawerItem = (it) => {
    setDrawerOpen(false);
    const L = it.label || '';
    if (L.includes('로그인')) navigate('/signup');
    else if (L.includes('알림') || L.includes('설정')) navigate('/settings/demo');
    else if (L.includes('대회 일정') || L.includes('즐겨찾기')) setTab('cal');
    else if (L.includes('영상')) setTab('vod');
    else if (L.includes('대회 선택') || L.includes('전체 대회')) setTab('home');
    else if (L.includes('공유')) { try { navigator.share?.({ title: '모두의플레이', url: window.location.href }); } catch { /* ignore */ } }
  };

  // 다크/라이트 테마 (기본 다크) — 선택 유지
  const [theme, setThemeState] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('theme');
      if (q === 'light' || q === 'dark') return q;
      return localStorage.getItem('mp_theme') || 'dark';
    } catch { return 'dark'; }
  });
  const toggleTheme = () => setThemeState((t) => {
    const next = t === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('mp_theme', next); } catch { /* ignore */ }
    return next;
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
    home: { title: '모두의플레이', subtitle: '줄넘기 대회 · 실시간 중계', live: event.status === 'active' },
    live: { title: event.name, subtitle: `${formatDate(event.date)} · 코트 ${courts.length}개`, live: event.status === 'active' },
    vod: { title: '기록 영상', subtitle: '지난 대회 다시보기', live: false },
    cal: { title: '대회 일정', subtitle: '국내 대회 한눈에', live: false },
    my: { title: '마이페이지', subtitle: '내 기록 · 영상 · 참가내역', live: false },
  }[tab];

  return (
    <div className={styles.app} data-theme={theme}>
      <AppHeader
        title={HEAD.title}
        subtitle={HEAD.subtitle}
        live={HEAD.live}
        theme={theme}
        onToggleTheme={toggleTheme}
        onMenu={() => setDrawerOpen(true)}
        onBell={() => setNotifOpen(true)}
      />

      <div className={styles.scroll}>
        {tab === 'home' && <HomeTab event={event} onGo={setTab} />}
        {tab === 'live' && <LiveTab courts={courts} onOpenCourt={setOpenCourt} />}
        {tab === 'vod' && <VodTab />}
        {tab === 'cal' && <ScheduleTab />}
        {tab === 'my' && <MyTab />}
      </div>

      {tab === 'live' && (
        <button className={styles.fab} onClick={() => setSearchOpen(true)} aria-label="검색">🔍</button>
      )}

      <BottomNav active={tab} onChange={setTab} />

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onItem={onDrawerItem} />

      <CourtSheet station={openCourt} open={!!openCourt} onClose={() => setOpenCourt(null)} />
      <NotifSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export default ViewerApp;
