import { useMemo, useState } from 'react';
import styles from './AdminConsole.module.css';
import { AdminLayout } from './AdminLayout';

/* 참가자 관리 (데모) — /console/participants.
   검색(이름/소속) + 체크인 필터 + 체크인 토글. 실제로는 participants API와 연결. */

const SEED = [
  { id: 1, name: '김서연', club: '화성 점프클럽', div: '남자 9세부', ev: '30초 스피드', in: true },
  { id: 2, name: '박도윤', club: '수원 줄넘기', div: '남자 9세부', ev: '30초 스피드', in: true },
  { id: 3, name: '이나영', club: '화성 점프클럽', div: '여자 고등부', ev: '프리스타일', in: false },
  { id: 4, name: '최유나', club: '서울 스카이', div: '여자 9세부', ev: '번갈아뛰기', in: true },
  { id: 5, name: '정하늘', club: '고양 점프', div: '남자 12세부', ev: '2인 릴레이', in: false },
  { id: 6, name: '오시우', club: '인천 더블', div: '혼성부', ev: '더블더치', in: true },
  { id: 7, name: '한지호', club: '대전 점핑', div: '남자 15세부', ev: '30초 스피드', in: false },
  { id: 8, name: '강이안', club: '성남 줄사랑', div: '남자 9세부', ev: '30초 스피드', in: true },
];

const FILTERS = ['전체', '체크인', '미체크인'];

export function ParticipantsConsole() {
  const [rows, setRows] = useState(SEED);
  const [q, setQ] = useState('');
  const [f, setF] = useState('전체');

  const toggle = (id) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, in: !r.in } : r)));

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      const mf = f === '전체' || (f === '체크인' ? r.in : !r.in);
      const ms = !qq || `${r.name} ${r.club}`.toLowerCase().includes(qq);
      return mf && ms;
    });
  }, [rows, q, f]);

  const checkedIn = rows.filter((r) => r.in).length;

  const KPIS = [
    { ic: '🤸', lab: '총 참가자', num: rows.length, unit: '명', c: 'var(--blue)' },
    { ic: '✅', lab: '체크인', num: checkedIn, unit: '명', c: 'var(--mint)' },
    { ic: '⏳', lab: '미체크인', num: rows.length - checkedIn, unit: '명', c: 'var(--butter)' },
    { ic: '🏷️', lab: '종목', num: new Set(rows.map((r) => r.ev)).size, unit: '개', c: 'var(--cyan)' },
  ];

  return (
    <AdminLayout active="participants">
      <div className={styles.pageHead}>
        <div className={styles.pageHeadMain}>
          <h1>🤸 참가자 관리</h1>
          <p>참가자 검색·체크인 관리. CSV로 일괄 등록할 수 있어요.</p>
        </div>
        <div className={styles.pageActs}>
          <button className={`${styles.btn} ${styles.btnGhost}`}>⬆️ CSV 업로드</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`}>＋ 참가자 추가</button>
        </div>
      </div>

      <div className={styles.kpis}>
        {KPIS.map((k) => (
          <div key={k.lab} className={styles.kpi} style={{ '--c': k.c }}>
            <div className={styles.kpiLab}><span className={styles.kpiIc}>{k.ic}</span> {k.lab}</div>
            <div className={styles.kpiNum}>{k.num}<small> {k.unit}</small></div>
          </div>
        ))}
      </div>

      <section className={styles.block}>
        <div className={styles.toolbar}>
          <input className={styles.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 이름 또는 소속 검색" />
          <div className={styles.fchips}>
            {FILTERS.map((x) => (
              <button key={x} className={`${styles.fchip} ${f === x ? styles.fchipOn : ''}`} onClick={() => setF(x)}>{x}</button>
            ))}
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>이름</th><th>소속</th><th>부</th><th>종목</th><th>체크인</th><th style={{ textAlign: 'right' }}>관리</th></tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-3)', padding: '28px 0' }}>검색 결과가 없어요</td></tr>
              ) : list.map((r) => (
                <tr key={r.id}>
                  <td><span className={styles.tname}>{r.name}</span></td>
                  <td className={styles.dt}>{r.club}</td>
                  <td className={styles.dt}>{r.div}</td>
                  <td>{r.ev}</td>
                  <td><span className={`${styles.pill} ${r.in ? styles.pillDone : styles.pillDraft}`}>{r.in ? '✅ 완료' : '⏳ 대기'}</span></td>
                  <td>
                    <div className={styles.acts}>
                      <button className={`${styles.btn} ${styles.btnSm} ${r.in ? styles.btnGhost : styles.btnPrimary}`} onClick={() => toggle(r.id)}>{r.in ? '체크인 취소' : '체크인'}</button>
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

export default ParticipantsConsole;
