// MiContadoor V1 · arranque, rutas, estado y eventos. Todo el HTML sale de vistas*.js (escapado con html``).
import { CONFIG } from './config.js';
import { crearApiReal, crearApiDemo } from './api.js';
import { demo } from './demo.js';
import { permisos, mensajeError, validarContrasena, conTrabajos, conReporte, normalizarImpuestos, normalizarTerminos, normalizarMisTerminos, normalizarSolicitudes, normalizarIncorporacion, validarSoporte, normalizarAvisos } from './datos.js';
import { html, urlSegura, CORREO, sha256Hex, UUID } from './util.js';
import { vIngreso, vRecuperar, vActivar, vTerminos, vFuera } from './vistas-acceso.js';
import { tabs } from './vistas-comunes.js';
import { vInicio, vReporte, vHistorial } from './vistas-reporte.js';
import { vCuenta, vPago, vPreIva, vPreRenta, vTrabajos, vMas, vAcceso, hojaEmpresas, hojaSolicitud } from './vistas-cuenta.js';
import { vImpuestos } from './vistas-impuestos.js';
import { vTerminosServidor, vAyuda, vIncorporacion, hojaTerminos } from './vistas-apertura.js';
import { registrarServiceWorker, estadoActual, activarAvisos, desactivarAvisos } from './push.js';
import { vNovedades } from './vistas-avisos.js';
import { vGuiaIos, mostrarGuiaIos, entornoGuia, esSafari, cerrarGuia } from './vistas-instalar.js';

const VERSION = '1.1.0';
const RUTAS_ACCESO = new Set(['ingreso', 'recuperar', 'activar', 'terminos']);
const $app = document.getElementById('app');
const q = new URLSearchParams(location.search);
const esDemo = q.get('demo') === '1';

const st = {
  api: null, sesion: null, empresa: null, resumen: null, perm: null, impuestos: null, cargadoAt: 0,
  mensaje: null, flash: null, tipoEnlace: 'invite', activado: false, enlacePendiente: null,
  abiertos: new Set(), solicitudes: new Set(), hoja: null, rutaPrevia: '',
  // MICONTADOOR-APERTURA: términos del servidor, incorporación, cargas por ruta (Mi acceso, Ayuda) y el formulario de soporte
  terminosSrv: null, incorporacion: null, cache: {}, ayuda: {},
  avisos: null, pushEstado: 'apagado',     // MC-6: Novedades de la empresa elegida y estado del push en este aparato
};
const ERR_CORTE = ['MC_SESION_INVALIDA', 'MC_BLOQUEADO'];

// ── Tema: Claro / Oscuro / Automático (se recuerda en el aparato) ─────────────────────────────────────────────────
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let tema = 'auto';
function leer(k) { try { return localStorage.getItem(k); } catch { return null; } }
function escribir(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }
function aplicarTema(v, guardar = true) {
  tema = ['claro', 'oscuro', 'auto'].includes(v) ? v : 'auto';
  const osc = tema === 'oscuro' || (tema === 'auto' && !!mq?.matches);
  document.documentElement.dataset.tema = osc ? 'oscuro' : 'claro';
  if (guardar) escribir('mc_tema', tema);
}
mq?.addEventListener?.('change', () => { if (tema === 'auto') { aplicarTema('auto', false); pintar(); } });

function colorBarra(ruta) {
  const osc = document.documentElement.dataset.tema === 'oscuro';
  const c = RUTAS_ACCESO.has(ruta) || ruta === 'inicio' ? '#17091A' : (osc ? '#1A0C1E' : '#FFFFFF');
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.content = c; });
}

// ── Rutas ─────────────────────────────────────────────────────────────────────────────────────────────────────
function ruta() { const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean); return { r: p[0] || 'inicio', a: p[1] || '' }; }
function ir(r) { const h = '#/' + r; if (location.hash === h) pintar(); else location.hash = h; }

const wa = (num, texto) => `https://wa.me/${encodeURIComponent(num)}?text=${encodeURIComponent(texto)}`;
const WA_MEJORA = wa(CONFIG.WHATSAPP_COMERCIAL, 'Hola Contadoor 👋 Quiero saber cómo mejorar mi plan a Contadoor PRO (Pre-IVA y Pre-Renta). Te escribo desde MiContadoor.');
const WA_EQUIPO = wa(CONFIG.WHATSAPP_EQUIPO, 'Hola Contadoor 👋 Te escribo desde MiContadoor.');
const WA_AYUDA = wa(CONFIG.WHATSAPP_EQUIPO, 'Hola Contadoor 👋 Necesito ayuda con MiContadoor.');   // sin datos personales ni montos

