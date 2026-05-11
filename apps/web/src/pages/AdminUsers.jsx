/**
 * 관리자 — 사용자 관리 (v3.3 R6 CRUD).
 * /admin-users
 *
 * GET /users (admin) — 가입자 목록
 * PATCH /users/{id} — role/active/name/phone/country 변경
 * DELETE /users/{id} — soft delete (is_active=False)
 *
 * 모든 변경 audit_log 자동 기록.
 */
import { useEffect, useState } from 'react';
import Flag from '../components/Flag';
import AuditTail from '../components/AuditTail';

const ROLES = ['admin', 'operator', 'judge', 'player', 'coach'];

export default function AdminUsers() {
  const [token, setToken] = useState(localStorage.getItem('adminToken') || localStorage.getItem('dev_admin_token') || '');
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState({ role: '', is_active: '' });
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
    const params = new URLSearchParams({ limit: '200' });
    if (filter.role) params.set('role', filter.role);
    if (filter.is_active) params.set('is_active', filter.is_active);
    try {
      const r = await fetch(`/api/v1/users?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (j.success) setUsers(j.data || []);
      else setError(j.detail || '조회 실패 — admin 토큰 필요');
    } catch (e) { setError(String(e)); }
  };

  useEffect(() => { load(); }, [token, filter.role, filter.is_active]);

  const updateRole = async (id, role) => {
    setPending((p) => ({ ...p, [id]: true }));
    try {
      const r = await fetch(`/api/v1/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role }),
      });
      if (r.ok) await load();
    } catch (e) { setError(String(e)); }
    setPending((p) => ({ ...p, [id]: false }));
  };

  const toggleActive = async (id, active) => {
    setPending((p) => ({ ...p, [id]: true }));
    try {
      const r = await fetch(`/api/v1/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: active }),
      });
      if (r.ok) await load();
    } catch (e) { setError(String(e)); }
    setPending((p) => ({ ...p, [id]: false }));
  };

  const deactivate = async (id) => {
    if (!confirm('사용자 비활성화 (soft delete)? audit log 기록됨.')) return;
    setPending((p) => ({ ...p, [id]: true }));
    try {
      const r = await fetch(`/api/v1/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) await load();
    } catch (e) { setError(String(e)); }
    setPending((p) => ({ ...p, [id]: false }));
  };

  if (!token) {
    return (
      <Wrap>
        <h1 style={h1}>👥 사용자 관리</h1>
        <button onClick={grantDevToken} style={btn('#dc2626')}>임시 admin 토큰 (DEV)</button>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={h1}>👥 사용자 관리</h1>
        <small style={muted}>{users.length}명</small>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <select value={filter.role} onChange={(e) => setFilter({ ...filter, role: e.target.value })} style={sel}>
          <option value="">전체 role</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filter.is_active} onChange={(e) => setFilter({ ...filter, is_active: e.target.value })} style={sel}>
          <option value="">전체 상태</option>
          <option value="true">활성만</option>
          <option value="false">비활성만</option>
        </select>
        <button onClick={load} style={{ ...btn('#475569'), padding: '6px 12px', fontSize: 12 }}>↻</button>
      </div>

      {error && <div style={errBox}>{error}</div>}

      {users.length === 0 ? (
        <p style={muted}>가입한 사용자가 없습니다. <a href="/signup">/signup</a>에서 시작.</p>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          {users.map((u) => (
            <div key={u.id} style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto',
              gap: 10, alignItems: 'center', padding: 12, borderBottom: '1px solid #f1f5f9',
              opacity: u.is_active ? 1 : 0.5,
            }}>
              <Flag code={u.country_code} size={20} />
              <div>
                <div style={{ fontWeight: 700 }}>{u.name} <small style={{ color: '#94a3b8', fontWeight: 400 }}>{u.email}</small></div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {u.phone_number || '폰 미입력'} · 가입 {new Date(u.created_at).toLocaleDateString()}
                  {u.last_login && ` · 최근 ${new Date(u.last_login).toLocaleDateString()}`}
                </div>
              </div>
              <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value)} disabled={pending[u.id]} style={{ ...sel, fontSize: 12 }}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={() => toggleActive(u.id, !u.is_active)} disabled={pending[u.id]} style={{ ...smBtn(u.is_active ? '#16a34a' : '#94a3b8'), fontSize: 11 }}>
                {u.is_active ? '🟢 활성' : '⚪ 비활성'}
              </button>
              {u.is_active && <button onClick={() => deactivate(u.id)} disabled={pending[u.id]} style={smBtn('#dc2626')}>🗑</button>}
            </div>
          ))}
        </div>
      )}

      <AuditTail token={token} actionTypes={['user_updated', 'user_deactivated']} limit={6} title="📜 사용자 관리 기록" />
    </Wrap>
  );
}

function Wrap({ children }) {
  return <div style={{ maxWidth: 920, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>{children}</div>;
}
const h1 = { fontSize: 22, fontWeight: 800, margin: 0 };
const muted = { color: '#94a3b8', fontSize: 12 };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 };
const btn = (color) => ({ padding: '10px 16px', background: color, color: 'white', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 });
const smBtn = (color) => ({ padding: '6px 10px', background: color, color: 'white', border: 0, borderRadius: 6, cursor: 'pointer', fontWeight: 700 });
const sel = { padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 };
