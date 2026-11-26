// MiContadoor · service worker y avisos push (MC-6). Apagado mientras CONFIG.AVISOS_PUSH = false o falte la clave pública VAPID.
// · El permiso de notificaciones se pide SOLO al tocar «Activar avisos en este celular» (Más → Avisos). Nunca al cargar.
// · iPhone/iPad: Web Push solo funciona con la app AGREGADA a la pantalla de inicio (iOS 16.4+); en Safari normal se explica cómo.
// · Regla dura: la notificación del sistema NUNCA lleva montos, RUT ni nombres (lo arma el servidor con textos fijos y sw.js lo
//   vuelve a validar con js/sw-avisos.js). El detalle, solo dentro de la app.
import { CONFIG } from './config.js';

export function registrarServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* la app funciona igual sin SW */ });
}

/** Texto seguro para la pantalla bloqueada: genérico, sin datos. */
export const TEXTO_BLOQUEO = 'Tienes un aviso nuevo de Contadoor';

const VAPID = /^[A-Za-z0-9_-]{87}$/;

/** ¿La configuración permite ofrecer push? (servidor instalado + clave pública + interruptor). */
export function pushConfigurado(cfg = CONFIG) {
  return cfg.AVISOS_PUSH === true && VAPID.test(String(cfg.VAPID_PUBLICA || '')) && !!cfg.RPC?.PUSH_SUSCRIBIR && !!cfg.RPC?.PUSH_DESUSCRIBIR;
}

/** Plataforma gruesa (solo para el servidor: nunca el user-agent completo). */
export function plataforma(ua = '', tactil = 0) {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && tactil > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Windows|Macintosh|Linux|CrOS/.test(ua)) return 'escritorio';
  return 'otra';
}

/**
 * Estado del aviso en ESTE aparato, para la tarjeta de Más → Avisos (función pura: el entorno se inyecta en las pruebas).
 * 'apagado' (no configurado) · 'no_soportado' · 'ios_instalar' · 'bloqueado' (permiso denegado) · 'inactivo' · 'activo'.
 */
export function estadoAvisos(env) {
  if (!env.configurado) return 'apagado';
  if (env.plataforma === 'ios' && !env.instalada) return 'ios_instalar';
  if (!env.tienePush || !env.tieneNotificacion || !env.contextoSeguro) return 'no_soportado';
  if (env.permiso === 'denied') return 'bloqueado';
  return env.suscrito && env.permiso === 'granted' ? 'activo' : 'inactivo';
}

export function entornoNavegador() {
  const instalada = window.matchMedia?.('(display-mode: standalone)').matches === true || navigator.standalone === true;
  return {
    configurado: pushConfigurado(), contextoSeguro: window.isSecureContext === true, instalada,
    plataforma: plataforma(navigator.userAgent, navigator.maxTouchPoints || 0),
    tienePush: 'PushManager' in window && 'serviceWorker' in navigator, tieneNotificacion: 'Notification' in window,
    permiso: 'Notification' in window ? Notification.permission : 'default', suscrito: false,
  };
}

/** b64url → Uint8Array (applicationServerKey). */
export function claveAplicacion(b64) {
  const s = String(b64).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function registro() {
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((_, mal) => setTimeout(() => mal(new Error('SW')), 8000))]);
  return reg;
}

/** Estado real (consulta la suscripción del navegador, sin pedir permisos). */
export async function estadoActual() {
  const env = entornoNavegador();
  if (env.configurado && env.tienePush && env.permiso === 'granted') {
    try { env.suscrito = !!(await (await registro()).pushManager.getSubscription()); } catch { env.suscrito = false; }
  }
  return estadoAvisos(env);
}

/** SOLO desde un clic del cliente. Pide permiso, suscribe y registra en el servidor. Devuelve el estado final. */
export async function activarAvisos(api) {
  const env = entornoNavegador();
  const previo = estadoAvisos(env);
  if (!['inactivo', 'activo'].includes(previo)) return previo;
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueado' : 'inactivo';
  const reg = await registro();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveAplicacion(CONFIG.VAPID_PUBLICA) });
  const j = sub.toJSON();
  try {
    await api.pushSuscribir({ endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth, plataforma: env.plataforma });
  } catch (e) { await sub.unsubscribe().catch(() => {}); throw e; }     // sin registro en el servidor no queda nada a medias
  return 'activo';
}

/** Desactiva en ESTE aparato (servidor + navegador). todas = true: todos los aparatos de la cuenta. Nunca lanza. */
export async function desactivarAvisos(api, { todas = false } = {}) {
  let endpoint = null;
  try {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const sub = await (await registro()).pushManager.getSubscription();
      if (sub) { endpoint = sub.endpoint; await sub.unsubscribe().catch(() => {}); }
    }
  } catch { /* sin SW: igual se avisa al servidor si se pide «todas» */ }
  if (endpoint || todas) await api.pushDesuscribir?.(endpoint, todas).catch(() => {});
  return 'inactivo';
}
