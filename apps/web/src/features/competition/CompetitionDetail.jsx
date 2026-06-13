import { useNavigate } from 'react-router-dom';
import styles from './Competition.module.css';

/* 대회 상세 (데모) — /competition/demo.
   2026 전국 한마당 줄넘기대회 요강 기반. TODO(backend): 대회 상세 API로 교체. */

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

export function CompetitionDetail() {
  const navigate = useNavigate();
  const copyAccount = () => {
    try { navigator.clipboard.writeText('351-1172-5792-93'); alert('계좌번호가 복사됐어요'); } catch { /* ignore */ }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.bar}>
        <button className={styles.back} onClick={() => navigate(-1)} aria-label="뒤로">←</button>
        <span className={styles.barT}>대회 상세</span>
      </div>

      <div className={styles.scr}>
        <div className={styles.poster}>
          <img className={styles.posterImg} src="/brand/comp-poster.png" alt="2026 전국 한마당 줄넘기대회 요강" />
          <span className={styles.posterBadge}>접수중</span>
          <span className={styles.posterD}>D-7</span>
        </div>
        <a className={styles.pdfLink} href="/brand/comp-guide.pdf" target="_blank" rel="noreferrer">📄 대회요강 PDF 전체 보기 (17p)</a>

        <div className={styles.sec}>📋 대회 요강</div>
        <div className={styles.infoCard}>
          {INFO.map((r) => (
            <div key={r.k} className={styles.infoRow}>
              <span className={styles.infoIc}>{r.ic}</span>
              <span className={styles.infoK}>{r.k}</span>
              <span className={styles.infoV}>
                {r.hot ? <b>{r.v}</b> : r.v}
                {r.copy && <button className={styles.copyBtn} onClick={copyAccount}>복사</button>}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.sec}>🏷️ 종목</div>
        <div className={styles.evChips}>
          {EVENTS.map((e) => <span key={e} className={styles.evChip}>{e}</span>)}
        </div>

        <div className={styles.sec}>📢 안내</div>
        <div className={styles.notice}>
          · 스피드 종목 참가 시 프리스타일 중복 출전 가능<br />
          · 접수 완료 후 참가비 입금 시 참가 확정 (앱에서 신청 상태 확인 가능)<br />
          · 협찬: NARIA 줄넘기 (공식 지정 줄넘기)
        </div>
      </div>

      <div className={styles.cta}>
        <button className={styles.ctaFav} aria-label="관심 대회">★</button>
        <button className={styles.ctaBtn} onClick={() => navigate('/apply/demo')}>접수 신청하기 →</button>
      </div>
    </div>
  );
}

export default CompetitionDetail;
