/**
 * 관전 페이지 — v3.3 Phase 2.
 * 관객·중계 공통. URL: /watch?event=<event_id>
 * - 활성 코트의 모든 히트 결과 (5초 폴링)
 * - 라이브 순위 막대 (CSS transition)
 * - 1·2·3위 금/은/동 색상
 *
 * Phase 6에서 SSE 푸시로 폴링 → 즉시 반영, Framer Motion 추가.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import Flag from '../components/Flag';

const SEED_EVENT_ID = 'f1c1ccee-071b-40b7-834b-00ff669620cc';

export default function WatchEvent() {
  const [params, setParams] = useSearchParams();
  const eventId = params.get('event') || SEED_EVENT_ID;
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [stamp, setStamp] = useState(null);
  const [eventInput, setEventInput] = useState(eventId);
  const [eventList, setEventList] = useState([]);

  // 이벤트 목록 (드롭다운용)
  useEffect(() => {
    fetch('/api/v1/public/events').then((r) => r.json()).then((j) => {
      if (j.success) setEventList(j.data?.items || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/v1/results/event/${eventId}/heats`);
        const j = await r.json();
        if (!active) return;
        if (j.success) { setResults(j.data || []); setStamp(new Date()); setError(null); }
        else setError(j.detail || '조회 실패');
      } catch (e) { if (active) setError(String(e)); }
    };
    load();
    // 폴링 폴백 (15초) — SSE 미지원 또는 끊김 대비
    const fallbackId = setInterval(load, 15000);

    // SSE — 점수·시상 이벤트 즉시 갱신
    let es = null;
    try {
      es = new EventSource(`/api/v1/realtime/event/${eventId}/sse`);
      es.addEventListener('score_submitted', () => load());
      es.addEventListener('award_changed', () => load());
      es.onerror = () => { /* 자동 재연결 */ };
    } catch {}

    return () => { active = false; clearInterval(fallbackId); if (es) es.close(); };
  }, [eventId]);

  return (
    <div style={page}>
      <header style={hdr}>
        <h1 style={h1}>👀 모두의 플레이 — 관전</h1>
        <small style={muted}>{stamp ? `갱신 ${stamp.toLocaleTimeString()}` : '로딩...'} · 5초 자동</small>
      </header>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {eventList.length > 0 && (
          <select
            value={eventInput}
            onChange={(e) => { setEventInput(e.target.value); setParams({ event: e.target.value }); }}
            style={{ flex: 1, padding: 8, border: '1px solid #475569', background: '#1e293b', color: 'white', borderRadius: 6, fontSize: 13, minWidth: 180 }}
          >
            <option value="">— 이벤트 선택 —</option>
            {eventList.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name} ({ev.event_code}) · {ev.status}</option>
            ))}
          </select>
        )}
        <input
          value={eventInput} onChange={(e) => setEventInput(e.target.value)}
          style={{ flex: 1, padding: 8, border: '1px solid #475569', background: '#1e293b', color: 'white', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', minWidth: 220 }}
          placeholder="또는 event_id 직접 입력"
        />
        <button onClick={() => setParams({ event: eventInput })} style={btn('#2563eb')}>적용</button>
      </div>

      {error && <div style={errBox}>{error}</div>}

      {results.length === 0 ? (
        <div style={card}>
          <p>표시할 활성 코트의 히트가 없습니다.</p>
          <p style={muted}>seed 실행 후: <code>cd apps/api && python seed_v33_demo.py</code></p>
        </div>
      ) : (
        results.map((heat) => <HeatCard key={heat.heat_id} heat={heat} />)
      )}
    </div>
  );
}