function ctx() {
  return {
    cfg: CONFIG, api: st.api, sesion: st.sesion, empresa: st.empresa, resumen: st.resumen, perm: st.perm, impuestos: st.impuestos, tema, version: VERSION,
    abiertos: st.abiertos, solicitudes: st.solicitudes, waMejora: WA_MEJORA, waEquipo: WA_EQUIPO, waAyuda: WA_AYUDA,
    incorporacion: st.incorporacion, misTerminos: st.cache.misTerminos,
    enlaceDoc: (u) => urlSegura(u, CONFIG.HOSTS_DOCUMENTOS),
    avisos: st.avisos, pushEstado: st.pushEstado,
  };
}

function vista(r, a) {
  const c = ctx();
  switch (r) {
    case 'inicio': return vInicio(c);
    case 'reporte': return vReporte(c);
    case 'historial': return vHistorial(c);
    case 'cuenta': return vCuenta(c, a);
    case 'pago': return vPago(c, a);
    case 'preiva': return st.impuestos ? vImpuestos(c, st.impuestos) : vPreIva(c);
    case 'prerenta': return vPreRenta(c);
    case 'trabajos': return vTrabajos(c);
    case 'mas': return vMas(c);
    case 'acceso': return vAcceso(c);
    case 'ayuda': return vAyuda(c, { ...st.ayuda, soporte: !!st.api.capacidades.soporte, solicitudes: st.cache.solicitudes });
    case 'incorporacion': return vIncorporacion(c, st.incorporacion);
    case 'novedades': return vNovedades(c);
    default: return vInicio(c);
  }
}

function pintar() {
  if (window.top !== window.self) { $app.innerHTML = String(vFuera()); return; }      // anti-clickjacking (Pages no permite frame-ancestors)
  const { r, a } = ruta();
  const franja = esDemo ? html`<div class="demo" role="note"><b>DEMO · DATOS FICTICIOS</b> · no conectada a Gestoor</div>` : '';
  document.body.classList.toggle('demo-on', esDemo);
  let cuerpo; let conTabs = false;
  if (RUTAS_ACCESO.has(r) || !st.sesion) {
    const rr = RUTAS_ACCESO.has(r) ? r : 'ingreso';
    cuerpo = rr === 'recuperar' ? vRecuperar({ mensaje: st.mensaje })
      : rr === 'activar' ? vActivar({ tipo: st.tipoEnlace, mensaje: st.mensaje, listo: st.activado, pendiente: !!st.enlacePendiente })
        : rr === 'terminos' ? (st.api?.capacidades?.terminosServidor ? vTerminosServidor({ srv: st.terminosSrv, mensaje: st.mensaje }) : vTerminos({ version: CONFIG.TERMINOS_VERSION, mensaje: st.mensaje }))
          : vIngreso({ mensaje: st.mensaje, demo: esDemo });
    colorBarra(rr);
  } else if (!st.empresa) {
    cuerpo = html`<section class="oscura"><h1>Tu acceso aún no tiene empresas</h1><p class="intro">Tu equipo Contadoor debe vincular tu empresa. Escríbenos si crees que es un error.</p><form><button type="button" class="btn lin" data-accion="salir">Salir</button></form></section>`;
    colorBarra('ingreso');
  } else if (!st.perm) {   // OBS-PWA-1: la ruta cambió mientras la empresa aún se cargaba → estado de carga, nunca una vista sin permisos
    cuerpo = html`<div class="cargando" role="status" aria-label="Cargando"><div class="spin"></div></div>`;
    colorBarra('inicio');
  } else {
    cuerpo = vista(r, a); conTabs = true; colorBarra(r);
  }
  const hoja = st.hoja ? st.hoja() : '';
  $app.classList.toggle('sin-tabs', !conTabs);
  // Guía para instalar en iPhone (Android la ofrece solo). En la demo se puede forzar con ?ios=1.
  const envG = entornoGuia();
  const guia = (q.get('ios') === '1' && esDemo) || mostrarGuiaIos(envG) ? vGuiaIos({ safari: esSafari(envG.ua) }) : '';
  $app.innerHTML = String(html`${franja}${guia}${cuerpo}${conTabs ? tabs(ctx(), r) : ''}${hoja}`);
  hidratar();
  asegurarRuta(RUTAS_ACCESO.has(r) || !st.sesion ? (RUTAS_ACCESO.has(r) ? r : 'ingreso') : r);
  const clave = r + '/' + a;
  if (clave !== st.rutaPrevia) { window.scrollTo(0, 0); st.rutaPrevia = clave; }
}

