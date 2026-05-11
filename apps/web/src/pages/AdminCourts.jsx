/**
 * 관리자 — 코트 동적 메타 토글 (v3.3 Phase 2).
 * /admin-courts?event=<event_id>
 *
 * 코트별 활성 토글, 표시명, 좌표 즉시 변경.
 * Phase 6에서 SSE 브로드캐스트로 viewer/judge 즉시 반영.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AuditTail from '../components/AuditTail';

const SEED_EVENT_ID = 'f1c1ccee-071b-40b7-834b-00ff669620cc';

export default function AdminCourts() {
  const [params, setParams] = useSearchParams();
  const eventId = params.get('event') || SEED_EVENT_ID;
  const [token, setToken] = useState(localStorage.getItem('adminToken') || localStorage.getItem('dev_admin_token') || '');
  const [eventInput, setEventInput] = useState(eventId);
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
    try {
      const r = await fetch(`/api/v1/stations/event/${eventId}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (j.success) setStations(j.data || []);
      else setError(j.detail || '조회 실패');
    } catch (e) { setError(String(e)); }
  };

  useEffect(() => { load(); }, [token, eventId]);

  const update = async (stationId, patch) => {
    setPending((p) => ({ ...p, [stationId]: true }));
    try {
      const r = await fetch(`/api/v1/stations/${stationId}/meta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      const j = await r.json();
      if (j.success) {
        setStations((arr) => arr.map((s) => s.id === stationId ? { ...s, ...j.data } : s));
      }
    } catch (e) { setError(String(e)); }
    setPending((p) => ({ ...p, [stationId]: false }));
  };

  if (!token) {
    return (
      <Wrap>
        <h1 style={h1}>🎛️ 관리자 — 코트 토글</h1>
        <p style={muted}>관리자 토큰 필요.</p>
        <button onClick={grantDevToken} style={btn('#dc2626')}>임시 admin 토큰 (DEV)</button>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={h1}>🎛️ 코트 메타 관리</h1>
        <button onClick={load} style={{ ...btn('#475569'), padding: '6px 12px', fontSize: 12 }}>↻ 새로고침</button>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={eventInput} onChange={(e) => setEventInput(e.target.value)}
          style={{ flex: 1, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }}
          placeholder="event_id" />
        <button onClick={() => setParams({ event: eventInput })} style={btn('#2563eb')}>적용</button>
      </div>

      {error && <div style={errBox}>{error}</div>}

      {stations.length === 0 ? (
        <p style={muted}>해당 이벤트에 코트가 없습니다.</p>
      ) : (
        stations.map((s) => (
          <CourtCard key={s.id} s={s} onUpdate={(patch) => update(s.id, patch)} pending={!!pending[s.id]} />
        ))
      )}

      <div style={{ marginTop: 24, fontSize: 12, color: '#94a3b8' }}>
        ※ 변경은 즉시 DB 저장 + audit_log 기록 + SSE로 viewer 화면 자동 반영.
      </div>

      <AuditTail token={token} actionTypes={['court_meta_changed']} limit={5} title="📜 코트 변경 기록" />
    </Wrap>
  );
}

function CourtCard({ s, onUpdate, pending }) {
  const [name, setName] = useState(s.display_name || `Court ${s.station_number}`);
  const [posX, setPosX] = useState(s.position_x ?? 0);
  const [posY, setPosY] = useState(s.position_y ?? 0);

  useEffect(() => {
    setName(s.display_name || `Court ${s.station_number}`);
    setPosX(s.position_x ?? 0);
    setPosY(s.position_y ?? 0);
  }, [s.display_name, s.position_x, s.position_y, s.station_number]);

  return (
    <section style={{ background: 'white', border: '1px solid #e2e8f0', borderLeft: `4px solid ${s.is_active ? '#16a34a' : '#94a3b8'}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          {s.is_active ? '🟢' : '⚪'} Court {s.station_number} <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 12 }}>({s.status})</span>
        </h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={s.is_active} onChange={(e) => onUpdate({ is_active: e.target.checked })} />
          <span style={{ fontWeight: 700 }}>활성</span>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px auto', gap: 8, alignItems: 'end' }}>
        <Field label="표시명" value={name} onChange={setName} />
        <Field label="position X" value={posX} onChange={(v) => setPosX(parseInt(v) || 0)} num />
        <Field label="position Y" value={posY} onChange={(v) => setPosY(parseInt(v) || 0)} num />
        <button
          onClick={() => onUpdate({ display_name: name, position_x: posX, position_y: posY })}
          style={{ ...btn('#2563eb'), padding: '8px 14px', fontSize: 13 }}
          disabled={pending}
        >
          {pending ? '...' : '저장'}
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
        id: {s.id}
      </div>
    </section>
  );
}

function Field({ label, value, onChange, num }) {
  return (
    <label>
      <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</span>
      <input type={num ? 'number' : 'text'} value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }} />
    </label>
  );
}

function Wrap({ children }) {
  return <div style={{ maxWidth: 720, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>{children}</div>;
}
const h1 = { fontSize: 22, fontWeight: 800, margin: 0 };
const muted = { color: '#94a3b8', fontSize: 12 };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 };
const btn = (color) => ({ padding: '10px 16px', background: color, color: 'white', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 });
