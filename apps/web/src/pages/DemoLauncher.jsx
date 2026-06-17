import { Link, Navigate } from 'react-router-dom';

// 앱 시안 데모 런처 — APK가 켜지면 여기로 진입.
// 백엔드 없이 볼 수 있게, 우리가 만든 화면들을 한곳에 모아 바로 들어가 보게 함.
// (이 파일은 데모 빌드(apk-demo 브랜치)에서 '/' 진입점으로 씀. 실제 앱은 Home.)

const C = {
  bg: '#0A1220', card: '#111B30', card2: '#192541', line: '#243152',
  ink: '#E8EDF7', ink2: '#A4AEC8', ink3: '#6C7796',
  cyan: '#33D6D6', blue: '#5BA8FF', purple: '#B49CFF',
};

const GROUPS = [
  {
    title: '사용자 앱', desc: '관람객이 쓰는 모바일 앱',
    items: [
      { to: '/intro/demo', emoji: '🎬', label: '앱 시작 인트로', desc: '로고 리빌 + 줄넘기 줄 교차 애니메이션', isNew: true },
      { to: '/app/demo', emoji: '🏠', label: '홈 (첫 화면)', desc: '진행/예정 대회 + 명장면 + 광고' },
      { to: '/app/demo?tab=live', emoji: '📺', label: '중계 (라이브)', desc: '코트별 라이브 그리드' },
      { to: '/app/demo?tab=cal', emoji: '📅', label: '대회 일정', desc: '월별·상태별 대회 캘린더' },
      { to: '/app/demo?tab=vod', emoji: '🎞️', label: '기록 영상 (VOD)', desc: '지난 경기 다시보기' },
      { to: '/app/demo?tab=my', emoji: '👤', label: 'MY (개인 화면)', desc: '내 기록 주식차트·프로필' },
      { to: '/ranking/demo', emoji: '🏆', label: '선수 랭킹 보드', desc: '종목·부별 포인트 랭킹 + 포디움', isNew: true },
      { to: '/player/demo', emoji: '🧍', label: '선수 프로필', desc: '등급·성적·출전영상·팔로우', isNew: true },
      { to: '/community/demo', emoji: '💬', label: '커뮤니티', desc: '자유·팁·후기·장터 게시판', isNew: true },
      { to: '/superchat/demo', emoji: '💎', label: '슈퍼챗 / 후원', desc: '라이브 중 금액별 응원·후원', isNew: true },
      { to: '/competition/demo', emoji: '📋', label: '대회 상세 / 게시판', desc: '요강·계좌·조편성·시상' },
      { to: '/apply/demo', emoji: '📝', label: '접수 신청 (개인·토스식)', desc: '단계형 신청 + 상태 추적' },
      { to: '/apply/group/demo', emoji: '👥', label: '단체·코치 일괄 신청', desc: '명단 추가(직접/엑셀/저장명단)' },
      { to: '/signup', emoji: '🔑', label: '로그인 / 회원가입', desc: '소셜 로그인(구글·네이버·카카오)' },
      { to: '/alarm/demo', emoji: '🔔', label: '알림 설정', desc: '알림 받을 선수·종류·방해금지' },
      { to: '/settings/demo', emoji: '⚙️', label: '설정', desc: '테마(다크/라이트/시스템)·약관' },
    ],
  },
  {
    title: '운영 · 관리자', desc: '대회 운영진 PC 화면',
    items: [
      { to: '/console', emoji: '📊', label: '관리자 대시보드', desc: 'KPI·대회 목록 콘솔' },
      { to: '/console/event', emoji: '🗂️', label: '대회 상세 콘솔', desc: '코트 현황·히트' },
      { to: '/console/broadcast', emoji: '🎥', label: '중계 송출', desc: '코트별 송출 카드' },
      { to: '/judge-app', emoji: '✍️', label: '심판 채점', desc: '횟수·점수 입력' },
      { to: '/operate-app', emoji: '📣', label: 'AI 음성 호명', desc: '선수 호명 방송' },
      { to: '/scoreboard-demo', emoji: '🖥️', label: '전광판', desc: 'TV 표시 화면' },
      { to: '/console/awards', emoji: '🥇', label: '시상', desc: '포디움 1·2·3위' },
      { to: '/sponsors', emoji: '📢', label: '광고 · 후원사 (관객용)', desc: '관객이 보는 광고 화면' },
      { to: '/console/sponsors', emoji: '🤝', label: '후원사·광고 관리', desc: '홈 노출 후원사·광고 관리(운영)' },
    ],
  },
];

const TODO = [];

export default function DemoLauncher() {
  // 폰(Capacitor 네이티브 앱)에선 데모 런처·관리자/PC 화면을 숨기고 바로 인트로 → 앱으로.
  // PC 브라우저(localhost:4190/)에선 기존처럼 전체 화면 런처를 보여줌 (리뷰용).
  const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
  if (isNative) return <Navigate to="/intro/demo" replace />;

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.ink, fontFamily: "'Pretendard', -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif", backgroundImage: 'radial-gradient(900px 500px at 80% -10%, rgba(91,168,255,0.14), transparent 60%)' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '28px 18px 48px' }}>
        {/* 헤더 */}
        <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: C.cyan }}>WEPLAY · 모두의플레이</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>앱 시안 데모</h1>
        <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.6, marginTop: 8 }}>
          우리가 만든 화면들을 한곳에 모았어요. 백엔드 연결 전이라 <b style={{ color: C.ink }}>데이터는 목업(예시)</b>으로 보여요.
          아래에서 보고 싶은 화면을 탭하세요.
        </p>

        {GROUPS.map(g => (
          <section key={g.title} style={{ marginTop: 26 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{g.title}</h2>
              <span style={{ fontSize: 12, color: C.ink3 }}>{g.desc}</span>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {g.items.map(it => (
                <Link key={it.to} to={it.to} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: C.card, border: `1px solid ${C.line}`, borderRadius: 14 }}>
                    <span style={{ width: 42, height: 42, borderRadius: 11, background: C.card2, display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0 }}>{it.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7 }}>
                        {it.label}
                        {it.isNew && <span style={{ fontSize: 9.5, fontWeight: 800, color: C.bg, background: 'linear-gradient(135deg,#33D6D6,#5BA8FF 55%,#B49CFF)', padding: '2px 6px', borderRadius: 6, letterSpacing: '0.04em' }}>NEW</span>}
                      </div>
                      <div style={{ fontSize: 12, color: C.ink3, marginTop: 1 }}>{it.desc}</div>
                    </div>
                    <span style={{ color: C.blue, fontSize: 20, flexShrink: 0 }}>›</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {/* 미제작 */}
        {TODO.length > 0 && (
          <section style={{ marginTop: 26 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 12px' }}>아직 안 만든 화면</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TODO.map(t => (
                <span key={t} style={{ fontSize: 13, fontWeight: 700, color: C.ink3, background: C.card, border: `1px dashed ${C.line}`, borderRadius: 999, padding: '7px 14px' }}>{t} (예정)</span>
              ))}
            </div>
          </section>
        )}

        <div style={{ marginTop: 32, fontSize: 11, color: C.ink3, textAlign: 'center', lineHeight: 1.6 }}>
          데모 빌드 · 백엔드 미연결<br />각 화면에서 뒤로가기는 폰의 뒤로 제스처를 쓰세요
        </div>
      </div>
    </div>
  );
}
