import { ChevronRight, Play, Film, Trophy } from 'lucide-react';
import { SCHEDULE, VOD_GROUPS } from '../data/mockData';

// 홈 (앱 첫 진입) — 잡지책 느낌. 차별점 = 실시간 코트 중계 + AI 자동 기록을 전면에.
// 데이터: event(현재 대회) + SCHEDULE(다가오는) + VOD_GROUPS(명장면). TODO(backend): 실제 API.

const RANKING = [
  { rank: 1, name: '김서연', club: '서울 줄넘기클럽', rec: '85회', ev: '30초 스피드' },
  { rank: 2, name: '박도윤', club: '화성 점프', rec: '83회', ev: '30초 스피드' },
  { rank: 3, name: 'Y. TANAKA', club: 'Tokyo RJ', rec: '82회', ev: '30초 스피드' },
];
// 후원사·협찬 (홈 노출) — TODO(backend): 관리자 후원사/광고 관리에서 설정한 목록
const SPONSORS = [
  { name: '대한민국줄넘기협회', tag: '주관', logo: '/brand/krsa-logo-white.png' },
  { name: 'WEPLAY', tag: '주최', logo: '/brand/weplay-wordmark-white.png' },
  { name: 'NARIA 스탠와이어', tag: '공식 줄넘기', logo: null },
];

