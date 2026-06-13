/**
 * 회원가입 / 로그인 — v3.3 Phase 2.
 * 가입은 옵션 (관람·결과 조회는 가입 없이도 가능).
 * 가입하면: 자녀/본인 결과 푸시, 다음 차례 알림, 본인 시상 호명 사전 알림.
 *
 * 한/영 토글 (localization), 소셜 로그인 자리 (카카오/네이버/구글) — OAuth 키 받으면 활성화.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STRINGS = {
  ko: {
    signup: '회원가입',
    signin: '로그인',
    welcome: '🏃 모두의 플레이',
    intro: '결과 알림, 다음 차례 알림, 시상 호명 사전 안내를 받으려면 가입하세요.\n관람만 한다면 가입 없이도 모든 라이브 화면을 볼 수 있어요.',
    quickSignup: '간편 가입 / 로그인',
    or: '또는 이메일로',
    email: '이메일',
    password: '비밀번호',
    name: '이름',
    phone: '휴대번호 (선택)',
    nationality: '국적',
    role: '나는...',
    rolePlayer: '🏃 선수',
    roleCoach: '🧢 코치',
    roleGuardian: '👨‍👧 보호자 / 부모',
    rolePlayerDesc: '본인 결과·일정 알림',
    roleCoachDesc: '팀 선수 결과·일정 일괄 알림',
    roleGuardianDesc: '자녀 결과·다음 차례 알림',
    submitSignup: '가입하고 시작하기',
    submitSignin: '로그인',
    success: '성공',
    placeholderEmail: 'me@example.com',
    placeholderName: '홍길동',
    placeholderPhone: '010-1234-5678',
    socialKakao: '카카오톡으로 시작',
    socialNaver: '네이버로 시작',
    socialGoogle: '구글로 시작',
    socialComing: 'OAuth 키 받은 후 활성화 예정',
    noConsent14:
      '만 14세 미만은 부모·보호자 동의 후 가입 (정보통신망법).',
    minPassword: '비밀번호 4자 이상',
    privacyNote:
      '이메일·휴대번호는 알림 발송에만 사용하며 제3자에게 공개되지 않습니다.',
  },
  en: {
    signup: 'Sign up',
    signin: 'Sign in',
    welcome: '🏃 Modu Play',
    intro:
      'Sign up to receive result updates, next-round alerts, and award announcements.\nNo account is needed to watch any live screen.',
    quickSignup: 'Quick sign up / sign in',
    or: 'or use email',
    email: 'Email',
    password: 'Password',
    name: 'Name',
    phone: 'Phone (optional)',
    nationality: 'Country',
    role: 'I am a...',
    rolePlayer: '🏃 Athlete',
    roleCoach: '🧢 Coach',
    roleGuardian: '👨‍👧 Parent / Guardian',
    rolePlayerDesc: 'Get your own results and schedule',
    roleCoachDesc: 'Get team results and schedule in one place',
    roleGuardianDesc: "Get your child's results and next turn alerts",
    submitSignup: 'Sign up & start',
    submitSignin: 'Sign in',
    success: 'OK',
    placeholderEmail: 'me@example.com',
    placeholderName: 'Your name',
    placeholderPhone: '+82 10 1234 5678',
    socialKakao: 'Continue with Kakao',
    socialNaver: 'Continue with Naver',
    socialGoogle: 'Continue with Google',
    socialComing: 'Available once OAuth keys are added',
    noConsent14:
      'Under-14 users need parent/guardian consent (KR Information & Communication Network Act).',
    minPassword: 'Password must be at least 4 characters',
    privacyNote:
      'Email and phone are used only for notifications and never shared with third parties.',
  },
};

const COUNTRIES = [
  ['KR', '🇰🇷 대한민국 / Korea'],
  ['US', '🇺🇸 USA'],
  ['JP', '🇯🇵 일본 / Japan'],
  ['CN', '🇨🇳 중국 / China'],
  ['VN', '🇻🇳 베트남 / Vietnam'],
  ['TH', '🇹🇭 태국 / Thailand'],
  ['IN', '🇮🇳 인도 / India'],
  ['BD', '🇧🇩 방글라데시 / Bangladesh'],
  ['NP', '🇳🇵 네팔 / Nepal'],
  ['BR', '🇧🇷 브라질 / Brazil'],
  ['DE', '🇩🇪 독일 / Germany'],
  ['XX', '기타 / Other'],
];

export default function SignUp() {
  const nav = useNavigate();
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || (navigator.language?.startsWith('ko') ? 'ko' : 'en'));
  const t = STRINGS[lang];

  const [mode, setMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState(lang === 'ko' ? 'KR' : 'US');
  const [role, setRole] = useState('player');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => { localStorage.setItem('lang', lang); }, [lang]);

  const submit = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const url = mode === 'signup' ? '/api/v1/auth/signup' : '/api/v1/auth/signin';
      const body = mode === 'signup'
        ? { email, password, name, phone_number: phone || null, country_code: country, role }
        : { username: email, password };
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.success) {
        localStorage.setItem('player_token', j.data.token);
        setResult(j.data);
        setTimeout(() => nav('/me'), 1200);
      } else setError(j.detail || (mode === 'signup' ? 'Signup failed' : 'Signin failed'));
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  const social = (provider) => alert(`${provider}: ${t.socialComing}`);

  const formValid = email && password.length >= 4 && (mode === 'signin' || name);

  return (
    <div style={page}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={h1}>{t.welcome}</h1>
          <div style={langWrap}>
            <button onClick={() => setLang('ko')} style={langBtn(lang === 'ko')}>한국어</button>
            <button onClick={() => setLang('en')} style={langBtn(lang === 'en')}>English</button>
          </div>
        </div>

        <p style={intro}>{t.intro}</p>

        <div style={{ display: 'flex', gap: 8, marginTop: 18, marginBottom: 14 }}>
          <button onClick={() => setMode('signup')} style={tabBtn(mode === 'signup')}>{t.signup}</button>
          <button onClick={() => setMode('signin')} style={tabBtn(mode === 'signin')}>{t.signin}</button>
        </div>

        {/* 소셜 로그인 (UI 자리 마련) */}
        <div style={{ display: 'grid', gap: 8 }}>
          <SocialBtn bg="#FEE500" color="#3C1E1E" label={t.socialKakao} icon="💬" onClick={() => social('Kakao')} />
          <SocialBtn bg="#03C75A" color="white" label={t.socialNaver} icon="N" onClick={() => social('Naver')} />
          <SocialBtn bg="white" color="#3c4043" label={t.socialGoogle} icon="G" border="1px solid #dadce0" onClick={() => social('Google')} />
        </div>
        <p style={{ ...muted, textAlign: 'center', margin: '10px 0 18px', fontSize: 11 }}>{t.socialComing}</p>

        <div style={divider}><span style={dividerLabel}>{t.or}</span></div>

        <Field label={t.email} type="email" value={email} onChange={setEmail} placeholder={t.placeholderEmail} />
        <Field label={t.password} type="password" value={password} onChange={setPassword} hint={password && password.length < 4 ? t.minPassword : null} />

        {mode === 'signup' && (
          <>
            <Field label={t.name} value={name} onChange={setName} placeholder={t.placeholderName} />
            <Field label={t.phone} value={phone} onChange={setPhone} placeholder={t.placeholderPhone} />
            <label style={fieldWrap}>
              <span style={lbl}>{t.nationality}</span>
              <select value={country} onChange={(e) => setCountry(e.target.value)} style={inp}>
                {COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
            <label style={fieldWrap}>
              <span style={lbl}>{t.role}</span>
              <div style={{ display: 'grid', gap: 6 }}>
                <RoleCard checked={role === 'player'} onClick={() => setRole('player')}
                  title={t.rolePlayer} desc={t.rolePlayerDesc} />
                <RoleCard checked={role === 'coach'} onClick={() => setRole('coach')}
                  title={t.roleCoach} desc={t.roleCoachDesc} />
                <RoleCard checked={role === 'guardian'} onClick={() => setRole('guardian')}
                  title={t.roleGuardian} desc={t.roleGuardianDesc} />
              </div>
            </label>
          </>
        )}

        {error && <div style={errBox}>{error}</div>}
        {result && (
          <div style={okBox}>
            ✓ {t.success} — {result.email || result.user_id} ({result.role})
          </div>
        )}

        <button onClick={submit} disabled={loading || !formValid} style={{ ...primaryBtn, opacity: (loading || !formValid) ? 0.5 : 1 }}>
          {loading ? '...' : (mode === 'signup' ? t.submitSignup : t.submitSignin)}
        </button>

        {mode === 'signup' && (
          <div style={{ marginTop: 14 }}>
            <p style={fineprint}>{t.noConsent14}</p>
            <p style={fineprint}>{t.privacyNote}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, hint }) {
  return (
    <label style={fieldWrap}>
      <span style={lbl}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inp} />
      {hint && <span style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{hint}</span>}
    </label>
  );
}

