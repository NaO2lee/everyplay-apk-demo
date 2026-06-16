import { useState } from 'react';
import styles from '../ViewerApp.module.css';
import { MY_DASHBOARD as M } from '../data/mockData';

/* 마이페이지 — 프로필 + 기록 그래프(연습+대회 겹침) + 연습vs실전 분석 + AI(광고) + 영상·참가내역·연습일지
   TODO(backend): M을 GET /me, /me/records(연습+대회), /me/heats, /me/clips, /me/practice 로 교체
                  AI 분석 = 광고 시청 후 Claude API 호출, 광고 = AdMob 보상형 */

const PERIODS = ['일', '주', '월'];
const PRACTICE_EVENTS = ['30초 스피드', '더블언더', '번갈아뛰기', '개인 프리스타일'];

// 연습(캔들) + 대회(실선·점) 겹쳐 보는 차트. 데이터 구동 SVG.
function RecordChart({ weeks, comps = [] }) {
  const [tip, setTip] = useState(() => {
    const i = weeks.findIndex((w) => w.sel);
    return i >= 0 ? { kind: 'week', i } : null;
  });
  const all = weeks.flatMap((w) => [w.min, w.max]).concat(comps.map((c) => c.val));
  const lo = Math.min(...all) - 4;
  const hi = Math.max(...all) + 4;
  const y = (v) => 14 + (1 - (v - lo) / (hi - lo)) * 116;
  const x = (i) => 30 + i * (276 / Math.max(1, weeks.length - 1));
  const grid = [hi - 4, Math.round((hi + lo) / 2), lo + 4];
  const compPts = comps.map((c) => ({ ...c, cx: x(c.wi), cy: y(c.val) }));

  return (
    <>
      {tip?.kind === 'week' && (
        <div className={styles.chartTip}><i /> {weeks[tip.i].label} · 평균 {Math.round((weeks[tip.i].avgLo + weeks[tip.i].avgHi) / 2)} · 최고 {weeks[tip.i].max} · 최저 {weeks[tip.i].min}</div>
      )}
      {tip?.kind === 'comp' && (
        <div className={styles.chartTip} style={{ background: 'color-mix(in srgb,var(--butter) 15%,transparent)', borderColor: 'color-mix(in srgb,var(--butter) 42%,transparent)', color: 'var(--ink)' }}>
          <i style={{ background: 'var(--butter)' }} /> 🏆 {comps[tip.i].name} · {comps[tip.i].date} · <b style={{ marginLeft: 2 }}>{comps[tip.i].val}회</b>
        </div>
      )}
      <svg viewBox="0 0 330 168" width="100%" style={{ display: 'block' }}>
        {grid.map((g) => (
          <g key={g}>
            <line x1="0" y1={y(g)} x2="330" y2={y(g)} stroke="var(--line)" />
            <text x="4" y={y(g) - 3} fill="var(--gray)" fontSize="9">{g}</text>
          </g>
        ))}
        {/* 연습 범위 (캔들) */}
        {weeks.map((w, i) => {
          const isSel = tip?.kind === 'week' && tip.i === i;
          const c = w.down ? 'var(--coral)' : (isSel ? 'var(--blue)' : 'var(--cyan)');
          return (
            <g key={w.label} onClick={() => setTip({ kind: 'week', i })} style={{ cursor: 'pointer' }}>
              <rect x={x(i) - 14} y="10" width="28" height="130" fill="transparent" />
              <line x1={x(i)} y1={y(w.max)} x2={x(i)} y2={y(w.min)} stroke={c} strokeWidth="2" strokeLinecap="round" opacity={tip?.kind === 'comp' ? 0.45 : 1} />
              <line x1={x(i)} y1={y(w.avgHi)} x2={x(i)} y2={y(w.avgLo)} stroke={c} strokeWidth="11" strokeLinecap="round" opacity={tip?.kind === 'comp' ? 0.45 : 1} />
            </g>
          );
        })}
        {/* 대회(실전) 실선 + 점 */}
        {compPts.length > 1 && <polyline points={compPts.map((p) => `${p.cx},${p.cy}`).join(' ')} fill="none" stroke="var(--butter)" strokeWidth="2.5" strokeLinejoin="round" />}
        {compPts.map((p, i) => (
          <g key={p.name} onClick={() => setTip({ kind: 'comp', i })} style={{ cursor: 'pointer' }}>
            <circle cx={p.cx} cy={p.cy} r="10" fill="transparent" />
            <circle cx={p.cx} cy={p.cy} r={tip?.kind === 'comp' && tip.i === i ? 6.5 : 5} fill="var(--butter)" stroke="var(--bg)" strokeWidth="2" />
          </g>
        ))}
        <g fontSize="9" fill="var(--gray)" textAnchor="middle">
          {weeks.map((w, i) => (i % 2 === 0 ? <text key={w.label} x={x(i)} y="160">{w.label}</text> : null))}
        </g>
      </svg>
      <div className={styles.chartLegend}>
        <span className={styles.lgItem}><span className={styles.lgBar} /> 연습 범위</span>
        <span className={styles.lgItem}><span className={styles.lgDot} /> 대회 기록(실전)</span>
      </div>
      <div className={styles.chartHint}>👆 막대(연습)·점(대회)을 누르면 자세히 떠요</div>
    </>
  );
}

