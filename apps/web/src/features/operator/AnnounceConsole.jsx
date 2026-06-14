/**
 * AI 음성 호명 (앱 디자인) — /operate-app
 * 5월 OperatorPanel 로직 재사용: /api/v1/operator/no-shows, handled, tts speakBoth.
 * 디자인만 WEPLAY 콘솔 기준. 기존 /operate(5월)는 그대로 둠.
 */
import { useCallback, useEffect, useState } from 'react';
import { speakBoth, isSupported as ttsSupported } from '../../lib/tts';
import styles from './AnnounceConsole.module.css';

const QUICK = [
  { label: '⏱ 곧 시작', ko: '잠시 후 다음 경기가 시작됩니다. 해당 선수는 준비해 주세요.', en: 'The next match begins shortly. Please get ready.' },
  { label: '🍽 점심 안내', ko: '점심 시간입니다. 오후 경기는 한 시에 재개됩니다.', en: 'It is lunch break. Afternoon matches resume at 1 PM.' },
  { label: '🏆 시상 안내', ko: '잠시 후 시상식이 진행됩니다. 수상 선수는 시상대 앞으로 모여 주세요.', en: 'The award ceremony begins shortly. Winners, please gather at the podium.' },
];

export default function AnnounceConsole() {
  const [token, setToken] = useState(localStorage.getItem('operator_token') || '');
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const grantDevToken = async () => {
    const r = await fetch('/api/v1/auth/dev-grant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'operator', user_id: 'dev-op-app' }),
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
      if (j.success) setCalls(j.data || []); else setError(j.detail || '조회 실패');
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }, [token]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!token) return undefined;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [token, load]);

  const markHandled = async (auditId) => {
    await fetch(`/api/v1/operator/no-shows/${auditId}/handled`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    await load();
  };

  // TODO(backend): Phase 3 = ElevenLabs 사회자 음성 송출. 현재는 Web Speech API(브라우저 TTS).
  const announce = (call) => {
    const heatShort = (call.heat_id || '').slice(0, 6);
    speakBoth(
      `호명합니다. 히트 번호 ${heatShort}, 해당 선수는 즉시 입장해 주시기 바랍니다.`,
      `Calling participant. Heat ${heatShort}, please report to the competition floor immediately.`,
    );
  };

  if (!token) {
    return (
      <div className={styles.screen}>
        <div className={styles.wrap} style={{ textAlign: 'center', paddingTop: 60 }}>
          <div className={styles.title} style={{ justifyContent: 'center' }}>📢 AI 음성 호명</div>
          <p style={{ color: 'var(--ink3)', fontSize: 13, marginTop: 10 }}>[개발] 운영위원 토큰이 없어요.</p>
          <button className={styles.devBtn} onClick={grantDevToken}>운영위원 토큰 발급</button>
        </div>
      </div>
    );
  }

  const pending = calls.filter((c) => !c.handled);
  const handled = calls.filter((c) => c.handled);

  return (
    <div className={styles.screen}>
      <div className={styles.wrap}>
        <div className={styles.hd}>
          <span className={styles.title}>📢 AI 음성 호명</span>
          <span className={styles.refresh}>5초 자동 갱신 · {loading ? '⏳' : '✓'}</span>
        </div>

        {error && <div className={styles.errBox}>⚠️ {error}</div>}

        <section className={`${styles.block} ${styles.blockLive}`}>
          <div className={`${styles.bt} ${styles.btLive}`}>🚨 호명 대기 <span style={{ color: 'var(--ink3)' }}>{pending.length}</span></div>
          {pending.length === 0 ? (
            <p className={styles.empty}>현재 호명 요청이 없어요.</p>
          ) : pending.map((c) => (
            <div key={c.audit_id} className={styles.call}>
              <div className={styles.callMain}>
                <div className={styles.callT}>HIT <code>{(c.heat_id || '').slice(0, 8)}</code> · 선수 <code>{(c.target_id || '').slice(0, 8)}</code></div>
                <div className={styles.callMeta}>{c.note || '사유 없음'} · {new Date(c.timestamp).toLocaleTimeString()} · 심판 {c.actor_role}</div>
              </div>
              <div className={styles.callActs}>
                {ttsSupported() && <button className={`${styles.btn} ${styles.btnAnnounce}`} onClick={() => announce(c)}>📢 AI 호명</button>}
                <button className={`${styles.btn} ${styles.btnDone}`} onClick={() => markHandled(c.audit_id)}>✓ 완료</button>
              </div>
            </div>
          ))}
        </section>

        <section className={styles.block}>
          <div className={styles.bt}>🎙 빠른 안내 방송</div>
          <div className={styles.tplRow}>
            {QUICK.map((q) => (
              <button key={q.label} className={styles.tpl} onClick={() => ttsSupported() && speakBoth(q.ko, q.en)}>{q.label}</button>
            ))}
          </div>
          <div className={styles.ttsHint}>버튼을 누르면 한국어→영어 순으로 자동 방송돼요. (브라우저 음성 / 추후 사회자 AI 음성 연결)</div>
        </section>

        {handled.length > 0 && (
          <section className={`${styles.block} ${styles.handled}`}>
            <div className={styles.bt}>✅ 처리 완료 <span style={{ color: 'var(--ink3)' }}>{handled.length}</span></div>
            {handled.slice(0, 5).map((c) => (
              <div key={c.audit_id} className={styles.call}>
                <div className={styles.callMeta}>HIT {(c.heat_id || '').slice(0, 8)} · {c.note} · {new Date(c.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
