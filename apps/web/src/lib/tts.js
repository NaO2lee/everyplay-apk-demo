/**
 * Web Speech API TTS — v3.3 R3.
 * 브라우저 내장 음성 합성 (무료). 한·영 분리, ko-KR / en-US.
 *
 * Phase 4에서 ElevenLabs로 사회자 음성 클로닝 교체 예정.
 * 현재는 기본 음성 (운영체제별).
 */

let queue = [];
let busy = false;

function pickVoice(lang) {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  // 한국어 우선순위 (애플 → 구글 → MS)
  const preferKo = ['Yuna', '유나', 'Kyuri', 'Heami', 'Google 한국의'];
  const preferEn = ['Samantha', 'Alex', 'Daniel', 'Karen', 'Google US English'];
  const target = lang === 'ko' ? preferKo : preferEn;
  for (const name of target) {
    const v = voices.find((x) => x.name === name || x.name.includes(name));
    if (v) return v;
  }
  const langCode = lang === 'ko' ? 'ko' : 'en';
  return voices.find((v) => v.lang.startsWith(langCode)) || null;
}

function speakOne(text, lang) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window) || !text) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'ko' ? 'ko-KR' : 'en-US';
    u.rate = lang === 'ko' ? 0.92 : 0.95;
    u.pitch = 1.0;
    u.volume = 1.0;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(); };
    u.onend = finish;
    u.onerror = finish;
    setTimeout(finish, text.length * 150 + 5000);
    window.speechSynthesis.speak(u);
  });
}

async function drain() {
  if (busy) return;
  busy = true;
  while (queue.length > 0) {
    const { text, lang } = queue.shift();
    await speakOne(text, lang);
  }
  busy = false;
}

/** 큐에 추가하고 자동 재생 시작. lang='ko'|'en'. */
export function speak(text, lang = 'ko') {
  if (!text) return;
  queue.push({ text, lang });
  drain();
}

/** 한·영 동시 (한국어 먼저, 영어 그 다음). */
export function speakBoth(textKo, textEn) {
  if (textKo) speak(textKo, 'ko');
  if (textEn) speak(textEn, 'en');
}

/** 진행 중인 큐 모두 취소. */
export function cancel() {
  queue = [];
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  busy = false;
}

/** 사용 가능 여부. */
export function isSupported() {
  return 'speechSynthesis' in window;
}

// 음성 로드 (lazy) — 첫 사용 전에 voices 비어있을 수 있음
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  window.speechSynthesis.getVoices();
}
