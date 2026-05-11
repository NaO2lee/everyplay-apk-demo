/**
 * 심판 BYOD 홈 — v3.3 Phase 2 4단계 wizard.
 *  Step 1: 히트 선택 (지금은 UUID 입력, Phase 3에서 드롭다운)
 *  Step 2: 선수 번호/UUID
 *  Step 3: 매칭 확인
 *  Step 4: 점수 입력 → 제출
 */
import { useEffect, useState } from 'react';
import { enqueue as queueEnqueue, drain as queueDrain, count as queueCount } from '../lib/offlineQueue';

const EVENT_CODES = [
  { code: 'SRSS', name: 'Single Rope Speed 30s', kind: 'speed' },
  { code: 'SRSE', name: 'Single Rope Speed Endurance 3m', kind: 'speed' },
  { code: 'SRTU', name: 'Single Rope Triple Unders', kind: 'triple_under' },
  { code: 'SRIF', name: 'Single Rope Individual Freestyle', kind: 'freestyle' },
  { code: 'DDSS', name: 'Double Dutch Speed 60s', kind: 'speed' },
  { code: 'DDPF', name: 'Double Dutch Pair Freestyle', kind: 'freestyle' },
];

const initialPayload = {
  speed: { kind: 'speed', count: 0, miss_count: 0 },
  freestyle: { kind: 'freestyle', technical: 5, presentation: 5, difficulty: 5, deductions: 0 },
  triple_under: { kind: 'triple_under', count: 0, foot: 'both' },
  show: { kind: 'show', artistic: 5, technical: 5, impression: 5 },
};

