import { useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '../../services/api';
import { useModal } from '../Modal';

export function EventInfo({ event, onUpdate }) {
  const modal = useModal();
  const [form, setForm] = useState({
    name: event?.name || '',
    date: event?.date || '',
    end_date: event?.end_date || '',
    status: event?.status || 'draft',
    station_count: event?.station_count || 6,
    memo: event?.memo || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.updateEvent(event.id, form);
      const refreshed = await api.getEvent(event.id);
      onUpdate(refreshed.data);
      await modal.alert('저장되었습니다.');
    } catch (e) {
      await modal.alert('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          기본정보 <span className="text-sm font-normal text-gray-400 ml-2">(대회코드: <span className="font-mono">{event?.event_code}</span>)</span>
        </h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm"
        >
          <Save className="w-4 h-4" />
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">대회명</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              종료일 <span className="text-xs text-gray-400 font-normal">(1일 대회면 비워두세요)</span>
            </label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="draft">준비중</option>
              <option value="active">진행중</option>
              <option value="completed">완료</option>
              <option value="cancelled">취소</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              스테이션 수 <span className="text-xs text-orange-500 font-normal">(변경 시 OBS 설정 초기화)</span>
            </label>
            <select
              value={form.station_count}
              onChange={(e) => setForm({ ...form, station_count: parseInt(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>{n}개</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            메모 <span className="text-xs text-gray-400 font-normal">(스트림키, 비고 등)</span>
          </label>
          <textarea
            value={form.memo}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
            placeholder="자유 메모"
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

export default EventInfo;
