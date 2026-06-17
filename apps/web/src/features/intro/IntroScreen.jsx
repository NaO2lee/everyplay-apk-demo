import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import styles from './Intro.module.css';

/* 앱 시작 인트로 (데모) — /intro/demo.
   WEPLAY 로고가 은은한 글로우와 함께 드러나는 미니멀 인트로(PROGIO식). 줄넘기 연출은 제외.
   스플래시 다음 1회 노출 후 자동으로 앱(홈)으로. 화면 탭 시 즉시 진입. */

export function IntroScreen() {
  const navigate = useNavigate();
  const [run, setRun] = useState(0); // 다시보기 = 리마운트 키로 애니메이션·타이머 재시작
  const dark = (typeof document !== 'undefined' ? document.documentElement.dataset.theme : 'dark') !== 'light';
  const wordmark = dark ? '/brand/weplay-wordmark-white.png' : '/brand/weplay-wordmark-navy.png';
  const enter = () => navigate('/app/demo');

  // 자동 전환 (로고 리빌 끝나고 앱으로). 탭하면 즉시.
  useEffect(() => {
    const id = setTimeout(() => navigate('/app/demo'), 3000);
    return () => clearTimeout(id);
  }, [navigate, run]);

  return (
    <div className={styles.screen} key={run}>
      <div className={styles.center}>
        <div className={styles.glow} />
        <img className={styles.logo} src={wordmark} alt="WEPLAY 모두의플레이" />
        <div className={styles.tagline}>Play for everyone</div>
        <div className={styles.sub}>줄넘기 대회 · 실시간 중계 · AI 기록</div>
      </div>

      {/* 탭하면 앱으로 (실제 앱에선 자동 전환) */}
      <button className={styles.tapArea} onClick={enter} aria-label="시작하기" />
      <div className={styles.skip}>화면을 누르면 시작 →</div>

      <button className={styles.replay} onClick={(e) => { e.stopPropagation(); setRun((n) => n + 1); }}>
        <RotateCcw size={13} /> 다시보기
      </button>
    </div>
  );
}

export default IntroScreen;
