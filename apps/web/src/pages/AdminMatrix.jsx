/**
 * 관리자 매트릭스 위젯 — v3.3 Phase 2.
 * 심판 × 히트 채점 제출 상태 시각화 (🟢🟡🔴).
 * GET /api/v1/judge/submissions/matrix
 *
 * 자동 5초 새로고침. 행=히트, 열=심판으로 그리드.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';

export default function AdminMatrix() {
  const [token, setToken] = useState(localStorage.getItem('adminToken') || localStorage.getItem('dev_admin_token') || '');
  const [items, setItems] = useState([]);
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

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch('/api/v1/judge/submissions/matrix', { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (j.success) setItems(j.data || []);
      else setError(j.detail || '조회 실패 — 관리자 토큰 필요');
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!token) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [token, load]);

  // 그리드 데이터 변환: heat × judge 매트릭스
  const { heatIds, judgeIds, cellsByHeatJudge } = useMemo(() => {
    const heatSet = new Set(), judgeSet = new Set();
    const cells = {};
    for (const it of items) {
      heatSet.add(it.heat_id);
      judgeSet.add(it.judge_user_id);
      cells[`${it.heat_id}|${it.judge_user_id}`] = it;
    }
    return {
      heatIds: Array.from(heatSet).sort(),
      judgeIds: Array.from(judgeSet).sort(),
      cellsByHeatJudge: cells,
    };
  }, [items]);

  if (!token) {
    return (
      <Wrap>
        <h1 style={h1}>🎛️ 관리자 — 채점 매트릭스</h1>
        <p style={muted}>관리자 토큰이 없습니다. 옵션:</p>
        <p style={{ fontSize: 13 }}>
          1. <a href="/admin">/admin</a>에서 admin/admin 로그인 후 이 페이지로 다시 오기, 또는
        </p>
        <button onClick={grantDevToken} style={btn('#dc2626')}>2. 임시 admin 토큰 발급 (DEV)</button>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={h1}>🎛️ 채점 제출 매트릭스</h1>
        <small style={muted}>5초 자동 갱신 · {loading ? '⏳' : '✓'} · {items.length}개 셀</small>
      </header>

      {error && <div style={errBox}>{error}</div>}

      <div style={{ marginBottom: 16, fontSize: 13, color: '#475569' }}>
        세로축 = 히트 · 가로축 = 심판 · 셀 = <span style={pill('#16a34a')}>🟢 done</span> <span style={pill('#ca8a04')}>🟡 in_progress</span> <span style={pill('#dc2626')}>🔴 pending</span>
      </div>

      {items.length === 0 ? (
        <div style={card}>
          <p style={muted}>제출된 채점 없음. <a href="/judge">/judge</a>에서 채점하면 여기 표시됩니다.</p>
          <p style={{ ...muted, marginTop: 8 }}>
            🌱 시드 데이터: <code>cd apps/api && python seed_v33_demo.py</code>
          </p>
        </div>
      ) : (
        <div style={{ overflow: 'auto', background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={th}>Heat</th>
                {judgeIds.map((j) => (
                  <th key={j} style={th}><code style={{ fontSize: 10 }}>{j.slice(0, 8)}</code></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatIds.map((h) => (
                <tr key={h}>
                  <th style={{ ...th, background: '#f8fafc', textAlign: 'left' }}><code style={{ fontSize: 10 }}>{h.slice(0, 8)}</code></th>
                  {judgeIds.map((j) => {
                    const c = cellsByHeatJudge[`${h}|${j}`];
                    if (!c) return <td key={j} style={{ ...td, background: '#fff' }}>·</td>;
                    return (
                      <td key={j} style={{ ...td, background: bgFor(c.indicator), textAlign: 'center' }}>
                        <div style={{ fontSize: 18 }}>{emojiFor(c.indicator)}</div>
                        <div style={{ fontSize: 10, opacity: 0.7 }}>{c.submitted_count}/{c.expected_count}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 12, color: '#94a3b8' }}>
        ※ Phase 3에서 expected_count는 히트 정원에 맞춰 자동 설정 + 누락 심판에게 알림 자동 발송 예정.
      </div>
    </Wrap>
  );
}

function Wrap({ children }) {
  return <div style={{ maxWidth: 980, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>{children}</div>;
}

const h1 = { fontSize: 22, fontWeight: 800, margin: 0 };
const muted = { color: '#94a3b8', fontSize: 12 };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 };
const card = { background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18 };
const btn = (color) => ({ padding: '10px 16px', background: color, color: 'white', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 });
const th = { padding: '8px 10px', borderBottom: '2px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#64748b' };
const td = { padding: '10px 8px', borderBottom: '1px solid #f1f5f9', minWidth: 70 };
const pill = (c) => ({ background: c, color: 'white', padding: '2px 8px', borderRadius: 6, marginRight: 4, fontSize: 11, fontWeight: 700 });

function bgFor(ind) { return ind === 'green' ? '#dcfce7' : ind === 'yellow' ? '#fef3c7' : '#fee2e2'; }
function emojiFor(ind) { return ind === 'green' ? '🟢' : ind === 'yellow' ? '🟡' : '🔴'; }
