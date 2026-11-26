// MC-6 · Novedades (Inicio y lista completa) y tarjeta «Avisos» de Más. Todo escapado con html``.
import { html, fecha, hora } from './util.js';
import { I } from './iconos.js';
import { sub, vacio } from './vistas-comunes.js';

const ICO = { reporte_listo: ['i-a', I.grafico], faltan_compras: ['i-n', I.documento], iva_vence: ['i-i', I.reloj], pago_confirmado: ['i-v', I.check], tramite_avanzo: ['i-m', I.llave], cobranza: ['i-n', I.tarjeta] };

function cuando(iso) {
  if (!iso) return '';
  const hoy = fecha(new Date().toISOString(), { anio: true }); const f = fecha(iso, { anio: true });
  return f === hoy ? `Hoy, ${hora(iso)}` : `${fecha(iso)} · ${hora(iso)}`;
}

function item(a) {
  const [c, ic] = ICO[a.evento] || ICO.reporte_listo;
  return html`<button type="button" class="li kpi-btn${a.leido ? ' leido' : ''}" data-accion="aviso" data-id="${a.id}" data-ruta="${a.ruta}">
    <span class="ic ${c}">${ic}</span><div class="t"><b>${a.titulo}</b><span class="sm">${a.texto}</span><span class="xs">${cuando(a.creado_at)}</span></div>
    ${a.leido ? '' : html`<span class="punto" role="img" aria-label="Sin leer"></span>`}</button>`;
}

/** Bloque de Inicio: hasta 4 novedades + «Ver todas». */
export function bloqueNovedades(ctx) {
  const n = ctx.avisos;
  if (!n || !n.avisos.length) return '';
  return html`<div class="hd mt8"><h2 class="m0">Novedades</h2>${n.noLeidos ? html`<span class="chip c-conc">${n.noLeidos} sin leer</span>` : ''}</div>
    <div class="card">${n.avisos.slice(0, 4).map(item)}
      ${n.avisos.length > 4 || n.noLeidos ? html`<button type="button" class="link" data-ir="novedades">Ver todas las novedades</button>` : ''}</div>`;
}

/** Lista completa (#/novedades). */
export function vNovedades(ctx) {
  const n = ctx.avisos;
  if (!n) return html`${sub('Novedades', { volver: 'inicio' })}<div class="sec">${vacio(I.campana, 'Novedades', 'Muy pronto verás aquí los avisos de tu equipo Contadoor.')}</div>`;
  return html`${sub('Novedades', { volver: 'inicio' })}<div class="sec">
    ${n.avisos.length ? html`<div class="card">${n.avisos.map(item)}</div>
      ${n.noLeidos ? html`<button type="button" class="btn lin" data-accion="leer-todas">Marcar todas como leídas</button>` : ''}`
      : vacio(I.campana, 'Sin novedades', 'Cuando haya algo nuevo de tu empresa, te lo contamos aquí.')}
    <p class="xs c mt8">Mostramos los avisos de los últimos 4 meses de ${ctx.empresa.razon_social}.</p></div>`;
}

const LISTA = (verCuenta) => [
  ['📊', 'Tu reporte del mes está listo'], ['⚠️', 'Faltan facturas de compra'], ['⏰', 'Se acerca el vencimiento del IVA'],
  verCuenta ? ['✅', 'Confirmamos tu pago'] : null, ['✍️', 'Tu trámite avanzó'],
].filter(Boolean);

/** Tarjeta de Más → Avisos: push en ESTE aparato (el permiso se pide SOLO al tocar el botón) + correo (R2, toda la cuenta). */
export function tarjetaAvisos(ctx) {
  const e = ctx.pushEstado || 'apagado';
  const co = ctx.avisos?.correo;
  if (e === 'apagado' && !co?.disponible) return '';            // sin MC-6 instalado no se promete nada al cliente
  const que = html`<ul class="ventajas mt8">${LISTA(ctx.perm.verMiCuenta).map(([em, t]) => html`<li>${em} ${t}</li>`)}</ul>`;
  let push = '';
  switch (e) {
    case 'apagado': break;
    case 'no_soportado':
      push = html`<div class="sm">Este navegador no permite avisos. Abre MiContadoor en Chrome (Android) o agrégala a tu pantalla de inicio (iPhone). Las novedades igual aparecen en Inicio.</div>`; break;
    case 'ios_instalar':
      push = html`<div class="sm">En iPhone, los avisos funcionan con MiContadoor instalada:</div>
        <ol class="pasos-ios"><li>Toca <b>Compartir</b> (el cuadrado con la flecha) en Safari.</li><li>Elige <b>«Agregar a pantalla de inicio»</b>.</li><li>Abre MiContadoor desde ese ícono y vuelve a Más → Avisos.</li></ol>
        <p class="xs m0">Necesitas iOS 16.4 o más nuevo.</p>`; break;
    case 'bloqueado':
      push = html`<div class="sm">Los avisos están bloqueados para MiContadoor en este celular. Para activarlos, permite las notificaciones en la configuración del navegador o del teléfono y vuelve aquí.</div>`; break;
    case 'activo':
      push = html`<div class="sm">Te avisaremos en este celular cuando:</div>${que}
        <div class="dos"><button type="button" class="btn lin" data-accion="probar-aviso">Enviar un aviso de prueba</button><button type="button" class="btn lin gris" data-accion="desactivar-avisos">Desactivar</button></div>`; break;
    default:
      push = html`<div class="sm">Activa los avisos y te contamos al momento cuando:</div>${que}
        <button type="button" class="btn" data-accion="activar-avisos">Activar avisos en este celular</button>
        <p class="xs m0 mt8">Tu celular te pedirá permiso. Puedes desactivarlos cuando quieras.</p>`;
  }
  const correo = co?.disponible ? html`<div class="fila correo-av${push ? ' mt12' : ''}"><div class="t"><b>Avisos por correo</b>
      <span class="xs">${co.activo ? 'Activados' : 'Desactivados'} · a ${ctx.sesion?.cuenta?.correo || 'tu correo'}. Entre 9:00 y 19:00, y si hay varios, en un solo correo.</span></div>
      <button type="button" class="btn lin auto" data-accion="correo-avisos" data-valor="${co.activo ? '0' : '1'}">${co.activo ? 'Desactivar' : 'Activar'}</button></div>`
    // R4: con el correo apagado en el servidor (disponible=false) se anuncia «Pronto», sin botón (no se guarda ninguna preferencia).
    : push ? html`<div class="fila correo-av mt12"><div class="t"><b>Avisos por correo</b><span class="xs">Pronto: también podrás recibirlos en tu correo.</span></div>
      <span class="chip c-pend">Pronto</span></div>` : '';
  return html`<div class="card" id="avisos"><div class="hd"><h3>Avisos</h3>${e === 'activo' ? html`<span class="chip c-ok">Activados en este celular</span>` : ''}</div>
    ${push}${correo}
    <p class="xs m0 mt8">${I.seguro} Por tu privacidad, los avisos (en la pantalla bloqueada${co?.disponible ? ' y por correo' : ''}) nunca muestran montos ni datos de tu empresa: el detalle lo ves solo aquí, dentro de MiContadoor.</p></div>`;
}
