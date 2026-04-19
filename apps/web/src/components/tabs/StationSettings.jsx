import { useState, useEffect } from 'react';
import { Save, Check, RotateCcw, Link as LinkIcon, Wifi, Download, Upload } from 'lucide-react';
import { api } from '../../services/api';
import { useModal } from '../Modal';

export default function StationSettings({ event, onUpdate, onObsStatusChange }) {
  const modal = useModal();
  const [stations, setStations] = useState(event?.stations || []);
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  const [clearing, setClearing] = useState({});
  const [copied, setCopied] = useState({});
  const [testing, setTesting] = useState({});
  const [testResult, setTestResult] = useState({});
  const [presetOpen, setPresetOpen] = useState({});
  const [presets, setPresets] = useState([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState(null);
  const [presetForm, setPresetForm] = useState({
    name: '', obs_host: '', obs_port: 4455, obs_password: '',
    youtube_stream_url: '', youtube_stream_key: '', youtube_offset_seconds: 0,
  });

  useEffect(() => { loadPresets(); }, []);

  const loadPresets = async () => {
    try {
      const res = await api.getPresets();
      setPresets(res.data || []);
    } catch {}
  };

  const resetPresetForm = () => {
    setPresetForm({ name: '', obs_host: '', obs_port: 4455, obs_password: '', youtube_stream_url: '', youtube_stream_key: '', youtube_offset_seconds: 0 });
    setEditingPresetId(null);
  };

  const handleEditPreset = (preset) => {
    setPresetForm({
      name: preset.name,
      obs_host: preset.obs_host || '',
      obs_port: preset.obs_port || 4455,
      obs_password: preset.obs_password || '',
      youtube_stream_url: preset.youtube_stream_url || '',
      youtube_stream_key: preset.youtube_stream_key || '',
      youtube_offset_seconds: preset.youtube_offset_seconds ?? 0,
    });
    setEditingPresetId(preset.id);
  };

  const handleSavePresetForm = async () => {
    if (!presetForm.name.trim()) { await modal.alert('명칭을 입력하세요'); return; }
    // 새로 만들기일 때 중복 명칭 방지
    if (!editingPresetId && presets.some(p => p.name === presetForm.name.trim())) {
      await modal.alert(`"${presetForm.name}" 이름이 이미 존재합니다. 다른 이름을 사용하세요.`);
      return;
    }
    try {
      await api.savePreset(presetForm);
      await loadPresets();
      resetPresetForm();
    } catch (e) {
      await modal.alert('저장 실패: ' + e.message);
    }
  };

  const handleLoadPreset = (stationId, preset) => {
    setStations(prev => prev.map(s => s.id !== stationId ? s : {
      ...s,
      obs_host: preset.obs_host,
      obs_port: preset.obs_port,
      youtube_stream_url: preset.youtube_stream_url,
      youtube_offset_seconds: preset.youtube_offset_seconds,
    }));
    if (preset.obs_password) {
      setPasswordInput(prev => ({ ...prev, [stationId]: preset.obs_password }));
      setPasswordDirty(prev => ({ ...prev, [stationId]: true }));
    }
    if (preset.youtube_stream_key) {
      setStreamKeyInput(prev => ({ ...prev, [stationId]: preset.youtube_stream_key }));
      setStreamKeyDirty(prev => ({ ...prev, [stationId]: true }));
    }
    setPresetOpen({});
  };

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = () => setPresetOpen({});
    if (Object.values(presetOpen).some(Boolean)) {
      setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [presetOpen]);

  const handleDeletePreset = async (presetId) => {
    try {
      await api.deletePreset(presetId);
      await loadPresets();
    } catch (e) {
      await modal.alert('삭제 실패: ' + e.message);
    }
  };
  // 사용자가 비밀번호/스트림키 input 을 새로 입력했는지 추적
  const [passwordDirty, setPasswordDirty] = useState({});
  const [passwordInput, setPasswordInput] = useState({});
  const [streamKeyDirty, setStreamKeyDirty] = useState({});
  const [streamKeyInput, setStreamKeyInput] = useState({});

  const updateField = (courtId, field, value) => {
    setStations(prev => prev.map(c => c.id === courtId ? { ...c, [field]: value } : c));
  };

  const handleSave = async (station) => {
    setSaving(prev => ({ ...prev, [station.id]: true }));
    try {
      const payload = {
        obsHost: station.obs_host || '',
        obsPort: station.obs_port || 4455,
        youtubeStreamUrl: station.youtube_stream_url || '',
        youtubeOffsetSeconds: station.youtube_offset_seconds ?? 0,
      };
      // 비밀번호/스트림키: 사용자가 직접 입력했을 때만 전송.
      if (passwordDirty[station.id]) {
        payload.obsPassword = passwordInput[station.id] || '';
      }
      if (streamKeyDirty[station.id]) {
        payload.youtubeStreamKey = streamKeyInput[station.id] || '';
      }
      const res = await api.setStationObsConfig(station.id, payload);
      const serverStation = res?.data;
      setStations(prev => prev.map(c => {
        if (c.id !== station.id) return c;
        return {
          ...c,
          obs_host: serverStation?.obs_host ?? c.obs_host,
          obs_port: serverStation?.obs_port ?? c.obs_port,
          youtube_stream_url: serverStation?.youtube_stream_url ?? c.youtube_stream_url,
          youtube_offset_seconds: serverStation?.youtube_offset_seconds ?? c.youtube_offset_seconds,
          youtube_stream_key_masked: serverStation?.youtube_stream_key_masked ?? c.youtube_stream_key_masked,
          obs_password_masked: serverStation?.obs_password_masked ?? c.obs_password_masked,
          obs_configured: !!serverStation?.obs_configured,
        };
      }));
      setPasswordDirty(prev => ({ ...prev, [station.id]: false }));
      setPasswordInput(prev => ({ ...prev, [station.id]: '' }));
      setStreamKeyDirty(prev => ({ ...prev, [station.id]: false }));
      setStreamKeyInput(prev => ({ ...prev, [station.id]: '' }));
      setSaved(prev => ({ ...prev, [station.id]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [station.id]: false })), 2000);
      if (onUpdate) {
        const updated = stations.map(c => c.id === station.id ? { ...c, obs_configured: !!serverStation?.obs_configured } : c);
        onUpdate({ ...event, stations: updated });
      }
    } catch (e) {
      await modal.alert('저장 실패: ' + e.message);
    } finally {
      setSaving(prev => ({ ...prev, [station.id]: false }));
    }
  };

  const handleClear = async (station) => {
    if (!await modal.confirm(`스테이션 ${station.station_number} 의 OBS 설정을 전부 초기화할까요? (Host / 포트 / 비밀번호 / YouTube URL)`)) return;
    setClearing(prev => ({ ...prev, [station.id]: true }));
    try {
      const res = await api.clearStationObsConfig(station.id);
      const serverStation = res?.data;
      setStations(prev => prev.map(c => c.id !== station.id ? c : {
        ...c,
        obs_host: serverStation?.obs_host ?? null,
        obs_port: serverStation?.obs_port ?? null,
        youtube_stream_url: serverStation?.youtube_stream_url ?? null,
        obs_password_masked: null,
        obs_configured: false,
      }));
      setPasswordDirty(prev => ({ ...prev, [station.id]: false }));
      setPasswordInput(prev => ({ ...prev, [station.id]: '' }));
      if (onUpdate) {
        const updated = stations.map(c => c.id === station.id ? { ...c, obs_configured: false } : c);
        onUpdate({ ...event, stations: updated });
      }
    } catch (e) {
      await modal.alert('초기화 실패: ' + e.message);
    } finally {
      setClearing(prev => ({ ...prev, [station.id]: false }));
    }
  };

  const handleCopyOverlay = async (station) => {
    const url = `${window.location.origin}/overlay.html?station=${station.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(prev => ({ ...prev, [station.id]: true }));
      setTimeout(() => setCopied(prev => ({ ...prev, [station.id]: false })), 2000);
    } catch {
      await modal.alert('복사 실패. 수동으로 복사하세요:\n' + url);
    }
  };

  const handleTest = async (station) => {
    setTesting(prev => ({ ...prev, [station.id]: true }));
    setTestResult(prev => ({ ...prev, [station.id]: null }));
    try {
      await api.obsReload();
      const res = await api.obsConnectStation(station.id);
      if (res.data.connected) {
        setTestResult(prev => ({ ...prev, [station.id]: { ok: true, error: null } }));
      } else {
        setTestResult(prev => ({ ...prev, [station.id]: { ok: false, error: res.data.last_error || '연결 실패' } }));
      }
      if (onObsStatusChange) onObsStatusChange();
    } catch (e) {
      setTestResult(prev => ({ ...prev, [station.id]: { ok: false, error: e.message } }));
    } finally {
      setTesting(prev => ({ ...prev, [station.id]: false }));
    }
  };

  const handleReload = async () => {
    try {
      const res = await api.obsReload();
      await modal.alert(`OBS 클라이언트 ${res.data.registered}개 등록 완료`);
    } catch (e) {
      await modal.alert('재로드 실패: ' + e.message);
    }
  };

  const sorted = [...stations].sort((a, b) => a.station_number - b.station_number);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          스테이션 OBS 설정 <span className="text-sm font-normal text-gray-400">(Host/포트/비밀번호/YouTube URL 모두 입력 시 "설정됨")</span>
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowPresetModal(true); resetPresetForm(); }}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm"
          >
            프리셋 관리
          </button>
          <button
            onClick={handleReload}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
          >
            OBS 클라이언트 재로드
          </button>
        </div>
      </div>

      {showPresetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-100 rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 bg-white rounded-t-xl border-b">
              <h3 className="font-semibold text-lg">프리셋 관리</h3>
              <button onClick={() => setShowPresetModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">X</button>
            </div>

            <div className="flex-1 overflow-hidden flex gap-4 p-4">
              {/* 좌: 입력 폼 카드 */}
              <div className="w-1/2 overflow-y-auto">
                <div className="bg-white border rounded-xl shadow-sm p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 border-b pb-2">{editingPresetId ? '프리셋 수정' : '새 프리셋'}</h4>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">명칭</label>
                    <input type="text" value={presetForm.name}
                      onChange={e => setPresetForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="예: 본부PC, 맥북2호"
                      className="w-full border rounded-lg px-3 py-1.5 text-sm" autoFocus />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Host (IP)</label>
                      <input type="text" value={presetForm.obs_host}
                        onChange={e => setPresetForm(f => ({ ...f, obs_host: e.target.value }))}
                        placeholder="192.168.0.10"
                        className="w-full border rounded-lg px-3 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Port</label>
                      <input type="number" value={presetForm.obs_port}
                        onChange={e => setPresetForm(f => ({ ...f, obs_port: parseInt(e.target.value) || 4455 }))}
                        className="w-full border rounded-lg px-3 py-1.5 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">WebSocket 비밀번호</label>
                    <input type="password" value={presetForm.obs_password}
                      onChange={e => setPresetForm(f => ({ ...f, obs_password: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">YouTube URL</label>
                    <input type="text" value={presetForm.youtube_stream_url}
                      onChange={e => setPresetForm(f => ({ ...f, youtube_stream_url: e.target.value }))}
                      placeholder="https://youtube.com/live/..."
                      className="w-full border rounded-lg px-3 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">스트림 키</label>
                    <input type="password" value={presetForm.youtube_stream_key}
                      onChange={e => setPresetForm(f => ({ ...f, youtube_stream_key: e.target.value }))}
                      placeholder="xxxx-xxxx-xxxx-xxxx"
                      className="w-full border rounded-lg px-3 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">보정 (초)</label>
                    <input type="number" step="0.1" value={presetForm.youtube_offset_seconds}
                      onChange={e => setPresetForm(f => ({ ...f, youtube_offset_seconds: parseFloat(e.target.value) || 0 }))}
                      className="w-full border rounded-lg px-3 py-1.5 text-sm" />
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    {editingPresetId && (
                      <button onClick={resetPresetForm}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-300">새로 만들기</button>
                    )}
                    <button onClick={handleSavePresetForm}
                      className="px-4 py-1.5 bg-purple-500 text-white rounded-lg text-xs hover:bg-purple-600">
                      {editingPresetId ? '수정 저장' : '저장'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 우: 저장된 프리셋 목록 */}
              <div className="w-1/2 flex flex-col min-h-0">
                <div className="bg-white border rounded-xl shadow-sm p-4 flex flex-col flex-1 min-h-0">
                <h4 className="text-sm font-semibold text-gray-700 border-b pb-2 mb-2">저장된 프리셋 ({presets.length})</h4>
                {presets.length === 0 && (
                  <div className="text-sm text-gray-400 text-center py-8 flex-1">저장된 프리셋이 없습니다</div>
                )}
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {presets.map(p => (
                    <div key={p.id} className={`border rounded-lg p-3 text-sm ${editingPresetId === p.id ? 'border-purple-300 bg-purple-50' : 'hover:bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">{p.name}</span>
                        <div className="flex gap-1">
                          <button onClick={() => handleEditPreset(p)} className="px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 rounded">수정</button>
                          <button onClick={() => handleDeletePreset(p.id)} className="px-2 py-0.5 text-xs text-red-500 hover:bg-red-50 rounded">삭제</button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <div>Host: {p.obs_host || '-'} : {p.obs_port}</div>
                        <div>YouTube: {p.youtube_stream_url ? p.youtube_stream_url.slice(0, 30) + '...' : '-'}</div>
                        <div>보정: {p.youtube_offset_seconds}초</div>
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {sorted.map(station => (
        <div key={station.id} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500 text-white flex items-center justify-center font-bold">
              {station.station_number}
            </div>
            <h3 className="font-semibold">스테이션 {station.station_number}</h3>
            {station.obs_configured ? (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">설정됨</span>
            ) : (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">미설정</span>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">OBS Host (IP)</label>
              <input
                type="text"
                value={station.obs_host || ''}
                onChange={(e) => updateField(station.id, 'obs_host', e.target.value)}
                placeholder="192.168.0.10"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">OBS Port</label>
              <input
                type="number"
                value={station.obs_port || 4455}
                onChange={(e) => updateField(station.id, 'obs_port', parseInt(e.target.value) || 4455)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                OBS WebSocket 비밀번호
                {station.obs_password_masked && !passwordDirty[station.id] && (
                  <span className="text-xs text-gray-400 font-normal ml-2">(저장됨: <span className="font-mono">{station.obs_password_masked}</span>)</span>
                )}
              </label>
              <input
                type="password"
                value={passwordInput[station.id] || ''}
                onChange={(e) => {
                  setPasswordInput(prev => ({ ...prev, [station.id]: e.target.value }));
                  setPasswordDirty(prev => ({ ...prev, [station.id]: true }));
                }}
                placeholder={station.obs_password_masked ? '변경 시에만 입력' : 'OBS에 설정한 WebSocket 비밀번호'}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">YouTube 라이브 URL (시청자용)</label>
              <input
                type="text"
                value={station.youtube_stream_url || ''}
                onChange={(e) => updateField(station.id, 'youtube_stream_url', e.target.value)}
                placeholder="https://youtube.com/live/xxxxx"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                YouTube 스트림 키
                {station.youtube_stream_key_masked && !streamKeyDirty[station.id] && (
                  <span className="text-xs text-gray-400 font-normal ml-2">(저장됨: <span className="font-mono">{station.youtube_stream_key_masked}</span>)</span>
                )}
              </label>
              <div className="flex gap-1">
                <input
                  type="password"
                  value={streamKeyInput[station.id] || ''}
                  onChange={(e) => {
                    setStreamKeyInput(prev => ({ ...prev, [station.id]: e.target.value }));
                    setStreamKeyDirty(prev => ({ ...prev, [station.id]: true }));
                  }}
                  placeholder={station.youtube_stream_key_masked ? '변경 시에만 입력' : 'xxxx-xxxx-xxxx-xxxx'}
                  className="flex-1 border rounded px-3 py-2 text-sm"
                />
                {station.youtube_stream_key_masked && (
                  <button
                    onClick={async () => {
                      try {
                        const res = await api.getStationStreamKey(station.id);
                        await navigator.clipboard.writeText(res.data.youtube_stream_key);
                        await modal.alert('스트림 키가 복사되었습니다');
                      } catch (e) { await modal.alert('복사 실패: ' + e.message); }
                    }}
                    className="px-3 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 text-xs shrink-0"
                  >복사</button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                유튜브 VOD 보정 (초) <span className="text-xs text-gray-400 font-normal">(양수=뒤로, 음수=앞으로)</span>
              </label>
              <input
                type="number"
                step="0.1"
                value={station.youtube_offset_seconds ?? 0}
                onChange={(e) => updateField(station.id, 'youtube_offset_seconds', parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-xs">
              {testResult[station.id] && (
                <span className={`px-2 py-1 rounded ${testResult[station.id].ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {testResult[station.id].ok ? 'OBS 연결 성공' : testResult[station.id].error?.slice(0, 40)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
            <div className="relative">
              <button
                onClick={() => setPresetOpen(prev => ({ ...prev, [station.id]: !prev[station.id] }))}
                className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 text-sm"
              >
                <Download className="w-4 h-4" />
                불러오기
              </button>
              {presetOpen[station.id] && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-white border rounded-xl shadow-lg z-50 p-3 max-h-60 overflow-y-auto">
                  <div className="text-xs font-semibold text-gray-600 mb-2">저장된 프리셋</div>
                  {presets.length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-4">없음 (프리셋 관리에서 추가하세요)</div>
                  )}
                  <div className="space-y-1.5">
                  {presets.map(p => (
                    <button key={p.id} onClick={() => handleLoadPreset(station.id, p)}
                      className="w-full text-left border rounded-lg p-2.5 hover:bg-purple-50 hover:border-purple-200 transition text-sm">
                      <div className="font-medium text-gray-800">{p.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{p.obs_host || '-'}:{p.obs_port}</div>
                    </button>
                  ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => handleTest(station)}
              disabled={testing[station.id] || !station.obs_host}
              className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50 text-sm"
            >
              <Wifi className="w-4 h-4" />
              {testing[station.id] ? '테스트 중...' : 'OBS 테스트'}
            </button>
            <button
              onClick={() => handleCopyOverlay(station)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              title="이 스테이션의 오버레이 URL 복사 (OBS 브라우저 소스에 붙여넣기)"
            >
              <LinkIcon className="w-4 h-4" />
              {copied[station.id] ? '복사됨' : '오버레이 URL 복사'}
            </button>
            <button
              onClick={() => handleClear(station)}
              disabled={clearing[station.id]}
              className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              {clearing[station.id] ? '초기화 중...' : '초기화'}
            </button>
            <button
              onClick={() => handleSave(station)}
              disabled={saving[station.id]}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              {saved[station.id] ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving[station.id] ? '저장 중...' : (saved[station.id] ? '저장됨' : '저장')}
            </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
