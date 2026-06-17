import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { Gift } from 'lucide-react';
import styles from './SuperChat.module.css';

/* 슈퍼챗 / 후원 (데모) — /superchat/demo. 라이브 코트 응원 중 선수·팀 후원.
   금액별 컬러 메시지(유튜브식) + 고액 핀 고정. 실제 결제·정산은 백엔드.
   TODO(backend): POST /events/{code}/courts/{id}/superchat (PG 결제 + 선수/대회 정산), GET .../superchat */

// 금액 티어 — 색이 진할수록 고액. amt=0 은 일반 응원(무료).
const TIERS = [
  { amt: 1000, c: '#5BA8FF', k: '응원' },
  { amt: 5000, c: '#33D6D6', k: '힘내요' },
  { amt: 10000, c: '#34D4A6', k: '최고예요' },
  { amt: 30000, c: '#FFB648', k: '대박응원' },
  { amt: 50000, c: '#FF7A66', k: '슈퍼팬' },
];
const won = (n) => `₩${n.toLocaleString()}`;
const tierOf = (amt) => TIERS.slice().reverse().find((t) => amt >= t.amt) || TIERS[0];

const SEED = [
  { id: 's1', nm: '점프맘서연', amt: 50000, text: '서연이 1등 가자!! 엄마가 쏜다 🔥🔥', av: '점' },
  { id: 's2', nm: '화성클럽', amt: 30000, text: '우리 클럽 선수들 다 화이팅! 오늘 다 메달 가자', av: '화' },
  { id: 's3', nm: '익명의팬', amt: 10000, text: '더블언더 미쳤다… 실시간으로 보니 더 대박', av: '익' },
  { id: 's4', nm: '줄넘기TV', amt: 5000, text: '코트1 페이스 좋아요 👏', av: '줄' },
  { id: 's5', nm: '관전중', amt: 0, text: '와 방금 그 스퍼트!!', av: '관' },
  { id: 's6', nm: '대전로프', amt: 1000, text: '응원합니다 😊', av: '대' },
];

function ChatCard({ m, pinned }) {
  if (!m.amt) {
    return (
      <div className={`${styles.sc} ${styles.scPlain}`}>
        <div className={styles.scTop}>
          <span className={styles.scAv}>{m.av}</span>
          <span className={styles.scNm}>{m.nm}</span>
          <span className={styles.scText} style={{ padding: 0, fontSize: 13 }}>{m.text}</span>
        </div>
      </div>
    );
  }
  const t = tierOf(m.amt);
  return (
    <div className={`${styles.sc} ${pinned ? styles.pinned : ''}`} style={{ background: `color-mix(in srgb, ${t.c} 16%, var(--surface))` }}>
      <div className={styles.scTop} style={{ background: t.c }}>
        <span className={styles.scAv}>{m.av}</span>
        <span className={styles.scNm}>{m.nm}</span>
        {pinned && <span className={styles.pinTag}>📌 고정</span>}
        <span className={styles.scAmt}>{won(m.amt)}</span>
      </div>
      {m.text && <div className={styles.scText}>{m.text}</div>}
    </div>
  );
}

export function SuperChat() {
  const navigate = useNavigate();
  const [amt, setAmt] = useState(5000);
  const [text, setText] = useState('');
  const [msgs, setMsgs] = useState(SEED);
  const feedRef = useRef(null);

  // 고액(3만↑)은 위에 핀 고정, 나머지는 최신순
  const pinned = msgs.filter((m) => m.amt >= 30000);
  const rest = msgs.filter((m) => m.amt < 30000);

  useEffect(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, [msgs.length]);

  const sel = tierOf(amt);
  const send = () => {
    const m = { id: `me${Date.now()}`, nm: '나', amt, text: text.trim(), av: '나' };
    setMsgs((xs) => [...xs, m]);
    setText('');
    if (amt >= 10000) {
      try { confetti({ particleCount: amt >= 50000 ? 140 : 70, spread: 70, origin: { y: 0.7 }, colors: ['#33D6D6', '#5BA8FF', '#B49CFF', '#FFB648'] }); } catch { /* ignore */ }
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.bar}>
        <button className={styles.back} onClick={() => navigate(-1)} aria-label="뒤로">←</button>
        <span className={styles.barT}>💎 <b>슈퍼챗</b> 응원·후원</span>
      </div>

      <div className={styles.ctx}>
        <div className={styles.ctxThumb}><span className={styles.ctxLive}>LIVE</span>📹</div>
        <div style={{ minWidth: 0 }}>
          <div className={styles.ctxT}>코트 1 · 30초 스피드 · 남자 9세부</div>
          <div className={styles.ctxS}>김서연 · 박도윤 외 6명 출전 중</div>
        </div>
      </div>

      <div className={styles.feedHd}><i /> 실시간 응원 {msgs.length}</div>
      <div className={styles.feed} ref={feedRef}>
        {pinned.map((m) => <ChatCard key={m.id} m={m} pinned />)}
        {rest.map((m) => <ChatCard key={m.id} m={m} />)}
      </div>

      <div className={styles.composer}>
        <div className={styles.tiers}>
          {TIERS.map((t) => {
            const on = amt === t.amt;
            return (
              <button key={t.amt} className={`${styles.tier} ${on ? styles.tierOn : ''}`} onClick={() => setAmt(t.amt)}
                style={on ? { background: t.c } : undefined}>
                <div className={styles.tierAmt}>{t.amt >= 10000 ? `${t.amt / 10000}만` : `${t.amt / 1000}천`}</div>
                <div className={styles.tierK}>{t.k}</div>
              </button>
            );
          })}
        </div>
        <div className={styles.inRow}>
          <input className={styles.in} value={text} onChange={(e) => setText(e.target.value)} placeholder="응원 메시지 (선택)"
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
          <button className={styles.send} style={{ background: sel.c }} onClick={send}>
            <Gift size={15} /> {won(amt)} 응원
          </button>
        </div>
        <div className={styles.note}>
          후원금은 <b>출전 선수·소속팀 지원</b>과 <b>대회 운영</b>에 쓰여요. 결제는 안전한 PG로 진행돼요(데모에선 결제 없이 표시만).
        </div>
      </div>
    </div>
  );
}

export default SuperChat;
