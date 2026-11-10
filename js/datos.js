// MiContadoor · reglas del dominio (puras, probadas en tests/). No hablan con la red ni con el DOM.
// Contrato MC-1 (gestoor-backend-mc1, migración 202611081410_mc1b_esquema_mc.sql):
//   mc.mi_sesion()          → { ok, cuenta:{correo,nombre,terminos_pendientes}, empresas:[{ref,razon_social,rut,rol,plan_nivel}] }
//   mc.empresa_resumen(ref) → { ok, ref, rol, plan_nivel, secciones:{ reporte, mi_cuenta, facturas, trabajos, pre_iva, pre_renta } }
//       cada sección: {disponible:false} | {sin_permiso:true} | {bloqueada:true, mejora:'comercial'}
//       (MC-2…MC-5 agregarán los datos; aquí se esperan como {disponible:true, datos:{…}}).
//   rechazo: { ok:false, codigo:'MC_SESION_INVALIDA'|'MC_BLOQUEADO'|'MC_SIN_ACCESO'|'MC_DATOS' }
import { UUID, pesos, parsePeriodo, comparaPeriodo, clp } from './util.js';

export const SECCIONES = ['reporte', 'mi_cuenta', 'facturas', 'trabajos', 'pre_iva', 'pre_renta'];

/** Estado de una sección. Fail-closed: lo que no se entiende, NO se muestra. */
export function estadoSeccion(sec) {
  if (!sec || typeof sec !== 'object' || Array.isArray(sec)) return 'sin_permiso';
  if (sec.sin_permiso === true) return 'sin_permiso';
  if (sec.bloqueada === true) return 'bloqueada';
  if (sec.disponible === true && sec.datos && typeof sec.datos === 'object') return 'ok';
  if (sec.disponible === false || sec.disponible === true) return 'vacia';
  return 'sin_permiso';
}

/**
 * Permisos POR VÍNCULO (D2, Luciano 08-11): los decide el servidor por cada acceso (ver_mi_cuenta / ver_facturas).
 * El portal no "regala" permisos por el rol: si el servidor no lo dice explícitamente, no se ve.
 * Por defecto un usuario adicional ('consulta') no ve Mi cuenta ni facturas: el servidor manda {sin_permiso:true}.
 */
export function permisos(resumen) {
  const s = (resumen && typeof resumen === 'object' && resumen.secciones && typeof resumen.secciones === 'object') ? resumen.secciones : {};
  const e = {};
  for (const k of SECCIONES) e[k] = estadoSeccion(s[k]);
  return {
    rol: resumen?.rol === 'titular' ? 'titular' : 'consulta',
    pro: resumen?.plan_nivel === 'pro',
    estados: e,
    verMiCuenta: e.mi_cuenta === 'ok' || e.mi_cuenta === 'vacia',
    verFacturas: e.facturas === 'ok' || e.facturas === 'vacia',
    verReporte: e.reporte === 'ok' || e.reporte === 'vacia',
    verTrabajos: e.trabajos === 'ok' || e.trabajos === 'vacia',
    preIva: e.pre_iva,      // 'ok' | 'vacia' | 'bloqueada' | 'sin_permiso'
    preRenta: e.pre_renta,
  };
}

/** Datos de una sección solo si está permitida y publicada; si no, null. */
export function datosDe(resumen, seccion) {
  const sec = resumen?.secciones?.[seccion];
  return estadoSeccion(sec) === 'ok' ? sec.datos : null;
}

/** Valida la respuesta de mc.mi_sesion. Descarta empresas con ref inválido. */
export function normalizarSesion(j) {
  if (!j || j.ok !== true) return { ok: false, codigo: typeof j?.codigo === 'string' ? j.codigo : 'MC_ERROR' };
  const c = j.cuenta && typeof j.cuenta === 'object' ? j.cuenta : {};
  const empresas = (Array.isArray(j.empresas) ? j.empresas : [])
    .filter((x) => x && UUID.test(String(x.ref)))
    .map((x) => ({
      ref: String(x.ref),
      razon_social: String(x.razon_social ?? '').slice(0, 160),
      rut: String(x.rut ?? '').slice(0, 20),
      rol: x.rol === 'titular' ? 'titular' : 'consulta',
      plan_nivel: x.plan_nivel === 'pro' ? 'pro' : 'basico',
    }));
  return {
    ok: true,
    cuenta: { correo: String(c.correo ?? ''), nombre: c.nombre ? String(c.nombre) : '', terminos_pendientes: c.terminos_pendientes === true },
    empresas,
  };
}

/** Nombre del plan para mostrar. MC-1 solo entrega el nivel; si llega plan_nombre (contrato futuro) se usa ese. */
export function planTexto(nivel, nombre) {
  if (typeof nombre === 'string' && nombre.trim()) return nombre.trim().slice(0, 40);
  return nivel === 'pro' ? 'Contadoor PRO' : 'Cumplimiento';
}

const CERRADOS = new Set(['pagada', 'anulada']);

