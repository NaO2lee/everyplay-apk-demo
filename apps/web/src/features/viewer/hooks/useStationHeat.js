import { useEffect, useRef, useState } from 'react';

// 한 코트(스테이션)의 실시간 경기 상태를 SSE로 받아오는 훅.
// 기존 ViewerEvent.jsx의 로직을 그대로 모듈화한 것.
export function useStationHeat(stationId) {
  const [heat, setHeat] = useState({
    status: 'idle',
    heat_number: null,
    participants: [],
    next_participants: [],
    event_type: null,
    division: null,
    started_at: null,
  });
  const esRef = useRef(null);

  useEffect(() => {
    if (!stationId) return undefined;
    // 데모(미리보기) 코트는 백엔드 SSE 없이 대기 상태로 렌더
    if (String(stationId).startsWith('demo')) return undefined;
    const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
    const url = `${baseUrl}/overlay/sse?station=${stationId}`;

    const apply = (data, fallbackStatus) => {
      setHeat((prev) => ({
        status: data.status ?? fallbackStatus ?? prev.status,
        heat_number: data.heat_number ?? prev.heat_number,
        participants: data.participants ?? prev.participants,
        next_participants: data.next_participants ?? prev.next_participants,
        event_type: data.event_type ?? prev.event_type,
        division: data.division ?? prev.division,
        started_at: data.started_at !== undefined ? data.started_at : prev.started_at,
      }));
    };

    const connect = () => {
      const es = new EventSource(url);
      esRef.current = es;
      es.addEventListener('snapshot', (e) => { try { apply(JSON.parse(e.data)); } catch { /* */ } });
      es.addEventListener('update', (e) => { try { apply(JSON.parse(e.data)); } catch { /* */ } });
      es.addEventListener('heat_start', (e) => { try { apply(JSON.parse(e.data), 'live'); } catch { /* */ } });
      es.addEventListener('heat_ended', () => {
        setHeat((prev) => ({ ...prev, status: 'idle', started_at: null }));
      });
      es.onerror = () => { es.close(); setTimeout(connect, 3000); };
    };
    connect();

    return () => { if (esRef.current) esRef.current.close(); };
  }, [stationId]);

  return heat;
}

// 유튜브 URL에서 영상 ID 추출 (기존 로직 동일)
export function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const pathMatch = u.pathname.match(/\/(live|embed)\/([^/?]+)/);
    if (pathMatch) return pathMatch[2];
    const v = u.searchParams.get('v');
    if (v) return v;
    if (u.hostname === 'youtu.be') return u.pathname.replace('/', '');
  } catch { /* ignore */ }
  return null;
}

export default useStationHeat;
