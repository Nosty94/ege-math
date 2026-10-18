// Service Worker: страница — сначала сеть (всегда свежая версия), офлайн — из кэша; остальное — из кэша с фоновым обновлением.
const CACHE = 'ege-math-v22';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './vendor/firebase/firebase-app-compat.js',
  './vendor/firebase/firebase-auth-compat.js',
  './vendor/firebase/firebase-firestore-compat.js',
  './vendor/fonts/crimson-pro-latin-300-normal.woff2',
  './vendor/fonts/crimson-pro-latin-400-italic.woff2',
  './vendor/fonts/crimson-pro-latin-400-normal.woff2',
  './vendor/fonts/crimson-pro-latin-600-normal.woff2',
  './vendor/fonts/fonts.css',
  './vendor/fonts/manrope-cyrillic-400.woff2',
  './vendor/fonts/manrope-cyrillic-500.woff2',
  './vendor/fonts/manrope-cyrillic-600.woff2',
  './vendor/fonts/manrope-cyrillic-700.woff2',
  './vendor/fonts/manrope-cyrillic-800.woff2',
  './vendor/fonts/manrope-latin-400.woff2',
  './vendor/fonts/manrope-latin-500.woff2',
  './vendor/fonts/manrope-latin-600.woff2',
  './vendor/fonts/manrope-latin-700.woff2',
  './vendor/fonts/manrope-latin-800.woff2',
  './vendor/html2canvas.min.js',
  './vendor/katex/contrib/auto-render.min.js',
  './vendor/katex/fonts/KaTeX_AMS-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2',
  './vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2',
  './vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Main-Bold.woff2',
  './vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2',
  './vendor/katex/fonts/KaTeX_Main-Italic.woff2',
  './vendor/katex/fonts/KaTeX_Main-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2',
  './vendor/katex/fonts/KaTeX_Math-Italic.woff2',
  './vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2',
  './vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2',
  './vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Script-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Size1-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Size2-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Size3-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Size4-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2',
  './vendor/katex/katex.min.css',
  './vendor/katex/katex.min.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'ege-remind-cfg' && k !== 'ege-remind-state').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || !/^https?:$/.test(new URL(r.url).protocol)) return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(r).then(hit => {
    const net = fetch(r).then(res => { if (res && (res.status === 200 || res.type === 'opaque')) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});

// ── Напоминание «давно не занимался» (фоновая проверка, если браузер её поддерживает) ──
async function remindCheck() {
  const cfgC = await caches.open('ege-remind-cfg');
  const hit = await cfgC.match('./__remind-cfg');
  if (!hit) return;
  const cfg = await hit.json();
  if (!cfg.on || !cfg.last) return;
  const DAY = 864e5, now = Date.now();
  if (now - cfg.last < cfg.days * DAY) return;
  const stC = await caches.open('ege-remind-state');
  const stHit = await stC.match('./__remind-notified');
  const notified = stHit ? parseInt(await stHit.text(), 10) || 0 : 0;
  if (now - notified < DAY) return;
  const days = Math.floor((now - cfg.last) / DAY);
  await self.registration.showNotification('📐 ЕГЭ Математика', {
    body: 'Тебя не было ' + days + ' дн. Повтори хотя бы пару формул!',
    icon: './icon-192.png', tag: 'ege-remind'
  });
  await stC.put('./__remind-notified', new Response(String(now)));
}
self.addEventListener('periodicsync', e => { if (e.tag === 'ege-remind') e.waitUntil(remindCheck().catch(() => {})); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