function RoleCard({ checked, onClick, title, desc }) {
  return (
    <button type="button" onClick={onClick} style={{
      textAlign: 'left', padding: '10px 14px',
      border: `2px solid ${checked ? 'var(--brand)' : 'var(--line)'}`,
      background: checked ? 'color-mix(in srgb, var(--brand) 12%, transparent)' : 'var(--surface2)',
      color: 'var(--ink)',
      borderRadius: 10, cursor: 'pointer',
    }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 2 }}>{desc}</div>
    </button>
  );
}

function SocialBtn({ bg, color, label, icon, border, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      padding: '11px 14px', background: bg, color, border: border || 'none',
      borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14,
    }}>
      <span style={{ width: 20, textAlign: 'center', fontWeight: 800 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

const page = { minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: '-apple-system, Pretendard, sans-serif' };
const card = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 28, maxWidth: 440, width: '100%', boxShadow: 'var(--wp-glow)' };
const h1 = { fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--ink)' };
const intro = { color: 'var(--ink2)', fontSize: 13.5, lineHeight: 1.55, marginTop: 8, whiteSpace: 'pre-line' };
const muted = { color: 'var(--muted)' };
const langWrap = { display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 8, padding: 2 };
const langBtn = (on) => ({
  padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
  background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink2)',
  border: on ? '1px solid var(--line)' : 'none', borderRadius: 6,
});
const tabBtn = (active) => ({
  flex: 1, padding: '10px 14px',
  backgroundImage: active ? 'var(--grad)' : 'none',
  background: active ? undefined : 'var(--surface2)',
  color: active ? 'var(--accentInk)' : 'var(--ink2)',
  border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14,
});
const divider = { position: 'relative', textAlign: 'center', margin: '4px 0 14px', borderTop: '1px solid var(--line)' };
const dividerLabel = { background: 'var(--surface)', padding: '0 10px', position: 'relative', top: -10, color: 'var(--muted)', fontSize: 11 };
const fieldWrap = { display: 'block', marginBottom: 12 };
const lbl = { display: 'block', fontSize: 12, color: 'var(--ink2)', marginBottom: 4, fontWeight: 700 };
const inp = { width: '100%', padding: 10, background: 'var(--surface2)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' };
const errBox = { background: 'rgba(255,94,108,.15)', color: '#FF8A93', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 8 };
const okBox = { background: 'rgba(52,212,166,.15)', color: '#5FE0BC', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 8 };
const primaryBtn = { width: '100%', marginTop: 8, padding: '13px 20px', backgroundImage: 'var(--grad)', color: 'var(--accentInk)', border: 0, borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 15 };
const fineprint = { color: '#94a3b8', fontSize: 11, lineHeight: 1.5, margin: '4px 0' };
