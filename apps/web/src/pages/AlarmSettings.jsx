import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Moon, ChevronLeft, Info, UserPlus, X, Search } from 'lucide-react';
import { SEARCH_PLAYERS } from '../features/viewer/data/mockData';

/* 알림 설정 (데모) — /alarm/demo
   알림 받을 선수(내·자녀·관심 선수 찾아 추가) + 알림 종류 + 방해금지 시간 + 알림 권한.
   TODO(backend): GET/PATCH /me/notif-settings, GET /me/alert-players, FCM 푸시. */

const C = { bg: 'var(--bg,#070D18)', card: 'var(--surface,#13203A)', card2: 'var(--surface2,#1B2A47)', line: 'var(--line,#293B5E)', ink: 'var(--ink,#E9EEF8)', ink2: 'var(--ink2,#9FB0CC)', ink3: 'var(--ink3,#64748f)', blue: 'var(--blue,#5BA8FF)', mint: 'var(--mint,#34D4A6)' };

const NOTIF = [
  { key: 'turn', label: '내 차례 알림', desc: '추가한 선수의 다음 출전이 임박하면', def: true, player: true },
  { key: 'result', label: '경기 결과 알림', desc: '추가한 선수 경기 결과가 나오면', def: true, player: true },
  { key: 'award', label: '시상 호명 알림', desc: '시상대 호명 전에 미리', def: true, player: true },
  { key: 'notice', label: '대회 공지·접수 마감', desc: '관심 대회 소식·마감 임박', def: true },
  { key: 'cheer', label: '응원·댓글 알림', desc: '내 글에 응원이 달리면', def: false },
  { key: 'mktg', label: '이벤트·혜택 (마케팅)', desc: '선택 — 광고성 정보 수신 동의', def: false },
];

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on} style={{ width: 46, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 3, background: on ? C.blue : 'var(--line2,#3A5180)', transition: 'background .15s', flexShrink: 0 }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(18px)' : 'translateX(0)', transition: 'transform .15s' }} />
    </button>
  );
}

