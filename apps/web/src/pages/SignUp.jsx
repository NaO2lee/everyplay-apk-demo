/**
 * 로그인 / 회원가입 — 최대한 심플. 소셜 3개(구글·네이버·카카오) 동그라미 버튼만.
 * 일반(이메일) 회원가입 없음 — 개인정보 최소화. 관람은 로그인 없이도 가능.
 * 소셜 실연결은 OAuth 키 받은 뒤 onSocial() 안에서 처리. (지금은 안내만)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SignUp() {
  const nav = useNavigate();
  const [notice, setNotice] = useState(null);

  const onSocial = (provider) => {
    // TODO(backend): 각 사 OAuth 키 받으면 여기서 로그인 시작
    //   구글=OAuth2, 카카오=Kakao Login, 네이버=네이버 아이디로 로그인
    setNotice(`${provider} 로그인은 키 연결 후 바로 켜져요 (지금은 준비 중)`);
  };

  return (
    <div style={page}>
      <div style={inner}>
        {/* 브랜드 */}
        <img src="/brand/weplay-icon.png" alt="weplay" style={{ width: 64, height: 64, objectFit: 'contain', marginBottom: 18 }} />
        <h1 style={h1}>모두의플레이</h1>
        <p style={tag}>줄넘기 대회, 라이브로 · 내 기록까지</p>

        {/* 소셜 동그라미 버튼 3개 */}
        <div style={row}>
          <Social label="카카오" bg="#FEE500" onClick={() => onSocial('카카오')}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="#3C1E1E" aria-hidden="true">
              <path d="M12 3.2C6.6 3.2 2.2 6.7 2.2 11c0 2.8 1.9 5.2 4.7 6.6-.2.7-.7 2.5-.8 2.9-.1.5.2.5.4.4.2-.1 2.6-1.7 3.6-2.4.6.1 1.2.1 1.9.1 5.4 0 9.8-3.5 9.8-7.6S17.4 3.2 12 3.2z" />
            </svg>
          </Social>
          <Social label="네이버" bg="#03C75A" onClick={() => onSocial('네이버')}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 26, lineHeight: 1, fontFamily: 'Arial, sans-serif' }}>N</span>
          </Social>
          <Social label="구글" bg="#fff" ring="1px solid rgba(0,0,0,.1)" onClick={() => onSocial('구글')}>
            <svg width="28" height="28" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
          </Social>
        </div>

        <p style={hint}>구글 · 네이버 · 카카오 계정으로 간편하게.<br />복잡한 가입 없이 안전하게 시작해요.</p>

        {notice && <div style={noticeBox}>{notice}</div>}

        <button style={guest} onClick={() => nav('/app/demo')}>로그인 없이 둘러보기</button>
      </div>
    </div>
  );
}

function Social({ label, bg, ring, onClick, children }) {
  return (
    <button onClick={onClick} style={socialBtn} aria-label={label}>
      <span style={{ ...circle, background: bg, border: ring || 'none' }}>{children}</span>
      <span style={socialLabel}>{label}</span>
    </button>
  );
}

const page = { minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Pretendard', -apple-system, sans-serif" };
const inner = { width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' };
const h1 = { fontSize: 26, fontWeight: 900, color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em' };
const tag = { fontSize: 14, color: 'var(--ink2)', margin: '8px 0 0' };
const row = { display: 'flex', justifyContent: 'center', gap: 28, marginTop: 44 };
const socialBtn = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, background: 'none', border: 'none', cursor: 'pointer', padding: 0 };
const circle = { width: 68, height: 68, borderRadius: '50%', display: 'grid', placeItems: 'center', boxShadow: '0 8px 22px rgba(0,0,0,0.28)', transition: 'transform .12s ease' };
const socialLabel = { fontSize: 13, fontWeight: 700, color: 'var(--ink2)' };
const hint = { fontSize: 12.5, color: 'var(--ink3, #8A8FA8)', lineHeight: 1.6, marginTop: 40 };
const noticeBox = { marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px' };
const guest = { marginTop: 36, background: 'none', border: 'none', color: 'var(--ink3, #8A8FA8)', fontSize: 14, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 4, cursor: 'pointer' };
