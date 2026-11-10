// MiContadoor V1 · arranque, rutas, estado y eventos. Todo el HTML sale de vistas*.js (escapado con html``).
import { CONFIG } from './config.js';
import { crearApiReal, crearApiDemo } from './api.js';
import { demo } from './demo.js';
import { permisos, mensajeError, validarContrasena } from './datos.js';
import { html, urlSegura, CORREO } from './util.js';
import { vIngreso, vRecuperar, vActivar, vTerminos, vFuera } from './vistas-acceso.js';
import { tabs } from './vistas-comunes.js';
import { vInicio, vReporte, vHistorial } from './vistas-reporte.js';
import { vCuenta, vPago, vPreIva, vPreRenta, vTrabajos, vMas, vAcceso, hojaEmpresas, hojaSolicitud } from './vistas-cuenta.js';
import { registrarServiceWorker } from './push.js';

const VERSION = '1.0.0-borrador';
const RUTAS_ACCESO = new Set(['ingreso', 'recuperar', 'activar', 'terminos']);
const $app = document.getElementById('app');
const q = new URLSearchParams(location.search);
const esDemo = q.get('demo') === '1';

const st = {
  api: null, sesion: null, empresa: null, resumen: null, perm: null, cargadoAt: 0,
  mensaje: null, flash: null, tipoEnlace: 'invite', activado: false,
  abiertos: new Set(), solicitudes: new Set(), hoja: null, rutaPrevia: '',
};

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

