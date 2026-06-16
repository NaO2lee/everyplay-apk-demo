import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import styles from './Competition.module.css';

/* 대회 상세 (데모) — /competition/demo. 2026 전국 한마당 줄넘기대회 기반.
   탭: 요강 · 참가자(응원♥) · 대진표(공개일) · 공지·문의. TODO(backend): 대회 상세 API. */

const INFO = [
  { ic: '📅', k: '일정', v: '2026. 7. 17.(금) ~ 7. 19.(일) · 3일간' },
  { ic: '📍', k: '장소', v: '화성종합경기타운 실내체육관' },
  { ic: '🏢', k: '주최', v: '대한민국줄넘기협회(KRSA)' },
  { ic: '🤸', k: '대상', v: '유치부 ~ 일반부 (개인/단체)' },
  { ic: '🗓️', k: '접수', v: '~ 6. 26.(금) 18:00 마감', hot: true },
  { ic: '💳', k: '참가비', v: '개인 20,000원 · 단체 팀당 40,000원' },
  { ic: '🏦', k: '계좌', v: '농협 351-1172-5792-93 (대한민국줄넘기협회)', copy: true },
  { ic: '📞', k: '문의', v: '031-000-0000 · krsa@skiprope.co.kr' },
];
const EVENTS = ['⚡ 30초 스피드', '⚡ 2인 릴레이', '⚡ 4인 릴레이', '⚡ 더블더치 릴레이', '🤸 개인 프리스타일', '🤸 팀쇼'];
const KEY = [
  { k: '출전 자격', v: '협회 등록 선수 / 동호인' },
  { k: '연령', v: '유치부~일반부 (출생연도 기준)' },
  { k: '참여 종목 수', v: '개인 최대 4종목' },
  { k: '단체 구성', v: '팀당 4~8명' },
];
const DOCS = [
  { name: '대회 요강 전문 (17p)', type: 'PDF', size: '2.4MB', file: '/brand/comp-guide.pdf', ic: '📄' },
  { name: '경기 규정 · 심판 채점 기준', type: 'PDF', size: '1.1MB', file: '/brand/comp-guide.pdf', ic: '📄' },
  { name: '종목별 세부 규정 · 참여 가능 종목 수', type: '한글 HWP', size: '480KB', file: '#', ic: '📑' },
  { name: '출전 자격 · 연령 기준표', type: '한글 HWP', size: '320KB', file: '#', ic: '📑' },
  { name: '단체 참가 신청서 양식', type: '한글 HWP', size: '210KB', file: '#', ic: '📝' },
];
// 참가자 명단 (+응원 ♥) — TODO(backend): GET /events/{code}/participants
const PARTICIPANTS = [
  { id: 'p1', name: '김도윤', club: '서울 줄넘기클럽', div: '초등부', ev: '30초 스피드', cheers: 24 },
  { id: 'p2', name: '이서아', club: '부산 스피드', div: '초등부', ev: '30초 스피드', cheers: 18 },
  { id: 'p3', name: 'Yuki Tanaka', club: 'Tokyo RJ', div: '초등부', ev: '30초 스피드', cheers: 12 },
  { id: 'p4', name: '오세훈', club: '수원 프리스타일', div: '고등부', ev: '개인 프리스타일', cheers: 31 },
  { id: 'p5', name: '강민재', club: '제주 점프', div: '중등부', ev: '더블더치', cheers: 9 },
  { id: 'p6', name: '윤채원', club: '천안 로프', div: '중등부', ev: '더블더치', cheers: 14 },
  { id: 'p7', name: '서지안', club: '국가대표 A', div: '일반부', ev: '팀쇼', cheers: 42 },
  { id: 'p8', name: '최유나', club: '인천 점프', div: '초등부', ev: '4인 릴레이', cheers: 7 },
];
// 대진표(조편성) — Tennis-Town식: 공개일에 오픈
const BRACKET_OPEN = '7/15(화) 18:00';
const GROUPS = [
  { name: 'A조', court: '코트 1', players: ['김도윤', '이서아', 'Yuki Tanaka', '박지호'] },
  { name: 'B조', court: '코트 2', players: ['최하준', 'Mei Lin', '정유나', '한지우'] },
  { name: 'C조', court: '코트 3', players: ['강민재', '윤채원', 'Liam Park'] },
];
const NOTICES = [
  { id: 'no1', title: '대진표는 7/15(화) 18시에 공개됩니다', date: '6/14' },
  { id: 'no2', title: '주차 안내 — 실내체육관 지하 주차장(무료) 이용', date: '6/13' },
  { id: 'no3', title: '준비물: 본인 줄넘기, 실내화 (대여 없음)', date: '6/12' },
];
const QNA = [
  { id: 'q1', q: '당일 현장 접수 가능한가요?', a: '아니요, 사전 접수만 받습니다 (마감 6/26 18:00).' },
  { id: 'q2', q: '한 선수가 여러 종목 나갈 수 있나요?', a: '네, 스피드 참가 시 프리스타일 중복 출전이 가능합니다. 개인 최대 4종목.' },
  { id: 'q3', q: '단체(팀) 신청은 어떻게 하나요?', a: '접수 신청 → "단체·코치 신청"에서 명단을 한 번에 등록하시면 됩니다.' },
];

