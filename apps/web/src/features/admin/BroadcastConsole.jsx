import styles from './AdminConsole.module.css';
import { AdminLayout } from './AdminLayout';

/* 중계(송출) 콘솔 (데모 데이터) — /console/broadcast.
   코트별 OBS/유튜브 송출 상태 운영. 실제 OBS/SSE 데이터 연결 예정. */

const KPIS = [
  { ic: '📡', lab: '송출 중 코트', num: '4', unit: ' / 6', delta: '1 재연결 중', c: 'var(--red)' },
  { ic: '👁️', lab: '동시 시청자', num: '1,240', unit: ' 명', delta: '＋128 (10분)', c: 'var(--cyan)' },
  { ic: '⏱️', lab: '평균 지연', num: '4.2', unit: '초', delta: '안정', c: 'var(--mint)' },
  { ic: '⏺️', lab: '녹화', num: 'ON', unit: '', delta: '전 코트 저장 중', c: 'var(--butter)' },
];

// obs: 'on'|'warn'|'off'
const COURTS = [
  { n: 1, live: true, obs: 'on', ev: '30초 스피드 · 남9', heat: 'HIT 12', viewers: '412' },
  { n: 2, live: true, obs: 'on', ev: '개인 프리스타일 · 여12', heat: 'HIT 8', viewers: '305' },
  { n: 3, live: false, obs: 'on', ev: '대기 중', heat: '—', viewers: '0' },
  { n: 4, live: true, obs: 'on', ev: '2인 릴레이 · 남15', heat: 'HIT 5', viewers: '288' },
  { n: 5, live: true, obs: 'warn', ev: '더블더치 · 혼성', heat: 'HIT 9', viewers: '235' },
  { n: 6, live: false, obs: 'off', ev: '점검 중', heat: '—', viewers: '0' },
];

const OBS = {
  on: { cls: 'sdotOn', t: 'OBS 연결됨' },
  warn: { cls: 'sdotWarn', t: 'OBS 재연결 중' },
  off: { cls: 'sdotOff', t: 'OBS 끊김' },
};

export function BroadcastConsole() {
  return (
    <AdminLayout active="broadcast">
      <div className={styles.pageHead}>
        <div className={styles.pageHeadMain}>
          <h1>📺 중계 송출 <span className={`${styles.pill} ${styles.pillLive}`}>🔴 송출 중</span></h1>
          <p>2026 전국줄넘기대회 · 코트별 OBS/유튜브 송출을 한 곳에서 운영하세요.</p>
        </div>
        <div className={styles.pageActs}>
          <button className={`${styles.btn} ${styles.btnPrimary}`}>▶ 전체 송출 시작</button>
          <button className={`${styles.btn} ${styles.btnGhost}`}>⏹ 전체 중지</button>
          <button className={`${styles.btn} ${styles.btnGhost}`}>📺 전광판 열기</button>
        </div>
      </div>

      <div className={styles.kpis}>
        {KPIS.map((k) => (
          <div key={k.lab} className={styles.kpi} style={{ '--c': k.c }}>
            <div className={styles.kpiLab}><span className={styles.kpiIc}>{k.ic}</span> {k.lab}</div>
            <div className={styles.kpiNum}>{k.num}<small>{k.unit}</small></div>
            <div className={styles.kpiDelta}>{k.delta}</div>
          </div>
        ))}
      </div>

      <section className={styles.block}>
        <div className={styles.bt} style={{ '--c': 'var(--red)' }}>
          <span className={styles.btIco}>📡</span> 코트별 송출 현황 <span className={styles.btCnt}>6</span>
        </div>
        <div className={styles.courts}>
          {COURTS.map((c) => {
            const obs = OBS[c.obs];
            return (
              <div key={c.n} className={`${styles.cc} ${c.live ? styles.ccLive : ''}`}>
                <div className={`${styles.ccThumb} ${c.live ? styles.ccThumbLive : ''}`}>
                  {c.live ? '🎥' : '📷'}
                  {c.live && <span className={`${styles.pill} ${styles.pillLive} ${styles.ccLiveBadge}`}>🔴 LIVE</span>}
                  <span className={styles.ccView}>👁 {c.viewers}</span>
                </div>
                <div className={styles.ccTop}>
                  <span className={styles.ccName}>코트 {c.n}</span>
                  <span className={`${styles.pill} ${c.live ? styles.pillLive : styles.pillDraft}`}>{c.live ? '🔴 송출' : '⚪ 대기'}</span>
                </div>
                <div className={styles.ccEvent}>{c.ev}</div>
                <div className={styles.ccStat}><span className={`${styles.sdot} ${styles[obs.cls]}`} /> {obs.t} · {c.heat}</div>
                <div className={styles.ccActions}>
                  <button className={`${styles.btn} ${styles.btnSm} ${c.live ? styles.btnGhost : styles.btnPrimary}`}>{c.live ? '⏹ 중지' : '▶ 송출'}</button>
                  <button className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}>🔍 미리보기</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </AdminLayout>
  );
}

export default BroadcastConsole;
