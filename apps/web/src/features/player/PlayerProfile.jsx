import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Bell, Heart } from 'lucide-react';
import styles from './Player.module.css';

/* 선수 공개 프로필 (데모) — /player/demo. 랭킹·참가자 명단에서 진입.
   등급/시즌 랭킹 + 종목별 최고기록 + 주요 성적 + 출전 영상 + 응원·팔로우.
   TODO(backend): GET /public/players/{id} (프로필·기록·성적·클립) */

const P = {
  name: '김서연',
  initial: '김',
  flag: '🇰🇷',
  club: '서울 줄넘기클럽',
  meta: '서울 줄넘기클럽 · 초등부(9세) · 🇰🇷 한국',
  grade: '다이아',
  rank: 1,
  // 등급 진행: 현재 포인트 → 다음 등급 컷
  gradeProg: { cur: 2840, next: 3000, label: '다이아', keep: '시즌 1위 유지 중' },
  stats: { rank: 1, pts: 2840, entries: 12, awards: 5 },
  cheers: 128,
  best: [
    { ev: '30초 스피드', v: '85', unit: '회', at: '전국 한마당 · 6/7' },
    { ev: '더블언더', v: '71', unit: '회', at: 'KBSN컵 · 4/11' },
    { ev: '개인 프리스타일', v: '9.4', unit: '점', at: '라이언스컵 · 3/8' },
    { ev: '번갈아뛰기', v: '3:02', unit: '', at: '봄철 생활체육 · 5/16' },
  ],
  history: [
    { id: 'h1', rank: '🥇', medal: true, title: '2026 전국 한마당 줄넘기대회', sub: '2026. 6. 7. · 30초 스피드 · 초등부', score: '85회' },
    { id: 'h2', rank: '🥇', medal: true, title: '2026 KBSN컵 선수권', sub: '2026. 4. 11. · 더블언더 · 초등부', score: '71회' },
    { id: 'h3', rank: '🥉', medal: true, title: '경희대 라이언스컵 OPEN', sub: '2026. 3. 8. · 개인 프리스타일', score: '9.4점' },
    { id: 'h4', rank: '4위', medal: false, title: '경기 어울림 줄넘기대회', sub: '2026. 2. 22. · 30초 스피드', score: '79회' },
  ],
  clips: [
    { id: 'c1', type: '30초 스피드', from: '전국 한마당 · HIT 12', dur: '2:14' },
    { id: 'c2', type: '더블언더 결승', from: 'KBSN컵 · 결승', dur: '1:48' },
    { id: 'c3', type: '프리스타일', from: '라이언스컵 OPEN', dur: '2:30' },
  ],
};

export function PlayerProfile() {
  const navigate = useNavigate();
  const [follow, setFollow] = useState(false);
  const [cheered, setCheered] = useState(false);
  const pct = Math.min(100, Math.round((P.gradeProg.cur / P.gradeProg.next) * 100));
  const toNext = P.gradeProg.next - P.gradeProg.cur;

  return (
    <div className={styles.screen}>
      <div className={styles.bar}>
        <button className={styles.back} onClick={() => navigate(-1)} aria-label="뒤로">←</button>
        <button className={styles.barShare} aria-label="공유"
          onClick={() => { try { navigator.share?.({ title: `${P.name} 선수`, url: window.location.href }); } catch { /* ignore */ } }}>⤴</button>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.av}>{P.initial}</div>
          <div style={{ minWidth: 0 }}>
            <div className={styles.nmRow}>
              <span className={styles.nm}>{P.name}</span>
              <span className={styles.flag}>{P.flag}</span>
            </div>
            <div className={styles.meta}>{P.meta}</div>
            <div className={styles.gradeRow}>
              <span className={styles.grade}>◆ {P.grade}</span>
              <span className={styles.rankPill}>시즌 {P.rank}위</span>
            </div>
          </div>
        </div>

        <div className={styles.gradeProg}>
          <div className={styles.gpTop}><span>◆ {P.gradeProg.label}</span><span>{P.gradeProg.cur.toLocaleString()} / {P.gradeProg.next.toLocaleString()}P</span></div>
          <div className={styles.gpBar}><div className={styles.gpFill} style={{ width: `${pct}%` }} /></div>
          <div className={styles.gpNote}>다음 등급까지 <b>{toNext}P</b> · {P.gradeProg.keep}</div>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}><div className={styles.statV}>{P.stats.rank}<small>위</small></div><div className={styles.statK}>시즌 랭킹</div></div>
        <div className={styles.stat}><div className={styles.statV}>{(P.stats.pts / 1000).toFixed(1)}<small>kP</small></div><div className={styles.statK}>포인트</div></div>
        <div className={styles.stat}><div className={styles.statV}>{P.stats.entries}<small>회</small></div><div className={styles.statK}>대회 출전</div></div>
        <div className={styles.stat}><div className={styles.statV}>{P.stats.awards}<small>회</small></div><div className={styles.statK}>🏅 수상</div></div>
      </div>

      <div className={styles.scr}>
        <div className={styles.sec}>⚡ 종목별 최고기록</div>
        <div className={styles.bestGrid}>
          {P.best.map((b) => (
            <div key={b.ev} className={styles.best}>
              <div className={styles.bestEv}>{b.ev}</div>
              <div className={styles.bestV}>{b.v}{b.unit && <small>{b.unit}</small>}</div>
              <div className={styles.bestAt}>{b.at}</div>
            </div>
          ))}
        </div>

        <div className={styles.sec}>🏆 주요 성적 <span className={styles.secHint}>최근 시즌</span></div>
        <div className={styles.card}>
          {P.history.map((h) => (
            <div key={h.id} className={styles.histrow}>
              <div className={`${styles.rk} ${h.medal ? styles.rkMedal : ''}`}>{h.rank}</div>
              <div className={styles.histInfo}>
                <div className={styles.histT}>{h.title}</div>
                <div className={styles.histS}>{h.sub}</div>
              </div>
              <div className={styles.histScore}>{h.score}</div>
            </div>
          ))}
        </div>

        <div className={styles.sec}>🎬 출전 영상 <span className={styles.secHint}>{P.clips.length}편</span></div>
        <div className={styles.hscroll}>
          {P.clips.map((c) => (
            <button key={c.id} className={styles.clip} onClick={() => navigate('/app/demo?tab=vod')}>
              <div className={styles.clipT}><Film size={20} style={{ opacity: 0.5 }} /><span className={styles.clipDur}>{c.dur}</span></div>
              <div className={styles.clipC}>{c.type}</div>
              <div className={styles.clipD}>{c.from}</div>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.cta}>
        <button className={styles.ctaCheer} onClick={() => setCheered((v) => !v)} aria-label="응원">
          <Heart size={19} fill={cheered ? '#FF5E6C' : 'none'} />
          <span className={styles.ctaCheerN}>{P.cheers + (cheered ? 1 : 0)}</span>
        </button>
        <button className={`${styles.ctaBtn} ${follow ? styles.ctaBtnOn : ''}`} onClick={() => setFollow((v) => !v)}>
          <Bell size={17} /> {follow ? '경기 알림 받는 중' : '이 선수 경기 알림 받기'}
        </button>
      </div>
    </div>
  );
}

export default PlayerProfile;
