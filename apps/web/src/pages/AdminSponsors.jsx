/**
 * 관리자 — 스폰서 마스터 관리 (5/11 머지 Phase 2).
 * /admin-sponsors
 *
 * 스폰서 CRUD + 배너 업로드. 이벤트-스폰서 연결은 EventDetail 에서.
 */
import { useEffect, useState } from 'react';

const KINDS = [
  { v: 'AD', label: '광고 (AD)' },
  { v: 'SPONSOR', label: '스폰서 (SPONSOR)' },
];

const emptyForm = {
  name: '', tagline: '', kind: 'AD',
  logo_url: '', banner_image_url: '', banner_position: 'center', banner_zoom: 100,
  cta_text: '', cta_url: '',
};

export default function AdminSponsors() {
  const [token, setToken] = useState(localStorage.getItem('adminToken') || localStorage.getItem('dev_admin_token') || '');
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // sponsor id or 'new'
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

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
      const r = await fetch('/api/v1/sponsors?limit=200', { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (j.success) setItems(j.data.items || []);
      else setError(j.detail || '조회 실패');
    } catch (e) { setError(String(e)); }
  };

  useEffect(() => { load(); }, [token]);

  const startNew = () => { setEditing('new'); setForm(emptyForm); };
  const startEdit = (sp) => {
    setEditing(sp.id);
    setForm({
      name: sp.name || '',
      tagline: sp.tagline || '',
      kind: sp.kind || 'AD',
      logo_url: sp.logo_url || '',
      banner_image_url: sp.banner_image_url || '',
      banner_position: sp.banner_position || 'center',
      banner_zoom: sp.banner_zoom ?? 100,
      cta_text: sp.cta_text || '',
      cta_url: sp.cta_url || '',
    });
  };
  const cancel = () => { setEditing(null); setForm(emptyForm); };

  const save = async () => {
    setError(null);
    const url = editing === 'new' ? '/api/v1/sponsors' : `/api/v1/sponsors/${editing}`;
    const method = editing === 'new' ? 'POST' : 'PATCH';
    // 빈 문자열은 null 로 정리 (PATCH 의 의도치 않은 덮어쓰기 방지)
    const body = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])
    );
    const r = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.success) { cancel(); load(); }
    else setError(j.detail || '저장 실패');
  };

  const remove = async (id) => {
    if (!confirm('정말 삭제할까요? 이벤트 연결도 같이 끊깁니다.')) return;
    const r = await fetch(`/api/v1/sponsors/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (j.success) load();
    else setError(j.detail || '삭제 실패');
  };

  const uploadBanner = async (id, file) => {
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`/api/v1/sponsors/${id}/banner`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const j = await r.json();
      if (j.success) load();
      else setError(j.detail || '업로드 실패');
    } catch (e) { setError(String(e)); }
    setUploading(false);
  };

  if (!token) {
    return (
      <Wrap>
        <h1 style={h1}>🎨 스폰서 / 광고 관리</h1>
        <p style={muted}>관리자 토큰이 필요합니다.</p>
        <button onClick={grantDevToken} style={btn('#dc2626')}>임시 admin 토큰 (DEV)</button>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={h1}>🎨 스폰서 / 광고 관리</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ ...btn('#475569'), padding: '6px 12px', fontSize: 12 }}>↻ 새로고침</button>
          <button onClick={startNew} style={{ ...btn('#0ea5e9'), padding: '6px 12px', fontSize: 12 }}>＋ 새 스폰서</button>
        </div>
      </header>

      {error && <div style={errBox}>{error}</div>}

      {editing && (
        <div style={card}>
          <h2 style={h2}>{editing === 'new' ? '새 스폰서' : `편집: ${form.name}`}</h2>
          <div style={grid2}>
            <Field label="이름 *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="태그라인" value={form.tagline} onChange={(v) => setForm({ ...form, tagline: v })} />
            <Field label="종류" type="select" options={KINDS} value={form.kind} onChange={(v) => setForm({ ...form, kind: v })} />
            <Field label="로고 URL" value={form.logo_url} onChange={(v) => setForm({ ...form, logo_url: v })} />
            <Field label="배너 이미지 URL" value={form.banner_image_url} onChange={(v) => setForm({ ...form, banner_image_url: v })} />
            <Field label="배너 위치" value={form.banner_position} onChange={(v) => setForm({ ...form, banner_position: v })} placeholder="center / left / right" />
            <Field label="배너 줌(%)" type="number" value={form.banner_zoom} onChange={(v) => setForm({ ...form, banner_zoom: Number(v) || 100 })} />
            <Field label="CTA 텍스트" value={form.cta_text} onChange={(v) => setForm({ ...form, cta_text: v })} />
            <Field label="CTA URL" value={form.cta_url} onChange={(v) => setForm({ ...form, cta_url: v })} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={save} style={btn('#16a34a')} disabled={!form.name}>저장</button>
            <button onClick={cancel} style={btn('#64748b')}>취소</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {items.length === 0 && <p style={muted}>등록된 스폰서가 없습니다.</p>}
        {items.map((sp) => (
          <div key={sp.id} style={row}>
            <div style={{ flex: '0 0 96px' }}>
              {sp.banner_image_url
                ? <img src={sp.banner_image_url} alt={sp.name} style={{ width: 96, height: 54, objectFit: 'cover', borderRadius: 4, background: '#0f172a' }} />
                : <div style={{ width: 96, height: 54, background: '#e2e8f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#94a3b8' }}>No banner</div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700 }}>{sp.name}</span>
                <span style={badge(sp.kind === 'AD' ? '#f59e0b' : '#7c3aed')}>{sp.kind}</span>
              </div>
              {sp.tagline && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{sp.tagline}</div>}
              {sp.cta_text && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>CTA: {sp.cta_text} → {sp.cta_url || '(no url)'}</div>}
              <code style={{ fontSize: 10, color: '#cbd5e1' }}>{sp.id}</code>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ ...btn('#0ea5e9'), padding: '4px 8px', fontSize: 11, cursor: 'pointer', textAlign: 'center' }}>
                {uploading ? '...' : '🖼️ 배너'}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={(e) => uploadBanner(sp.id, e.target.files?.[0])} />
              </label>
              <button onClick={() => startEdit(sp)} style={{ ...btn('#475569'), padding: '4px 8px', fontSize: 11 }}>편집</button>
              <button onClick={() => remove(sp.id)} style={{ ...btn('#dc2626'), padding: '4px 8px', fontSize: 11 }}>삭제</button>
            </div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

function Field({ label, value, onChange, type = 'text', options, placeholder }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#475569' }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      {type === 'select'
        ? <select value={value} onChange={(e) => onChange(e.target.value)} style={input}>
            {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        : <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder} style={input} />}
    </label>
  );
}

function Wrap({ children }) {
  return <div style={{ background: '#f8fafc', minHeight: '100vh', padding: 20, fontFamily: 'system-ui, sans-serif', maxWidth: 1000, margin: '0 auto' }}>{children}</div>;
}

const h1 = { fontSize: 22, fontWeight: 800 };
const h2 = { fontSize: 14, fontWeight: 800, marginBottom: 8, color: '#0f172a' };
const muted = { color: '#94a3b8', fontSize: 13 };
const btn = (color) => ({ background: color, color: 'white', border: 'none', borderRadius: 6, padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 13 });
const errBox = { background: '#fef2f2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 12, marginBottom: 12 };
const card = { background: 'white', borderRadius: 10, padding: 16, border: '1px solid #e2e8f0', marginBottom: 16 };
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 };
const input = { padding: 6, border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, fontFamily: 'inherit' };
const row = { display: 'flex', gap: 12, background: 'white', borderRadius: 10, padding: 12, border: '1px solid #e2e8f0', alignItems: 'center' };
const badge = (color) => ({ background: color, color: 'white', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 });