export default function JudgeHome() {
  const SEED_EVENT_ID = 'f1c1ccee-071b-40b7-834b-00ff669620cc';
  const [me, setMe] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('judge_token') || '');
  const [step, setStep] = useState(1);
  const [heatList, setHeatList] = useState([]);  // 활성 이벤트 히트 목록
  const [participantList, setParticipantList] = useState([]);  // 선택된 히트의 참가자
  const [heatId, setHeatId] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [eventCode, setEventCode] = useState('SRSS');
  const [payload, setPayload] = useState(initialPayload.speed);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [recent, setRecent] = useState([]);
  const [queueLen, setQueueLen] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    if (!token) return;
    const auth = { Authorization: `Bearer ${token}` };
    fetch('/api/v1/judge/me', { headers: auth })
      .then((r) => r.json())
      .then((j) => { if (j.success) setMe(j.data); else setError(j.detail || '인증 실패'); })
      .catch((e) => setError(String(e)));
    // 활성 이벤트 히트 목록 — admin 권한 필요할 수 있어 try-catch
    fetch(`/api/v1/events/${SEED_EVENT_ID}/heats`, { headers: auth })
      .then((r) => r.json())
      .then((j) => { if (j.success) setHeatList(j.data?.items || []); })
      .catch(() => {});
  }, [token]);

  // 선택된 히트의 참가자 자동 추출 (heatList의 detail에서)
  useEffect(() => {
    if (!heatId) { setParticipantList([]); return; }
    const h = heatList.find((x) => x.id === heatId);
    setParticipantList(h?.participants || []);
  }, [heatId, heatList]);

  useEffect(() => {
    const meta = EVENT_CODES.find((e) => e.code === eventCode);
    if (meta) setPayload(initialPayload[meta.kind]);
  }, [eventCode]);

  useEffect(() => {
    if (token && heatId) loadRecent();
  }, [token, heatId, result]);

  const loadRecent = async () => {
    try {
      const r = await fetch(`/api/v1/judge/scores/heat/${heatId}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (j.success) setRecent(j.data || []);
    } catch (e) { /* ignore */ }
  };

  const grantDevToken = async () => {
    const r = await fetch('/api/v1/auth/dev-grant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'judge', user_id: 'dev-judge-1' }),
    });
    const j = await r.json();
    if (j.success) { localStorage.setItem('judge_token', j.data.token); setToken(j.data.token); }
  };

  const submit = async () => {
    setSubmitting(true); setError(null); setResult(null);
    const body = { heat_id: heatId, participant_id: participantId, event_code: eventCode, payload };
    try {
      const r = await fetch('/api/v1/judge/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.success) { setResult({ ...j.data, _via: 'online' }); setStep(1); }
      else setError(j.detail || '제출 실패');
    } catch (e) {
      // 네트워크 오류 — 오프라인 큐에 저장
      try {
        await queueEnqueue(body);
        setQueueLen(await queueCount());
        setResult({ _via: 'queued', _msg: '오프라인 큐 저장됨 — 연결 복구 시 자동 전송' });
        setStep(1);
      } catch (qe) {
        setError('전송 실패 + 큐 저장도 실패: ' + String(qe));
      }
    }
    setSubmitting(false);
  };

  // 큐 상태 + 자동 drain
  useEffect(() => {
    if (!token) return;
    queueCount().then(setQueueLen).catch(() => {});
    const tryDrain = async () => {
      if (!navigator.onLine) return;
      try {
        const { sent } = await queueDrain(token);
        if (sent > 0) setQueueLen(await queueCount());
      } catch {}
    };
    tryDrain();
    const id = setInterval(tryDrain, 10000);
    const onOnline = () => { setOnline(true); tryDrain(); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [token]);

  if (!token) {
    return (
      <Wrap>
        <h1 style={h1}>⚖️ 심판 — BYOD</h1>
        <p style={muted}>토큰 없음. [DEV] 임시 발급:</p>
        <button onClick={grantDevToken} style={btn('#7c3aed')}>임시 심판 토큰 발급</button>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={h1}>⚖️ 심판 채점</h1>
        <small style={muted}>
          {me?.user_id} · {me?.role}
          <span style={{ marginLeft: 8, color: online ? '#16a34a' : '#dc2626' }}>{online ? '🟢 온라인' : '🔴 오프라인'}</span>
          {queueLen > 0 && <span style={{ marginLeft: 8, color: '#ca8a04' }}>📦 큐 {queueLen}</span>}
        </small>
      </header>

      <Stepper step={step} />

      {step === 1 && (
        <Card title="Step 1 — 히트 선택">
          {heatList.length > 0 ? (
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>활성 이벤트 히트</span>
              <select value={heatId} onChange={(e) => setHeatId(e.target.value)} style={{ width: '100%', padding: 12, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}>
                <option value="">— 히트 선택 —</option>
                {heatList.map((h) => (
                  <option key={h.id} value={h.id}>
                    Heat #{h.heat_number} (Court {h.station_number || '?'}) · 선수 {h.participants?.length || 0}명
                    {h.started_at && !h.ended_at ? ' 🔴 LIVE' : h.ended_at ? ' ✓종료' : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <Field label="히트 ID (UUID 직접 입력)" value={heatId} onChange={setHeatId} mono />
          )}
          <button onClick={() => setStep(2)} style={btn('#2563eb')} disabled={!heatId}>다음 →</button>
        </Card>
      )}

      {step === 2 && (
        <Card title="Step 2 — 선수 선택">
          {participantList.length > 0 ? (
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>이 히트 참가자 ({participantList.length}명)</span>
              <select value={participantId} onChange={(e) => setParticipantId(e.target.value)} style={{ width: '100%', padding: 12, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}>
                <option value="">— 선수 선택 —</option>
                {participantList.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} {p.team ? `(${p.team})` : ''}</option>
                ))}
              </select>
            </label>
          ) : (
            <Field label="선수 UUID (직접 입력)" value={participantId} onChange={setParticipantId} mono />
          )}
          <Row>
            <button onClick={() => setStep(1)} style={btn('#94a3b8')}>← 이전</button>
            <button onClick={() => setStep(3)} style={btn('#2563eb')} disabled={!participantId}>다음 →</button>
          </Row>
        </Card>
      )}

      {step === 3 && (
        <Card title="Step 3 — 매칭 확인">
          <p>아래 정보가 맞으면 다음 단계로:</p>
          <pre style={pre}>{JSON.stringify({ heat_id: heatId, participant_id: participantId }, null, 2)}</pre>
          <Row>
            <button onClick={() => setStep(2)} style={btn('#94a3b8')}>← 이전</button>
            <button onClick={() => setStep(4)} style={btn('#16a34a')}>맞아요, 점수 입력 →</button>
          </Row>
          <NoShowButton heatId={heatId} participantId={participantId} token={token} />
        </Card>
      )}

      {step === 4 && (
        <Card title="Step 4 — 점수 입력 & 제출">
          <Field label="종목 코드" select value={eventCode} onChange={setEventCode} options={EVENT_CODES.map((e) => ({ value: e.code, label: `${e.code} — ${e.name}` }))} />
          <PayloadForm payload={payload} setPayload={setPayload} />
          {error && <div style={errBox}>{error}</div>}
          <Row>
            <button onClick={() => setStep(3)} style={btn('#94a3b8')}>← 이전</button>
            <button onClick={submit} style={btn('#dc2626')} disabled={submitting}>
              {submitting ? '제출 중...' : '제출'}
            </button>
          </Row>
        </Card>
      )}

      {result && result._via === 'online' && (
        <div style={{ ...okBox, marginTop: 16 }}>
          ✓ 제출 완료 — score id <code>{result.id.slice(0, 8)}</code>, payload <code>{JSON.stringify(result.payload)}</code>
        </div>
      )}
      {result && result._via === 'queued' && (
        <div style={{ background: '#fef3c7', color: '#78350f', padding: 10, borderRadius: 6, fontSize: 13, marginTop: 16, borderLeft: '4px solid #ca8a04' }}>
          📦 {result._msg}
        </div>
      )}

      {recent.length > 0 && (
        <Card title={`이 히트에서 내 채점 ${recent.length}건`}>
          {recent.map((s) => (
            <div key={s.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
              <code>{s.id.slice(0, 8)}</code> · {s.event_code} · {JSON.stringify(s.payload)} · {new Date(s.submitted_at).toLocaleTimeString()}
            </div>
          ))}
        </Card>
      )}

      <button
        onClick={() => { localStorage.removeItem('judge_token'); setToken(''); setMe(null); }}
        style={{ marginTop: 24, padding: '8px 14px', background: '#e5e7eb', border: 0, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
      >
        로그아웃
      </button>
    </Wrap>
  );
}

// ─── Sub-components ─────────────────────

function NoShowButton({ heatId, participantId, token }) {
  const [calling, setCalling] = useState(false);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState('');
  const call = async () => {
    setCalling(true);
    try {
      const r = await fetch('/api/v1/judge/no-show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ heat_id: heatId, participant_id: participantId, note: note || '입장 안 함' }),
      });
      const j = await r.json();
      if (j.success) setDone(true);
    } catch {}
    setCalling(false);
  };
  if (done) return <div style={{ ...okBox, marginTop: 12 }}>📢 운영석에 호명 요청 전달됨. AI 음성으로 호명될 예정 (Phase 3).</div>;
  return (
    <div style={{ marginTop: 16, padding: 12, background: '#fef3c7', borderRadius: 8, borderLeft: '4px solid #ca8a04' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#78350f', marginBottom: 6 }}>⚠️ 선수가 코트에 안 왔나요?</div>
      <input
        placeholder="사유 (선택, 예: '3분 지났는데 안 옴')"
        value={note} onChange={(e) => setNote(e.target.value)}
        style={{ width: '100%', padding: 8, border: '1px solid #fcd34d', borderRadius: 6, fontSize: 12, marginBottom: 8 }}
      />
      <button onClick={call} disabled={calling} style={{ ...btn('#ca8a04'), fontSize: 13, padding: '8px 14px' }}>
        {calling ? '전송 중...' : '📢 안왔음 호출'}
      </button>
    </div>
  );
}

function Stepper({ step }) {
  const labels = ['히트 선택', '선수 번호', '매칭 확인', '점수 입력'];
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
      {labels.map((l, i) => (
        <div key={i} style={{ flex: 1, padding: '8px 4px', background: step >= i + 1 ? '#7c3aed' : '#e5e7eb', color: step >= i + 1 ? 'white' : '#94a3b8', borderRadius: 6, fontSize: 11, textAlign: 'center', fontWeight: 700 }}>
          {i + 1}. {l}
        </div>
      ))}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, marginBottom: 12, fontWeight: 700 }}>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, mono, select, options }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</span>
      {select ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 6 }}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 6, fontFamily: mono ? 'monospace' : 'inherit', fontSize: mono ? 12 : 14 }} />
      )}
    </label>
  );
}

function PayloadForm({ payload, setPayload }) {
  const update = (k, v) => setPayload({ ...payload, [k]: v });
  if (payload.kind === 'speed') {
    const safeCount = Math.max(0, payload.count || 0);
    const safeMiss = Math.max(0, payload.miss_count || 0);
    return (
      <>
        <div style={{ marginBottom: 16 }}>
          <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>총 카운트</span>
          <div style={{
            background: '#0f172a', color: '#fbbf24', borderRadius: 12, padding: '24px 16px',
            textAlign: 'center', fontSize: 64, fontWeight: 900, fontFamily: 'monospace', lineHeight: 1, marginBottom: 12,
          }}>{safeCount}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
            <PadBtn label="+1"  onClick={() => update('count', safeCount + 1)} bg="#16a34a" />
            <PadBtn label="+5"  onClick={() => update('count', safeCount + 5)} bg="#0891b2" />
            <PadBtn label="+10" onClick={() => update('count', safeCount + 10)} bg="#2563eb" />
            <PadBtn label="-1"  onClick={() => update('count', Math.max(0, safeCount - 1))} bg="#94a3b8" />
            <PadBtn label="-5"  onClick={() => update('count', Math.max(0, safeCount - 5))} bg="#64748b" />
            <PadBtn label="0으로" onClick={() => update('count', 0)} bg="#dc2626" />
          </div>
          <input
            type="number" value={safeCount} min="0"
            onChange={(e) => update('count', parseInt(e.target.value, 10) || 0)}
            style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, fontFamily: 'monospace', textAlign: 'center' }}
            placeholder="직접 입력"
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>실수 횟수 (선택): {safeMiss}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <PadBtn label="+1 실수" onClick={() => update('miss_count', safeMiss + 1)} bg="#fbbf24" small />
            <PadBtn label="-1" onClick={() => update('miss_count', Math.max(0, safeMiss - 1))} bg="#94a3b8" small />
            <PadBtn label="0" onClick={() => update('miss_count', 0)} bg="#94a3b8" small />
          </div>
        </div>
      </>
    );
  }
  if (payload.kind === 'freestyle') {
    return (
      <>
        <NumField label="기술 점수 (0~10)" value={payload.technical} onChange={(v) => update('technical', v)} step="0.1" />
        <NumField label="표현 점수 (0~10)" value={payload.presentation} onChange={(v) => update('presentation', v)} step="0.1" />
        <NumField label="난이도 (0~10)" value={payload.difficulty} onChange={(v) => update('difficulty', v)} step="0.1" />
        <NumField label="페널티 (0~10)" value={payload.deductions} onChange={(v) => update('deductions', v)} step="0.1" />
      </>
    );
  }
  if (payload.kind === 'triple_under') {
    return (
      <>
        <NumField label="성공 횟수" value={payload.count} onChange={(v) => update('count', v)} />
        <Field label="외발/양발" select value={payload.foot} onChange={(v) => update('foot', v)} options={[
          { value: 'both', label: '양발' }, { value: 'left', label: '왼발' }, { value: 'right', label: '오른발' },
        ]} />
      </>
    );
  }
  return null;
}

function PadBtn({ label, onClick, bg, small }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? '10px 12px' : '20px 8px', background: bg, color: 'white', border: 0,
      borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: small ? 13 : 18,
      boxShadow: '0 2px 0 rgba(0,0,0,0.1)', userSelect: 'none', flex: small ? 1 : 'unset',
    }}>{label}</button>
  );
}

function NumField({ label, value, onChange, step }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</span>
      <input
        type="number" value={value} step={step || '1'}
        onChange={(e) => onChange(step ? parseFloat(e.target.value) : parseInt(e.target.value, 10))}
        style={{ width: '100%', padding: 14, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 18, fontWeight: 700 }}
      />
    </label>
  );
}

// ─── Styles ─────────────────────────────

function Wrap({ children }) {
  return <div style={{ maxWidth: 560, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>{children}</div>;
}
const h1 = { fontSize: 22, fontWeight: 800, margin: 0 };
const muted = { color: '#94a3b8', fontSize: 12, margin: '4px 0 16px' };
const pre = { background: '#f1f5f9', padding: 12, borderRadius: 6, fontSize: 12, overflow: 'auto' };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13, marginTop: 8 };
const okBox = { background: '#dcfce7', color: '#166534', padding: 10, borderRadius: 6, fontSize: 13 };
const btn = (color) => ({ padding: '10px 16px', background: color, color: 'white', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 });
const Row = ({ children }) => <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>{children}</div>;
