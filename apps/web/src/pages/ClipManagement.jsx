import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Scissors, Download, Loader2, CheckCircle, XCircle, Clock, Upload } from 'lucide-react';
import { api } from '../services/api';
import { useModal } from '../components/Modal';

function formatTime(totalSec) {
  if (totalSec == null || !Number.isFinite(totalSec)) return '--:--';
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(Math.floor(totalSec % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
}

function StatusBadge({ status }) {
  const base = 'text-xs px-2 py-0.5 rounded font-medium inline-flex items-center gap-1';
  switch (status) {
    case 'ready':
      return <span className={`${base} bg-green-100 text-green-700`}><CheckCircle className="w-3 h-3" />완료</span>;
    case 'processing':
      return <span className={`${base} bg-blue-100 text-blue-700`}><Loader2 className="w-3 h-3 animate-spin" />자르는 중</span>;
    case 'pending':
      return <span className={`${base} bg-yellow-100 text-yellow-700`}><Clock className="w-3 h-3" />대기</span>;
    case 'failed':
      return <span className={`${base} bg-red-100 text-red-700`}><XCircle className="w-3 h-3" />실패</span>;
    case 'uploaded':
      return <span className={`${base} bg-red-100 text-red-700`}><Upload className="w-3 h-3" />YouTube</span>;
    case 'sent':
      return <span className={`${base} bg-purple-100 text-purple-700`}><CheckCircle className="w-3 h-3" />발송됨</span>;
    default:
      return <span className={`${base} bg-gray-100 text-gray-500`}>-</span>;
  }
}

export function ClipManagement() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const modal = useModal();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCourtId, setSelectedCourtId] = useState(null);
  const [heats, setHeats] = useState([]);
  const [heatsLoading, setHeatsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getEvent(eventId);
        setEvent(res.data);
        const configuredStations = (res.data?.stations || []).filter(c => c.recording_path || c.obs_configured);
        if (configuredStations.length > 0) {
          setSelectedCourtId(configuredStations[0].id);
        } else if ((res.data?.stations || []).length > 0) {
          setSelectedCourtId(res.data.stations[0].id);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  const loadHeats = async () => {
    if (!selectedCourtId) return;
    setHeatsLoading(true);
    try {
      const res = await api.getHeats(eventId, { courtId: selectedCourtId, perPage: 100 });
      const items = res?.data?.items || [];
      items.sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
      setHeats(items);
    } catch (e) {
      await modal.alert('히트 조회 실패: ' + e.message);
    } finally {
      setHeatsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCourtId) loadHeats();

  }, [selectedCourtId]);

  // 진행 중인 히트가 있으면 5초마다 상태 재조회
  useEffect(() => {
    const hasInFlight = heats.some(h => h.clip_status === 'pending' || h.clip_status === 'processing');
    if (!hasInFlight) return;
    const t = setInterval(loadHeats, 5000);
    return () => clearInterval(t);

  }, [heats, selectedCourtId]);

  const selectedStation = useMemo(
    () => event?.stations?.find(c => c.id === selectedCourtId),
    [event, selectedCourtId]
  );

  // 타임라인 길이: 마지막 히트 종료 오프셋 + 10초 여유. 없으면 60초.
  const timelineDuration = useMemo(() => {
    const ends = heats
      .map(h => h.obs_timecode_end ?? h.recording_offset_end)
      .filter(v => v != null);
    if (ends.length === 0) return 60;
    return Math.max(...ends) + 10;
  }, [heats]);

  const handleExtract = async (heat) => {
    try {
      await api.extractHeatClip(heat.id);
      loadHeats();
    } catch (e) {
      await modal.alert('자르기 요청 실패: ' + e.message);
    }
  };

  const handleExtractAll = async () => {
    const targets = heats.filter(h => h.clip_status !== 'processing' && h.clip_status !== 'ready');
    if (targets.length === 0) {
      await modal.alert('자를 히트가 없습니다.');
      return;
    }
    if (!await modal.confirm(`${targets.length}개 히트를 모두 자릅니다. 진행할까요?`)) return;
    for (const h of targets) {
      try { await api.extractHeatClip(h.id); } catch (_) {}
    }
    loadHeats();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-red-600">{error}</div>
    );
  }

  const sortedStations = [...(event?.stations || [])].sort((a, b) => a.station_number - b.station_number);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/admin/events/${eventId}`)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">{event?.name} — 클립 추출</h1>
              <p className="text-sm text-gray-500">스테이션별 녹화 파일에서 히트 구간을 잘라냅니다.</p>
            </div>
          </div>

          <div className="flex gap-1 mt-4 -mb-px flex-wrap">
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
        {selectedStation && (
          <>
            <div className="bg-white border rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-semibold mb-1">녹화 파일</h2>
                  <p className="text-sm text-gray-500 font-mono break-all">
                    {selectedStation.recording_path || <span className="text-gray-400">없음 (아직 녹화 종료되지 않음)</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    대략 길이: {formatTime(timelineDuration - 10)} (마지막 히트 종료 시점 기준)
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={loadHeats}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    <RefreshCw className={`w-4 h-4 ${heatsLoading ? 'animate-spin' : ''}`} />
                    새로고침
                  </button>
                  <button
                    onClick={handleExtractAll}
                    disabled={heats.length === 0}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm"
                  >
                    <Scissors className="w-4 h-4" />
                    전체 자르기
                  </button>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white border rounded-lg p-4">
              <h2 className="font-semibold mb-3">타임라인</h2>
              <div className="relative h-16 bg-gray-100 rounded">
                {heats.map(heat => {
                  const start = heat.obs_timecode_start ?? heat.recording_offset_start;
                  const end = heat.obs_timecode_end ?? heat.recording_offset_end;
                  if (start == null || end == null) return null;
                  const leftPct = (start / timelineDuration) * 100;
                  const widthPct = Math.max(0.5, ((end - start) / timelineDuration) * 100);
                  const color = {
                    ready: 'bg-green-500',
                    processing: 'bg-blue-500',
                    pending: 'bg-yellow-500',
                    failed: 'bg-red-500',
                    sent: 'bg-purple-500',
                  }[heat.clip_status] || 'bg-gray-400';
                  return (
                    <div
                      key={heat.id}
                      className={`absolute top-1 bottom-1 ${color} rounded text-xs text-white flex items-center justify-center overflow-hidden`}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: '14px' }}
                      title={`HIT ${heat.heat_number} · ${formatTime(start)} ~ ${formatTime(end)}`}
                    >
                      H{heat.heat_number}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>00:00</span>
                <span>{formatTime(timelineDuration)}</span>
              </div>
            </div>

            {/* Heat list */}
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">HIT</th>
                    <th className="text-left px-4 py-2">참가자</th>
                    <th className="text-left px-4 py-2">구간 (파일 내부)</th>
                    <th className="text-left px-4 py-2">길이</th>
                    <th className="text-left px-4 py-2">상태</th>
                    <th className="text-right px-4 py-2">동작</th>
                  </tr>
                </thead>
                <tbody>
                  {heats.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">히트 없음</td>
                    </tr>
                  )}
                  {heats.map(heat => {
                    const start = heat.obs_timecode_start ?? heat.recording_offset_start;
                    const end = heat.obs_timecode_end ?? heat.recording_offset_end;
                    const duration = (end != null && start != null) ? (end - start) : null;
                    const canExtract = start != null && end != null &&
                      heat.clip_status !== 'processing' && heat.clip_status !== 'pending';
                    return (
                      <tr key={heat.id} className="border-t">
                        <td className="px-4 py-3 font-mono font-semibold">#{heat.heat_number}</td>
                        <td className="px-4 py-3 text-gray-600 truncate max-w-xs">
                          {heat.participants?.map(p => p.name).join(', ') || <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {start != null && end != null
                            ? `${formatTime(start)} ~ ${formatTime(end)}`
                            : <span className="text-gray-400">없음</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{duration != null ? `${duration.toFixed(1)}s` : '-'}</td>
                        <td className="px-4 py-3"><StatusBadge status={heat.clip_status} /></td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            {heat.clip_status === 'ready' && heat.clip_path && (
                              <>
                                <a
                                  href={`file://${heat.clip_path}`}
                                  className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                                  title={heat.clip_path}
                                >
                                  <Download className="w-3 h-3" />
                                  경로
                                </a>
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await api.uploadHeatToYouTube(heat.id);
                                      await modal.alert('업로드 완료: ' + (res.data?.url || ''));
                                      loadHeats();
                                    } catch (e) {
                                      await modal.alert('YouTube 업로드 실패: ' + e.message);
                                    }
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                >
                                  <Upload className="w-3 h-3" />
                                  YouTube
                                </button>
                              </>
                            )}
                            {heat.clip_status === 'uploaded' && heat.clip_url && (
                              <a
                                href={heat.clip_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                              >
                                <Upload className="w-3 h-3" />
                                YouTube 링크
                              </a>
                            )}
                            <button
                              onClick={() => handleExtract(heat)}
                              disabled={!canExtract}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Scissors className="w-3 h-3" />
                              자르기
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ClipManagement;
