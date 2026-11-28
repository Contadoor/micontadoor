// MiContadoor · service worker. Cachea SOLO los archivos propios de la app (esqueleto). NUNCA datos:
// · toda petición a otro origen (Supabase, fuentes, WhatsApp) pasa directo a la red, sin tocar la caché;
// · dentro del propio sitio solo se guarda lo que está en la lista ESQUELETO, y se usa SOLO sin conexión (red primero).
importScripts('/js/sw-avisos.js');                          // MC-6: validación pura del aviso (self.MC_AVISO)
const VERSION = 'mc-v1.0.0-15';
const ESQUELETO = [
  '/', '/index.html', '/css/app.css', '/manifest.webmanifest',
  '/js/app.js', '/js/api.js', '/js/config.js', '/js/datos.js', '/js/demo.js', '/js/iconos.js', '/js/push.js', '/js/sw-avisos.js', '/js/util.js',
  '/js/vistas-acceso.js', '/js/vistas-avisos.js', '/js/vistas-comunes.js', '/js/vistas-cuenta.js', '/js/vistas-reporte.js', '/js/vistas-impuestos.js', '/js/vistas-anio.js', '/js/vistas-convenios.js', '/js/vistas-reuniones.js', '/js/vistas-apertura.js', '/js/vistas-instalar.js',
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

// ── MC-6 · Avisos push. Lo visible es SIEMPRE genérico o un texto fijo validado (sin montos, RUT ni nombres). ──
// iOS exige mostrar una notificación por cada push recibido: si la carga no es válida, se muestra el texto genérico.
self.addEventListener('push', (e) => {
  let datos = null;
  try { datos = e.data ? e.data.text() : null; } catch { datos = null; }
  const a = self.MC_AVISO.avisoSeguro(datos);
  e.waitUntil(self.registration.showNotification(a.titulo, {
    body: a.cuerpo, icon: '/img/icono-192.png', badge: '/img/icono-192.png', tag: a.tag, renotify: false, data: { url: a.url },
  }));
});
// Al tocar el aviso: si la app está abierta se enfoca y navega (mensaje a la app, que vuelve a validar la ruta); si no, se abre.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = self.MC_AVISO.urlSegura(e.notification.data?.url);
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    const w = ws.find((x) => new URL(x.url).origin === self.location.origin);
    if (w) { w.postMessage({ tipo: 'mc-abrir', url }); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
