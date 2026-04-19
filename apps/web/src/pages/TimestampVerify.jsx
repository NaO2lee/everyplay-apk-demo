import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { useModal } from '../components/Modal';

function fmt(sec) {
  if (sec == null || !Number.isFinite(sec)) return '-';
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  const ms = String(Math.floor((sec * 10) % 10));
  return `${m}:${s}.${ms}`;
}

function DiffBadge({ a, b, label }) {
  if (a == null || b == null) return <span className="text-xs text-gray-400">-</span>;
  const diff = Math.abs(a - b);
  const ok = diff < 2;
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${ok ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
      {diff < 0.1 ? '0.0' : diff.toFixed(1)}s {ok ? '' : '(!)'} {label}
    </span>
  );
}

export function TimestampVerify() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const modal = useModal();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCourtId, setSelectedCourtId] = useState(null);
  const [heats, setHeats] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getEvent(eventId);
        setEvent(res.data);
        const courts = res.data?.stations || [];
        if (courts.length > 0) setSelectedCourtId(courts[0].id);
      } catch (e) {
        await modal.alert('이벤트 로드 실패: ' + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  useEffect(() => {
    if (!selectedCourtId) return;
    (async () => {
      try {
        const res = await api.getHeats(eventId, { courtId: selectedCourtId, perPage: 100 });
        const items = (res?.data?.items || []).sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
        setHeats(items);
      } catch (_) {}
    })();
  }, [selectedCourtId, eventId]);

  const selectedStation = useMemo(
    () => event?.stations?.find(c => c.id === selectedCourtId),
    [event, selectedCourtId]
  );

  const sortedStations = useMemo(
    () => [...(event?.stations || [])].sort((a, b) => a.station_number - b.station_number),
    [event]
  );

  const stats = useMemo(() => {
    const completedHeats = heats.filter(h => h.status === 'completed');
    const withObsRec = completedHeats.filter(h => h.obs_timecode_start != null && h.obs_timecode_end != null);
    const withObsStream = completedHeats.filter(h => h.obs_stream_timecode_start != null);
    const withServerOffset = completedHeats.filter(h => h.recording_offset_start != null && h.recording_offset_end != null);

    // 서버 오프셋 vs OBS 타임코드 차이 (start 기준)
    const diffs = completedHeats
      .filter(h => h.recording_offset_start != null && h.obs_timecode_start != null)
      .map(h => Math.abs(h.recording_offset_start - h.obs_timecode_start));
    const avgDiff = diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null;
    const maxDiff = diffs.length > 0 ? Math.max(...diffs) : null;

    return {
      total: completedHeats.length,
      withObsRec: withObsRec.length,
      withObsStream: withObsStream.length,
      withServerOffset: withServerOffset.length,
      avgDiff,
      maxDiff,
    };
  }, [heats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/admin/events/${eventId}`)} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">{event?.name} — 타임스탬프 검증</h1>
              <p className="text-sm text-gray-500">서버 시계 오프셋 vs OBS 직접 타임코드 비교</p>
            </div>
          </div>
          <div className="flex gap-1 mt-4 -mb-px">
            {sortedStations.map(station => (
              <button
                key={station.id}
                onClick={() => setSelectedCourtId(station.id)}
                className={`px-4 py-2 border-b-2 text-sm ${
                  selectedCourtId === station.id
                    ? 'border-blue-500 text-blue-600 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                스테이션 {station.station_number}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-gray-500">완료 히트</div>
          </div>
          <div className="bg-white border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.withObsRec}</div>
            <div className="text-xs text-gray-500">녹화 타임코드</div>
          </div>
          <div className="bg-white border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.withObsStream}</div>
            <div className="text-xs text-gray-500">스트림 타임코드</div>
          </div>
          <div className="bg-white border rounded-lg p-4 text-center">
            <div className={`text-2xl font-bold ${stats.avgDiff != null && stats.avgDiff < 2 ? 'text-green-600' : 'text-yellow-600'}`}>
              {stats.avgDiff != null ? stats.avgDiff.toFixed(1) + 's' : '-'}
            </div>
            <div className="text-xs text-gray-500">평균 오차 (서버 vs OBS)</div>
          </div>
        </div>

        {stats.maxDiff != null && stats.maxDiff >= 2 && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            최대 오차 {stats.maxDiff.toFixed(1)}초 — 서버 시계와 OBS 사이에 유의미한 차이가 있습니다. 클립 추출 시 OBS 타임코드 기준 사용을 권장합니다.
          </div>
        )}

        {stats.total > 0 && stats.avgDiff != null && stats.avgDiff < 2 && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            <CheckCircle className="w-4 h-4 shrink-0" />
            서버 시계와 OBS 타임코드가 평균 {stats.avgDiff.toFixed(1)}초 이내로 일치합니다. 정상 범위.
          </div>
        )}

        {/* 히트 상세 테이블 */}
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">HIT</th>
                <th className="text-left px-3 py-2">시작 시각</th>
                <th className="text-left px-3 py-2">길이</th>
                <th className="text-left px-3 py-2">서버 오프셋 (시작~끝)</th>
                <th className="text-left px-3 py-2">OBS 녹화 TC (시작~끝)</th>
                <th className="text-left px-3 py-2">OBS 스트림 TC</th>
                <th className="text-left px-3 py-2">오차</th>
                <th className="text-left px-3 py-2">YouTube ts</th>
              </tr>
            </thead>
            <tbody>
              {heats.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">히트 없음</td></tr>
              )}
              {heats.map(h => {
                const dur = h.duration_seconds;
                const started = h.started_at ? new Date(h.started_at).toLocaleTimeString('ko-KR') : '-';
                return (
                  <tr key={h.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono font-semibold">#{h.heat_number}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{started}</td>
                    <td className="px-3 py-2 font-mono text-xs">{dur != null ? dur + 's' : '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {fmt(h.recording_offset_start)} ~ {fmt(h.recording_offset_end)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {fmt(h.obs_timecode_start)} ~ {fmt(h.obs_timecode_end)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {fmt(h.obs_stream_timecode_start)}
                    </td>
                    <td className="px-3 py-2">
                      <DiffBadge a={h.recording_offset_start} b={h.obs_timecode_start} label="녹화" />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 font-mono">{h.youtube_timestamp || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TimestampVerify;
