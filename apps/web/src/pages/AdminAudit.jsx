/**
 * 관리자 — Audit Log 조회 (v3.3 R4).
 * /admin-audit
 *
 * 모든 점수 변경, 이의 처리, 호명, 재진행 등 immutable 기록.
 * 후일 협회 보고용 데이터.
 */
import { useEffect, useState } from 'react';

const ACTION_TYPES = [
  '', 'no_show_called', 'no_show_handled', 'rerun_requested', 'rerun_approved',
  'appeal_filed', 'appeal_decided',
];
const TARGET_TYPES = ['', 'participant', 'rerun', 'appeal', 'score', 'award', 'heat'];

export default function AdminAudit() {
  const [token, setToken] = useState(localStorage.getItem('adminToken') || localStorage.getItem('dev_admin_token') || '');
  const [logs, setLogs] = useState([]);
  const [actionFilter, setActionFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    const params = new URLSearchParams({ limit: '200' });
    if (actionFilter) params.set('action_type', actionFilter);
    if (targetFilter) params.set('target_type', targetFilter);
    try {
      const r = await fetch(`/api/v1/operator/audit-logs?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (j.success) setLogs(j.data || []);
      else setError(j.detail || '조회 실패');
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [token, actionFilter, targetFilter]);

  if (!token) {
    return (
      <Wrap>
        <h1 style={h1}>📜 Audit Log</h1>
        <button onClick={grantDevToken} style={btn('#dc2626')}>임시 admin 토큰 (DEV)</button>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={h1}>📜 Audit Log</h1>
        <small style={muted}>{logs.length}개 (최신 200) {loading && '⏳'}</small>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Select label="action_type" value={actionFilter} onChange={setActionFilter} options={ACTION_TYPES} />
        <Select label="target_type" value={targetFilter} onChange={setTargetFilter} options={TARGET_TYPES} />
        <button onClick={load} style={{ ...btn('#475569'), padding: '6px 12px', fontSize: 12 }}>↻</button>
      </div>

      {error && <div style={errBox}>{error}</div>}

      {logs.length === 0 ? (
        <p style={muted}>해당 조건의 로그 없음.</p>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          {logs.map((l) => (
            <LogRow key={l.id} l={l} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 12, color: '#94a3b8' }}>
        ※ Immutable — 한번 기록되면 수정·삭제 불가. 분쟁·협회 보고용.
      </div>
    </Wrap>
  );
}

function LogRow({ l }) {
  const [open, setOpen] = useState(false);
  const ac = actionColor(l.action_type);
  return (
    <div style={{ borderBottom: '1px solid #f1f5f9', padding: '10px 14px', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
        <span style={{ background: ac, color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{l.action_type}</span>
        <span style={{ color: '#64748b', fontSize: 11 }}>{l.target_type}</span>
        {l.target_id && <code style={{ fontSize: 10, color: '#94a3b8' }}>{l.target_id.slice(0, 8)}</code>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          {new Date(l.timestamp).toLocaleString()} · {l.actor_role || '?'}
        </span>
      </div>
      {open && (l.before_value || l.after_value || l.reason) && (
        <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 6, fontSize: 11, fontFamily: 'monospace' }}>
          {l.reason && <div><strong>reason:</strong> {l.reason}</div>}
          {l.before_value && <div style={{ marginTop: 4 }}><strong>before:</strong> {JSON.stringify(l.before_value)}</div>}
          {l.after_value && <div style={{ marginTop: 4 }}><strong>after:</strong> {JSON.stringify(l.after_value)}</div>}
        </div>
      )}
    </div>
  );
}

function actionColor(t) {
  if (t.startsWith('appeal')) return '#7c3aed';
  if (t.startsWith('no_show')) return '#dc2626';
  if (t.startsWith('rerun')) return '#ea580c';
  if (t.startsWith('score')) return '#2563eb';
  if (t.startsWith('award')) return '#ca8a04';
  return '#64748b';
}

function Select({ label, value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: 6, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12 }}>
      <option value="">전체 {label}</option>
      {options.filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Wrap({ children }) {
  return <div style={{ maxWidth: 920, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>{children}</div>;
}
const h1 = { fontSize: 22, fontWeight: 800, margin: 0 };
const muted = { color: '#94a3b8', fontSize: 12 };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 };
const btn = (color) => ({ padding: '10px 16px', background: color, color: 'white', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 });
