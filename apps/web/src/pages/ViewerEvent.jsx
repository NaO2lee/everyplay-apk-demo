import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

/**
 * YouTube URL에서 video ID를 추출한다.
 * 지원 형식:
 *   https://youtube.com/live/ABC123
 *   https://www.youtube.com/watch?v=ABC123
 *   https://youtu.be/ABC123
 *   https://www.youtube.com/embed/ABC123
 */
function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    // /live/ID 또는 /embed/ID
    const pathMatch = u.pathname.match(/\/(live|embed)\/([^/?]+)/);
    if (pathMatch) return pathMatch[2];
    // /watch?v=ID
    const v = u.searchParams.get('v');
    if (v) return v;
    // youtu.be/ID
    if (u.hostname === 'youtu.be') {
      return u.pathname.replace('/', '');
    }
  } catch {
    // 잘못된 URL
  }
  return null;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

// ── 라이브 타이머 ──────────────────────────────────────

function LiveTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    if (!startedAt) {
      setElapsed('00:00');
      return;
    }

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

// ── 스테이션 카드 ──────────────────────────────────────────

function CourtCard({ station }) {
  const [heat, setHeat] = useState({
    status: 'idle',
    heat_number: null,
    participants: [],
    started_at: null,
  });

  const eventSourceRef = useRef(null);

  // SSE 연결
  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
    const url = `${baseUrl}/overlay/sse?station=${station.id}`;

    const connect = () => {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener('snapshot', (e) => {
        try {
          const data = JSON.parse(e.data);
          setHeat({
            status: data.status || 'idle',
            heat_number: data.heat_number,
            participants: data.participants || [],
            started_at: data.started_at,
          });
        } catch { /* ignore */ }
      });

      es.addEventListener('update', (e) => {
        try {
          const data = JSON.parse(e.data);
          setHeat((prev) => ({
            ...prev,
            status: data.status ?? prev.status,
            heat_number: data.heat_number ?? prev.heat_number,
            participants: data.participants ?? prev.participants,
            started_at: data.started_at !== undefined ? data.started_at : prev.started_at,
          }));
        } catch { /* ignore */ }
      });

      es.addEventListener('heat_start', (e) => {
        try {
          const data = JSON.parse(e.data);
          setHeat({
            status: 'live',
            heat_number: data.heat_number,
            participants: data.participants || [],
            started_at: data.started_at,
          });
        } catch { /* ignore */ }
      });

      es.addEventListener('heat_ended', () => {
        setHeat((prev) => ({
          ...prev,
          status: 'idle',
          started_at: null,
        }));
      });

      es.onerror = () => {
        es.close();
        // 3초 후 재연결
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [station.id]);

  const videoId = extractYouTubeId(station.youtube_stream_url);
  const isLive = heat.status === 'live';

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* YouTube 임베드 (16:9) */}
      <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
        {videoId ? (
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`}
            title={`스테이션 ${station.station_number}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2 text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <span className="text-sm">준비 중</span>
            </div>
          </div>
        )}
      </div>

      {/* 스테이션 정보 + 히트 상태 */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-base">스테이션 {station.station_number}</h3>
          {isLive ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
              대기
            </span>
          )}
        </div>

        {isLive && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Heat #{heat.heat_number}
              </span>
              <LiveTimer startedAt={heat.started_at} />
            </div>
            {heat.participants.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {heat.participants.map((p, i) => (
                  <span
                    key={i}
                    className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-md"
                  >
                    {p.name || p}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────

export function ViewerEvent() {
  const { eventCode } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await api.getPublicEventByCode(eventCode);
        setEvent(res.data);
      } catch (e) {
        setError(e.message || '이벤트를 불러올 수 없습니다');
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [eventCode]);

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
          <button
            onClick={() => navigate('/')}
            className="text-blue-500 hover:text-blue-600 text-sm font-medium"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const courts = (event.stations || []).sort((a, b) => a.station_number - b.station_number);
  const isActive = event.status === 'active';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="뒤로 가기"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold truncate">{event.name}</h1>
                {isActive && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400">{formatDate(event.date)}</p>
            </div>
          </div>
        </div>
      </header>

      {/* 스테이션 그리드 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {courts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            등록된 스테이션가 없습니다
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {courts.map((station) => (
              <CourtCard key={station.id} station={station} />
            ))}
          </div>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-gray-300">
        모두의플레이 줄넘기 대회 시스템
      </footer>
    </div>
  );
}

export default ViewerEvent;
