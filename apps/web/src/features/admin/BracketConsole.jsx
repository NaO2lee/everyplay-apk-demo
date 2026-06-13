import { useState } from 'react';
import styles from './AdminConsole.module.css';
import { AdminLayout } from './AdminLayout';

/* 대진표 / 일정 (데모) — /console/brackets.
   종목마다 시작 HIT 번호가 다를 수 있어 직접 편집(입력) 가능. HIT 범위 자동 계산.
   실제로는 programs/heat-assignments API와 연결 예정. */

const INITIAL = [
  { id: 'p1', name: '30초 스피드', div: '남자 9세부', teams: 24, perHeat: 6, court: 1, startHit: 1 },
  { id: 'p2', name: '개인 프리스타일', div: '여자 12세부', teams: 12, perHeat: 1, court: 2, startHit: 5 },
  { id: 'p3', name: '2인 릴레이', div: '남자 15세부', teams: 16, perHeat: 8, court: 1, startHit: 5 },
  { id: 'p4', name: '더블더치', div: '혼성부', teams: 20, perHeat: 5, court: 3, startHit: 9 },
  { id: 'p5', name: '단체전', div: '전체', teams: 30, perHeat: 1, court: 4, startHit: 1 },
];

const FLAG = { KOR: '🇰🇷', JPN: '🇯🇵', CHN: '🇨🇳', USA: '🇺🇸', TPE: '🇹🇼', HKG: '🇭🇰', THA: '🇹🇭', VNM: '🇻🇳', SGP: '🇸🇬', MAS: '🇲🇾' };
// 대진 보기용 데모 선수(소속·국가). TODO(backend): heat별 배정 선수 API로 교체
const DEMO_ROSTER = [
  { lane: 1, name: '김서연', club: '화성 점프클럽', country: 'KOR' },
  { lane: 2, name: '박도윤', club: '수원 줄넘기', country: 'KOR' },
  { lane: 3, name: 'TANAKA Yuki', club: 'Tokyo Rope', country: 'JPN' },
  { lane: 4, name: '이준', club: '성남 줄사랑', country: 'KOR' },
  { lane: 5, name: 'WANG Lei', club: 'Beijing JR', country: 'CHN' },
  { lane: 6, name: '오시우', club: '인천 더블', country: 'KOR' },
];

const heatCount = (e) => Math.max(1, Math.ceil(e.teams / e.perHeat));

export function BracketConsole() {
  const [events, setEvents] = useState(INITIAL);
  const [saved, setSaved] = useState(false);
  const [viewing, setViewing] = useState(null); // 대진 보기 모달 대상 종목

  const setStart = (id, v) => {
    const n = Math.max(1, parseInt(v, 10) || 1);
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, startHit: n } : e)));
    setSaved(false);
  };

  return (
    <AdminLayout active="brackets">
      <div className={styles.pageHead}>
        <div className={styles.pageHeadMain}>
          <h1>🗓️ 대진표 · 일정</h1>
          <p>종목별 시작 HIT 번호를 직접 정할 수 있어요. (종목마다 시작 번호가 달라도 OK)</p>
        </div>
        <div className={styles.pageActs}>
          <button className={`${styles.btn} ${styles.btnGhost}`}>⚙️ 자동 편성</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setSaved(true)}>{saved ? '✓ 저장됨' : '💾 저장'}</button>
        </div>
      </div>

      <section className={styles.block}>
        <div className={styles.bt} style={{ '--c': 'var(--purple)' }}><span className={styles.btIco}>🤸</span> 종목별 대진 <span className={styles.btCnt}>{events.length}</span></div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>종목 · 부</th><th>참가</th><th>코트</th><th>경기방식</th><th>시작 HIT</th><th>HIT 범위</th><th style={{ textAlign: 'right' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const cnt = heatCount(e);
                const endHit = e.startHit + cnt - 1;
                return (
                  <tr key={e.id}>
                    <td><span className={styles.tname}>{e.name}</span><div className={styles.ovMeta}>{e.div}</div></td>
                    <td className={styles.num}>{e.teams}팀</td>
                    <td className={styles.dt}>코트 {e.court}</td>
                    <td className={styles.dt}>{e.perHeat}팀/HIT</td>
                    <td>
                      <input
                        className={styles.fldIn}
                        style={{ width: 72, padding: '7px 9px', textAlign: 'center' }}
                        type="number"
                        min="1"
                        value={e.startHit}
                        onChange={(ev) => setStart(e.id, ev.target.value)}
                      />
                    </td>
                    <td className={styles.num}><b>HIT {e.startHit}~{endHit}</b> <span className={styles.dt}>({cnt}개)</span></td>
                    <td>
                      <div className={styles.acts}>
                        <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => setViewing(e)}>대진 보기</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {viewing && (
        <>
          <div className={`${styles.logDim} ${styles.logDimOpen}`} onClick={() => setViewing(null)} />
          <div className={styles.modal}>
            <div className={styles.modalHd}>
              <div>
                <div className={styles.modalT}>🗂️ {viewing.name} · {viewing.div}</div>
                <div className={styles.ovMeta}>HIT {viewing.startHit} · 코트 {viewing.court} · {viewing.teams}팀</div>
              </div>
              <button className={styles.logX} onClick={() => setViewing(null)} aria-label="닫기">×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>레인</th><th>선수</th><th>소속</th><th>국가</th></tr></thead>
                  <tbody>
                    {DEMO_ROSTER.map((r) => (
                      <tr key={r.lane}>
                        <td className={styles.num}>{r.lane}</td>
                        <td><span className={styles.tname}>{r.name}</span></td>
                        <td className={styles.dt}>{r.club}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{FLAG[r.country] || '🏳️'} {r.country}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

export default BracketConsole;