export default function AlarmSettings() {
  const navigate = useNavigate();
  const [notif, setNotif] = useState(() => Object.fromEntries(NOTIF.map((n) => [n.key, n.def])));
  const [dnd, setDnd] = useState(true);
  const [start, setStart] = useState('22:00');
  const [end, setEnd] = useState('08:00');
  // 알림 받을 선수 — 기본: 본인
  const [players, setPlayers] = useState([{ id: 'me', name: '김서연 (나)', div: '남자 9세부' }]);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');

  const set = (k, v) => setNotif((s) => ({ ...s, [k]: v }));
  const results = useMemo(() => {
    const added = new Set(players.map((p) => p.name.replace(' (나)', '')));
    const base = SEARCH_PLAYERS.filter((p) => !added.has(p.name));
    const t = q.trim();
    return t ? base.filter((p) => p.name.includes(t) || p.club.includes(t) || p.div.includes(t)) : base;
  }, [q, players]);
  const addPlayer = (p) => { setPlayers((xs) => [...xs, { id: p.id, name: p.name, div: p.div }]); setQ(''); };
  const removePlayer = (id) => setPlayers((xs) => xs.filter((p) => p.id !== id || id === 'me'));

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.ink, fontFamily: "'Pretendard',-apple-system,sans-serif", paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 8px', position: 'sticky', top: 0, background: C.bg, zIndex: 2 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 0, color: C.ink2, cursor: 'pointer', display: 'flex' }} aria-label="뒤로"><ChevronLeft size={22} /></button>
        <span style={{ fontSize: 17, fontWeight: 800 }}>알림 설정</span>
      </div>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '6px 16px' }}>
        <div style={{ display: 'flex', gap: 9, background: 'color-mix(in srgb,var(--blue,#5BA8FF) 9%,transparent)', border: `1px solid color-mix(in srgb,var(--blue,#5BA8FF) 25%,transparent)`, borderRadius: 12, padding: '12px 14px', fontSize: 12.5, color: C.ink2, lineHeight: 1.6, marginTop: 6 }}>
          <Info size={16} style={{ color: C.blue, flexShrink: 0, marginTop: 1 }} />
          <span>알림 받을 선수를 추가하면, 그 선수의 <b style={{ color: C.ink }}>경기·결과·시상</b>을 앱이 꺼져 있어도 알려드려요. 방해금지 시간엔 조용히 쌓여요.</span>
        </div>

        {/* 알림 받을 선수 */}
        <Sec title="알림 받을 선수" right={<span style={{ fontSize: 12, color: C.ink3, fontWeight: 700 }}>{players.length}명</span>} />
        <div style={card()}>
          {players.map((p, i) => (
            <Row key={p.id} top={i > 0}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: C.card2, color: C.blue, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{p.name.charAt(0)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: C.ink3, marginTop: 1 }}>{p.div}</div>
              </div>
              {p.id !== 'me' && <button onClick={() => removePlayer(p.id)} style={{ background: 'none', border: 0, color: C.ink3, cursor: 'pointer', display: 'flex' }} aria-label="삭제"><X size={18} /></button>}
            </Row>
          ))}
          {!adding ? (
            <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '13px 0', marginTop: 4, background: 'none', border: `1px dashed var(--line2,#3A5180)`, borderRadius: 11, color: C.blue, fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              <UserPlus size={17} /> 선수 찾아서 추가
            </button>
          ) : (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.card2, border: `1px solid ${C.line}`, borderRadius: 11, padding: '10px 12px' }}>
                <Search size={15} style={{ color: C.ink3 }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="선수 이름 / 소속 검색" style={{ flex: 1, background: 'transparent', border: 0, outline: 'none', color: C.ink, fontSize: 14, fontFamily: 'inherit' }} />
                <button onClick={() => { setAdding(false); setQ(''); }} style={{ background: 'none', border: 0, color: C.ink3, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>닫기</button>
              </div>
              <div style={{ marginTop: 6, maxHeight: 230, overflowY: 'auto' }}>
                {results.length === 0 ? <div style={{ fontSize: 12.5, color: C.ink3, padding: '14px 2px' }}>결과 없음</div> : results.map((p) => (
                  <button key={p.id} onClick={() => addPlayer(p)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '10px 2px', background: 'none', border: 0, borderBottom: `1px solid ${C.line}`, cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, background: C.card2, color: C.blue, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{p.name.charAt(0)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{p.name} <span style={{ fontSize: 11, color: C.ink3 }}>{p.div}</span></div><div style={{ fontSize: 11, color: C.ink3 }}>{p.club}</div></div>
                    <span style={{ color: C.mint, fontSize: 13, fontWeight: 800 }}>＋ 추가</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 알림 종류 */}
        <Sec icon={<Bell size={15} />} title="알림 종류" />
        <div style={card()}>
          {NOTIF.map((n, i) => (
            <Row key={n.key} top={i > 0}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{n.label}{n.player && <span style={{ fontSize: 10.5, color: C.blue, fontWeight: 800, marginLeft: 6, background: 'color-mix(in srgb,var(--blue,#5BA8FF) 14%,transparent)', padding: '2px 6px', borderRadius: 5 }}>선수</span>}{n.key === 'mktg' && <span style={{ fontSize: 11, color: C.ink3, fontWeight: 600 }}> · 선택</span>}</div>
                <div style={{ fontSize: 11.5, color: C.ink3, marginTop: 2 }}>{n.desc}</div>
              </div>
              <Toggle on={notif[n.key]} onChange={(v) => set(n.key, v)} />
            </Row>
          ))}
        </div>

        {/* 방해금지 */}
        <Sec icon={<Moon size={15} />} title="방해금지 시간" />
        <div style={card()}>
          <Row>
            <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>방해금지 켜기</div><div style={{ fontSize: 11.5, color: C.ink3, marginTop: 2 }}>이 시간엔 알림이 소리 없이 쌓여요</div></div>
            <Toggle on={dnd} onChange={setDnd} />
          </Row>
          {dnd && (
            <Row top>
              <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>시간대</span>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={timeIn()} />
              <span style={{ color: C.ink3, margin: '0 8px' }}>~</span>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={timeIn()} />
            </Row>
          )}
        </div>

        {/* 알림 권한 */}
        <Sec title="알림 권한" />
        <div style={card()}>
          <Row>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: C.card2, display: 'grid', placeItems: 'center', color: C.blue, flexShrink: 0 }}><Bell size={17} /></span>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700 }}>푸시 알림</div><div style={{ fontSize: 11.5, color: C.ink3, marginTop: 2 }}>경기·결과를 폰으로 받기</div></div>
            <span style={{ fontSize: 12, fontWeight: 800, padding: '5px 11px', borderRadius: 999, color: C.mint, background: 'color-mix(in srgb,var(--mint,#34D4A6) 15%,transparent)' }}>허용됨</span>
          </Row>
        </div>
        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <button onClick={() => navigate('/settings/demo')} style={{ background: 'none', border: 0, color: C.ink3, fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>일반 설정 (테마·약관) →</button>
        </div>
      </div>
    </div>
  );
}

function Sec({ icon, title, right }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '24px 2px 10px' }}>{icon}<span style={{ fontSize: 14, fontWeight: 800 }}>{title}</span>{right && <span style={{ marginLeft: 'auto' }}>{right}</span>}</div>;
}
function card() { return { background: C.card, border: `1px solid ${C.line}`, borderRadius: 15, padding: '4px 16px' }; }
function Row({ children, top }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderTop: top ? `1px solid ${C.line}` : 'none' }}>{children}</div>; }
function timeIn() { return { background: C.card2, border: `1px solid ${C.line}`, borderRadius: 9, padding: '7px 10px', color: C.ink, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', colorScheme: 'dark' }; }
