import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../services/api';
import { AdminLayout } from '../features/admin/AdminLayout';
import styles from '../features/admin/AdminConsole.module.css';

// 대회 관리 — 관리자 콘솔 셸(AdminLayout) 안에서 실제 대회 목록(api.getEvents) 렌더
const PILL = {
  draft: { cls: 'pillDraft', t: '⚪ 준비중' },
  active: { cls: 'pillLive', t: '🔴 진행중' },
  completed: { cls: 'pillDone', t: '🟢 완료' },
  cancelled: { cls: 'pillDraft', t: '⚪ 취소' },
};

export function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await api.getEvents();
      setEvents(response.data.items);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEvents(); }, []);

  const muted = { color: 'var(--ink-3)', padding: '34px 0', textAlign: 'center', fontSize: 14 };

  return (
    <AdminLayout active="events">
      <div className={styles.ttlRow}>
        <div className={styles.ph} style={{ marginBottom: 0 }}>
          <h1>🏆 대회 관리</h1>
          <p>등록된 대회를 운영·집계·시상까지 한 곳에서 관리하세요.</p>
        </div>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => navigate('/admin/events/new')}>➕ 새 대회</button>
      </div>

      {error && (
        <div className={styles.block} style={{ color: 'var(--red)' }}>⚠️ {error}</div>
      )}

      <section className={styles.block}>
        {loading ? (
          <div style={muted}>불러오는 중…</div>
        ) : events.length === 0 ? (
          <div style={muted}>등록된 대회가 없습니다</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>대회명</th><th>일정</th><th>스테이션</th><th>상태</th><th style={{ textAlign: 'right' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const p = PILL[ev.status] || PILL.draft;
                  return (
                    <tr key={ev.id} onClick={() => navigate(`/admin/events/${ev.id}`)} style={{ cursor: 'pointer' }}>
                      <td><span className={styles.tname}>{ev.name}</span></td>
                      <td><span className={`${styles.dt} ${styles.num}`}>{ev.date}</span></td>
                      <td className={styles.num}>{ev.station_count}개</td>
                      <td><span className={`${styles.pill} ${styles[p.cls]}`}>{p.t}</span></td>
                      <td>
                        <div className={styles.acts}>
                          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>상세 →</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminLayout>
  );
}

export default EventList;