/** Lo que la CSP no deja poner en el HTML (style=""): anchos y altos se fijan por CSSOM. */
function hidratar() {
  $app.querySelectorAll('[data-w]').forEach((e) => { e.style.width = Math.max(0, Math.min(100, Number(e.dataset.w) || 0)) + '%'; });
  $app.querySelectorAll('[data-h]').forEach((e) => { e.style.height = Math.max(2, Math.min(100, Number(e.dataset.h) || 0)) + '%'; });
  const t = $app.querySelector('.tabs'); if (t) t.style.setProperty('--n', t.dataset.n);
  if (st.flash) {
    const sec = $app.querySelector('.sec');
    if (sec) { const p = document.createElement('p'); p.className = 'aviso ok'; p.setAttribute('role', 'status'); p.textContent = st.flash; sec.prepend(p); }
    st.flash = null;
  }
  const f = $app.querySelector('.hoja button, .hoja input'); if (f) f.focus();
}

// ── MICONTADOOR-APERTURA: cargas que dependen de la ruta ───────────────────────────────────────────────────────────
/** Carga una sola vez por clave; errores de sesión cortan todo como en el resto de la app; otros errores → 'error'. */
function cargarUna(clave, fn) {
  if (st.cache[clave] !== undefined) return;
  st.cache[clave] = 'cargando';
  fn().then((v) => { st.cache[clave] = v ?? 'error'; pintar(); })
    .catch((e) => { if (ERR_CORTE.includes(e?.codigo)) { manejarError(e); return; } st.cache[clave] = 'error'; pintar(); });
}
function asegurarRuta(r) {
  if (r === 'terminos' && st.api?.capacidades?.terminosServidor && !st.terminosSrv) { cargarTerminos().then(pintar).catch(manejarError); return; }
  if (!st.sesion || !st.empresa) return;
  if (r === 'acceso' && st.api.capacidades.misTerminos) cargarUna('misTerminos', async () => normalizarMisTerminos(await st.api.misTerminos()));
  if (r === 'ayuda' && st.api.capacidades.soporte) cargarUna('solicitudes', async () => normalizarSolicitudes(await st.api.misSolicitudes(st.empresa.ref)));
}
/** Términos del servidor: se muestran SOLO si el SHA-256 del texto calza con el que informa el servidor (fail-closed). */
async function cargarTerminos() {
  st.terminosSrv = { estado: 'cargando' };
  try {
    const t = normalizarTerminos(await st.api.terminosVigentes());
    if (!t) { st.terminosSrv = { estado: 'error' }; return; }
    if (await sha256Hex(t.texto) !== t.sha256) { st.terminosSrv = { estado: 'error', texto: mensajeError('TERMINOS_HUELLA') }; return; }
    st.terminosSrv = { estado: 'ok', ...t };
  } catch (e) {
    if (ERR_CORTE.includes(e?.codigo)) { st.terminosSrv = null; throw e; }
    st.terminosSrv = { estado: 'error' };
  }
}
/** Texto exacto de una versión aceptada (Mi acceso → «Ver texto»), también verificado con su huella. */
async function verTerminos(version) {
  let t = { estado: 'cargando' }; st.hoja = () => hojaTerminos(t); pintar();
  try {
    const n = normalizarTerminos(await st.api.terminosTexto(version));
    t = n && (await sha256Hex(n.texto)) === n.sha256 && n.version === version ? { estado: 'ok', ...n } : { estado: 'error' };
  } catch (e) { if (ERR_CORTE.includes(e?.codigo)) { st.hoja = null; await manejarError(e); return; } t = { estado: 'error' }; }
  if (st.hoja) { st.hoja = () => hojaTerminos(t); pintar(); }
}
function limpiarApertura() { st.terminosSrv = null; st.incorporacion = null; st.cache = {}; st.ayuda = {}; }

// ── Datos ─────────────────────────────────────────────────────────────────────────────────────────────────────
async function manejarError(e) {
  const cod = e?.codigo || 'MC_ERROR';
  if (cod === 'MC_SESION_INVALIDA' || cod === 'MC_BLOQUEADO') {
    await st.api.salir().catch(() => {});
    st.sesion = null; st.empresa = null; st.resumen = null; limpiarApertura();
    st.mensaje = { texto: mensajeError(cod) }; ir('ingreso'); return;
  }
  st.flash = null; st.mensaje = { texto: mensajeError(cod) };
  if (!st.sesion) { ir('ingreso'); return; }
  pintar();
}

