import { useEffect, useState } from 'react';
import styles from '../ViewerApp.module.css';
import { CourtCard } from '../components/CourtCard';
import { useChat, chatTime } from '../data/chatStore';

// 1행 응원 티커 — 아래→위로 하나씩. 최신부터, 새 게 없으면 이전 메시지로.
// 닉네임 + 내용 + 시각(라이브 중 'N분 전' / 끝나면 '26.03.04 12:33').
function ChatTicker({ live }) {
  const chat = useChat();
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => x + 1), 2600);
    return () => clearInterval(id);
  }, []);
  if (!chat.length) return <span className={styles.tkLine}><span className={styles.tkTxt}>아직 응원이 없어요</span></span>;
  const msg = chat[chat.length - 1 - (i % chat.length)];
  return (
    <span key={`${chat.length}-${i}`} className={`${styles.tkLine} ${styles.tickerUp}`}>
      <span className={styles.tkTxt}><b className={styles.tkNm}>{msg.name}</b> {msg.text}</span>
      <span className={styles.tkTime}>{chatTime(msg.ts, live)}</span>
    </span>
  );
}

// 라이브 중계 탭 — 컴팩트 코트 목록 + 공용 응원 티커(밝은 블럭). 채팅 참여는 코트 입장 후.
export function LiveTab({ courts, onOpenCourt, live = true, liveNow = false }) {
  return (
    <div className={styles.pageFade}>
      <div className={styles.hero}>
        {liveNow ? (
          <>
            <div className={styles.heroK}>지금 생중계 중</div>
            <div className={styles.heroV}><b>{courts.length}개 코트</b> 중계</div>
            <div className={styles.heroSub}>보고 싶은 코트를 눌러 크게 볼 수 있어요</div>
          </>
        ) : (
          <>
            <div className={styles.heroK}>코트 {courts.length}개 · 대기 중</div>
            <div className={styles.heroV}>곧 <b>경기가 시작</b>돼요</div>
            <div className={styles.heroSub}>생중계가 시작되면 여기서 코트별로 볼 수 있어요</div>
          </>
        )}
      </div>

      <div className={styles.sec}>
        <h2 className={styles.secTitle}>코트별 중계</h2>
        <span className={styles.cnt}>전체 {courts.length}</span>
      </div>

      {/* 공용 응원 티커 — '코트별 중계' 바로 아래, 밝은 블럭. 새 응원이 아래→위로 흘러감 */}
      <div className={styles.tickerLight}>
        <span className={styles.tickerLive} />
        <span className={styles.tickerClip}><ChatTicker live={live} /></span>
      </div>

      {courts.length === 0 ? (
        <div className={styles.muted} style={{ textAlign: 'center', padding: '40px 0' }}>등록된 코트가 없습니다</div>
      ) : (
        <div className={styles.courtList}>
          {courts.map((station) => (
            <CourtCard key={station.id} station={station} onOpen={onOpenCourt} />
          ))}
        </div>
      )}
    </div>
  );
}

export default LiveTab;
