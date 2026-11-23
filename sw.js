/* Service worker — GRD CEPE
   - Arquivos do próprio sistema: SEMPRE tenta a rede primeiro (pega a versão nova
     assim que existir) e só usa o cache se estiver sem internet.
   - Bibliotecas externas (jsPDF, JsBarcode, Firebase SDK...): cache, pois têm versão fixa na URL.
   - Firestore/dados NÃO passam por aqui: continuam indo direto para o Firebase. */
const CACHE = 'grd-cepe-v1';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
const CDNS  = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'www.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 1) Arquivos do próprio sistema: rede primeiro, cache como reserva
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/sw.js')) return;
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('index.html') || caches.match('./')))
    );
    return;
  }

  // 2) Bibliotecas de CDN: cache primeiro
  if (CDNS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
        return res;
      }))
    );
  }
  // 3) Todo o resto (Firestore etc.): não interceptamos
});