function HeatCard({ heat }) {
  const max = useMemo(() => {
    return heat.rankings.length > 0
      ? Math.max(1, ...heat.rankings.map((r) => r.score || 0))
      : 1;
  }, [heat.rankings]);

  // 1위 변경 감지 → 컨페티
  const prevLeaderRef = useRef(null);
  useEffect(() => {
    const leader = heat.rankings.find((r) => r.judge_count > 0);
    const prev = prevLeaderRef.current;
    if (leader && prev && leader.participant_id !== prev) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.5 },
        colors: ['#fbbf24', '#facc15', '#f59e0b'],
      });
    }
    if (leader) prevLeaderRef.current = leader.participant_id;
  }, [heat.rankings]);

  return (
    <section style={heatCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <h2 style={h2}>
          <code style={code}>{heat.heat_id.slice(0, 8)}</code>
          {heat.event_code && <span style={tag}>{heat.event_code}</span>}
        </h2>
        <small style={muted}>{heat.payload_kind}</small>
      </div>

      {heat.rankings.length === 0 ? (
        <p style={muted}>참가자 없음</p>
      ) : (
        <motion.div layout style={{ display: 'grid', gap: 8 }}>
          <AnimatePresence>
            {heat.rankings.map((r, idx) => (
              <motion.div
                key={r.participant_id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              >
                <RankRow rank={idx + 1} r={r} max={max} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
      {heat.tied_groups && heat.tied_groups.length > 0 && (
        <div style={{ marginTop: 8, padding: 8, background: '#7c2d12', borderRadius: 6, fontSize: 12, color: '#fed7aa' }}>
          ⚖️ 동점 감지: {heat.tied_groups.length}개 그룹 ({heat.tied_groups.map((tg) => `${tg.score}점 ${tg.participant_ids.length}명`).join(' · ')})
        </div>
      )}
    </section>
  );
}

function RankRow({ rank, r, max }) {
  const hasScore = r.judge_count > 0;
  const widthPct = hasScore ? Math.max(2, (r.score / max) * 100) : 0;
  const c = rankColor(rank, hasScore);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px', gap: 10, alignItems: 'center' }}>
      <div style={{ ...rankBadge, background: c.badge, color: 'white' }}>{rank}</div>
      <div style={{ position: 'relative', height: 36, background: '#1e293b', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${widthPct}%`, background: c.bar,
          transition: 'width 800ms ease-out',
        }} />
        <div style={{ position: 'relative', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', fontWeight: 700 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {r.country_code && <Flag code={r.country_code} size={16} />}
            {r.name}
          </span>
          {r.team && <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>{r.team}</span>}
        </div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 18, fontWeight: 800, color: hasScore ? c.bar : '#475569', fontFamily: 'monospace' }}>
        {hasScore ? r.score : '—'}
      </div>
    </div>
  );
}

function rankColor(rank, hasScore) {
  if (!hasScore) return { badge: '#475569', bar: '#334155' };
  if (rank === 1) return { badge: '#ca8a04', bar: '#fbbf24' };  // 금
  if (rank === 2) return { badge: '#64748b', bar: '#94a3b8' };  // 은
  if (rank === 3) return { badge: '#92400e', bar: '#d97706' };  // 동
  return { badge: '#475569', bar: '#475569' };
}

const page = { background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', padding: 20, fontFamily: 'system-ui, sans-serif' };
const hdr = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, maxWidth: 980, margin: '0 auto 20px' };
const h1 = { fontSize: 22, fontWeight: 800, margin: 0 };
const h2 = { fontSize: 16, margin: 0, fontWeight: 700 };
const muted = { color: '#64748b', fontSize: 12 };
const card = { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 18, maxWidth: 980, margin: '0 auto' };
const heatCard = { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 16, marginBottom: 12, maxWidth: 980, margin: '0 auto 12px' };
const code = { fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' };
const tag = { background: '#7c3aed', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 11, marginLeft: 6, fontWeight: 700 };
const rankBadge = { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 };
const errBox = { background: '#7f1d1d', color: '#fecaca', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12, maxWidth: 980, margin: '0 auto 12px' };
const btn = (color) => ({ padding: '8px 14px', background: color, color: 'white', border: 0, borderRadius: 6, cursor: 'pointer', fontWeight: 700 });
