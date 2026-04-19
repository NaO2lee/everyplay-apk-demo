import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '../services/api';
import { useModal } from '../components/Modal';

export function EventNew() {
  const navigate = useNavigate();
  const modal = useModal();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    station_count: 6,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      await modal.alert('대회명을 입력하세요');
      return;
    }

    try {
      setLoading(true);
      const response = await api.createEvent({
        name: form.name,
        date: form.date,
        station_count: parseInt(form.station_count),
      });
      // 생성 후 상세 페이지(설정)로 이동
      navigate(`/admin/events/${response.data.id}`);
    } catch (err) {
      await modal.alert('대회 생성 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/events')}
          className="p-2 hover:bg-gray-200 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold">새 대회 만들기</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-md mx-auto">
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              대회명 *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 2026 Korea Open"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              대회 날짜 *
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              스테이션 수
            </label>
            <select
              value={form.station_count}
              onChange={(e) => setForm({ ...form, station_count: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>{n}개</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {loading ? '생성 중...' : '대회 생성'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EventNew;
