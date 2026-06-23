import styles from '../ViewerApp.module.css';
import { useStationHeat } from '../hooks/useStationHeat';

// 코트 한 줄 (컴팩트 3열: 코트명 / 상태 / 보기). 큰 영상은 탭하면 시트에서.
export function CourtCard({ station, onOpen }) {
  const heat = useStationHeat(station.id);
  const isLive = heat.status === 'live';
  const current = heat.participants?.[0];
  const currentName = current?.name || current;

  return (
    <button className={styles.courtRow} onClick={() => onOpen(station)}>
      <span className={styles.crCol}>
        <span className={styles.crNum}>코트 {station.station_number}</span>
        {currentName && <span className={styles.crEv}>{currentName}</span>}
      </span>
      <span className={isLive ? styles.crLive : styles.crWait}>
        {isLive ? <><span className={styles.dot} />LIVE</> : '대기중'}
      </span>
      <span className={styles.crPlay}>▶ 보기 ›</span>
    </button>
  );
}

export default CourtCard;
