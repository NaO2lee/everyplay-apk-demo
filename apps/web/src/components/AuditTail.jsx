/**
 * Audit 로그 인라인 위젯 — v3.3 R5.
 * 관리자 페이지 하단에 최근 N건 audit 표시.
 * action_type 필터 + 새 항목 노란 배경 1초 강조.
 *
 * Usage:
 *   <AuditTail token={adminToken} actionTypes={['court_meta_changed']} limit={5} />
 *   <AuditTail token={adminToken} actionTypes={['award_transitioned','no_show_called']} limit={8} title="시상 관련 로그" />
 */
import { useEffect, useRef, useState } from 'react';

export default function AuditTail({ token, actionTypes = [], limit = 5, pollMs = 4000, title = '📜 최근 변경 기록' }) {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const seenIds = useRef(new Set());
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    const load = async () => {
      const promises = actionTypes.length === 0
        ? [fetch(`/api/v1/operator/audit-logs?limit=${limit}`, { headers: { Authorization: `Bearer ${token}` } })]
        : actionTypes.map((at) =>
          fetch(`/api/v1/operator/audit-logs?action_type=${at}&limit=${limit}`, { headers: { Authorization: `Bearer ${token}` } })
        );
      try {
        const results = await Promise.all(promises);
        const datas = await Promise.all(results.map((r) => r.json()));
        if (!alive) return;
        const merged = [];
        for (const d of datas) if (d.success) merged.push(...(d.data || []));
        merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const top = merged.slice(0, limit);
        // 새 항목 감지
        const fresh = top.find((l) => !seenIds.current.has(l.id));
        if (fresh && seenIds.current.size > 0) {
          setHighlightId(fresh.id);
          setTimeout(() => setHighlightId(null), 1500);
        }
        for (const l of top) seenIds.current.add(l.id);
        setLogs(top);
      } catch (e) { if (alive) setError(String(e)); }
    };
    load();
    const id = setInterval(load, pollMs);
    return () => { alive = false; clearInterval(id); };
  }, [token, actionTypes.join('|'), limit, pollMs]);

  if (!token || logs.length === 0) {
    return (
      <section style={panel}>
        <h3 style={hd}>{title}</h3>
        <p style={muted}>로그 없음 — 액션 시 자동 기록됩니다.</p>
      </section>
    );
  }

  return (
    <section style={panel}>
      <h3 style={hd}>{title}</h3>
      <div>
        {logs.map((l) => (
          <div key={l.id} style={{
            ...row,
            background: l.id === highlightId ? '#fef3c7' : 'transparent',
            transition: 'background 800ms',
          }}>
            <span style={{ ...badge, background: actionColor(l.action_type) }}>{l.action_type}</span>
            <span style={tgt}>{l.target_type} {l.target_id && <code style={{ fontSize: 10, color: '#94a3b8' }}>{l.target_id.slice(0, 8)}</code>}</span>
            {l.after_value && (
              <span style={{ fontSize: 11, color: '#475569', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {summarize(l.after_value)}
              </span>
            )}
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(l.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
      {error && <p style={{ fontSize: 11, color: '#dc2626', marginTop: 6 }}>{error}</p>}
      <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 8 }}>
        ※ Immutable, 영구 보존. 전체 보기 → <a href="/admin-audit" style={{ color: '#2563eb' }}>/admin-audit</a>
      </p>
    </section>
  );
}

function summarize(obj) {
  try {
    return Object.entries(obj).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ');
  } catch { return ''; }
}

function actionColor(t) {
  if (t.startsWith('appeal')) return '#7c3aed';
  if (t.startsWith('no_show')) return '#dc2626';
  if (t.startsWith('rerun')) return '#ea580c';
  if (t.startsWith('score')) return '#2563eb';
  if (t.startsWith('award')) return '#ca8a04';
  if (t.startsWith('court')) return '#0891b2';
  return '#64748b';
}

const panel = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginTop: 16 };
const hd = { fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' };
const row = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: '1px dashed #e2e8f0', fontSize: 12 };
const badge = { color: 'white', padding: '1px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' };
const tgt = { color: '#64748b', fontSize: 11 };
const muted = { color: '#94a3b8', fontSize: 12 };
