/**
 * 심판 그리드 모드 — v3.3 R8 (50명 heat UX 해결).
 * /judge-grid?event=<event_id>
 *
 * 4단계 wizard 200 클릭 → 한 화면 카드 그리드.
 * 카드 상태: 미채점(흰색) / 채점완료(녹색 ✓) / 안왔음(노랑)
 * 탭 → 풀스크린 큰 숫자패드 모달.
 *
 * 같은 backend (/api/v1/judge/scores POST) + 오프라인 큐.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Flag from '../components/Flag';
import { enqueue as queueEnqueue, count as queueCount, drain as queueDrain } from '../lib/offlineQueue';

const SEED_EVENT = 'f1c1ccee-071b-40b7-834b-00ff669620cc';
const EVENT_CODES = [
  { code: 'SRSS', name: '30s Speed', kind: 'speed' },
  { code: 'SRSE', name: '3min Endurance', kind: 'speed' },
  { code: 'SRTU', name: 'Triple Unders', kind: 'triple_under' },
  { code: 'SRIF', name: 'Individual Freestyle', kind: 'freestyle' },
  { code: 'DDSS', name: 'DD Speed 60s', kind: 'speed' },
  { code: 'DDPF', name: 'DD Pair Freestyle', kind: 'freestyle' },
];

export default function JudgeGrid() {
  const [params, setParams] = useSearchParams();
  const eventId = params.get('event') || SEED_EVENT;
  const [token, setToken] = useState(localStorage.getItem('judge_token') || '');
  const [heats, setHeats] = useState([]);
  const [selectedHeatId, setSelectedHeatId] = useState('');
  const [eventCode, setEventCode] = useState('SRSS');
  const [myScores, setMyScores] = useState({});  // participant_id → score record
  const [openParticipant, setOpenParticipant] = useState(null);
  const [error, setError] = useState(null);
  const [queueLen, setQueueLen] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);

  const grantDevToken = async () => {
    const r = await fetch('/api/v1/auth/dev-grant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'judge', user_id: 'dev-judge-grid' }),
    });
    const j = await r.json();
    if (j.success) { localStorage.setItem('judge_token', j.data.token); setToken(j.data.token); }
  };

  const loadHeats = async () => {
    if (!token) return;
    try {
      const r = await fetch(`/api/v1/events/${eventId}/heats`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (j.success) {
        const items = j.data?.items || [];
        setHeats(items);
        if (!selectedHeatId && items.length > 0) setSelectedHeatId(items[0].id);
      }
    } catch (e) { setError(String(e)); }
  };

  const loadMyScores = async () => {
    if (!token || !selectedHeatId) return;
    try {
      const r = await fetch(`/api/v1/judge/scores/heat/${selectedHeatId}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (j.success) {
        const map = {};
        for (const s of j.data || []) map[s.participant_id] = s;
        setMyScores(map);
      }
    } catch {}
  };

  useEffect(() => { loadHeats(); }, [token, eventId]);
  useEffect(() => { loadMyScores(); }, [token, selectedHeatId]);

  // 큐 자동 drain
  useEffect(() => {
    if (!token) return;
    queueCount().then(setQueueLen).catch(() => {});
    const tryDrain = async () => {
      if (!navigator.onLine) return;
      try {
        const { sent } = await queueDrain(token);
        if (sent > 0) { setQueueLen(await queueCount()); loadMyScores(); }
      } catch {}
    };
    tryDrain();
    const id = setInterval(tryDrain, 10000);
    const onOnline = () => { setOnline(true); tryDrain(); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { clearInterval(id); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [token]);

  if (!token) {
    return (
      <Wrap>
        <h1 style={h1}>⚖️ 심판 그리드</h1>
        <p style={muted}>[DEV] 토큰 없음:</p>
        <button onClick={grantDevToken} style={btn('#7c3aed')}>임시 심판 토큰</button>
        <p style={{ ...muted, marginTop: 16 }}>또는 wizard 모드: <a href="/judge" style={{ color: '#7c3aed' }}>/judge</a></p>
      </Wrap>
    );
  }

  const heat = heats.find((h) => h.id === selectedHeatId);
  const participants = heat?.participants || [];
  const scoredCount = participants.filter((p) => myScores[p.id]).length;
  const remaining = participants.length - scoredCount;

  return (
    <Wrap>
      <header style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h1 style={h1}>⚖️ 심판 그리드</h1>
          <div style={{ fontSize: 11 }}>
            <span style={{ color: online ? '#16a34a' : '#dc2626' }}>{online ? '🟢 ON' : '🔴 OFF'}</span>
            {queueLen > 0 && <span style={{ marginLeft: 6, color: '#ca8a04' }}>📦 {queueLen}</span>}
          </div>
        </div>

        {/* heat 드롭다운 */}
        <select value={selectedHeatId} onChange={(e) => setSelectedHeatId(e.target.value)}
          style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, marginBottom: 6 }}>
          <option value="">— 히트 선택 —</option>
          {heats.map((h) => (
            <option key={h.id} value={h.id}>
              Heat #{h.heat_number} (Court {h.station_number || '?'}) · {h.participants?.length || 0}명
              {h.started_at && !h.ended_at ? ' 🔴LIVE' : h.ended_at ? ' ✓' : ''}
            </option>
          ))}
        </select>

        {/* 종목 드롭다운 */}
        <select value={eventCode} onChange={(e) => setEventCode(e.target.value)}
          style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}>
          {EVENT_CODES.map((e) => <option key={e.code} value={e.code}>{e.code} — {e.name}</option>)}
        </select>

        {heat && (
          <div style={{ marginTop: 8, padding: 10, background: '#f1f5f9', borderRadius: 8, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <span><strong>{participants.length}명</strong> · 채점 <strong style={{ color: '#16a34a' }}>{scoredCount}</strong> · 남은 <strong style={{ color: '#dc2626' }}>{remaining}</strong></span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{Math.round(scoredCount / Math.max(1, participants.length) * 100)}%</span>
          </div>
        )}
      </header>

      {error && <div style={errBox}>{error}</div>}

      {/* selene 카드 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {participants.map((p, idx) => {
          const sc = myScores[p.id];
          const done = !!sc;
          return (
            <button key={p.id} onClick={() => setOpenParticipant(p)} style={{
              padding: 10, background: done ? '#dcfce7' : 'white',
              border: `2px solid ${done ? '#16a34a' : '#e2e8f0'}`,
              borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              transition: 'all 100ms', position: 'relative',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Flag code={p.country_code} size={14} />
                <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>#{idx + 1}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4, lineHeight: 1.2 }}>{p.name}</div>
              {p.team && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.team}</div>}
              {done && (
                <div style={{ marginTop: 6, padding: '4px 6px', background: 'white', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', textAlign: 'center', color: '#166534', fontWeight: 700 }}>
                  ✓ {sc.payload.kind === 'speed' ? sc.payload.count : sc.payload.kind === 'freestyle' ? `T${sc.payload.technical}P${sc.payload.presentation}` : '✓'}
                </div>
              )}
              {!done && (
                <div style={{ marginTop: 6, padding: '4px 6px', background: '#f1f5f9', borderRadius: 4, fontSize: 11, textAlign: 'center', color: '#94a3b8' }}>탭하여 채점</div>
              )}
            </button>
          );
        })}
      </div>

      {participants.length === 0 && selectedHeatId && (
        <p style={{ ...muted, marginTop: 16, textAlign: 'center' }}>이 히트에 참가자 없음.</p>
      )}

      {/* 모달: 채점 입력 */}
      {openParticipant && (
        <ScoreModal
          participant={openParticipant}
          heatId={selectedHeatId}
          eventCode={eventCode}
          existingScore={myScores[openParticipant.id]}
          token={token}
          onClose={() => setOpenParticipant(null)}
          onSaved={async () => { await loadMyScores(); setOpenParticipant(null); setQueueLen(await queueCount()); }}
        />
      )}

      <div style={{ marginTop: 24, padding: 10, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
        wizard 모드: <a href="/judge" style={{ color: '#7c3aed' }}>/judge</a>
      </div>
    </Wrap>
  );
}

// ─── 채점 모달 ─────────────────────────────────────────────

function ScoreModal({ participant, heatId, eventCode, existingScore, token, onClose, onSaved }) {
  const isEdit = !!existingScore;
  const meta = EVENT_CODES.find((e) => e.code === eventCode);
  const kind = meta?.kind || 'speed';
  const initial = existingScore?.payload || (
    kind === 'speed' ? { kind, count: 0, miss_count: 0 } :
    kind === 'freestyle' ? { kind, technical: 5, presentation: 5, difficulty: 5, deductions: 0 } :
    kind === 'triple_under' ? { kind, count: 0, foot: 'both' } :
    { kind: 'show', artistic: 5, technical: 5, impression: 5 }
  );
  const [payload, setPayload] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setSubmitting(true); setError(null);
    const body = { heat_id: heatId, participant_id: participant.id, event_code: eventCode, payload };
    try {
      const url = isEdit ? `/api/v1/judge/scores/${existingScore.id}` : '/api/v1/judge/scores';
      const method = isEdit ? 'PATCH' : 'POST';
      const fetchBody = isEdit ? { payload, reason: '그리드 모드 수정' } : body;
      const r = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(fetchBody),
      });
      const j = await r.json();
      if (j.success) await onSaved();
      else setError(j.detail || '실패');
    } catch (e) {
      // 오프라인 → 큐
      try {
        await queueEnqueue(body);
        await onSaved();
      } catch (qe) { setError('전송+큐 모두 실패: ' + String(qe)); }
    }
    setSubmitting(false);
  };

  const update = (k, v) => setPayload({ ...payload, [k]: v });

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'white', width: '100%', maxWidth: 480, borderRadius: '16px 16px 0 0',
        padding: 20, maxHeight: '90vh', overflow: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{eventCode} · {isEdit ? '수정' : '입력'}</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '2px 0' }}>
              <Flag code={participant.country_code} size={18} /> {participant.name}
            </h2>
            {participant.team && <div style={{ fontSize: 12, color: '#64748b' }}>{participant.team}</div>}
          </div>
          <button onClick={onClose} style={{ background: '#e5e7eb', border: 0, borderRadius: '50%', width: 36, height: 36, fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>

        {/* payload form */}
        {kind === 'speed' && (
          <SpeedPad payload={payload} update={update} />
        )}
        {kind === 'freestyle' && (
          <FreestyleForm payload={payload} update={update} />
        )}
        {kind === 'triple_under' && (
          <SpeedPad payload={payload} update={update} />
        )}
        {kind === 'show' && (
          <FreestyleForm payload={payload} update={update} />
        )}

        {error && <div style={{ ...errBox, marginTop: 12 }}>{error}</div>}

        <button onClick={submit} disabled={submitting} style={{
          width: '100%', padding: 16, background: isEdit ? '#ca8a04' : '#16a34a',
          color: 'white', border: 0, borderRadius: 10, fontSize: 16, fontWeight: 800,
          marginTop: 16, cursor: 'pointer',
        }}>
          {submitting ? '...' : (isEdit ? '✓ 수정 저장' : '✓ 제출')}
        </button>
      </div>
    </div>
  );
}

