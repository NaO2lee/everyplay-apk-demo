import styles from '../ViewerApp.module.css';
import { SCHEDULE } from '../data/mockData';

// 대회 일정 탭 — 포스터형 카드 (주최·일자·장소·신청)
// TODO(backend): SCHEDULE을 협회 수집 데이터(또는 대회 일정 API)로 교체
export function ScheduleTab() {
  return (
    <div className={styles.pageFade}>
      <div className={styles.sec} style={{ marginTop: 8 }}>
        <h2 className={styles.secTitle}>다가오는 대회</h2>
        <span className={styles.cnt}>국내 일정</span>
      </div>
      <div className={styles.autobadge}>🔄 대한민국줄넘기협회 정보 자동 업데이트</div>

      {SCHEDULE.map((s) => (
        <div key={s.id} className={styles.poster}>
          <div className={styles.pbanner}>
            <span className={styles.ribbon}>{s.status}</span>
            <div className={styles.dday}>{s.dday}<small> · {s.dateShort}</small></div>
          </div>
          <div className={styles.pbody}>
            <h3 className={styles.posterTitle}>{s.title}</h3>
            <div className={styles.pinfo}>
              <div className={styles.pli}><span className={styles.pliIc}>📅</span>{s.date}</div>
              <div className={styles.pli}><span className={styles.pliIc}>📍</span>{s.place}</div>
              <div className={styles.pli}><span className={styles.pliIc}>🏢</span>주최 {s.host}</div>
            </div>
            <div className={styles.papply}>
              <a className={styles.papplyGo} href={s.applyUrl}>신청하러 가기 →</a>
              <button className={styles.papplySub}>상세</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ScheduleTab;
