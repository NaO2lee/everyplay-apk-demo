import { useState } from 'react';
import styles from './AdminConsole.module.css';

/* 관리자 콘솔 (v3 디자인 — 실제 React).
   지금은 데모 데이터로 렌더(/console). 승인 후 실제 페이지/데이터를 이 셸 안으로 이식. */

const KPIS = [
  { ic: '🔴', lab: '진행 중 대회', num: '2', unit: ' 개', delta: '＋1 이번 주', c: 'var(--red)' },
  { ic: '📅', lab: '예정 대회', num: '5', unit: ' 개', delta: '다음 대회 D-12', c: 'var(--blue)' },
  { ic: '🤸', lab: '누적 참가자', num: '3,481', unit: ' 명', delta: '＋214 이번 달', c: 'var(--mint)' },
  { ic: '💳', lab: '이번 달 정산', num: '₩6.2', unit: 'M', delta: '＋18%', c: 'var(--butter)' },
];

const ASSOCIATIONS = [
  { key: 'knja', logo: '줄', bg: 'var(--grad)', nm: '대한줄넘기협회', role: 'owner', roleLabel: '👑 OWNER', plan: 'pro 플랜', comp: 34, players: '2,140' },
  { key: 'seoul', logo: '서', bg: 'linear-gradient(135deg,#5BA8FF,#3a6bc0)', nm: '서울줄넘기연맹', role: 'op', roleLabel: 'OPERATOR', plan: 'team 플랜', comp: 12, players: '880' },
  { key: 'gg', logo: '경', bg: 'linear-gradient(135deg,#34D4A6,#0f8f6c)', nm: '경기줄넘기협회', role: 'op', roleLabel: 'OPERATOR', plan: 'free 플랜', comp: 7, players: '461' },
];

const COMPETITIONS = [
  { name: '2026 전국줄넘기대회', date: '06.14 ~ 06.16', place: '📍 잠실학생체육관', fee: '₩ 15,000', status: 'live', label: '🔴 진행 중', acts: [{ t: '▶ 운영', p: true }, { t: '📊 집계' }, { t: '📺 전광판' }] },
  { name: '서울시 줄넘기 챔피언십', date: '06.28', place: '📍 올림픽공원 SK핸드볼', fee: '₩ 12,000', status: 'upcoming', label: '🔵 예정', acts: [{ t: '⚙️ 셋업' }, { t: '🤸 참가자' }] },
  { name: '유소년 줄넘기 페스티벌', date: '07.12', place: '📍 고양체육관', fee: '₩ 10,000', status: 'upcoming', label: '🔵 예정', acts: [{ t: '⚙️ 셋업' }, { t: '🤸 참가자' }] },
  { name: '더블더치 오픈 2026', date: '미정', place: '—', fee: '—', status: 'draft', label: '⚪ 준비 중', acts: [{ t: '⚙️ 셋업' }, { t: '🗑️ 삭제' }] },
  { name: '2026 봄철 생활체육 줄넘기', date: '04.20', place: '📍 분당 탄천종합운동장', fee: '₩ 8,000', status: 'done', label: '🟢 종료', acts: [{ t: '🏅 결과' }, { t: '🎬 영상' }] },
];

const STEPS = [
  { n: '1️⃣', label: '로그인' },
  { n: '2️⃣', label: '협회 선택', on: true },
  { n: '3️⃣', label: '대회 생성' },
  { n: '4️⃣', label: '종목 풀', lock: true },
  { n: '5️⃣', label: '참가자', lock: true },
  { n: '6️⃣', label: '배번 · 일정', lock: true },
  { n: '7️⃣', label: '라이브 채점', lock: true },
  { n: '8️⃣', label: '결과 · 시상', lock: true },
];

const NAV = ['🏠 운영자', '🗒️ 회의·할 일', '📊 통계', '⚖️ 심판', '🤸 참가자', '📺 시청자'];

const pillClass = { live: styles.pillLive, upcoming: styles.pillUpcoming, draft: styles.pillDraft, done: styles.pillDone };

