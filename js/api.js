// MiContadoor · ÚNICA capa de datos. Si cambia el contrato mc (MC-1 R3 o MC-2…MC-5), se ajusta solo aquí.
// Sin dependencias: Auth (GoTrue) y PostgREST por fetch. Solo clave pública. Nunca se registran tokens ni datos.
import { normalizarSesion } from './datos.js';
import { CORREO, UUID } from './util.js';
import { pushConfigurado } from './push.js';

const CLAVE_SESION = 'mc_sesion_v1';      // solo el refresh token y su vencimiento (la sesión del aparato)

class ErrorApi extends Error { constructor(codigo) { super(codigo); this.codigo = codigo; } }
export { ErrorApi };

async function pedir(url, opciones, ms = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...opciones, signal: ctl.signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
  } catch { throw new ErrorApi('RED'); }
  finally { clearTimeout(t); }
}

function leerGuardada() {
  try { const j = JSON.parse(localStorage.getItem(CLAVE_SESION) || 'null'); return j && typeof j.r === 'string' ? j : null; } catch { return null; }
}
function guardar(r) { try { if (r) localStorage.setItem(CLAVE_SESION, JSON.stringify({ r })); else localStorage.removeItem(CLAVE_SESION); } catch { /* sin almacenamiento: sesión solo en memoria */ } }

/** Qué partes opcionales del contrato están configuradas (las vistas no muestran lo que no existe). */
export function capacidadesDe(cfg) {
  const r = cfg.RPC || {};
  return {
    solicitudPago: !!r.SOLICITUD_PAGO,
    terminosServidor: !!(r.TERMINOS_VIGENTES && r.TERMINOS_V2),
    misTerminos: !!(r.MIS_TERMINOS && r.TERMINOS_TEXTO),
    soporte: !!(r.SOPORTE_CREAR && r.MIS_SOLICITUDES),
    incorporacion: !!r.INCORPORACION,
    convenios: !!r.MIS_CONVENIOS,
    historialImpuestos: !!r.HISTORIAL_IMPUESTOS,
  };
}

