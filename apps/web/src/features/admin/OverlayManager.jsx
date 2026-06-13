import { useRef, useState } from 'react';
import styles from './AdminConsole.module.css';
import { AdminLayout } from './AdminLayout';

/* 광고/오버레이 관리 (데모) — /console/overlay.
   미리보기 + 위치(9분할) 지정 + 다중 광고(이미지/로고/스크롤 티커/영상) + 휴식 플레이리스트(BGM·반복) + 저장.
   실제로는 OBS 오버레이 소스 + 휴식 시퀀스 송출과 연결 예정(저장 → 백엔드). */

const TYPE_META = {
  image: { ic: '🖼️', label: '이미지 배너' },
  logo: { ic: '🏅', label: '로고' },
  ticker: { ic: '📜', label: '스크롤 티커' },
  video: { ic: '🎬', label: '광고 영상' },
};

const POS_GRID = [
  ['tl', '좌상'], ['tc', '상단'], ['tr', '우상'],
  ['ml', '좌측'], ['cc', '중앙'], ['mr', '우측'],
  ['bl', '좌하'], ['bc', '하단'], ['br', '우하'],
];
const POS_STYLE = {
  tl: { top: '8%', left: '4%' }, tc: { top: '8%', left: '50%', transform: 'translateX(-50%)' }, tr: { top: '8%', right: '4%' },
  ml: { top: '46%', left: '4%', transform: 'translateY(-50%)' }, cc: { top: '46%', left: '50%', transform: 'translate(-50%,-50%)' }, mr: { top: '46%', right: '4%', transform: 'translateY(-50%)' },
  bl: { bottom: '16%', left: '4%' }, bc: { bottom: '16%', left: '50%', transform: 'translateX(-50%)' }, br: { bottom: '16%', right: '4%' },
};

const INITIAL = [
  { id: 'o1', type: 'logo', label: 'KRSA 로고', pos: 'tl', content: '/brand/krsa-logo.jpg', size: 'S', enabled: true },
  { id: 'o2', type: 'ticker', label: '스폰서 문구', pos: 'bc', content: '🎉 NARIA 줄넘기 20% 할인 · 대한민국줄넘기협회(KRSA) 공식 후원 · 다음 경기 잠시 후 시작합니다 🎉', enabled: true },
  { id: 'o3', type: 'image', label: 'NARIA 배너', pos: 'br', content: null, size: 'M', enabled: true },
  { id: 'o4', type: 'video', label: '휴식 광고 영상', pos: 'full', content: '', enabled: false },
];
const SIZE_PX = { S: 26, M: 40, L: 64 };

