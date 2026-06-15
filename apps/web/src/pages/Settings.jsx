import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Moon, Camera, Image, ChevronLeft, Info } from 'lucide-react';

/* 알림 · 설정 (데모) — /settings/demo
   알림 종류별 ON/OFF + 방해금지 시간 + 권한 동의/상태 + 마케팅 동의.
   알림 동작 방식(설계):
   - 푸시 = Capacitor @capacitor/push-notifications → FCM(안드)/APNs(iOS). 앱 닫혀 있어도 폰에 도착.
   - 임박/D-day 리마인더 = @capacitor/local-notifications (서버 없이 기기에서 예약).
   - 방해금지 시간엔 알림 표시 안 함(조용). 권한 거부해도 앱은 그대로 사용 가능(점진 요청).
   TODO(backend): 토큰 등록 POST /me/push-token, 설정 저장 PATCH /me/notif-settings, FCM 발송 서버. */

const C = { bg: 'var(--bg,#070D18)', card: 'var(--surface,#13203A)', card2: 'var(--surface2,#1B2A47)', line: 'var(--line,#293B5E)', ink: 'var(--ink,#E9EEF8)', ink2: 'var(--ink2,#9FB0CC)', ink3: 'var(--ink3,#64748f)', blue: 'var(--blue,#5BA8FF)', mint: 'var(--mint,#34D4A6)', butter: 'var(--butter,#FFB648)' };

const NOTIF = [
  { key: 'turn', label: '내 차례 알림', desc: '다음 출전이 임박하면 미리 알려줘요', def: true },
  { key: 'result', label: '경기 결과 알림', desc: '내·자녀 경기 결과가 나오면', def: true },
  { key: 'award', label: '시상 호명 알림', desc: '시상대 호명 전에 미리', def: true },
  { key: 'notice', label: '대회 공지·접수 마감', desc: '관심 대회 소식·마감 임박', def: true },
  { key: 'cheer', label: '응원·댓글 알림', desc: '내 글에 응원이 달리면', def: false },
  { key: 'mktg', label: '이벤트·혜택 (마케팅)', desc: '선택 — 광고성 정보 수신 동의', def: false },
];
const PERMS = [
  { key: 'noti', Icon: Bell, label: '알림 권한', why: '내 차례·결과를 폰으로 받기', status: 'granted' },
  { key: 'cam', Icon: Camera, label: '카메라', why: '내 영상 직접 촬영·업로드 시에만', status: 'ask' },
  { key: 'photo', Icon: Image, label: '사진·저장', why: '경기 영상 저장 시에만', status: 'ask' },
];

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on} style={{ width: 46, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 3, background: on ? C.blue : 'var(--line2,#3A5180)', transition: 'background .15s', flexShrink: 0 }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(18px)' : 'translateX(0)', transition: 'transform .15s' }} />
    </button>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [notif, setNotif] = useState(() => Object.fromEntries(NOTIF.map((n) => [n.key, n.def])));
  const [dnd, setDnd] = useState(true);
  const [start, setStart] = useState('22:00');
  const [end, setEnd] = useState('08:00');
  const allOn = NOTIF.filter((n) => n.key !== 'mktg').every((n) => notif[n.key]);

  const set = (k, v) => setNotif((s) => ({ ...s, [k]: v }));

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.ink, fontFamily: "'Pretendard',-apple-system,sans-serif", paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 8px', position: 'sticky', top: 0, background: C.bg, zIndex: 2 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 0, color: C.ink2, cursor: 'pointer', display: 'flex' }} aria-label="뒤로"><ChevronLeft size={22} /></button>
        <span style={{ fontSize: 17, fontWeight: 800 }}>알림 · 설정</span>
      </div>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '6px 16px' }}>
        {/* 알림 동작 안내 */}
        <div style={{ display: 'flex', gap: 9, background: 'color-mix(in srgb,var(--blue,#5BA8FF) 9%,transparent)', border: `1px solid color-mix(in srgb,var(--blue,#5BA8FF) 25%,transparent)`, borderRadius: 12, padding: '12px 14px', fontSize: 12.5, color: C.ink2, lineHeight: 1.6, marginTop: 6 }}>
          <Info size={16} style={{ color: C.blue, flexShrink: 0, marginTop: 1 }} />
          <span>알림은 앱이 꺼져 있어도 폰으로 도착해요. <b style={{ color: C.ink }}>방해금지 시간</b>엔 조용히 쌓이고, 권한을 꺼도 앱은 그대로 쓸 수 있어요.</span>
        </div>

        {/* 알림 종류 */}
        <Sec icon={<Bell size={15} />} title="알림 받기" right={<span style={{ fontSize: 12, color: C.ink3, fontWeight: 700 }}>{allOn ? '전체 켜짐' : '일부 꺼짐'}</span>} />
        <div style={card()}>
          {NOTIF.map((n, i) => (
            <Row key={n.key} top={i > 0}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{n.label}{n.key === 'mktg' && <span style={{ fontSize: 11, color: C.ink3, fontWeight: 600 }}> · 선택</span>}</div>
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
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>방해금지 켜기</div>
              <div style={{ fontSize: 11.5, color: C.ink3, marginTop: 2 }}>이 시간엔 알림이 소리 없이 쌓여요</div>
            </div>
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

        {/* 권한 */}
        <Sec title="앱 권한" />
        <div style={card()}>
          {PERMS.map((p, i) => {
            const Icon = p.Icon;
            return (
              <Row key={p.key} top={i > 0}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: C.card2, display: 'grid', placeItems: 'center', color: C.blue, flexShrink: 0 }}><Icon size={17} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{p.label}</div>
                  <div style={{ fontSize: 11.5, color: C.ink3, marginTop: 2 }}>{p.why}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, padding: '5px 11px', borderRadius: 999, color: p.status === 'granted' ? C.mint : C.butter, background: p.status === 'granted' ? 'color-mix(in srgb,var(--mint,#34D4A6) 15%,transparent)' : 'color-mix(in srgb,var(--butter,#FFB648) 16%,transparent)' }}>
                  {p.status === 'granted' ? '허용됨' : '요청'}
                </span>
              </Row>
            );
          })}
          <div style={{ fontSize: 11, color: C.ink3, padding: '12px 2px 4px', lineHeight: 1.5 }}>권한은 필요한 순간에만 물어봐요. 거부해도 해당 기능만 빼고 앱은 정상 사용돼요. (변경은 폰 설정 → 앱 권한)</div>
        </div>

        {/* 약관 */}
        <Sec title="약관 · 개인정보" />
        <div style={card()}>
          {['이용약관', '개인정보 처리방침', '청소년 보호정책'].map((t, i) => (
            <Row key={t} top={i > 0}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{t}</span>
              <span style={{ color: C.ink3 }}>›</span>
            </Row>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: C.ink3, marginTop: 22 }}>모두의플레이 · v0.9 (데모)</div>
      </div>
    </div>
  );
}

function Sec({ icon, title, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '24px 2px 10px' }}>
      {icon}<span style={{ fontSize: 14, fontWeight: 800 }}>{title}</span>
      {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
    </div>
  );
}
function card() { return { background: C.card, border: `1px solid ${C.line}`, borderRadius: 15, padding: '4px 16px' }; }
function Row({ children, top }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderTop: top ? `1px solid ${C.line}` : 'none' }}>{children}</div>;
}
function timeIn() { return { background: C.card2, border: `1px solid ${C.line}`, borderRadius: 9, padding: '7px 10px', color: C.ink, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', colorScheme: 'dark' }; }