export function MyTab() {
  const [period, setPeriod] = useState('주');
  const [ai, setAi] = useState('locked'); // locked | playing | unlocked
  const [practice, setPractice] = useState(M.practice);
  const [adding, setAdding] = useState(false);
  const [pf, setPf] = useState({ type: '30초 스피드', score: '' });
  const addPractice = () => {
    if (!String(pf.score).trim()) return;
    const unit = pf.type.includes('프리') ? '점' : '회';
    setPractice((xs) => [{ id: `p${Date.now()}`, type: pf.type, date: '오늘 연습', score: `${pf.score}${unit}` }, ...xs]);
    setPf({ type: pf.type, score: '' });
    setAdding(false);
  };
  const weeks = M.records.weeks;
  const comps = M.records.comps || [];
  const best = Math.max(...weeks.map((w) => w.max));
  const practiceAvg = Math.round(weeks.reduce((s, w) => s + (w.avgLo + w.avgHi) / 2, 0) / weeks.length);
  const compAvg = comps.length ? Math.round(comps.reduce((s, c) => s + c.val, 0) / comps.length) : 0;
  const gap = practiceAvg - compAvg;
  const watchAd = () => { setAi('playing'); setTimeout(() => setAi('unlocked'), 1800); };

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
        <span className={styles.cnt}>연습 + 대회</span>
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
        <div className={styles.bigRec}>최고 <b>{best}</b> 회 <span className={styles.up}>▲ {best - weeks[0].max} (2개월)</span></div>
        <RecordChart weeks={weeks} comps={comps} />
      </div>

      {/* 연습 vs 실전 분석 */}
      <div className={styles.analysisCard}>
        <div className={styles.anaTitle}>🔍 연습 vs 실전 분석</div>
        <div className={styles.anaRow}>
          <div className={styles.anaStat}><div className={styles.anaV}>{practiceAvg}<small>회</small></div><div className={styles.anaK}>연습 평균</div></div>
          <div className={styles.anaStat}><div className={styles.anaV}>{compAvg}<small>회</small></div><div className={styles.anaK}>대회 평균</div></div>
          <div className={`${styles.anaStat} ${styles.anaGap}`}><div className={styles.anaV}>-{gap}<small>회</small></div><div className={styles.anaK}>실전 격차</div></div>
        </div>
        <div className={styles.anaInsight}>
          연습에선 평균 <b>{practiceAvg}회</b>인데 대회에선 <b>{compAvg}회</b> — 실전에서 약 <b>{gap}회</b> 떨어지는 패턴이에요(긴장·환경 영향). 대회에서도 연습 실력을 내려면 평소 연습 목표를 <b>{practiceAvg + gap}회</b>까지 올려보세요. 💪
        </div>
      </div>

      {/* AI 분석 (광고 보고 열기) */}
      <div className={styles.aiCard}>
        {ai === 'locked' && (
          <>
            <button className={styles.aiBtn} onClick={watchAd}>🤖 AI 분석 보기</button>
            <div className={styles.aiSub}>광고 1개를 보면 AI 코치의 맞춤 분석이 열려요</div>
          </>
        )}
        {ai === 'playing' && (<div className={styles.aiPlay}><div className={styles.spinner} />광고 재생 중...</div>)}
        {ai === 'unlocked' && (
          <div className={styles.aiBox}>
            <div className={styles.aiHd}>🤖 AI 코치 분석</div>
            <div className={styles.aiTxt}>
              최근 6주 연습은 <b>꾸준히 상승</b>(64→78회) 중이에요. 다만 대회마다 평균 <b>{gap}회</b> 낮아지는 패턴이 반복돼요 — 특히 경기 초반 페이스가 흔들립니다.<br /><br />
              추천: ① 대회 2주 전부터 <b>실전처럼 30초 풀스피드</b> 반복 ② 시작 5초 리듬 고정 훈련 ③ 목표 연습 기록 <b>{practiceAvg + gap}회</b>. 이대로면 다음 대회 <b>{compAvg + 4}~{compAvg + 6}회</b>가 기대돼요!
            </div>
          </div>
        )}
      </div>

      {M.nextHeat && (
        <div className={`${styles.dcard} ${styles.nextCard}`} style={{ marginTop: 12 }}>
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
        {adding && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
            <select value={pf.type} onChange={(e) => setPf({ ...pf, type: e.target.value })} className={styles.chartSel} style={{ flex: '0 0 auto' }}>
              {PRACTICE_EVENTS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <input value={pf.score} onChange={(e) => setPf({ ...pf, score: e.target.value })} placeholder="기록 (회/점)" inputMode="numeric"
              onKeyDown={(e) => { if (e.key === 'Enter') addPractice(); }}
              style={{ flex: 1, minWidth: 0, background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 9, padding: '9px 11px', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 14 }} />
            <button onClick={addPractice} style={{ background: 'var(--blue)', color: '#fff', border: 0, borderRadius: 9, padding: '9px 15px', fontWeight: 800, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>추가</button>
          </div>
        )}
        {practice.map((p) => (
          <div key={p.id} className={styles.histrow}>
            <div className={styles.rk}>🏃</div>
            <div className={styles.info2}><div className={styles.info2T}>{p.type}</div><div className={styles.info2S}>{p.date}</div></div>
            <div className={styles.score}>{p.score}</div>
          </div>
        ))}
        <button className={styles.recbtn} onClick={() => setAdding((v) => !v)}>{adding ? '닫기' : '＋ 오늘 연습 기록 추가'}</button>
      </div>
    </div>
  );
}

export default MyTab;
