import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { trackCourtClick, trackSearchUse, trackSearchResultClick, trackEventView } from '../services/analytics';

function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const pathMatch = u.pathname.match(/\/(live|embed)\/([^/?]+)/);
    if (pathMatch) return pathMatch[2];
    const v = u.searchParams.get('v');
    if (v) return v;
    if (u.hostname === 'youtu.be') {
      return u.pathname.replace('/', '');
    }
  } catch { /* ignore */ }
  return null;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
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
  return <span className="font-mono text-lg tabular-nums">{elapsed}</span>;
}

function useStationHeat(stationId) {
  const [heat, setHeat] = useState({
    status: 'idle',
    heat_number: null,
    participants: [],
    next_participants: [],
    event_type: null,
    division: null,
    started_at: null,
  });
  const eventSourceRef = useRef(null);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
    const url = `${baseUrl}/overlay/sse?station=${stationId}`;

    const apply = (data, fallbackStatus) => {
      setHeat(prev => ({
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
      eventSourceRef.current = es;
      es.addEventListener('snapshot', (e) => { try { apply(JSON.parse(e.data)); } catch { /* */ } });
      es.addEventListener('update', (e) => { try { apply(JSON.parse(e.data)); } catch { /* */ } });
      es.addEventListener('heat_start', (e) => { try { apply(JSON.parse(e.data), 'live'); } catch { /* */ } });
      es.addEventListener('heat_ended', () => {
        setHeat(prev => ({ ...prev, status: 'idle', started_at: null }));
      });
      es.onerror = () => { es.close(); setTimeout(connect, 3000); };
    };
    connect();

    return () => { if (eventSourceRef.current) eventSourceRef.current.close(); };
  }, [stationId]);

  return heat;
}

function CourtCard({ station, onOpen, eventCode }) {
  const heat = useStationHeat(station.id);
  const videoId = extractYouTubeId(station.youtube_stream_url);
  const isLive = heat.status === 'live';

  const handleClick = () => {
    trackCourtClick({
      stationId: station.id,
      stationNumber: station.station_number,
      eventCode,
      isLive,
    });
    onOpen(station, heat);
  };

  return (
    <div
      onClick={handleClick}
      className="bg-white rounded-xl border overflow-hidden cursor-pointer hover:shadow-lg transition active:scale-[0.99]"
    >
      <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
        {videoId ? (
          <iframe
            className="absolute inset-0 w-full h-full pointer-events-none"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0`}
            title={`스테이션 ${station.station_number}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
            준비 중
          </div>
        )}
        {isLive && (
          <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-sm">코트 {station.station_number}</h3>
          {isLive && heat.heat_number != null && (
            <span className="text-xs text-gray-500">HIT {heat.heat_number}</span>
          )}
        </div>
        {heat.event_type && (
          <p className="text-xs text-gray-500 truncate">{heat.event_type}</p>
        )}
      </div>
    </div>
  );
}

function CourtDetailModal({ station, onClose }) {
  const heat = useStationHeat(station.id);
  const videoId = extractYouTubeId(station.youtube_stream_url);
  const isLive = heat.status === 'live';

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-xl overflow-hidden w-full max-w-4xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg">코트 {station.station_number}</h2>
            {isLive && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none px-2">×</button>
        </div>

        <div className="relative w-full bg-black" style={{ paddingTop: '56.25%' }}>
          {videoId ? (
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title={`스테이션 ${station.station_number} 큰화면`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">준비 중</div>
          )}
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {isLive ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-400">HIT</div>
                  <div className="text-xl font-bold">#{heat.heat_number ?? '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 text-right">경과</div>
                  <LiveTimer startedAt={heat.started_at} />
                </div>
              </div>
              {(heat.event_type || heat.division) && (
                <div className="text-sm text-gray-700">
                  <span className="font-medium">{heat.event_type || ''}</span>
                  {heat.division && <span className="text-gray-400 ml-2">{heat.division}</span>}
                </div>
              )}
              <div>
                <div className="text-xs text-gray-400 mb-1">현재 경기 중</div>
                <div className="flex flex-wrap gap-1.5">
                  {heat.participants.length === 0
                    ? <span className="text-gray-400 text-sm">-</span>
                    : heat.participants.map((p, i) => (
                        <span key={i} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-sm rounded-md">
                          {p.name || p}
                        </span>
                      ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-sm">현재 진행 중인 히트가 없습니다.</p>
          )}

          {heat.next_participants && heat.next_participants.length > 0 && (
            <div className="border-t pt-3">
              <div className="text-xs text-gray-400 mb-1">다음 대기</div>
              <div className="flex flex-wrap gap-1.5">
                {heat.next_participants.map((p, i) => (
                  <span key={i} className="px-2.5 py-1 bg-gray-100 text-gray-700 text-sm rounded-md">
                    {p.name || p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchPanel({ event, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    trackSearchUse({ eventCode: event.event_code });
    setLoading(true);
    setError(null);
    try {
      const res = await api.requestPublic(`/public/events/${event.event_code}/clips/search?q=${encodeURIComponent(q)}`);
      setResults(res.data || []);
    } catch (e) {
      if (e.message && e.message.includes('404')) {
        setError('검색 기능은 곧 제공됩니다.');
      } else {
        setError(e.message || '검색에 실패했습니다.');
      }
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-3 sm:p-6 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg mt-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-bold">선수 영상 찾기</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none px-2">×</button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
              placeholder="선수 이름을 입력하세요"
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              autoFocus
            />
            <button
              onClick={runSearch}
              disabled={loading || !query.trim()}
              className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
            >
              검색
            </button>
          </div>
          <p className="text-xs text-gray-400">
            라이브 종료 후 영상이 업로드되면 본인 출전 구간 링크를 찾을 수 있습니다.
          </p>

          {loading && <div className="text-center py-6 text-gray-400 text-sm">검색 중...</div>}
          {error && <div className="text-center py-4 text-sm text-orange-600">{error}</div>}

          {results && results.length === 0 && !loading && !error && (
            <div className="text-center py-6 text-gray-400 text-sm">검색 결과가 없습니다.</div>
          )}

          {results && results.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((r) => (
                <a
                  key={r.heat_id || r.clip_url}
                  href={r.clip_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackSearchResultClick({
                    eventCode: event.event_code,
                    stationNumber: r.station_number,
                    heatNumber: r.heat_number,
                    participantName: r.participant_name || r.name,
                  })}
                  className="block p-3 border rounded-lg hover:border-blue-300 hover:bg-blue-50 transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{r.participant_name || r.name}</span>
                    <span className="text-xs text-gray-400">코트 {r.station_number} · HIT {r.heat_number}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {r.event_type}{r.division ? ` · ${r.division}` : ''}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ViewerEvent() {
  const { eventCode } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openStation, setOpenStation] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await api.getPublicEventByCode(eventCode);
        setEvent(res.data);
        trackEventView({ eventCode, eventName: res.data?.name });
      } catch (e) {
        setError(e.message || '이벤트를 불러올 수 없습니다');
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [eventCode]);

  const courts = useMemo(
    () => (event?.stations || []).slice().sort((a, b) => a.station_number - b.station_number),
    [event]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
          로딩 중...
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg mb-4">{error || '이벤트를 찾을 수 없습니다'}</p>
          <button onClick={() => navigate('/')} className="text-blue-500 hover:text-blue-600 text-sm font-medium">
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const isActive = event.status === 'active';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600" aria-label="뒤로">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold truncate">{event.name}</h1>
                {isActive && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">{formatDate(event.date)}</p>
            </div>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 active:scale-95 transition"
              aria-label="선수 영상 찾기"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <span className="hidden sm:inline">선수 검색</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {courts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">등록된 코트가 없습니다</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {courts.map((station) => (
              <CourtCard key={station.id} station={station} onOpen={(s) => setOpenStation(s)} eventCode={event.event_code} />
            ))}
          </div>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-gray-300">
        모두의플레이 줄넘기 대회 시스템
      </footer>

      {openStation && <CourtDetailModal station={openStation} onClose={() => setOpenStation(null)} />}
      {searchOpen && <SearchPanel event={event} onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

export default ViewerEvent;
