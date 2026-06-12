import { useState } from 'react';
import styles from '../ViewerApp.module.css';
import { MY_DASHBOARD as M } from '../data/mockData';

/* 마이페이지 — 프로필 + 주식차트식 기록 그래프 + 기록·영상·참가내역·연습일지
   TODO(backend): M을 GET /me, /me/records, /me/heats, /me/clips, /me/practice 로 교체 */

const PERIODS = ['일', '주', '월'];

// 주식차트식 캔들 차트 (wick=최저~최고, body=평균대). 데이터 구동 SVG.
function RecordChart({ weeks }) {
  const [sel, setSel] = useState(weeks.findIndex((w) => w.sel));
  const all = weeks.flatMap((w) => [w.min, w.max]);
  const lo = Math.min(...all) - 4;
  const hi = Math.max(...all) + 4;
  const y = (v) => 14 + (1 - (v - lo) / (hi - lo)) * 116;
  const x = (i) => 30 + i * (276 / Math.max(1, weeks.length - 1));
  const grid = [hi - 4, Math.round((hi + lo) / 2), lo + 4];
  const s = sel >= 0 ? weeks[sel] : null;

  return (
    <>
      {s && (
        <div className={styles.chartTip}><i /> {s.label} · 평균 {Math.round((s.avgLo + s.avgHi) / 2)} · 최고 {s.max} · 최저 {s.min}</div>
      )}
      <svg viewBox="0 0 330 168" width="100%" style={{ display: 'block' }}>
        {grid.map((g) => (
          <g key={g}>
            <line x1="0" y1={y(g)} x2="330" y2={y(g)} stroke="var(--line)" />
            <text x="4" y={y(g) - 3} fill="var(--gray)" fontSize="9">{g}</text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const c = w.down ? 'var(--coral)' : (i === sel ? 'var(--blue)' : 'var(--cyan)');
          return (
            <g key={w.label} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
              <rect x={x(i) - 14} y="10" width="28" height="130" fill="transparent" />
              <line x1={x(i)} y1={y(w.max)} x2={x(i)} y2={y(w.min)} stroke={c} strokeWidth="2" strokeLinecap="round" />
              <line x1={x(i)} y1={y(w.avgHi)} x2={x(i)} y2={y(w.avgLo)} stroke={c} strokeWidth="11" strokeLinecap="round" />
              {i === sel && <circle cx={x(i)} cy={y(w.avgHi)} r="4" fill="#fff" stroke="var(--blue)" strokeWidth="2" />}
            </g>
          );
        })}
        <g fontSize="9" fill="var(--gray)" textAnchor="middle">
          {weeks.map((w, i) => (i % 2 === 0 ? <text key={w.label} x={x(i)} y="160">{w.label}</text> : null))}
        </g>
      </svg>
      <div className={styles.chartHint}>👆 봉을 누르면 그 주의 평균·최고·최저가 떠요</div>
    </>
  );
}

export function MyTab({ onAddPractice }) {
  const [period, setPeriod] = useState('주');
  const best = Math.max(...M.records.weeks.map((w) => w.max));

  return (
    <div className={styles.pageFade}>
      <div className={styles.myhead}>
        <div className={styles.myAv}>{M.initial}</div>
        <div>
          <div className={styles.myNm}>{M.name}<span className={styles.myLv}>{M.level}</span></div>
          <div className={styles.myMeta}>{M.meta}</div>
          <div className={styles.myStars}>{'⭐'.repeat(Math.min(M.compEntries, 10))} <b>대회 출전 {M.compEntries}회</b></div>
        </div>
      </div>

      <div className={styles.mystat}>
        <div className={styles.mystatS}><div className={styles.mystatV}>{M.stats.entries}<span className={styles.mystatU}>회</span></div><div className={styles.mystatK}>총 출전</div></div>
        <div className={styles.mystatS}><div className={styles.mystatV}>{M.stats.awards}<span className={styles.mystatU}>회</span></div><div className={styles.mystatK}>🏅 수상</div></div>
        <div className={styles.mystatS}><div className={styles.mystatV}>{best}<span className={styles.mystatU}>회</span></div><div className={styles.mystatK}>최고기록</div></div>
      </div>

      <div className={styles.sec} style={{ marginTop: 20 }}>
        <h2 className={styles.secTitle}>📈 내 기록 그래프</h2>
        <span className={styles.cnt}>전체보기</span>
      </div>
      <div className={styles.chartCard}>
        <div className={styles.chartRow}>
          <button className={styles.chartSel}>{M.records.event} ▾</button>
          <span className={styles.periods}>
            {PERIODS.map((p) => (
              <button key={p} className={period === p ? styles.on : ''} onClick={() => setPeriod(p)}>{p}</button>
            ))}
          </span>
        </div>
        <div className={styles.bigRec}>최고 <b>{best}</b> 회 <span className={styles.up}>▲ {best - M.records.weeks[0].max} (2개월)</span></div>
        <RecordChart weeks={M.records.weeks} />
      </div>

      {M.nextHeat && (
        <div className={`${styles.dcard} ${styles.nextCard}`}>
          <div className={`${styles.lbl} ${styles.nextLbl}`}>⏱ 다음 출전</div>
          <div className={styles.nextMain}>{M.nextHeat.court}</div>
          <div className={styles.nextNote}>{M.nextHeat.note}</div>
        </div>
      )}

      <div className={styles.sec} style={{ marginTop: 20 }}>
        <h2 className={styles.secTitle}>🎬 내 출전 영상</h2>
        <span className={styles.cnt}>전체보기</span>
      </div>
      <div className={styles.hscroll}>
        {M.clips.map((c) => (
          <div key={c.id} className={styles.myclip}>
            <div className={styles.myclipT}>▶<span className={styles.dur}>{c.dur}</span></div>
            <div className={styles.myclipC}>{c.type}</div>
            <div className={styles.myclipD}>{c.from}</div>
          </div>
        ))}
      </div>

      <div className={styles.sec} style={{ marginTop: 20 }}>
        <h2 className={styles.secTitle}>🏆 이전 참가 기록</h2>
      </div>
      <div className={styles.dcard}>
        {M.history.map((h) => (
          <div key={h.id} className={styles.histrow}>
            <div className={`${styles.rk} ${h.medal ? styles.rkMedal : ''}`}>{h.rank}</div>
            <div className={styles.info2}><div className={styles.info2T}>{h.title}</div><div className={styles.info2S}>{h.sub}</div></div>
            <div className={styles.score}>{h.score}</div>
          </div>
        ))}
      </div>

      <div className={styles.sec} style={{ marginTop: 20 }}>
        <h2 className={styles.secTitle}>✏️ 직접 기록 (연습일지)</h2>
      </div>
      <div className={styles.dcard}>
        {M.practice.map((p) => (
          <div key={p.id} className={styles.histrow}>
            <div className={styles.rk}>🏃</div>
            <div className={styles.info2}><div className={styles.info2T}>{p.type}</div><div className={styles.info2S}>{p.date}</div></div>
            <div className={styles.score}>{p.score}</div>
          </div>
        ))}
        <button className={styles.recbtn} onClick={onAddPractice}>＋ 오늘 연습 기록 추가</button>
      </div>
    </div>
  );
}

export default MyTab;
