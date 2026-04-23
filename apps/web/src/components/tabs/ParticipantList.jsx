import { useEffect, useState, useRef } from 'react';
import { Upload, Plus, Download, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';
import { useModal } from '../Modal';

export function ParticipantList({ eventId }) {
  const modal = useModal();
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);
  const [newParticipant, setNewParticipant] = useState({
    name: '',
    phone: '',
    team: '',
    category: '',
  });

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const loadParticipants = async (page = currentPage, limit = pageSize) => {
    try {
      setLoading(true);
      const skip = (page - 1) * limit;
      const response = await api.getParticipants(eventId, { search, skip, limit });
      setParticipants(response.data?.items || []);
      setTotalCount(response.data?.total || 0);
    } catch (e) {
      console.error('Failed to load participants:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParticipants(1, pageSize);
    setCurrentPage(1);
  }, [eventId, pageSize]);

  const handleSearch = () => {
    setCurrentPage(1);
    loadParticipants(1, pageSize);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    loadParticipants(page, pageSize);
  };

  const handleAdd = async () => {
    if (!newParticipant.name || !newParticipant.phone) {
      await modal.alert('이름과 전화번호는 필수입니다.');
      return;
    }

    try {
      await api.createParticipant(eventId, newParticipant);
      setNewParticipant({ name: '', phone: '', team: '', category: '' });
      setShowAddForm(false);
      loadParticipants(currentPage, pageSize);
    } catch (e) {
      await modal.alert('등록 실패: ' + e.message);
    }
  };

  // 페이지 번호 목록 생성
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">참가자 (총 {totalCount}명)</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 bg-blue-500 text-white py-1.5 px-3 rounded text-sm hover:bg-blue-600"
          >
            <Plus className="w-4 h-4" />
            추가
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 bg-green-500 text-white py-1.5 px-3 rounded text-sm hover:bg-green-600"
          >
            <Upload className="w-4 h-4" />
            CSV 업로드
          </button>
          <a
            href="/samples/participants_template.csv"
            download
            className="flex items-center gap-1 bg-gray-100 text-gray-600 py-1.5 px-3 rounded text-sm hover:bg-gray-200"
          >
            <Download className="w-4 h-4" />
            샘플
          </a>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const result = await api.bulkImportParticipants(eventId, file);
                setUploadResult(result.data || result);
                loadParticipants(1, pageSize);
              } catch (err) {
                await modal.alert('업로드 실패: ' + err.message);
              }
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* 추가 폼 — 인라인 전개 */}
      {showAddForm && (
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">참가자 추가</h3>
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">이름 *</label>
              <input
                type="text"
                value={newParticipant.name}
                onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">전화번호 *</label>
              <input
                type="tel"
                value={newParticipant.phone}
                onChange={(e) => setNewParticipant({ ...newParticipant, phone: e.target.value })}
                placeholder="010-0000-0000"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">팀</label>
              <input
                type="text"
                value={newParticipant.team}
                onChange={(e) => setNewParticipant({ ...newParticipant, team: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">종목</label>
              <input
                type="text"
                value={newParticipant.category}
                onChange={(e) => setNewParticipant({ ...newParticipant, category: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAdd}
              className="bg-blue-500 text-white py-1.5 px-3 rounded text-sm hover:bg-blue-600"
            >
              등록
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="bg-gray-100 text-gray-600 py-1.5 px-3 rounded text-sm hover:bg-gray-200"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 업로드 결과 */}
      {uploadResult && (
        <div className={`rounded-lg p-3 text-sm ${uploadResult.failed > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
          <div className="flex items-center justify-between">
            <span>{uploadResult.imported || 0}명 등록 완료{uploadResult.failed > 0 ? `, ${uploadResult.failed}건 실패` : ''}</span>
            <button onClick={() => setUploadResult(null)} className="text-gray-400 hover:text-gray-600 text-xs">닫기</button>
          </div>
          {uploadResult.errors?.length > 0 && (
            <ul className="mt-2 text-xs text-orange-600 space-y-0.5">
              {uploadResult.errors.slice(0, 5).map((err, i) => <li key={i}>행 {err.row}: {err.message}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* 검색 + 페이지 크기 */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="이름 또는 팀으로 검색"
            className="w-full border rounded-lg pl-10 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(parseInt(e.target.value))}
          className="border rounded-lg px-2 py-2 text-sm"
        >
          <option value="10">10개씩</option>
          <option value="20">20개씩</option>
          <option value="50">50개씩</option>
          <option value="100">100개씩</option>
        </select>
        <button
          onClick={() => loadParticipants(currentPage, pageSize)}
          className="p-2 border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          불러오는 중...
        </div>
      ) : participants.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          등록된 참가자가 없습니다.
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600 w-10">#</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">이름</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">전화번호</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">팀</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">종목</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p, idx) => (
                <tr key={p.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-400">{(currentPage - 1) * pageSize + idx + 1}</td>
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 font-mono text-gray-500">{p.phone}</td>
                  <td className="px-4 py-2">{p.team || '-'}</td>
                  <td className="px-4 py-2">{p.category || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalCount)} / {totalCount}명
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {getPageNumbers().map(page => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-1.5 rounded text-sm ${
                  page === currentPage
                    ? 'bg-blue-500 text-white'
                    : 'border hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1.5 border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ParticipantList;
