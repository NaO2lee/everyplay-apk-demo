import { useMemo, useState } from 'react';
import styles from '../ViewerApp.module.css';
import { NOTIFICATIONS, SEARCH_PLAYERS } from '../data/mockData';

// 알림함 (🔔) — 바텀시트. TODO(backend): GET /me/notifications, PATCH read
export function NotifSheet({ open, onClose }) {
  const [items, setItems] = useState(NOTIFICATIONS);
  const unread = items.filter((n) => n.unread).length;
  return (
    <>
      <div className={`${styles.dim} ${open ? styles.dimOn : ''}`} onClick={onClose} />
      <div className={`${styles.sheet} ${open ? styles.sheetOn : ''}`}>
        <button className={styles.grab} onClick={onClose} aria-label="닫기" />
        <div className={styles.scont}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--ink)' }}>알림 {unread > 0 && <span style={{ fontSize: 13, color: 'var(--live)' }}>· 새 {unread}</span>}</h2>
            {unread > 0 && <button onClick={() => setItems((xs) => xs.map((n) => ({ ...n, unread: false })))} style={linkBtn}>모두 읽음</button>}
          </div>
          {items.map((n) => (
            <div key={n.id} style={{ display: 'flex', gap: 12, padding: '13px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{n.ic}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: n.unread ? 800 : 600, color: n.unread ? 'var(--ink)' : 'var(--ink2)', lineHeight: 1.45, wordBreak: 'keep-all' }}>{n.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--gray)', marginTop: 3 }}>{n.time}</div>
              </div>
              {n.unread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--live)', flexShrink: 0, marginTop: 6 }} />}
            </div>
          ))}
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray)', padding: '16px 0 4px' }}>알림은 설정에서 종류·방해금지 시간을 조절할 수 있어요</div>
        </div>
      </div>
    </>
  );
}

// 선수·영상 검색 (🔍) — 바텀시트. TODO(backend): GET /public/events/{code}/participants?q=
export function SearchSheet({ open, onClose }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const t = q.trim();
    if (!t) return SEARCH_PLAYERS;
    return SEARCH_PLAYERS.filter((p) => p.name.includes(t) || p.club.includes(t) || p.div.includes(t));
  }, [q]);
  return (
    <>
      <div className={`${styles.dim} ${open ? styles.dimOn : ''}`} onClick={onClose} />
      <div className={`${styles.sheet} ${open ? styles.sheetOn : ''}`}>
        <button className={styles.grab} onClick={onClose} aria-label="닫기" />
        <div className={styles.scont}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px', color: 'var(--ink)' }}>선수 · 영상 검색</h2>
          <div className={styles.vodSearch} style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--gray)' }}>🔍</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="선수 이름 / 소속 / 부" autoFocus style={{ flex: 1, background: 'transparent', border: 0, outline: 'none', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit' }} />
          </div>
          {results.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--gray)', fontSize: 13, padding: '28px 0' }}>'{q}' 검색 결과가 없어요</div>
          ) : results.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--chipBg)', color: 'var(--accent)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{p.name.charAt(0)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>{p.name} <span style={{ fontSize: 11.5, color: 'var(--gray)', fontWeight: 600 }}>{p.div}</span></div>
                <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>{p.club} · 최고 {p.best}</div>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--chipInk)', background: 'var(--chipBg)', padding: '5px 10px', borderRadius: 999, flexShrink: 0 }}>🎬 {p.clips}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

const linkBtn = { background: 'none', border: 0, color: 'var(--cyan)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
