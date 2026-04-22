import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Grid3x3, Maximize2 } from 'lucide-react';
import { api } from '../services/api';

function extractYouTubeId(url) {
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

function LiveTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState('00:00');
  useEffect(() => {
    if (!startedAt) { setElapsed('00:00'); return; }
    const startMs = new Date(startedAt).getTime();
    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const m = String(Math.floor(diff / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      setElapsed(`${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span className="font-mono tabular-nums">{elapsed}</span>;
}

function useAllStationHeats(stations) {
  const [heatsByStation, setHeatsByStation] = useState({});
  const sourcesRef = useRef([]);

  useEffect(() => {
    sourcesRef.current.forEach(es => es.close());
    sourcesRef.current = [];
    if (!stations || stations.length === 0) return;

    const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';

    stations.forEach(station => {
      let es;
      const connect = () => {
        es = new EventSource(`${baseUrl}/overlay/sse?station=${station.id}`);
        sourcesRef.current.push(es);

        const apply = (data, fallbackStatus) => {
          setHeatsByStation(prev => ({
            ...prev,
            [station.id]: {
              status: data.status ?? fallbackStatus ?? prev[station.id]?.status ?? 'idle',
              heat_number: data.heat_number ?? prev[station.id]?.heat_number ?? null,
              participants: data.participants ?? prev[station.id]?.participants ?? [],
              event_type: data.event_type ?? prev[station.id]?.event_type ?? null,
              division: data.division ?? prev[station.id]?.division ?? null,
              started_at: data.started_at !== undefined ? data.started_at : prev[station.id]?.started_at ?? null,
            },
          }));
        };

        es.addEventListener('snapshot', (e) => {
          try { apply(JSON.parse(e.data)); } catch { /* ignore */ }
        });
        es.addEventListener('update', (e) => {
          try { apply(JSON.parse(e.data)); } catch { /* ignore */ }
        });
        es.addEventListener('heat_start', (e) => {
          try { apply(JSON.parse(e.data), 'live'); } catch { /* ignore */ }
        });
        es.addEventListener('heat_ended', () => {
          setHeatsByStation(prev => ({
            ...prev,
            [station.id]: { ...(prev[station.id] || {}), status: 'idle', started_at: null },
          }));
        });
        es.onerror = () => {
          es.close();
          setTimeout(connect, 3000);
        };
      };
      connect();
    });

    return () => {
      sourcesRef.current.forEach(es => es.close());
      sourcesRef.current = [];
    };
  }, [stations]);

  return heatsByStation;
}

function VideoFrame({ station, isLive }) {
  const videoId = extractYouTubeId(station.youtube_stream_url);
  return (
    <div className="absolute inset-0 bg-black">
      {videoId ? (
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`}
          title={`스테이션 ${station.station_number}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
          준비 중
        </div>
      )}
      {isLive && (
        <span className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </span>
      )}
    </div>
  );
}

function StationCard({ station, heat, onDoubleClick, label }) {
  const isLive = heat?.status === 'live';
  return (
    <div
      onDoubleClick={onDoubleClick}
      className="relative cursor-pointer rounded-lg overflow-hidden border border-gray-700 hover:border-blue-400 transition group"
      style={{ aspectRatio: '16 / 9' }}
      title="더블클릭하면 크게 보기"
    >
      <VideoFrame station={station} isLive={isLive} />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 text-white">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold">{label}</span>
          {isLive && heat?.heat_number != null && (
            <span className="opacity-90">HIT {heat.heat_number}</span>
          )}
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition pointer-events-none">
        <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-80 transition" />
      </div>
    </div>
  );
}

function ThumbCard({ station, heat, onClick, label, isActive }) {
  const isLive = heat?.status === 'live';
  return (
    <div
      onClick={onClick}
      className={`relative cursor-pointer rounded-md overflow-hidden border-2 transition ${
        isActive ? 'border-blue-400' : 'border-gray-700 hover:border-gray-400'
      }`}
      style={{ aspectRatio: '16 / 9' }}
    >
      <VideoFrame station={station} isLive={isLive} />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1 text-white text-xs font-bold">
        {label}
      </div>
    </div>
  );
}

function InfoBar({ station, heat }) {
  if (!station) return null;
  const isLive = heat?.status === 'live';
  const participants = heat?.participants || [];
  return (
    <div className="bg-gray-900 border-t-2 border-blue-500 text-white px-6 py-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold tabular-nums">코트 {station.station_number}</div>
          <div className="h-10 w-px bg-gray-600" />
          <div>
            <div className="text-xs text-gray-400 mb-0.5">종목 / 참가부</div>
            <div className="text-lg font-semibold">
              {heat?.event_type || '—'}
              {heat?.division ? <span className="text-gray-400 font-normal text-base ml-2">{heat.division}</span> : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">HIT</div>
            <div className="text-2xl font-bold tabular-nums">
              {heat?.heat_number != null ? `#${heat.heat_number}` : '—'}
            </div>
          </div>
          {isLive && (
            <div>
              <div className="text-xs text-gray-400 mb-0.5">경과</div>
              <div className="text-2xl font-bold">
                <LiveTimer startedAt={heat.started_at} />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-800">
        <div className="text-xs text-gray-400 mb-1">선수</div>
        {participants.length === 0 ? (
          <div className="text-gray-500 text-sm">대기 중</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {participants.map((p, i) => (
              <span key={i} className="px-3 py-1 rounded-full bg-blue-600/30 text-blue-100 text-sm font-medium">
                {p.name || p}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Scoreboard() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mainStationId, setMainStationId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getEvent(eventId);
        setEvent(res.data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  const stations = useMemo(
    () => (event?.stations || []).slice().sort((a, b) => a.station_number - b.station_number),
    [event]
  );

  const heatsByStation = useAllStationHeats(stations);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setMainStationId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mainStation = stations.find(s => s.id === mainStationId) || null;
  const mainHeat = mainStation ? heatsByStation[mainStation.id] : null;
  const thumbStations = stations.filter(s => s.id !== mainStationId);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-gray-400">
        로딩 중...
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <header className="bg-gray-950 border-b border-gray-800 text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/admin/events/${eventId}`)}
            className="p-1.5 rounded hover:bg-gray-800"
            aria-label="뒤로"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold">{event?.name} — 전광판</h1>
        </div>
        {mainStationId !== null && (
          <button
            onClick={() => setMainStationId(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded"
            title="ESC"
          >
            <Grid3x3 className="w-4 h-4" />
            전체 보기
          </button>
        )}
      </header>

      <main className="flex-1 p-4 overflow-hidden">
        {mainStationId === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 h-full">
            {stations.map(station => (
              <StationCard
                key={station.id}
                station={station}
                heat={heatsByStation[station.id]}
                onDoubleClick={() => setMainStationId(station.id)}
                label={`코트 ${station.station_number}`}
              />
            ))}
            {stations.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-20">
                등록된 코트가 없습니다
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-3 h-full">
            <div className="flex-1 relative rounded-lg overflow-hidden border border-gray-700">
              {mainStation && (
                <VideoFrame station={mainStation} isLive={mainHeat?.status === 'live'} />
              )}
            </div>
            <div className="w-56 flex flex-col gap-2 overflow-y-auto">
              {thumbStations.map(station => (
                <ThumbCard
                  key={station.id}
                  station={station}
                  heat={heatsByStation[station.id]}
                  onClick={() => setMainStationId(station.id)}
                  label={`코트 ${station.station_number}`}
                  isActive={false}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      <InfoBar station={mainStation} heat={mainHeat} />
    </div>
  );
}

export default Scoreboard;
