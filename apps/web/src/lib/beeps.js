/**
 * 비프음 — v3.3 R7.
 * IJRU 공식 비프음 파일 우선 사용. 파일 없으면 Web Audio synth 폴백.
 *
 * 운영 시: /audio/ijru-start.mp3, /audio/ijru-end.mp3 배치.
 * (apps/web/public/audio/ 폴더에 파일 넣으면 자동 사용)
 */

let _ac = null;
function ctx() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  if (_ac.state === 'suspended') _ac.resume();
  return _ac;
}

function tone(freq, duration, type = 'sine', volume = 0.5, offset = 0) {
  const ac = ctx();
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(ac.destination);
  const start = ac.currentTime + offset;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(volume, start + 0.005);
  g.gain.linearRampToValueAtTime(volume, start + duration - 0.05);
  g.gain.linearRampToValueAtTime(0, start + duration);
  osc.start(start);
  osc.stop(start + duration);
}

// 파일 캐시 — 한 번 로드 후 재사용
const audioCache = {};

async function playFile(url) {
  try {
    if (!audioCache[url]) {
      const r = await fetch(url, { method: 'HEAD' });
      if (!r.ok) return false;
      audioCache[url] = new Audio(url);
    }
    audioCache[url].currentTime = 0;
    await audioCache[url].play();
    return true;
  } catch {
    delete audioCache[url];
    return false;
  }
}

/** 경기 시작 비프 — IJRU 파일 우선, 폴백은 3-tone ascending. */
export async function startBeep() {
  const ok = await playFile('/audio/ijru-start.mp3');
  if (ok) return;
  // 폴백: synth (Ready, Set, GO!)
  tone(880, 0.12, 'sine', 0.5, 0);
  tone(880, 0.12, 'sine', 0.5, 0.35);
  tone(1320, 0.6, 'sine', 0.75, 0.7);
}

/** 경기 종료 비프 — IJRU 파일 우선, 폴백은 1 long low tone. */
export async function endBeep() {
  const ok = await playFile('/audio/ijru-end.mp3');
  if (ok) return;
  tone(440, 0.9, 'sine', 0.7, 0);
}

/** 카운트다운 (남은 N초). 짧은 tick. */
export function tickBeep() {
  tone(660, 0.08, 'square', 0.4, 0);
}

/** iOS 첫 사용 unlock — 사용자 클릭 핸들러에서 호출. */
export function unlockAudio() {
  try { ctx(); } catch {}
}

/** IJRU 비프음 파일 존재 여부 (UI 안내용). */
export async function hasIjruFiles() {
  try {
    const r = await fetch('/audio/ijru-start.mp3', { method: 'HEAD' });
    return r.ok;
  } catch { return false; }
}