async function cargar(destino) {
  $app.innerHTML = '<div class="cargando" role="status" aria-label="Cargando"><div class="spin"></div></div>';
  try {
    st.sesion = await st.api.sesion();
    if (st.sesion.cuenta.terminos_pendientes) {
      st.mensaje = null;
      if (st.api.capacidades.terminosServidor) await cargarTerminos();
      ir('terminos'); return;
    }
    const forzada = esDemo && /^[1-9]$/.test(q.get('empresa') || '') ? st.sesion.empresas[Number(q.get('empresa')) - 1]?.ref
      : (UUID.test(q.get('e') || '') ? q.get('e').toLowerCase() : null);           // MC-6: el aviso trae la empresa (ref opaco)
    if (q.has('e')) { q.delete('e'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }
    const guardada = leer('mc_empresa');
    st.empresa = st.sesion.empresas.find((x) => x.ref === forzada) || st.sesion.empresas.find((x) => x.ref === guardada) || st.sesion.empresas[0] || null;
    if (st.empresa) await cargarResumen();
    st.mensaje = null;
    const { r } = ruta();
    if (destino) ir(destino); else if (RUTAS_ACCESO.has(r)) ir('inicio'); else pintar();
  } catch (e) { await manejarError(e); }
}

async function cargarResumen() {
  let r = await st.api.resumen(st.empresa.ref);
  // MC-5: los trabajos especiales vienen de su propia RPC (mc.trabajos). Si falla, la sección muestra un error (nunca datos falsos);
  // una sesión inválida o un bloqueo sí cortan todo, como en el resto de la app.
  if (st.api.trabajos && permisos(r).verTrabajos) {
    try { const t = await st.api.trabajos(st.empresa.ref); if (t) r = conTrabajos(r, t); }
    catch (e) { if (['MC_SESION_INVALIDA', 'MC_BLOQUEADO'].includes(e?.codigo)) throw e; r = conTrabajos(r, 'error'); }
  }
  // REPORTE-AUTO C: el reporte mensual viene de su propia RPC (mc.mi_reporte), solo la foto que cerró el analista.
  // Si falla: «aún no publicado» (nunca datos inventados); sesión inválida o bloqueo cortan todo.
  if (st.api.reporte && permisos(r).verReporte) {
    try { const j = await st.api.reporte(st.empresa.ref); if (j) r = conReporte(r, j); }
    catch (e) { if (['MC_SESION_INVALIDA', 'MC_BLOQUEADO'].includes(e?.codigo)) throw e; r = conReporte(r, 'error'); }
  }
  // MC-IMP-1: «Tu IVA del mes» (mc.mis_impuestos). Todo vínculo con la sección Pre-IVA (también Cumplimiento); si la RPC falla, la pantalla muestra un aviso
  // (nunca cifras inventadas). null = RPC no configurada → se mantiene el Pre-IVA de siempre.
  const pm = permisos(r);
  let imp = null;
  if (st.api.impuestos && pm.preIva !== 'sin_permiso') {   // Luciano 19-11: el plan Cumplimiento también ve su IVA del mes
    try { const j = await st.api.impuestos(st.empresa.ref); imp = j ? normalizarImpuestos(j) : null; }
    catch (e) { if (['MC_SESION_INVALIDA', 'MC_BLOQUEADO'].includes(e?.codigo)) throw e; imp = { estado: 'error' }; }
  }
  st.impuestos = imp;
  // MICONTADOOR-APERTURA «Tu incorporación» (mc.mi_incorporacion): si falla, aviso neutro en su vista; nunca pasos inventados.
  let inc = null;
  if (st.api.capacidades.incorporacion && st.api.incorporacion) {
    try { const j = await st.api.incorporacion(st.empresa.ref); inc = j ? normalizarIncorporacion(j) : null; }
    catch (e) { if (ERR_CORTE.includes(e?.codigo)) throw e; inc = { estado: 'error' }; }
  }
  st.incorporacion = inc;
  delete st.cache.solicitudes; st.ayuda = {};
  st.resumen = r;
  st.perm = permisos(st.resumen);
  st.cargadoAt = Date.now();
  escribir('mc_empresa', st.empresa.ref);
  await cargarAvisos();
}

// MC-6 · Novedades (fail-closed: si la RPC falla, la sección no aparece; nunca rompe el resto de la app) y estado del push.
async function cargarAvisos() {
  st.avisos = null;
  if (st.api.capacidades?.novedades) {
    try { st.avisos = normalizarAvisos(await st.api.avisos(st.empresa.ref), st.perm); } catch (e) { if (ERR_CORTE.includes(e?.codigo)) throw e; }
  }
  st.pushEstado = st.api.modo === 'demo' ? demoPush(st.api.capacidades.pushDemo) : (st.api.capacidades?.push ? await estadoActual().catch(() => 'no_soportado') : 'apagado');
}
function demoPush(v) { return { activo: 'activo', bloqueado: 'bloqueado', ios: 'ios_instalar', no_soportado: 'no_soportado' }[v] || 'inactivo'; }

/** Abre la ruta de un aviso (la mandó el service worker): solo rutas propias de la lista; el ref elige la empresa. */
const RUTA_AVISO = /^\/(\?e=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))?#\/(inicio|novedades|reporte|cuenta|cuenta\/pagado|trabajos|mas)$/;
async function abrirDesdeAviso(url) {
  const m = RUTA_AVISO.exec(String(url || ''));
  if (!m || !st.sesion) return;
  const e = m[2] && st.sesion.empresas.find((x) => x.ref === m[2]);
  if (e && e.ref !== st.empresa?.ref) { st.empresa = e; st.abiertos.clear(); try { await cargarResumen(); } catch (er) { await manejarError(er); return; } }
  else await cargarAvisos().catch(() => {});
  st.hoja = null; ir(m[3]);
}
navigator.serviceWorker?.addEventListener?.('message', (ev) => { if (ev.data?.tipo === 'mc-abrir') abrirDesdeAviso(ev.data.url); });

