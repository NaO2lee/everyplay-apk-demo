import { useEffect, useRef, useState } from 'react';
import styles from '../ViewerApp.module.css';
import { useChat, sendChat, chatTime } from '../data/chatStore';

/* 공용 응원 채팅 패널 — 코트 시트에서 사용(코트 입장 시 노출). court=보는 코트.
   메시지는 모든 코트 공용. 작성자가 보던 코트가 "코트N"으로 태그됨.
   시각: 라이브 중 "N분 전" / 라이브 종료 후 "26.03.04 12:33". */

const CHEERS = ['🔥 화이팅!', '👏 잘한다!', '💪 최고!', '🎉 축하해요', '😮 대박!'];
const tag = (c) => (c == null ? '전체' : `코트${c}`);

export function ChatPanel({ court = null, live = true }) {
  const chat = useChat();
  const [text, setText] = useState('');
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [chat.length]);
  const send = (t) => { sendChat(t ?? text, court); setText(''); };

  return (
    <div className={styles.chatWrap}>
      <div className={styles.chatHd}>
        <span className={styles.chatHdT}><span className={styles.live} /> 공용 응원 채팅 <span style={{ color: 'var(--gray)', fontWeight: 600 }}>· {chat.length}</span></span>
        <span style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 600 }}>모든 코트 공용</span>
      </div>
      <div className={styles.cheerRow}>
        {CHEERS.map((p) => <button key={p} className={styles.cheerChip} onClick={() => send(p)}>{p}</button>)}
      </div>
      <div className={styles.chat} ref={ref}>
        {chat.map((m) => (
          <div key={m.id} className={styles.chatMsg}>
            <span className={styles.chatAv} style={{ background: m.color }}>{m.name.charAt(0)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div><span className={styles.courtTag}>{tag(m.court)}</span><span className={styles.chatName}>{m.name}</span><span className={styles.chatTime}>{chatTime(m.ts, live)}</span></div>
              <div className={styles.chatText}>{m.text}</div>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.chatInput}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder={court == null ? '응원 메시지 남기기…' : `코트${court} 응원 남기기…`}
        />
        <button className={styles.chatSend} onClick={() => send()}>등록</button>
      </div>
    </div>
  );
}

export default ChatPanel;
