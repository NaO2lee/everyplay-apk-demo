import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await api.getPublicEvents();
        setEvents(res.data?.items || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const statusConfig = {
    draft: { label: '예정', color: 'bg-gray-100 text-gray-600' },
    active: { label: 'LIVE', color: 'bg-red-100 text-red-600' },
    completed: { label: '완료', color: 'bg-green-100 text-green-600' },
    cancelled: { label: '취소', color: 'bg-gray-100 text-gray-400' },
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">모두의플레이</h1>
        <p className="text-gray-400 text-sm">줄넘기 대회 라이브 스트리밍</p>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
            로딩 중...
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg mb-1">진행 중인 대회가 없습니다</p>
            <p className="text-sm">대회가 시작되면 이곳에 표시됩니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map(event => {
              const sc = statusConfig[event.status] || statusConfig.draft;
              return (
                <button
                  key={event.id}
                  onClick={() => navigate(`/events/${event.event_code}`)}
                  className="w-full text-left bg-white rounded-xl border hover:border-gray-300 hover:shadow-sm transition-all p-5 group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold group-hover:text-blue-600 transition-colors">
                      {event.name}
                    </h2>
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sc.color}`}>
                      {event.status === 'active' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      )}
                      {sc.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span>{formatDate(event.date)}</span>
                    <span className="text-gray-200">|</span>
                    <span>스테이션 {event.station_count}개</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <footer className="text-center py-8 text-xs text-gray-300">
        모두의플레이 줄넘기 대회 시스템
      </footer>
    </div>
  );
}

export default Home;
