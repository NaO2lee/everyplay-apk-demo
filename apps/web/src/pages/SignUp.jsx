/**
 * 회원가입 — v3.3 Phase 2 (옵트인).
 * 이메일 + 폰 + 비번 + 국적 + 이름. SMS OTP는 Phase 5에서.
 *
 * 가입 후 자동 로그인 → /me 이동.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const COUNTRIES = [
  ['KR', '🇰🇷 대한민국'], ['US', '🇺🇸 USA'], ['JP', '🇯🇵 일본'],
  ['CN', '🇨🇳 중국'], ['BR', '🇧🇷 브라질'], ['DE', '🇩🇪 독일'],
  ['IN', '🇮🇳 인도'], ['BD', '🇧🇩 방글라데시'], ['NP', '🇳🇵 네팔'],
  ['VN', '🇻🇳 베트남'], ['TH', '🇹🇭 태국'], ['XX', '기타'],
];

export default function SignUp() {
  const nav = useNavigate();
  const [mode, setMode] = useState('signup');  // 'signup' or 'signin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('KR');
  const [role, setRole] = useState('player');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const submit = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      if (mode === 'signup') {
        const r = await fetch('/api/v1/auth/signup', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name, phone_number: phone, country_code: country, role }),
        });
        const j = await r.json();
        if (j.success) {
          localStorage.setItem('player_token', j.data.token);
          setResult(j.data);
          setTimeout(() => nav('/me'), 1500);
        } else setError(j.detail || '가입 실패');
      } else {
        const r = await fetch('/api/v1/auth/signin', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: email, password }),
        });
        const j = await r.json();
        if (j.success) {
          localStorage.setItem('player_token', j.data.token);
          setResult(j.data);
          setTimeout(() => nav('/me'), 1500);
        } else setError(j.detail || '로그인 실패');
      }
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  return (
    <div style={page}>
      <div style={card}>
        <h1 style={h1}>{mode === 'signup' ? '🏃 회원가입' : '🔑 로그인'}</h1>
        <p style={{ ...muted, marginBottom: 16 }}>
          선수 또는 코치만 가입 가능. 옵트인 — 어린 선수는 가입 안 해도 됩니다.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => setMode('signup')} style={tabBtn(mode === 'signup')}>회원가입</button>
          <button onClick={() => setMode('signin')} style={tabBtn(mode === 'signin')}>로그인</button>
        </div>

        <Field label="이메일" type="email" value={email} onChange={setEmail} placeholder="me@example.com" />
        <Field label="비밀번호" type="password" value={password} onChange={setPassword} />

        {mode === 'signup' && (
          <>
            <Field label="이름 (영문/한글)" value={name} onChange={setName} placeholder="홍길동" />
            <Field label="휴대번호" value={phone} onChange={setPhone} placeholder="010-1234-5678" />
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>국적</span>
              <select value={country} onChange={(e) => setCountry(e.target.value)} style={inp}>
                {COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>역할</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <RadioBtn label="🏃 선수" checked={role === 'player'} onClick={() => setRole('player')} />
                <RadioBtn label="🧢 코치" checked={role === 'coach'} onClick={() => setRole('coach')} />
              </div>
            </label>
          </>
        )}

        {error && <div style={errBox}>{error}</div>}
        {result && (
          <div style={okBox}>
            ✓ {mode === 'signup' ? '가입 완료' : '로그인 완료'} — {result.email || result.user_id} ({result.role}). /me 이동 중...
          </div>
        )}

        <button onClick={submit} disabled={loading || !email || !password || (mode === 'signup' && !name)} style={{ ...btn('#ea580c'), width: '100%', marginTop: 12 }}>
          {loading ? '...' : (mode === 'signup' ? '가입하고 시작하기' : '로그인')}
        </button>

        {mode === 'signup' && (
          <p style={{ ...muted, marginTop: 14, fontSize: 11 }}>
            ※ 만 14세 미만은 부모/보호자 동의 후 가입 (정보통신망법). SMS OTP 본인 확인은 Phase 5에서 추가.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inp} />
    </label>
  );
}

function RadioBtn({ label, checked, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: 1, padding: '12px 14px',
      border: `2px solid ${checked ? '#ea580c' : '#cbd5e1'}`,
      background: checked ? '#fff7ed' : 'white',
      color: checked ? '#7c2d12' : '#64748b',
      borderRadius: 8, cursor: 'pointer', fontWeight: 700,
    }}>{label}</button>
  );
}

function tabBtn(active) {
  return {
    flex: 1, padding: '8px 14px',
    background: active ? '#ea580c' : '#e5e7eb',
    color: active ? 'white' : '#475569',
    border: 0, borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 13,
  };
}

const page = { minHeight: '100vh', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, sans-serif' };
const card = { background: 'white', borderRadius: 16, padding: 32, maxWidth: 420, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' };
const h1 = { fontSize: 24, fontWeight: 800, margin: '0 0 4px' };
const muted = { color: '#94a3b8', fontSize: 12 };
const inp = { width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 8 };
const okBox = { background: '#dcfce7', color: '#166534', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 8 };
const btn = (color) => ({ padding: '12px 20px', background: color, color: 'white', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 15 });
