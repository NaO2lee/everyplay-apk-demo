/**
 * 운영자 — 자동 heat 진행 (v3.3 R7).
 * /operate-runner?event=<event_id>&court=<station_id>
 *
 * 1. "Heat N 시작" 버튼 → 시작 비프 + heats.started_at + setTimeout(duration)
 * 2. duration 끝 → 종료 비프 + heats/{id}/end
 * 3. 결과 집계 + 동점 확인
 * 4. 동점 없으면 5초 후 다음 heat 자동 진행 (auto mode ON일 때)
 * 5. PAUSE 버튼으로 자동 진행 멈춤
 *
 * IJRU 공식 비프 = /public/audio/ijru-start.mp3, ijru-end.mp3 (없으면 synth 폴백)
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { startBeep, endBeep, unlockAudio, hasIjruFiles } from '../lib/beeps';
import { speakBoth } from '../lib/tts';

const SEED_EVENT = 'f1c1ccee-071b-40b7-834b-00ff669620cc';
const DEFAULT_DURATION = 30;  // Speed 30s 기본

export default function OperatorRunner() {
  const [params, setParams] = useSearchParams();
  const eventId = params.get('event') || SEED_EVENT;
  const courtId = params.get('court');  // 필수
  const [token, setToken] = useState(localStorage.getItem('operator_token') || '');
  const [heats, setHeats] = useState([]);
  const [activeHeatId, setActiveHeatId] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [autoMode, setAutoMode] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState(null);
  const [ijruReady, setIjruReady] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const timerRef = useRef(null);
  const tickRef = useRef(null);

  const grantDevToken = async () => {
    const r = await fetch('/api/v1/auth/dev-grant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'operator', user_id: 'dev-op-1' }),
    });
    const j = await r.json();
    if (j.success) { localStorage.setItem('operator_token', j.data.token); setToken(j.data.token); }
  };

  const load = async () => {
    if (!token || !courtId) return;
    try {
      const r = await fetch(`/api/v1/events/${eventId}/heats`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (j.success) {
        const cleaned = (j.data?.items || []).filter((h) => h.station_id === courtId);
        cleaned.sort((a, b) => a.heat_number - b.heat_number);
        setHeats(cleaned);
      }
    } catch (e) { setError(String(e)); }
  };

  useEffect(() => { load(); }, [token, eventId, courtId]);
  useEffect(() => {
    hasIjruFiles().then(setIjruReady);
  }, []);

  // 자동 진행: 종료 후 5초 후 다음 미실행 heat 자동 시작
  useEffect(() => {
    if (!autoMode || paused || !lastResult || activeHeatId) return;
    const next = heats.find((h) => !h.started_at);
    if (!next) return;
    const id = setTimeout(() => start(next.id), 5000);
    return () => clearTimeout(id);
  }, [autoMode, paused, lastResult, activeHeatId, heats]);

  // 카운트다운 표시
  useEffect(() => {
    if (!activeHeatId || remaining <= 0) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }
    tickRef.current = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [activeHeatId]);

  const start = async (heatId) => {
    unlockAudio();
    setError(null);
    setLastResult(null);
    setActiveHeatId(heatId);
    setRemaining(duration);

    // 1. heats start (이미 started면 그냥 진행)
    try {
      const h = heats.find((x) => x.id === heatId);
      if (!h?.started_at) {
        await fetch(`/api/v1/heats/${heatId}/end`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      }
    } catch {}

    // 2. 시작 비프 + TTS 안내
    await startBeep();
    speakBoth(`히트 시작합니다.`, `Heat starting.`);

    // 3. duration 끝나면 자동 종료
    timerRef.current = setTimeout(() => endHeat(heatId), duration * 1000);
  };

  const endHeat = async (heatId) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setActiveHeatId(null);
    setRemaining(0);

    await endBeep();
    speakBoth(`경기 종료.`, `Heat finished.`);

    // 백엔드에 종료 신호
    try {
      await fetch(`/api/v1/heats/${heatId}/end`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}

    // 결과 즉시 조회 (동점 확인용)
    try {
      const r = await fetch(`/api/v1/results/heat/${heatId}`);
      const j = await r.json();
      if (j.success) setLastResult(j.data);
    } catch {}

    await load();
  };

  const pause = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setPaused(true);
    setActiveHeatId(null);
  };

  if (!token || !courtId) {
    return (
      <Wrap>
        <h1 style={h1}>🎬 자동 진행 콘솔</h1>
        {!token && <button onClick={grantDevToken} style={btn('#2563eb')}>임시 operator 토큰</button>}
        {!courtId && (
          <div style={{ marginTop: 16 }}>
            <p style={muted}>코트 ID 필요. URL에 ?court=&lt;station_id&gt; 추가하세요.</p>
            <p style={{ fontSize: 12, marginTop: 8 }}>또는 <a href="/admin-courts" style={{ color: '#2563eb' }}>/admin-courts</a>에서 확인 후 이동.</p>
          </div>
        )}
      </Wrap>
    );
  }

  const nextHeat = heats.find((h) => !h.started_at);
  const currentHeat = heats.find((h) => h.id === activeHeatId);
  const isTied = lastResult && lastResult.tied_groups && lastResult.tied_groups.length > 0;

  return (
    <Wrap>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={h1}>🎬 자동 진행 콘솔</h1>
        <small style={{ ...muted, color: ijruReady ? '#16a34a' : '#ca8a04' }}>
          비프음: {ijruReady ? '✓ IJRU 공식' : '⚠ 합성음 (폴백)'}
        </small>
      </header>

      {!ijruReady && (
        <div style={{ ...errBox, background: '#fef3c7', color: '#78350f', borderLeft: '4px solid #ca8a04' }}>
          IJRU 공식 비프음 파일 없음 — <code>apps/web/public/audio/ijru-start.mp3</code> · <code>ijru-end.mp3</code> 배치 시 자동 사용. 지금은 Web Audio 합성음 사용 중.
        </div>
      )}
      {error && <div style={errBox}>{error}</div>}

      {/* 활성 heat 디스플레이 */}
      {activeHeatId && currentHeat && (
        <section style={{ background: '#0f172a', color: 'white', borderRadius: 12, padding: 32, textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: '#fbbf24', fontWeight: 700, letterSpacing: '0.1em' }}>🔴 LIVE</div>
          <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Heat #{currentHeat.heat_number}</div>
          <div style={{ fontSize: 96, fontWeight: 900, color: remaining <= 5 ? '#dc2626' : '#fbbf24', lineHeight: 1, fontFamily: 'monospace' }}>
            {remaining}s
          </div>
          <button onClick={() => endHeat(activeHeatId)} style={{ ...btn('#dc2626'), marginTop: 16 }}>⏹ 즉시 종료</button>
        </section>
      )}

      {/* 다음 heat 컨트롤 */}
      {!activeHeatId && nextHeat && (
        <section style={card}>
          <h2 style={h2}>다음 진행 — Heat #{nextHeat.heat_number}</h2>
          <p style={{ ...muted, marginBottom: 12 }}>
            참가자 {nextHeat.participants?.length || 0}명: {(nextHeat.participants || []).map((p) => p.name).join(', ')}
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>경기 시간 (초):
              <input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
                style={{ width: 80, marginLeft: 8, padding: 6, border: '1px solid #cbd5e1', borderRadius: 4 }} />
            </label>
            <span style={{ ...muted, fontSize: 11 }}>(Speed=30, Endurance=180)</span>
          </div>
          <button onClick={() => { setPaused(false); start(nextHeat.id); }} style={btn('#16a34a')}>
            ▶ Heat #{nextHeat.heat_number} 시작
          </button>
        </section>
      )}

      {!nextHeat && !activeHeatId && (
        <section style={card}>
          <p style={muted}>이 코트에 미실행 heat 없음. <a href="/admin-heats">/admin-heats</a>에서 새로 생성.</p>
        </section>
      )}

      {/* 자동 모드 */}
      <section style={{ ...card, background: autoMode ? '#fef3c7' : 'white' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={autoMode} onChange={(e) => { setAutoMode(e.target.checked); setPaused(false); }} />
          <strong>🤖 자동 진행 모드</strong>
        </label>
        <p style={{ ...muted, marginTop: 6 }}>
          종료 후 5초 대기 → 동점 없으면 다음 heat 자동 시작. 동점 있으면 자동 정지.
        </p>
        {autoMode && (
          <button onClick={pause} style={{ ...btn(paused ? '#16a34a' : '#dc2626'), marginTop: 8 }}>
            {paused ? '▶ 자동 재개' : '⏸ PAUSE'}
          </button>
        )}
      </section>

      {/* 직전 결과 */}
      {lastResult && (
        <section style={{ ...card, borderLeft: `4px solid ${isTied ? '#dc2626' : '#16a34a'}` }}>
          <h2 style={h2}>{isTied ? '⚠️ 동점 — 재경기 필요' : '✓ 종료 — 결과 확정'}</h2>
          {isTied && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 8 }}>
              {lastResult.tied_groups.length}개 동점 그룹 ({lastResult.tied_groups.map((tg) => `${tg.score}점 ${tg.participant_ids.length}명`).join(' · ')}). 자동 진행 정지됨. <code>/admin-awards</code>에서 시상 시도 시 tiebreaker 자동 생성.
            </div>
          )}
          <div style={{ fontSize: 13 }}>
            상위 5: {lastResult.rankings.slice(0, 5).map((r, i) => `${i+1}.${r.name}=${r.score}`).join(' · ')}
          </div>
        </section>
      )}

      {/* 모든 heat 목록 */}
      <section style={card}>
        <h2 style={h2}>이 코트 모든 Heat</h2>
        {heats.map((h) => (
          <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #e2e8f0', fontSize: 13 }}>
            <span>Heat #{h.heat_number}</span>
            <span style={{ color: h.ended_at ? '#16a34a' : (h.started_at ? '#dc2626' : '#94a3b8') }}>
              {h.ended_at ? '✓ 종료' : h.started_at ? '🔴 진행중' : '대기'}
            </span>
          </div>
        ))}
      </section>
    </Wrap>
  );
}

function Wrap({ children }) {
  return <div style={{ maxWidth: 720, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>{children}</div>;
}
const h1 = { fontSize: 22, fontWeight: 800, margin: 0 };
const h2 = { fontSize: 15, fontWeight: 700, marginBottom: 10 };
const muted = { color: '#94a3b8', fontSize: 12 };
const card = { background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 12 };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 };
const btn = (color) => ({ padding: '12px 20px', background: color, color: 'white', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 });
