/**
 * 전광판 (TV 표시, 앱 디자인) — /scoreboard-demo (데모 데이터).
 * 실제 운영은 5월 Scoreboard의 useAllStationHeats(SSE /overlay/sse) 패턴으로 교체.
 * TODO(backend): DEMO_COURTS → 이벤트 stations + 코트별 SSE heat 데이터로 교체.
 */
import { useEffect, useState } from 'react';
import styles from './ScoreboardScreen.module.css';

const FLAG = { KOR: '🇰🇷', JPN: '🇯🇵', CHN: '🇨🇳', USA: '🇺🇸', TPE: '🇹🇼' };
const DEMO_COURTS = [
  { n: 1, live: true, hit: 12, ev: '30초 스피드 · 남9', started: Date.now() - 18000, players: [['김서연', 'KOR'], ['박도윤', 'KOR'], ['TANAKA', 'JPN'], ['이준', 'KOR'], ['WANG', 'CHN'], ['오시우', 'KOR']] },
  { n: 2, live: true, hit: 8, ev: '개인 프리스타일 · 여12', started: Date.now() - 41000, players: [['박지민', 'KOR'], ['최유나', 'KOR'], ['LEE', 'USA']] },
  { n: 3, live: false, hit: null, ev: '대기 중', players: [] },
  { n: 4, live: true, hit: 5, ev: '2인 릴레이 · 남15', started: Date.now() - 7000, players: [['이준호 팀', 'KOR'], ['김민 팀', 'KOR']] },
  { n: 5, live: true, hit: 9, ev: '더블더치 · 혼성', started: Date.now() - 63000, players: [['1조', 'KOR'], ['2조', 'JPN'], ['3조', 'CHN']] },
  { n: 6, live: false, hit: null, ev: '점검 중', players: [] },
];

function fmt(ms) {
  const d = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`;
}

function Timer({ started }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(id); }, []);
  return <>{fmt(started)}</>;
}

export default function ScoreboardScreen() {
  const [now, setNow] = useState('');
  useEffect(() => {
    const f = () => { const d = new Date(); setNow(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`); };
    f(); const id = setInterval(f, 10000); return () => clearInterval(id);
  }, []);

  const featured = DEMO_COURTS.find((c) => c.live);

  return (
    <div className={styles.tv}>
      <div className={styles.topbar}>
        <img className={styles.wm} src="/brand/weplay-wordmark-white.png" alt="WEPLAY" />
        <div>
          <div className={styles.evName}>2026 전국 한마당 줄넘기대회</div>
          <div className={styles.evMeta}>2일차 · 화성종합경기타운 · 대한민국줄넘기협회(KRSA)</div>
        </div>
        <span className={styles.livePill}><span className={styles.liveDot} /> LIVE</span>
        <span className={styles.clock}>🕐 {now}</span>
      </div>

      <div className={styles.grid}>
        {DEMO_COURTS.map((c) => (
          <div key={c.n} className={`${styles.court} ${c.live ? styles.courtLive : ''}`}>
            <div className={styles.screen}>
              {c.live ? '🎥' : '📷'}
              {c.live && <span className={styles.badge}><span className={styles.liveDot} /> LIVE</span>}
              {c.hit != null && <span className={styles.hitTag}>HIT {c.hit}</span>}
            </div>
            <div className={styles.cinfo}>
              <div className={styles.crow}>
                <span className={styles.cname}>코트 {c.n}</span>
                {c.live && <span className={styles.ctimer}><Timer started={c.started} /></span>}
              </div>
              <div className={styles.cev}>{c.ev}</div>
              {c.players.length ? (
                <div className={styles.players}>
                  {c.players.map(([nm, co], i) => <span key={i} className={styles.player}>{FLAG[co] || '🏳️'} {nm}</span>)}
                </div>
              ) : <div className={styles.idle}>다음 경기 준비 중</div>}
            </div>
          </div>
        ))}
      </div>

      {featured && (
        <div className={styles.infobar}>
          <div className={styles.bigCourt}>코트 {featured.n}</div>
          <div className={styles.sep} />
          <div>
            <div className={styles.ibLab}>종목 · 참가부</div>
            <div className={styles.ibEv}>{featured.ev}</div>
          </div>
          <div>
            <div className={styles.ibLab}>HIT</div>
            <div className={styles.ibHit}>#{featured.hit}</div>
          </div>
          <div>
            <div className={styles.ibLab}>경과</div>
            <div className={styles.ibTimer}><Timer started={featured.started} /></div>
          </div>
          <div className={styles.ibPlayers}>
            {featured.players.map(([nm, co], i) => <span key={i} className={styles.ibPlayer}>{FLAG[co] || '🏳️'} {nm}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}
