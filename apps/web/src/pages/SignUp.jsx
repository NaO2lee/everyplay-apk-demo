/**
 * 로그인 / 회원가입 흐름 — 소셜 3개(구글·네이버·카카오)만. 일반(이메일) 가입 없음.
 * 흐름: 로그인 → (소셜사 동의=각 사 제공) → 가입정보 없음 → 회원가입(이름·닉네임·이메일+역할+약관) → 환영.
 * 네이버/카카오/구글 "검수"용 단계 캡처를 위해 ?step=login|newuser|signup|welcome 딥링크 지원.
 * 소셜 실연결은 OAuth 키 받은 뒤 onSocial() 안에서 처리. (지금은 데모 흐름)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ROLES = ['선수', '코치', '일반 (관람·학부모)', '행사 운영자'];
const AGREE = [
  { id: 'tos', req: true, label: '서비스 이용약관 동의' },
  { id: 'privacy', req: true, label: '개인정보 수집·이용 동의' },
  { id: 'mkt', req: false, label: '마케팅 정보 수신 동의' },
  { id: 'noti', req: false, label: '알림 수신 동의' },
];
// 소셜에서 받아오는 정보(데모) — 실제론 OAuth 응답
const FROM_SOCIAL = { 네이버: { name: '허성만', email: 'user@naver.com' }, 카카오: { name: '허성만', email: 'user@kakao.com' }, 구글: { name: '허성만', email: 'user@gmail.com' } };

export default function SignUp() {
  const nav = useNavigate();
  const [step, setStep] = useState(() => {
    const s = new URLSearchParams(window.location.search).get('step');
    return ['login', 'newuser', 'signup', 'welcome'].includes(s) ? s : 'login';
  });
  const [provider, setProvider] = useState('네이버');
  const [nick, setNick] = useState('');
  const [role, setRole] = useState('선수');
  const [agree, setAgree] = useState({});
  const [age14, setAge14] = useState(() => (new URLSearchParams(window.location.search).get('u14') === '1' ? false : null)); // true=14세 이상, false=미만(보호자 동의)
  const [guardian, setGuardian] = useState({ name: '', phone: '', agree: false });

  const info = FROM_SOCIAL[provider] || FROM_SOCIAL['네이버'];
  const ageOk = age14 === true || (age14 === false && guardian.name.trim() && guardian.phone.trim() && guardian.agree);
  const allReqOk = AGREE.filter((a) => a.req).every((a) => agree[a.id]) && ageOk;
  const allChecked = AGREE.every((a) => agree[a.id]);
  const toggleAll = () => { const n = {}; AGREE.forEach((a) => { n[a.id] = !allChecked; }); setAgree(n); };
  const toggle = (id) => setAgree((a) => ({ ...a, [id]: !a[id] }));
  const onSocial = (p) => { setProvider(p); setStep('newuser'); };

  // ===== 1) 로그인 =====
  if (step === 'login') {
    return (
      <div style={page}>
        <div style={inner}>
          <img src="/brand/weplay-icon.png" alt="weplay" style={{ width: 64, height: 64, objectFit: 'contain', marginBottom: 18 }} />
          <h1 style={h1}>모두의플레이</h1>
          <p style={tag}>줄넘기 대회, 라이브로 · 내 기록까지</p>
          <div style={row}>
            <Social label="카카오" bg="#FEE500" onClick={() => onSocial('카카오')}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="#3C1E1E" aria-hidden="true"><path d="M12 3.2C6.6 3.2 2.2 6.7 2.2 11c0 2.8 1.9 5.2 4.7 6.6-.2.7-.7 2.5-.8 2.9-.1.5.2.5.4.4.2-.1 2.6-1.7 3.6-2.4.6.1 1.2.1 1.9.1 5.4 0 9.8-3.5 9.8-7.6S17.4 3.2 12 3.2z" /></svg>
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
          <button style={guest} onClick={() => nav('/app/demo')}>로그인 없이 둘러보기</button>
        </div>
      </div>
    );
  }

  // ===== 3) 가입 정보 없음 (신규) =====
  if (step === 'newuser') {
    return (
      <div style={{ ...page, background: 'var(--bg)' }}>
        <div style={card}>
          <div style={cardEmoji}>🙌</div>
          <div style={cardTitle}>가입된 회원 정보가 없어요</div>
          <div style={cardSub}>{provider} 계정으로 <b style={{ color: 'var(--ink)' }}>회원가입</b>을 진행할게요</div>
          <button style={primary} onClick={() => setStep('signup')}>회원가입 계속하기</button>
        </div>
      </div>
    );
  }

  // ===== 4) 회원가입 (이름·닉네임·이메일 + 역할 + 약관) =====
  if (step === 'signup') {
    return (
      <div style={{ ...page, alignItems: 'flex-start', paddingTop: 36 }}>
        <div style={inner}>
          <h1 style={{ ...h1, fontSize: 22, alignSelf: 'flex-start' }}>{provider} 아이디로 회원가입</h1>
          <p style={{ ...tag, alignSelf: 'flex-start', marginBottom: 18 }}>몇 가지만 확인하면 끝나요</p>

          <Field label="이름"><input style={input} value={info.name} readOnly /></Field>
          <Field label="이메일"><input style={input} value={info.email} readOnly /></Field>
          <Field label="닉네임"><input style={input} value={nick} onChange={(e) => setNick(e.target.value)} placeholder="앱에서 보일 이름" /></Field>

          <Field label="가입 유형 (역할)">
            <div style={chips}>
              {ROLES.map((r) => (
                <button key={r} onClick={() => setRole(r)} style={{ ...chip, ...(role === r ? chipOn : {}) }}>{r}</button>
              ))}
            </div>
          </Field>

          {/* 만 14세 이상 여부 — 미만이면 법정대리인(보호자) 동의 (개인정보처리방침 제12조) */}
          <div style={{ width: '100%', marginTop: 18 }}>
            <div style={fieldLbl}>만 14세 이상인가요?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAge14(true)} style={{ ...chip, flex: 1, ...(age14 === true ? chipOn : {}) }}>네, 14세 이상</button>
              <button onClick={() => setAge14(false)} style={{ ...chip, flex: 1, ...(age14 === false ? chipOn : {}) }}>아니요, 14세 미만</button>
            </div>
          </div>
          {age14 === false && (
            <div style={guardianBox}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)' }}>👨‍👩‍👧 보호자(법정대리인) 동의</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink2)', margin: '6px 0 11px', lineHeight: 1.55 }}>만 14세 미만은 개인정보보호법에 따라 보호자 동의가 필요해요. 보호자 정보를 입력해 주세요.</div>
              <input style={input} placeholder="보호자 이름" value={guardian.name} onChange={(e) => setGuardian({ ...guardian, name: e.target.value })} />
              <input style={{ ...input, marginTop: 8 }} placeholder="보호자 연락처 (휴대폰)" inputMode="tel" value={guardian.phone} onChange={(e) => setGuardian({ ...guardian, phone: e.target.value })} />
              <button style={{ ...agreeRow, marginTop: 4 }} onClick={() => setGuardian((g) => ({ ...g, agree: !g.agree }))}>
                <Check on={guardian.agree} /> <span style={{ color: 'var(--ink)' }}><b style={{ color: 'var(--brand)', marginRight: 4 }}>(필수)</b>보호자가 가입·개인정보 수집에 동의합니다</span>
              </button>
            </div>
          )}

          <div style={{ width: '100%', marginTop: 22 }}>
            <button style={agreeAll} onClick={toggleAll}><Check on={allChecked} big /> 전체 동의</button>
            <div style={agreeBox}>
              {AGREE.map((a) => (
                <button key={a.id} style={agreeRow} onClick={() => toggle(a.id)}>
                  <Check on={!!agree[a.id]} />
                  <span style={{ color: a.req ? 'var(--ink)' : 'var(--ink2)' }}>
                    <b style={{ color: a.req ? 'var(--brand)' : 'var(--ink3, #8A8FA8)', fontWeight: 800, marginRight: 4 }}>{a.req ? '(필수)' : '(선택)'}</b>{a.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button style={{ ...primary, marginTop: 22, ...(allReqOk ? {} : dim) }} onClick={() => allReqOk && setStep('welcome')}>가입하기</button>
        </div>
      </div>
    );
  }

  // ===== 5) 환영 =====
  return (
    <div style={page}>
      <div style={card}>
        <div style={cardEmoji}>🎉</div>
        <div style={cardTitle}>환영해요!</div>
        <div style={cardSub}>가입이 완료됐어요 · 홈으로 이동할게요</div>
        <button style={primary} onClick={() => nav('/app/demo')}>시작하기</button>
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
function Field({ label, children }) {
  return (
    <div style={{ width: '100%', marginTop: 14 }}>
      <div style={fieldLbl}>{label}</div>
      {children}
    </div>
  );
}
function Check({ on, big }) {
  const sz = big ? 22 : 20;
  return (
    <span style={{ width: sz, height: sz, borderRadius: 6, flex: 'none', display: 'grid', placeItems: 'center', fontSize: big ? 14 : 12, fontWeight: 900, color: on ? 'var(--accentInk, #fff)' : 'transparent', background: on ? 'var(--brand)' : 'transparent', border: on ? '1px solid transparent' : '1.5px solid var(--line2, #3A5180)' }}>✓</span>
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
const guest = { marginTop: 36, background: 'none', border: 'none', color: 'var(--ink3, #8A8FA8)', fontSize: 14, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 4, cursor: 'pointer' };

const card = { width: '100%', maxWidth: 340, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '30px 24px', textAlign: 'center', boxShadow: '0 16px 40px rgba(0,0,0,0.4)' };
const cardEmoji = { fontSize: 40, marginBottom: 8 };
const cardTitle = { fontSize: 19, fontWeight: 800, color: 'var(--ink)' };
const cardSub = { fontSize: 13.5, color: 'var(--ink2)', marginTop: 8, lineHeight: 1.6 };
const primary = { width: '100%', marginTop: 22, background: 'var(--brand)', color: 'var(--accentInk, #fff)', border: 0, borderRadius: 13, padding: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' };
const dim = { opacity: 0.45, pointerEvents: 'none' };
const fieldLbl = { fontSize: 12, fontWeight: 800, color: 'var(--ink3, #8A8FA8)', marginBottom: 7, textAlign: 'left' };
const input = { width: '100%', background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 11, padding: '12px 13px', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', fontFamily: 'inherit', outline: 'none' };
const chips = { display: 'flex', flexWrap: 'wrap', gap: 8 };
const chip = { fontSize: 13, fontWeight: 700, padding: '9px 13px', borderRadius: 11, border: '1.5px solid var(--line2, #3A5180)', color: 'var(--ink2)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit' };
const chipOn = { background: 'var(--brand)', color: 'var(--accentInk, #fff)', borderColor: 'transparent' };
const agreeAll = { display: 'flex', alignItems: 'center', gap: 9, width: '100%', background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 11, padding: '12px 13px', fontSize: 14, fontWeight: 800, color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit' };
const agreeBox = { marginTop: 8, display: 'flex', flexDirection: 'column' };
const agreeRow = { display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 0, padding: '9px 2px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' };
const guardianBox = { width: '100%', marginTop: 12, background: 'color-mix(in srgb, var(--brand) 8%, var(--surface))', border: '1px solid color-mix(in srgb, var(--brand) 30%, var(--line))', borderRadius: 13, padding: 14, boxSizing: 'border-box' };
