import { useEffect, useState, useRef, useMemo } from 'react';
import { Plus, Trash2, Upload, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { api } from '../../services/api';
import { useModal } from '../Modal';

// 프론트 매핑 (표시용)
const EVENT_DISPLAY = {
  SRSS: '30초 번갈아뛰기', SRSE: '3분 뛰기', SRSR: '4인 스피드 릴레이',
  DDSS: '3인 쌍줄 스피드', DDSR: '4인 쌍줄 스피드 릴레이',
  SRIF: '개인 프리스타일', SRPF: '2인 프리스타일', DDPF: '쌍줄 페어 프리스타일',
};

const DIVISION_DISPLAY = {
  'M U9': '남자-9세미만', 'F U9': '여자-9세미만',
  'M 8 under': '남자-9세미만', 'F 8 under': '여자-9세미만',
  'M 9-11': '남자-9~11세', 'F 9-11': '여자-9~11세',
  'M 12-15': '남자-12~15세', 'F 12-15': '여자-12~15세',
  'M U16': '남자-16세미만', 'F U16': '여자-16세미만',
  'Mixed U16': '혼성-16세미만', 'X U16': '혼성-16세미만',
  'M 16-18': '남자-16~18세', 'F 16-18': '여자-16~18세',
  'M 16+': '남자-16세이상', 'F 16+': '여자-16세이상',
  'Mixed 16+': '혼성-16세이상', 'X 16+': '혼성-16세이상',
  'M 19+': '남자-오픈', 'F 19+': '여자-오픈',
  'M Open': '남자-오픈', 'F Open': '여자-오픈',
  'Mixed Open': '혼성-오픈',
  'X 15 Younger': '혼성-16세미만', 'F 15 Younger': '여자-16세미만',
};

function displayEvent(code) { return EVENT_DISPLAY[code] || code; }
function displayDivision(raw) { return DIVISION_DISPLAY[raw] || raw; }

export function HeatSchedule({ eventId }) {
  const modal = useModal();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMode, setViewMode] = useState('heats'); // 'heats' | 'programs'
  const fileInputRef = useRef(null);

  useEffect(() => { loadData(); }, [eventId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getPrograms(eventId);
      setPrograms(res?.data?.items || []);
    } catch (e) {
      await modal.alert('데이터 로드 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // 날짜 목록 추출
  const dates = useMemo(() => {
    const set = new Set();
    programs.forEach(p => { if (p.competition_date) set.add(p.competition_date); });
    return [...set].sort();
  }, [programs]);

  // 선택된 날짜 자동 설정
  useEffect(() => {
    if (!selectedDate && dates.length > 0) setSelectedDate(dates[0]);
  }, [dates]);

  // 선택된 날짜의 히트를 번호순 병합
  const heatList = useMemo(() => {
    const filtered = programs.filter(p => p.competition_date === selectedDate);
    const heatsMap = {}; // heat_number -> {heat_number, entries: [{station, event_code, division, names}]}

    filtered.forEach(prog => {
      const assignments = prog.heat_assignments || [];
      assignments.forEach(h => {
        const num = h.heat_number;
        if (!heatsMap[num]) heatsMap[num] = { heat_number: num, entries: [] };
        heatsMap[num].entries.push({
          station: h.station,
          event_code: prog.event_code,
          division: prog.division,
          participant_names: h.participant_names || [],
        });
      });
    });

    return Object.values(heatsMap).sort((a, b) => a.heat_number - b.heat_number);
  }, [programs, selectedDate]);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const res = await api.importExcel(eventId, file);
      const s = res.data;
      await modal.alert(`임포트 완료\n프로그램: ${s.programs_created}개\n참가자: ${s.participants_imported}명\n히트: ${s.heats_assigned}개\n에러: ${s.errors?.length || 0}건`);
      loadData();
    } catch (err) {
      await modal.alert('임포트 실패: ' + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteProgram = async (programId) => {
    if (!await modal.confirm('이 프로그램을 삭제할까요?')) return;
    try {
      await api.deleteProgram(eventId, programId);
      loadData();
    } catch (e) {
      await modal.alert('삭제 실패: ' + e.message);
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-400">로딩 중...</div>;

  return (
    <div className="space-y-4">
      {/* 상단 바 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">대진표</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'heats' ? 'programs' : 'heats')}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
          >
            {viewMode === 'heats' ? '프로그램 보기' : '히트 순서 보기'}
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleImport} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm"
          >
            <Upload className="w-4 h-4" />
            {importing ? '임포트 중...' : '엑셀 임포트'}
          </button>
        </div>
      </div>

      {/* 요약 */}
      <p className="text-sm text-gray-600">
        프로그램 {programs.length}개 · 날짜 {dates.length}일 ·
        총 히트 {programs.reduce((s, p) => s + (p.heat_assignments?.length || 0), 0)}개
      </p>

      {/* 날짜 탭 */}
      {dates.length > 0 && (
        <div className="flex gap-1 border-b">
          {dates.map(d => (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              className={`px-4 py-2 text-sm border-b-2 ${
                selectedDate === d
                  ? 'border-blue-500 text-blue-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {/* 히트 순서 뷰 */}
      {viewMode === 'heats' && (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2 w-16">HIT</th>
                <th className="text-left px-3 py-2">종목</th>
                <th className="text-left px-3 py-2">참가부</th>
                <th className="text-left px-3 py-2">ST</th>
                <th className="text-left px-3 py-2">선수</th>
              </tr>
            </thead>
            <tbody>
              {heatList.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  {selectedDate ? '해당 날짜에 히트가 없습니다' : '날짜를 선택하세요'}
                </td></tr>
              )}
              {heatList.map(heat => (
                heat.entries.map((entry, idx) => (
                  <tr key={`${heat.heat_number}_${entry.station}_${idx}`} className="border-t hover:bg-gray-50">
                    {idx === 0 && (
                      <td className="px-3 py-2 font-mono font-bold text-gray-800" rowSpan={heat.entries.length}>
                        {heat.heat_number}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">{entry.event_code}</span>
                      <span className="text-xs text-gray-500 ml-1">{displayEvent(entry.event_code)}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">{displayDivision(entry.division)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">ST{entry.station}</td>
                    <td className="px-3 py-2 text-xs">
                      {entry.participant_names.join(', ') || '-'}
                    </td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 프로그램 뷰 */}
      {viewMode === 'programs' && (
        <div className="space-y-2">
          {programs.filter(p => !selectedDate || p.competition_date === selectedDate).length === 0 && (
            <div className="text-center py-12 text-gray-400">등록된 프로그램이 없습니다</div>
          )}
          {programs.filter(p => !selectedDate || p.competition_date === selectedDate).map(prog => (
            <div key={prog.id} className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500">#{prog.order}</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">{prog.event_code}</span>
                  <span className="font-semibold">{displayEvent(prog.event_code)}</span>
                  <span className="text-sm text-gray-600">{displayDivision(prog.division)}</span>
                  <span className="text-xs text-gray-400">히트 {(prog.heat_assignments || []).length}개</span>
                </div>
                <button onClick={() => handleDeleteProgram(prog.id)}
                  className="p-1 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HeatSchedule;
