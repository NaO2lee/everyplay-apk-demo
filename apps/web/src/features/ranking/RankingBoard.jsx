import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Ranking.module.css';

/* 랭킹 보드 (데모) — /ranking/demo. 테니스타운식 시즌 랭킹.
   종목·부 필터 + 1·2·3위 포디움 + 순위 리스트(포인트·출전수·등급·증감) + 내 순위 고정.
   행을 누르면 선수 프로필(/player/demo)로. TODO(backend): GET /public/rankings?event=&div= */

const EVENTS = ['30초 스피드', '더블더치', '개인 프리스타일', '더블언더'];
const DIVS = ['전체', '초등부', '중등부', '고등부', '일반부'];

// grade: DIA | GOLD | SILVER | BRONZE / trend: +n | -n | 0 | 'new'
const PLAYERS = [
  { id: 'r1', name: '김서연', club: '서울 줄넘기클럽', div: '초등부', grade: 'DIA', pts: 2840, plays: 12, trend: 1 },
  { id: 'r2', name: '박도윤', club: '화성 점프', div: '초등부', grade: 'DIA', pts: 2710, plays: 11, trend: -1 },
  { id: 'r3', name: 'Y. TANAKA', club: 'Tokyo RJ', div: '초등부', grade: 'GOLD', pts: 2655, plays: 9, trend: 2 },
  { id: 'r4', name: '이서아', club: '부산 스피드', div: '중등부', grade: 'GOLD', pts: 2480, plays: 13, trend: 0 },
  { id: 'r5', name: '오세훈', club: '수원 프리스타일', div: '고등부', grade: 'GOLD', pts: 2390, plays: 8, trend: 3 },
  { id: 'r6', name: '강민재', club: '제주 점프', div: '중등부', grade: 'SILVER', pts: 2210, plays: 10, trend: -2 },
  { id: 'r7', name: '윤채원', club: '천안 로프', div: '중등부', grade: 'SILVER', pts: 2080, plays: 7, trend: 1 },
  { id: 'r8', name: '서지안', club: '국가대표 A', div: '일반부', grade: 'SILVER', pts: 1990, plays: 6, trend: 'new' },
  { id: 'r9', name: '최유나', club: '인천 점프', div: '초등부', grade: 'BRONZE', pts: 1840, plays: 9, trend: 0 },
  { id: 'r10', name: '한지우', club: '대구 로프', div: '고등부', grade: 'BRONZE', pts: 1755, plays: 5, trend: 2 },
  { id: 'r11', name: '정유나', club: '광주 줄넘기', div: '중등부', grade: 'BRONZE', pts: 1690, plays: 8, trend: -1 },
  { id: 'r12', name: '박지호', club: '울산 점프', div: '초등부', grade: 'BRONZE', pts: 1620, plays: 6, trend: 1 },
];
// 내 순위 (로그인 사용자) — TODO(backend): GET /me/ranking?event=&div=
const ME = { rank: 24, name: '나(김하준)', club: '서울 줄넘기클럽', grade: 'SILVER', pts: 1180, plays: 4, trend: 5 };

const GRADE_LABEL = { DIA: '다이아', GOLD: '골드', SILVER: '실버', BRONZE: '브론즈' };
const GRADE_CLS = { DIA: 'gDIA', GOLD: 'gGOLD', SILVER: 'gSILVER', BRONZE: 'gBRONZE' };

function Grade({ g }) {
  return <span className={`${styles.grade} ${styles[GRADE_CLS[g]]}`}>◆ {GRADE_LABEL[g]}</span>;
}
function Trend({ t }) {
  if (t === 'new') return <span className={`${styles.trend} ${styles.tNew}`}>NEW</span>;
  if (t > 0) return <span className={`${styles.trend} ${styles.tUp}`}>▲ {t}</span>;
  if (t < 0) return <span className={`${styles.trend} ${styles.tDown}`}>▼ {-t}</span>;
  return <span className={`${styles.trend} ${styles.tFlat}`}>–</span>;
}

