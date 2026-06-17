import styles from '../ViewerApp.module.css';

// 상단 헤더: 햄버거 · 제목/부제 · 알림 · 마이페이지 · LIVE 칩 (테마는 설정에서 관리)
export function AppHeader({ title, subtitle, live, onMenu, onBell, onProfile }) {
  return (
    <header className={styles.hdr}>
      <div className={styles.row}>
        <button className={styles.menubtn} onClick={onMenu} aria-label="메뉴">☰</button>
        <h1 className={styles.title}>{title}</h1>
        <button className={styles.bell} onClick={onBell} aria-label="알림">🔔</button>
        {onProfile && (
          <button className={styles.themeBtn} onClick={onProfile} aria-label="마이페이지">👤</button>
        )}
        {live && (
          <span className={styles.liveChip}><span className={styles.dot} />LIVE</span>
        )}
      </div>
      {subtitle && <div className={styles.subt}>{subtitle}</div>}
    </header>
  );
}

export default AppHeader;
