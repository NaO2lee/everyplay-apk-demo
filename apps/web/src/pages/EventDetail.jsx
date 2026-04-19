import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Settings, Users, Play, Edit, Layers, Scissors, Clock } from 'lucide-react';
import { api } from '../services/api';
import { useModal } from '../components/Modal';

import EventInfo from '../components/tabs/EventInfo';
import StationSettings from '../components/tabs/StationSettings';
import OverlaySettings from '../components/tabs/OverlaySettings';
import ParticipantList from '../components/tabs/ParticipantList';
import HeatSchedule from '../components/tabs/HeatSchedule';
import { List } from 'lucide-react';

const TABS = [
  { id: 'info', label: '기본정보', icon: Edit },
  { id: 'stations', label: '스테이션설정', icon: Settings },
  { id: 'overlay', label: '오버레이', icon: Layers },
  { id: 'participants', label: '참가자', icon: Users },
  { id: 'schedule', label: '대진', icon: List },
];

export function EventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const modal = useModal();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [operationLoading, setOperationLoading] = useState(false);

  const loadEvent = async () => {
    try {
      setLoading(true);
      const response = await api.getEvent(eventId);
      setEvent(response.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) loadEvent();
  }, [eventId]);

  const handleEventUpdate = (updatedEvent) => setEvent(updatedEvent);

  // 운영 모드 진입 가능 여부
  const configuredStations = event?.stations?.filter(c => c.obs_configured) || [];
  const isOperating = event?.stations?.some(s => s.recording_started_at) || false;
  const [obsConnected, setObsConnected] = useState({});

  // OBS 연결 상태 확인 (페이지 로드 + 탭 전환 + 테스트 후)
  const checkObsStatus = async () => {
    if (configuredStations.length === 0) return;
    try {
      const res = await api.obsStatus();
      const map = {};
      (res.data || []).forEach(s => { map[s.station_id] = s.connected; });
      setObsConnected(map);
    } catch {}
  };

  useEffect(() => { checkObsStatus(); }, [event]);
  useEffect(() => { checkObsStatus(); }, [activeTab]);

  const allConfiguredConnected = configuredStations.length > 0 &&
    configuredStations.every(s => obsConnected[s.id]);

  const handleStartOperation = async () => {
    // Determine competition date from programs
    let selectedDate = null;
    try {
      const progRes = await api.getPrograms(eventId);
      const programs = progRes?.data?.items || progRes?.data || [];
      const dates = [...new Set(programs.map(p => p.competition_date).filter(Boolean))].sort();
      if (dates.length > 1) {
        const selected = await modal.select('대회 일자를 선택하세요', dates.map(d => ({ label: d, value: d })));
        if (!selected) return;
        selectedDate = selected;
      } else if (dates.length === 1) {
        selectedDate = dates[0];
      }
    } catch (_) {
      // Programs not available — proceed without date
    }

    setOperationLoading(true);
    try {
      // 1. OBS 클라이언트 재로드
      await api.obsReload();
      // 2. 각 스테이션 OBS 연결 시도
      for (const station of configuredStations) {
        const res = await api.obsConnectStation(station.id);
        if (!res.data.connected) {
          throw new Error(`스테이션 ${station.station_number} OBS 연결 실패: ${res.data.last_error || 'unknown'}`);
        }
      }
      // 3. 이벤트 운영 시작 (모든 스테이션 OBS에 녹화+스트리밍 명령)
      await api.obsStartEvent(eventId, selectedDate);
      // 4. 운영 대시보드로 이동 (with date if available)
      const dateParam = selectedDate ? `?date=${selectedDate}` : '';
      navigate(`/admin/events/${eventId}/dashboard${dateParam}`);
    } catch (e) {
      console.error('운영 시작 실패:', e);
      await modal.alert('운영 시작 실패: ' + (e.message || '알 수 없는 오류'));
    } finally {
      setOperationLoading(false);
    }
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
      <div className="min-h-screen bg-gray-50 p-4">
        <button onClick={() => navigate('/admin/events')} className="flex items-center gap-2 text-gray-600 mb-4">
          <ArrowLeft className="w-5 h-5" /> 목록으로
        </button>
        <div className="bg-red-100 text-red-600 p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin/events')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold">{event?.name}</h1>
                <p className="text-sm text-gray-500">
                  {event?.date} · 스테이션 {event?.station_count}개 · OBS 설정 {configuredStations.length}/{event?.stations?.length || 0}
                </p>
                {configuredStations.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {configuredStations.map(s => (
                      <span key={s.id} className={`text-xs px-1.5 py-0.5 rounded ${
                        obsConnected[s.id] === true ? 'bg-green-100 text-green-700' :
                        obsConnected[s.id] === false ? 'bg-red-100 text-red-600' :
                        'bg-gray-100 text-gray-400'
                      }`}>
                        ST{s.station_number} {obsConnected[s.id] === true ? 'OK' : obsConnected[s.id] === false ? 'X' : '...'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/admin/events/${eventId}/clips`)}
                className="flex items-center gap-2 py-2 px-4 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                <Scissors className="w-5 h-5" />
                클립
              </button>
              <button
                onClick={() => navigate(`/admin/events/${eventId}/timestamps`)}
                className="flex items-center gap-2 py-2 px-4 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                <Clock className="w-5 h-5" />
                검증
              </button>
              {isOperating ? (
                <button
                  onClick={() => navigate(`/admin/events/${eventId}/dashboard`)}
                  className="flex items-center gap-2 py-2 px-4 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
                >
                  <Play className="w-5 h-5" />
                  대시보드로 이동
                </button>
              ) : (
                <button
                  onClick={handleStartOperation}
                  disabled={!allConfiguredConnected || operationLoading}
                  className={`flex items-center gap-2 py-2 px-4 rounded-lg ${
                    allConfiguredConnected && !operationLoading
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  title={!allConfiguredConnected ? '스테이션 설정 탭에서 OBS 테스트를 먼저 통과하세요' : ''}
                >
                  <Play className="w-5 h-5" />
                  {operationLoading ? '시작 중...' : '운영 시작'}
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-1 mt-4 -mb-px">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 border-b-2 transition ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === 'info' && <EventInfo event={event} onUpdate={handleEventUpdate} />}
        {activeTab === 'stations' && <StationSettings event={event} onUpdate={handleEventUpdate} onObsStatusChange={checkObsStatus} />}
        {activeTab === 'overlay' && <OverlaySettings event={event} onUpdate={handleEventUpdate} />}
        {activeTab === 'participants' && <ParticipantList eventId={eventId} />}
        {activeTab === 'schedule' && <HeatSchedule eventId={eventId} />}
      </div>

      {!isOperating && !allConfiguredConnected && (
        <div className="fixed bottom-0 left-0 right-0 bg-yellow-50 border-t border-yellow-200 p-3">
          <div className="max-w-5xl mx-auto text-center text-yellow-700 text-sm">
            {configuredStations.length === 0
              ? '운영을 시작하려면 최소 1개 스테이션에 OBS 접속 정보를 설정하세요.'
              : '스테이션 설정 탭에서 OBS 테스트를 먼저 통과하세요.'}
          </div>
        </div>
      )}
    </div>
  );
}

export default EventDetail;
