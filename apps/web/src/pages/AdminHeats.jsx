/**
 * 관리자 — 히트 라이프사이클 (v3.3 R5).
 * /admin-heats?event=<event_id>
 *
 * 히트 시작/종료. 백엔드 endpoint는 이미 존재:
 *  POST /stations/{station_id}/heats/start
 *  POST /heats/{heat_id}/end
 *
 * Phase 6에서 자동 진행 + 라운드 시스템 연계.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const SEED_EVENT_ID = 'f1c1ccee-071b-40b7-834b-00ff669620cc';

export default function AdminHeats() {
  const [params, setParams] = useSearchParams();
  const eventId = params.get('event') || SEED_EVENT_ID;
  const [eventInput, setEventInput] = useState(eventId);
  const [token, setToken] = useState(localStorage.getItem('adminToken') || localStorage.getItem('dev_admin_token') || '');
  const [heats, setHeats] = useState([]);
  const [stations, setStations] = useState([]);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState({});

  const grantDevToken = async () => {
    const r = await fetch('/api/v1/auth/dev-grant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', user_id: 'dev-admin-1' }),
    });
    const j = await r.json();
    if (j.success) { localStorage.setItem('dev_admin_token', j.data.token); setToken(j.data.token); }
  };

  const load = async () => {
    if (!token) return;
    const auth = { Authorization: `Bearer ${token}` };
    try {
      const [hres, sres] = await Promise.all([
        fetch(`/api/v1/events/${eventId}/heats`, { headers: auth }).then((r) => r.json()),
        fetch(`/api/v1/stations/event/${eventId}`, { headers: auth }).then((r) => r.json()),
      ]);
      if (hres.success) setHeats(hres.data?.items || []);
      if (sres.success) setStations(sres.data || []);
    } catch (e) { setError(String(e)); }
  };

  useEffect(() => { load(); }, [token, eventId]);
  useEffect(() => {
    if (!token) return;
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [token, eventId]);

  const startNewHeat = async (stationId) => {
    setPending((p) => ({ ...p, [stationId]: true }));
    try {
      const r = await fetch(`/api/v1/stations/${stationId}/heats/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ participant_ids: [] }),
      });
      const j = await r.json();
      if (!j.success) setError(j.detail || '시작 실패');
      await load();
    } catch (e) { setError(String(e)); }
    setPending((p) => ({ ...p, [stationId]: false }));
  };

  const endHeat = async (heatId) => {
    setPending((p) => ({ ...p, [heatId]: true }));
    try {
      const r = await fetch(`/api/v1/heats/${heatId}/end`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (!j.success) setError(j.detail || '종료 실패');
      await load();
    } catch (e) { setError(String(e)); }
    setPending((p) => ({ ...p, [heatId]: false }));
  };

  if (!token) {
    return <Wrap><h1 style={h1}>🏃 히트 라이프사이클</h1><button onClick={grantDevToken} style={btn('#dc2626')}>임시 admin 토큰</button></Wrap>;
  }

  // Heats grouped by station
  const byStation = stations.reduce((acc, s) => {
    acc[s.id] = { station: s, heats: [] };
    return acc;
  }, {});
  for (const h of heats) {
    if (byStation[h.station_id]) byStation[h.station_id].heats.push(h);
  }

  return (
    <Wrap>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={h1}>🏃 히트 라이프사이클</h1>
        <small style={muted}>{heats.length}개 히트 · 8초 자동 갱신</small>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={eventInput} onChange={(e) => setEventInput(e.target.value)} style={inp} placeholder="event_id" />
        <button onClick={() => setParams({ event: eventInput })} style={btn('#475569')}>이벤트 변경</button>
      </div>

      {error && <div style={errBox}>{error}</div>}

      {Object.values(byStation).map(({ station, heats }) => (
        <section key={station.id} style={card(station.is_active)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={h2}>
              {station.is_active ? '🟢' : '⚪'} {station.display_name || `Court ${station.station_number}`}
              <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>({station.status})</span>
            </h2>
            {station.is_active && (
              <button onClick={() => startNewHeat(station.id)} disabled={pending[station.id]} style={smBtn('#16a34a')}>
                {pending[station.id] ? '...' : '+ 새 히트 시작'}
              </button>
            )}
          </div>

          {heats.length === 0 ? (
            <p style={muted}>이 코트에 히트 없음</p>
          ) : (
            heats.sort((a, b) => b.heat_number - a.heat_number).slice(0, 5).map((h) => (
              <HeatRow key={h.id} h={h} pending={pending[h.id]} onEnd={() => endHeat(h.id)} />
            ))
          )}
        </section>
      ))}

      {Object.keys(byStation).length === 0 && <p style={muted}>이벤트에 코트가 없습니다.</p>}
    </Wrap>
  );
}

function HeatRow({ h, pending, onEnd }) {
  const live = h.started_at && !h.ended_at;
  const done = h.ended_at;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: 10, alignItems: 'center', padding: 8, borderBottom: '1px dashed #e2e8f0' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: live ? '#dc2626' : done ? '#16a34a' : '#94a3b8', textAlign: 'center' }}>#{h.heat_number}</div>
      <div style={{ fontSize: 12 }}>
        <div><code style={{ fontSize: 10, color: '#94a3b8' }}>{h.id.slice(0, 8)}</code></div>
        <div style={{ color: '#64748b', marginTop: 2 }}>
          {live && <span style={{ color: '#dc2626', fontWeight: 700 }}>🔴 LIVE — {new Date(h.started_at).toLocaleTimeString()} 시작</span>}
          {done && <span style={{ color: '#16a34a' }}>✓ 종료 {new Date(h.ended_at).toLocaleTimeString()}</span>}
          {!h.started_at && <span style={{ color: '#94a3b8' }}>대기</span>}
        </div>
        {h.participants && h.participants.length > 0 && (
          <div style={{ marginTop: 2, fontSize: 11, color: '#64748b' }}>
            선수 {h.participants.length}명: {h.participants.map((p) => p.name).join(', ')}
          </div>
        )}
      </div>
      {live && <button onClick={onEnd} disabled={pending} style={smBtn('#dc2626')}>{pending ? '...' : '종료'}</button>}
    </div>
  );
}

function Wrap({ children }) {
  return <div style={{ maxWidth: 820, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>{children}</div>;
}
const h1 = { fontSize: 22, fontWeight: 800, margin: 0 };
const h2 = { fontSize: 15, fontWeight: 700, margin: 0 };
const muted = { color: '#94a3b8', fontSize: 12 };
const card = (active) => ({ background: 'white', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #e2e8f0', borderLeft: `4px solid ${active ? '#16a34a' : '#94a3b8'}` });
const inp = { flex: 1, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 };
const btn = (color) => ({ padding: '10px 16px', background: color, color: 'white', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 });
const smBtn = (color) => ({ padding: '6px 12px', background: color, color: 'white', border: 0, borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12 });
