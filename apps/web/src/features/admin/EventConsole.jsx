import styles from './AdminConsole.module.css';
import { AdminLayout } from './AdminLayout';

/* 대회 상세 / 운영 콘솔 (데모 데이터) — /console/event.
   실제 EventDetail/Dashboard 데이터를 이 디자인으로 연결 예정. */

const KPIS = [
  { ic: '🤸', lab: '참가자', num: '320', unit: ' 명', delta: '체크인 286', c: 'var(--mint)' },
  { ic: '🟦', lab: '가동 코트', num: '5', unit: ' / 6', delta: '1 대기', c: 'var(--blue)' },
  { ic: '⏱️', lab: '진행 히트', num: '48', unit: ' / 120', delta: '40% 진행', c: 'var(--cyan)' },
  { ic: '🏅', lab: '시상 완료', num: '12', unit: ' 종목', delta: '남은 8', c: 'var(--butter)' },
];

const COURTS = [
  { n: 1, live: true, ev: '30초 스피드 · 남9', heat: 'HIT 12', who: '김서연 외 5명' },
  { n: 2, live: true, ev: '개인 프리스타일 · 여12', heat: 'HIT 8', who: '박지민 외 3명' },
  { n: 3, live: false, ev: '대기 중', heat: '—', who: '다음 HIT 준비' },
  { n: 4, live: true, ev: '2인 릴레이 · 남15', heat: 'HIT 5', who: '이준호 팀' },
  { n: 5, live: true, ev: '더블더치 · 혼성', heat: 'HIT 9', who: '최유나 팀' },
  { n: 6, live: false, ev: '대기 중', heat: '—', who: '점검 중' },
];

const HEATS = [
  { h: 'HIT 13', court: '코트 1', ev: '30초 스피드 · 남9', cnt: '6명', when: '곧 시작', s: 'live' },
  { h: 'HIT 9', court: '코트 2', ev: '개인 프리스타일 · 여12', cnt: '4명', when: '2분 후', s: 'upcoming' },
  { h: 'HIT 6', court: '코트 4', ev: '2인 릴레이 · 남15', cnt: '8팀', when: '5분 후', s: 'upcoming' },
  { h: 'HIT 10', court: '코트 5', ev: '더블더치 · 혼성', cnt: '5팀', when: '8분 후', s: 'upcoming' },
];

const pillClass = { live: styles.pillLive, upcoming: styles.pillUpcoming, draft: styles.pillDraft, done: styles.pillDone };

export function EventConsole() {
  return (
    <AdminLayout active="events">
      <div className={styles.pageHead}>
        <div className={styles.pageHeadMain}>
          <h1>🏆 2026 전국줄넘기대회 <span className={`${styles.pill} ${styles.pillLive}`}>🔴 진행 중</span></h1>
          <p>📅 06.14 ~ 06.16 · 📍 잠실학생체육관 · 대한줄넘기협회</p>
        </div>
        <div className={styles.pageActs}>
          <button className={`${styles.btn} ${styles.btnPrimary}`}>▶ 라이브 운영</button>
          <button className={`${styles.btn} ${styles.btnGhost}`}>📺 전광판</button>
          <button className={`${styles.btn} ${styles.btnGhost}`}>📊 집계</button>
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
        <div className={styles.bt} style={{ '--c': 'var(--blue)' }}>
          <span className={styles.btIco}>🟦</span> 코트 현황 <span className={styles.btCnt}>6</span>
        </div>
        <div className={styles.courts}>
          {COURTS.map((c) => (
            <div key={c.n} className={`${styles.cc} ${c.live ? styles.ccLive : ''}`}>
              <div className={styles.ccTop}>
                <span className={styles.ccName}>코트 {c.n}</span>
                <span className={`${styles.pill} ${c.live ? styles.pillLive : styles.pillDraft}`}>{c.live ? '🔴 라이브' : '⚪ 대기'}</span>
              </div>
              <div className={styles.ccEvent}>{c.ev}</div>
              <div className={styles.ccMeta}><span>{c.heat}</span><span><b>{c.who}</b></span></div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <div className={styles.ttlRow}>
          <div className={styles.bt} style={{ '--c': 'var(--cyan)', marginBottom: 0 }}>
            <span className={styles.btIco}>⏱️</span> 다가오는 히트
          </div>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>전체 대진 보기 →</button>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>히트</th><th>코트</th><th>종목 · 부</th><th>인원</th><th>예정</th><th style={{ textAlign: 'right' }}>관리</th></tr>
            </thead>
            <tbody>
              {HEATS.map((h) => (
                <tr key={h.h}>
                  <td><span className={styles.tname}>{h.h}</span></td>
                  <td className={styles.dt}>{h.court}</td>
                  <td>{h.ev}</td>
                  <td className={styles.num}>{h.cnt}</td>
                  <td><span className={`${styles.pill} ${pillClass[h.s]}`}>{h.when}</span></td>
                  <td>
                    <div className={styles.acts}>
                      <button className={`${styles.btn} ${styles.btnSm} ${h.s === 'live' ? styles.btnPrimary : styles.btnGhost}`}>{h.s === 'live' ? '▶ 시작' : '⚙️ 편성'}</button>
                      <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>📣 호명</button>
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

export default EventConsole;
