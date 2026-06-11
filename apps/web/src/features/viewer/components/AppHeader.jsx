import styles from '../ViewerApp.module.css';

// 상단 헤더: 햄버거 · 제목/부제 · 테마토글 · 알림 · LIVE 칩
export function AppHeader({ title, subtitle, live, theme, onToggleTheme, onMenu, onBell }) {
  return (
    <header className={styles.hdr}>
      <div className={styles.row}>
        <button className={styles.menubtn} onClick={onMenu} aria-label="메뉴">☰</button>
        <h1 className={styles.title}>{title}</h1>
        {onToggleTheme && (
          <button className={styles.themeBtn} onClick={onToggleTheme} aria-label="테마 전환">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        )}
        <button className={styles.bell} onClick={onBell} aria-label="알림">🔔</button>
        {live && (
          <span className={styles.liveChip}><span className={styles.dot} />LIVE</span>
        )}
      </div>
      {subtitle && <div className={styles.subt}>{subtitle}</div>}
    </header>
  );
}

export default AppHeader;
