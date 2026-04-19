import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Calendar, ChevronRight, RefreshCw } from 'lucide-react';

import { api } from '../services/api';

const STATUS_BADGE = {
  draft: { color: 'bg-gray-100 text-gray-600', text: '준비중' },
  active: { color: 'bg-green-100 text-green-600', text: '진행중' },
  completed: { color: 'bg-blue-100 text-blue-600', text: '완료' },
  cancelled: { color: 'bg-red-100 text-red-600', text: '취소' },
};

export function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await api.getEvents();
      setEvents(response.data.items);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">대회 목록</h1>
        <Link
          to="/admin/events/new"
          className="flex items-center gap-2 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600"
        >
          <Plus className="w-5 h-5" />
          새 대회
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-100 text-red-600 p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Event list */}
      <div className="space-y-3">
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            등록된 대회가 없습니다
          </div>
        ) : (
          events.map((event) => {
            const badge = STATUS_BADGE[event.status] || STATUS_BADGE.draft;
            return (
              <button
                key={event.id}
                onClick={() => navigate(`/admin/events/${event.id}`)}
                className="w-full bg-white rounded-lg border px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-left">
                    <h2 className="font-semibold text-sm">{event.name}</h2>
                    <p className="text-xs text-gray-500">{event.date} · 스테이션 {event.station_count}개</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-sm ${badge.color}`}>
                    {badge.text}
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default EventList;