// ── Eventos ───────────────────────────────────────────────────────────────────────────────────────────────────
document.addEventListener('click', async (ev) => {
  const t = ev.target.closest('button[data-apariencia]');
  if (t) { aplicarTema(t.dataset.apariencia); pintar(); return; }
  const b = ev.target.closest('[data-ir]');
  if (b) { ev.preventDefault(); st.hoja = null; ir(b.dataset.ir); return; }
  const a = ev.target.closest('[data-accion]');
  if (!a) return;
  const acc = a.dataset.accion;
  if (acc === 'cerrar-guia-ios') { cerrarGuia(); if (esDemo) q.delete('ios'); pintar(); return; }
  if (acc === 'cerrar-hoja') { if (ev.target === a || a.tagName === 'BUTTON') { st.hoja = null; pintar(); } return; }
  if (acc === 'empresas') { st.hoja = () => hojaEmpresas(ctx()); pintar(); return; }
  if (acc === 'elegir') {
    const e = st.sesion.empresas.find((x) => x.ref === a.dataset.ref);
    if (!e) return;
    st.hoja = null; st.empresa = e; st.abiertos.clear();
    try { await cargarResumen(); ir('inicio'); } catch (er) { await manejarError(er); }
    return;
  }
  if (acc === 'transferencia') { const id = a.dataset.id; if (st.abiertos.has(id)) st.abiertos.delete(id); else st.abiertos.add(id); pintar(); return; }
  if (acc === 'solicitud') {
    const item = (st.resumen?.secciones?.mi_cuenta?.datos?.pendientes || []).find((x) => String(x.id) === a.dataset.id);
    const tipo = a.dataset.tipo === 'pague' ? 'pague' : 'transferi';
    st.hoja = () => hojaSolicitud(ctx(), tipo, item, st.mensajeHoja); st.mensajeHoja = null; pintar(); return;
  }
  if (acc === 'terminos-reintentar') { st.terminosSrv = null; pintar(); return; }
  if (acc === 'ver-terminos') { await verTerminos(a.dataset.version); return; }
  if (acc === 'soporte-seguridad') {
    st.ayuda = { tipo: 'seguridad' }; pintar();
    document.getElementById('cuentanos')?.scrollIntoView({ block: 'start' }); document.querySelector('#cuentanos textarea')?.focus(); return;
  }
  // ── MC-6 · Novedades y avisos ──
  if (acc === 'aviso') {
    const id = Number(a.dataset.id); const it = st.avisos?.avisos.find((x) => x.id === id);
    if (!it) return;
    if (!it.leido) { it.leido = true; st.avisos.noLeidos = Math.max(0, st.avisos.noLeidos - 1); st.api.avisosLeidos(st.empresa.ref, [id]).catch(() => {}); }
    ir(it.ruta); return;
  }
  if (acc === 'leer-todas') {
    try { await st.api.avisosLeidos(st.empresa.ref, null); st.avisos.avisos.forEach((x) => { x.leido = true; }); st.avisos.noLeidos = 0; pintar(); } catch (er) { await manejarError(er); }
    return;
  }
  if (acc === 'activar-avisos') {
    // El permiso se pide AQUÍ, dentro del toque (Safari exige el gesto del usuario): activarAvisos pide el permiso sin ningún await antes.
    const p = st.api.modo === 'demo' ? Promise.resolve('activo') : activarAvisos(st.api);
    try {
      st.pushEstado = await p;
      st.flash = st.pushEstado === 'activo' ? 'Listo: los avisos quedaron activados en este celular.' : st.pushEstado === 'bloqueado' ? null : 'No se activaron los avisos.';
    } catch (er) { st.flash = null; st.mensaje = { texto: mensajeError(er?.codigo) }; }
    pintar(); return;
  }
  if (acc === 'desactivar-avisos') {
    st.pushEstado = st.api.modo === 'demo' ? 'inactivo' : await desactivarAvisos(st.api);
    st.flash = 'Desactivaste los avisos en este celular.'; pintar(); return;
  }
  if (acc === 'correo-avisos') {   // R2: preferencia de correo (toda la cuenta)
    const activo = a.dataset.valor === '1';
    try { await st.api.avisosCorreo(activo); if (st.avisos) st.avisos.correo.activo = activo;
      st.flash = activo ? 'Listo: también te avisaremos por correo.' : 'Ya no te enviaremos avisos por correo. Seguirás viéndolos en Novedades.'; }
    catch (er) { st.flash = 'No pudimos guardar tu preferencia. Inténtalo de nuevo.'; }
    pintar(); return;
  }
  if (acc === 'probar-aviso') {
    try { await st.api.pushProbar(); st.flash = 'Te enviamos un aviso de prueba. Debería llegarte en unos segundos.'; }
    catch (er) { st.flash = er?.codigo === 'MC_ESPERA' ? 'Espera un minuto antes de pedir otra prueba.' : 'No pudimos enviar la prueba. Inténtalo de nuevo.'; }
    pintar(); return;
  }
  if (acc === 'cambiar-clave') {
    await st.api.recuperar(st.sesion.cuenta.correo).catch(() => {});
    st.flash = 'Te enviamos un enlace a tu correo para crear una contraseña nueva.'; pintar(); return;
  }
  if (acc === 'salir' || acc === 'salir-todos') {
    if (acc === 'salir-todos' && !window.confirm('¿Cerrar tu sesión en todos tus aparatos? Tendrás que volver a ingresar en cada uno.')) return;
    // MC-6: al salir, este aparato deja de recibir avisos (celular compartido); «en todos» los apaga en todos los aparatos.
    if (st.api.modo !== 'demo' && st.api.capacidades?.push) await desactivarAvisos(st.api, { todas: acc === 'salir-todos' });
    await st.api.salir({ todos: acc === 'salir-todos' });
    st.sesion = null; st.empresa = null; st.resumen = null; st.perm = null; st.hoja = null; st.avisos = null; limpiarApertura();
    st.mensaje = { ok: true, texto: 'Cerraste tu sesión.' }; ir('ingreso');
  }
});

