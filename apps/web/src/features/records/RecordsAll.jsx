import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MY_DASHBOARD as M } from '../viewer/data/mockData';
import styles from './Records.module.css';

/* 기록 전체보기 (데모) — /records/demo?tab=comp|practice. MY에서 "전체보기"로 진입.
   참가 기록(대회) / 연습 일지 전체 목록. TODO(backend): GET /me/heats, /me/practice */

const TABS = [['comp', '참가 기록'], ['practice', '연습 일지']];

export function RecordsAll() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    return t === 'practice' ? 'practice' : 'comp';
  });

  return (
    <div className={styles.screen}>
      <div className={styles.bar}>
        <button className={styles.back} onClick={() => navigate(-1)} aria-label="뒤로">←</button>
        <span className={styles.barT}>내 기록 전체보기</span>
      </div>

      <div className={styles.tabs}>
        {TABS.map(([k, label]) => (
          <button key={k} className={`${styles.tab} ${tab === k ? styles.tabOn : ''}`} onClick={() => setTab(k)}>
            {label} {k === 'comp' ? M.history.length : M.practice.length}
          </button>
        ))}
      </div>

      <div className={styles.scr}>
        {tab === 'comp' ? (
          <>
            <div className={styles.cnt}>출전한 대회 {M.history.length}개</div>
            <div className={styles.card}>
              {M.history.map((h) => (
                <div key={h.id} className={styles.row}>
                  <div className={`${styles.rk} ${h.medal ? styles.rkMedal : ''}`}>{h.rank}</div>
                  <div className={styles.info}><div className={styles.t}>{h.title}</div><div className={styles.s}>{h.sub}</div></div>
                  <div className={styles.score}>{h.score}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className={styles.cnt}>연습 일지 {M.practice.length}개</div>
            <div className={styles.card}>
              {M.practice.map((p) => (
                <div key={p.id} className={styles.row}>
                  <div className={styles.rk}>🏃</div>
                  <div className={styles.info}><div className={styles.t}>{p.type}</div><div className={styles.s}>{p.date}</div></div>
                  <div className={styles.score}>{p.score}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default RecordsAll;
