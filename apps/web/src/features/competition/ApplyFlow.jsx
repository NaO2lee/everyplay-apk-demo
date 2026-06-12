import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Competition.module.css';

/* 접수 신청 — 토스식 단계형 (데모) — /apply/demo.
   한 번에 하나씩 묻기 + 진행바 + 답 누적 + 요약/동의 + 완료/상태 타임라인.
   TODO(backend): 제출 시 신청 API + 담당자 메일 발송 + 상태 추적으로 연결. */

const EVENTS = ['⚡ 30초 스피드', '⚡ 2인 릴레이', '⚡ 4인 릴레이', '⚡ 더블더치 릴레이', '🤸 개인 프리스타일', '🤸 팀쇼'];
const DIVS = ['유치부', '초등부', '중등부', '고등부', '일반부'];
const FEE = 20000;

const STEPS = ['events', 'name', 'div', 'club', 'phone', 'confirm'];

export function ApplyFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [evs, setEvs] = useState([]);
  const [name, setName] = useState('');
  const [div, setDiv] = useState('');
  const [club, setClub] = useState('');
  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(false);

  const cur = STEPS[step];
  const fee = FEE * Math.max(1, evs.length);

  const canNext = {
    events: evs.length > 0, name: name.trim().length > 1, div: !!div,
    club: club.trim().length > 0, phone: phone.trim().length >= 9, confirm: agreed,
  }[cur];

  const toggleEv = (e) => setEvs((xs) => (xs.includes(e) ? xs.filter((x) => x !== e) : [...xs, e]));
  const goNext = () => { if (cur === 'confirm') setDone(true); else setStep((s) => s + 1); };
  const goBack = () => { if (step === 0 || done) navigate(-1); else setStep((s) => s - 1); };

  const answered = [
    step > 0 && { k: '종목', v: `${evs.length}개 선택`, to: 0 },
    step > 1 && { k: '이름', v: name, to: 1 },
    step > 2 && { k: '부', v: div, to: 2 },
    step > 3 && { k: '소속', v: club, to: 3 },
    step > 4 && { k: '연락처', v: phone, to: 4 },
  ].filter(Boolean);

  if (done) {
    return (
      <div className={styles.screen}>
        <div className={styles.bar}>
          <button className={styles.back} onClick={() => navigate('/app/demo')} aria-label="닫기">×</button>
          <span className={styles.barT}>신청 완료</span>
        </div>
        <div className={styles.doneWrap}>
          <div className={styles.doneIc}>✓</div>
          <div className={styles.doneT}>접수 신청이 완료됐어요!</div>
          <div className={styles.doneS}>담당자 확인 후 알림으로 안내해드려요.<br />참가비 입금까지 마치면 <b>참가 확정</b>이에요.</div>
          <div className={styles.timeline}>
            <div className={`${styles.tl} ${styles.tlOn}`}><span className={styles.tlDot} /><div><div className={styles.tlT}>신청 접수</div><div className={styles.tlS}>방금 · {name} · {evs.length}개 종목</div></div></div>
            <div className={styles.tl}><span className={styles.tlDot} /><div><div className={styles.tlT}>담당자 확인</div><div className={styles.tlS}>1~2일 내 · 앱 알림</div></div></div>
            <div className={styles.tl}><span className={styles.tlDot} /><div><div className={styles.tlT}>참가비 입금 (₩{fee.toLocaleString()})</div><div className={styles.tlS}>농협 351-1172-5792-93</div></div></div>
            <div className={styles.tl}><span className={styles.tlDot} /><div><div className={styles.tlT}>참가 확정 🎉</div><div className={styles.tlS}>대진표 공개 시 HIT 배정</div></div></div>
          </div>
        </div>
        <div className={styles.foot}>
          <button className={styles.next} onClick={() => navigate('/app/demo')}>홈으로</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.bar}>
        <button className={styles.back} onClick={goBack} aria-label="뒤로">←</button>
        <span className={styles.barT}>접수 신청</span>
      </div>
      <div className={styles.pbar}><i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
      <div className={styles.stepCnt}>{step + 1} / {STEPS.length}</div>

      <div className={styles.scr}>
        {answered.map((a) => (
          <div key={a.k} className={styles.ans}>
            <span className={styles.ansK}>{a.k}</span>
            <span className={styles.ansV}>{a.v} <button className={styles.ansEd} onClick={() => setStep(a.to)}>수정</button></span>
          </div>
        ))}

        {cur === 'events' && (
          <div className={styles.q}>
            <div className={styles.qBig}>어떤 종목에<br />참가하세요?</div>
            <div className={styles.qSub}>여러 개 선택할 수 있어요 (스피드 참가 시 프리스타일도 가능)</div>
            <div className={styles.chipRow}>
              {EVENTS.map((e) => (
                <button key={e} className={`${styles.chip} ${evs.includes(e) ? styles.chipOn : ''}`} onClick={() => toggleEv(e)}>{e}</button>
              ))}
            </div>
          </div>
        )}
        {cur === 'name' && (
          <div className={styles.q}>
            <div className={styles.qBig}>선수 이름을<br />알려주세요</div>
            <input className={styles.bigIn} value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 입력" autoFocus />
          </div>
        )}
        {cur === 'div' && (
          <div className={styles.q}>
            <div className={styles.qBig}>어느 부로<br />출전하세요?</div>
            <div className={styles.chipRow}>
              {DIVS.map((d) => (
                <button key={d} className={`${styles.chip} ${div === d ? styles.chipOn : ''}`} onClick={() => setDiv(d)}>{d}</button>
              ))}
            </div>
          </div>
        )}
        {cur === 'club' && (
          <div className={styles.q}>
            <div className={styles.qBig}>어디 소속이세요?</div>
            <div className={styles.qSub}>클럽 또는 학교 이름을 적어주세요</div>
            <input className={styles.bigIn} value={club} onChange={(e) => setClub(e.target.value)} placeholder="예: 화성 점프클럽" autoFocus />
          </div>
        )}
        {cur === 'phone' && (
          <div className={styles.q}>
            <div className={styles.qBig}>연락처를<br />알려주세요</div>
            <div className={styles.qSub}>접수 확인·대회 안내를 보내드려요</div>
            <input className={styles.bigIn} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" autoFocus />
          </div>
        )}
        {cur === 'confirm' && (
          <div className={styles.q}>
            <div className={styles.qBig}>이대로 신청할까요?</div>
            <div className={styles.sumList}>
              <div className={styles.ans}><span className={styles.ansK}>종목</span><span className={styles.ansV}>{evs.join(' · ').replace(/(?:⚡|🤸) /gu, '')}</span></div>
              <div className={styles.ans}><span className={styles.ansK}>이름 · 부</span><span className={styles.ansV}>{name} · {div}</span></div>
              <div className={styles.ans}><span className={styles.ansK}>소속</span><span className={styles.ansV}>{club}</span></div>
              <div className={styles.ans}><span className={styles.ansK}>연락처</span><span className={styles.ansV}>{phone}</span></div>
            </div>
            <div className={styles.feeBox}><span>참가비 ({evs.length}종목)</span><b>₩ {fee.toLocaleString()}</b></div>
            <div className={`${styles.agree} ${agreed ? styles.agreeOn : ''}`} onClick={() => setAgreed((v) => !v)}>
              <span className={styles.agreeBox}>✓</span> 개인정보 수집·이용 및 환불 규정에 동의합니다
            </div>
          </div>
        )}
      </div>

      <div className={styles.foot}>
        <button className={`${styles.next} ${canNext ? '' : styles.nextDim}`} onClick={goNext}>
          {cur === 'confirm' ? '신청 완료하기 →' : '다음'}
        </button>
      </div>
    </div>
  );
}

export default ApplyFlow;
