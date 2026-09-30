/* Service worker — Gerador de GRD (CEPE)
 * Estratégia pensada para o app instalado SEMPRE pegar a versão mais nova:
 *  - index.html / navegação: rede primeiro (revalida no servidor); só usa o cache se estiver offline.
 *  - ícones e manifest: usa o cache e atualiza em segundo plano.
 *  - Firebase, CDNs e qualquer outro domínio: não é interceptado.
 * Só é preciso mudar VERSAO se você alterar a lista PRECACHE abaixo. */
const VERSAO = '2026-09-30-1';
const CACHE  = 'grd-cepe-' + VERSAO;
const PRECACHE = [
  './',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(PRECACHE.map((u) =>
        fetch(new Request(u, { cache: 'reload' })).then((r) => r.ok ? c.put(u, r) : null).catch(() => null)
      )))
      .then(() => self.skipWaiting())          // a versão nova assume sem esperar fechar o app
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('grd-cepe-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())         // controla as abas/apps já abertos
  );
});

function ehDocumento(req, url) {
  return req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                     // Firebase, CDNs etc.: direto na rede
  if (req.cache === 'no-store' || req.cache === 'reload') return;      // ex.: checagem de versão do próprio app

  if (ehDocumento(req, url)) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })                                // revalida com o servidor (ignora o cache de 10 min do GitHub Pages)
        .then((resp) => {
          if (resp && resp.ok) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
          return resp;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('index.html') || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cacheado) => {
      const rede = fetch(req).then((resp) => {
        if (resp && resp.ok) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
        return resp;
      }).catch(() => cacheado);
      return cacheado || rede;
    })
  );
});
