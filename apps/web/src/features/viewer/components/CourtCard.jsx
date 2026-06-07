import styles from '../ViewerApp.module.css';
import { useStationHeat, extractYouTubeId } from '../hooks/useStationHeat';

// 코트 한 칸 (실시간 상태 + 영상 썸네일). 영상 없으면 버튼형 안내.
export function CourtCard({ station, onOpen }) {
  const heat = useStationHeat(station.id);
  const videoId = extractYouTubeId(station.youtube_stream_url);
  const isLive = heat.status === 'live';
  const current = heat.participants?.[0];
  const currentName = current?.name || current;

  return (
    <div className={`${styles.court} ${isLive ? '' : styles.idle}`} onClick={() => onOpen(station)}>
      <div className={styles.thumb}>
        {videoId ? (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0`}
            title={`코트 ${station.station_number}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : (
          <div className={styles.novid}>
            <span className={styles.novidIc}>📹</span>
            <span className={styles.novidB}>영상 준비 중 · 알림받기</span>
          </div>
        )}
        {isLive && <span className={styles.badge}><span className={styles.dot} />LIVE</span>}
      </div>
      <div className={styles.info}>
        <div className={styles.ct}>
          <span className={styles.ctName}>코트 {station.station_number}</span>
          {isLive && heat.heat_number != null && <span className={styles.hit}>HIT {heat.heat_number}</span>}
        </div>
        <div className={styles.ev}>{heat.event_type || (isLive ? '경기 중' : '대기 중')}</div>
        {isLive && currentName && (
          <div className={styles.who}>
            <span className={styles.whoAv}>{String(currentName).charAt(0)}</span>
            <span className={styles.whoName}>{currentName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default CourtCard;
