/**
 * 관리자 — 시상 흐름 (v3.3 Phase 2).
 * /admin-awards?event=<event_id>
 *
 * 1) 히트 ID 입력 → "1·2·3위 award 자동 생성"
 * 2) 이벤트의 모든 award 목록 → status별 표시
 * 3) called → done 트리거 (Phase 5에서 confirmed는 시상자 본인이)
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AuditTail from '../components/AuditTail';

const SEED_EVENT_ID = 'f1c1ccee-071b-40b7-834b-00ff669620cc';

export default function AdminAwards() {
  const [params, setParams] = useSearchParams();
  const eventId = params.get('event') || SEED_EVENT_ID;
  const [token, setToken] = useState(localStorage.getItem('adminToken') || localStorage.getItem('dev_admin_token') || '');
  const [eventInput, setEventInput] = useState(eventId);
  const [heatInput, setHeatInput] = useState('02a7617b-2ed1-4862-aff5-392e08a7d47a');
  const [awards, setAwards] = useState([]);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  const grantDevToken = async () => {
    const r = await fetch('/api/v1/auth/dev-grant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', user_id: 'dev-admin-1' }),
    });
    const j = await r.json();
    if (j.success) { localStorage.setItem('dev_admin_token', j.data.token); setToken(j.data.token); }
  };

  const load = async () => {
    if (!eventId) return;
    try {
      const r = await fetch(`/api/v1/awards/event/${eventId}`);
      const j = await r.json();
      if (j.success) setAwards(j.data || []);
      else setError(j.detail || '조회 실패');
    } catch (e) { setError(String(e)); }
  };

  useEffect(() => { load(); }, [eventId]);

  const startAwards = async () => {
    setCreating(true); setError(null);
    try {
      const r = await fetch(`/api/v1/awards/from-heat/${heatInput}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (j.success) await load();
      else setError(j.detail || '생성 실패');
    } catch (e) { setError(String(e)); }
    setCreating(false);
  };

  const transition = async (id, to_status) => {
    const r = await fetch(`/api/v1/awards/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to_status }),
    });
    if (r.ok) await load();
  };

  const removeAward = async (id) => {
    if (!confirm('이 award를 삭제하시겠습니까? (audit log에 기록됨)')) return;
    const r = await fetch(`/api/v1/awards/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) await load();
    else {
      const j = await r.json();
      setError(j.detail || '삭제 실패');
    }
  };

  if (!token) {
    return (
      <Wrap>
        <h1 style={h1}>🏆 시상 관리</h1>
        <button onClick={grantDevToken} style={btn('#dc2626')}>임시 admin 토큰 (DEV)</button>
      </Wrap>
    );
  }

  // Group by category
  const byCategory = awards.reduce((acc, a) => {
    const k = a.category || 'default';
    (acc[k] = acc[k] || []).push(a);
    return acc;
  }, {});

  return (
    <Wrap>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={h1}>🏆 시상 흐름</h1>
        <small style={muted}>{awards.length}개 award</small>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={eventInput} onChange={(e) => setEventInput(e.target.value)} style={inpStyle} placeholder="event_id" />
        <button onClick={() => setParams({ event: eventInput })} style={btn('#475569')}>이벤트 변경</button>
      </div>

      <section style={card}>
        <h2 style={h2}>새 시상 — 히트 결과로 1·2·3위 자동 생성</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={heatInput} onChange={(e) => setHeatInput(e.target.value)} style={inpStyle} placeholder="heat_id" />
          <button onClick={startAwards} disabled={creating} style={btn('#7c3aed')}>
            {creating ? '...' : '🏆 시상 시작'}
          </button>
        </div>
      </section>

      {error && <div style={errBox}>{error}</div>}

      {Object.keys(byCategory).length === 0 ? (
        <p style={muted}>아직 award가 없습니다. 히트 ID 입력 후 "시상 시작" 누르세요.</p>
      ) : (
        Object.entries(byCategory).map(([cat, list]) => (
          <section key={cat} style={card}>
            <h2 style={h2}>📋 {cat}</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {list.sort((a, b) => a.rank - b.rank).map((a) => (
                <AwardRow key={a.id} a={a} onTransition={transition} onDelete={removeAward} />
              ))}
            </div>
          </section>
        ))
      )}

      <div style={{ marginTop: 24, fontSize: 12, color: '#94a3b8' }}>
        ※ <strong>called</strong>: 관리자가 호명 시작 / <strong>confirmed</strong>: 시상자 본인 확인 (Phase 5 PWA) / <strong>done</strong>: 시상 완료
      </div>

      <AuditTail token={token} actionTypes={['award_transitioned']} limit={6} title="📜 시상 전이 기록" />
    </Wrap>
  );
}

function AwardRow({ a, onTransition, onDelete }) {
  const medal = a.rank === 1 ? '🥇' : a.rank === 2 ? '🥈' : '🥉';
  const colors = a.rank === 1 ? ['#fbbf24', '#78350f'] : a.rank === 2 ? ['#cbd5e1', '#475569'] : ['#fb923c', '#7c2d12'];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr auto', gap: 12, alignItems: 'center', padding: 12, background: 'white', border: '1px solid #e2e8f0', borderLeft: `4px solid ${colors[0]}`, borderRadius: 8 }}>
      <div style={{ fontSize: 28, textAlign: 'center' }}>{medal}</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {a.rank}위 — {a.participant_name || '(이름 없음)'}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
          status: <span style={{ background: statusColor(a.status), color: 'white', padding: '1px 8px', borderRadius: 999, fontWeight: 700 }}>{a.status}</span>
          {a.called_at && ` · 호명 ${new Date(a.called_at).toLocaleTimeString()}`}
          {a.confirmed_at && ` · 확인 ${new Date(a.confirmed_at).toLocaleTimeString()}`}
          {a.done_at && ` · 완료 ${new Date(a.done_at).toLocaleTimeString()}`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
        {a.status === 'pending' && <button onClick={() => onTransition(a.id, 'called')} style={smallBtn('#2563eb')}>📢 호명</button>}
        {a.status === 'called' && <button onClick={() => onTransition(a.id, 'confirmed')} style={smallBtn('#ca8a04')}>(시상자 확인)</button>}
        {(a.status === 'called' || a.status === 'confirmed') && <button onClick={() => onTransition(a.id, 'done')} style={smallBtn('#16a34a')}>✓ 완료</button>}
        {a.status !== 'done' && onDelete && <button onClick={() => onDelete(a.id)} style={smallBtn('#dc2626')}>🗑 삭제</button>}
      </div>
    </div>
  );
}

function statusColor(s) {
  return { pending: '#94a3b8', called: '#2563eb', confirmed: '#ca8a04', done: '#16a34a' }[s] || '#94a3b8';
}

function Wrap({ children }) {
  return <div style={{ maxWidth: 760, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>{children}</div>;
}
const h1 = { fontSize: 22, fontWeight: 800, margin: 0 };
const h2 = { fontSize: 15, marginBottom: 12, fontWeight: 700 };
const muted = { color: '#94a3b8', fontSize: 12 };
const card = { background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 12 };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 };
const btn = (color) => ({ padding: '10px 16px', background: color, color: 'white', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 });
const smallBtn = (color) => ({ padding: '6px 10px', background: color, color: 'white', border: 0, borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 11 });
const inpStyle = { flex: 1, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' };
