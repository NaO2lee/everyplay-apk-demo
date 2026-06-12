import { useEffect, useRef, useState } from 'react';
import styles from './AdminConsole.module.css';
import { AdminLayout } from './AdminLayout';

/* 경기 진행(러너) 콘솔 (데모) — /console/runner.
   현재 히트 준비→시작→종료→다음 자동 + 키보드 단축키(R/S/E/N).
   실제로는 startHeat/endHeat API + 다음 히트 자동 편성과 연결 예정. */

const QUEUE = [
  { hit: 12, court: 1, ev: '30초 스피드', div: '남자 9세부', players: ['김서연', '박도윤', '이준', '최민', '정하늘', '오시우'] },
  { hit: 13, court: 1, ev: '30초 스피드', div: '남자 9세부', players: ['한지호', '서준', '강이안', '윤서우', '임도현', '조하준'] },
  { hit: 14, court: 1, ev: '2인 릴레이', div: '남자 12세부', players: ['김팀A·B', '이팀A·B', '박팀A·B', '최팀A·B'] },
  { hit: 15, court: 1, ev: '더블더치', div: '혼성부', players: ['1조', '2조', '3조', '4조', '5조'] },
];

const STATUS = {
  ready: { cls: 'pillUpcoming', label: '⏳ 준비' },
  live: { cls: 'pillLive', label: '🔴 진행 중' },
  done: { cls: 'pillDone', label: '✅ 종료' },
};

function fmt(s) { return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

export function RunnerConsole() {
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState('ready');
  const [sec, setSec] = useState(0);
  const [auto, setAuto] = useState(true);
  const timer = useRef(null);
  const cur = QUEUE[idx];

  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  const start = () => { setStatus('live'); setSec(0); stop(); timer.current = setInterval(() => setSec((s) => s + 1), 1000); };
  const ready = () => { stop(); setStatus('ready'); setSec(0); };
  const end = () => { stop(); setStatus('done'); };
  const next = () => { stop(); setIdx((i) => Math.min(i + 1, QUEUE.length - 1)); setStatus('ready'); setSec(0); };

  useEffect(() => () => stop(), []);

  // 종료 시 자동 다음
  useEffect(() => {
    if (status === 'done' && auto) {
      const t = setTimeout(() => { if (idx < QUEUE.length - 1) next(); }, 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [status, auto, idx]);

  // 키보드 단축키
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'r') ready();
      else if (k === 's' || e.key === ' ') { e.preventDefault(); start(); }
      else if (k === 'e') end();
      else if (k === 'n') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx]);

  const st = STATUS[status];

  return (
    <AdminLayout active="runner">
      <div className={styles.pageHead}>
        <div className={styles.pageHeadMain}>
          <h1>🏃 경기 진행 <span className={`${styles.pill} ${styles[st.cls]}`}>{st.label}</span></h1>
          <p>현재 히트를 준비·시작·종료하고 다음 히트로 넘어가세요. 키보드로도 조작돼요.</p>
        </div>
        <div className={styles.pageActs}>
          <span className={`${styles.chk} ${auto ? styles.chkOn : ''}`} onClick={() => setAuto((v) => !v)} style={{ alignSelf: 'center' }}><span className={styles.chkBox}>✓</span> 다음 히트 자동</span>
        </div>
      </div>

      <div className={styles.runHero}>
        <div className={styles.runHit}>
          <span className={styles.runHitL}>현재 HIT</span>
          <span className={styles.runBig}>{cur.hit}</span>
          <span className={styles.runHitL}>코트 {cur.court}</span>
        </div>
        <div className={styles.runMid}>
          <div className={styles.runEv}>{cur.ev} · {cur.div}</div>
          <div className={styles.runMeta}>출전 {cur.players.length}명/팀</div>
          <div className={styles.runPlayers}>
            {cur.players.map((p) => <span key={p} className={styles.runChip}>{p}</span>)}
          </div>
        </div>
        <div className={styles.runRight}>
          <span className={styles.runTimer}>{fmt(sec)}</span>
          <span className={`${styles.pill} ${styles[st.cls]} ${styles.runStatus}`}>{st.label}</span>
        </div>
      </div>

      <div className={styles.runCtrls}>
        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={ready}>⏳ 준비 <small style={{ opacity: .6 }}>(R)</small></button>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={start}>▶ 시작 <small style={{ opacity: .7 }}>(S)</small></button>
        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={end}>■ 종료 <small style={{ opacity: .6 }}>(E)</small></button>
        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={next}>⏭ 다음 히트 <small style={{ opacity: .6 }}>(N)</small></button>
      </div>
      <div className={styles.kbdHint}>⌨️ <b>R</b> 준비 <b>S</b> 시작 <b>E</b> 종료 <b>N</b> 다음</div>

      <section className={styles.block}>
        <div className={styles.bt} style={{ '--c': 'var(--blue)' }}><span className={styles.btIco}>📋</span> 대기 히트 <span className={styles.btCnt}>{QUEUE.length - idx - 1}</span></div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>HIT</th><th>코트</th><th>종목 · 부</th><th>인원</th><th style={{ textAlign: 'right' }}>관리</th></tr></thead>
            <tbody>
              {QUEUE.map((h, i) => (
                <tr key={h.hit} style={{ opacity: i < idx ? 0.45 : 1 }}>
                  <td><span className={styles.tname}>HIT {h.hit}</span></td>
                  <td className={styles.dt}>코트 {h.court}</td>
                  <td>{h.ev} · {h.div}</td>
                  <td className={styles.num}>{h.players.length}</td>
                  <td>
                    <div className={styles.acts}>
                      {i === idx ? <span className={`${styles.pill} ${styles[st.cls]}`}>{st.label}</span>
                        : i < idx ? <span className={`${styles.pill} ${styles.pillDone}`}>종료</span>
                          : <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => { setIdx(i); ready(); }}>이 히트로</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  );
}

export default RunnerConsole;
