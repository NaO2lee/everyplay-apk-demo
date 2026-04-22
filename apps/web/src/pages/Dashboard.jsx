import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RefreshCw, ArrowLeft, Wifi, WifiOff, Play, Square, Clock, RotateCcw, Terminal } from 'lucide-react';
import { api } from '../services/api';
import { useModal } from '../components/Modal';

const POLL_INTERVAL = 3000;
const LOG_MAX = 100;

function formatTime(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function LogPanel({ logs, onClear }) {
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [logs]);

  return (
    <div className="bg-gray-900 text-gray-100 border-t-2 border-blue-500">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <Terminal className="w-4 h-4 text-blue-400" />
          <span className="font-semibold">실시간 로그</span>
          <span className="text-gray-500">· {logs.length}건</span>
        </div>
        <button onClick={onClear} className="text-xs text-gray-400 hover:text-white">지우기</button>
      </div>
      <div className="max-w-6xl mx-auto px-4 pb-3">
        <div className="bg-black/40 rounded h-44 overflow-y-auto font-mono text-xs leading-relaxed px-3 py-2">
          {logs.length === 0 ? (
            <div className="text-gray-500">아직 로그 없음</div>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-gray-500 shrink-0">{l.time}</span>
                <span className={
                  l.level === 'error' ? 'text-red-400' :
                  l.level === 'warn' ? 'text-yellow-300' :
                  l.level === 'success' ? 'text-green-400' :
                  'text-gray-200'
                }>{l.message}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

function useWakeLock() {
  const wakeLockRef = useRef(null);
  useEffect(() => {
    async function acquire() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch {}
    }
    acquire();
    const handleVisibility = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); }
    };
  }, []);
}

