/**
 * 모두의 플레이 — v3.3 라우트 허브.
 * /hub
 * 역할별로 모든 라우트 그룹화. URL 외우지 않아도 됨.
 */
import { Link } from 'react-router-dom';

// device: 'pc' | 'mobile' | 'both'
const ROUTES = [
  { role: '🎛️ 관리자', color: '#e11d48', items: [
    { url: '/admin', label: '관리자 로그인 (기존)', desc: 'admin/admin', device: 'pc' },
    { url: '/admin-courts', label: '코트 동적 토글', desc: '활성/위치/표시명', device: 'pc' },
    { url: '/admin-awards', label: '시상 흐름', desc: '1·2·3위 자동 + 호명', device: 'pc' },
    { url: '/admin-heats', label: '히트 라이프사이클', desc: '시작/종료', device: 'pc' },
    { url: '/admin-csv', label: '참가자 CSV 업로드', desc: '한글 헤더 매핑', device: 'pc' },
    { url: '/admin-users', label: '사용자 관리 (CRUD)', desc: '가입자 / 역할 / 활성화', device: 'pc' },
    { url: '/admin-matrix', label: '채점 제출 매트릭스', desc: '🟢🟡🔴', device: 'pc' },
    { url: '/admin-audit', label: 'Audit 로그', desc: '모든 변경 immutable 기록', device: 'pc' },
    { url: '/admin-sponsors', label: '🎨 스폰서 / 광고', desc: '배너·CTA·이벤트 연결 (5/11)', device: 'pc' },
  ]},
  { role: '📺 운영위원/중계', color: '#2563eb', items: [
    { url: '/operate', label: '호명 큐 + AI 음성', desc: '5초 자동 갱신, 스피커 연결', device: 'pc' },
    { url: '/operate-runner', label: '🎬 자동 진행 콘솔', desc: '시작·종료 비프 + 자동 다음 heat', device: 'pc' },
  ]},
  { role: '⚖️ 심판', color: '#7c3aed', items: [
    { url: '/judge', label: '4단계 wizard 채점', desc: '한 명씩 단계별 (소규모 heat 적합)', device: 'mobile' },
    { url: '/judge-grid', label: '🔥 그리드 채점 (50명 heat)', desc: '한 화면 카드 → 탭 → 모달 빠른 입력', device: 'mobile' },
  ]},
  { role: '🏃 선수/코치', color: '#ea580c', items: [
    { url: '/me', label: '본인 PWA', desc: '결과·award·차례', device: 'mobile' },
    { url: '/signup', label: '회원가입 / 로그인', desc: '이메일+폰+국적', device: 'both' },
  ]},
  { role: '👀 관객 / 전광판', color: '#059669', items: [
    { url: '/', label: '대회 목록 (기존 홈)', desc: 'public events', device: 'both' },
    { url: '/watch', label: '라이브 관전', desc: '관객=폰, 전광판=PC', device: 'both' },
  ]},
];

const DEVICE_BADGE = {
  pc: { label: '💻 PC', color: '#0891b2', bg: '#cffafe' },
  mobile: { label: '📱 Mobile', color: '#7c3aed', bg: '#ede9fe' },
  both: { label: '💻📱 둘 다', color: '#475569', bg: '#e2e8f0' },
};

export default function Hub() {
  return (
    <div style={page}>
      <header style={hdr}>
        <h1 style={h1}>🏠 모두의 플레이 v3.3</h1>
        <p style={sub}>역할별 라우트 허브 + 권장 디바이스 (💻 PC · 📱 Mobile)</p>
      </header>

      <div style={grid}>
        {ROUTES.map((g) => (
          <section key={g.role} style={{ ...card, borderTop: `4px solid ${g.color}` }}>
            <h2 style={{ ...h2, color: g.color }}>{g.role}</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {g.items.map((it) => {
                const dev = DEVICE_BADGE[it.device] || DEVICE_BADGE.both;
                return (
                  <Link key={it.url} to={it.url} style={item(g.color)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{it.label}</span>
                      <span style={{ background: dev.bg, color: dev.color, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>{dev.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{it.desc}</div>
                    <code style={{ fontSize: 10, color: g.color, marginTop: 4, display: 'block' }}>{it.url}</code>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <footer style={ft}>
        모두의 플레이 v3.3 · 9개 신규 모델 · 8개 라우터 · 12개 라우트
      </footer>
    </div>
  );
}

const page = { background: '#f8fafc', minHeight: '100vh', padding: 20, fontFamily: 'system-ui, sans-serif' };
const hdr = { textAlign: 'center', marginBottom: 24 };
const h1 = { fontSize: 28, fontWeight: 800, marginBottom: 4 };
const sub = { color: '#94a3b8', fontSize: 13 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, maxWidth: 1100, margin: '0 auto' };
const card = { background: 'white', borderRadius: 12, padding: 18, border: '1px solid #e2e8f0' };
const h2 = { fontSize: 14, fontWeight: 800, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' };
const item = (color) => ({
  display: 'block', padding: 12, background: '#f8fafc', borderRadius: 8,
  border: '1px solid #e2e8f0', borderLeft: `3px solid ${color}`, textDecoration: 'none', color: '#0f172a',
});
const ft = { textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 11 };
