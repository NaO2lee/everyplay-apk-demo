import { useSyncExternalStore } from 'react';

/* 공용 응원 채팅 스토어 — 모든 코트가 같은 채팅 공유. court=작성자가 보던 코트.
   ts=작성 시각(epoch). 라이브 중엔 "N분 전", 라이브 끝나면 "26.03.04 12:33"로 표시.
   TODO(backend): GET/POST /events/{code}/chat (공용), ended 여부는 대회 상태로 판단. */

const t0 = Date.now();
let chat = [
  { id: 'c1', name: '응원단A', color: '#5BA8FF', court: 1, text: '김서연 화이팅! 🔥', ts: t0 - 9 * 60000 },
  { id: 'c2', name: '점프맘', color: '#34D4A6', court: 2, text: '와 속도 미쳤다 👏', ts: t0 - 7 * 60000 },
  { id: 'c3', name: '관전중', color: '#B49CFF', court: 1, text: '이번 히트 신기록 가즈아 💪', ts: t0 - 5 * 60000 },
  { id: 'c4', name: '화성클럽', color: '#FFB648', court: 3, text: '우리 선수 1등! 🎉', ts: t0 - 3 * 60000 },
  { id: 'c5', name: '줄넘기팬', color: '#FF7A66', court: 4, text: '더블언더 대박 😮', ts: t0 - 1 * 60000 },
];

const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export function sendChat(text, court) {
  const v = String(text || '').trim();
  if (!v) return;
  chat = [...chat, { id: `me${chat.length}-${Date.now()}`, name: '나', color: '#33D6D6', court, text: v, ts: Date.now() }];
  emit();
}

export function useChat() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => chat,
  );
}

const p2 = (n) => String(n).padStart(2, '0');

// 라이브 중: 방금 / N분 전 / N시간 전
export function relTime(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

// 라이브 종료 후: 26.03.04 12:33 (기록으로 남김)
export function absTime(ts) {
  const d = new Date(ts);
  return `${p2(d.getFullYear() % 100)}.${p2(d.getMonth() + 1)}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

// 라이브 여부에 따라 표시 시각 선택
export const chatTime = (ts, live) => (live ? relTime(ts) : absTime(ts));
