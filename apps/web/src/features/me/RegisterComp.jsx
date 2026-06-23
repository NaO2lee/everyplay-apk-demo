import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../competition/Competition.module.css';

/* 경기 참가 직접 등록 (데모) — /me/register. MY '경기 참가' 탭에서 진입.
   앱에 없는 대회를 수동으로 추가. TODO(backend): POST /me/registrations */

const EVENTS = ['30초 스피드', '더블더치', '개인 프리스타일', '4인 릴레이', '2인 릴레이', '팀쇼'];

export function RegisterComp() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [evs, setEvs] = useState([]);
  const [done, setDone] = useState(false);
  const toggleEv = (e) => setEvs((xs) => (xs.includes(e) ? xs.filter((x) => x !== e) : [...xs, e]));
  const ready = name.trim() && date.trim() && evs.length;

  if (done) {
    return (
      <div className={styles.screen}>
        <div className={styles.doneWrap}>
          <div className={styles.doneIc}>✅</div>
          <div className={styles.doneT}>참가 경기 등록 완료</div>
          <div className={styles.doneS}>“{name}”이(가) 내 참가 목록에 추가됐어요.<br />마이페이지 · 경기 참가 탭에서 확인하세요.</div>
        </div>
        <div className={styles.foot}><button className={styles.next} onClick={() => navigate('/app/demo?tab=my')}>마이페이지로 →</button></div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.bar}>
        <button className={styles.back} onClick={() => navigate(-1)} aria-label="뒤로">←</button>
        <span className={styles.barT}>경기 참가 직접 등록</span>
      </div>
      <div className={styles.scr}>
        <p style={{ fontSize: 13, color: 'var(--ink3)', margin: '4px 0 10px', lineHeight: 1.6, wordBreak: 'keep-all' }}>
          앱에 없는 대회를 직접 추가해서 기록·일정을 관리할 수 있어요.
        </p>
        <div className={styles.field}><div className={styles.flabel}>대회명</div><input className={styles.fin} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 2026 ○○ 줄넘기대회" /></div>
        <div className={styles.field}><div className={styles.flabel}>대회 날짜</div><input className={styles.fin} value={date} onChange={(e) => setDate(e.target.value)} placeholder="예: 2026. 8. 15." /></div>
        <div className={styles.field}>
          <div className={styles.flabel}>참가 종목 (복수 선택)</div>
          <div className={styles.chipRow}>
            {EVENTS.map((e) => <button key={e} className={`${styles.chip} ${evs.includes(e) ? styles.chipOn : ''}`} onClick={() => toggleEv(e)}>{e}</button>)}
          </div>
        </div>
      </div>
      <div className={styles.foot}>
        <button className={`${styles.next} ${ready ? '' : styles.nextDim}`} onClick={() => ready && setDone(true)}>등록하기</button>
      </div>
    </div>
  );
}

export default RegisterComp;
