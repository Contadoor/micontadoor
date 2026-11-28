// Piezas comunes del interior: cabecera, subcabecera, barra inferior, teaser bloqueado, estados vacíos.
import { html, clp, primerNombre } from './util.js';
import { I, iconoB } from './iconos.js';
import { planTexto } from './datos.js';

export const back = (ruta) => html`<button type="button" class="back" data-ir="${ruta}" aria-label="Volver">${I.atras}</button>`;

export function sub(titulo, { volver, chip } = {}) {
  return html`<div class="sub">${volver ? back(volver) : ''}<h1>${titulo}</h1>${chip || ''}</div>`;
}

export function cabecera(ctx, extra = '') {
  const e = ctx.empresa;
  const n = ctx.sesion.empresas.length;
  return html`<header class="hdr">
    <div class="hdr-top">
      <div class="logo">${iconoB(34, 'circulo', 'gBh')}<span class="wm"><span class="mi">Mi</span><span class="co">Contadoor</span></span></div>
    </div>
    <div class="emp"><span class="n">${e.razon_social} · ${planTexto(ctx.resumen?.plan_nivel, ctx.resumen?.plan_nombre)}</span>
      ${n > 1 ? html`<button type="button" data-accion="empresas" aria-label="Cambiar de empresa">${n} empresas ▾</button>` : ''}</div>
    <div class="hola">Hola${ctx.sesion.cuenta.nombre ? ', ' + primerNombre(ctx.sesion.cuenta.nombre) : ''} 👋</div>
    ${extra}
  </header>`;
}

export function tabs(ctx, actual) {
  const p = ctx.perm;
  const items = [
    ['inicio', 'Inicio', I.inicio, ['inicio', 'novedades']],
    ['reporte', 'Reporte', I.grafico, ['reporte', 'historial']],
    p.verMiCuenta ? ['cuenta', 'Mi cuenta', I.tarjeta, ['cuenta', 'pago']] : null,
    (p.preIva !== 'sin_permiso' || p.preRenta !== 'sin_permiso') ? ['preiva', 'Proyecciones', I.proyecciones, ['preiva', 'impuestos-historial', 'prerenta']] : null,
    ['mas', 'Más', I.mas, ['mas', 'trabajos', 'acceso', 'ayuda', 'incorporacion', 'convenios']],
  ].filter(Boolean);
  // Solo en computador (barra lateral): accesos directos que en el celular viven dentro de «Más».
  const inc = ctx.incorporacion?.estado === 'ok' && ctx.incorporacion.disponible;
  const esc = [
    inc ? ['incorporacion', 'Tu incorporación', I.ruta, ['incorporacion']] : null,
    // Historial anual de impuestos: lo construye otro paquete (feat/reporte-historial-sii). Aquí solo el lugar en el menú,
    // oculto mientras CONFIG.RPC.HISTORIAL_IMPUESTOS sea null.
    ctx.api?.capacidades?.historialImpuestos ? ['impuestos-historial', 'Mis impuestos · historial', I.calendario, ['impuestos-historial']] : null,
    ['trabajos', 'Trabajos especiales', I.llave, ['trabajos']], ['acceso', 'Mi acceso', I.persona, ['acceso']], ['ayuda', 'Ayuda', I.ayuda, ['ayuda']],
  ].filter(Boolean);
  const boton = ([r, t, ic, g], extra = r === 'mas' && actual !== 'mas' ? 'sub-on' : '') => html`<button type="button" data-ir="${r}" class="${(g.includes(actual) ? 'on ' : '') + extra}" ${g.includes(actual) ? html`aria-current="page"` : ''}>${ic}${t}</button>`;
  return html`<nav class="tabs" aria-label="Navegación principal" data-n="${items.length}">
    <div class="nav-marca solo-esc">${iconoB(34, 'circulo', 'gBh')}<span class="wm"><span class="mi">Mi</span><span class="co">Contadoor</span></span></div>
    ${items.map((it) => boton(it))}${esc.map((it) => boton(it, 'solo-esc'))}
    <div class="nav-pie solo-esc"><button type="button" class="salir" data-accion="salir">${I.atras}Cerrar sesión</button></div></nav>`;
}

export const chipCandado = html`<span class="chip c-gris">${I.candado} Contadoor PRO</span>`;