/** Backend real (Supabase). */
export function crearApiReal(cfg) {
  const base = String(cfg.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = cfg.SUPABASE_ANON_KEY;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base) || !key) return null;
  let acceso = null; let vence = 0; let refresh = leerGuardada()?.r ?? null;

  function tomarSesion(j) {
    if (!j?.access_token || !j?.refresh_token) throw new ErrorApi('CREDENCIALES');
    acceso = j.access_token; vence = Date.now() + Math.max(30, Number(j.expires_in) || 3600) * 1000 - 30000;
    refresh = j.refresh_token; guardar(refresh);
  }
  async function auth(ruta, cuerpo, { bearer = false, metodo = 'POST' } = {}) {
    const h = { apikey: key, 'Content-Type': 'application/json' };
    if (bearer) h.Authorization = `Bearer ${acceso}`;
    const r = await pedir(`${base}/auth/v1/${ruta}`, { method: metodo, headers: h, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    let j = null; try { j = await r.json(); } catch { /* cuerpo vacío */ }
    return { r, j };
  }
  async function tokenVigente() {
    if (acceso && Date.now() < vence) return acceso;
    if (!refresh) throw new ErrorApi('MC_SESION_INVALIDA');
    const { r, j } = await auth('token?grant_type=refresh_token', { refresh_token: refresh });
    if (!r.ok) { acceso = null; refresh = null; guardar(null); throw new ErrorApi('MC_SESION_INVALIDA'); }
    tomarSesion(j); return acceso;
  }
  async function rpc(fn, args = {}) {
    const t = await tokenVigente();
    const r = await pedir(`${base}/rest/v1/rpc/${encodeURIComponent(fn)}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', 'Content-Profile': cfg.ESQUEMA, 'Accept-Profile': cfg.ESQUEMA },
      body: JSON.stringify(args),
    });
    if (r.status === 401 || r.status === 403) { acceso = null; throw new ErrorApi('MC_SESION_INVALIDA'); }
    if (!r.ok) throw new ErrorApi('MC_ERROR');
    const j = await r.json().catch(() => null);
    if (j && j.ok === false) throw new ErrorApi(typeof j.codigo === 'string' ? j.codigo : 'MC_ERROR');
    return j;
  }

  return {
    modo: 'real',
    capacidades: { ...capacidadesDe(cfg), novedades: !!cfg.RPC.AVISOS && !!cfg.RPC.AVISOS_LEIDOS, push: pushConfigurado(cfg) },
    tieneSesion: () => !!refresh,
    async ingresar(correo, clave) {
      if (!CORREO.test(correo) || !clave) throw new ErrorApi('CREDENCIALES');
      const { r, j } = await auth('token?grant_type=password', { email: correo.trim().toLowerCase(), password: clave });
      if (!r.ok) throw new ErrorApi('CREDENCIALES');     // 400 credenciales o 403 del hook: mismo mensaje (anti-enumeración)
      tomarSesion(j);
    },
    async recuperar(correo) {
      if (!CORREO.test(correo)) return;                   // respuesta idéntica exista o no el correo
      await auth('recover', { email: correo.trim().toLowerCase() }).catch(() => {});
    },
    /** Enlace del correo S2 (invite) o S4 (recovery): ?token_hash=…&type=… → sesión para definir la contraseña. */
    async verificarEnlace(tokenHash, tipo) {
      if (!/^[A-Za-z0-9_-]{10,200}$/.test(tokenHash) || !['invite', 'recovery'].includes(tipo)) throw new ErrorApi('ENLACE');
      const { r, j } = await auth('verify', { type: tipo, token_hash: tokenHash });
      if (!r.ok) throw new ErrorApi('ENLACE');
      tomarSesion(j);
    },
    /** Enlace con tokens en el fragmento (#access_token=…&refresh_token=…&type=invite): flujo implícito por defecto de Auth. */
    async tomarFragmento(acc, ref, exp) { tomarSesion({ access_token: acc, refresh_token: ref, expires_in: exp }); },
    async definirContrasena(clave) {
      await tokenVigente();
      const { r } = await auth('user', { password: clave }, { bearer: true, metodo: 'PUT' });
      if (!r.ok) throw new ErrorApi('CONTRASENA');
    },
    async salir({ todos = false } = {}) {
      try { if (acceso || refresh) { await tokenVigente(); await auth(`logout?scope=${todos ? 'global' : 'local'}`, null, { bearer: true }); } } catch { /* igual se borra local */ }
      acceso = null; refresh = null; guardar(null);
    },
    async sesion() { const n = normalizarSesion(await rpc(cfg.RPC.SESION)); if (!n.ok) throw new ErrorApi(n.codigo); return n; },
    async resumen(ref) { if (!UUID.test(ref)) throw new ErrorApi('MC_SIN_ACCESO'); return rpc(cfg.RPC.RESUMEN, { p_ref: ref }); },
    async aceptarTerminos(v) { return rpc(cfg.RPC.TERMINOS, { p_version: v }); },
    // ── MICONTADOOR-APERTURA: cada una devuelve null si su RPC no está configurada (el portal sigue como antes) ──
    async terminosVigentes() { return cfg.RPC.TERMINOS_VIGENTES ? rpc(cfg.RPC.TERMINOS_VIGENTES) : null; },
    async aceptarTerminosV2(v, sha) {
      if (!cfg.RPC.TERMINOS_V2) throw new ErrorApi('NO_DISPONIBLE');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || !/^[0-9a-f]{64}$/.test(String(sha))) throw new ErrorApi('MC_DATOS');
      return rpc(cfg.RPC.TERMINOS_V2, { p_version: v, p_sha256: sha });
    },
    async misTerminos() { return cfg.RPC.MIS_TERMINOS ? rpc(cfg.RPC.MIS_TERMINOS) : null; },
    async terminosTexto(v) {
      if (!cfg.RPC.TERMINOS_TEXTO) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw new ErrorApi('MC_DATOS');
      return rpc(cfg.RPC.TERMINOS_TEXTO, { p_version: v });
    },
    async soporteCrear(ref, tipo, mensaje) {
      if (!cfg.RPC.SOPORTE_CREAR) throw new ErrorApi('NO_DISPONIBLE');
      if (!UUID.test(ref)) throw new ErrorApi('MC_SIN_ACCESO');
      return rpc(cfg.RPC.SOPORTE_CREAR, { p_ref: ref, p_tipo: tipo, p_mensaje: String(mensaje).trim() });
    },
    async misSolicitudes(ref) {
      if (!cfg.RPC.MIS_SOLICITUDES) return null;
      if (!UUID.test(ref)) throw new ErrorApi('MC_SIN_ACCESO');
      return rpc(cfg.RPC.MIS_SOLICITUDES, { p_ref: ref });
    },
    async convenios(ref) {
      if (!cfg.RPC.MIS_CONVENIOS) return null;
      if (!UUID.test(ref)) throw new ErrorApi('MC_SIN_ACCESO');
      return rpc(cfg.RPC.MIS_CONVENIOS, { p_ref: ref });
    },
    async incorporacion(ref) {
      if (!cfg.RPC.INCORPORACION) return null;
      if (!UUID.test(ref)) throw new ErrorApi('MC_SIN_ACCESO');
      return rpc(cfg.RPC.INCORPORACION, { p_ref: ref });
    },
    /** Gancho del visor «Tu diagnóstico "Aquí partimos"»: aún sin RPC ni documento (CONFIG.RPC.DIAGNOSTICO = null). */
    async diagnostico(ref) {
      if (!cfg.RPC.DIAGNOSTICO) return null;
      if (!UUID.test(ref)) throw new ErrorApi('MC_SIN_ACCESO');
      return rpc(cfg.RPC.DIAGNOSTICO, { p_ref: ref });
    },
    /** MC-5: trabajos especiales de la empresa (o uno solo por código). null si la RPC no está configurada. */
    async trabajos(ref, codigo = null) {
      if (!cfg.RPC.TRABAJOS) return null;
      if (!UUID.test(ref)) throw new ErrorApi('MC_SIN_ACCESO');
      if (codigo !== null && !/^TE-\d{4}-\d{3,6}$/.test(String(codigo))) throw new ErrorApi('MC_DATOS');
      return rpc(cfg.RPC.TRABAJOS, { p_ref: ref, p_codigo: codigo });
    },
    /** MC-IMP-1: «Tu IVA del mes». null si la RPC no está configurada. p_periodo 'AAAA-MM' o null (= mes anterior). */
    /** «Tu año con el SII» (mc.mis_impuestos_anio). null si la RPC no está configurada. anio = año actual o el anterior. */
    async impuestosAnio(ref, anio = null) {
      if (!cfg.RPC.HISTORIAL_IMPUESTOS) return null;
      if (!UUID.test(ref)) throw new ErrorApi('MC_SIN_ACCESO');
      if (anio !== null && !(Number.isInteger(anio) && anio >= 2020 && anio <= 2100)) throw new ErrorApi('MC_DATOS');
      return rpc(cfg.RPC.HISTORIAL_IMPUESTOS, { p_ref: ref, p_anio: anio });
    },
    async impuestos(ref, periodo = null) {
      if (!cfg.RPC.IMPUESTOS) return null;
      if (!UUID.test(ref)) throw new ErrorApi('MC_SIN_ACCESO');
      if (periodo !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(periodo))) throw new ErrorApi('MC_DATOS');
      return rpc(cfg.RPC.IMPUESTOS, { p_ref: ref, p_periodo: periodo });
    },
    // ── MC-6 · Novedades y push (cada una exige su RPC en CONFIG.RPC; sin ella: NO_DISPONIBLE, nunca se inventa) ──
    async avisos(ref) {
      if (!cfg.RPC.AVISOS) throw new ErrorApi('NO_DISPONIBLE');
      if (!UUID.test(ref)) throw new ErrorApi('MC_SIN_ACCESO');
      return rpc(cfg.RPC.AVISOS, { p_ref: ref, p_limite: 30 });
    },
    async avisosLeidos(ref, ids) {
      if (!cfg.RPC.AVISOS_LEIDOS) throw new ErrorApi('NO_DISPONIBLE');
      if (!UUID.test(ref) || (ids !== null && (!Array.isArray(ids) || ids.length > 200 || !ids.every((x) => Number.isInteger(x) && x > 0)))) throw new ErrorApi('MC_DATOS');
      return rpc(cfg.RPC.AVISOS_LEIDOS, { p_ref: ref, p_ids: ids });
    },
    async pushSuscribir({ endpoint, p256dh, auth, plataforma }) {
      if (!cfg.RPC.PUSH_SUSCRIBIR) throw new ErrorApi('NO_DISPONIBLE');
      return rpc(cfg.RPC.PUSH_SUSCRIBIR, { p_endpoint: String(endpoint || ''), p_p256dh: String(p256dh || ''), p_auth: String(auth || ''), p_plataforma: plataforma });
    },
    async pushDesuscribir(endpoint, todas = false) {
      if (!cfg.RPC.PUSH_DESUSCRIBIR) return { ok: true };
      return rpc(cfg.RPC.PUSH_DESUSCRIBIR, { p_endpoint: endpoint ? String(endpoint) : null, p_todas: todas === true });
    },
    async avisosCorreo(activo) {
      if (!cfg.RPC.AVISOS_CORREO) throw new ErrorApi('NO_DISPONIBLE');
      return rpc(cfg.RPC.AVISOS_CORREO, { p_activo: activo === true });
    },
    async pushProbar() {
      if (!cfg.RPC.PUSH_PROBAR) throw new ErrorApi('NO_DISPONIBLE');
      return rpc(cfg.RPC.PUSH_PROBAR, {});
    },
    /** REPORTE-AUTO C: el reporte mensual cerrado (foto). null si la RPC no está configurada. p_periodo 'AAAA-MM' o null (= el último cerrado). */
    async reporte(ref, periodo = null) {
      if (!cfg.RPC.REPORTE) return null;
      if (!UUID.test(ref)) throw new ErrorApi('MC_SIN_ACCESO');
      if (periodo !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(periodo))) throw new ErrorApi('MC_DATOS');
      return rpc(cfg.RPC.REPORTE, { p_ref: ref, p_periodo: periodo });
    },
    async solicitudPago(datos) {
      if (!cfg.RPC.SOLICITUD_PAGO) throw new ErrorApi('NO_DISPONIBLE');
      // Contrato por definir en MC-3 (crea tarea a Conciliación/analista; NUNCA marca el pago). El comprobante irá a Storage.
      return rpc(cfg.RPC.SOLICITUD_PAGO, datos);
    },
  };
}

/** Backend DEMO: datos ficticios, sin red. Devuelve exactamente la forma del contrato mc. */
export function crearApiDemo(demo, opciones = {}) {
  let dentro = false; let terminos = opciones.terminos === true;
  const espera = (x) => new Promise((ok) => setTimeout(() => ok(x), 120));
  const soporte = demo.soporteNuevo();
  return {
    modo: 'demo',
    capacidades: { solicitudPago: opciones.solicitudes === true, terminosServidor: true, misTerminos: true, soporte: true, incorporacion: true, historialImpuestos: true, convenios: true,
      // MC-6: en la demo hay Novedades siempre; el push se SIMULA (opciones.avisos = inactivo | activo | bloqueado | ios | no_soportado).
      novedades: true, push: true, pushDemo: opciones.avisos || 'inactivo' },
    tieneSesion: () => dentro,
    async ingresar() { dentro = true; },
    async recuperar() { await espera(); },
    async verificarEnlace() { dentro = true; },
    async tomarFragmento() { dentro = true; },
    async definirContrasena() { await espera(); },
    async salir() { dentro = false; },
    async sesion() { return normalizarSesion(await espera(demo.sesion({ terminos }))); },
    async resumen(ref) {
      const r = demo.resumen(ref, opciones);
      if (!r) throw new ErrorApi('MC_SIN_ACCESO');
      return espera(r);
    },
    async aceptarTerminos() { terminos = false; return { ok: true }; },
    async terminosVigentes() { return espera(await demo.terminosVigentes(opciones)); },
    async aceptarTerminosV2(v, sha) {
      const t = await demo.terminosVigentes({});
      if (v !== t.version || sha !== t.sha256) throw new ErrorApi('MC_TERMINOS_VERSION');
      terminos = false; return espera({ ok: true, version: v, aceptada_at: new Date().toISOString() });
    },
    async misTerminos() { return espera(await demo.misTerminos()); },
    async terminosTexto(v) { const r = await demo.terminosTexto(v); if (!r.ok) throw new ErrorApi(r.codigo); return espera(r); },
    async soporteCrear(ref, tipo, mensaje) { const r = soporte.crear(ref, tipo, mensaje); if (!r.ok) throw new ErrorApi(r.codigo); return espera(r); },
    async misSolicitudes(ref) { return espera(soporte.listar(ref)); },
    async convenios(ref) { const r = demo.convenios(ref); if (!r) throw new ErrorApi('MC_SIN_ACCESO'); return espera(r); },
    async incorporacion(ref) {
      const r = demo.incorporacion(ref, opciones);
      if (!r) throw new ErrorApi('MC_SIN_ACCESO');
      if (r === 'error') throw new ErrorApi('MC_ERROR');
      return espera(r);
    },
    async diagnostico() { return null; },
    async trabajos(ref) {
      const r = demo.trabajos(ref, opciones);
      if (!r) throw new ErrorApi('MC_SIN_ACCESO');
      return espera(r);
    },
    async impuestosAnio(ref, anio = null) {
      const r = demo.impuestosAnio(ref, anio);
      if (!r) throw new ErrorApi('MC_SIN_ACCESO');
      if (r.ok === false) throw new ErrorApi(r.codigo);
      return espera(r);
    },
    async impuestos(ref) {
      const r = demo.impuestos(ref, opciones);
      if (!r) throw new ErrorApi('MC_SIN_ACCESO');
      return espera(r);
    },
    async avisos(ref) { const r = demo.avisos(ref, opciones); if (!r) throw new ErrorApi('MC_SIN_ACCESO'); return espera(r); },
    async avisosLeidos(ref, ids) { return espera(demo.avisosLeidos(ref, ids)); },
    async pushSuscribir() { return espera({ ok: true, activas: 1 }); },
    async pushDesuscribir() { return espera({ ok: true, desactivadas: 1 }); },
    async pushProbar() { return espera({ ok: true }); },
    async avisosCorreo(activo) { demo.correo = activo === true; return espera({ ok: true, activo: demo.correo }); },
    async reporte(ref) {
      const r = demo.reporte(ref, opciones);
      if (!r) throw new ErrorApi('MC_SIN_ACCESO');
      return espera(r);
    },
    async solicitudPago() { if (opciones.solicitudes !== true) throw new ErrorApi('NO_DISPONIBLE'); return espera({ ok: true }); },
  };
}
