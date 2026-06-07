import { useState } from 'react';
import styles from '../ViewerApp.module.css';
import { VOD_GROUPS, VOD_FILTERS } from '../data/mockData';

// 기록 영상 탭 — 일자별·종목별 다시보기
// TODO(backend): VOD_GROUPS를 GET /public/events/{code}/clips 결과로 교체
export function VodTab() {
  const [filter, setFilter] = useState('전체');

  const groups = VOD_GROUPS.map((g) => ({
    ...g,
    clips: filter === '전체' ? g.clips : g.clips.filter((c) => c.type === filter),
  })).filter((g) => g.clips.length > 0);

  return (
    <div className={styles.pageFade}>
      <div className={styles.sec} style={{ marginTop: 8 }}>
        <h2 className={styles.secTitle}>기록 영상</h2>
        <span className={styles.cnt}>지난 경기 다시보기</span>
      </div>

      <div className={styles.filterbar}>
        {VOD_FILTERS.map((f) => (
          <button
            key={f}
            className={`${styles.fchip} ${filter === f ? styles.fchipOn : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g.date}>
          <div className={styles.datehd}>{g.date}</div>
          {g.clips.map((c) => (
            <div key={c.id} className={styles.vod}>
              <div className={styles.vthumb}>▶<span className={styles.dur}>{c.dur}</span></div>
              <div>
                <div className={styles.vt}>{c.court}</div>
                <div className={styles.vs}>{c.who}</div>
                <span className={styles.vtag}>{c.type}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default VodTab;