export function AdminConsole() {
  const [railHide, setRailHide] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState('knja');

  const onHamburger = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width:760px)').matches) {
      setDrawerOpen((v) => !v);
    } else {
      setRailHide((v) => !v);
    }
  };

  return (
    <div className={styles.console}>
      <header className={styles.hdr}>
        <button className={styles.ham} onClick={onHamburger} title="메뉴 접기/펴기">☰</button>
        <a className={styles.brand}>
          <span className={styles.mark}>W</span>
          <span className={styles.wm}>모두의플레이</span>
          <span className={styles.sub}>WEPLAY</span>
        </a>
        <div className={styles.tenant}><span className={styles.tchip} /> 👑 대한줄넘기협회 <span className={styles.car}>▾</span></div>
        <nav className={styles.nav}>
          {NAV.map((n, i) => (
            <a key={n} className={i === 0 ? styles.on : undefined}>{n}</a>
          ))}
          <span className={styles.avatar}>나</span>
        </nav>
      </header>

      <div className={`${styles.body} ${railHide ? styles.bodyRailHide : ''}`}>
        <aside className={styles.rail}>
          <div className={styles.cap}>⚙️ 운영자 흐름 · 8단계</div>
          {STEPS.map((s) => (
            <button key={s.label} className={`${styles.step} ${s.on ? styles.stepOn : ''} ${s.lock ? styles.stepLock : ''}`}>
              <span className={styles.stepN}>{s.n}</span> {s.label}
            </button>
          ))}
        </aside>

        <main className={styles.main}>
          <div className={styles.ph}>
            <h1>🏛️ 협회 선택</h1>
            <p>운영하실 협회를 고른 뒤 대회를 생성하거나 진행 중인 대회로 들어가세요.</p>
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
            <div className={styles.bt} style={{ '--c': 'var(--purple)' }}>
              <span className={styles.btIco}>🏛️</span> 내가 운영하는 협회 <span className={styles.btCnt}>3</span>
            </div>
            <div className={styles.tcards}>
              {ASSOCIATIONS.map((a) => (
                <div
                  key={a.key}
                  className={`${styles.tcard} ${selected === a.key ? styles.tcardOn : ''}`}
                  onClick={() => setSelected(a.key)}
                >
                  <div className={styles.logo} style={{ background: a.bg }}>{a.logo}</div>
                  <div className={styles.nm}>{a.nm}</div>
                  <div className={styles.meta}>
                    <span className={`${styles.tag} ${a.role === 'owner' ? styles.tagOwner : styles.tagOp}`}>{a.roleLabel}</span> {a.plan}
                  </div>
                  <div className={styles.trow}><span>🏆 대회 <b>{a.comp}</b></span><span>🤸 선수 <b>{a.players}</b></span></div>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.block}>
            <div className={styles.ttlRow}>
              <div className={styles.bt} style={{ '--c': 'var(--cyan)', marginBottom: 0 }}>
                <span className={styles.btIco}>🏆</span> 대한줄넘기협회의 대회
              </div>
              <button className={`${styles.btn} ${styles.btnPrimary}`}>➕ 새 대회 만들기</button>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>대회명</th><th>일정</th><th>장소</th><th>엔트리 비</th><th>상태</th><th style={{ textAlign: 'right' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {COMPETITIONS.map((c) => (
                  <tr key={c.name}>
                    <td><span className={styles.tname}>{c.name}</span></td>
                    <td><span className={`${styles.dt} ${styles.num}`}>{c.date}</span></td>
                    <td>{c.place}</td>
                    <td className={styles.num}>{c.fee}</td>
                    <td><span className={`${styles.pill} ${pillClass[c.status]}`}>{c.label}</span></td>
                    <td>
                      <div className={styles.acts}>
                        {c.acts.map((act) => (
                          <button key={act.t} className={`${styles.btn} ${styles.btnSm} ${act.p ? styles.btnPrimary : styles.btnGhost}`}>{act.t}</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className={styles.foot}>
            <button className={`${styles.btn} ${styles.btnGhost}`}>← 이전</button>
            <button className={`${styles.btn} ${styles.btnPrimary}`}>새 대회 만들기 →</button>
          </div>
        </main>
      </div>

      {drawerOpen && (
        <div className={styles.drawerOpen}>
          {NAV.map((n) => (
            <button key={n} className={styles.step}>{n}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminConsole;
