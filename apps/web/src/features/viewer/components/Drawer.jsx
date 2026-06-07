import styles from '../ViewerApp.module.css';
import { DRAWER_MENU } from '../data/mockData';

// 햄버거 메뉴 드로어 (왼쪽 슬라이드)
export function Drawer({ open, onClose, onItem }) {
  return (
    <>
      <div className={`${styles.ddim} ${open ? styles.ddimOn : ''}`} onClick={onClose} />
      <aside className={`${styles.drawer} ${open ? styles.drawerOn : ''}`}>
        <div className={styles.dwprof}>
          <div className={styles.dwAv}>게</div>
          <div className={styles.dwNm}>게스트님</div>
          <div className={styles.dwLg}>로그인하고 내 선수 알림 받기 →</div>
        </div>
        <div className={styles.dwlist}>
          {DRAWER_MENU.map((group) => (
            <div key={group.section}>
              <div className={styles.dwsec}>{group.section}</div>
              {group.items.map((it) => (
                <div key={it.label} className={styles.dwi} onClick={() => onItem?.(it)}>
                  <span className={styles.dwiIc}>{it.ic}</span>
                  {it.label}
                  {it.badge && <span className={styles.badge2}>{it.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className={styles.dwft}>모두의플레이 · 위플레이 v1.0</div>
      </aside>
    </>
  );
}

export default Drawer;