export function Dashboard() {
  useWakeLock();
  const { eventId } = useParams();
  const navigate = useNavigate();
  const modal = useModal();
  const searchParams = new URLSearchParams(window.location.search);
  const [competitionDate, setCompetitionDate] = useState(searchParams.get('date'));
  const [event, setEvent] = useState(null);
  const [obsSnapshots, setObsSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeHeats, setActiveHeats] = useState({});
  const [currentHeatNumber, setCurrentHeatNumber] = useState(1);
  const [error, setError] = useState(null);
  const [stopping, setStopping] = useState(false);
  const [logs, setLogs] = useState([]);
  const prevSnapshotsRef = useRef({});

  const addLog = useCallback((message, level = 'info') => {
    setLogs(prev => {
      const next = [...prev, { time: formatTime(new Date()), message, level }];
      return next.length > LOG_MAX ? next.slice(next.length - LOG_MAX) : next;
    });
  }, []);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const res = await api.getEvent(eventId);
        setEvent(res.data);
        // 현재 active 세션 조회
        let activeSessionId = null;
        try {
          const sessRes = await api.obsSessions(eventId);
          const sessions = sessRes?.data || [];
          const active = sessions.find((s) => s.status === 'active');
          if (active) activeSessionId = active.id;
        } catch (_) {}
        // 진행 중(active) 히트 복구 — 현재 세션 기준
        try {
          const heatOpts = { status: 'active', page: 1 };
          if (activeSessionId) heatOpts.sessionId = activeSessionId;
          const heats = await api.getHeats(eventId, heatOpts);
          const items = heats?.data?.items || [];
          const map = {};
          let maxHeat = 0;
          items.forEach((h) => {
            map[h.station_id] = h;
            if (h.heat_number > maxHeat) maxHeat = h.heat_number;
          });
          setActiveHeats(map);
          // 완료된 히트 중 최대 번호도 확인 (현재 세션만)
          const completedOpts = { page: 1, perPage: 1 };
          if (activeSessionId) completedOpts.sessionId = activeSessionId;
          const completed = await api.getHeats(eventId, completedOpts);
          const lastItems = completed?.data?.items || [];
          if (lastItems.length > 0 && lastItems[0].heat_number > maxHeat) {
            maxHeat = lastItems[0].heat_number;
          }
          if (maxHeat > 0) {
            setCurrentHeatNumber(items.length > 0 ? maxHeat : maxHeat + 1);
          }
        } catch (_) {}
        // 날짜 자동 감지: URL 파라미터 없으면 오늘 날짜 또는 첫 번째 프로그램 날짜
        if (!competitionDate) {
          try {
            const progRes = await api.getPrograms(eventId);
            const programs = progRes?.data?.items || [];
            const dates = [...new Set(programs.map(p => p.competition_date).filter(Boolean))].sort();
            if (dates.length > 0) {
              const today = new Date().toISOString().slice(0, 10);
              setCompetitionDate(dates.includes(today) ? today : dates[0]);
            }
          } catch (_) {}
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  // OBS 상태 폴링 + 폴링 실패 상태 노출
  const [pollError, setPollError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await api.obsStatus();
        if (cancelled) return;
        const snapshots = res.data || [];
        // 상태 변화 감지 → 로그
        const prev = prevSnapshotsRef.current;
        snapshots.forEach((s) => {
          const p = prev[s.station_id];
          if (!p) return;
          if (p.connected !== s.connected) {
            addLog(`스테이션 ${s.station_number ?? s.station_id} OBS ${s.connected ? '연결됨' : '끊김'}`, s.connected ? 'success' : 'warn');
          }
          if (p.recording !== s.recording) {
            addLog(`스테이션 ${s.station_number ?? s.station_id} 녹화 ${s.recording ? '시작' : '종료'}`, 'info');
          }
          if (p.streaming !== s.streaming) {
            addLog(`스테이션 ${s.station_number ?? s.station_id} 스트리밍 ${s.streaming ? '시작' : '종료'}`, 'info');
          }
        });
        prevSnapshotsRef.current = Object.fromEntries(snapshots.map(s => [s.station_id, s]));
        setObsSnapshots(snapshots);
        if (pollError) addLog('OBS 상태 조회 복구', 'success');
        setPollError(null);
      } catch (e) {
        if (cancelled) return;
        const msg = e.message || 'OBS 상태 조회 실패';
        if (!pollError) addLog(`OBS 상태 조회 실패: ${msg}`, 'error');
        setPollError(msg);
      }
    };
    poll();
    const t = setInterval(poll, POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog]);

  const obsByStationId = useMemo(() => {
    const m = {};
    obsSnapshots.forEach((s) => { m[s.station_id] = s; });
    return m;
  }, [obsSnapshots]);

  const handleStartHeat = async (station) => {
    try {
      const res = await api.startHeat(station.id, currentHeatNumber, [], competitionDate);
      setActiveHeats((prev) => ({ ...prev, [station.id]: res.data }));
      addLog(`스테이션 ${station.station_number} HIT ${currentHeatNumber} 시작`, 'success');
    } catch (e) {
      addLog(`스테이션 ${station.station_number} 히트 시작 실패: ${e.message}`, 'error');
      await modal.alert('히트 시작 실패: ' + e.message);
    }
  };

  const handleEndHeat = async (station) => {
    const heat = activeHeats[station.id];
    if (!heat) return;
    try {
      await api.endHeat(heat.id);
      setActiveHeats((prev) => {
        const next = { ...prev };
        delete next[station.id];
        return next;
      });
      addLog(`스테이션 ${station.station_number} HIT ${heat.heat_number} 종료`, 'success');
      // 모든 히트 종료됐으면 다음 번호로 (StrictMode 중복 호출 방지를 위해 콜백 밖에서)
      const remaining = Object.keys(activeHeats).filter((k) => k !== station.id);
      if (remaining.length === 0) {
        setCurrentHeatNumber((n) => n + 1);
      }
    } catch (e) {
      addLog(`스테이션 ${station.station_number} 히트 종료 실패: ${e.message}`, 'error');
      await modal.alert('히트 종료 실패: ' + e.message);
    }
  };

  const handleStartAllHeats = async () => {
    const heatNumber = currentHeatNumber;
    const targets = sortedStations.filter((c) => {
      const snap = obsByStationId[c.id];
      return snap?.connected && snap?.recording && !activeHeats[c.id];
    });
    if (targets.length === 0) {
      await modal.alert('시작할 수 있는 스테이션가 없습니다 (OBS 연결 + 녹화 중 + 히트 미진행인 스테이션만 대상)');
      return;
    }
    const results = await Promise.allSettled(
      targets.map((station) => api.startHeat(station.id, heatNumber, [], competitionDate))
    );
    const newHeats = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        newHeats[targets[i].id] = r.value.data;
      }
    });
    setActiveHeats((prev) => ({ ...prev, ...newHeats }));
    const failed = results.filter((r) => r.status === 'rejected').length;
    addLog(`전체 시작 — HIT ${heatNumber} (성공 ${targets.length - failed} / 실패 ${failed})`, failed > 0 ? 'warn' : 'success');
    if (failed > 0) await modal.alert(`${targets.length}개 중 ${failed}개 스테이션 히트 시작 실패`);
  };

  const handleEndAllHeats = async () => {
    const active = sortedStations.filter((c) => activeHeats[c.id]);
    if (active.length === 0) {
      await modal.alert('진행 중인 히트가 없습니다');
      return;
    }
    const results = await Promise.allSettled(
      active.map((station) => api.endHeat(activeHeats[station.id].id))
    );
    const ended = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') ended[active[i].id] = true;
    });
    setActiveHeats((prev) => {
      const next = { ...prev };
      Object.keys(ended).forEach((k) => delete next[k]);
      return next;
    });
    // 모든 히트 종료됐으면 다음 번호로 (StrictMode 중복 호출 방지를 위해 콜백 밖에서)
    const remainingAfterEnd = Object.keys(activeHeats).filter((k) => !ended[k]);
    if (remainingAfterEnd.length === 0) {
      setCurrentHeatNumber((n) => n + 1);
    }
    const failed = results.filter((r) => r.status === 'rejected').length;
    addLog(`전체 종료 (성공 ${active.length - failed} / 실패 ${failed})`, failed > 0 ? 'warn' : 'success');
    if (failed > 0) await modal.alert(`${active.length}개 중 ${failed}개 스테이션 히트 종료 실패`);
  };

  const handleStopOperation = async () => {
    if (!await modal.confirm('운영을 종료하시겠습니까? 모든 스테이션의 OBS 녹화·스트리밍이 중지됩니다.')) return;
    setStopping(true);
    try {
      await api.obsStopEvent(eventId);
      navigate(`/admin/events/${eventId}`);
    } catch (e) {
      await modal.alert('운영 종료 실패: ' + e.message);
    } finally {
      setStopping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const sortedStations = [...(event?.stations || [])].sort((a, b) => a.station_number - b.station_number);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/admin/events/${eventId}`)} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">{event?.name}</h1>
              <p className="text-sm text-gray-500 flex items-center gap-2">
                운영 대시보드{competitionDate && ` · ${competitionDate}`} ·
                <span className="font-semibold text-blue-600 flex items-center gap-1">
                  다음 HIT
                  <input
                    type="number" min={1} value={currentHeatNumber}
                    onChange={(e) => setCurrentHeatNumber(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 px-1 py-0.5 border rounded text-center text-sm font-mono"
                    disabled={Object.keys(activeHeats).length > 0}
                  />
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {Object.keys(activeHeats).length === 0 ? (
              <button
                onClick={handleStartAllHeats}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                <Play className="w-4 h-4" />
                HIT {currentHeatNumber} 시작
              </button>
            ) : (
              <button
                onClick={handleEndAllHeats}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                <Square className="w-4 h-4" />
                전체 히트 종료
              </button>
            )}
            <button
              onClick={async () => {
                if (!await modal.confirm('모든 히트 기록을 삭제하고 HIT 1부터 다시 시작합니다. 진행할까요?')) return;
                try {
                  const res = await api.resetHeats(eventId);
                  setActiveHeats({});
                  setCurrentHeatNumber(1);
                  await modal.alert(`히트 ${res.data.deleted}건 초기화 완료`);
                } catch (e) { await modal.alert('초기화 실패: ' + e.message); }
              }}
              disabled={Object.keys(activeHeats).length > 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              히트 초기화
            </button>
            <button
              onClick={handleStopOperation}
              disabled={stopping}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              <Square className="w-4 h-4" />
              {stopping ? '종료 중...' : '운영 종료'}
            </button>
          </div>
        </div>
      </div>

      {pollError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-center text-sm text-red-700">
          ⚠️ OBS 상태 조회 실패: {pollError}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6 pb-72">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedStations.map((station) => {
            const snap = obsByStationId[station.id];
            const online = snap?.connected;
            const recording = snap?.recording;
            const streaming = snap?.streaming;
            const heat = activeHeats[station.id];

            return (
              <div
                key={station.id}
                className={`bg-white rounded-xl shadow border-2 ${
                  recording ? 'border-red-400' : online ? 'border-green-400' : 'border-gray-300'
                }`}
              >
                <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                      recording ? 'bg-red-500 text-white' : online ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                    }`}>
                      {station.station_number}
                    </div>
                    <h3 className="font-semibold">스테이션 {station.station_number}</h3>
                  </div>
                  {recording && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold">● REC</span>
                  )}
                </div>

                <div className="p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">OBS</span>
                    {online ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <Wifi className="w-4 h-4" /> 연결됨
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400">
                        <WifiOff className="w-4 h-4" /> 끊김
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">스트리밍</span>
                    <span className={streaming ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                      {streaming ? 'LIVE' : '대기'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">드롭 프레임</span>
                    <span className="font-mono text-xs">{snap?.dropped_frames ?? 0}</span>
                  </div>
                  {snap?.last_error && (
                    <div className="text-xs text-red-500 truncate" title={snap.last_error}>
                      {snap.last_error}
                    </div>
                  )}

                  {heat && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-gray-500">진행 중</span>
                      <span className="flex items-center gap-1 text-red-600 font-mono">
                        <Clock className="w-4 h-4" /> HIT {heat.heat_number}
                      </span>
                    </div>
                  )}
                </div>

                <div className="px-4 py-3 border-t flex gap-2">
                  {!heat && online && streaming && (
                    <button
                      onClick={() => handleStartHeat(station)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                    >
                      <Play className="w-4 h-4" /> 히트 시작
                    </button>
                  )}
                  {heat && (
                    <button
                      onClick={() => handleEndHeat(station)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                    >
                      <Square className="w-4 h-4" /> 히트 종료
                    </button>
                  )}
                  {!online && (
                    <span className="flex-1 text-center py-2 text-xs text-gray-400">OBS 연결 대기 중</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30">
        <LogPanel logs={logs} onClear={() => setLogs([])} />
      </div>
    </div>
  );
}

export default Dashboard;
