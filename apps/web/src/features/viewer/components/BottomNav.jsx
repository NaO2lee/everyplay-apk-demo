import styles from '../ViewerApp.module.css';

const TABS = [
  { key: 'live', ic: '📺', label: '중계' },
  { key: 'vod', ic: '🎞️', label: '기록영상' },
  { key: 'cal', ic: '📅', label: '대회일정' },
  { key: 'my', ic: '👤', label: 'MY' },
];

// 하단 4탭 네비게이션
export function BottomNav({ active, onChange }) {
  return (
    <nav className={styles.tabbar}>
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`${styles.tab} ${active === t.key ? styles.tabOn : ''}`}
          onClick={() => onChange(t.key)}
        >
          <span className={styles.tabIc}>{t.ic}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

export default BottomNav;
