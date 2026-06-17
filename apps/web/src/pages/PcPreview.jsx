import { useState } from 'react';

// PC에서 모바일 앱을 폰 프레임 안에 띄워 보는 미리보기 페이지.
// 버튼으로 화면을 바꾸거나, 프레임 안에서 직접 탭해 돌아다닐 수 있음. (데모 빌드용)

const C = { bg: '#070D18', card: '#111B30', line: '#243152', ink: '#E8EDF7', ink2: '#A4AEC8', ink3: '#6C7796', cyan: '#33D6D6', blue: '#5BA8FF' };

const SCREENS = [
  { label: '홈', path: '/app/demo' },
  { label: '중계', path: '/app/demo?tab=live' },
  { label: '대회일정', path: '/app/demo?tab=cal' },
  { label: '기록영상', path: '/app/demo?tab=vod' },
  { label: 'MY(기록)', path: '/app/demo?tab=my' },
  { label: '대회상세', path: '/competition/demo' },
  { label: '접수신청', path: '/apply/demo' },
  { label: '단체신청', path: '/apply/group/demo' },
  { label: '로그인', path: '/signup' },
  { label: '알림설정', path: '/alarm/demo' },
  { label: '설정', path: '/settings/demo' },
];

export default function PcPreview() {
  const [src, setSrc] = useState('/');
  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.ink, fontFamily: "'Pretendard', -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '22px 16px 36px', backgroundImage: 'radial-gradient(900px 480px at 80% -10%, rgba(91,168,255,0.12), transparent 60%)' }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: C.cyan }}>WEPLAY · 모두의플레이</div>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: '6px 0 4px', letterSpacing: '-0.02em' }}>앱 미리보기 (PC)</h1>
      <p style={{ fontSize: 13, color: C.ink2, margin: '0 0 18px', textAlign: 'center' }}>실제 폰 화면 그대로예요. 위 버튼으로 화면 이동하거나, 폰 프레임 안에서 직접 눌러도 돼요. (데이터는 목업)</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20, maxWidth: 720 }}>
        {SCREENS.map(s => {
          const active = src === s.path;
          return (
            <button key={s.path} onClick={() => setSrc(s.path)}
              style={{ padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: 'pointer',
                border: '1px solid ' + (active ? C.blue : C.line),
                background: active ? 'rgba(91,168,255,0.16)' : C.card,
                color: active ? C.blue : C.ink2 }}>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* 폰 프레임 */}
      <div style={{ width: 392, maxWidth: '94vw', height: 'min(844px, calc(100dvh - 200px))', borderRadius: 40, border: '11px solid #161C29', background: '#000', overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(91,168,255,0.15)' }}>
        <iframe key={src} src={src} title="앱 미리보기" style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: C.bg }} />
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: C.ink3 }}>데모 빌드 · 백엔드 미연결 · 관리자(PC) 화면은 /console</div>
    </div>
  );
}