function ctx() {
  return {
    cfg: CONFIG, api: st.api, sesion: st.sesion, empresa: st.empresa, resumen: st.resumen, perm: st.perm, tema, version: VERSION,
    abiertos: st.abiertos, solicitudes: st.solicitudes, waMejora: WA_MEJORA, waEquipo: WA_EQUIPO,
    enlaceDoc: (u) => urlSegura(u, CONFIG.HOSTS_DOCUMENTOS),
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
    case 'preiva': return vPreIva(c);
    case 'prerenta': return vPreRenta(c);
    case 'trabajos': return vTrabajos(c);
    case 'mas': return vMas(c);
    case 'acceso': return vAcceso(c);
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
      : rr === 'activar' ? vActivar({ tipo: st.tipoEnlace, mensaje: st.mensaje, listo: st.activado })
        : rr === 'terminos' ? vTerminos({ version: CONFIG.TERMINOS_VERSION, mensaje: st.mensaje })
          : vIngreso({ mensaje: st.mensaje, demo: esDemo });
    colorBarra(rr);
  } else if (!st.empresa) {
    cuerpo = html`<section class="oscura"><h1>Tu acceso aún no tiene empresas</h1><p class="intro">Tu equipo Contadoor debe vincular tu empresa. Escríbenos si crees que es un error.</p><form><button type="button" class="btn lin" data-accion="salir">Salir</button></form></section>`;
    colorBarra('ingreso');
  } else {
    cuerpo = vista(r, a); conTabs = true; colorBarra(r);
  }
  const hoja = st.hoja ? st.hoja() : '';
  $app.classList.toggle('sin-tabs', !conTabs);
  $app.innerHTML = String(html`${franja}${cuerpo}${conTabs ? tabs(ctx(), r) : ''}${hoja}`);
  hidratar();
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

// ── Datos ─────────────────────────────────────────────────────────────────────────────────────────────────────
async function manejarError(e) {
  const cod = e?.codigo || 'MC_ERROR';
  if (cod === 'MC_SESION_INVALIDA' || cod === 'MC_BLOQUEADO') {
    await st.api.salir().catch(() => {});
    st.sesion = null; st.empresa = null; st.resumen = null;
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
    if (st.sesion.cuenta.terminos_pendientes) { st.mensaje = null; ir('terminos'); return; }
    const forzada = esDemo && /^[1-9]$/.test(q.get('empresa') || '') ? st.sesion.empresas[Number(q.get('empresa')) - 1]?.ref : null;
    const guardada = leer('mc_empresa');
    st.empresa = st.sesion.empresas.find((x) => x.ref === forzada) || st.sesion.empresas.find((x) => x.ref === guardada) || st.sesion.empresas[0] || null;
    if (st.empresa) await cargarResumen();
    st.mensaje = null;
    const { r } = ruta();
    if (destino) ir(destino); else if (RUTAS_ACCESO.has(r)) ir('inicio'); else pintar();
  } catch (e) { await manejarError(e); }
}

async function cargarResumen() {
  st.resumen = await st.api.resumen(st.empresa.ref);
  st.perm = permisos(st.resumen);
  st.cargadoAt = Date.now();
  escribir('mc_empresa', st.empresa.ref);
}

// ── Eventos ───────────────────────────────────────────────────────────────────────────────────────────────────
document.addEventListener('click', async (ev) => {
  const t = ev.target.closest('button[data-apariencia]');
  if (t) { aplicarTema(t.dataset.apariencia); pintar(); return; }
  const b = ev.target.closest('[data-ir]');
  if (b) { ev.preventDefault(); st.hoja = null; ir(b.dataset.ir); return; }
  const a = ev.target.closest('[data-accion]');
  if (!a) return;
  const acc = a.dataset.accion;
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
  if (acc === 'cambiar-clave') {
    await st.api.recuperar(st.sesion.cuenta.correo).catch(() => {});
    st.flash = 'Te enviamos un enlace a tu correo para crear una contraseña nueva.'; pintar(); return;
  }
  if (acc === 'salir' || acc === 'salir-todos') {
    if (acc === 'salir-todos' && !window.confirm('¿Cerrar tu sesión en todos tus aparatos? Tendrás que volver a ingresar en cada uno.')) return;
    await st.api.salir({ todos: acc === 'salir-todos' });
    st.sesion = null; st.empresa = null; st.resumen = null; st.perm = null; st.hoja = null;
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
      case 'activar': {
        const err = validarContrasena(String(d.get('a') || ''), String(d.get('b') || ''));
        if (err) { st.mensaje = { texto: err }; pintar(); return; }
        await st.api.definirContrasena(String(d.get('a')));
        st.activado = true; st.mensaje = { ok: true, texto: 'Tu contraseña quedó guardada. Úsala la próxima vez que ingreses.' }; pintar(); return;
      }
      case 'terminos': {
        if (!d.get('ok')) { st.mensaje = { texto: 'Para continuar, marca que aceptas los términos.' }; pintar(); return; }
        await st.api.aceptarTerminos(CONFIG.TERMINOS_VERSION);
        await cargar('inicio'); return;
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
  if (th && tipo) {
    st.tipoEnlace = tipo === 'recovery' ? 'recovery' : 'invite'; limpiar();
    try { await st.api.verificarEnlace(th, tipo); st.mensaje = null; } catch { st.mensaje = { texto: mensajeError('ENLACE') }; history.replaceState(null, '', location.pathname + '#/ingreso'); }
    return true;
  }
  if (frag.get('access_token') && frag.get('refresh_token')) {
    st.tipoEnlace = frag.get('type') === 'recovery' ? 'recovery' : 'invite';
    const [acc, ref, exp] = [frag.get('access_token'), frag.get('refresh_token'), frag.get('expires_in')]; limpiar();
    await st.api.tomarFragmento(acc, ref, exp); return true;
  }
  if (frag.get('error') || frag.get('error_description')) { history.replaceState(null, '', location.pathname + '#/ingreso'); st.mensaje = { texto: mensajeError('ENLACE') }; return true; }
  return false;
}

// ── Arranque ──────────────────────────────────────────────────────────────────────────────────────────────────
async function arrancar() {
  aplicarTema((esDemo && q.get('tema')) || leer('mc_tema') || 'auto', !(esDemo && q.get('tema')));
  st.api = esDemo
    ? crearApiDemo(demo, { plan: q.get('plan'), rol: q.get('rol'), solicitudes: q.get('solicitudes') === '1', terminos: q.get('terminos') === '1' })
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
