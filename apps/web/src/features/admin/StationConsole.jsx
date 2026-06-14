import { useState } from 'react';
import styles from './AdminConsole.module.css';
import { AdminLayout } from './AdminLayout';

/* OBS 스테이션 설정 (앱 디자인, 데모) — /console/stations.
   5월 StationSettings 로직(api.setStationObsConfig: obs_host/port/password, youtube url/key/offset) 연결 예정.
   TODO(backend): DEMO → api.getEvent(stations) + setStationObsConfig 로 교체. */

const DEMO = [
  { n: 1, name: '본부 PC', host: '192.168.0.11', port: 4455, yt: 'https://youtube.com/live/court1', connected: true },
  { n: 2, name: '맥북 2호', host: '192.168.0.12', port: 4455, yt: 'https://youtube.com/live/court2', connected: true },
  { n: 3, name: '코트3 PC', host: '192.168.0.13', port: 4455, yt: '', connected: false },
  { n: 4, name: '코트4 PC', host: '192.168.0.14', port: 4455, yt: 'https://youtube.com/live/court4', connected: true },
];

export function StationConsole() {
  const [rows, setRows] = useState(DEMO);
  const [saved, setSaved] = useState(true);
  const patch = (n, p) => { setRows((rs) => rs.map((r) => (r.n === n ? { ...r, ...p } : r))); setSaved(false); };

  return (
    <AdminLayout active="stations">
      <div className={styles.ttlRow}>
        <div className={styles.ph} style={{ marginBottom: 0 }}>
          <h1>🎛️ OBS · 스테이션 설정</h1>
          <p>코트별 OBS(WebSocket)·유튜브 송출 정보를 설정하세요.</p>
        </div>
        <div className={styles.pageActs}>
          <button className={`${styles.btn} ${styles.btnGhost}`}>🔌 전체 연결 확인</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setSaved(true)}>{saved ? '✓ 저장됨' : '💾 저장'}</button>
        </div>
      </div>

      <div className={styles.obsGrid}>
        {rows.map((r) => (
          <div key={r.n} className={styles.obsCard}>
            <div className={styles.obsHead}>
              <span className={styles.obsNo}>{r.n}</span>
              <span className={styles.obsName}>코트 {r.n}</span>
              <span className={styles.obsStat} style={{ color: r.connected ? 'var(--mint)' : 'var(--ink-3)' }}>
                <span className={`${styles.sdot} ${r.connected ? styles.sdotOn : styles.sdotOff}`} /> {r.connected ? 'OBS 연결됨' : '끊김'}
              </span>
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>표시명</label>
              <input className={styles.fldIn} value={r.name} onChange={(e) => patch(r.n, { name: e.target.value })} />
            </div>
            <div className={styles.fldRow}>
              <div className={styles.fld}>
                <label className={styles.fldL}>OBS 호스트</label>
                <input className={styles.fldIn} value={r.host} onChange={(e) => patch(r.n, { host: e.target.value })} placeholder="192.168.0.10" />
              </div>
              <div className={styles.fld}>
                <label className={styles.fldL}>포트</label>
                <input className={styles.fldIn} type="number" value={r.port} onChange={(e) => patch(r.n, { port: Number(e.target.value) || 4455 })} />
              </div>
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>OBS 비밀번호</label>
              <input className={styles.fldIn} type="password" placeholder="변경 시에만 입력" onChange={() => setSaved(false)} />
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>유튜브 송출 URL</label>
              <input className={styles.fldIn} value={r.yt} onChange={(e) => patch(r.n, { yt: e.target.value })} placeholder="https://youtube.com/live/..." />
            </div>
            <div className={styles.swActs}>
              <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>🔌 연결 테스트</button>
              <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>▶ 송출 시작</button>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}

export default StationConsole;
