// MiContadoor · service worker. Cachea SOLO los archivos propios de la app (esqueleto). NUNCA datos:
// · toda petición a otro origen (Supabase, fuentes, WhatsApp) pasa directo a la red, sin tocar la caché;
// · dentro del propio sitio solo se guarda lo que está en la lista ESQUELETO, y se usa SOLO sin conexión (red primero).
const VERSION = 'mc-v1.0.0-borrador-2';
const ESQUELETO = [
  '/', '/index.html', '/css/app.css', '/manifest.webmanifest',
  '/js/app.js', '/js/api.js', '/js/config.js', '/js/datos.js', '/js/demo.js', '/js/iconos.js', '/js/push.js', '/js/util.js',
  '/js/vistas-acceso.js', '/js/vistas-comunes.js', '/js/vistas-cuenta.js', '/js/vistas-reporte.js',
  '/img/contadoor_lockup_white.png', '/img/contadoor_lockup_glossy.png', '/img/icono-192.png', '/img/icono-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ESQUELETO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                 // datos y terceros: red directa, nunca caché
  if (req.mode === 'navigate') {                                    // páginas: red primero; sin red, el esqueleto
    e.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }
  if (!ESQUELETO.includes(url.pathname)) return;
  // Red primero (siempre la versión publicada más nueva); la copia guardada solo sirve sin conexión.
  e.respondWith(fetch(req).then((r) => {
    if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(url.pathname, copia)); }
    return r;
  }).catch(() => caches.match(url.pathname)));
});

// ── Avisos push: preparado, APAGADO en la V1 (MC-6). Al activarlo, el texto visible es siempre genérico. ──
// self.addEventListener('push', (e) => {
//   e.waitUntil(self.registration.showNotification('MiContadoor', {
//     body: 'Tienes un aviso nuevo de Contadoor',      // nunca montos, RUT ni nombres en la pantalla bloqueada
//     icon: '/img/icono-192.png', badge: '/img/icono-192.png', tag: 'mc', data: { ruta: '#/inicio' } }));
// });
// self.addEventListener('notificationclick', (e) => { e.notification.close(); e.waitUntil(self.clients.openWindow('/' + (e.notification.data?.ruta || ''))); });
