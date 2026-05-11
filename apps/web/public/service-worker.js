/**
 * 모두의 플레이 PWA Service Worker — v3.3 R3.
 *
 * 책임:
 * 1. 설치 (install) — 핵심 자원 캐시
 * 2. 푸시 알림 수신 (push 이벤트)
 * 3. 알림 클릭 (notificationclick) — /me로 포커스
 *
 * 오프라인 캐싱은 최소만. 본격 캐시 전략은 추후 (workbox 등).
 */

const CACHE = 'mop-v3.3-r3';
const CORE = ['/me', '/manifest.json', '/weplay-icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // 네트워크 우선, 실패 시 캐시 (basic strategy)
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', (e) => {
  if (!e.data) return;
  let payload;
  try { payload = e.data.json(); } catch { payload = { title: '모두의 플레이', body: e.data.text() }; }
  const title = payload.title || '모두의 플레이';
  const opts = {
    body: payload.body || '',
    icon: '/apple-touch-icon.png',
    badge: '/weplay-icon.svg',
    data: payload.data || { url: '/me' },
    vibrate: [200, 100, 200],
    tag: payload.tag || 'mop-default',
    renotify: true,
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/me';
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const open = clients.find((c) => c.url.includes(url));
      if (open) return open.focus();
      return self.clients.openWindow(url);
    })
  );
});
