import styles from '../ViewerApp.module.css';
import { CourtCard } from '../components/CourtCard';

// 라이브 중계 탭 — 실제 대회 데이터(코트 목록)에 연결
export function LiveTab({ courts, onOpenCourt }) {
  return (
    <div className={styles.pageFade}>
      <div className={styles.hero}>
        <div className={styles.heroK}>지금 생중계 중</div>
        <div className={styles.heroV}><b>{courts.length}개 코트</b> 중계</div>
        <div className={styles.heroSub}>보고 싶은 코트를 눌러 크게 볼 수 있어요</div>
      </div>

      <div className={styles.sec}>
        <h2 className={styles.secTitle}>코트별 중계</h2>
        <span className={styles.cnt}>전체 {courts.length}</span>
      </div>

      {courts.length === 0 ? (
        <div className={styles.muted} style={{ textAlign: 'center', padding: '40px 0' }}>등록된 코트가 없습니다</div>
      ) : (
        <div className={styles.grid}>
          {courts.map((station) => (
            <CourtCard key={station.id} station={station} onOpen={onOpenCourt} />
          ))}
        </div>
      )}
    </div>
  );
}

export default LiveTab;
