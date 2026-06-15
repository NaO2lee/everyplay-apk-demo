import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, FileSpreadsheet, FolderDown } from 'lucide-react';
import styles from './Competition.module.css';

/* 단체/코치 일괄 신청 (데모) — /apply/group/demo
   줄넘기 = 어린이·단체 多 → 코치/단체가 여러 명 한 번에 등록.
   폰 방안: ① 한 명씩 추가 ② 엑셀/CSV 업로드 ③ 저장된 우리팀 명단 불러오기.
   선수별 종목 배정 → 참가비 합산 → 미성년 보호자 동의 → 제출 → 입금.
   TODO(backend): 제출=단체신청 API(팀+선수배열), 엑셀=서버 파싱, 저장명단=팀 roster CRUD. */

const EVENTS = ['30초 스피드', '2인 릴레이', '4인 릴레이', '더블더치', '개인 프리', '팀쇼'];
const DIVS = ['유치부', '초등부', '중등부', '고등부', '일반부'];
const FEE = 20000;
const STEPS = ['team', 'roster', 'confirm'];

// mock — 엑셀 업로드 / 저장 명단 시뮬레이션
const CSV_SAMPLE = [
  { name: '강민준', div: '초등부', evs: ['30초 스피드', '4인 릴레이'] },
  { name: '윤서아', div: '초등부', evs: ['30초 스피드'] },
  { name: '한지호', div: '중등부', evs: ['더블더치', '4인 릴레이'] },
];
const SAVED_ROSTER = [
  { name: '김도윤', div: '초등부', evs: ['30초 스피드', '개인 프리'] },
  { name: '이서연', div: '초등부', evs: ['30초 스피드'] },
  { name: '박하준', div: '중등부', evs: ['더블더치'] },
  { name: '정유나', div: '중등부', evs: ['더블더치', '4인 릴레이'] },
];

let _id = 0;
const withIds = (list) => list.map((a) => ({ ...a, id: `a${++_id}` }));