export function HomeTab({ event, onGo }) {
  const live = event?.status === 'active';
  const courts = (event?.stations || []).length;
  const upcoming = SCHEDULE.flatMap((w) => w.items).filter((i) => i.status !== '마감').slice(0, 3);
  const highlights = (VOD_GROUPS[0]?.clips || []).concat(VOD_GROUPS[1]?.clips || []).slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 10 }}>
      {/* 1. 라이브 히어로 */}
      <button onClick={() => onGo(live ? 'live' : 'cal')} style={hero}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span style={live ? liveChip : nextChip}>
            {live ? <><i style={dot} /> 지금 생중계</> : '곧 시작'}
          </span>
          <div style={heroTitle}>{event?.name || '모두의플레이'}</div>
          <div style={heroSub}>{live ? `${courts}개 코트 실시간 중계 중 · 보고 싶은 코트를 크게` : '대회 일정 보기'}</div>
          <span style={heroCta}><Play size={15} style={{ marginRight: 6 }} /> {live ? '지금 보기' : '일정 보기'}</span>
        </div>
      </button>

      {/* 2. 후원사 / 협찬 */}
      <section>
        <Head title="공식 후원·협찬" />
        <div style={spGrid}>
          {SPONSORS.map((s) => (
            <div key={s.name} style={spCell}>
              {s.logo
                ? <img src={s.logo} alt={s.name} style={spLogo} />
                : <span style={{ fontSize: 12.5, fontWeight: 800, textAlign: 'center', color: 'var(--ink)', lineHeight: 1.3 }}>{s.name}</span>}
              <span style={spTag}>{s.tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. 광고 블럭 */}
      <div style={adBlock}>
        <span style={adTag}>AD</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>NARIA 스탠와이어 — 대회 공식 줄넘기</div>
          <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 2 }}>선수들이 쓰는 그 줄넘기, 지금 만나보기</div>
        </div>
        <span style={adCta}>보기</span>
      </div>

      {/* 4. 오늘의 명장면 */}
      <section>
        <Head title="오늘의 명장면" onMore={() => onGo('vod')} />
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {highlights.map((c) => (
            <button key={c.id} onClick={() => onGo('vod')} style={clip}>
              <div style={clipThumb}><Film size={20} style={{ opacity: 0.5 }} />{c.award && <span style={clipMedal}>{c.award}</span>}<span style={clipDur}>{c.dur}</span></div>
              <div style={clipTitle}>{c.who}</div>
              <div style={clipSub}>{c.type}</div>
            </button>
          ))}
        </div>
      </section>

      {/* 5. 다가오는 대회 */}
      <section>
        <Head title="다가오는 대회" onMore={() => onGo('cal')} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {upcoming.map((e) => (
            <button key={e.id} onClick={() => onGo('cal')} style={upCard}>
              <span style={upDate}><b style={{ fontSize: 20, color: 'var(--blue)' }}>{e.day}</b><small style={{ fontSize: 11, color: 'var(--gray)' }}>{e.dow}</small></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={upTitle}>{e.title}</div>
                <div style={upSub}>{e.sub}</div>
              </div>
              <span style={statusChip(e.status)}>{e.status}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 6. 이 주의 기록 */}
      <section>
        <Head title="이 주의 기록" icon={<Trophy size={15} style={{ color: 'var(--butter)' }} />} />
        <div style={rankCard}>
          {RANKING.map((r) => (
            <div key={r.rank} style={rankRow}>
              <span style={{ ...rankNo, ...(r.rank === 1 ? { background: 'var(--grad)', color: 'var(--accentInk)' } : {}) }}>{r.rank}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>{r.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--gray)' }}>{r.club} · {r.ev}</div>
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{r.rec}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Head({ title, onMore, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 2px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 17, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.3px' }}>{icon}{title}</div>
      {onMore && <button onClick={onMore} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: 'none', border: 0, color: 'var(--gray)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>전체 <ChevronRight size={15} /></button>}
    </div>
  );
}
function statusChip(s) {
  const base = { fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 };
  if (s === 'LIVE') return { ...base, color: 'var(--live)', background: 'color-mix(in srgb,var(--live) 18%,transparent)' };
  if (s === '임박') return { ...base, color: 'var(--live)', background: 'color-mix(in srgb,var(--live) 14%,transparent)' };
  if (s === '접수중') return { ...base, color: 'var(--mint)', background: 'color-mix(in srgb,var(--mint) 16%,transparent)' };
  if (s === '대진오픈') return { ...base, color: 'var(--blue)', background: 'color-mix(in srgb,var(--blue) 16%,transparent)' };
  return { ...base, color: 'var(--butter)', background: 'color-mix(in srgb,var(--butter) 18%,transparent)' };
}

const hero = { display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line2)', borderRadius: 22, padding: 22, color: 'var(--ink)', position: 'relative', overflow: 'hidden', background: 'radial-gradient(440px 200px at 88% -30%,rgba(91,168,255,.28),transparent 60%),var(--surface2)', boxShadow: 'var(--glow)' };
const liveChip = { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--live)', color: '#fff', fontSize: 11.5, fontWeight: 800, padding: '5px 11px', borderRadius: 999 };
const nextChip = { display: 'inline-block', background: 'var(--chipBg)', color: 'var(--chipInk)', fontSize: 11.5, fontWeight: 800, padding: '5px 11px', borderRadius: 999 };
const dot = { width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pulse 1.2s infinite', display: 'inline-block' };
const heroTitle = { fontSize: 25, fontWeight: 800, marginTop: 12, letterSpacing: '-0.6px', lineHeight: 1.2 };
const heroSub = { fontSize: 13, color: 'var(--ink2)', marginTop: 8 };
const heroCta = { display: 'inline-flex', alignItems: 'center', marginTop: 16, background: 'var(--grad)', color: 'var(--accentInk)', fontWeight: 800, fontSize: 14, padding: '10px 18px', borderRadius: 12, boxShadow: 'var(--glow)' };

const spGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 };
const spCell = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 15, padding: '16px 8px', minHeight: 76, boxShadow: 'var(--shadow)' };
const spLogo = { height: 24, width: 'auto', maxWidth: '92%', objectFit: 'contain' };
const spTag = { fontSize: 10.5, fontWeight: 700, color: 'var(--gray)' };

const adBlock = { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', border: '1px dashed var(--line2)', borderRadius: 16, padding: '13px 15px' };
const adTag = { fontSize: 10, fontWeight: 800, color: 'var(--gray)', border: '1px solid var(--line2)', borderRadius: 5, padding: '2px 6px', flexShrink: 0 };
const adCta = { fontSize: 12.5, fontWeight: 800, color: 'var(--chipInk)', background: 'var(--chipBg)', padding: '8px 14px', borderRadius: 10, flexShrink: 0 };

const clip = { flexShrink: 0, width: 150, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' };
const clipThumb = { width: 150, height: 88, borderRadius: 13, background: 'var(--thumb)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink2)', position: 'relative' };
const clipMedal = { position: 'absolute', top: 6, left: 6, fontSize: 14 };
const clipDur = { position: 'absolute', bottom: 5, right: 5, background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 5 };
const clipTitle = { fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginTop: 7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const clipSub = { fontSize: 11.5, color: 'var(--gray)', marginTop: 1 };

const upCard = { display: 'flex', alignItems: 'center', gap: 13, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px', cursor: 'pointer', boxShadow: 'var(--shadow)', textAlign: 'left' };
const upDate = { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0, lineHeight: 1.1 };
const upTitle = { fontSize: 14, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const upSub = { fontSize: 12, color: 'var(--gray)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

const rankCard = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '6px 14px', boxShadow: 'var(--shadow)' };
const rankRow = { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line)' };
const rankNo = { width: 26, height: 26, borderRadius: 8, background: 'var(--soft)', color: 'var(--ink)', fontWeight: 800, fontSize: 13, display: 'grid', placeItems: 'center', flexShrink: 0 };

export default HomeTab;
