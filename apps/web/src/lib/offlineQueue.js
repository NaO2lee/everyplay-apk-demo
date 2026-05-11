/**
 * 심판 채점 오프라인 큐 — v3.3 Phase 2.
 * IndexedDB 1개 스토어(pendingScores)에 미전송 score 저장.
 * 와이파이 끊겨도 잃지 않음. 복구되면 자동 재전송.
 */

const DB_NAME = 'mop_judge';
const DB_VERSION = 1;
const STORE = 'pendingScores';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode = 'readonly') {
  const db = await openDB();
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function enqueue(scoreSubmitBody) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const item = { body: scoreSubmitBody, queuedAt: new Date().toISOString() };
    const req = store.add(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll() {
  const store = await tx();
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function remove(id) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function count() {
  const items = await getAll();
  return items.length;
}

/**
 * 큐를 비우면서 서버로 전송 시도.
 * 성공: remove(id). 실패: 그대로 두고 다음 retry.
 * @returns {Promise<{sent: number, failed: number}>}
 */
export async function drain(token) {
  const items = await getAll();
  let sent = 0, failed = 0;
  for (const item of items) {
    try {
      const r = await fetch('/api/v1/judge/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(item.body),
      });
      if (r.ok) {
        await remove(item.id);
        sent += 1;
      } else if (r.status === 400) {
        // Validation/duplicate — 영구 실패라 큐에서 제거 (서버 응답 로그)
        const j = await r.json().catch(() => ({}));
        console.warn('Score discarded (400):', j.detail, item.body);
        await remove(item.id);
        failed += 1;
      } else {
        failed += 1;  // 5xx 등 서버 오류 — 보존
      }
    } catch (e) {
      failed += 1;  // 네트워크 오류 — 보존
    }
  }
  return { sent, failed };
}