function SpeedPad({ payload, update }) {
  const c = Math.max(0, payload.count || 0);
  return (
    <div>
      <div style={{ background: '#0f172a', color: '#fbbf24', borderRadius: 12, padding: 28, textAlign: 'center', fontSize: 80, fontWeight: 900, fontFamily: 'monospace', lineHeight: 1, marginBottom: 12 }}>
        {c}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        <PadBtn label="+1" color="#16a34a" onClick={() => update('count', c + 1)} />
        <PadBtn label="+5" color="#0891b2" onClick={() => update('count', c + 5)} />
        <PadBtn label="+10" color="#2563eb" onClick={() => update('count', c + 10)} />
        <PadBtn label="-1" color="#94a3b8" onClick={() => update('count', Math.max(0, c - 1))} />
        <PadBtn label="-5" color="#64748b" onClick={() => update('count', Math.max(0, c - 5))} />
        <PadBtn label="0" color="#dc2626" onClick={() => update('count', 0)} />
      </div>
      <input type="number" value={c} min="0" onChange={(e) => update('count', parseInt(e.target.value, 10) || 0)}
        style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, marginTop: 8, fontSize: 14, fontFamily: 'monospace', textAlign: 'center' }} />
    </div>
  );
}

function FreestyleForm({ payload, update }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {Object.entries(payload).filter(([k]) => k !== 'kind').map(([k, v]) => (
        <label key={k} style={{ display: 'block' }}>
          <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>{k} (0~10)</span>
          <input type="number" value={v} step="0.1" min="0" max="10"
            onChange={(e) => update(k, parseFloat(e.target.value) || 0)}
            style={{ width: '100%', padding: 12, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 18, fontWeight: 700, textAlign: 'center' }} />
        </label>
      ))}
    </div>
  );
}

function PadBtn({ label, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '18px 8px', background: color, color: 'white', border: 0,
      borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 18,
      boxShadow: '0 2px 0 rgba(0,0,0,0.1)',
    }}>{label}</button>
  );
}

function Wrap({ children }) {
  return <div style={{ maxWidth: 720, margin: '0 auto', padding: 14, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>{children}</div>;
}
const h1 = { fontSize: 20, fontWeight: 800, margin: 0 };
const muted = { color: '#94a3b8', fontSize: 12 };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13 };
const btn = (color) => ({ padding: '10px 16px', background: color, color: 'white', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 });
