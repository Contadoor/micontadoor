// MICONTADOOR-APERTURA (24-11): términos que entrega el servidor, Ayuda (soporte), «Tu incorporación» y el espacio de
// «Tu diagnóstico "Aquí partimos"». Todo texto que llega del servidor pasa por html`` (escapado).
import { html, fecha } from './util.js';
import { I } from './iconos.js';
import { sub, waCard } from './vistas-comunes.js';
import { bloquesTerminos, TIPOS_SOPORTE, ESTADOS_SOLICITUD } from './datos.js';

export const DIAGNOSTICO_NOMBRE = 'Tu diagnóstico "Aquí partimos"';   // nombre exacto (Luciano 23-11)
const msg = (m) => (m ? html`<p class="msg${m.ok ? ' ok' : ''}" role="${m.ok ? 'status' : 'alert'}">${m.texto}</p>` : '');
const cargando = html`<div class="cargando chico" role="status" aria-label="Cargando"><div class="spin"></div></div>`;

/** Texto de los términos (del servidor) en bloques seguros: subtítulos y párrafos, nunca HTML del servidor. */
export function textoTerminos(t) {
  return html`<p><b>${t.titulo}</b> · versión ${t.version}</p>${bloquesTerminos(t.texto).map((b) => (b.tipo === 'subtitulo' ? html`<h2>${b.texto}</h2>` : html`<p>${b.texto}</p>`))}`;
}
const codigoVerif = (sha) => String(sha || '').slice(0, 16).replace(/(.{4})(?=.)/g, '$1 ');

/** Pantalla «Antes de empezar» con el texto del SERVIDOR. srv: {estado:'cargando'|'error'|'ok', …}. Sin texto verificado no hay botón Aceptar. */
export function vTerminosServidor({ srv, mensaje }) {
  const barras = html`<div class="barras" aria-hidden="true"><i></i><i></i><i></i></div>`;
  let cuerpo;
  if (!srv || srv.estado === 'cargando') cuerpo = cargando;
  else if (srv.estado !== 'ok') {
    cuerpo = html`<p class="msg" role="alert">${srv.texto || 'No pudimos cargar los términos. Inténtalo de nuevo en unos minutos.'}</p>
      <form novalidate><button type="button" class="btn" data-accion="terminos-reintentar">Reintentar</button>
      <button type="button" class="btn lin" data-accion="salir">Salir</button></form>`;
  } else {
    cuerpo = html`<div class="terminos" tabindex="0">${textoTerminos(srv)}</div>
    <p class="xs m0 mt8 verif">Código de verificación de este texto: ${codigoVerif(srv.sha256)}</p>
    <form data-form="terminos" novalidate>
      <label class="chk"><input type="checkbox" name="ok" required> Leí y acepto los términos de uso y el aviso de privacidad.</label>
      ${msg(mensaje)}
      <button type="submit" class="btn">Aceptar y continuar</button>
      <button type="button" class="btn lin" data-accion="salir">Salir</button>
    </form>`;
  }
  return html`<section class="oscura" aria-label="Términos de uso">${barras}
    <h1>Antes de empezar</h1>
    <p class="intro">Lee y acepta los términos de uso y el aviso de privacidad de MiContadoor.</p>
    ${cuerpo}</section>`;
}

/** Bloque de «Mi acceso»: qué versión aceptó y cuándo, con el texto exacto aceptado. mis: null (cargando) | 'error' | lista. */
export function bloqueTerminosAceptados(mis) {
  let c;
  if (mis === undefined || mis === 'cargando') c = cargando;
  else if (mis === 'error' || !Array.isArray(mis)) c = html`<p class="sm m0">No pudimos cargar tus términos aceptados. Inténtalo más tarde.</p>`;
  else if (!mis.length) c = html`<p class="sm m0">Aún no hay términos aceptados registrados.</p>`;
  else c = mis.map((a, i) => html`<div class="fila"><div class="t"><b>Versión ${a.version}${i === 0 ? '' : ' (anterior)'}</b><span class="xs">Aceptada el ${fecha(a.aceptada_at, { anio: true })}</span></div><button type="button" class="link" data-accion="ver-terminos" data-version="${a.version}">Ver texto</button></div>`);
  return html`<div class="card"><h3 class="t15">Términos que aceptaste</h3>${c}
    <p class="xs m0 mt8">Guardamos el texto exacto que aceptaste; no cambia aunque publiquemos una versión nueva.</p></div>`;
}