const TABS = [['guide', '요강'], ['players', '참가자'], ['bracket', '대진표'], ['qna', '공지·문의']];

export function CompetitionDetail() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('t');
    return ['guide', 'players', 'bracket', 'qna'].includes(t) ? t : 'guide';
  });
  const [cheered, setCheered] = useState({});
  const [ask, setAsk] = useState('');
  const [asked, setAsked] = useState(false);
  const copyAccount = () => { try { navigator.clipboard.writeText('351-1172-5792-93'); alert('계좌번호가 복사됐어요'); } catch { /* ignore */ } };
  const toggleCheer = (id) => setCheered((c) => ({ ...c, [id]: !c[id] }));

  return (
    <div className={styles.screen}>
      <div className={styles.bar}>
        <button className={styles.back} onClick={() => navigate(-1)} aria-label="뒤로">←</button>
        <span className={styles.barT}>2026 전국 한마당 줄넘기대회</span>
      </div>

      <div className={styles.ctabs}>
        {TABS.map(([k, label]) => (
          <button key={k} className={`${styles.ctab} ${tab === k ? styles.ctabOn : ''}`} onClick={() => setTab(k)}>
            {label}{k === 'players' && ` ${PARTICIPANTS.length}`}
          </button>
        ))}
      </div>

      <div className={styles.scr}>
        {tab === 'guide' && (
          <>
            <div className={styles.poster}>
              <img className={styles.posterImg} src="/brand/comp-poster.png" alt="2026 전국 한마당 줄넘기대회 요강" />
              <span className={styles.posterBadge}>접수중</span>
              <span className={styles.posterD}>D-7</span>
            </div>
            <div className={styles.sec}>📋 대회 요강</div>
            <div className={styles.infoCard}>
              {INFO.map((r) => (
                <div key={r.k} className={styles.infoRow}>
                  <span className={styles.infoIc}>{r.ic}</span><span className={styles.infoK}>{r.k}</span>
                  <span className={styles.infoV}>{r.hot ? <b>{r.v}</b> : r.v}{r.copy && <button className={styles.copyBtn} onClick={copyAccount}>복사</button>}</span>
                </div>
              ))}
            </div>
            <div className={styles.sec}>🪪 핵심 정보 <span className={styles.secHint}>자세한 건 아래 서류에</span></div>
            <div className={styles.keyGrid}>{KEY.map((x) => <div key={x.k} className={styles.keyCell}><div className={styles.keyK}>{x.k}</div><div className={styles.keyV}>{x.v}</div></div>)}</div>
            <div className={styles.sec}>🏷️ 종목</div>
            <div className={styles.evChips}>{EVENTS.map((e) => <span key={e} className={styles.evChip}>{e}</span>)}</div>
            <div className={styles.sec}>📎 대회 규정·서류 <span className={styles.secHint}>요강에 다 못 담은 규정·양식</span></div>
            <div className={styles.docList}>
              {DOCS.map((d) => (
                <a key={d.name} className={styles.docRow} href={d.file} target="_blank" rel="noreferrer">
                  <span className={styles.docIc}>{d.ic}</span>
                  <div style={{ flex: 1, minWidth: 0 }}><div className={styles.docNm}>{d.name}</div><div className={styles.docMeta}>{d.type} · {d.size}</div></div>
                  <span className={styles.docDl}>⬇</span>
                </a>
              ))}
            </div>
            <div className={styles.sec}>📢 안내</div>
            <div className={styles.notice}>
              · 스피드 종목 참가 시 프리스타일 중복 출전 가능<br />
              · 접수 완료 후 참가비 입금 시 참가 확정 (앱에서 신청 상태 확인)<br />
              · 협찬: NARIA 줄넘기 (공식 지정 줄넘기)
            </div>
          </>
        )}

        {tab === 'players' && (
          <>
            <div className={styles.sec} style={{ marginTop: 16 }}>🙋 참가자 명단 <span className={styles.secHint}>응원 ♥로 선수에게 힘을</span></div>
            {PARTICIPANTS.map((p) => {
              const on = !!cheered[p.id];
              return (
                <div key={p.id} className={styles.prow}>
                  <span className={styles.pav}>{p.name.charAt(0)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.pnm}>{p.name}<small>{p.div}</small></div>
                    <div className={styles.pmeta}>{p.club} · {p.ev}</div>
                  </div>
                  <button className={`${styles.cheer} ${on ? styles.cheerOn : ''}`} onClick={() => toggleCheer(p.id)} aria-label="응원">
                    {on ? '♥' : '♡'} <span className={styles.cheerN}>{p.cheers + (on ? 1 : 0)}</span>
                  </button>
                </div>
              );
            })}
          </>
        )}

        {tab === 'bracket' && (
          <>
            <div className={styles.bracketNote}>
              <Info size={16} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 1 }} />
              <span>대진표(조편성)는 <b>{BRACKET_OPEN}</b>에 공개돼요. 아래는 미리보기예요 — 확정되면 알림으로 알려드릴게요.</span>
            </div>
            {GROUPS.map((g) => (
              <div key={g.name} className={styles.grp}>
                <div className={styles.grpHd}>{g.name}<span className={styles.grpCourt}>{g.court}</span></div>
                <div className={styles.grpP}>{g.players.map((pl) => <span key={pl} className={styles.grpChip}>{pl}</span>)}</div>
              </div>
            ))}
          </>
        )}

        {tab === 'qna' && (
          <>
            <div className={styles.sec} style={{ marginTop: 16 }}>📣 공지사항</div>
            {NOTICES.map((n) => (
              <div key={n.id} className={styles.notiRow}>
                <span style={{ fontSize: 16 }}>📌</span>
                <div style={{ flex: 1 }}><div className={styles.notiT}>{n.title}</div><div className={styles.notiD}>{n.date}</div></div>
              </div>
            ))}
            <div className={styles.sec}>❓ 자주 묻는 질문</div>
            {QNA.map((x) => (
              <div key={x.id} className={styles.qna}><div className={styles.qnaQ}>Q. {x.q}</div><div className={styles.qnaA}>A. {x.a}</div></div>
            ))}
            <div className={styles.sec}>✏️ 문의하기</div>
            {asked ? (
              <div className={styles.notice}>문의가 접수됐어요. 담당자가 앱 알림으로 답변드릴게요. 🙏</div>
            ) : (
              <div className={styles.askBar}>
                <input className={styles.askIn} value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="대회 운영진에게 문의…" />
                <button className={styles.askBtn} onClick={() => { if (ask.trim()) setAsked(true); }}>전송</button>
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.cta}>
        <button className={styles.ctaFav} aria-label="관심 대회">★</button>
        <button className={styles.ctaBtn} onClick={() => navigate('/apply/demo')}>접수 신청하기 →</button>
      </div>
    </div>
  );
}

export default CompetitionDetail;
