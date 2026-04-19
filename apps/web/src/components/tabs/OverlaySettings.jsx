import { useState, useCallback, useRef, useEffect } from 'react';
import { Save, RotateCcw, Plus, Trash2, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { api } from '../../services/api';
import { useModal } from '../Modal';

const FONT_FAMILIES = [
  "Pretendard", "Malgun Gothic", "Noto Sans KR", "Nanum Gothic",
  "Nanum Square", "JetBrains Mono, monospace", "Arial",
];

const FONT_WEIGHTS = [
  { label: "보통", value: "normal" },
  { label: "굵게", value: "bold" },
  { label: "800", value: "800" },
  { label: "900", value: "900" },
];

const RESOLUTION_PRESETS = [
  { label: "1920 x 1080 (Full HD)", width: 1920, height: 1080 },
  { label: "1280 x 720 (HD)", width: 1280, height: 720 },
  { label: "1080 x 1920 (세로)", width: 1080, height: 1920 },
  { label: "커스텀", width: 0, height: 0 },
];

const DEFAULT_ELEMENTS = [
  { id: 'stationLabel', elementType: 'text', binding: 'station_number', label: '스테이션 번호', content: '', fontSize: 36, fontFamily: 'Pretendard', fontWeight: 'bold', color: '#ffffff', backgroundColor: '#000000b3', borderColor: 'transparent', borderWidth: 0, offsetX: 2, offsetY: 2, visible: true },
  { id: 'liveBadge', elementType: 'text', binding: 'live_badge', label: '상태 표시', content: '', fontSize: 28, fontFamily: 'Pretendard', fontWeight: 'bold', color: '#ffffff', backgroundColor: '#dc2626e6', borderColor: 'transparent', borderWidth: 0, offsetX: 82, offsetY: 2, visible: true },
  { id: 'timer', elementType: 'timer', binding: 'none', label: '타이머', content: '', fontSize: 48, fontFamily: 'JetBrains Mono, monospace', fontWeight: 'bold', color: '#34d399', backgroundColor: '#000000cc', borderColor: 'transparent', borderWidth: 0, offsetX: 70, offsetY: 85, visible: true },
  { id: 'hitNumber', elementType: 'text', binding: 'heat_number', label: 'HIT 번호', content: '', fontSize: 36, fontFamily: 'Pretendard', fontWeight: 'bold', color: '#facc15', backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0, offsetX: 2, offsetY: 78, visible: true },
  { id: 'eventType', elementType: 'text', binding: 'event_type', label: '종목', content: '', fontSize: 28, fontFamily: 'Pretendard', fontWeight: 'bold', color: '#ffffff', backgroundColor: '#000000b3', borderColor: 'transparent', borderWidth: 0, offsetX: 2, offsetY: 70, visible: true },
  { id: 'division', elementType: 'text', binding: 'division', label: '참가부', content: '', fontSize: 28, fontFamily: 'Pretendard', fontWeight: 'normal', color: '#ffffff', backgroundColor: '#000000b3', borderColor: 'transparent', borderWidth: 0, offsetX: 2, offsetY: 63, visible: true },
  { id: 'participant', elementType: 'text', binding: 'participants', label: '선수 이름', content: '', fontSize: 28, fontFamily: 'Pretendard', fontWeight: 'normal', color: '#ffffff', backgroundColor: '#1f2937', borderColor: 'transparent', borderWidth: 0, offsetX: 2, offsetY: 85, visible: true },
];

const PREVIEW_BY_BINDING = {
  station_number: '스테이션 1',
  live_badge: '대기',
  heat_number: 'HIT 3',
  event_type: '30초 번갈아뛰기',
  division: '남자-9세미만',
  participants: 'Wing Tung Wong, 송기쁨, 류자람',
  none: null,
};

const BINDING_OPTIONS = [
  { value: 'none', label: '없음 (직접 입력)' },
  { value: 'station_number', label: '스테이션 번호' },
  { value: 'heat_number', label: 'HIT 번호' },
  { value: 'event_type', label: '종목' },
  { value: 'division', label: '참가부' },
  { value: 'participants', label: '선수명' },
  { value: 'live_badge', label: 'LIVE 뱃지' },
];

function getPreviewText(el) {
  if (el.elementType === 'timer') return '00:25.30';
  if (el.binding && el.binding !== 'none' && PREVIEW_BY_BINDING[el.binding]) {
    return PREVIEW_BY_BINDING[el.binding];
  }
  return el.content || el.label || '텍스트';
}

function createNewElement(elementType, binding) {
  const bindingOption = BINDING_OPTIONS.find(b => b.value === binding);
  return {
    id: `custom_${Date.now()}`,
    elementType: elementType,
    binding: binding || 'none',
    label: elementType === 'timer' ? '타이머' : (bindingOption ? bindingOption.label : '새 텍스트'),
    content: '',
    fontSize: elementType === 'timer' ? 48 : 24,
    fontFamily: elementType === 'timer' ? 'JetBrains Mono, monospace' : 'Pretendard',
    fontWeight: 'normal',
    color: '#ffffff',
    backgroundColor: '#000000b3',
    borderColor: 'transparent',
    borderWidth: 0,
    offsetX: 50,
    offsetY: 50,
    visible: true,
  };
}

export function OverlaySettings({ event, onUpdate }) {
  const modal = useModal();
  const [elements, setElements] = useState(() => DEFAULT_ELEMENTS.map(e => ({ ...e })));
  const [resolution, setResolution] = useState({ width: 1920, height: 1080 });
  const [customRes, setCustomRes] = useState(false);
  const [selectedId, setSelectedId] = useState('stationLabel');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newElType, setNewElType] = useState('text');
  const [newElBinding, setNewElBinding] = useState('none');
  const [dragging, setDragging] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [showSample, setShowSample] = useState(false);
  const [sampleKey, setSampleKey] = useState(0);
  const previewRef = useRef(null);

  const sampleUrl = event?.event_code
    ? `${window.location.origin}/overlay.html?preview=true&event=${event.event_code}`
    : null;

  // Load from DB
  useEffect(() => {
    if (!event?.overlay_config) return;
    const config = event.overlay_config;

    if (config.resolution && config.resolution.width) {
      setResolution(config.resolution);
      const isPreset = RESOLUTION_PRESETS.some(p => p.width === config.resolution.width && p.height === config.resolution.height);
      setCustomRes(!isPreset);
    }

    if (config.elements && Array.isArray(config.elements)) {
      // Migrate old format elements to new format
      const migrated = config.elements.map(e => {
        if (e.elementType) return { ...e }; // already new format
        // old format: type=system/custom, systemKey
        const migMap = {
          courtLabel: { elementType: 'text', binding: 'station_number' },
          liveBadge: { elementType: 'text', binding: 'live_badge' },
          timer: { elementType: 'timer', binding: 'none' },
          hitNumber: { elementType: 'text', binding: 'heat_number' },
          participant: { elementType: 'text', binding: 'participants' },
        };
        const mig = (e.systemKey && migMap[e.systemKey]) || { elementType: 'text', binding: 'none' };
        const { type, systemKey, ...rest } = e;
        return { ...rest, ...mig };
      });
      setElements(migrated);
      if (migrated.length > 0 && !migrated.find(e => e.id === 'stationLabel')) {
        setSelectedId(migrated[0].id);
      }
    }
  }, [event]);

  const selectedElement = elements.find(e => e.id === selectedId) || elements[0];

  const updateElement = (id, updates) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const addCustomElement = () => {
    setShowAddDialog(true);
    setNewElType('text');
    setNewElBinding('none');
  };

  const confirmAddElement = async () => {
    if (newElType === 'timer' && elements.some(e => e.elementType === 'timer')) {
      await modal.alert('타이머는 하나만 추가할 수 있습니다');
      return;
    }
    const newEl = createNewElement(newElType, newElType === 'timer' ? 'none' : newElBinding);
    setElements(prev => [...prev, newEl]);
    setSelectedId(newEl.id);
    setShowAddDialog(false);
  };

  const deleteElement = (id) => {
    setElements(prev => {
      const next = prev.filter(el => el.id !== id);
      if (selectedId === id && next.length > 0) {
        setSelectedId(next[0].id);
      }
      return next;
    });
  };

  const handlePreviewMouseDown = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    setDragging(id);
  };

  const handlePreviewMouseMove = useCallback((e) => {
    if (!dragging || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    updateElement(dragging, { offsetX: Math.round(x), offsetY: Math.round(y) });
  }, [dragging]);

  const handlePreviewMouseUp = useCallback(() => setDragging(null), []);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const payload = { resolution, elements };
      await api.request(`/events/${event.id}/overlay`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (onUpdate) {
        onUpdate({ ...event, overlay_config: payload });
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      await modal.alert('저장 실패: ' + e.message);
      setSaveStatus('idle');
    }
  };

  const handleReset = () => {
    setElements(DEFAULT_ELEMENTS.map(e => ({ ...e })));
    setSelectedId('stationLabel');
  };

  const PREVIEW_SCALE = previewRef.current ? (previewRef.current.offsetWidth / resolution.width) : 0.6;

  const renderPreviewElement = (el) => {
    if (!el.visible) return null;

    const scaledFontSize = Math.max(8, el.fontSize * PREVIEW_SCALE);
    const scaledBorderWidth = Math.max(0, el.borderWidth * PREVIEW_SCALE);
    const scaledPadding = `${Math.max(4, 10 * PREVIEW_SCALE)}px ${Math.max(6, 16 * PREVIEW_SCALE)}px`;

    return (
      <div
        key={el.id}
        onMouseDown={(e) => handlePreviewMouseDown(e, el.id)}
        className={`absolute cursor-move select-none transition-shadow ${
          selectedId === el.id ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-transparent' : ''
        } ${dragging === el.id ? 'z-50 opacity-90' : 'z-10'}`}
        style={{
          left: `${el.offsetX}%`,
          top: `${el.offsetY}%`,
          transform: `translate(${el.offsetX > 50 ? '-100%' : '0%'}, ${el.offsetY > 50 ? '-100%' : '0%'})`,
          fontSize: `${scaledFontSize}px`,
          fontFamily: el.fontFamily,
          fontWeight: el.fontWeight,
          color: el.color,
          backgroundColor: el.backgroundColor,
          border: scaledBorderWidth > 0 ? `${scaledBorderWidth}px solid ${el.borderColor}` : 'none',
          padding: scaledPadding,
          borderRadius: `${Math.max(2, 6 * PREVIEW_SCALE)}px`,
          whiteSpace: 'nowrap',
        }}
      >
        {getPreviewText(el)}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 좌: 에디터 */}
        <div className="bg-white rounded-xl border p-3">
          <h3 className="font-semibold text-sm mb-2">오버레이 스타일 에디터</h3>
          <div className="flex items-center gap-2">
            <button onClick={handleReset} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">
              <RotateCcw className="w-3 h-3" /> 초기화
            </button>
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className={`flex items-center gap-1 px-4 py-1.5 text-xs font-medium rounded-lg text-white ${
                saveStatus === 'saved' ? 'bg-green-500' : saveStatus === 'saving' ? 'bg-blue-400' : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              <Save className="w-3 h-3" />
              {saveStatus === 'saved' ? '저장 완료' : saveStatus === 'saving' ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
        {/* 우: 해상도 */}
        <div className="bg-white rounded-xl border p-3">
          <h3 className="font-semibold text-sm mb-2">해상도</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={customRes ? 'custom' : `${resolution.width}x${resolution.height}`}
              onChange={(e) => {
                if (e.target.value === 'custom') { setCustomRes(true); }
                else { setCustomRes(false); const [w, h] = e.target.value.split('x').map(Number); setResolution({ width: w, height: h }); }
              }}
              className="px-2 py-1.5 border rounded-lg text-xs"
            >
              {RESOLUTION_PRESETS.map((p) => (
                <option key={p.label} value={p.width === 0 ? 'custom' : `${p.width}x${p.height}`}>{p.label}</option>
              ))}
            </select>
            {customRes && (
              <div className="flex items-center gap-1">
                <input type="number" min={320} max={3840} value={resolution.width}
                  onChange={(e) => setResolution(prev => ({ ...prev, width: parseInt(e.target.value) || 1920 }))}
                  className="w-16 px-2 py-1.5 border rounded text-xs font-mono" />
                <span className="text-xs text-gray-400">x</span>
                <input type="number" min={240} max={2160} value={resolution.height}
                  onChange={(e) => setResolution(prev => ({ ...prev, height: parseInt(e.target.value) || 1080 }))}
                  className="w-16 px-2 py-1.5 border rounded text-xs font-mono" />
              </div>
            )}
            <span className="text-xs text-gray-400">OBS 소스 크기</span>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-xl border p-4">
        <h4 className="text-xs text-gray-400 mb-2">라이브 프리뷰 (드래그로 위치 이동) -- {resolution.width} x {resolution.height}</h4>
        <div
          ref={previewRef}
          className="relative bg-gray-900 rounded-lg border border-gray-200"
          style={{ overflow: 'hidden', aspectRatio: `${resolution.width} / ${resolution.height}`, maxHeight: '60vh' }}
          onMouseMove={handlePreviewMouseMove}
          onMouseUp={handlePreviewMouseUp}
          onMouseLeave={handlePreviewMouseUp}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800 flex items-center justify-center">
            <span className="text-gray-700 text-4xl">BG</span>
          </div>
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '10% 10%',
          }} />
          {elements.map(renderPreviewElement)}
        </div>
      </div>

      {/* 샘플 오버레이 */}
      {sampleUrl && (
        <div className="bg-white rounded-xl border p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-medium text-gray-600">샘플 오버레이 (실제 렌더링)</h4>
              {showSample && (
                <button onClick={() => setSampleKey(k => k + 1)} className="text-xs text-blue-500 hover:text-blue-700">새로고침</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <a href={sampleUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-500">
                <ExternalLink className="w-3 h-3" /> 새 탭
              </a>
              <button onClick={() => setShowSample(!showSample)}
                className={`px-3 py-1 text-xs rounded-lg ${showSample ? 'bg-gray-200 text-gray-700' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
                {showSample ? '닫기' : '미리보기'}
              </button>
            </div>
          </div>
          {showSample && (
            <div className="flex justify-center">
              <div className="border rounded-lg overflow-hidden bg-gray-900 w-full max-w-3xl" style={{ aspectRatio: `${resolution.width} / ${resolution.height}`, maxHeight: '400px' }}>
                <iframe key={sampleKey} src={sampleUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="overlay sample" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom panels: element list + style editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Element list panel */}
        <div className="bg-white rounded-xl border p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs text-gray-400">요소 목록</h4>
            <button onClick={addCustomElement} className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg">
              <Plus className="w-3 h-3" /> 요소 추가
            </button>
          </div>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {elements.map((el) => (
              <div
                key={el.id}
                onClick={() => setSelectedId(el.id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                  selectedId === el.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${el.visible ? 'bg-green-400' : 'bg-gray-300'}`} />
                <span className="flex-1 truncate font-medium">{el.label}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0">
                  {el.elementType === 'timer' ? '타이머' : (el.binding && el.binding !== 'none' ? (BINDING_OPTIONS.find(b => b.value === el.binding)?.label || el.binding) : '텍스트')}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); updateElement(el.id, { visible: !el.visible }); }}
                  className="p-0.5 text-gray-400 hover:text-gray-600"
                  title={el.visible ? '숨기기' : '표시'}
                >
                  {el.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                  className="p-0.5 text-gray-400 hover:text-red-500"
                  title="삭제"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Style editor panel */}
        {selectedElement && (
          <div className="lg:col-span-2 bg-white rounded-xl border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs text-gray-400">{selectedElement.label} 스타일</h4>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={selectedElement.visible}
                  onChange={(e) => updateElement(selectedId, { visible: e.target.checked })}
                  className="w-3.5 h-3.5 rounded accent-blue-500" />
                표시
              </label>
            </div>

            {/* Label / name */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">이름</label>
              <input type="text" value={selectedElement.label}
                onChange={(e) => updateElement(selectedId, { label: e.target.value })}
                className="w-full px-2 py-1.5 border rounded-lg text-xs" />
            </div>

            {/* Element type (read-only) */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">타입</label>
              <input type="text" value={selectedElement.elementType === 'timer' ? '타이머' : '텍스트'} disabled
                className="w-full px-2 py-1.5 border rounded-lg text-xs bg-gray-50 text-gray-400" />
            </div>

            {/* Data binding (text elements only) */}
            {selectedElement.elementType === 'text' && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">데이터 바인딩</label>
                <select value={selectedElement.binding || 'none'}
                  onChange={(e) => updateElement(selectedId, { binding: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded-lg text-xs">
                  {BINDING_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
            )}

            {/* Content — only for static text (binding=none) */}
            {selectedElement.elementType === 'text' && selectedElement.binding === 'none' && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">내용</label>
                <input type="text" value={selectedElement.content}
                  onChange={(e) => updateElement(selectedId, { content: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded-lg text-xs" />
              </div>
            )}
            {selectedElement.elementType === 'text' && selectedElement.binding && selectedElement.binding !== 'none' && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">미리보기 (자동 생성)</label>
                <input type="text" value={PREVIEW_BY_BINDING[selectedElement.binding] || ''} disabled
                  className="w-full px-2 py-1.5 border rounded-lg text-xs bg-gray-50 text-gray-400" />
              </div>
            )}
            {selectedElement.elementType === 'timer' && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">미리보기 (자동 생성)</label>
                <input type="text" value="00:25.30" disabled
                  className="w-full px-2 py-1.5 border rounded-lg text-xs bg-gray-50 text-gray-400" />
              </div>
            )}

            {/* Font size */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">글꼴 크기</label>
                <span className="text-xs text-gray-400 font-mono">{selectedElement.fontSize}px</span>
              </div>
              <input type="range" min={8} max={72} value={selectedElement.fontSize}
                onChange={(e) => updateElement(selectedId, { fontSize: Number(e.target.value) })}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            </div>

            {/* Font family */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">서체</label>
              <select value={selectedElement.fontFamily}
                onChange={(e) => updateElement(selectedId, { fontFamily: e.target.value })}
                className="w-full px-2 py-1.5 border rounded-lg text-xs">
                {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {/* Font weight */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">두께</label>
              <div className="flex gap-1">
                {FONT_WEIGHTS.map(fw => (
                  <button key={fw.value}
                    onClick={() => updateElement(selectedId, { fontWeight: fw.value })}
                    className={`flex-1 px-2 py-1 rounded text-xs transition ${
                      selectedElement.fontWeight === fw.value ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}>
                    {fw.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'color', label: '글자색' },
                { key: 'backgroundColor', label: '배경색' },
                { key: 'borderColor', label: '외곽선' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <div className="flex items-center gap-1">
                    <input type="color"
                      value={(selectedElement[key] || '#000000').slice(0, 7)}
                      onChange={(e) => updateElement(selectedId, { [key]: e.target.value })}
                      className="w-7 h-7 rounded border cursor-pointer" />
                    <input type="text" value={selectedElement[key]}
                      onChange={(e) => updateElement(selectedId, { [key]: e.target.value })}
                      className="flex-1 min-w-0 px-1.5 py-1 border rounded text-[10px] font-mono" />
                  </div>
                </div>
              ))}
            </div>

            {/* Border width */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">외곽선 두께</label>
                <span className="text-xs text-gray-400 font-mono">{selectedElement.borderWidth}px</span>
              </div>
              <input type="range" min={0} max={8} value={selectedElement.borderWidth}
                onChange={(e) => updateElement(selectedId, { borderWidth: Number(e.target.value) })}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            </div>

            {/* Position */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'offsetX', label: 'X 위치' },
                { key: 'offsetY', label: 'Y 위치' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">{label}</label>
                    <span className="text-xs text-gray-400 font-mono">{selectedElement[key]}%</span>
                  </div>
                  <input type="range" min={0} max={100} value={selectedElement[key]}
                    onChange={(e) => updateElement(selectedId, { [key]: Number(e.target.value) })}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Add element dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowAddDialog(false)}>
          <div className="bg-white rounded-xl border shadow-lg p-5 w-80 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-semibold">요소 추가</h4>
            <div>
              <label className="text-xs text-gray-500 block mb-1">요소 타입</label>
              <select value={newElType} onChange={(e) => setNewElType(e.target.value)}
                className="w-full px-2 py-1.5 border rounded-lg text-xs">
                <option value="text">텍스트</option>
                <option value="timer">타이머</option>
              </select>
            </div>
            {newElType === 'text' && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">데이터 바인딩</label>
                <select value={newElBinding} onChange={(e) => setNewElBinding(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded-lg text-xs">
                  {BINDING_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddDialog(false)}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">취소</button>
              <button onClick={confirmAddElement}
                className="px-3 py-1.5 text-xs bg-blue-500 text-white hover:bg-blue-600 rounded-lg">추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OverlaySettings;
