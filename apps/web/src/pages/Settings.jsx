import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Image, ChevronLeft, ChevronRight, Bell, Palette } from 'lucide-react';
import { getThemeMode, setThemeMode } from '../lib/theme';

/* 설정 (데모) — /settings/demo
   화면 테마(다크/라이트/시스템) + 앱 권한(카메라·사진) + 약관·개인정보 + 앱 정보.
   알림 관련은 별도 알림 설정(/alarm/demo). */

const C = { bg: 'var(--bg,#070D18)', card: 'var(--surface,#13203A)', card2: 'var(--surface2,#1B2A47)', line: 'var(--line,#293B5E)', ink: 'var(--ink,#E9EEF8)', ink2: 'var(--ink2,#9FB0CC)', ink3: 'var(--ink3,#64748f)', blue: 'var(--blue,#5BA8FF)', mint: 'var(--mint,#34D4A6)', butter: 'var(--butter,#FFB648)' };

const THEMES = [['dark', '🌙 다크'], ['light', '☀️ 라이트'], ['system', '📱 시스템']];
const PERMS = [
  { key: 'cam', Icon: Camera, label: '카메라', why: '내 영상 직접 촬영·업로드 시에만', status: 'ask' },
  { key: 'photo', Icon: Image, label: '사진·저장', why: '경기 영상 저장 시에만', status: 'ask' },
];
const TERMS = ['이용약관', '개인정보 처리방침', '청소년 보호정책', '오픈소스 라이선스'];

export default function Settings() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(getThemeMode());

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.ink, fontFamily: "'Pretendard',-apple-system,sans-serif", paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 8px', position: 'sticky', top: 0, background: C.bg, zIndex: 2 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 0, color: C.ink2, cursor: 'pointer', display: 'flex' }} aria-label="뒤로"><ChevronLeft size={22} /></button>
        <span style={{ fontSize: 17, fontWeight: 800 }}>설정</span>
      </div>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '6px 16px' }}>
        {/* 화면 테마 */}
        <Sec icon={<Palette size={15} />} title="화면 테마" />
        <div style={card(true)}>
          <div style={{ display: 'flex', gap: 8 }}>
            {THEMES.map(([m, l]) => {
              const on = mode === m;
              return (
                <button key={m} onClick={() => { setMode(m); setThemeMode(m); }}
                  style={{ flex: 1, padding: '13px 0', borderRadius: 11, border: `1.5px solid ${on ? C.blue : C.line}`, background: on ? 'color-mix(in srgb,var(--blue,#5BA8FF) 14%,transparent)' : C.card2, color: on ? C.blue : C.ink2, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {l}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11.5, color: C.ink3, marginTop: 10, lineHeight: 1.5 }}>시스템 = 폰의 다크/라이트 설정을 자동으로 따라가요.</div>
        </div>

        {/* 알림 설정 진입 */}
        <Sec title="알림" />
        <button onClick={() => navigate('/alarm/demo')} style={{ ...card(), display: 'flex', alignItems: 'center', gap: 12, width: '100%', cursor: 'pointer', textAlign: 'left', padding: '15px 16px', color: C.ink }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: C.card2, display: 'grid', placeItems: 'center', color: C.blue, flexShrink: 0 }}><Bell size={17} /></span>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800 }}>알림 설정</div><div style={{ fontSize: 11.5, color: C.ink3, marginTop: 2 }}>알림 받을 선수 · 종류 · 방해금지 시간</div></div>
          <ChevronRight size={18} style={{ color: C.ink3 }} />
        </button>

        {/* 앱 권한 */}
        <Sec title="앱 권한" />
        <div style={card()}>
          {PERMS.map((p, i) => {
            const Icon = p.Icon;
            return (
              <Row key={p.key} top={i > 0}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: C.card2, display: 'grid', placeItems: 'center', color: C.blue, flexShrink: 0 }}><Icon size={17} /></span>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{p.label}</div><div style={{ fontSize: 11.5, color: C.ink3, marginTop: 2 }}>{p.why}</div></div>
                <span style={{ fontSize: 12, fontWeight: 800, padding: '5px 11px', borderRadius: 999, color: C.butter, background: 'color-mix(in srgb,var(--butter,#FFB648) 16%,transparent)' }}>요청</span>
              </Row>
            );
          })}
          <div style={{ fontSize: 11, color: C.ink3, padding: '12px 2px 4px', lineHeight: 1.5 }}>권한은 필요한 순간에만 물어봐요. 거부해도 해당 기능만 빼고 앱은 정상 사용돼요.</div>
        </div>

        {/* 약관 · 개인정보 */}
        <Sec title="약관 · 개인정보" />
        <div style={card()}>
          {TERMS.map((t, i) => (
            <Row key={t} top={i > 0}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{t}</span>
              <ChevronRight size={17} style={{ color: C.ink3 }} />
            </Row>
          ))}
        </div>

        {/* 계정 */}
        <Sec title="계정" />
        <div style={card()}>
          <Row><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>로그인 / 회원가입</span><button onClick={() => navigate('/signup')} style={{ background: 'none', border: 0, color: C.blue, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>이동 ›</button></Row>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: C.ink3, marginTop: 22 }}>모두의플레이 · v0.9 (데모)</div>
      </div>
    </div>
  );
}

function Sec({ icon, title }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '24px 2px 10px' }}>{icon}<span style={{ fontSize: 14, fontWeight: 800 }}>{title}</span></div>; }
function card(pad) { return { background: C.card, border: `1px solid ${C.line}`, borderRadius: 15, padding: pad ? 16 : '4px 16px' }; }
function Row({ children, top }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderTop: top ? `1px solid ${C.line}` : 'none' }}>{children}</div>; }
