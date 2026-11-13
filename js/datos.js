// MiContadoor · reglas del dominio (puras, probadas en tests/). No hablan con la red ni con el DOM.
// Contrato MC-1 (gestoor-backend-mc1, migración 202611081410_mc1b_esquema_mc.sql):
//   mc.mi_sesion()          → { ok, cuenta:{correo,nombre,terminos_pendientes}, empresas:[{ref,razon_social,rut,rol,plan_nivel}] }
//   mc.empresa_resumen(ref) → { ok, ref, rol, plan_nivel, secciones:{ reporte, mi_cuenta, facturas, trabajos, pre_iva, pre_renta } }
//       cada sección: {disponible:false} | {sin_permiso:true} | {bloqueada:true, mejora:'comercial'}
//       (MC-2…MC-5 agregarán los datos; aquí se esperan como {disponible:true, datos:{…}}).
//   rechazo: { ok:false, codigo:'MC_SESION_INVALIDA'|'MC_BLOQUEADO'|'MC_SIN_ACCESO'|'MC_DATOS' }
// Contrato MC-5 (gestoor-backend-mc5, 202611101410_mc5b_rpc_trabajos.sql):
//   mc.trabajos(p_ref, p_codigo?) → { ok, ref, seccion:{ disponible:true, datos:{ activos:[…], terminados:n } } }
//       cada trabajo: { codigo, servicio, etapa, estado, avance|null, responsable|null, pasos:[{t,e,fecha}], proximo|null,
//                       pago:{total,cuotas_total,pagado,pendiente,vencido,cuotas:[{n,monto,vence,estado,pagada_el}],factura} | {sin_permiso:true},
//                       documentos:[{t,fecha,tipo}], documentos_retenidos }
//   empresa_resumen sigue diciendo trabajos = {disponible:false}: la app reemplaza esa sección con normalizarTrabajos().
import { UUID, pesos, parsePeriodo, comparaPeriodo, clp, fecha } from './util.js';

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
    case 'CONFIG': return 'MiContadoor estará disponible muy pronto. Te avisaremos cuando tu cuenta esté lista.';
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

// ── Trabajos especiales (MC-5) ────────────────────────────────────────────────────────────────────────────────
const ESTADO_TE = { por_iniciar: 'Por iniciar', en_curso: 'En ejecución', en_espera: 'En espera', listo_para_entregar: 'Listo para entregar', terminado: 'Terminado' };
const ESTADO_CUOTA = new Set(['pagada', 'por_pagar', 'vencida', 'al_terminar']);
const texto = (x, max) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : null);
const enumerar = (ns) => (ns.length === 1 ? `cuota ${ns[0]}` : `cuotas ${ns.slice(0, -1).join(', ')} y ${ns[ns.length - 1]}`);

/** Pago de un trabajo para la pantalla. null = no se muestra (sin permiso del vínculo o forma desconocida: fail-closed). */
export function pagoTrabajo(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p) || p.sin_permiso === true) return null;
  const total = pesos(p.total); const pagado = pesos(p.pagado); const pendiente = pesos(p.pendiente);
  if (total === null || pagado === null || pendiente === null) return null;
  const cuotas = (Array.isArray(p.cuotas) ? p.cuotas : [])
    .filter((c) => c && Number.isInteger(c.n) && ESTADO_CUOTA.has(c.estado) && pesos(c.monto) !== null)
    .sort((a, b) => a.n - b.n);
  const pagadas = cuotas.filter((c) => c.estado === 'pagada').map((c) => c.n);
  const vencidas = cuotas.filter((c) => c.estado === 'vencida');
  const sig = cuotas.find((c) => c.estado !== 'pagada');
  let pendXs = 'Sin cuotas pendientes';
  if (vencidas.length) pendXs = `${enumerar(vencidas.map((c) => c.n))} vencida${vencidas.length > 1 ? 's' : ''}${vencidas[0].vence ? ' el ' + fecha(vencidas[0].vence) : ''}`;
  else if (sig) pendXs = `cuota ${sig.n} · ${sig.estado === 'al_terminar' ? 'vence al terminar el trabajo' : 'vence el ' + fecha(sig.vence)}`;
  const f = p.factura && typeof p.factura === 'object' && !p.factura.sin_permiso ? texto(p.factura.folio, 20) : null;
  return {
    total, pagado, pendiente, vencido: pesos(p.vencido) ?? 0,
    cuotas: Number.isInteger(p.cuotas_total) ? p.cuotas_total : cuotas.length,
    pagado_xs: pagadas.length ? enumerar(pagadas) : 'Aún sin pagos registrados',
    pendiente_xs: pendXs,
    folio: f,
  };
}

/** Respuesta de mc.trabajos → sección 'trabajos' que leen las pantallas. Lo que no se entiende, no se muestra. */
export function normalizarTrabajos(j) {
  const sec = j && j.ok === true ? j.seccion : null;
  if (!sec || sec.disponible !== true || !sec.datos || typeof sec.datos !== 'object') return { disponible: false };
  const activos = (Array.isArray(sec.datos.activos) ? sec.datos.activos : [])
    .filter((t) => t && typeof t === 'object' && /^TE-\d{4}-\d{3,6}$/.test(String(t.codigo)))
    .slice(0, 50)
    .map((t) => {
      const av = Number.isFinite(t.avance) ? Math.max(0, Math.min(100, Math.round(t.avance))) : null;
      return {
        codigo: String(t.codigo),
        estado: ESTADO_TE[t.etapa] || 'En curso',
        servicio: texto(t.servicio, 120) || 'Trabajo especial',
        responsable: texto(t.responsable, 40),
        avance: av,
        pasos: (Array.isArray(t.pasos) ? t.pasos : []).filter((x) => x && texto(x.t, 500))
          .map((x) => ({ t: texto(x.t, 500), e: x.e === 'ok' ? 'ok' : x.e === 'act' ? 'act' : '' })),
        proximo: texto(t.proximo, 500),
        pago: pagoTrabajo(t.pago),
        documentos: (Array.isArray(t.documentos) ? t.documentos : []).filter((d) => d && texto(d.t, 200))
          .map((d) => ({ t: texto(d.t, 200), fecha: d.fecha ?? null, url: typeof d.url === 'string' ? d.url : null })),
        documentos_retenidos: t.documentos_retenidos === true,
      };
    });
  const term = Number.isInteger(sec.datos.terminados) && sec.datos.terminados > 0 ? sec.datos.terminados : 0;
  return { disponible: true, datos: { activos, terminados: term } };
}

/** Devuelve una COPIA del resumen con la sección trabajos tomada de mc.trabajos (MC-5). Sin permiso o bloqueada: no se toca. */
export function conTrabajos(resumen, respuesta) {
  if (!resumen || typeof resumen !== 'object') return resumen;
  const e = estadoSeccion(resumen.secciones?.trabajos);
  if (e === 'sin_permiso' || e === 'bloqueada') return resumen;
  const sec = respuesta === 'error' ? { disponible: false, error: true } : normalizarTrabajos(respuesta);
  return { ...resumen, secciones: { ...(resumen.secciones || {}), trabajos: sec } };
}