/** Teaser de plan Cumplimiento: vista borrosa con MARCADORES (nunca cifras reales) + "Mejorar mi plan" → WhatsApp comercial. */
export function teaser(titulo, kpis, ventajas, enlaceWa) {
  return html`<div class="card lock"><div class="hd"><h3>${titulo}</h3>${chipCandado}</div>
    <div class="teaser"><div class="kpis borroso" aria-hidden="true">${kpis.map(([k, v]) => html`<div class="kpi"><small>${k}</small><b>${v}</b></div>`)}</div>
      <div class="candado"><span>${I.candado} Disponible en Contadoor PRO</span></div></div>
    <ul class="ventajas">${ventajas.map((v) => html`<li>✓ ${v}</li>`)}</ul>
    <a class="btn" href="${enlaceWa}" target="_blank" rel="noopener noreferrer">Mejorar mi plan</a>
    <p class="xs c mt8 mb0">Te escribimos por WhatsApp para contarte la diferencia. Sin compromiso.</p></div>`;
}

export function vacio(icono, titulo, texto) {
  return html`<div class="card vacio"><span class="ic i-m">${icono}</span><h3>${titulo}</h3><p class="sm m0">${texto}</p></div>`;
}

export function chipEstadoProy(e) {
  const m = { preliminar: ['c-pend', 'Preliminar'], validado: ['c-ok', 'Validado'], pendiente: ['c-gris', 'Pendiente'], desactualizado: ['c-venc', 'Desactualizado'] };
  const [c, t] = m[e] || ['c-pend', 'Preliminar'];
  return html`<span class="chip ${c}">${t}</span>`;
}

export const leyendaEstados = html`<div class="card"><h3 class="t15">Qué significa cada estado</h3><div class="estados">
  <div><span class="chip c-pend">Preliminar</span><br>Con lo que hay a la fecha; puede cambiar.</div>
  <div><span class="chip c-ok">Validado</span><br>Tu analista lo revisó.</div>
  <div><span class="chip c-gris">Pendiente</span><br>Falta información.</div>
  <div><span class="chip c-venc">Desactualizado</span><br>Llegaron documentos nuevos; lo recalculamos.</div></div></div>`;

/** Línea de un cálculo paso a paso. resta=true muestra "− $0". */
export function paso(p) {
  const v = p.texto !== undefined ? p.texto : (p.resta && !p.monto ? '− $0' : clp(p.monto));
  return html`<div class="paso"><div><b>${p.t}</b>${p.xs ? html`<span class="xs">${p.xs}</span>` : ''}</div><b>${v}</b></div>`;
}

// Luciano 27-11: casi todos los clientes tienen su GRUPO de WhatsApp con Contadoor y el portal no puede abrir ese grupo
// (solo un número fijo). Para no mandarlos a un número equivocado, la tarjeta «Tu equipo Contadoor · WhatsApp» no se muestra.
// Se deja la función (vacía) para no tocar cada vista; para reactivarla, devolver la tarjeta de abajo.
export function waCard(_enlace) {
  return '';
}
export function waCardAnterior(enlace) {
  return html`<div class="card wa-card"><span class="ic i-v">${I.chat}</span>
    <div class="t"><b>Tu equipo Contadoor</b><div class="xs">Te respondemos en horario hábil</div></div>
    <a class="wa" href="${enlace}" target="_blank" rel="noopener noreferrer">WhatsApp</a></div>`;
}

/** Botón de solicitud ("Ya transferí" / "Ya lo pagué"): deshabilitado con «Próximamente» si el contrato no tiene la RPC. */
export function botonSolicitud(ctx, tipo, id) {
  const texto = tipo === 'transferi' ? 'Ya transferí' : 'Ya lo pagué · adjuntar comprobante';
  if (!ctx.api.capacidades.solicitudPago) {
    return html`<button type="button" class="btn lin" disabled aria-disabled="true">${texto} <span class="prox">Próximamente</span></button>`;
  }
  if (ctx.solicitudes.has(id)) return html`<button type="button" class="btn lin" disabled>Aviso enviado · en revisión</button>`;
  return html`<button type="button" class="btn lin" data-accion="solicitud" data-tipo="${tipo}" data-id="${id}">${texto}</button>`;
}
