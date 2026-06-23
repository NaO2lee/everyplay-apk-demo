import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../ViewerApp.module.css';
import { useStationHeat, extractYouTubeId } from '../hooks/useStationHeat';
import { DEMO_MATCH } from '../data/mockData';
import { ChatPanel } from './ChatPanel';

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
export function CourtSheet({ station, open, onClose, live = true }) {
  const navigate = useNavigate();
  const heat = useStationHeat(station?.id);
  const videoId = extractYouTubeId(station?.youtube_stream_url);
  const isLive = heat.status === 'live';
  const videoRef = useRef(null);
  const [showPlayers, setShowPlayers] = useState(false);

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
              {/* 출전 선수 — 아코디언 더보기 (영상 준비중일 때 깔끔하게 접어둠) */}
              {(() => {
                const players = heat.participants?.length ? heat.participants.map((p) => ({ name: nameOf(p), flag: '🇰🇷' })) : DEMO_MATCH.players;
                return (
                  <div style={{ marginBottom: 14 }}>
                    <button className={styles.accBtn} onClick={() => setShowPlayers((v) => !v)}>
                      🤸 출전 선수 {players.length}명 <span className={styles.accArrow}>{showPlayers ? '▴ 접기' : '▾ 더보기'}</span>
                    </button>
                    {showPlayers && (
                      <div className={styles.chips} style={{ marginTop: 10 }}>
                        {players.map((p, i) => (
                          <span key={i} className={styles.chip}>
                            <span className={styles.chipAv}>{String(p.name).charAt(0)}</span>{p.flag} {p.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
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
              <button
                onClick={() => navigate('/superchat/demo')}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginTop: 12, padding: '12px 14px', border: 0, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', background: 'var(--grad)', color: 'var(--accentInk)', boxShadow: 'var(--glow)' }}
              >
                <span style={{ fontSize: 20 }}>💎</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>슈퍼챗으로 응원·후원하기</span>
                  <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, opacity: 0.85 }}>금액별 컬러 메시지로 선수에게 힘을 — 후원금은 선수·대회 지원에</span>
                </span>
                <span style={{ fontSize: 18, fontWeight: 800 }}>›</span>
              </button>

              {/* 공용 응원 채팅 — 모든 코트 공용. 이 코트(번호)로 태그되어 등록됨 */}
              <ChatPanel court={station.station_number} live={live} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default CourtSheet;
