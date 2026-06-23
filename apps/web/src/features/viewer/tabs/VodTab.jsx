import { useState } from 'react';
import styles from '../ViewerApp.module.css';
import { VOD_GROUPS, VOD_FILTERS } from '../data/mockData';

/* 대회 영상 탭 — 내 선수(팔로우) 영상 상단 우선 + 검색 + 필터(아코디언→조회). 로딩=위플레이 로고.
   영상 선택 시 어느 대회 기록인지 표시. TODO(backend): GET /public/events/{code}/clips, GET /me/follows */
const dayLabel = (g) => `${g.date}${g.day ? ` (${g.day})` : ''}`;
const MY_PLAYERS = ['김서연']; // 내가 참가/팔로우한 선수 (TODO: /me/follows)
const isMine = (c) => MY_PLAYERS.some((p) => c.who.includes(p));

export function VodTab() {
  const [open, setOpen] = useState(false);     // 필터 아코디언
  const [loading, setLoading] = useState(false);
  // 아코디언에서 고르는 값(pending) → 조회 시 적용(applied)
  const [pDay, setPDay] = useState('전체');
  const [pFilter, setPFilter] = useState('전체');
  const [q, setQ] = useState('');
  const [ap, setAp] = useState({ day: '전체', filter: '전체', q: '' });
  const [play, setPlay] = useState(null);

  const runSearch = () => {
    setLoading(true);
    setOpen(false);
    setTimeout(() => { setAp({ day: pDay, filter: pFilter, q: q.trim().toLowerCase() }); setLoading(false); }, 700);
  };

  const matchFilter = (c) => ap.filter === '전체' || (ap.filter === '🏅 수상' ? !!c.award : c.type === ap.filter);
  const matchSearch = (c) => !ap.q || `${c.who} ${c.court}`.toLowerCase().includes(ap.q);

  const groups = VOD_GROUPS
    .filter((g) => ap.day === '전체' || g.id === ap.day)
    .map((g) => ({ ...g, clips: g.clips.filter((c) => matchFilter(c) && matchSearch(c)) }))
    .filter((g) => g.clips.length > 0);

  // 내 선수(팔로우) 영상 — 적용 필터 안에서 상단 우선
  const mineClips = groups.flatMap((g) => g.clips.filter(isMine).map((c) => ({ ...c, comp: g.comp, dayLabel: dayLabel(g) })));
  const activeFilters = (ap.day !== '전체' ? 1 : 0) + (ap.filter !== '전체' ? 1 : 0) + (ap.q ? 1 : 0);

  return (
    <div className={styles.pageFade}>
      <div className={styles.sec} style={{ marginTop: 8 }}>
        <h2 className={styles.secTitle}>대회 영상</h2>
        <span className={styles.cnt}>지난 경기 다시보기</span>
      </div>

      {/* 검색 + 검색버튼 */}
      <div className={styles.vodSearchRow}>
        <input className={styles.vodSearchIn} value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 선수 이름 · 코트 · HIT 검색"
          onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }} />
        <button className={styles.vodSearchBtn} onClick={runSearch}>검색</button>
      </div>

      {/* 필터 아코디언 → 조회 */}
      <button className={styles.vodFilterToggle} onClick={() => setOpen((v) => !v)}>
        🧰 필터 {activeFilters > 0 && <span className={styles.vodFilterBadge}>{activeFilters}</span>}
        <span className={styles.histChev}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className={styles.vodAccordion}>
          <div className={styles.vodFLabel}>대회 · 일차</div>
          <div className={styles.filterbar}>
            <button className={`${styles.fchip} ${pDay === '전체' ? styles.fchipOn : ''}`} onClick={() => setPDay('전체')}>전체</button>
            {VOD_GROUPS.map((g) => (
              <button key={g.id} className={`${styles.fchip} ${pDay === g.id ? styles.fchipOn : ''}`} onClick={() => setPDay(g.id)}>{dayLabel(g)}</button>
            ))}
          </div>
          <div className={styles.vodFLabel} style={{ marginTop: 10 }}>종목 · 수상</div>
          <div className={styles.filterbar}>
            {VOD_FILTERS.map((f) => (
              <button key={f} className={`${styles.fchip} ${pFilter === f ? styles.fchipOn : ''}`} onClick={() => setPFilter(f)}>{f}</button>
            ))}
          </div>
          <button className={styles.vodApplyBtn} onClick={runSearch}>조회하기</button>
        </div>
      )}

      {/* 로딩 — 위플레이 로고 */}
      {loading ? (
        <div className={styles.vodLoading}>
          <img src="/brand/weplay-icon.png" alt="" className={styles.vodLoadingLogo} />
          <div className={styles.vodLoadingT}>영상 불러오는 중…</div>
        </div>
      ) : (
        <>
          {/* ⭐ 내 선수(팔로우) 영상 — 상단 우선 */}
          {mineClips.length > 0 && (
            <>
              <div className={styles.vodGroupHd}><div className={styles.vodComp} style={{ color: 'var(--butter)' }}>⭐ 내 선수 · 팔로우 영상</div><div className={styles.vodDate}>참가/팔로우한 선수 {mineClips.length}개</div></div>
              {mineClips.map((c) => (
                <button key={`mine-${c.id}`} className={`${styles.vod} ${styles.vodMine}`} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setPlay(c)}>
                  <div className={styles.vthumb}>▶<span className={styles.dur}>{c.dur}</span></div>
                  <div>
                    <div className={styles.vt}>{c.court}{c.award && <span className={styles.vAward}>{c.award}</span>}</div>
                    <div className={styles.vs}>⭐ {c.who}</div>
                    <div><span className={styles.vtag}>{c.type}</span><span className={styles.vtag} style={{ marginLeft: 6 }}>{c.comp}</span></div>
                  </div>
                </button>
              ))}
            </>
          )}

          {groups.length === 0 ? (
            <div className={styles.vEmpty}>검색 결과가 없어요</div>
          ) : groups.map((g) => (
            <div key={g.id}>
              <div className={styles.vodGroupHd}>
                <div className={styles.vodComp}>{g.comp}</div>
                <div className={styles.vodDate}>{dayLabel(g)} · 영상 {g.clips.length}개</div>
              </div>
              {g.clips.map((c) => (
                <button key={c.id} className={styles.vod} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
                  onClick={() => setPlay({ ...c, comp: g.comp, dayLabel: dayLabel(g) })}>
                  <div className={styles.vthumb}>▶<span className={styles.dur}>{c.dur}</span></div>
                  <div>
                    <div className={styles.vt}>{c.court}{c.award && <span className={styles.vAward}>{c.award}</span>}</div>
                    <div className={styles.vs}>{c.who}</div>
                    <div>
                      <span className={styles.vtag}>{c.type}</span>
                      {c.award && <span className={styles.vtag} style={{ marginLeft: 6, color: 'var(--butter)', background: 'color-mix(in srgb,var(--butter) 16%,transparent)' }}>🏅 수상</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </>
      )}

      {/* 영상 재생 — 어느 대회 기록인지 함께 */}
      {play && (
        <>
          <div className={`${styles.dim} ${styles.dimOn}`} onClick={() => setPlay(null)} />
          <div className={`${styles.sheet} ${styles.sheetOn}`}>
            <button className={styles.grab} onClick={() => setPlay(null)} aria-label="닫기" />
            <div className={styles.svid}><div className={styles.svidPl}>▶ 영상 재생 (데모)</div></div>
            <div className={styles.scont}>
              <div className={styles.vodPlayComp}>🏆 {play.comp} · {play.dayLabel}</div>
              <div className={styles.vodPlayTitle}>{play.court}{play.award && <span className={styles.vAward}>{play.award}</span>}</div>
              <div className={styles.vodPlayWho}>{play.who}</div>
              <div className={styles.chips} style={{ marginTop: 12 }}>
                <span className={styles.chip}>{play.type}</span>
                <span className={styles.chip}>⏱ {play.dur}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default VodTab;
