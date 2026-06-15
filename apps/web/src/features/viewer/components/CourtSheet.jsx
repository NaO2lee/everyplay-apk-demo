import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import styles from '../ViewerApp.module.css';
import { useStationHeat, extractYouTubeId } from '../hooks/useStationHeat';
import { CHAT_SEED, CHAT_MORE, CHEER_PRESETS, DEMO_MATCH } from '../data/mockData';

// 경과 시간 타이머 (매초 강제 리렌더, 값은 렌더에서 계산 — 이펙트 내 setState 회피)
function fmtElapsed(startedAt) {
  if (!startedAt) return '00:00';
  const d = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`;
}
function LiveTimer({ startedAt }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!startedAt) return undefined;
    const id = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span>{fmtElapsed(startedAt)}</span>;
}

// 코트 상세 — 아래에서 올라오는 바텀시트 (뒤로가기 버튼 없음, ↓밀기/바깥탭 닫기)
export function CourtSheet({ station, open, onClose }) {
  const heat = useStationHeat(station?.id);
  const videoId = extractYouTubeId(station?.youtube_stream_url);
  const isLive = heat.status === 'live';
  const videoRef = useRef(null);
  const chatRef = useRef(null);
  const [msgs, setMsgs] = useState(CHAT_SEED);
  const [text, setText] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const moreRef = useRef(0);
  const hm = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const send = (t) => {
    const v = (t ?? text).trim();
    if (!v) return;
    setMsgs((m) => [...m, { id: `me${m.length}`, name: '나', color: '#33D6D6', text: v, time: hm() }]);
    setText('');
  };
  // 실시간 푸시 대신 새로고침(요청 시에만 로드) — 서버 부하↓ (백엔드 권고)
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setTimeout(() => {
      const next = CHAT_MORE[moreRef.current];
      if (next) { setMsgs((m) => [...m, next]); moreRef.current += 1; }
      setRefreshing(false);
    }, 500);
  };

  // 새 메시지 → 채팅 내부 스크롤만 맨 아래로 (화면 전체는 안 밀림)
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [msgs]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const goFullscreen = () => {
    const el = videoRef.current;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
  };
  const rotate = () => {
    // 가로 모드 시도 (설치형 앱/지원 브라우저에서만 동작)
    try { window.screen?.orientation?.lock?.('landscape'); } catch { /* no-op */ }
  };

  const nameOf = (p) => p?.name || p;

  return (
    <>
      <div className={`${styles.dim} ${open ? styles.dimOn : ''}`} onClick={onClose} />
      <div className={`${styles.sheet} ${open ? styles.sheetOn : ''}`}>
        <button className={styles.grab} onClick={onClose} aria-label="닫기" />
        {station && (
          <>
            <div className={styles.svid} ref={videoRef}>
              {videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                  title={`코트 ${station.station_number} 큰화면`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className={styles.svidPl}>📹 영상 준비 중</div>
              )}
              {isLive && <span className={styles.badge}><span className={styles.dot} />LIVE</span>}
              <div className={styles.vctrl}>
                <button title="가로 회전" onClick={(e) => { e.stopPropagation(); rotate(); }}>⟳</button>
                <button title="전체화면" onClick={(e) => { e.stopPropagation(); goFullscreen(); }}>⛶</button>
              </div>
            </div>

            <div className={styles.scont}>
              {/* 경기 정보: 일차·종목·HIT·출전 선수(+국기). 데모는 DEMO_MATCH, 실데이터는 heat */}
              <div className={styles.matchBar}>
                <span className={`${styles.matchTag} ${styles.matchTagHot}`}>🔴 {DEMO_MATCH.dayOf}일차</span>
                <span className={`${styles.matchTag} ${styles.matchTagCyan}`}>HIT {heat.heat_number ?? DEMO_MATCH.hit}</span>
                <span className={styles.matchTag}>{heat.event_type || DEMO_MATCH.event}</span>
              </div>
              <div className={styles.chips} style={{ marginBottom: 14 }}>
                {(heat.participants?.length ? heat.participants.map((p) => ({ name: nameOf(p), flag: '🇰🇷' })) : DEMO_MATCH.players).map((p, i) => (
                  <span key={i} className={styles.chip}>
                    <span className={styles.chipAv}>{String(p.name).charAt(0)}</span>{p.flag} {p.name}
                  </span>
                ))}
              </div>
              {isLive ? (
                <>
                  <div className={styles.statrow}>
                    <div className={styles.stat}>
                      <div className={styles.statK}>진행 HIT</div>
                      <div className={styles.statV}>#{heat.heat_number ?? '-'}</div>
                    </div>
                    <div className={styles.stat}>
                      <div className={styles.statK}>경과 시간</div>
                      <div className={styles.statV}><LiveTimer startedAt={heat.started_at} /></div>
                    </div>
                  </div>
                  {(heat.event_type || heat.division) && (
                    <div className={styles.evtag}>
                      {heat.event_type || ''}{heat.division ? ` · ${heat.division}` : ''}
                    </div>
                  )}
                  <div className={`${styles.dcard} ${styles.mt12}`}>
                    <div className={styles.lbl}>현재 경기 중</div>
                    <div className={styles.chips}>
                      {(!heat.participants || heat.participants.length === 0)
                        ? <span className={styles.muted}>현재 진행 중인 경기가 없어요</span>
                        : heat.participants.map((p, i) => (
                            <span key={i} className={styles.chip}>
                              <span className={styles.chipAv}>{String(nameOf(p)).charAt(0)}</span>{nameOf(p)}
                            </span>
                          ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className={`${styles.dcard} ${styles.mt12}`}>
                  <span className={styles.muted}>현재 진행 중인 경기가 없습니다.</span>
                </div>
              )}

              {heat.next_participants && heat.next_participants.length > 0 && (
                <div className={`${styles.dcard} ${styles.mt12}`}>
                  <div className={styles.lbl}>다음 대기</div>
                  <div className={styles.chips}>
                    {heat.next_participants.map((p, i) => (
                      <span key={i} className={`${styles.chip} ${styles.chipNext}`}>
                        <span className={styles.chipAv}>{String(nameOf(p)).charAt(0)}</span>{nameOf(p)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className={styles.chatWrap}>
                <div className={styles.chatHd}>
                  <span className={styles.chatHdT}>💬 응원 댓글 <span style={{ color: 'var(--gray)', fontWeight: 600 }}>· {msgs.length}</span></span>
                  <button className={styles.chatRefresh} onClick={refresh} disabled={refreshing}>
                    <RefreshCw size={13} /> {refreshing ? '불러오는 중' : '새로고침'}
                  </button>
                </div>
                <div className={styles.cheerRow}>
                  {CHEER_PRESETS.map((p) => (
                    <button key={p} className={styles.cheerChip} onClick={() => send(p)}>{p}</button>
                  ))}
                </div>
                <div className={styles.chat} ref={chatRef}>
                  {msgs.map((m) => (
                    <div key={m.id} className={styles.chatMsg}>
                      <span className={styles.chatAv} style={{ background: m.color }}>{m.name.charAt(0)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div><span className={styles.chatName}>{m.name}</span><span className={styles.chatTime}>{m.time || '방금'}</span></div>
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
                    placeholder="댓글 남기기…"
                  />
                  <button className={styles.chatSend} onClick={() => send()}>등록</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default CourtSheet;
