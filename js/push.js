// MiContadoor · service worker y lugar PREPARADO para avisos push (fuera de la V1: CONFIG.AVISOS_PUSH = false).
// Cuando se habilite (MC-6, con su GO): VAPID propias MC_VAPID_*, tabla mc.push_suscripciones, Edge mc-push-send.
// Regla dura: la notificación del sistema NUNCA lleva montos, RUT ni nombres (pantalla bloqueada). El detalle, solo dentro de la app.
import { CONFIG } from './config.js';

export function registrarServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* la app funciona igual sin SW */ });
}

/** V1: siempre false. No se pide permiso de notificaciones ni se muestra ninguna promesa al cliente. */
export function avisosDisponibles() {
  return CONFIG.AVISOS_PUSH === true && 'PushManager' in window && 'Notification' in window;
}

/** Texto seguro para la pantalla bloqueada: genérico, sin datos. (Lo usará sw.js cuando haya push.) */
export const TEXTO_BLOQUEO = 'Tienes un aviso nuevo de Contadoor';