document.addEventListener('submit', async (ev) => {
  const f = ev.target.closest('form[data-form]');
  if (!f) return;
  ev.preventDefault();
  const boton = f.querySelector('button[type=submit]'); if (boton) boton.disabled = true;
  const d = new FormData(f);
  try {
    switch (f.dataset.form) {
      case 'ingreso': {
        const correo = String(d.get('correo') || '').trim();
        if (!esDemo && (!CORREO.test(correo) || !d.get('clave'))) { st.mensaje = { texto: mensajeError('CREDENCIALES') }; pintar(); return; }
        await st.api.ingresar(correo, String(d.get('clave') || ''));
        st.mensaje = null; await cargar('inicio'); return;
      }
      case 'recuperar': {
        await st.api.recuperar(String(d.get('correo') || '').trim());
        st.mensaje = { ok: true, texto: 'Si el correo corresponde a una cuenta de MiContadoor, te llegará un enlace en unos minutos. Revisa también tu carpeta de spam.' };
        pintar(); return;
      }
      case 'continuar': { await continuarEnlace(); pintar(); return; }
      case 'activar': {
        const err = validarContrasena(String(d.get('a') || ''), String(d.get('b') || ''));
        if (err) { st.mensaje = { texto: err }; pintar(); return; }
        await st.api.definirContrasena(String(d.get('a')));
        st.activado = true; st.mensaje = { ok: true, texto: 'Tu contraseña quedó guardada. Úsala la próxima vez que ingreses.' }; pintar(); return;
      }
      case 'terminos': {
        if (!d.get('ok')) { st.mensaje = { texto: 'Para continuar, marca que aceptas los términos.' }; pintar(); return; }
        if (st.api.capacidades.terminosServidor) {
          // Solo se acepta un texto VERIFICADO (huella calzada al cargar); el servidor vuelve a exigir versión + huella vigentes.
          const t = st.terminosSrv;
          if (t?.estado !== 'ok') { st.terminosSrv = null; st.mensaje = { texto: mensajeError('TERMINOS_HUELLA') }; pintar(); return; }
          try { await st.api.aceptarTerminosV2(t.version, t.sha256); }
          catch (e) {
            if (e?.codigo === 'MC_TERMINOS_VERSION') { st.terminosSrv = null; st.mensaje = { texto: mensajeError('MC_TERMINOS_VERSION') }; pintar(); return; }
            throw e;
          }
        } else {
          await st.api.aceptarTerminos(CONFIG.TERMINOS_VERSION);
        }
        st.terminosSrv = null; delete st.cache.misTerminos;
        await cargar('inicio'); return;
      }
      case 'soporte': {
        const tipo = String(d.get('tipo') || ''); const texto = String(d.get('mensaje') || '');
        const err = validarSoporte(tipo, texto);
        if (err) { st.ayuda = { tipo, texto, mensaje: err }; pintar(); return; }
        try {
          const r = await st.api.soporteCrear(st.empresa.ref, tipo, texto);
          st.ayuda = { enviada: true, folio: /^MC-\d{4}-\d{1,8}$/.test(String(r?.folio)) ? r.folio : null };
        } catch (e) {
          if (ERR_CORTE.includes(e?.codigo)) throw e;
          st.ayuda = { tipo, texto, mensaje: mensajeError(e?.codigo) }; pintar(); return;
        }
        delete st.cache.solicitudes; pintar(); return;
      }
      case 'solicitud': {
        const err = validarSolicitud(f.dataset.tipo, String(d.get('fecha') || ''), d.get('archivo'));
        if (err) { st.mensajeHoja = err; const id = f.dataset.id; const tipo = f.dataset.tipo; const item = (st.resumen?.secciones?.mi_cuenta?.datos?.pendientes || []).find((x) => String(x.id) === id); st.hoja = () => hojaSolicitud(ctx(), tipo, item, err); pintar(); return; }
        await st.api.solicitudPago({ p_ref: st.empresa.ref, p_item: f.dataset.id, p_tipo: f.dataset.tipo, p_fecha: String(d.get('fecha')) });
        st.solicitudes.add(f.dataset.id); st.hoja = null;
        st.flash = 'Gracias por avisar. Lo revisamos y te confirmamos.'; pintar(); return;
      }
      default:
    }
  } catch (e) {
    if (f.dataset.form === 'activar') { st.mensaje = { texto: e?.codigo === 'CONTRASENA' ? 'No pudimos guardar esa contraseña. Prueba con otra más segura (puede que aparezca en filtraciones conocidas).' : mensajeError(e?.codigo) }; pintar(); return; }
    if (f.dataset.form === 'ingreso') { st.mensaje = { texto: mensajeError(e?.codigo === 'RED' ? 'RED' : 'CREDENCIALES') }; pintar(); return; }
    await manejarError(e);
  } finally { if (boton) boton.disabled = false; }
});