/** Hoja con el texto exacto de una versión aceptada. */
export function hojaTerminos(t) {
  return html`<div class="velo" data-accion="cerrar-hoja"><div class="hoja" role="dialog" aria-modal="true" aria-label="Términos aceptados">
    <h2>Términos aceptados</h2>
    ${t?.estado === 'ok' ? html`<div class="terminos claro" tabindex="0">${textoTerminos(t)}</div><p class="xs mt8">Código de verificación: ${codigoVerif(t.sha256)}</p>`
      : t?.estado === 'cargando' ? cargando : html`<p class="aviso error">No pudimos mostrar ese texto (no calza con lo registrado o no está disponible).</p>`}
    <button type="button" class="btn lin" data-accion="cerrar-hoja">Cerrar</button></div></div>`;
}

// ── Ayuda ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Vista #/ayuda. a = { soporte:boolean, solicitudes, folio, mensaje, tipo, texto, enviando }. */
export function vAyuda(ctx, a = {}) {
  const sol = a.solicitudes;
  const lista = !a.soporte ? '' : html`<div class="card"><h3 class="t15">Tus solicitudes</h3>${
    sol === undefined || sol === 'cargando' ? cargando
      : sol === 'error' || !Array.isArray(sol) ? html`<p class="sm m0">No pudimos cargar tus solicitudes. Inténtalo más tarde.</p>`
        : !sol.length ? html`<p class="sm m0">Aún no nos has enviado solicitudes desde MiContadoor.</p>`
          : sol.map((x) => { const [c, t] = ESTADOS_SOLICITUD[x.estado]; const tipo = (TIPOS_SOPORTE.find(([k]) => k === x.tipo) || [, 'Otra cosa'])[1];
            return html`<div class="fila"><div class="t"><b>${x.folio}</b><span class="xs">${tipo} · ${fecha(x.creada_at, { anio: true })}</span></div><span class="chip ${c}">${t}</span></div>`; })}</div>`;
  const form = !a.soporte ? '' : html`<div class="card" id="cuentanos"><h3 class="t15">Cuéntanos qué pasa</h3>
    ${a.enviada ? html`<p class="aviso ok" role="status">${I.check}<span>Recibimos tu mensaje.${a.folio ? html` Tu número de solicitud es <b>${a.folio}</b>.` : ''} Te respondemos en horario hábil.</span></p>` : ''}
    <form data-form="soporte" class="campos" novalidate>
      <label class="xs">De qué se trata<select name="tipo" required>${TIPOS_SOPORTE.map(([v, t]) => html`<option value="${v}" ${v === (a.tipo || 'consulta') ? html`selected` : ''}>${t}</option>`)}</select></label>
      <label class="xs">Tu mensaje<textarea name="mensaje" rows="4" minlength="10" maxlength="1000" required placeholder="Cuéntanos con tus palabras. No escribas contraseñas ni claves.">${a.texto || ''}</textarea></label>
      ${a.mensaje ? html`<p class="aviso error" role="alert">${a.mensaje}</p>` : ''}
      <button type="submit" class="btn">Enviar a mi equipo Contadoor</button>
      <p class="xs m0 mt8">Nunca te pediremos tu contraseña ni tus claves por este medio.</p>
    </form></div>`;
  return html`${sub('Ayuda', { volver: 'mas' })}<div class="sec">
    ${waCard(ctx.waAyuda || ctx.waEquipo)}
    <div class="card"><div class="li centro"><span class="ic i-a">${I.correo}</span><div class="t"><b>Escríbenos un correo</b><span class="sm">info@contadoor.cl</span></div><a class="btn lin auto" href="mailto:info@contadoor.cl?subject=${encodeURIComponent('Ayuda con MiContadoor')}">Escribir</a></div></div>
    ${form}${lista}
    <div class="card"><div class="hd"><h3>¿Algo raro con tu cuenta?</h3><span class="ic i-n">${I.escudo}</span></div>
      <p class="sm">Si ves un ingreso que no reconoces o crees que alguien conoce tu contraseña:</p>
      <ol class="sm pasos-seg"><li>Cambia tu contraseña.</li><li>Cierra tu sesión en todos tus aparatos.</li><li>Avísanos para revisar tu cuenta.</li></ol>
      <button type="button" class="btn lin" data-accion="cambiar-clave">Cambiar mi contraseña</button>
      <button type="button" class="btn lin gris" data-accion="salir-todos">Cerrar sesión en todos mis aparatos</button>
      ${a.soporte ? html`<button type="button" class="btn lin" data-accion="soporte-seguridad">Avisar a Contadoor</button>` : ''}</div></div>`;
}

