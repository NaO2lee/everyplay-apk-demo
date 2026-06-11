import { useState } from 'react';
import styles from '../ViewerApp.module.css';
import { VOD_GROUPS, VOD_FILTERS } from '../data/mockData';

// 기록 영상 탭 — 검색(이름/HIT) + 종목·수상 필터 + 일자별 다시보기
// TODO(backend): VOD_GROUPS를 GET /public/events/{code}/clips 결과로 교체
export function VodTab() {
  const [filter, setFilter] = useState('전체');
  const [q, setQ] = useState('');

  const qq = q.trim().toLowerCase();
  const matchFilter = (c) => filter === '전체' || (filter === '🏅 수상' ? !!c.award : c.type === filter);
  const matchSearch = (c) => !qq || `${c.who} ${c.court}`.toLowerCase().includes(qq);

  const groups = VOD_GROUPS
    .map((g) => ({ ...g, clips: g.clips.filter((c) => matchFilter(c) && matchSearch(c)) }))
    .filter((g) => g.clips.length > 0);

  return (
    <div className={styles.pageFade}>
      <div className={styles.sec} style={{ marginTop: 8 }}>
        <h2 className={styles.secTitle}>기록 영상</h2>
        <span className={styles.cnt}>지난 경기 다시보기</span>
      </div>

      <input
        className={styles.vodSearch}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 선수 이름 또는 HIT 번호 검색"
      />

      <div className={styles.filterbar}>
        {VOD_FILTERS.map((f) => (
          <button key={f} className={`${styles.fchip} ${filter === f ? styles.fchipOn : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className={styles.vEmpty}>검색 결과가 없어요</div>
      ) : groups.map((g) => (
        <div key={g.date}>
          <div className={styles.datehd}>{g.date}</div>
          {g.clips.map((c) => (
            <div key={c.id} className={styles.vod}>
              <div className={styles.vthumb}>▶<span className={styles.dur}>{c.dur}</span></div>
              <div>
                <div className={styles.vt}>{c.court}{c.award && <span className={styles.vAward}>{c.award}</span>}</div>
                <div className={styles.vs}>{c.who}</div>
                <div>
                  <span className={styles.vtag}>{c.type}</span>
                  {c.award && (
                    <span className={styles.vtag} style={{ marginLeft: 6, color: 'var(--butter)', background: 'color-mix(in srgb,var(--butter) 16%,transparent)' }}>🏅 수상</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default VodTab;
