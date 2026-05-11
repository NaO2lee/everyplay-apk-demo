/**
 * 선수/코치 PWA 홈 — v3.3 Phase 2 (실제 구현).
 *  - 본인 프로필 (User + 매칭된 Participant)
 *  - 내 출전 히트 (다음 차례 강조)
 *  - 내가 받은 award (입상)
 *  - 푸시 권한 안내 (Phase 5에서 실제 구독)
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Flag from '../components/Flag';
import { registerSW, isStandalone, isIos } from '../lib/pwa';

export default function PlayerMe() {
  const [token, setToken] = useState(localStorage.getItem('player_token') || '');
  const [me, setMe] = useState(null);
  const [awards, setAwards] = useState([]);
  const [heats, setHeats] = useState([]);
  const [error, setError] = useState(null);

  const grantDevToken = async (role) => {
    const r = await fetch('/api/v1/auth/dev-grant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, user_id: `dev-${role}-1` }),
    });
    const j = await r.json();
    if (j.success) { localStorage.setItem('player_token', j.data.token); setToken(j.data.token); }
  };

  useEffect(() => {
    if (!token) return;
    registerSW();  // PWA Service Worker 자동 등록 (한 번만)
    const auth = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch('/api/v1/me', { headers: auth }).then((r) => r.json()),
      fetch('/api/v1/me/awards', { headers: auth }).then((r) => r.json()),
      fetch('/api/v1/me/heats', { headers: auth }).then((r) => r.json()),
    ]).then(([m, a, h]) => {
      if (m.success) setMe(m.data); else setError(m.detail || 'me fail');
      if (a.success) setAwards(a.data || []);
      if (h.success) setHeats(h.data || []);
    }).catch((e) => setError(String(e)));
  }, [token]);

  if (!token) {
    return (
      <Wrap>
        <h1 style={h1}>🏃 모두의 플레이</h1>
        <p style={muted}>가입한 선수/코치만. 가입은 무료, 옵트인.</p>
        <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
          <Link to="/signup" style={{ ...btn('#ea580c'), textDecoration: 'none', textAlign: 'center', display: 'block' }}>회원가입 / 로그인 →</Link>
          <button onClick={() => grantDevToken('player')} style={btn('#7c3aed')}>[DEV] 임시 선수 토큰</button>
        </div>
      </Wrap>
    );
  }

  if (error && !me) return <Wrap><div style={errBox}>{error}</div></Wrap>;
  if (!me) return <Wrap><p style={muted}>로딩...</p></Wrap>;

  const u = me.user || {};
  const p = me.participant;
  const nextHeat = heats.find((h) => !h.ended_at) || heats[0];

  return (
    <Wrap>
      <header style={{ marginBottom: 20 }}>
        <h1 style={h1}>
          {u.country_code && <Flag code={u.country_code} size={22} style={{ marginRight: 8 }} />}
          {u.name || u.email || '선수'}
        </h1>
        <small style={muted}>
          {u.role === 'player' ? '🏃 선수' : u.role === 'coach' ? '🧢 코치' : u.role}
          {u.email && ` · ${u.email}`}
        </small>
      </header>

      {!p && (
        <Card title="⚠️ 매칭된 출전 정보 없음">
          <p style={{ fontSize: 13, color: '#78350f' }}>
            가입한 이메일/폰번호로 등록된 selene를 찾지 못했습니다. 관리자가 명단에 등록 후 동일 이메일·폰을 입력해야 매칭됩니다.
          </p>
        </Card>
      )}

      {p && (
        <Card title="📋 내 출전 정보">
          <Row label="이름" value={p.name} />
          <Row label="국적" value={<><Flag code={p.country_code} size={14} /> {p.country_code || '—'}</>} />
          <Row label="소속팀" value={p.team || '—'} />
          <Row label="부문" value={p.category || '—'} />
        </Card>
      )}

      {nextHeat && (
        <Card title="🔜 다음 출전" accent="#dc2626">
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Heat {nextHeat.heat_number} <code style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>({nextHeat.heat_id.slice(0, 8)})</code>
          </div>
          {nextHeat.started_at && !nextHeat.ended_at && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13 }}>
              🏃 진행 중 — 즉시 코트로!
            </div>
          )}
          {!nextHeat.started_at && (
            <p style={muted}>대기 중. 곧 시작 예정.</p>
          )}
        </Card>
      )}

      <Card title={`🏆 내 수상 (${awards.length})`}>
        {awards.length === 0 ? (
          <p style={muted}>아직 award 없음.</p>
        ) : (
          awards.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px dashed #e2e8f0' }}>
              <div style={{ fontSize: 24 }}>{a.rank === 1 ? '🥇' : a.rank === 2 ? '🥈' : '🥉'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{a.rank}위 — {a.category}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>status: {a.status}</div>
              </div>
            </div>
          ))
        )}
      </Card>

      <Card title={`📅 내 모든 출전 히트 (${heats.length})`}>
        {heats.length === 0 ? (
          <p style={muted}>출전 히트 없음.</p>
        ) : (
          heats.map((h) => (
            <div key={h.heat_id} style={{ padding: '6px 0', fontSize: 13, borderBottom: '1px dashed #e2e8f0' }}>
              Heat {h.heat_number} <code style={{ fontSize: 10, color: '#94a3b8' }}>{h.heat_id.slice(0, 8)}</code>
              {h.ended_at && <span style={{ marginLeft: 8, fontSize: 11, color: '#16a34a' }}>✓ 완료</span>}
              {h.started_at && !h.ended_at && <span style={{ marginLeft: 8, fontSize: 11, color: '#dc2626' }}>🔴 진행중</span>}
            </div>
          ))
        )}
      </Card>

      <Card title="🔔 푸시 알림">
        {!isStandalone() && isIos() && (
          <div style={{ background: '#fef3c7', padding: 12, borderRadius: 8, fontSize: 13, color: '#78350f', marginBottom: 8 }}>
            <strong>📲 iPhone에서 알림 받으려면 홈화면 추가 필요:</strong>
            <ol style={{ paddingLeft: 20, margin: '6px 0' }}>
              <li>하단 공유 버튼 (⬆️) 누르기</li>
              <li>"홈 화면에 추가" 선택</li>
              <li>홈 화면 아이콘 누르고 다시 들어오기</li>
            </ol>
          </div>
        )}
        {!isStandalone() && !isIos() && (
          <div style={{ background: '#dbeafe', padding: 12, borderRadius: 8, fontSize: 13, color: '#1e3a8a', marginBottom: 8 }}>
            📲 Android: 브라우저 메뉴 → "홈 화면에 추가" 누르면 앱처럼 사용 가능.
          </div>
        )}
        {isStandalone() && (
          <div style={{ background: '#dcfce7', padding: 10, borderRadius: 8, fontSize: 13, color: '#166534', marginBottom: 8 }}>
            ✓ 홈화면에서 실행 중 — 푸시 권한 가능
          </div>
        )}
        <p style={{ fontSize: 12, color: '#475569' }}>
          차례 N-10번 시점 + 경기 시작 전 자동 푸시. 가입자 + 푸시 권한 동의자만.<br />
          ※ 실제 푸시 발송은 VAPID 키 셋업 후 활성화 (도메인 + 백엔드 환경변수).
        </p>
      </Card>

      <button
        onClick={() => { localStorage.removeItem('player_token'); setToken(''); setMe(null); }}
        style={{ marginTop: 16, padding: '8px 14px', background: '#e5e7eb', border: 0, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
      >
        로그아웃
      </button>
    </Wrap>
  );
}

function Card({ title, children, accent }) {
  return (
    <section style={{ background: 'white', border: '1px solid #e2e8f0', borderLeft: `4px solid ${accent || '#ea580c'}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: accent }}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Wrap({ children }) {
  return <div style={{ maxWidth: 480, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif', background: '#fff7ed', minHeight: '100vh' }}>{children}</div>;
}
const h1 = { fontSize: 22, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center' };
const muted = { color: '#94a3b8', fontSize: 12 };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 };
const btn = (color) => ({ padding: '12px 20px', background: color, color: 'white', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 });