export function RankingBoard() {
  const navigate = useNavigate();
  const [ev, setEv] = useState(EVENTS[0]);
  const [div, setDiv] = useState('전체');

  // 종목/부 필터는 데모라 동일 명단을 보여주되, 부 선택 시 해당 부만 추려 순위 재계산
  const ranked = useMemo(() => {
    const list = (div === '전체' ? PLAYERS : PLAYERS.filter((p) => p.div === div))
      .slice()
      .sort((a, b) => b.pts - a.pts);
    return list.map((p, i) => ({ ...p, rank: i + 1 }));
  }, [div]);

  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const goPlayer = () => navigate('/player/demo');
  // 포디움 배치: 2위(좌) · 1위(중) · 3위(우)
  const podOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const podMeta = { 1: { cls: 'pod1', bar: 'podBar1', medal: 'pm1', crown: '👑' }, 2: { cls: 'pod2', bar: 'podBar2', medal: 'pm2' }, 3: { cls: 'pod3', bar: 'podBar3', medal: 'pm3' } };

  return (
    <div className={styles.screen}>
      <div className={styles.bar}>
        <button className={styles.back} onClick={() => navigate(-1)} aria-label="뒤로">←</button>
        <span className={styles.barT}>🏆 선수 랭킹</span>
        <span className={styles.barSub}>2026 시즌</span>
      </div>

      <div className={styles.sticky}>
        <div className={styles.tabs}>
          {EVENTS.map((e) => (
            <button key={e} className={`${styles.tab} ${ev === e ? styles.tabOn : ''}`} onClick={() => setEv(e)}>{e}</button>
          ))}
        </div>
        <div className={styles.chips}>
          {DIVS.map((d) => (
            <button key={d} className={`${styles.chip} ${div === d ? styles.chipOn : ''}`} onClick={() => setDiv(d)}>{d}</button>
          ))}
        </div>
      </div>

      <div className={styles.scr}>
        <div className={styles.metaLine}>{ev} · {div} · 누적 포인트 기준 · 매주 일요일 갱신</div>

        {top3.length === 3 && (
          <div className={styles.podium}>
            {podOrder.map((p) => {
              const m = podMeta[p.rank];
              return (
                <button key={p.id} className={`${styles.pod} ${styles[m.cls]}`} onClick={goPlayer}>
                  <div className={styles.podAv}>
                    {p.rank === 1 && <span className={styles.crown}>{m.crown}</span>}
                    {p.name.charAt(0)}
                    <span className={`${styles.podMedal} ${styles[m.medal]}`}>{p.rank}</span>
                  </div>
                  <div className={styles.podNm}>{p.name}</div>
                  <div className={styles.podClub}>{p.club}</div>
                  <div className={styles.podPts}>{p.pts.toLocaleString()}<small>P</small></div>
                  <div className={`${styles.podBar} ${styles[m.bar]}`}>{p.rank}</div>
                </button>
              );
            })}
          </div>
        )}

        <div className={styles.listHd}>전체 순위</div>
        {rest.map((p) => (
          <button key={p.id} className={styles.row} onClick={goPlayer}>
            <span className={styles.rank}>{p.rank}</span>
            <span className={styles.av}>{p.name.charAt(0)}</span>
            <div className={styles.rmid}>
              <div className={styles.rnm}>{p.name} <Grade g={p.grade} /></div>
              <div className={styles.rclub}>{p.club} · {p.div} · {p.plays}회 출전</div>
            </div>
            <div className={styles.rright}>
              <span className={styles.rpts}>{p.pts.toLocaleString()}<small>P</small></span>
              <Trend t={p.trend} />
            </div>
          </button>
        ))}

        <div className={styles.scoreNote}>
          포인트 = 대회 성적(순위·기록) + 출전 가산점. 같은 종목·부 안에서 시즌 누적으로 매겨져요.
        </div>
      </div>

      <div className={styles.myBar}>
        <div className={styles.myInner} onClick={goPlayer} role="button">
          <span className={styles.myTag}>내 순위</span>
          <span className={styles.rank}>{ME.rank}</span>
          <div className={styles.rmid}>
            <div className={styles.rnm}>{ME.name} <Grade g={ME.grade} /></div>
            <div className={styles.rclub}>{ME.club} · {ME.plays}회 출전</div>
          </div>
          <div className={styles.rright}>
            <span className={styles.rpts}>{ME.pts.toLocaleString()}<small>P</small></span>
            <Trend t={ME.trend} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default RankingBoard;
