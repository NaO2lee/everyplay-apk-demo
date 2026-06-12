import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../ViewerApp.module.css';
import { SCHEDULE, SCHEDULE_MONTH, SCHEDULE_STATUS_TABS, SCHEDULE_EVENT_TABS } from '../data/mockData';

// 대회 일정 — 테니스타운 구조(월 페이징 + 상태/종목 필터 + 주차 그룹 + 날짜블록 카드 + 상태 배지)
// TODO(backend): SCHEDULE을 대회 일정 API(또는 협회 수집 데이터)로 교체
const ST = {
  '신청': { cls: 'sbApply', label: '신청' },
  '접수중': { cls: 'sbOpen', label: '접수중' },
  '임박': { cls: 'sbHot', label: '임박' },
  '대기': { cls: 'sbWait', label: '대기' },
  '대진오픈': { cls: 'sbDraw', label: '대진오픈' },
  '모집예정': { cls: 'sbClosed', label: '모집예정' },
  '마감': { cls: 'sbClosed', label: '마감' },
  'LIVE': { cls: 'sbLive', label: '● LIVE' },
};

// 오늘 기준 D-day 라벨
function ddayText(it, today) {
  if (it.status === 'LIVE') return 'LIVE';
  if (!it.date) return '';
  const d = new Date(`${it.date}T00:00:00`);
  const diff = Math.round((d - today) / 86400000);
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return 'D-DAY';
  return '종료';
}

export function ScheduleTab() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('전체');
  const [event, setEvent] = useState('전체');
  const [favs, setFavs] = useState(() => new Set(SCHEDULE.flatMap((w) => w.items.filter((i) => i.fav).map((i) => i.id))));

  const toggleFav = (id) => setFavs((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const matchStatus = (it) => {
    switch (status) {
      case '메인': return !!it.main;
      case '관심': return favs.has(it.id);
      case '모집중': return ['접수중', '임박'].includes(it.status);
      case '모집예정': return it.status === '모집예정';
      default: return true; // 전체 / My
    }
  };
  const matchEvent = (it) => event === '전체' || it.event === event;

  const groups = SCHEDULE
    .map((w) => ({ week: w.week, items: w.items.filter((it) => matchStatus(it) && matchEvent(it)) }))
    .filter((w) => w.items.length > 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className={styles.pageFade}>
      <div className={styles.schMonth}>
        <button aria-label="이전 달">‹</button>
        <b>{SCHEDULE_MONTH}</b>
        <button aria-label="다음 달">›</button>
      </div>

      <div className={styles.schtabs}>
        {SCHEDULE_STATUS_TABS.map((t) => (
          <button key={t} className={`${styles.schtab} ${status === t ? styles.schtabOn : ''}`} onClick={() => setStatus(t)}>{t}</button>
        ))}
      </div>
      <div className={styles.schtabs2}>
        {SCHEDULE_EVENT_TABS.map((t) => (
          <button key={t} className={`${styles.schtab2} ${event === t ? styles.schtab2On : ''}`} onClick={() => setEvent(t)}>{t}</button>
        ))}
      </div>

      <div className={styles.schSearch}>🔍 대회명 검색</div>

      {groups.length === 0 ? (
        <div className={styles.schEmpty}>조건에 맞는 대회가 없어요</div>
      ) : groups.map((w) => (
        <div key={w.week}>
          <div className={styles.weekbar}>{w.week}</div>
          {w.items.map((it) => {
            const st = ST[it.status] || ST['신청'];
            return (
              <div key={it.id} className={`${styles.schcard} ${it.main ? styles.schcardMain : ''}`} onClick={() => navigate('/competition/demo')}>
                {it.main && <span className={styles.schRibbon} />}
                <div className={styles.schDate}>
                  <span className={`${styles.schDay} ${it.main ? styles.schDayMain : ''}`}>{it.day}</span>
                  <span className={styles.schDow}>{it.dow}</span>
                </div>
                <div className={styles.schDivV} />
                <div className={styles.schBody}>
                  <div className={styles.schTitle}>
                    <span className={`${styles.dday} ${it.status === 'LIVE' ? styles.ddayLive : ''}`}>{ddayText(it, today)}</span>
                    {it.title}
                  </div>
                  <div className={styles.schSub}>{it.sub}</div>
                  {it.days > 1 && (it.dayOf
                    ? <span className={`${styles.schDays} ${styles.schDaysLive}`}>🔴 {it.dayOf}일차 진행중 · {it.period}</span>
                    : <span className={styles.schDays}>📅 {it.period} · {it.days}일간</span>)}
                </div>
                <div className={styles.schRight}>
                  <button
                    className={`${styles.fav} ${favs.has(it.id) ? styles.favOn : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleFav(it.id); }}
                    aria-label="관심 대회"
                  >
                    {favs.has(it.id) ? '★' : '☆'}
                  </button>
                  <span className={`${styles.sbadge} ${styles[st.cls]}`}>{st.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default ScheduleTab;
