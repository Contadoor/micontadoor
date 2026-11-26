// Guía para instalar MiContadoor en iPhone (26-11). Android la ofrece solo (Chrome); iPhone no muestra nada,
// así que aquí se explica: Safari → Compartir → «Agregar a pantalla de inicio». Sin esto, en iPhone no hay avisos push.
import { html } from './util.js';

const CLAVE = 'mc_guia_ios_cerrada';
const DIAS_PAUSA = 7;

/** ¿Es un iPhone/iPad? (los iPad nuevos se presentan como Macintosh con pantalla táctil). */
export function esIos(ua = '', tactil = 0) {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && tactil > 1);
}
/** En iPhone, Chrome/Firefox/Edge traen su propio nombre en el user-agent; «Agregar a inicio» es más claro desde Safari. */
export function esSafari(ua = '') {
  return !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
}
/** Función pura: ¿mostrar la guía? Solo iPhone/iPad, no instalada y no cerrada en los últimos 7 días. */
export function mostrarGuiaIos({ ua = '', tactil = 0, instalada = false, cerradaAt = 0, ahora = Date.now() } = {}) {
  if (!esIos(ua, tactil) || instalada) return false;
  return !(cerradaAt && ahora - cerradaAt < DIAS_PAUSA * 864e5);
}
export function entornoGuia() {
  let cerradaAt = 0;
  try { cerradaAt = Number(localStorage.getItem(CLAVE)) || 0; } catch { /* modo privado */ }
  return {
    ua: navigator.userAgent, tactil: navigator.maxTouchPoints || 0, cerradaAt,
    instalada: window.matchMedia?.('(display-mode: standalone)').matches === true || navigator.standalone === true,
  };
}
export function cerrarGuia() { try { localStorage.setItem(CLAVE, String(Date.now())); } catch { /* modo privado */ } }

const ICO_COMPARTIR = html`<svg class="ico-ios" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICO_MAS = html`<svg class="ico-ios" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

export function vGuiaIos({ safari = true } = {}) {
  const pasos = safari
    ? html`<ol class="pasos-ios">
        <li>Toca <b>Compartir</b> ${ICO_COMPARTIR} abajo en Safari.</li>
        <li>Desliza y elige <b>«Agregar a pantalla de inicio»</b> ${ICO_MAS}.</li>
        <li>Toca <b>Agregar</b> y abre MiContadoor desde el ícono.</li></ol>`
    : html`<ol class="pasos-ios">
        <li>Copia el enlace y ábrelo en <b>Safari</b>.</li>
        <li>Toca <b>Compartir</b> ${ICO_COMPARTIR} y elige <b>«Agregar a pantalla de inicio»</b> ${ICO_MAS}.</li>
        <li>Abre MiContadoor desde el ícono.</li></ol>`;
  return html`<aside class="guia-ios" role="note" aria-label="Instalar MiContadoor en tu iPhone">
    <div class="guia-ios-tit">📲 Instala MiContadoor en tu iPhone</div>
    <p class="sm m0">Así la tienes como app y te llegan tus avisos.</p>
    ${pasos}
    <button type="button" class="btn lin gris guia-ios-cerrar" data-accion="cerrar-guia-ios">Ahora no</button>
  </aside>`;
}
