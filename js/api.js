// MiContadoor · ÚNICA capa de datos. Si cambia el contrato mc (MC-1 R3 o MC-2…MC-5), se ajusta solo aquí.
// Sin dependencias: Auth (GoTrue) y PostgREST por fetch. Solo clave pública. Nunca se registran tokens ni datos.
import { normalizarSesion } from './datos.js';
import { CORREO, UUID } from './util.js';

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
    capacidades: { solicitudPago: !!cfg.RPC.SOLICITUD_PAGO },
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
  return {
    modo: 'demo',
    capacidades: { solicitudPago: opciones.solicitudes === true },
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
    async solicitudPago() { if (opciones.solicitudes !== true) throw new ErrorApi('NO_DISPONIBLE'); return espera({ ok: true }); },
  };
}
