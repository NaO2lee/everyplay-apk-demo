import { Tv, Film, CalendarDays, User } from 'lucide-react';
import styles from '../ViewerApp.module.css';

// 하단 4탭 — 고정 푸터. 모노크롬 아이콘(선택만 색 + 글로우 포인트).
const TABS = [
  { key: 'live', Icon: Tv, label: '중계' },
  { key: 'vod', Icon: Film, label: '기록영상' },
  { key: 'cal', Icon: CalendarDays, label: '대회일정' },
  { key: 'my', Icon: User, label: 'MY' },
];

export function BottomNav({ active, onChange }) {
  return (
    <nav className={styles.tabbar}>
      {TABS.map((t) => {
        const on = active === t.key;
        const Icon = t.Icon;
        return (
          <button
            key={t.key}
            className={`${styles.tab} ${on ? styles.tabOn : ''}`}
            onClick={() => onChange(t.key)}
            aria-current={on ? 'page' : undefined}
          >
            <span className={styles.tabIcWrap}>
              <Icon size={21} strokeWidth={on ? 2.6 : 2} />
            </span>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

export default BottomNav;
