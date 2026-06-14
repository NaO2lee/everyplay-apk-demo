import { useState } from 'react';
import styles from './AdminConsole.module.css';
import { AdminLayout } from './AdminLayout';

/* 시상 (앱 디자인, 데모) — /console/awards.
   5월 AdminAwards 로직(/api/v1/awards/from-heat, /awards/event, transition) 연결 예정.
   TODO(backend): DEMO_AWARDS → awards API로 교체. */

const FLAG = { KOR: '🇰🇷', JPN: '🇯🇵', CHN: '🇨🇳' };
const PODIUM = [
  { rank: 2, medal: '🥈', name: '박도윤', team: '수원 줄넘기', country: 'KOR', score: '148회', c: 'var(--ink-2)' },
  { rank: 1, medal: '🥇', name: '김서연', team: '화성 점프클럽', country: 'KOR', score: '156회', c: 'var(--butter)' },
  { rank: 3, medal: '🥉', name: 'TANAKA', team: 'Tokyo Rope', country: 'JPN', score: '141회', c: 'var(--coral)' },
];
const AWARDS = [
  { ev: '30초 스피드 · 남9', status: 'called', label: '🔔 호명 중' },
  { ev: '개인 프리스타일 · 여12', status: 'done', label: '✅ 시상 완료' },
  { ev: '2인 릴레이 · 남15', status: 'created', label: '⏳ 대기' },
  { ev: '더블더치 · 혼성', status: 'created', label: '⏳ 대기' },
];
const pill = { called: styles.pillUpcoming, done: styles.pillDone, created: styles.pillDraft };

export function AwardsConsole() {
  const [sel, setSel] = useState('30초 스피드 · 남9');
  return (
    <AdminLayout active="awards">
      <div className={styles.ttlRow}>
        <div className={styles.ph} style={{ marginBottom: 0 }}>
          <h1>🏅 시상</h1>
          <p>히트 결과로 1·2·3위를 자동 생성하고 호명·시상 진행.</p>
        </div>
        <button className={`${styles.btn} ${styles.btnPrimary}`}>➕ 히트에서 시상 생성</button>
      </div>

      <section className={styles.block}>
        <div className={styles.bt} style={{ '--c': 'var(--butter)' }}><span className={styles.btIco}>🏆</span> {sel}</div>
        <div className={styles.podium}>
          {PODIUM.map((p) => (
            <div key={p.rank} className={`${styles.podCol} ${p.rank === 1 ? styles.pod1 : ''}`} style={{ '--c': p.c }}>
              <div className={styles.podMedal}>{p.medal}</div>
              <div className={styles.podRank}>{p.rank}위</div>
              <div className={styles.podName}>{FLAG[p.country]} {p.name}</div>
              <div className={styles.podTeam}>{p.team}</div>
              <div className={styles.podScore}>{p.score}</div>
            </div>
          ))}
        </div>
        <div className={styles.acts} style={{ justifyContent: 'center', gap: 8 }}>
          <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>📢 수상자 호명</button>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>✅ 시상 완료</button>
        </div>
      </section>

      <section className={styles.block}>
        <div className={styles.bt} style={{ '--c': 'var(--cyan)' }}><span className={styles.btIco}>📋</span> 종목별 시상 현황</div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>종목 · 부</th><th>상태</th><th style={{ textAlign: 'right' }}>관리</th></tr></thead>
            <tbody>
              {AWARDS.map((a) => (
                <tr key={a.ev} onClick={() => setSel(a.ev)} style={{ cursor: 'pointer' }}>
                  <td><span className={styles.tname}>{a.ev}</span></td>
                  <td><span className={`${styles.pill} ${pill[a.status]}`}>{a.label}</span></td>
                  <td><div className={styles.acts}><button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>포디움 보기</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  );
}

export default AwardsConsole;