// ── Tu incorporación + diagnóstico ───────────────────────────────────────────────────────────────────────────────
const CHIP_PASO = { listo: ['c-ok', 'Listo'], en_curso: ['c-rev', 'En curso'], pendiente: ['c-gris', 'Pendiente'], esperando_tu_respuesta: ['c-pend', 'Esperando tu respuesta'] };

/** Tarjeta de Inicio: solo si hay incorporación en curso (no terminada). */
export function tarjetaIncorporacion(inc) {
  if (!inc || inc.estado !== 'ok' || !inc.disponible || inc.terminado) return '';
  const pct = Math.round((inc.listos / inc.total) * 100);
  return html`<button type="button" class="card kpi-btn inc-card" data-ir="incorporacion"><div class="hd"><h3>Tu incorporación</h3><span class="chip c-conc">Paso ${inc.actual} de ${inc.total}</span></div>
    <div class="prog"><i data-w="${pct}"></i></div>
    <div class="sm mt8">${inc.pasos.some((p) => p.estado === 'esperando_tu_respuesta') ? 'Hay un paso que espera tu respuesta.' : 'Vamos avanzando con la puesta en marcha de tu empresa.'}</div></button>`;
}

export function bloqueDiagnostico(inc) {
  const listo = inc?.diagnostico?.emitido === true;
  const f = inc?.fecha_reunion ? fecha(inc.fecha_reunion, { anio: true }) : null;
  return html`<div class="card diag"><div class="hd"><h3>${DIAGNOSTICO_NOMBRE}</h3><span class="chip ${listo ? 'c-ok' : 'c-gris'}">${listo ? 'Listo' : 'En preparación'}</span></div>
    <div class="li centro"><span class="ic i-m">${I.lupa}</span><div class="t">${listo
      ? html`<b>Tu diagnóstico está listo.</b><span class="sm">${f ? html`Te lo presentamos en la reunión del ${f}.` : 'Te lo presentamos en la reunión de entrega; tu equipo te contactará para agendarla.'}</span>`
      : html`<b>Lo estamos preparando.</b><span class="sm">Te lo entregamos en la reunión de entrega${f ? html` (${f})` : ''}.</span>`}</div></div>
    <p class="xs m0 mt8">Es un informe ejecutivo de cómo partimos con tu empresa: lo firma Contadoor e indica a tu analista a cargo.</p></div>`;
}

/** Vista #/incorporacion. inc: normalizarIncorporacion(…) | null (cargando / no configurada). */
export function vIncorporacion(ctx, inc) {
  let c;
  if (!inc) c = cargando;
  else if (inc.estado !== 'ok') c = html`<div class="aviso error" role="alert">${I.info}<span>No pudimos cargar tu incorporación. Inténtalo de nuevo en unos minutos.</span></div>`;
  else if (!inc.disponible) c = html`<div class="card vacio"><span class="ic i-m">${I.ruta}</span><h3>Sin incorporación en curso</h3><p class="sm m0">Cuando tu empresa empiece con Contadoor, aquí verás cada paso.</p></div>`;
  else {
    const pct = Math.round((inc.listos / inc.total) * 100);
    c = html`<div class="card osc"><div class="hd"><h2>${inc.terminado ? 'Incorporación terminada' : `Paso ${inc.actual} de ${inc.total}`}</h2>${inc.terminado ? html`<span class="chip c-ok-d">Lista ✓</span>` : ''}</div>
      <div class="prog"><i data-w="${pct}"></i></div><div class="sm mt8">${inc.listos} de ${inc.total} pasos listos${inc.fecha_reunion ? html` · reunión de entrega: ${fecha(inc.fecha_reunion, { anio: true })}` : ''}</div></div>
    <div class="card"><h3 class="t15">Los pasos que te tocan</h3>${inc.pasos.length ? inc.pasos.map((p) => { const [k, t] = CHIP_PASO[p.estado];
      return html`<div class="fila"><div class="t"><b>${p.titulo}</b></div><span class="chip ${k}">${t}</span></div>`; }) : html`<p class="sm m0">Tu equipo está preparando los pasos.</p>`}
      <p class="xs m0 mt8">El resto lo hace tu equipo Contadoor por dentro. Si un paso espera tu respuesta, revisa tu correo o escríbenos.</p></div>
    ${bloqueDiagnostico(inc)}`;
  }
  return html`${sub('Tu incorporación', { volver: 'inicio' })}<div class="sec">${c}${waCard(ctx.waEquipo)}</div>`;
}
