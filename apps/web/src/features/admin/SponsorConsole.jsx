import { useState } from 'react';
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import styles from './AdminConsole.module.css';

/* 후원사·광고 관리 (데모) — /console/sponsors
   앱 홈에 노출되는 "공식 후원·협찬" + "광고 배너"를 관리.
   TODO(backend): GET/POST/PATCH/DELETE /sponsors, /home-ads (노출 on/off, 순서, 이미지 업로드). */

const GRADES = ['주관', '주최', '협찬', '골드', '실버'];
const SP0 = [
  { id: 's1', name: '대한민국줄넘기협회', grade: '주관', logo: '/brand/krsa-logo-white.png', on: true },
  { id: 's2', name: 'WEPLAY', grade: '주최', logo: '/brand/weplay-wordmark-white.png', on: true },
  { id: 's3', name: 'NARIA 스탠와이어', grade: '협찬', logo: null, on: true },
  { id: 's4', name: '점프스포츠', grade: '골드', logo: null, on: false },
];
const AD0 = [
  { id: 'a1', title: 'NARIA 스탠와이어 — 대회 공식 줄넘기', pos: '홈 상단 배너', on: true },
  { id: 'a2', title: '여름 줄넘기 캠프 모집', pos: '홈 중간 배너', on: false },
];

let _n = 0;
function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on} style={{ width: 44, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 3, background: on ? 'var(--blue)' : 'var(--line-2)', flexShrink: 0 }}>
      <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(18px)' : 'translateX(0)', transition: 'transform .15s' }} />
    </button>
  );
}

export default function SponsorConsole() {
  const [sp, setSp] = useState(SP0);
  const [ads, setAds] = useState(AD0);
  const spOn = sp.filter((s) => s.on).length;
  const adOn = ads.filter((a) => a.on).length;

  const card = { background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--card)', padding: 18, marginBottom: 22 };
  const head = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 };
  const title = { fontSize: 16, fontWeight: 800, letterSpacing: '-.01em' };
  const row = { display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderTop: '1px solid var(--line)' };

  return (
    <AdminLayout active="sponsors">
      <div style={{ padding: '22px 24px', maxWidth: 920, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>후원사 · 광고 관리</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '6px 0 22px' }}>여기서 <b style={{ color: 'var(--ink)' }}>노출 ON</b> 한 후원사·광고가 앱 홈 화면에 보여요. (순서·이미지·기간은 백엔드 연결 후)</p>

        {/* KPI */}
        <div className={styles.kpis} style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
          <div className={styles.kpi} style={{ '--c': 'var(--cyan)' }}><div className={styles.kpiLab}>🤝 후원사</div><div className={styles.kpiNum}>{spOn}<small> / {sp.length} 노출</small></div></div>
          <div className={styles.kpi} style={{ '--c': 'var(--butter)' }}><div className={styles.kpiLab}>📢 홈 광고</div><div className={styles.kpiNum}>{adOn}<small> / {ads.length} 노출</small></div></div>
        </div>

        {/* 후원사 */}
        <div style={card}>
          <div style={head}>
            <span style={title}>🤝 공식 후원·협찬</span>
            <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={() => setSp((xs) => [...xs, { id: `s${++_n}n`, name: '새 후원사', grade: '실버', logo: null, on: false }])}>
              <Plus size={14} style={{ verticalAlign: '-2px' }} /> 후원사 추가
            </button>
          </div>
          {sp.map((s, i) => (
            <div key={s.id} style={{ ...row, borderTop: i === 0 ? 'none' : row.borderTop }}>
              <span style={{ width: 58, height: 36, borderRadius: 8, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden' }}>
                {s.logo ? <img src={s.logo} alt={s.name} style={{ maxWidth: '88%', maxHeight: 22, objectFit: 'contain' }} /> : <ImageIcon size={16} style={{ color: 'var(--ink-3)' }} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input value={s.name} onChange={(e) => setSp((xs) => xs.map((x) => x.id === s.id ? { ...x, name: e.target.value } : x))}
                  style={{ background: 'transparent', border: 0, outline: 'none', color: 'var(--ink)', fontSize: 14, fontWeight: 700, width: '100%', fontFamily: 'inherit' }} />
              </div>
              <select value={s.grade} onChange={(e) => setSp((xs) => xs.map((x) => x.id === s.id ? { ...x, grade: e.target.value } : x))}
                style={{ background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit' }}>
                {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 700, width: 56, textAlign: 'right' }}>{s.on ? '노출 중' : '숨김'}</span>
              <Toggle on={s.on} onChange={(v) => setSp((xs) => xs.map((x) => x.id === s.id ? { ...x, on: v } : x))} />
              <button onClick={() => setSp((xs) => xs.filter((x) => x.id !== s.id))} style={{ background: 'none', border: 0, color: 'var(--ink-3)', cursor: 'pointer', display: 'flex', flexShrink: 0 }} aria-label="삭제"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>

        {/* 홈 광고 배너 */}
        <div style={card}>
          <div style={head}>
            <span style={title}>📢 홈 광고 배너</span>
            <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={() => setAds((xs) => [...xs, { id: `a${++_n}n`, title: '새 광고', pos: '홈 중간 배너', on: false }])}>
              <Plus size={14} style={{ verticalAlign: '-2px' }} /> 광고 추가
            </button>
          </div>
          {ads.map((a, i) => (
            <div key={a.id} style={{ ...row, borderTop: i === 0 ? 'none' : row.borderTop }}>
              <span style={{ width: 58, height: 36, borderRadius: 8, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', flexShrink: 0, color: 'var(--ink-3)', fontSize: 11, fontWeight: 800 }}>AD</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input value={a.title} onChange={(e) => setAds((xs) => xs.map((x) => x.id === a.id ? { ...x, title: e.target.value } : x))}
                  style={{ background: 'transparent', border: 0, outline: 'none', color: 'var(--ink)', fontSize: 14, fontWeight: 700, width: '100%', fontFamily: 'inherit' }} />
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{a.pos}</div>
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 700, width: 56, textAlign: 'right' }}>{a.on ? '노출 중' : '숨김'}</span>
              <Toggle on={a.on} onChange={(v) => setAds((xs) => xs.map((x) => x.id === a.id ? { ...x, on: v } : x))} />
              <button onClick={() => setAds((xs) => xs.filter((x) => x.id !== a.id))} style={{ background: 'none', border: 0, color: 'var(--ink-3)', cursor: 'pointer', display: 'flex', flexShrink: 0 }} aria-label="삭제"><Trash2 size={16} /></button>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 12, lineHeight: 1.5 }}>이미지 업로드·노출 기간·CTA 링크는 백엔드 연결 후 추가돼요. (// TODO backend)</div>
        </div>
      </div>
    </AdminLayout>
  );
}