function validarSolicitud(tipo, fechaTxt, archivo) {
  const hoy = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaTxt) || fechaTxt > hoy) return 'Indica la fecha en que pagaste (no puede ser futura).';
  const tiene = archivo && typeof archivo === 'object' && archivo.size > 0;
  if (tipo === 'pague' && !tiene) return 'Adjunta el comprobante del pago.';
  if (tiene && (!['application/pdf', 'image/jpeg', 'image/png'].includes(archivo.type) || archivo.size > 5 * 1024 * 1024)) return 'El comprobante debe ser PDF, JPG o PNG de hasta 5 MB.';
  return null;
}

window.addEventListener('hashchange', () => {
  const { r } = ruta();
  if (!RUTAS_ACCESO.has(r) && !st.sesion && st.api?.tieneSesion()) { cargar(); return; }
  if (!RUTAS_ACCESO.has(r)) st.mensaje = null;
  pintar();
});

// Privacidad: al pasar a segundo plano se difumina todo (vista previa del selector de apps sin montos).
document.addEventListener('visibilitychange', () => {
  document.documentElement.classList.toggle('oculto', document.hidden);
  if (!document.hidden && st.empresa && Date.now() - st.cargadoAt > 5 * 60 * 1000) cargarResumen().then(pintar).catch(manejarError);
});

