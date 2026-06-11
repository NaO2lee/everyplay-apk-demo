import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AdminConsole.module.css';
import { AdminLayout } from './AdminLayout';

/* 중계 컨트롤룸 (vMix식 멀티캠 스위처, 데모) — /console/switcher.
   코트별 멀티캠 PGM/PVW 전환 + 여러 코트 동시 제어 + 전환효과 + 휴식 이미지 일괄 송출.
   실제로는 OBS/스위처 API + WebRTC/유튜브 프리뷰와 연결 예정. */

const COURTS = [
  { n: 1, live: true, ev: '30초 스피드 · 남9', viewers: '412', cams: ['메인', '코트뷰', '클로즈업'] },
  { n: 2, live: true, ev: '개인 프리스타일 · 여12', viewers: '305', cams: ['메인', '코트뷰', '심판석'] },
  { n: 3, live: false, ev: '대기 중', viewers: '0', cams: ['메인', '코트뷰'] },
  { n: 4, live: true, ev: '2인 릴레이 · 남15', viewers: '288', cams: ['메인', '와이드', '클로즈업'] },
];
const TRANSITIONS = ['컷', '페이드', '자동'];

export function SwitcherConsole() {
  const navigate = useNavigate();
  const [trans, setTrans] = useState('페이드');
  const [auto, setAuto] = useState(true);
  const [brk, setBrk] = useState(false);
  const [pgm, setPgm] = useState({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const [pvw, setPvw] = useState({ 1: 1, 2: 1, 3: 0, 4: 1 });
  const [brkImg, setBrkImg] = useState(null);
  const [adOverlay, setAdOverlay] = useState(true);
  const [music, setMusic] = useState(true);
  const [loop, setLoop] = useState(true);
  const fileRef = useRef(null);
  const onPickImg = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setBrkImg(r.result);
    r.readAsDataURL(f);
  };

  const [focus, setFocus] = useState(1);

  const take = (n) => setPgm((p) => ({ ...p, [n]: pvw[n] }));
  const takeAll = () => setPgm((p) => { const np = { ...p }; COURTS.forEach((c) => { np[c.n] = pvw[c.n]; }); return np; });

  // 키보드 단축키 (프론트엔드) — ←→ 코트, 1/2/3 카메라, Enter 전환, T 전체, B 휴식
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      const idx = COURTS.findIndex((c) => c.n === focus);
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowRight' || e.key === ']') { e.preventDefault(); setFocus(COURTS[(idx + 1) % COURTS.length].n); }
      else if (e.key === 'ArrowLeft' || e.key === '[') { e.preventDefault(); setFocus(COURTS[(idx - 1 + COURTS.length) % COURTS.length].n); }
      else if (['1', '2', '3', '4'].includes(e.key)) { const c = COURTS.find((x) => x.n === focus); const ci = +e.key - 1; if (c && ci < c.cams.length) setPvw((p) => ({ ...p, [focus]: ci })); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); take(focus); }
      else if (k === 't') { takeAll(); }
      else if (k === 'b') { setBrk((b) => !b); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, pvw]);

  return (
    <AdminLayout active="switcher">
      <div className={styles.pageHead}>
        <div className={styles.pageHeadMain}>
          <h1>🎚️ 중계 컨트롤룸 <span className={`${styles.pill} ${styles.pillLive}`}>🔴 방송 중</span></h1>
          <p>코트별 카메라를 전환하고 여러 코트를 동시에 제어하세요. (vMix 스타일 멀티캠 스위처)</p>
        </div>
        <div className={styles.pageActs}>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => navigate('/console/broadcast')}>📡 송출 현황</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={takeAll}>⏯ 전체 전환 (TAKE ALL)</button>
        </div>
      </div>

      <div className={styles.swBar}>
        <span className={styles.swLbl}>전환 효과</span>
        <span className={styles.seg2}>
          {TRANSITIONS.map((t) => (
            <button key={t} className={trans === t ? styles.on : ''} onClick={() => setTrans(t)}>{t}</button>
          ))}
        </span>
        <span className={styles.swLbl} style={{ marginLeft: 6 }}>자동전환</span>
        <span className={styles.seg2}>
          <button className={auto ? styles.on : ''} onClick={() => setAuto(true)}>ON</button>
          <button className={!auto ? styles.on : ''} onClick={() => setAuto(false)}>OFF</button>
        </span>
        <span className={styles.swSpacer} />
        <button className={`${styles.brkBtn} ${brk ? styles.brkBtnOn : ''}`} onClick={() => setBrk((b) => !b)}>
          {brk ? '🟧 휴식 송출 중 — 해제' : '🟧 휴식 이미지 일괄 송출'}
        </button>
      </div>

      <div className={styles.brkCfg}>
        <span className={styles.brkCfgT}>🟧 휴식 모드</span>
        {brkImg
          ? <img className={styles.brkThumb} src={brkImg} alt="휴식 이미지" />
          : <span className={styles.brkThumbEmpty}>🖼️</span>}
        <button className={styles.brkUp} onClick={() => fileRef.current?.click()}>휴식 이미지 업로드</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImg} />
        <span className={`${styles.chk} ${adOverlay ? styles.chkOn : ''}`} onClick={() => setAdOverlay((v) => !v)}><span className={styles.chkBox}>✓</span> 광고 오버레이</span>
        <span className={`${styles.chk} ${music ? styles.chkOn : ''}`} onClick={() => setMusic((v) => !v)}><span className={styles.chkBox}>✓</span> 🎵 배경음악</span>
        <span className={`${styles.chk} ${loop ? styles.chkOn : ''}`} onClick={() => setLoop((v) => !v)}><span className={styles.chkBox}>✓</span> 🔁 반복재생</span>
      </div>

      <div className={styles.kbdHint}>
        ⌨️ <b>← →</b> 코트 선택 <b>1·2·3</b> 카메라 <b>Enter</b> 전환 <b>T</b> 전체전환 <b>B</b> 휴식 · 선택됨: <b>코트 {focus}</b>
      </div>

      <div className={styles.swGrid}>
        {COURTS.map((c) => {
          const onAir = pgm[c.n];
          return (
            <div key={c.n} className={`${styles.swCard} ${c.live ? styles.swCardOn : ''} ${focus === c.n ? styles.swCardFocus : ''}`} onClick={() => setFocus(c.n)}>
              <div className={styles.swHead}>
                <span className={styles.swCourt}>코트 {c.n}</span>
                <span className={styles.swEv}>· {c.ev}</span>
                <span className={styles.swView}>👁 {c.viewers}</span>
              </div>

              <div className={`${styles.pgm} ${c.live ? styles.pgmLive : ''} ${brk && !brkImg ? styles.pgmBrk : ''}`}>
                {brk
                  ? (brkImg ? <img className={styles.pgmImg} src={brkImg} alt="휴식" /> : '🟧 잠시 후 계속됩니다')
                  : (c.live ? '🎥' : '대기 중')}
                {c.live && !brk && <span className={styles.pgmTag}>● ON AIR · {c.cams[onAir]}</span>}
                {brk && <span className={`${styles.pgmTag} ${styles.pgmTagBrk}`}>● 휴식</span>}
                {brk && (adOverlay || music || loop) && (
                  <span className={styles.pgmOverlayTag}>
                    {adOverlay && <span>광고</span>}
                    {music && <span>🎵</span>}
                    {loop && <span>🔁</span>}
                  </span>
                )}
                <span className={styles.pgmCap}>PGM</span>
              </div>

              <div className={styles.cams}>
                {c.cams.map((cam, idx) => {
                  const isOn = idx === pgm[c.n];
                  const isPvw = idx === pvw[c.n];
                  return (
                    <div
                      key={cam}
                      className={`${styles.cam} ${isOn ? styles.camOn : ''} ${!isOn && isPvw ? styles.camPvw : ''}`}
                      onClick={() => setPvw((p) => ({ ...p, [c.n]: idx }))}
                    >
                      {isOn && <span className={`${styles.camBadge} ${styles.camBadgeOn}`}>PGM</span>}
                      {!isOn && isPvw && <span className={`${styles.camBadge} ${styles.camBadgePvw}`}>PVW</span>}
                      📹 {cam}
                    </div>
                  );
                })}
              </div>

              <div className={styles.swActs}>
                <button
                  className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                  onClick={() => setPvw((p) => ({ ...p, [c.n]: (pvw[c.n] + 1) % c.cams.length }))}
                >
                  다음 캠 미리보기
                </button>
                <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={() => take(c.n)}>▶ 전환 (TAKE)</button>
              </div>
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
}

export default SwitcherConsole;