export function GroupApply() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [team, setTeam] = useState({ name: '', coach: '', phone: '' });
  const [athletes, setAthletes] = useState([]);
  const [toast, setToast] = useState('');
  // 한 명 추가 폼
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', div: '', evs: [] });
  const [agreeGuardian, setAgreeGuardian] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [done, setDone] = useState(false);

  const cur = STEPS[step];
  const totalFee = athletes.reduce((s, a) => s + FEE * Math.max(1, a.evs.length), 0);
  const totalEntries = athletes.reduce((s, a) => s + Math.max(1, a.evs.length), 0);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const addOne = () => {
    if (!f.name.trim() || !f.div || f.evs.length === 0) return;
    setAthletes((xs) => [...xs, { ...f, id: `a${++_id}`, name: f.name.trim() }]);
    setF({ name: '', div: '', evs: [] }); setAdding(false);
  };
  const importCsv = () => { setAthletes((xs) => [...xs, ...withIds(CSV_SAMPLE)]); showToast(`엑셀에서 ${CSV_SAMPLE.length}명 불러왔어요`); };
  const loadSaved = () => { setAthletes((xs) => [...xs, ...withIds(SAVED_ROSTER)]); showToast(`저장된 '화성 점프클럽' 명단 ${SAVED_ROSTER.length}명 불러왔어요`); };
  const removeA = (id) => setAthletes((xs) => xs.filter((a) => a.id !== id));
  const toggleFev = (e) => setF((s) => ({ ...s, evs: s.evs.includes(e) ? s.evs.filter((x) => x !== e) : [...s.evs, e] }));

  const canNext = {
    team: team.name.trim() && team.coach.trim() && team.phone.trim().length >= 9,
    roster: athletes.length > 0,
    confirm: agreeGuardian && agreeTerms,
  }[cur];

  const goNext = () => { if (cur === 'confirm') setDone(true); else setStep((s) => s + 1); };
  const goBack = () => { if (step === 0 || done) navigate(-1); else setStep((s) => s - 1); };

  if (done) {
    return (
      <div className={styles.screen}>
        <div className={styles.bar}><button className={styles.back} onClick={() => navigate('/app/demo')} aria-label="닫기">×</button><span className={styles.barT}>단체 신청 완료</span></div>
        <div className={styles.doneWrap}>
          <div className={styles.doneIc}>✓</div>
          <div className={styles.doneT}>{team.name} · {athletes.length}명 신청 완료!</div>
          <div className={styles.doneS}>담당자 확인 후 알림으로 안내해드려요.<br />단체 참가비 입금까지 마치면 <b>참가 확정</b>이에요.</div>
          <div className={styles.timeline}>
            <div className={`${styles.tl} ${styles.tlOn}`}><span className={styles.tlDot} /><div><div className={styles.tlT}>단체 신청 접수</div><div className={styles.tlS}>방금 · {athletes.length}명 · {totalEntries}개 출전</div></div></div>
            <div className={styles.tl}><span className={styles.tlDot} /><div><div className={styles.tlT}>담당자 확인</div><div className={styles.tlS}>1~2일 내 · 코치님께 알림</div></div></div>
            <div className={styles.tl}><span className={styles.tlDot} /><div><div className={styles.tlT}>단체 참가비 입금 (₩{totalFee.toLocaleString()})</div><div className={styles.tlS}>농협 351-1172-5792-93 · 한 번에 입금</div></div></div>
            <div className={styles.tl}><span className={styles.tlDot} /><div><div className={styles.tlT}>참가 확정 🎉</div><div className={styles.tlS}>선수별 HIT 배정 · 대진표 공개</div></div></div>
          </div>
          <div className={styles.toast} style={{ marginTop: 18 }}>💾 이 명단은 '{team.name}'으로 저장됐어요 — 다음 대회 땐 "저장 명단 불러오기"로 한 번에!</div>
        </div>
        <div className={styles.foot}><button className={styles.next} onClick={() => navigate('/app/demo')}>홈으로</button></div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.bar}><button className={styles.back} onClick={goBack} aria-label="뒤로">←</button><span className={styles.barT}>단체 · 코치 신청</span></div>
      <div className={styles.pbar}><i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
      <div className={styles.stepCnt}>{step + 1} / {STEPS.length}</div>

      <div className={styles.scr}>
        {cur === 'team' && (
          <div className={styles.q}>
            <div className={styles.qBig}>단체 정보를<br />입력해 주세요</div>
            <div className={styles.qSub}>코치님 또는 단체 대표가 한 번에 등록해요</div>
            <div className={styles.field}><div className={styles.flabel}>단체 / 팀 이름</div><input className={styles.fin} value={team.name} onChange={(e) => setTeam({ ...team, name: e.target.value })} placeholder="예: 화성 점프클럽" /></div>
            <div className={styles.field}><div className={styles.flabel}>코치 / 대표자 이름</div><input className={styles.fin} value={team.coach} onChange={(e) => setTeam({ ...team, coach: e.target.value })} placeholder="예: 홍길동" /></div>
            <div className={styles.field}><div className={styles.flabel}>연락처</div><input className={styles.fin} type="tel" value={team.phone} onChange={(e) => setTeam({ ...team, phone: e.target.value })} placeholder="010-0000-0000" /></div>
          </div>
        )}

        {cur === 'roster' && (
          <div className={styles.q}>
            <div className={styles.qBig}>선수 명단을<br />추가해 주세요</div>
            <div className={styles.qSub}>3가지 방법 중 편한 걸로 — 어린이·단체도 한 번에</div>
            {toast && <div className={styles.toast} style={{ marginTop: 16 }}>{toast}</div>}
            <div className={styles.mBtns}>
              <button className={styles.mBtn} onClick={() => setAdding((v) => !v)}><span className={styles.mBtnIc}><UserPlus size={21} /></span><span className={styles.mBtnL}>한 명씩<br />추가</span></button>
              <button className={styles.mBtn} onClick={importCsv}><span className={styles.mBtnIc}><FileSpreadsheet size={21} /></span><span className={styles.mBtnL}>엑셀/CSV<br />업로드</span></button>
              <button className={styles.mBtn} onClick={loadSaved}><span className={styles.mBtnIc}><FolderDown size={21} /></span><span className={styles.mBtnL}>저장 명단<br />불러오기</span></button>
            </div>
            <button className={styles.dlLink} onClick={() => showToast('엑셀 양식(.xlsx)을 받았어요 — 이름·생년·부·종목 칸')}>＋ 엑셀 업로드 양식 다운로드</button>

            {adding && (
              <div className={styles.addForm}>
                <input className={styles.fin} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="선수 이름" autoFocus />
                <div className={styles.addLbl}>참가부</div>
                <div className={styles.miniChips}>{DIVS.map((d) => <button key={d} className={`${styles.miniChip} ${f.div === d ? styles.miniChipOn : ''}`} onClick={() => setF({ ...f, div: d })}>{d}</button>)}</div>
                <div className={styles.addLbl}>출전 종목 (복수 선택)</div>
                <div className={styles.miniChips}>{EVENTS.map((e) => <button key={e} className={`${styles.miniChip} ${f.evs.includes(e) ? styles.miniChipOn : ''}`} onClick={() => toggleFev(e)}>{e}</button>)}</div>
                <button className={`${styles.addBtn} ${(f.name.trim() && f.div && f.evs.length) ? '' : styles.addBtnDim}`} onClick={addOne}>명단에 추가</button>
              </div>
            )}

            <div className={styles.rosterSum}><span>등록 선수</span><b>{athletes.length}명 · {totalEntries}개 출전</b></div>
            {athletes.length === 0 ? (
              <div className={styles.emptyR}>아직 추가된 선수가 없어요.<br />위 3가지 방법으로 선수를 추가해 주세요.</div>
            ) : (
              <div className={styles.aList}>
                {athletes.map((a, i) => (
                  <div key={a.id} className={styles.aRow}>
                    <span className={styles.aNo}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className={styles.aName}>{a.name}</span>
                      <div className={styles.aMeta}>
                        <span className={styles.aDiv}>{a.div}</span>
                        {a.evs.map((e) => <span key={e} className={styles.aTag}>{e}</span>)}
                      </div>
                    </div>
                    <button className={styles.aDel} onClick={() => removeA(a.id)} aria-label="삭제">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {cur === 'confirm' && (
          <div className={styles.q}>
            <div className={styles.qBig}>이대로 신청할까요?</div>
            <div className={styles.sumList}>
              <div className={styles.ans}><span className={styles.ansK}>단체</span><span className={styles.ansV}>{team.name}</span></div>
              <div className={styles.ans}><span className={styles.ansK}>코치 · 연락처</span><span className={styles.ansV}>{team.coach} · {team.phone}</span></div>
              <div className={styles.ans}><span className={styles.ansK}>선수</span><span className={styles.ansV}>{athletes.length}명</span></div>
              <div className={styles.ans}><span className={styles.ansK}>총 출전</span><span className={styles.ansV}>{totalEntries}개 종목</span></div>
            </div>
            <div className={styles.feeBox}><span>단체 참가비 합계</span><b>₩ {totalFee.toLocaleString()}</b></div>
            <div className={styles.guardian}>👨‍👧 미성년 선수가 포함된 경우, 코치/대표가 각 보호자의 참가·개인정보 동의를 받았음을 확인합니다. (만 14세 미만 보호자 동의 — 정보통신망법)</div>
            <div className={`${styles.agree} ${agreeGuardian ? styles.agreeOn : ''}`} onClick={() => setAgreeGuardian((v) => !v)}><span className={styles.agreeBox}>✓</span> 전 선수 보호자 동의를 받았습니다</div>
            <div className={`${styles.agree} ${agreeTerms ? styles.agreeOn : ''}`} onClick={() => setAgreeTerms((v) => !v)}><span className={styles.agreeBox}>✓</span> 개인정보 수집·이용 및 환불 규정에 동의합니다</div>
          </div>
        )}
      </div>

      <div className={styles.foot}>
        <button className={`${styles.next} ${canNext ? '' : styles.nextDim}`} onClick={goNext}>
          {cur === 'confirm' ? `${athletes.length}명 신청 완료하기 →` : '다음'}
        </button>
      </div>
    </div>
  );
}

export default GroupApply;
