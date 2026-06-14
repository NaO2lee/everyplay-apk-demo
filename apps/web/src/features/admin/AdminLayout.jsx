import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './AdminConsole.module.css';

/* 관리자 콘솔 공용 셸 (헤더 + 사이드바 + 본문 슬롯).
   실제 관리자 페이지들이 이 안에 children 으로 들어온다.
   active = 현재 사이드바 메뉴 key. */

const TOP_NAV = ['🏠 운영자', '📊 통계', '⚖️ 심판', '🤸 참가자', '📺 시청자'];

const SIDE_NAV = [
  { key: 'dashboard', ic: '📊', label: '대시보드', to: '/console' },
  { key: 'events', ic: '🏆', label: '대회 관리', to: '/admin/events' },
  { key: 'runner', ic: '🏃', label: '경기 진행', to: '/console/runner' },
  { key: 'brackets', ic: '🗓️', label: '대진 · 일정', to: '/console/brackets' },
  { key: 'participants', ic: '🤸', label: '참가자', to: '/console/participants' },
  { key: 'broadcast', ic: '📺', label: '중계 송출', to: '/console/broadcast' },
  { key: 'switcher', ic: '🎚️', label: '중계 컨트롤룸', to: '/console/switcher' },
  { key: 'overlay', ic: '📢', label: '광고·오버레이', to: '/console/overlay' },
  { key: 'judge', ic: '⚖️', label: '심판 채점', to: '/judge-app' },
  { key: 'awards', ic: '🏅', label: '시상', to: '/console/awards' },
  { key: 'scoreboard', ic: '🖥️', label: '전광판', to: '/scoreboard-demo' },
  { key: 'stations', ic: '🎛️', label: 'OBS 설정', to: '/console/stations' },
  { key: 'stats', ic: '📈', label: '통계', to: '/console/stats' },
  { key: 'settings', ic: '⚙️', label: '설정', to: '/console/settings' },
];

export function AdminLayout({ active = 'dashboard', children }) {
  const [railHide, setRailHide] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const onHamburger = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width:760px)').matches) {
      setDrawerOpen((v) => !v);
    } else {
      setRailHide((v) => !v);
    }
  };

  const renderStep = (it) => {
    const cls = `${styles.step} ${active === it.key ? styles.stepOn : ''}`;
    const inner = (<><span className={styles.stepN}>{it.ic}</span> {it.label}</>);
    return it.to
      ? <Link key={it.key} to={it.to} className={cls}>{inner}</Link>
      : <button key={it.key} className={cls}>{inner}</button>;
  };

  return (
    <div className={styles.console}>
      <header className={styles.hdr}>
        <button className={styles.ham} onClick={onHamburger} title="메뉴 접기/펴기">☰</button>
        <Link className={styles.brand} to="/console">
          <img className={styles.brandLogo} src="/brand/weplay-wordmark-white.png" alt="WEPLAY" />
          <img className={styles.brandLogoLight} src="/brand/weplay-wordmark-navy.png" alt="WEPLAY" />
          <span className={styles.wm}>모두의플레이</span>
        </Link>
        <div className={styles.tenant}><span className={styles.tchip} /> 👑 대한줄넘기협회 <span className={styles.car}>▾</span></div>
        <nav className={styles.nav}>
          {TOP_NAV.map((n, i) => (<a key={n} className={i === 0 ? styles.on : undefined}>{n}</a>))}
          <span className={styles.avatar}>나</span>
        </nav>
      </header>

      <div className={`${styles.body} ${railHide ? styles.bodyRailHide : ''}`}>
        <aside className={styles.rail}>
          <div className={styles.cap}>⚙️ 관리 메뉴</div>
          {SIDE_NAV.map(renderStep)}
        </aside>
        <main className={styles.main}>{children}</main>
      </div>

      {drawerOpen && (
        <div className={styles.drawerOpen}>
          {SIDE_NAV.map(renderStep)}
        </div>
      )}
    </div>
  );
}

export default AdminLayout;
