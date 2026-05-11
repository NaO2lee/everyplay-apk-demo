/**
 * 관리자 — 참가자 CSV 일괄 업로드 (v3.3 R1).
 * /admin-csv?event=<event_id>
 *
 * 백엔드: POST /api/v1/participants/bulk (이미 존재)
 * 한글 헤더 자동 매핑: 이름/연락처/소속/종별 → name/phone/team/category
 */
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const SEED_EVENT_ID = 'f1c1ccee-071b-40b7-834b-00ff669620cc';

const SAMPLE_CSV = `이름,연락처,소속,종별
홍길동,010-1234-5678,서울 점프스카이,12세 남자
김영희,010-9876-5432,부산 줄넘기클럽,12세 여자
Tom Smith,+1-555-0001,USA Jump Team,14 Boys USA`;

export default function AdminCsvUpload() {
  const [params, setParams] = useSearchParams();
  const eventId = params.get('event') || SEED_EVENT_ID;
  const [eventInput, setEventInput] = useState(eventId);
  const [token, setToken] = useState(localStorage.getItem('adminToken') || localStorage.getItem('dev_admin_token') || '');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const grantDevToken = async () => {
    const r = await fetch('/api/v1/auth/dev-grant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', user_id: 'dev-admin-1' }),
    });
    const j = await r.json();
    if (j.success) { localStorage.setItem('dev_admin_token', j.data.token); setToken(j.data.token); }
  };

  const upload = async () => {
    if (!file) return;
    setLoading(true); setError(null); setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(`/api/v1/participants/bulk?event_id=${eventId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = await r.json();
      if (j.success) setResult(j.data);
      else setError(j.detail || '업로드 실패');
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sample_participants.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (!token) {
    return (
      <Wrap>
        <h1 style={h1}>📥 참가자 CSV 업로드</h1>
        <button onClick={grantDevToken} style={btn('#dc2626')}>임시 admin 토큰 (DEV)</button>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <h1 style={h1}>📥 참가자 CSV 일괄 업로드</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={eventInput} onChange={(e) => setEventInput(e.target.value)} style={inp} placeholder="event_id" />
        <button onClick={() => setParams({ event: eventInput })} style={btn('#475569')}>이벤트 변경</button>
      </div>

      <Card title="📋 CSV 형식 안내">
        <p style={{ fontSize: 13, marginBottom: 8 }}>
          한글 헤더 또는 영문 헤더 모두 지원. 자동 매핑:
        </p>
        <table style={{ fontSize: 12, marginBottom: 12 }}>
          <thead><tr><th style={th}>한글</th><th style={th}>영문</th><th style={th}>필수</th></tr></thead>
          <tbody>
            <tr><td style={td}>이름</td><td style={td}>name</td><td style={td}>✓</td></tr>
            <tr><td style={td}>연락처</td><td style={td}>phone</td><td style={td}>✓</td></tr>
            <tr><td style={td}>소속</td><td style={td}>team</td><td style={td}>—</td></tr>
            <tr><td style={td}>종별</td><td style={td}>category</td><td style={td}>—</td></tr>
          </tbody>
        </table>
        <button onClick={downloadSample} style={{ ...btn('#16a34a'), padding: '6px 12px', fontSize: 12 }}>📥 sample_participants.csv 다운로드</button>
      </Card>

      <Card title="업로드">
        <input ref={fileInputRef} type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0] || null)} style={{ marginBottom: 10 }} />
        {file && <p style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>선택: {file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
        <button onClick={upload} disabled={!file || loading} style={btn('#2563eb')}>
          {loading ? '업로드 중...' : '⬆ 업로드'}
        </button>
      </Card>

      {error && <div style={errBox}>{error}</div>}

      {result && (
        <Card title="✓ 결과" accent="#16a34a">
          <p style={{ fontSize: 14, fontWeight: 700 }}>
            <span style={{ color: '#16a34a' }}>{result.imported}명 등록</span>
            {result.failed > 0 && <span style={{ color: '#dc2626', marginLeft: 12 }}>{result.failed}건 실패</span>}
          </p>
          {result.errors && result.errors.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>실패 상세</summary>
              <pre style={{ fontSize: 11, background: '#fee2e2', padding: 8, borderRadius: 4, marginTop: 6, overflow: 'auto' }}>
                {JSON.stringify(result.errors, null, 2)}
              </pre>
            </details>
          )}
        </Card>
      )}

      <p style={{ marginTop: 16, fontSize: 12, color: '#94a3b8' }}>
        ※ 등록 후 <code>/admin-courts</code>에서 코트 설정 → 히트 편성은 별도 (Phase 6에서 자동화).
      </p>
    </Wrap>
  );
}

function Card({ title, children, accent }) {
  return (
    <section style={{ background: 'white', border: '1px solid #e2e8f0', borderLeft: `4px solid ${accent || '#2563eb'}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: accent }}>{title}</h2>
      {children}
    </section>
  );
}

function Wrap({ children }) {
  return <div style={{ maxWidth: 720, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>{children}</div>;
}
const h1 = { fontSize: 22, fontWeight: 800, marginBottom: 12 };
const inp = { flex: 1, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' };
const errBox = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 };
const btn = (color) => ({ padding: '10px 16px', background: color, color: 'white', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 });
const th = { padding: '4px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'left' };
const td = { padding: '4px 8px', borderBottom: '1px dashed #f1f5f9' };
