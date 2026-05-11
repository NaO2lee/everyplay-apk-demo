/**
 * 운영위원/중계자 대시보드 — v3.3 Phase 2.
 * - 최근 60분 호명 큐 (judge가 누른 "안왔음")
 * - "처리 완료" 버튼 (Phase 3에서 TTS 자동 호명으로 대체)
 * - 5초마다 자동 새로고침
 */
import { useEffect, useState, useCallback } from 'react';
import { speakBoth, isSupported as ttsSupported } from '../lib/tts';
import AuditTail from '../components/AuditTail';

export default function OperatorPanel() {
  const [token, setToken] = useState(localStorage.getItem('operator_token') || '');
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const grantDevToken = async () => {
    const r = await fetch('/api/v1/auth/dev-grant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'operator', user_id: 'dev-op-1' }),
    });
    const j = await r.json();
    if (j.success) { localStorage.setItem('operator_token', j.data.token); setToken(j.data.token); }
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch('/api/v1/operator/no-shows?minutes=60', { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (j.success) setCalls(j.data || []);
      else setError(j.detail || '조회 실패');
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!token) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [token, load]);

  const markHandled = async (auditId) => {
    await fetch(`/api/v1/operator/no-shows/${auditId}/handled`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  };

  const announce = (call) => {
    const heatShort = (call.heat_id || '').slice(0, 6);
    const ko = `호명합니다. 코트와 히트 번호 ${heatShort}, 해당 선수는 즉시 입장해주시기 바랍니다.`;
    const en = `Calling participant. Heat ${heatShort}, please report to the competition floor immediately.`;
    speakBoth(ko, en);
  };

  if (!token) {
    return (
      <Wrap>
        <h1 style={h1}>📺 운영위원 대시보드</h1>
        <p style={muted}>토큰 없음. 임시 발급:</p>
        <button onClick={grantDevToken} style={btn('#2563eb')}>운영위원 토큰 발급 (DEV)</button>
      </Wrap>
    );
  }

  const pending = calls.filter((c) => !c.handled);
  const handled = calls.filter((c) => c.handled);

  return (
    <Wrap>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={h1}>📺 운영위원 대시보드</h1>
        <small style={muted}>5초 자동 갱신 · {loading ? '⏳' : '✓'}</small>
      </header>

      {error && <div style={errBox}>{error}</div>}

      <Card title={`🚨 호명 대기 (${pending.length})`} accent="#dc2626">
        {pending.length === 0 ? (
          <p style={muted}>현재 호명 요청 없음.</p>
        ) : (
          pending.map((c) => (
            <div key={c.audit_id} style={callRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  Heat <code>{(c.heat_id || '').slice(0, 8)}</code> · Participant <code>{(c.target_id || '').slice(0, 8)}</code>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {c.note || '사유 없음'} · {new Date(c.timestamp).toLocaleTimeString()} · 심판 {c.actor_role}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' }}>
                  ※ Phase 3: 이 줄에 "📢 AI 호명 시작" 버튼 자동 활성화 + ElevenLabs 사회자 음성 송출
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
                {ttsSupported() && (
                  <button onClick={() => announce(c)} style={{ ...btn('#7c3aed'), padding: '6px 12px', fontSize: 12 }} title="Web Speech API 한·영 자동 호명">
                    📢 AI 호명
                  </button>
                )}
                <button onClick={() => markHandled(c.audit_id)} style={{ ...btn('#16a34a'), padding: '6px 12px', fontSize: 12 }}>
                  ✓ 완료
                </button>
              </div>
            </div>
          ))
        )}
      </Card>

      {handled.length > 0 && (
        <Card title={`처리 완료 (${handled.length})`} accent="#16a34a" muted>
          {handled.slice(0, 5).map((c) => (
            <div key={c.audit_id} style={{ ...callRow, opacity: 0.5 }}>
              <div style={{ fontSize: 12 }}>
                Heat <code>{(c.heat_id || '').slice(0, 8)}</code> · {c.note} · {new Date(c.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </Card>
      )}

      <AuditTail token={token} actionTypes={['no_show_called', 'no_show_handled', 'rerun_requested', 'rerun_approved']} limit={8} title="📜 운영 활동 기록" />

      <button
        onClick={() => { localStorage.removeItem('operator_token'); setToken(''); setCalls([]); }}
        style={{ marginTop: 24, padding: '8px 14px', background: '#e5e7eb', border: 0, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
      >
        로그아웃
      </button>
    </Wrap>
  );
}

function Wrap({ children }) {
  return <div style={{ maxWidth: 720, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>{children}</div>;
}
function Card({ title, accent, children, muted: m }) {
  return (
    <section style={{ background: 'white', border: '1px solid #e2e8f0', borderLeft: `4px solid ${accent || '#2563eb'}`, borderRadius: 12, padding: 18, marginBottom: 16, opacity: m ? 0.85 : 1 }}>
      <h2 style={{ fontSize: 15, marginBottom: 12, fontWeight: 700, color: accent }}>{title}</h2>
      {children}
    </section>
  );
}

const h1 = { fontSize: 22, fontWeight: 800, margin: 0 };
const muted = { color: '#94a3b8', fontSize: 12 };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 };
const btn = (color) => ({ padding: '10px 16px', background: color, color: 'white', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 });
const callRow = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px dashed #e2e8f0' };
