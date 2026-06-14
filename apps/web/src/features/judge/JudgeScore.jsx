/**
 * 심판 채점 (앱 디자인) — /judge-app?event=<id>
 * 5월 JudgeGrid 로직 그대로(heats·scores fetch, 오프라인 큐, speed/freestyle payload, POST/PATCH).
 * 디자인만 WEPLAY 모바일 앱 시안 기준. 기존 /judge-grid(5월)는 그대로 둠.
 * TODO(backend): 엔드포인트는 기존과 동일(/api/v1/judge/scores, /events/{id}/heats).
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Flag from '../../components/Flag';
import { enqueue as queueEnqueue, count as queueCount, drain as queueDrain } from '../../lib/offlineQueue';
import styles from './JudgeScore.module.css';

const SEED_EVENT = 'f1c1ccee-071b-40b7-834b-00ff669620cc';
const EVENT_CODES = [
  { code: 'SRSS', name: '30s Speed', kind: 'speed' },
  { code: 'SRSE', name: '3min Endurance', kind: 'speed' },
  { code: 'SRTU', name: 'Triple Unders', kind: 'triple_under' },
  { code: 'SRIF', name: 'Individual Freestyle', kind: 'freestyle' },
  { code: 'DDSS', name: 'DD Speed 60s', kind: 'speed' },
  { code: 'DDPF', name: 'DD Pair Freestyle', kind: 'freestyle' },
];

export default function JudgeScore() {
  const [params] = useSearchParams();
  const eventId = params.get('event') || SEED_EVENT;
  const [token, setToken] = useState(localStorage.getItem('judge_token') || '');
  const [heats, setHeats] = useState([]);
  const [selectedHeatId, setSelectedHeatId] = useState('');
  const [eventCode, setEventCode] = useState('SRSS');
  const [myScores, setMyScores] = useState({});
  const [openParticipant, setOpenParticipant] = useState(null);
  const [error, setError] = useState(null);
  const [queueLen, setQueueLen] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);

  const grantDevToken = async () => {
    const r = await fetch('/api/v1/auth/dev-grant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'judge', user_id: 'dev-judge-app' }),
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
    } catch { /* ignore */ }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadHeats(); }, [token, eventId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMyScores(); }, [token, selectedHeatId]);

  useEffect(() => {
    if (!token) return undefined;
    queueCount().then(setQueueLen).catch(() => {});
    const tryDrain = async () => {
      if (!navigator.onLine) return;
      try { const { sent } = await queueDrain(token); if (sent > 0) { setQueueLen(await queueCount()); loadMyScores(); } } catch { /* */ }
    };
    tryDrain();
    const id = setInterval(tryDrain, 10000);
    const onOnline = () => { setOnline(true); tryDrain(); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { clearInterval(id); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) {
    return (
      <div className={styles.screen}>
        <div className={styles.devWrap}>
          <div className={styles.hdTitle} style={{ justifyContent: 'center' }}>⚖️ 심판 채점</div>
          <p style={{ color: 'var(--ink3)', fontSize: 13, marginTop: 10 }}>[개발] 심판 토큰이 없어요.</p>
          <button className={styles.devBtn} onClick={grantDevToken}>임시 심판 토큰 발급</button>
        </div>
      </div>
    );
  }

  const heat = heats.find((h) => h.id === selectedHeatId);
  const participants = heat?.participants || [];
  const scoredCount = participants.filter((p) => myScores[p.id]).length;
  const remaining = participants.length - scoredCount;
  const pct = Math.round((scoredCount / Math.max(1, participants.length)) * 100);

  return (
    <div className={styles.screen}>
      <div className={styles.hd}>
        <div className={styles.hdTop}>
          <span className={styles.hdTitle}>⚖️ 심판 채점</span>
          <span className={styles.netDot} style={{ color: online ? 'var(--mint)' : 'var(--live)' }}>{online ? '🟢 온라인' : '🔴 오프라인'}</span>
          {queueLen > 0 && <span className={styles.queue}>📦 {queueLen} 대기</span>}
        </div>
        <select className={styles.sel} value={selectedHeatId} onChange={(e) => setSelectedHeatId(e.target.value)}>
          <option value="">— 히트 선택 —</option>
          {heats.map((h) => (
            <option key={h.id} value={h.id}>
              HIT {h.heat_number} (코트 {h.station_number || '?'}) · {h.participants?.length || 0}명{h.started_at && !h.ended_at ? ' 🔴LIVE' : h.ended_at ? ' ✓' : ''}
            </option>
          ))}
        </select>
        <select className={styles.sel} value={eventCode} onChange={(e) => setEventCode(e.target.value)}>
          {EVENT_CODES.map((e) => <option key={e.code} value={e.code}>{e.code} — {e.name}</option>)}
        </select>
        {heat && (
          <div>
            <div className={styles.prog}>
              <span><b>{participants.length}</b>명 · 채점 <b className={styles.ok}>{scoredCount}</b> · 남은 <b className={styles.rem}>{remaining}</b></span>
              <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{pct}%</span>
            </div>
            <div className={styles.progBar}><div className={styles.progFill} style={{ width: `${pct}%` }} /></div>
          </div>
        )}
      </div>

      <div className={styles.scr}>
        {error && <div className={styles.errBox}>⚠️ {error}</div>}
        <div className={styles.grid}>
          {participants.map((p, idx) => {
            const sc = myScores[p.id];
            const done = !!sc;
            return (
              <button key={p.id} className={`${styles.card} ${done ? styles.cardDone : ''}`} onClick={() => setOpenParticipant(p)}>
                <div className={styles.cardTop}>
                  <Flag code={p.country_code} size={14} />
                  <span className={styles.cardIdx}>#{idx + 1}</span>
                </div>
                <div className={styles.cardName}>{p.name}</div>
                {p.team && <div className={styles.cardTeam}>{p.team}</div>}
                <div className={`${styles.cardScore} ${done ? styles.cardScoreOk : styles.cardScoreNo}`}>
                  {done
                    ? `✓ ${sc.payload.kind === 'speed' ? sc.payload.count : sc.payload.kind === 'freestyle' ? `T${sc.payload.technical}P${sc.payload.presentation}` : '완료'}`
                    : '탭하여 채점'}
                </div>
              </button>
            );
          })}
        </div>
        {participants.length === 0 && selectedHeatId && <p className={styles.empty}>이 히트에 참가자가 없어요.</p>}
        {!selectedHeatId && <p className={styles.empty}>채점할 히트를 선택하세요.</p>}
      </div>

      {openParticipant && (
        <ScoreModal
          participant={openParticipant} heatId={selectedHeatId} eventCode={eventCode}
          existingScore={myScores[openParticipant.id]} token={token}
          onClose={() => setOpenParticipant(null)}
          onSaved={async () => { await loadMyScores(); setOpenParticipant(null); setQueueLen(await queueCount()); }}
        />
      )}
    </div>
  );
}

function ScoreModal({ participant, heatId, eventCode, existingScore, token, onClose, onSaved }) {
  const isEdit = !!existingScore;
  const meta = EVENT_CODES.find((e) => e.code === eventCode);
  const kind = meta?.kind || 'speed';
  const initial = existingScore?.payload || (
    kind === 'speed' ? { kind, count: 0, miss_count: 0 }
      : kind === 'freestyle' ? { kind, technical: 5, presentation: 5, difficulty: 5, deductions: 0 }
        : kind === 'triple_under' ? { kind, count: 0, foot: 'both' }
          : { kind: 'show', artistic: 5, technical: 5, impression: 5 });
  const [payload, setPayload] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const update = (k, v) => setPayload({ ...payload, [k]: v });
  const isSpeed = kind === 'speed' || kind === 'triple_under';

  const submit = async () => {
    setSubmitting(true); setError(null);
    const body = { heat_id: heatId, participant_id: participant.id, event_code: eventCode, payload };
    try {
      const url = isEdit ? `/api/v1/judge/scores/${existingScore.id}` : '/api/v1/judge/scores';
      const method = isEdit ? 'PATCH' : 'POST';
      const fetchBody = isEdit ? { payload, reason: '앱 채점 수정' } : body;
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(fetchBody) });
      const j = await r.json();
      if (j.success) await onSaved(); else setError(j.detail || '실패');
    } catch {
      try { await queueEnqueue(body); await onSaved(); } catch (qe) { setError('전송+큐 모두 실패: ' + String(qe)); }
    }
    setSubmitting(false);
  };

  const c = Math.max(0, payload.count || 0);
  const PADS = [['+1', '#16a34a', c + 1], ['+5', '#0891b2', c + 5], ['+10', '#2563eb', c + 10], ['-1', '#64748b', Math.max(0, c - 1)], ['-5', '#475569', Math.max(0, c - 5)], ['0', '#dc2626', 0]];

  return (
    <div className={styles.dim} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHd}>
          <div>
            <div className={styles.sheetK}>{eventCode} · {isEdit ? '수정' : '입력'}</div>
            <div className={styles.sheetNm}><Flag code={participant.country_code} size={18} /> {participant.name}</div>
            {participant.team && <div className={styles.sheetTeam}>{participant.team}</div>}
          </div>
          <button className={styles.x} onClick={onClose}>×</button>
        </div>

        {isSpeed ? (
          <>
            <div className={styles.bignum}>{c}</div>
            <div className={styles.pad}>
              {PADS.map(([label, color, val]) => (
                <button key={label} className={styles.padBtn} style={{ background: color }} onClick={() => update('count', val)}>{label}</button>
              ))}
            </div>
            <input className={styles.numIn} type="number" min="0" value={c} onChange={(e) => update('count', parseInt(e.target.value, 10) || 0)} />
          </>
        ) : (
          <div className={styles.fsRow}>
            {Object.entries(payload).filter(([k]) => k !== 'kind').map(([k, v]) => (
              <label key={k}>
                <span className={styles.fsLab}>{k} (0~10)</span>
                <input className={styles.fsIn} type="number" step="0.1" min="0" max="10" value={v} onChange={(e) => update(k, parseFloat(e.target.value) || 0)} />
              </label>
            ))}
          </div>
        )}

        {error && <div className={styles.errBox} style={{ marginTop: 12 }}>{error}</div>}
        <button className={`${styles.submit} ${isEdit ? styles.submitEdit : ''}`} onClick={submit} disabled={submitting}>
          {submitting ? '...' : (isEdit ? '✓ 수정 저장' : '✓ 제출')}
        </button>
      </div>
    </div>
  );
}