export function OverlayManager() {
  const [overlays, setOverlays] = useState(INITIAL);
  const [selId, setSelId] = useState('o2');
  const [bgm, setBgm] = useState('차분한 BGM');
  const [bgmFile, setBgmFile] = useState(null);
  const [loop, setLoop] = useState(true);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);
  const bgmRef = useRef(null);
  const onPickBgm = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBgmFile(f.name); setBgm('직접 업로드'); setSaved(false);
  };

  const sel = overlays.find((o) => o.id === selId);
  const patch = (id, p) => { setOverlays((os) => os.map((o) => (o.id === id ? { ...o, ...p } : o))); setSaved(false); };
  const addOverlay = () => {
    const id = `o${Date.now()}`;
    setOverlays((os) => [...os, { id, type: 'image', label: '새 광고', pos: 'br', content: null, enabled: true }]);
    setSelId(id); setSaved(false);
  };
  const del = (id) => { setOverlays((os) => os.filter((o) => o.id !== id)); if (selId === id) setSelId(null); setSaved(false); };
  const onPick = (e) => {
    const f = e.target.files?.[0]; if (!f || !sel) return;
    const r = new FileReader(); r.onload = () => patch(sel.id, { content: r.result }); r.readAsDataURL(f);
  };

  return (
    <AdminLayout active="overlay">
      <div className={styles.pageHead}>
        <div className={styles.pageHeadMain}>
          <h1>📢 광고 · 오버레이 관리</h1>
          <p>화면 위 광고/로고/티커 위치를 잡고, 휴식 시간에 돌아갈 광고를 구성하세요.</p>
        </div>
        <div className={styles.pageActs}>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={addOverlay}>＋ 오버레이 추가</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setSaved(true)}>{saved ? '✓ 저장됨' : '💾 저장'}</button>
        </div>
      </div>

      <div className={styles.ovTop}>
        {/* 미리보기 */}
        <div className={styles.ovStage}>
          <span className={styles.ovStageHint}>중계 화면 미리보기</span>
          {overlays.filter((o) => o.enabled).map((o) => {
            if (o.type === 'ticker') {
              return <div key={o.id} className={`${styles.ovTicker} ${o.id === selId ? styles.ovItemSel : ''}`} onClick={() => setSelId(o.id)}><span className={styles.ovTickerInner}>{o.content}</span></div>;
            }
            if (o.type === 'video' || o.pos === 'full') {
              return <div key={o.id} className={`${styles.ovFull} ${o.id === selId ? styles.ovItemSel : ''}`} onClick={() => setSelId(o.id)}>🎬 {o.label} (전체 광고)</div>;
            }
            return (
              <div key={o.id} className={`${styles.ovItem} ${o.id === selId ? styles.ovItemSel : ''}`} style={POS_STYLE[o.pos]} onClick={() => setSelId(o.id)}>
                {o.content && (o.type === 'logo' || o.type === 'image')
                  ? <img src={o.content} alt={o.label} style={{ height: SIZE_PX[o.size] || 40, display: 'block' }} />
                  : <>{TYPE_META[o.type].ic} {o.label}</>}
              </div>
            );
          })}
        </div>

        {/* 오버레이 목록 */}
        <div className={styles.ovList}>
          {overlays.map((o) => (
            <div key={o.id} className={`${styles.ovRow} ${o.id === selId ? styles.ovRowSel : ''}`} onClick={() => setSelId(o.id)}>
              <span className={styles.ovIcon}>{TYPE_META[o.type].ic}</span>
              <div style={{ minWidth: 0 }}>
                <div className={styles.ovName}>{o.label}</div>
                <div className={styles.ovMeta}>{TYPE_META[o.type].label} · {o.enabled ? '표시' : '숨김'}</div>
              </div>
              <span className={`${styles.chk} ${o.enabled ? styles.chkOn : ''}`} style={{ marginLeft: 'auto' }} onClick={(e) => { e.stopPropagation(); patch(o.id, { enabled: !o.enabled }); }}>
                <span className={styles.chkBox}>✓</span>
              </span>
              <button className={styles.ovDel} onClick={(e) => { e.stopPropagation(); del(o.id); }} aria-label="삭제">🗑️</button>
            </div>
          ))}
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={addOverlay} style={{ justifyContent: 'center' }}>＋ 오버레이 추가</button>
        </div>
      </div>

      {/* 편집 */}
      {sel && (
        <section className={styles.block}>
          <div className={styles.bt} style={{ '--c': 'var(--cyan)' }}><span className={styles.btIco}>✏️</span> "{sel.label}" 편집</div>

          <div className={styles.fld}>
            <label className={styles.fldL}>종류</label>
            <span className={styles.seg2}>
              {Object.keys(TYPE_META).map((t) => (
                <button key={t} className={sel.type === t ? styles.on : ''} onClick={() => patch(sel.id, { type: t })}>{TYPE_META[t].ic} {TYPE_META[t].label}</button>
              ))}
            </span>
          </div>

          <div className={styles.fld}>
            <label className={styles.fldL}>이름</label>
            <input className={styles.fldIn} value={sel.label} onChange={(e) => patch(sel.id, { label: e.target.value })} />
          </div>

          {sel.type === 'ticker' && (
            <div className={styles.fld}>
              <label className={styles.fldL}>티커 문구 (스크롤)</label>
              <input className={styles.fldIn} value={sel.content || ''} onChange={(e) => patch(sel.id, { content: e.target.value })} placeholder="예: NARIA 줄넘기 공식 후원 · 다음 경기 잠시 후 시작" />
            </div>
          )}
          {sel.type === 'video' && (
            <div className={styles.fld}>
              <label className={styles.fldL}>영상 URL (YouTube/mp4)</label>
              <input className={styles.fldIn} value={sel.content || ''} onChange={(e) => patch(sel.id, { content: e.target.value })} placeholder="https://youtu.be/…" />
            </div>
          )}
          {(sel.type === 'image' || sel.type === 'logo') && (
            <div className={styles.fld}>
              <label className={styles.fldL}>이미지</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {sel.content ? <img src={sel.content} alt="" className={styles.brkThumb} /> : <span className={styles.brkThumbEmpty}>🖼️</span>}
                <button className={styles.brkUp} onClick={() => fileRef.current?.click()}>이미지 업로드</button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
              </div>
            </div>
          )}

          {(sel.type === 'image' || sel.type === 'logo') && (
            <div className={styles.fld}>
              <label className={styles.fldL}>크기</label>
              <span className={styles.seg2}>
                {['S', 'M', 'L'].map((s) => (
                  <button key={s} className={sel.size === s ? styles.on : ''} onClick={() => patch(sel.id, { size: s })}>{s === 'S' ? '작게' : s === 'M' ? '보통' : '크게'}</button>
                ))}
              </span>
            </div>
          )}

          {sel.type !== 'ticker' && sel.type !== 'video' && (
            <div className={styles.fld}>
              <label className={styles.fldL}>위치</label>
              <div className={styles.posGrid}>
                {POS_GRID.map(([k, l]) => (
                  <div key={k} className={`${styles.posCell} ${sel.pos === k ? styles.posCellOn : ''}`} onClick={() => patch(sel.id, { pos: k })}>{l}</div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 휴식 플레이리스트 */}
      <section className={styles.block}>
        <div className={styles.bt} style={{ '--c': 'var(--butter)' }}><span className={styles.btIco}>🟧</span> 휴식 시간 광고 플레이리스트</div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: '-6px 0 12px' }}>회차 사이 휴식 때 위 광고들을 순서대로 반복 송출해요. (야구 중계 회차 휴식처럼)</p>
        <div className={styles.swBar} style={{ marginBottom: 0 }}>
          <span className={styles.swLbl}>배경음악</span>
          <span className={styles.seg2}>
            {['차분한 BGM', '경쾌한 BGM', '없음'].map((m) => (
              <button key={m} className={bgm === m ? styles.on : ''} onClick={() => { setBgm(m); setBgmFile(null); }}>{m}</button>
            ))}
          </span>
          <button className={`${styles.brkUp} ${bgm === '직접 업로드' ? styles.posCellOn : ''}`} onClick={() => bgmRef.current?.click()}>🎵 {bgmFile ? bgmFile : 'BGM 업로드'}</button>
          <input ref={bgmRef} type="file" accept="audio/*" hidden onChange={onPickBgm} />
          <span className={`${styles.chk} ${loop ? styles.chkOn : ''}`} style={{ marginLeft: 8 }} onClick={() => setLoop((v) => !v)}><span className={styles.chkBox}>✓</span> 🔁 반복재생</span>
          <span className={styles.swSpacer} />
          <span className={styles.swLbl}>송출 광고 {overlays.filter((o) => o.enabled).length}개</span>
        </div>
      </section>
    </AdminLayout>
  );
}

export default OverlayManager;
