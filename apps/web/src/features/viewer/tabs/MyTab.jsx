import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../ViewerApp.module.css';
import { MY_DASHBOARD as M } from '../data/mockData';

/* 마이페이지 — 프로필+요약 공통, 아래 2탭(크롬탭식):
   [경기 참가] 참가예정 안내(없으면 안내+수동등록) · 출전영상 · 참가한 대회(종목결과·🏅·🎬·공유·복사)
   [운동·연습] 기록 그래프(일/주/월)·분석·AI·주간리포트·인사이트·플랜·연습일지
   TODO(backend): /me, /me/records, /me/heats, /me/clips, /me/practice, /me/upcoming */

const PERIODS = ['일', '주', '월'];
const PERIOD_KEY = { 일: 'day', 주: 'week', 월: 'month' };
const PRACTICE_EVENTS = ['30초 스피드', '더블언더', '번갈아뛰기', '개인 프리스타일'];
const PLAN_COLOR = { cyan: 'var(--cyan)', purple: 'var(--purple)', mint: 'var(--mint)', blue: 'var(--blue)' };
const moreBtn = { background: 'none', border: 0, color: 'var(--blue)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
// 경기 알림 — 종모양 on/off → 세부 설정. TODO(backend): 푸시 토큰 등록 + 스케줄링
const ALARMS = [
  { id: 'pre5', label: '출전 5경기(heat) 전 알림', desc: '내 차례 5 heat 전에 미리 알려드려요', ex: '"곧 5경기 뒤 출전! 코트 1로 이동 준비하세요"' },
  { id: 'court', label: '출전 코트 배정 알림', desc: '내가 뛸 코트가 정해지면 알림', ex: '"30초 스피드 — 코트 2에 배정됐어요"' },
  { id: 'start', label: '경기 시작 알림', desc: '내 경기가 곧 시작될 때', ex: '"지금 입장! 30초 스피드 시작합니다"' },
  { id: 'vod', label: '기록 영상 업로드 알림', desc: '출전 후 내 영상이 올라오면 알림', ex: '"방금 출전 영상이 올라왔어요 🎬"' },
];
const ALARM_SOUNDS = ['기본음', '호루라기', '종소리', '박수', '응원 함성']; // 실제 음원은 추후 에셋

function normBuckets(buckets) {
  return buckets.map((b) => {
    if (b.recs) {
      if (b.recs.length === 1) return { label: b.label, single: true, val: b.recs[0], n: 1 };
      const min = Math.min(...b.recs), max = Math.max(...b.recs);
      const avg = b.recs.reduce((s, v) => s + v, 0) / b.recs.length;
      return { label: b.label, single: false, min, max, avgLo: Math.round(avg) - 1, avgHi: Math.round(avg) + 1, n: b.recs.length };
    }
    return { ...b, single: false };
  });
}

function RecordChart({ buckets, comps = [] }) {
  const [tip, setTip] = useState(() => {
    const i = buckets.findIndex((b) => b.sel);
    return i >= 0 ? { kind: 'b', i } : null;
  });
  const vals = buckets.flatMap((b) => (b.single ? [b.val] : [b.min, b.max])).concat(comps.map((c) => c.val));
  const lo = Math.min(...vals) - 4;
  const hi = Math.max(...vals) + 4;
  const y = (v) => 14 + (1 - (v - lo) / (hi - lo)) * 116;
  const x = (i) => 30 + i * (276 / Math.max(1, buckets.length - 1));
  const grid = [hi - 4, Math.round((hi + lo) / 2), lo + 4];
  const compPts = comps.map((c) => ({ ...c, cx: x(c.wi), cy: y(c.val) }));
  const showLabel = (i) => buckets.length <= 5 || i % 2 === 0;
  const b = tip?.kind === 'b' ? buckets[tip.i] : null;

  return (
    <>
      {b && (
        <div className={styles.chartTip}>
          <i /> {b.label} · {b.single
            ? <>기록 <b style={{ marginLeft: 2 }}>{b.val}회</b> (1개)</>
            : <>평균 {Math.round((b.avgLo + b.avgHi) / 2)} · 최고 {b.max} · 최저 {b.min}{b.n ? ` (${b.n}개)` : ''}</>}
        </div>
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
        {buckets.map((bk, i) => {
          const isSel = tip?.kind === 'b' && tip.i === i;
          const c = bk.down ? 'var(--coral)' : (isSel ? 'var(--blue)' : 'var(--cyan)');
          const dim = tip?.kind === 'comp' ? 0.45 : 1;
          return (
            <g key={bk.label} onClick={() => setTip({ kind: 'b', i })} style={{ cursor: 'pointer' }}>
              <rect x={x(i) - 14} y="10" width="28" height="130" fill="transparent" />
              {bk.single ? (
                <circle cx={x(i)} cy={y(bk.val)} r={isSel ? 6 : 5} fill={c} stroke="var(--bg)" strokeWidth="2" opacity={dim} />
              ) : (
                <>
                  <line x1={x(i)} y1={y(bk.max)} x2={x(i)} y2={y(bk.min)} stroke={c} strokeWidth="2" strokeLinecap="round" opacity={dim} />
                  <line x1={x(i)} y1={y(bk.avgHi)} x2={x(i)} y2={y(bk.avgLo)} stroke={c} strokeWidth="11" strokeLinecap="round" opacity={dim} />
                </>
              )}
            </g>
          );
        })}
        {compPts.length > 1 && <polyline points={compPts.map((p) => `${p.cx},${p.cy}`).join(' ')} fill="none" stroke="var(--butter)" strokeWidth="2.5" strokeLinejoin="round" />}
        {compPts.map((p, i) => (
          <g key={p.name} onClick={() => setTip({ kind: 'comp', i })} style={{ cursor: 'pointer' }}>
            <circle cx={p.cx} cy={p.cy} r="10" fill="transparent" />
            <circle cx={p.cx} cy={p.cy} r={tip?.kind === 'comp' && tip.i === i ? 6.5 : 5} fill="var(--butter)" stroke="var(--bg)" strokeWidth="2" />
          </g>
        ))}
        <g fontSize="9" fill="var(--gray)" textAnchor="middle">
          {buckets.map((bk, i) => (showLabel(i) ? <text key={bk.label} x={x(i)} y="160">{bk.label}</text> : null))}
        </g>
      </svg>
      <div className={styles.chartLegend}>
        <span className={styles.lgItem}><span className={styles.lgBar} /> 연습(막대·점)</span>
        <span className={styles.lgItem}><span className={styles.lgDot} /> 대회 기록</span>
      </div>
      <div className={styles.chartHint}>👆 막대·점을 누르면 자세히 · 하루 1개=점, 2개 이상=막대</div>
    </>
  );
}

export function MyTab() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [avatar, setAvatar] = useState(null);
  const onAvatar = (e) => { const f = e.target.files?.[0]; if (f) setAvatar(URL.createObjectURL(f)); };
  const [mtab, setMtab] = useState('comp'); // comp | practice
  const [openH, setOpenH] = useState('h1'); // 펼친 참가 대회
  const [period, setPeriod] = useState(() => {
    const q = new URLSearchParams(window.location.search).get('period');
    return ['일', '주', '월'].includes(q) ? q : '주';
  });
  const [ai, setAi] = useState('locked');
  const [alarmOpen, setAlarmOpen] = useState(() => new URLSearchParams(window.location.search).get('alarm') === '1');
  const [alarms, setAlarms] = useState({ pre5: true, court: true, start: true, vod: true });
  const [alarmMode, setAlarmMode] = useState('sound'); // sound | vibrate
  const [alarmSound, setAlarmSound] = useState('기본음');
  const alarmOn = Object.values(alarms).some(Boolean);
  const toggleAlarm = (id) => setAlarms((a) => ({ ...a, [id]: !a[id] }));
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

  const linkOf = (h) => `https://everyplay.weplaykorea.com/r/${h.id}`;
  const shareRec = (h) => { try { navigator.share?.({ title: `${M.name} · ${h.title}`, url: linkOf(h) }); } catch { /* ignore */ } };
  const copyRec = (h) => { try { navigator.clipboard.writeText(linkOf(h)); alert('영상 링크가 복사됐어요'); } catch { /* ignore */ } };

  const W = M.weekly;
  const plans = M.plans || [];
  const insights = M.insights || [];
  const goalPct = Math.min(100, Math.round((W.sessions / W.goal) * 100));
  const reg = M.registered;

  const R = M.records;
  const curBuckets = normBuckets(R[PERIOD_KEY[period]].buckets);
  const curComps = R[PERIOD_KEY[period]].comps || [];
  const weekB = R.week.buckets;
  const best = Math.max(...weekB.map((w) => w.max));
  const practiceAvg = Math.round(weekB.reduce((s, w) => s + (w.avgLo + w.avgHi) / 2, 0) / weekB.length);
  const allComps = R.week.comps || [];
  const compAvg = allComps.length ? Math.round(allComps.reduce((s, c) => s + c.val, 0) / allComps.length) : 0;
  const gap = practiceAvg - compAvg;
  const watchAd = () => { setAi('playing'); setTimeout(() => setAi('unlocked'), 1800); };

  return (
    <div className={styles.pageFade}>
      {/* 내 정보 (공통) */}
      <div className={styles.myhead}>
        <button className={styles.myAv} onClick={() => fileRef.current?.click()} style={{ position: 'relative', border: 0, cursor: 'pointer', padding: 0, overflow: 'visible' }} aria-label="프로필 사진 변경">
          {avatar ? <img src={avatar} alt="프로필" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }} /> : M.initial}
          <span style={{ position: 'absolute', right: -3, bottom: -3, width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--line2)', display: 'grid', placeItems: 'center', fontSize: 11 }}>📷</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onAvatar} style={{ display: 'none' }} />
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

      {/* 2탭 (크롬 탭식) */}
      <div className={styles.myTabs}>
        <button className={`${styles.myTab} ${mtab === 'comp' ? styles.myTabOn : ''}`} onClick={() => setMtab('comp')}>🏆 경기 참가</button>
        <button className={`${styles.myTab} ${mtab === 'practice' ? styles.myTabOn : ''}`} onClick={() => setMtab('practice')}>🏃 운동·연습 기록</button>
      </div>

      {mtab === 'comp' && (
        <>
          {/* 참가 예정 경기 (최우선) */}
          <div className={styles.sec} style={{ marginTop: 16 }}><h2 className={styles.secTitle}>📌 참가 예정 경기</h2></div>
          {reg ? (
            <div className={styles.regCard}>
              <div className={styles.regTop}>
                <div className={styles.regDday}><b>{reg.dday}</b><span>{reg.date.replace(/2026\. /, '')}</span></div>
                <div className={styles.regBody}>
                  <div className={styles.regTitle}>{reg.title}</div>
                  <div className={styles.regRow}><span>🏷</span> {reg.events.join(' · ')}</div>
                  <div className={styles.regRow}><span>🎒</span> {reg.prep.join(', ')}</div>
                </div>
                <button className={`${styles.bellBtn} ${alarmOn ? styles.bellOn : ''}`} onClick={() => setAlarmOpen(true)} aria-label="알림 설정">{alarmOn ? '🔔' : '🔕'}</button>
              </div>
              <div className={styles.regFoot}>
                <span className={styles.regStatus}>✅ {reg.status}</span>
                <button className={styles.regMore} onClick={() => navigate('/competition/demo')}>대회 상세 · 준비물 →</button>
              </div>
            </div>
          ) : (
            <div className={styles.dcard} style={{ textAlign: 'center', padding: '22px 14px', color: 'var(--gray)', fontSize: 13.5 }}>
              현재 경기 참가 신청이 없습니다
            </div>
          )}
          <button className={styles.recbtn} style={{ background: 'var(--soft)', color: 'var(--ink2)', border: '1px solid var(--line2)', marginTop: 10 }} onClick={() => navigate('/me/register')}>＋ 경기 참가 직접 등록</button>

          {/* 내 출전 영상 */}
          <div className={styles.sec} style={{ marginTop: 20 }}>
            <h2 className={styles.secTitle}>🎬 내 출전 영상</h2>
            <button style={moreBtn} onClick={() => navigate('/app/demo?tab=vod')}>전체보기 ›</button>
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

          {/* 참가한 대회 — 누르면 종목 결과·영상·공유 */}
          <div className={styles.sec} style={{ marginTop: 20 }}>
            <h2 className={styles.secTitle}>🏆 참가한 대회</h2>
            <span className={styles.cnt}>{M.history.length}개</span>
          </div>
          {M.history.map((h) => {
            const open = openH === h.id;
            return (
              <div key={h.id} className={styles.histCard}>
                <button className={styles.histHead} onClick={() => setOpenH(open ? null : h.id)}>
                  <div className={`${styles.rk} ${h.medal ? styles.rkMedal : ''}`}>{h.rank}</div>
                  <div className={styles.info2}>
                    <div className={styles.info2T}>{h.title} {h.hasVideo && '🎬'}</div>
                    <div className={styles.info2S}>{h.date} · {h.events.length}종목</div>
                  </div>
                  <span className={styles.histChev}>{open ? '▴' : '▾'}</span>
                </button>
                {open && (
                  <div className={styles.histBody}>
                    {h.events.map((e) => (
                      <div key={e.ev} className={styles.evRow}>{e.medal || '•'} {e.ev} <b>{e.result}</b></div>
                    ))}
                    <div className={styles.histActions}>
                      {h.hasVideo && <button className={styles.histAct} onClick={() => navigate('/app/demo?tab=vod')}>▶️ 영상 보기</button>}
                      <button className={styles.histAct} onClick={() => shareRec(h)}>🔗 공유</button>
                      <button className={styles.histAct} onClick={() => copyRec(h)}>📋 링크 복사</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {mtab === 'practice' && (
        <>
          {/* 기록 그래프 (일/주/월) */}
          <div className={styles.sec} style={{ marginTop: 16 }}>
            <h2 className={styles.secTitle}>📈 내 기록 그래프</h2>
            <span className={styles.cnt}>연습 + 대회</span>
          </div>
          <div className={styles.chartCard}>
            <div className={styles.chartRow}>
              <button className={styles.chartSel}>{R.event} ▾</button>
              <span className={styles.periods}>
                {PERIODS.map((p) => (
                  <button key={p} className={period === p ? styles.on : ''} onClick={() => setPeriod(p)}>{p}</button>
                ))}
              </span>
            </div>
            <div className={styles.bigRec}>최고 <b>{best}</b> 회 <span className={styles.up}>▲ {best - weekB[0].max} (2개월)</span></div>
            <RecordChart key={period} buckets={curBuckets} comps={curComps} />
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
              연습에선 평균 <b>{practiceAvg}회</b>인데 대회에선 <b>{compAvg}회</b> — 실전에서 약 <b>{gap}회</b> 떨어지는 패턴이에요. 대회에서도 연습 실력을 내려면 평소 연습 목표를 <b>{practiceAvg + gap}회</b>까지 올려보세요. 💪
            </div>
          </div>

          {/* AI 분석 */}
          <div className={styles.aiCard}>
            {ai === 'locked' && (<><button className={styles.aiBtn} onClick={watchAd}>🤖 AI 분석 보기</button><div className={styles.aiSub}>광고 1개를 보면 AI 코치의 맞춤 분석이 열려요</div></>)}
            {ai === 'playing' && (<div className={styles.aiPlay}><div className={styles.spinner} />광고 재생 중...</div>)}
            {ai === 'unlocked' && (
              <div className={styles.aiBox}>
                <div className={styles.aiHd}>🤖 AI 코치 분석</div>
                <div className={styles.aiTxt}>최근 6주 연습은 <b>꾸준히 상승</b> 중이에요. 다만 대회마다 평균 <b>{gap}회</b> 낮아지는 패턴이 반복돼요.<br /><br />추천: ① 대회 2주 전부터 <b>실전처럼 풀스피드</b> 반복 ② 시작 5초 리듬 고정 ③ 목표 연습 <b>{practiceAvg + gap}회</b>.</div>
              </div>
            )}
          </div>

          {/* 이번 주 훈련 리포트 */}
          <div className={styles.sec} style={{ marginTop: 20 }}>
            <h2 className={styles.secTitle}>📅 이번 주 훈련 리포트</h2>
            <span className={styles.cnt}>{W.range}</span>
          </div>
          <div className={styles.weekCard}>
            <div className={styles.weekTop}>
              <div><div className={styles.weekBig}>{W.sessions}<small>회</small></div><div className={styles.weekBigK}>이번 주 연습</div></div>
              <div className={styles.weekChange}>지난주 {W.prevSessions}회<br /><b>▲ {W.sessions - W.prevSessions}회 늘었어요</b></div>
            </div>
            <div className={styles.weekStats}>
              <div className={styles.weekStat}><div className={styles.weekStatV}>{W.jumps.toLocaleString()}</div><div className={styles.weekStatK}>총 점프</div></div>
              <div className={styles.weekStat}><div className={styles.weekStatV}>{W.minutes}<small>분</small></div><div className={styles.weekStatK}>운동 시간</div></div>
              <div className={styles.weekStat}><div className={styles.weekStatV}>{W.best}<small>회</small></div><div className={styles.weekStatK}>주간 최고</div></div>
            </div>
            <div className={styles.weekGoal}>
              <div className={styles.weekGoalTop}><span>🎯 주간 목표 {W.goal}회</span><span>{W.sessions}/{W.goal} ({goalPct}%)</span></div>
              <div className={styles.weekBar}><div className={styles.weekBarFill} style={{ width: `${goalPct}%` }} /></div>
            </div>
          </div>

          {/* 인사이트 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {insights.map((x, i) => (
              <div key={i} className={styles.insightRow} data-tone={x.tone}><span className={styles.insightIc}>{x.ic}</span><span className={styles.insightTx}>{x.text}</span></div>
            ))}
          </div>

          {/* 오늘의 훈련 플랜 */}
          <div className={styles.sec} style={{ marginTop: 20 }}>
            <h2 className={styles.secTitle}>🎯 오늘의 훈련 플랜</h2>
            <span className={styles.cnt}>{plans.length}개 진행 중</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {plans.map((p) => (
              <div key={p.id} className={styles.planCard}>
                <div className={styles.planTop}>
                  <div style={{ minWidth: 0 }}><div className={styles.planNm}>{p.name}</div><div className={styles.planSub}>{p.sub} · {p.goal}</div></div>
                  <div className={styles.planPct}>{p.pct}%</div>
                </div>
                <div className={styles.planBar}><div className={styles.planBarFill} style={{ width: `${p.pct}%`, background: PLAN_COLOR[p.color] }} /></div>
                <div className={styles.planToday}>{p.today}</div>
              </div>
            ))}
            <button className={styles.recbtn}>＋ 새 훈련 플랜 만들기</button>
          </div>

          {/* 직접 기록 (연습일지) */}
          <div className={styles.sec} style={{ marginTop: 20 }}>
            <h2 className={styles.secTitle}>✏️ 운동 기록하기 (연습일지)</h2>
            {practice.length > 2 && <button style={moreBtn} onClick={() => navigate('/records/demo?tab=practice')}>전체보기 ›</button>}
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
            {practice.slice(0, 2).map((p) => (
              <div key={p.id} className={styles.histrow}>
                <div className={styles.rk}>🏃</div>
                <div className={styles.info2}><div className={styles.info2T}>{p.type}</div><div className={styles.info2S}>{p.date}</div></div>
                <div className={styles.score}>{p.score}</div>
              </div>
            ))}
            <button className={styles.recbtn} onClick={() => setAdding((v) => !v)}>{adding ? '닫기' : '＋ 오늘 연습 기록 추가'}</button>
          </div>
        </>
      )}

      {/* 🔔 경기 알림 설정 팝업 (종모양에서 열림 · 설정에서도 조정 가능) */}
      {alarmOpen && (
        <>
          <div className={`${styles.dim} ${styles.dimOn}`} onClick={() => setAlarmOpen(false)} />
          <div className={`${styles.sheet} ${styles.sheetOn}`}>
            <button className={styles.grab} onClick={() => setAlarmOpen(false)} aria-label="닫기" />
            <div className={styles.alarmHd}>🔔 경기 알림 설정</div>
            <div className={styles.alarmSub}>{reg?.title} · 받을 알림을 골라주세요</div>
            {ALARMS.map((a) => (
              <button key={a.id} className={styles.swRow} onClick={() => toggleAlarm(a.id)}>
                <div style={{ minWidth: 0 }}>
                  <div className={styles.swT}>{a.label}</div>
                  <div className={styles.swD}>{a.desc}</div>
                </div>
                <span className={`${styles.sw} ${alarms[a.id] ? styles.swOn : ''}`}><span className={styles.swKnob} /></span>
              </button>
            ))}
            <div className={styles.alarmModeHd}>🔊 알림 방식</div>
            <div className={styles.alarmModeRow}>
              <button className={`${styles.alarmModeBtn} ${alarmMode === 'sound' ? styles.alarmModeOn : ''}`} onClick={() => setAlarmMode('sound')}>🔊 소리</button>
              <button className={`${styles.alarmModeBtn} ${alarmMode === 'vibrate' ? styles.alarmModeOn : ''}`} onClick={() => setAlarmMode('vibrate')}>📳 진동</button>
            </div>
            {alarmMode === 'sound' ? (
              <>
                <div className={styles.alarmModeHd}>🎵 알람음</div>
                <div className={styles.filterbar}>
                  {ALARM_SOUNDS.map((s) => (
                    <button key={s} className={`${styles.fchip} ${alarmSound === s ? styles.fchipOn : ''}`} onClick={() => setAlarmSound(s)}>{alarmSound === s ? '🔊 ' : '▶ '}{s}</button>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.alarmNote}>📳 소리 없이 진동으로만 알려드려요</div>
            )}
            <div className={styles.alarmExHd}>📢 이런 알림이 울려요</div>
            {ALARMS.filter((a) => alarms[a.id]).map((a) => (<div key={a.id} className={styles.alarmEx}>{a.ex}</div>))}
            <button className={styles.recbtn} style={{ marginTop: 14 }} onClick={() => setAlarmOpen(false)}>저장</button>
          </div>
        </>
      )}
    </div>
  );
}

export default MyTab;
