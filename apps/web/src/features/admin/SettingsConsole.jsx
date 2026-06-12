import { useState } from 'react';
import styles from './AdminConsole.module.css';
import { AdminLayout } from './AdminLayout';

/* 설정 (데모) — /console/settings. 실제 저장은 백엔드 연결. */
export function SettingsConsole() {
  const [name, setName] = useState('2026 전국 한마당 줄넘기대회');
  const [place, setPlace] = useState('화성종합경기타운');
  const [theme, setTheme] = useState('자동');
  const [notiSms, setNotiSms] = useState(true);
  const [notiPush, setNotiPush] = useState(true);
  const [saved, setSaved] = useState(false);
  const touch = (fn) => (v) => { fn(v); setSaved(false); };

  return (
    <AdminLayout active="settings">
      <div className={styles.pageHead}>
        <div className={styles.pageHeadMain}>
          <h1>⚙️ 설정</h1>
          <p>대회 기본 정보·브랜딩·알림을 설정하세요.</p>
        </div>
        <div className={styles.pageActs}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setSaved(true)}>{saved ? '✓ 저장됨' : '💾 저장'}</button>
        </div>
      </div>

      <div className={styles.twoCol}>
        <section className={styles.block}>
          <div className={styles.bt} style={{ '--c': 'var(--cyan)' }}><span className={styles.btIco}>🏆</span> 대회 기본 정보</div>
          <div className={styles.fld}><label className={styles.fldL}>대회명</label><input className={styles.fldIn} value={name} onChange={(e) => touch(setName)(e.target.value)} /></div>
          <div className={styles.fld}><label className={styles.fldL}>장소</label><input className={styles.fldIn} value={place} onChange={(e) => touch(setPlace)(e.target.value)} /></div>
          <div className={styles.fld}><label className={styles.fldL}>주최</label><input className={styles.fldIn} defaultValue="대한민국줄넘기협회 (KRSA)" /></div>
        </section>

        <section className={styles.block}>
          <div className={styles.bt} style={{ '--c': 'var(--purple)' }}><span className={styles.btIco}>🎨</span> 브랜딩 · 알림</div>
          <div className={styles.fld}>
            <label className={styles.fldL}>화면 테마</label>
            <span className={styles.seg2}>
              {['자동', '다크', '라이트'].map((t) => (<button key={t} className={theme === t ? styles.on : ''} onClick={() => touch(setTheme)(t)}>{t}</button>))}
            </span>
          </div>
          <div className={styles.fld}>
            <label className={styles.fldL}>알림</label>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span className={`${styles.chk} ${notiSms ? styles.chkOn : ''}`} onClick={() => touch(setNotiSms)(!notiSms)}><span className={styles.chkBox}>✓</span> 문자(SMS)</span>
              <span className={`${styles.chk} ${notiPush ? styles.chkOn : ''}`} onClick={() => touch(setNotiPush)(!notiPush)}><span className={styles.chkBox}>✓</span> 앱 푸시</span>
            </div>
          </div>
          <div className={styles.fld}><label className={styles.fldL}>로고</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="/brand/weplay-wordmark-white.png" alt="WEPLAY" style={{ height: 22 }} />
              <button className={styles.brkUp}>로고 변경</button>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

export default SettingsConsole;
