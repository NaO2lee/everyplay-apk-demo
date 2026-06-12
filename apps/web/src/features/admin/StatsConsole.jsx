import styles from './AdminConsole.module.css';
import { AdminLayout } from './AdminLayout';

/* 통계 (데모) — /console/stats. 실제로는 집계 API와 연결. */

const KPIS = [
  { ic: '🤸', lab: '누적 참가자', num: '3,481', unit: '명', delta: '＋214 이번 달', c: 'var(--mint)' },
  { ic: '🏆', lab: '개최 대회', num: '34', unit: '개', delta: '올해 12', c: 'var(--blue)' },
  { ic: '👁️', lab: '누적 시청', num: '128K', unit: '뷰', delta: '＋18%', c: 'var(--cyan)' },
  { ic: '🎬', lab: '저장 클립', num: '2,940', unit: '개', delta: '＋132', c: 'var(--butter)' },
];

const BY_EVENT = [
  { label: '30초 스피드', v: 1240 },
  { label: '더블더치', v: 860 },
  { label: '프리스타일', v: 540 },
  { label: '2인 릴레이', v: 480 },
  { label: '단체전', v: 361 },
];
const BY_DAY = [
  { label: '월', v: 9 }, { label: '화', v: 12 }, { label: '수', v: 7 },
  { label: '목', v: 14 }, { label: '금', v: 22 }, { label: '토', v: 41 }, { label: '일', v: 38 },
];

function Bars({ data, unit }) {
  const max = Math.max(...data.map((d) => d.v));
  return (
    <div className={styles.barChart}>
      {data.map((d) => (
        <div key={d.label} className={styles.barRow}>
          <span className={styles.barLabel}>{d.label}</span>
          <span className={styles.barTrack}><span className={styles.barFill} style={{ width: `${(d.v / max) * 100}%` }} /></span>
          <span className={styles.barVal}>{d.v.toLocaleString()}{unit}</span>
        </div>
      ))}
    </div>
  );
}

export function StatsConsole() {
  return (
    <AdminLayout active="stats">
      <div className={styles.ph}>
        <h1>📈 통계</h1>
        <p>대회·참가·시청 지표를 한눈에. (기간/대회별 필터는 백엔드 연결 후)</p>
      </div>

      <div className={styles.kpis}>
        {KPIS.map((k) => (
          <div key={k.lab} className={styles.kpi} style={{ '--c': k.c }}>
            <div className={styles.kpiLab}><span className={styles.kpiIc}>{k.ic}</span> {k.lab}</div>
            <div className={styles.kpiNum}>{k.num}<small> {k.unit}</small></div>
            <div className={styles.kpiDelta}>{k.delta}</div>
          </div>
        ))}
      </div>

      <div className={styles.twoCol}>
        <section className={styles.block}>
          <div className={styles.bt} style={{ '--c': 'var(--blue)' }}><span className={styles.btIco}>🏷️</span> 종목별 참가자</div>
          <Bars data={BY_EVENT} unit="명" />
        </section>
        <section className={styles.block}>
          <div className={styles.bt} style={{ '--c': 'var(--cyan)' }}><span className={styles.btIco}>👁️</span> 요일별 시청자 (천명)</div>
          <Bars data={BY_DAY} unit="K" />
        </section>
      </div>
    </AdminLayout>
  );
}

export default StatsConsole;