/**
 * Reporte mensual con ARRASTRE (regla de Luciano 08-11, E §7-ter):
 *  · Todo lo impago de TODOS los meses anteriores se acumula, cada uno con su período de origen, hasta que se pague.
 *  · Un pendiente no se borra ni se duplica (se deduplica por id).
 *  · Monto: el CONFIRMADO por el analista (con intereses) si existe; si la obligación lo exige y no está confirmado,
 *    queda "por confirmar", NO se suma y el total se marca como incompleto (nunca se muestra un monto sin confirmar).
 *  · "Ya lo pagué" / respuesta del cliente no cierra nada: sigue pendiente hasta que Contadoor registre el pago.
 *  · Total a pagar = obligaciones del mes + todo lo acumulado.
 * @param {Array} obligaciones  [{id, concepto, periodo:'YYYY-MM', monto, monto_confirmado, requiere_confirmacion, estado, …}]
 * @param {string} periodo      período del reporte 'YYYY-MM'
 */
export function calcularAcumulado(obligaciones, periodo) {
  const vacio = { mes: [], anteriores: [], totalMes: 0, totalAnteriores: 0, total: 0, incompleto: false, origenes: [] };
  if (!parsePeriodo(periodo)) return vacio;
  const vistos = new Set();
  const mes = []; const anteriores = [];
  for (const o of Array.isArray(obligaciones) ? obligaciones : []) {
    if (!o || typeof o !== 'object') continue;
    const id = o.id === undefined || o.id === null ? null : String(o.id);
    if (id !== null) { if (vistos.has(id)) continue; vistos.add(id); }
    if (CERRADOS.has(o.estado)) continue;
    if (!parsePeriodo(o.periodo)) continue;
    const cmp = comparaPeriodo(o.periodo, periodo);
    if (cmp > 0) continue;                      // períodos futuros: no son de este reporte
    const confirmado = pesos(o.monto_confirmado);
    const base = pesos(o.monto);
    let monto = null;
    if (confirmado !== null && confirmado >= 0) monto = confirmado;
    else if (!o.requiere_confirmacion && base !== null && base >= 0) monto = base;
    const item = { ...o, montoMostrado: monto, porConfirmar: monto === null };
    (cmp < 0 ? anteriores : mes).push(item);
  }
  const orden = (a, b) => comparaPeriodo(a.periodo, b.periodo) || String(a.concepto ?? '').localeCompare(String(b.concepto ?? ''));
  anteriores.sort(orden); mes.sort(orden);
  const suma = (l) => l.reduce((s, x) => s + (x.montoMostrado ?? 0), 0);
  const totalMes = suma(mes); const totalAnteriores = suma(anteriores);
  return {
    mes, anteriores, totalMes, totalAnteriores, total: totalMes + totalAnteriores,
    incompleto: [...mes, ...anteriores].some((x) => x.porConfirmar),
    origenes: [...new Set(anteriores.map((x) => x.periodo))],
  };
}

/** Texto del saldo a favor (aprobado 08-11): siempre visible, nunca se aplica solo. */
export function saldoFavorTexto(n) {
  const x = pesos(n);
  if (x === null) return 'Saldo a favor: no disponible.';
  if (x <= 0) return 'No tienes saldo a favor.';
  return `Tienes un saldo a favor de ${clp(x)}. Lo definimos contigo: usarlo en un próximo pago o devolvértelo.`;
}

/** Mensajes para el cliente: genéricos (sin revelar si un correo existe ni detalles internos). */
export function mensajeError(codigo) {
  switch (codigo) {
    case 'MC_BLOQUEADO': return 'Por seguridad, tu acceso quedó en pausa por 15 minutos. Vuelve a intentarlo después.';
    case 'MC_SIN_ACCESO': return 'No tienes acceso a esta empresa. Si crees que es un error, escríbenos.';
    case 'MC_SESION_INVALIDA': return 'Tu sesión terminó. Vuelve a ingresar.';
    case 'CREDENCIALES': return 'No pudimos ingresar. Revisa tu correo y tu contraseña.';
    case 'ENLACE': return 'El enlace ya no es válido o venció. Pide uno nuevo a tu equipo Contadoor o usa "¿Olvidaste tu contraseña?".';
    case 'RED': return 'No hay conexión. Revisa tu internet e inténtalo de nuevo.';
    case 'CONFIG': return 'MiContadoor aún no está configurado en este sitio.';
    default: return 'Algo no salió bien. Inténtalo de nuevo en unos minutos.';
  }
}

/** Reglas de contraseña del portal (además, Supabase Pro revisa contraseñas filtradas). */
export function validarContrasena(a, b) {
  if (typeof a !== 'string' || a.length < 10) return 'Usa al menos 10 caracteres.';
  if (a.length > 72) return 'Usa como máximo 72 caracteres.';
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(a) || !/\d/.test(a)) return 'Combina letras y números.';
  if (a !== b) return 'Las contraseñas no coinciden.';
  return null;
}