// ── Enlaces de los correos S2 (invitación) y S4 (restablecer) ────────────────────────────────────────────────────
async function tomarEnlace() {
  const th = q.get('token_hash'); const tipo = q.get('type');
  const frag = new URLSearchParams(location.hash.startsWith('#access_token') || location.hash.startsWith('#error') ? location.hash.slice(1) : '');
  const limpiar = () => history.replaceState(null, '', location.pathname + (esDemo ? '?demo=1' : '') + '#/activar');
  if (th || tipo) {
    // H-AUTH-2: con o sin type, el token sale de la barra y del historial de inmediato; si falta algo, error neutro.
    if (!th || (tipo !== 'invite' && tipo !== 'recovery')) {
      st.enlacePendiente = null; st.mensaje = { texto: mensajeError('ENLACE') };
      history.replaceState(null, '', location.pathname + (esDemo ? '?demo=1' : '') + '#/ingreso'); return true;
    }
    // H-AUTH-1: NO se canjea al cargar (un escáner de correo que abra el enlace lo gastaría). Queda SOLO en memoria
    // y se canjea cuando la persona toca "Continuar" (continuarEnlace).
    st.tipoEnlace = tipo === 'recovery' ? 'recovery' : 'invite'; st.enlacePendiente = { th, tipo }; st.activado = false; st.mensaje = null;
    limpiar(); return true;
  }
  if (frag.get('access_token') && frag.get('refresh_token')) {
    st.tipoEnlace = frag.get('type') === 'recovery' ? 'recovery' : 'invite';
    const [acc, ref, exp] = [frag.get('access_token'), frag.get('refresh_token'), frag.get('expires_in')]; limpiar();
    await st.api.tomarFragmento(acc, ref, exp); return true;
  }
  if (frag.get('error') || frag.get('error_description')) { history.replaceState(null, '', location.pathname + '#/ingreso'); st.mensaje = { texto: mensajeError('ENLACE') }; return true; }
  return false;
}

/** H-AUTH-1: canje del enlace guardado en memoria, SOLO tras el clic en "Continuar". Un intento por clic. */
async function continuarEnlace() {
  const p = st.enlacePendiente; st.enlacePendiente = null;
  if (!p) { st.mensaje = { texto: mensajeError('ENLACE') }; history.replaceState(null, '', location.pathname + '#/ingreso'); return false; }
  try { await st.api.verificarEnlace(p.th, p.tipo); st.mensaje = null; return true; }
  catch { st.mensaje = { texto: mensajeError('ENLACE') }; history.replaceState(null, '', location.pathname + '#/ingreso'); return false; }
}

// ── Arranque ──────────────────────────────────────────────────────────────────────────────────────────────────
async function arrancar() {
  aplicarTema((esDemo && q.get('tema')) || leer('mc_tema') || 'auto', !(esDemo && q.get('tema')));
  st.api = esDemo
    ? crearApiDemo(demo, { plan: q.get('plan'), rol: q.get('rol'), solicitudes: q.get('solicitudes') === '1', terminos: q.get('terminos') === '1', inc: q.get('inc'), huella: q.get('huella'), avisos: q.get('avisos') })
    : crearApiReal(CONFIG);
  registrarServiceWorker();
  if (!st.api) {
    st.mensaje = { texto: mensajeError('CONFIG') };
    st.api = { tieneSesion: () => false, ingresar: async () => { throw Object.assign(new Error(), { codigo: 'CONFIG' }); }, recuperar: async () => {}, salir: async () => {}, capacidades: {} };
    ir('ingreso'); pintar(); return;
  }
  if (await tomarEnlace()) { pintar(); return; }
  const { r } = ruta();
  if (esDemo && !RUTAS_ACCESO.has(r)) { await st.api.ingresar('demo', 'demo'); await cargar(); return; }
  if (!RUTAS_ACCESO.has(r) && st.api.tieneSesion()) { await cargar(); return; }
  if (!RUTAS_ACCESO.has(r)) { history.replaceState(null, '', location.pathname + location.search + '#/ingreso'); }
  pintar();
}
arrancar();
