import styles from '../ViewerApp.module.css';
import { MY_DASHBOARD as M } from '../data/mockData';

// 마이페이지(로그인 대시보드) — 내 기록·영상·참가내역·직접 기록
// TODO(backend): M을 GET /me, /me/heats, /me/awards, /me/clips, /me/practice 로 교체
export function MyTab({ onAddPractice }) {
  return (
    <div className={styles.pageFade}>
      <div className={styles.myhead}>
        <div className={styles.myAv}>{M.initial}</div>
        <div>
          <div className={styles.myNm}>{M.name}</div>
          <div className={styles.myMeta}>{M.meta}</div>
        </div>
      </div>

      <div className={styles.mystat}>
        <div className={styles.mystatS}><div className={styles.mystatV}>{M.stats.entries}<span className={styles.mystatU}>회</span></div><div className={styles.mystatK}>총 출전</div></div>
        <div className={styles.mystatS}><div className={styles.mystatV}>{M.stats.awards}<span className={styles.mystatU}>회</span></div><div className={styles.mystatK}>수상</div></div>
        <div className={styles.mystatS}><div className={styles.mystatV}>{M.stats.best}<span className={styles.mystatU}>회</span></div><div className={styles.mystatK}>최고기록</div></div>
      </div>

      {M.nextHeat && (
        <div className={`${styles.dcard} ${styles.nextCard}`}>
          <div className={`${styles.lbl} ${styles.nextLbl}`}>⏱ 다음 출전</div>
          <div className={styles.nextMain}>{M.nextHeat.court}</div>
          <div className={styles.nextNote}>{M.nextHeat.note}</div>
        </div>
      )}

      <div className={styles.sec} style={{ marginTop: 20 }}>
        <h2 className={styles.secTitle}>직접 기록하기</h2>
        <span className={styles.cnt}>내 연습 일지</span>
      </div>
      <div className={styles.dcard}>
        <div className={styles.lbl}>스스로 입력한 연습 기록</div>
        {M.practice.map((p) => (
          <div key={p.id} className={styles.histrow}>
            <div className={styles.rk}>🏃</div>
            <div className={styles.info2}><div className={styles.info2T}>{p.type}</div><div className={styles.info2S}>{p.date}</div></div>
            <div className={styles.score}>{p.score}</div>
          </div>
        ))}
        <button className={styles.recbtn} onClick={onAddPractice}>＋ 오늘 연습 기록 추가</button>
      </div>

      <div className={styles.sec} style={{ marginTop: 20 }}>
        <h2 className={styles.secTitle}>내 출전 영상</h2>
        <span className={styles.cnt}>전체보기</span>
      </div>
      <div className={styles.hscroll}>
        {M.clips.map((c) => (
          <div key={c.id} className={styles.myclip}>
            <div className={styles.myclipT}>▶<span className={styles.dur}>{c.dur}</span></div>
            <div className={styles.myclipC}>{c.type}</div>
            <div className={styles.myclipD}>{c.from}</div>
          </div>
        ))}
      </div>

      <div className={styles.sec} style={{ marginTop: 20 }}>
        <h2 className={styles.secTitle}>이전 경기 참가 기록</h2>
      </div>
      <div className={styles.dcard}>
        {M.history.map((h) => (
          <div key={h.id} className={styles.histrow}>
            <div className={`${styles.rk} ${h.medal ? styles.rkMedal : ''}`}>{h.rank}</div>
            <div className={styles.info2}><div className={styles.info2T}>{h.title}</div><div className={styles.info2S}>{h.sub}</div></div>
            <div className={styles.score}>{h.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MyTab;
