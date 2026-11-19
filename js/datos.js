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
import { UUID, pesos, parsePeriodo, comparaPeriodo, clp, fecha, periodoTitulo } from './util.js';

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
    case 'MC_TERMINOS_VERSION': return 'Los términos se actualizaron mientras los leías. Revisa la versión nueva y vuelve a aceptar.';
    case 'MC_LIMITE': return 'Ya nos enviaste varias solicitudes hoy. Si es urgente, escríbenos por WhatsApp.';
    case 'MC_DATOS': return 'Revisa los datos e inténtalo de nuevo.';
    case 'TERMINOS_HUELLA': return 'No pudimos comprobar el texto de los términos. Por seguridad no se pueden aceptar ahora; inténtalo de nuevo en unos minutos.';
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

// ── Tu IVA del mes (MC-IMP-1) ─────────────────────────────────────────────────────────────────────────────────
// Contrato (gestoor-backend, 202611191200_mc_mis_impuestos.sql): mc.mis_impuestos(p_ref, p_periodo?) →
//   { ok, ref, periodo:'AAAAMM', bloqueada? , conexion:{estado:'conectado'|'no_conectado'}, datos_al, cobertura_completa, vence,
//     estimacion:{debito, credito, ventas_neto, ventas_exento, ventas_documentos, compras_documentos, compras_neto, compras_exento, compras_pendientes:{documentos,iva}|null,
//                 remanente:{monto,cod77,periodo,utm_origen,utm_destino}|null, remanente_motivo, ppm_base, ppm_tasa, ppm_tasa_fuente, ppm,
//                 iva_determinado, iva_pagar, remanente_siguiente, total, exenta},
//     oficial:{fuente:'reporte', total, debito, credito, remanente, ppm, confirmado_en}|null   (MC-IMP-1b: solo el reporte),
//     preiva_enviado:{total, debito, credito, remanente, ppm, enviado_en}|null   (sin reporte: Pre-IVA enviado por el analista),
//     f29:[{periodo:'AAAAMM', estado, vence, total}], observaciones:{ items:[{tipo, periodo|anio_tributario, codigo, texto}],
//       cartas:{disponible, total_12_meses?, items?:[{categoria:'carta'|'notificacion', titulo, fecha, remitente, plazo, nueva}]},   (SII-OBS-2)
//       cumplimiento:{disponible, cumple?, estado?, actualizado_en?, condiciones?:[{titulo, cumple}]} } }                        (SII-OBS-2)
// R2 (AUTO-C02/C03): 'sin_verificar' = declarado con una letra del SII fuera de la clasificación; 'no_encontrado' = no aparece en una
// lectura hecha antes del vencimiento (se verifica; no es «no declarado»).
const ESTADOS_F29 = new Set(['declarado', 'en_revision', 'observado', 'sin_verificar', 'no_declarado', 'no_encontrado', 'por_declarar', 'sin_dato']);
const TIPOS_OBS = new Set(['f29_observado', 'f29_en_revision', 'f29_no_declarado', 'f22_observacion']);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const AAAAMM = /^(20\d{2})(0[1-9]|1[0-2])$/;
/** 'AAAAMM' → 'AAAA-MM' (el formato que usa el resto del portal) o null. */
export function periodoGuion(p) { const m = AAAAMM.exec(String(p ?? '')); return m ? `${m[1]}-${m[2]}` : null; }
const fechaOk = (v) => (typeof v === 'string' && (FECHA.test(v) || !Number.isNaN(Date.parse(v))) ? v : null);
const num = (v) => { if (v === null || v === undefined || v === '') return null; const x = Number(v); return Number.isFinite(x) ? x : null; };

/** Respuesta de mc.mis_impuestos → forma de pantalla. Fail-closed: lo que no se entiende queda en null y no se muestra. */
export function normalizarImpuestos(j) {
  if (!j || j.ok !== true) return { estado: 'error' };
  const periodo = periodoGuion(j.periodo);
  if (!periodo) return { estado: 'error' };
  if (j.bloqueada === true) return { estado: 'bloqueada', periodo };
  // MANDA EL REPORTE (Luciano 19-11): solo el reporte cerrado/enviado es oficial («Validado por Contadoor»).
  // Sin reporte: el Pre-IVA enviado por el analista (si existe) sigue siendo una estimación. El F29 declarado en el SII
  // nunca es el monto principal (MC-IMP-1 lo mandaba como 'sii_declarado': se ignora por si el portal llega antes que MC-IMP-1b).
  const of = j.oficial && typeof j.oficial === 'object' && j.oficial.fuente === 'reporte' && pesos(j.oficial.total) !== null
    ? { fuente: 'reporte', total: pesos(j.oficial.total), debito: pesos(j.oficial.debito), credito: pesos(j.oficial.credito),
        remanente: pesos(j.oficial.remanente), ppm: pesos(j.oficial.ppm), confirmado_en: fechaOk(j.oficial.confirmado_en) } : null;
  const pj = j.preiva_enviado && typeof j.preiva_enviado === 'object' ? j.preiva_enviado
    : (j.oficial?.fuente === 'preiva' ? { total: j.oficial.total, enviado_en: j.oficial.confirmado_en } : null);
  const preiva = !of && pj && pesos(pj.total) !== null ? { total: pesos(pj.total), enviado_en: fechaOk(pj.enviado_en) } : null;
  const vence = fechaOk(j.vence);
  if (j.conexion?.estado !== 'conectado') return { estado: 'no_conectado', periodo, vence, oficial: of, preiva };
  const e = j.estimacion && typeof j.estimacion === 'object' ? j.estimacion : {};
  const cp = e.compras_pendientes && typeof e.compras_pendientes === 'object' ? e.compras_pendientes : null;
  const rem = e.remanente && typeof e.remanente === 'object' && pesos(e.remanente.monto) !== null
    ? { monto: pesos(e.remanente.monto), cod77: pesos(e.remanente.cod77), periodo: periodoGuion(e.remanente.periodo) } : null;
  const est = {
    debito: pesos(e.debito), credito: pesos(e.credito), ventas_neto: pesos(e.ventas_neto), ventas_exento: pesos(e.ventas_exento),
    ventas_documentos: Number.isInteger(e.ventas_documentos) ? e.ventas_documentos : null,
    compras_documentos: Number.isInteger(e.compras_documentos) ? e.compras_documentos : null,
    compras_neto: pesos(e.compras_neto), compras_exento: pesos(e.compras_exento),
    compras_pendientes: cp && Number.isInteger(cp.documentos) && cp.documentos > 0 ? { documentos: cp.documentos, iva: pesos(cp.iva) } : null,
    remanente: rem, remanente_motivo: typeof e.remanente_motivo === 'string' ? e.remanente_motivo.slice(0, 40) : null,
    ppm_base: pesos(e.ppm_base), ppm_tasa: num(e.ppm_tasa), ppm: pesos(e.ppm),
    iva_determinado: pesos(e.iva_determinado), iva_pagar: pesos(e.iva_pagar), remanente_siguiente: pesos(e.remanente_siguiente),
    total: pesos(e.total), exenta: e.exenta === true,
  };
  const f29 = (Array.isArray(j.f29) ? j.f29 : []).filter((x) => x && AAAAMM.test(String(x.periodo)) && ESTADOS_F29.has(x.estado)).slice(0, 12)
    .map((x) => ({ periodo: periodoGuion(x.periodo), estado: x.estado, vence: fechaOk(x.vence), total: pesos(x.total) }));
  const items = (Array.isArray(j.observaciones?.items) ? j.observaciones.items : []).filter((x) => x && TIPOS_OBS.has(x.tipo)).slice(0, 12)
    .map((x) => ({ tipo: x.tipo, periodo: periodoGuion(x.periodo), anio: Number.isInteger(x.anio_tributario) ? x.anio_tributario : null,
                   codigo: texto(x.codigo, 20), texto: texto(x.texto, 200) }));
  return {
    estado: 'ok', periodo, vence, datos_al: fechaOk(j.datos_al), cobertura_completa: j.cobertura_completa === true,
    est, oficial: of, preiva, f29, obs: { items, cartas: normalizarCartas(j.observaciones?.cartas), cumplimiento: normalizarCumplimiento(j.observaciones?.cumplimiento) },
  };
}

// SII-OBS-2: cartas y notificaciones del SII (lista blanca) y situación de cumplimiento. Fail-closed: lo que no se entiende no se muestra.
const CATEGORIAS_CARTA = new Set(['carta', 'notificacion']);
export function normalizarCartas(c) {
  if (!c || typeof c !== 'object' || c.disponible !== true) return { disponible: false, total: 0, items: [] };
  const items = (Array.isArray(c.items) ? c.items : []).filter((x) => x && CATEGORIAS_CARTA.has(x.categoria) && texto(x.titulo, 200)).slice(0, 5)
    .map((x) => ({ categoria: x.categoria, titulo: texto(x.titulo, 200), fecha: fechaOk(x.fecha), remitente: texto(x.remitente, 120), plazo: texto(x.plazo, 120), nueva: x.nueva === true }));
  const total = Number.isInteger(c.total_12_meses) && c.total_12_meses >= items.length ? c.total_12_meses : items.length;
  return { disponible: true, total, items };
}
export function normalizarCumplimiento(u) {
  if (!u || typeof u !== 'object' || u.disponible !== true || typeof u.cumple !== 'boolean') return { disponible: false };
  const condiciones = (Array.isArray(u.condiciones) ? u.condiciones : []).filter((x) => x && texto(x.titulo, 160)).slice(0, 10)
    .map((x) => ({ titulo: texto(x.titulo, 160), cumple: typeof x.cumple === 'boolean' ? x.cumple : null }));
  return { disponible: true, cumple: u.cumple, estado: texto(u.estado, 120), condiciones };
}

/** Monto principal: el del reporte validado; si no, el Pre-IVA enviado por el analista; si no, el cálculo con datos del SII (null = «Por confirmar»). */
export function totalMostrado(n) { return n?.oficial ? n.oficial.total : n?.preiva ? n.preiva.total : (n?.est?.total ?? null); }
/** true = el reporte del período está cerrado/enviado («IVA del mes · Validado por Contadoor»); false = «Pre-IVA del mes · Estimado con datos del SII». */
export function validado(n) { return !!n?.oficial; }

// Umbrales del motor de recomendaciones del Pre-IVA (Contadoor.app pre-iva/recomendaciones.js, CONFIG de piloto):
// minImpacto $50.000 · IVA sobre el promedio +15 % con ≥ 4 meses · aviso de pago con ≤ 5 días al vencimiento · máximo 4 (aquí 3).
export const RECO = Object.freeze({ minImpacto: 50000, sobrePromedioPct: 0.15, minMesesPromedio: 4, vencCercanoDias: 5, max: 3 });
const dias = (a, b) => { const x = Date.parse(a + 'T00:00:00Z'); const y = Date.parse(b + 'T00:00:00Z'); return Number.isFinite(x) && Number.isFinite(y) ? Math.round((x - y) / 864e5) : null; };

/**
 * Recomendaciones para el cliente con SUS datos del SII. Si falta un dato, la regla no se dispara (nunca relleno).
 * Cada una: pregunta, lo detectado (con cifra), lo que significa (en pesos), qué hacer (con plazo) y quién lo hace.
 * hoy = 'AAAA-MM-DD' (fecha de Chile).
 */
export function recomendacionesImpuestos(n, hoy) {
  if (!n || n.estado !== 'ok') return [];
  const out = [];
  const total = totalMostrado(n);
  const declarado = n.f29.find((x) => x.periodo === n.periodo)?.estado === 'declarado';
  const plazo = n.vence ? fecha(n.vence) : null;
  // 1. Reserva: el total del mes está sobre el promedio de los F29 declarados de meses anteriores.
  const prev = n.f29.filter((x) => x.periodo !== n.periodo && x.estado === 'declarado' && x.total !== null && x.total > 0).map((x) => x.total);
  let reserva = false;
  if (!declarado && total !== null && prev.length >= RECO.minMesesPromedio) {
    const prom = Math.round(prev.reduce((s, x) => s + x, 0) / prev.length);
    const dif = total - prom;
    if (total >= prom * (1 + RECO.sobrePromedioPct) && dif >= RECO.minImpacto) {
      reserva = true;
      out.push({ id: 'reserva', color: 'ambar', impacto: dif, q: '¿Cuánto debo reservar este mes?',
        detectado: `Tu F29 de este mes (${clp(total)}) está ${Math.round((dif / prom) * 100)} % sobre tu promedio de ${prev.length} meses (${clp(prom)}).`,
        significa: `${clp(dif)} más que en un mes normal.`,
        accion: `Reserva ${clp(total)}${plazo ? ' antes del ' + plazo : ''} para pagar sin atrasos.`, quien: 'tu', plazo });
    }
  }
  // 2. Facturas de compra pendientes de aceptar en el SII (no suman crédito mientras estén pendientes).
  const cp = n.est.compras_pendientes;
  if (cp && cp.iva !== null && cp.iva >= RECO.minImpacto) {
    out.push({ id: 'pendientes', color: 'verde', impacto: cp.iva, q: '¿Qué facturas de compra debo revisar?',
      detectado: `Tienes ${cp.documentos} factura${cp.documentos > 1 ? 's' : ''} de proveedores pendiente${cp.documentos > 1 ? 's' : ''} en el SII, con ${clp(cp.iva)} de IVA.`,
      significa: `${clp(cp.iva)} de IVA que hoy no está bajando tu impuesto.`,
      accion: 'Revisa que correspondan a compras de tu empresa; si alguna no corresponde, avísanos para reclamarla a tiempo.', quien: 'tu', plazo: null });
  }
  // 3. Pago cercano (solo si no se disparó la reserva, para no repetir).
  const d = n.vence && hoy ? dias(n.vence, hoy) : null;
  if (!reserva && !declarado && total !== null && total > 0 && d !== null && d >= 0 && d <= RECO.vencCercanoDias) {
    out.push({ id: 'vencimiento', color: 'morado', impacto: total, q: '¿Cuándo debo pagar?',
      detectado: `Tu F29 vence el ${plazo} (${d === 0 ? 'hoy' : d === 1 ? 'mañana' : 'en ' + d + ' días'}).`,
      significa: `${clp(total)} a pagar ese día.`,
      accion: `Ten disponibles ${clp(total)} antes del ${plazo}.`, quien: 'tu', plazo });
  }
  return out.sort((a, b) => b.impacto - a.impacto).slice(0, RECO.max);
}

// ── MICONTADOOR-APERTURA (24-11): términos versionados, soporte e incorporación ──────────────────────────────────────
// Contrato: descargas/micontadoor_apertura/CONTRATO_DATOS.md (sección B).
const FECHA_V = /^\d{4}-\d{2}-\d{2}$/;
const HEX64 = /^[0-9a-f]{64}$/;

/** mc.terminos_vigentes / mc.terminos_texto → {version, titulo, texto, sha256} o null (fail-closed). */
export function normalizarTerminos(j) {
  if (!j || j.ok !== true) return null;
  if (!FECHA_V.test(String(j.version ?? '')) || typeof j.texto !== 'string' || !j.texto.trim() || j.texto.length > 60000) return null;
  if (!HEX64.test(String(j.sha256 ?? ''))) return null;
  return { version: j.version, titulo: String(j.titulo ?? 'Términos de uso y aviso de privacidad de MiContadoor').slice(0, 160), texto: j.texto, sha256: j.sha256 };
}

/** Texto de los términos en bloques: párrafos separados por línea en blanco; «## » al inicio = subtítulo. */
export function bloquesTerminos(texto) {
  return String(texto ?? '').replace(/\r\n?/g, '\n').split(/\n{2,}/).map((x) => x.trim()).filter(Boolean)
    .map((x) => (x.startsWith('## ') ? { tipo: 'subtitulo', texto: x.slice(3).trim() } : { tipo: 'parrafo', texto: x }));
}

/** mc.mis_terminos → lista de aceptaciones válidas (más reciente primero). */
export function normalizarMisTerminos(j) {
  if (!j || j.ok !== true || !Array.isArray(j.aceptaciones)) return null;
  return j.aceptaciones.filter((a) => a && FECHA_V.test(String(a.version ?? '')) && HEX64.test(String(a.sha256 ?? '')))
    .map((a) => ({ version: a.version, sha256: a.sha256, aceptada_at: String(a.aceptada_at ?? '') }))
    .sort((a, b) => String(b.aceptada_at).localeCompare(String(a.aceptada_at)));
}

export const TIPOS_SOPORTE = Object.freeze([
  ['consulta', 'Tengo una consulta'], ['acceso', 'No puedo entrar o algo no carga'], ['datos', 'Veo un dato que no me cuadra'],
  ['seguridad', 'Algo raro con mi cuenta'], ['otro', 'Otra cosa'],
]);
export const ESTADOS_SOLICITUD = Object.freeze({ abierta: ['c-pend', 'Recibida'], en_curso: ['c-rev', 'En revisión'], cerrada: ['c-ok', 'Resuelta'] });

/** Valida el formulario «Cuéntanos qué pasa». Devuelve el mensaje de error o null. */
export function validarSoporte(tipo, mensaje) {
  if (!TIPOS_SOPORTE.some(([t]) => t === tipo)) return 'Elige de qué se trata.';
  const m = String(mensaje ?? '').trim();
  if (m.length < 10) return 'Cuéntanos un poco más (al menos 10 caracteres).';
  if (m.length > 1000) return 'El mensaje es muy largo (máximo 1.000 caracteres).';
  return null;
}

/** mc.mis_solicitudes → lista; estados desconocidos se muestran como «Recibida». */
export function normalizarSolicitudes(j) {
  if (!j || j.ok !== true || !Array.isArray(j.solicitudes)) return null;
  return j.solicitudes.filter((x) => x && /^MC-\d{4}-\d{1,8}$/.test(String(x.folio ?? ''))).map((x) => ({
    folio: x.folio, tipo: TIPOS_SOPORTE.some(([t]) => t === x.tipo) ? x.tipo : 'otro',
    estado: Object.hasOwn(ESTADOS_SOLICITUD, x.estado) ? x.estado : 'abierta',
    creada_at: String(x.creada_at ?? ''), actualizada_at: String(x.actualizada_at ?? ''),
  }));
}

const ESTADOS_PASO = ['listo', 'en_curso', 'pendiente', 'esperando_tu_respuesta'];
/** mc.mi_incorporacion → {estado:'ok', disponible, …} | {estado:'error'}. Nunca inventa pasos. */
export function normalizarIncorporacion(j) {
  if (!j || j.ok !== true) return { estado: 'error' };
  if (j.disponible !== true) return { estado: 'ok', disponible: false };
  const total = Number.isInteger(j.avance?.total) && j.avance.total > 0 && j.avance.total <= 30 ? j.avance.total : 10;
  const listos = Number.isInteger(j.avance?.listos) ? Math.max(0, Math.min(total, j.avance.listos)) : 0;
  const pasos = (Array.isArray(j.pasos) ? j.pasos : []).filter((p) => p && Number.isInteger(p.orden) && typeof p.titulo === 'string' && p.titulo.trim())
    .map((p) => ({ orden: p.orden, titulo: p.titulo.trim().slice(0, 140), estado: ESTADOS_PASO.includes(p.estado) ? p.estado : 'pendiente' }))
    .sort((a, b) => a.orden - b.orden);
  const terminado = j.terminado === true;
  return {
    estado: 'ok', disponible: true, terminado, total, listos,
    actual: terminado ? total : Math.min(total, listos + 1),
    fecha_reunion: FECHA_V.test(String(j.fecha_reunion ?? '')) ? j.fecha_reunion : null,
    diagnostico: { emitido: j.diagnostico?.emitido === true },
    pasos,
  };
}

// ── MC-6 · Novedades (mc.avisos(p_ref, p_limite) → { ok, no_leidos, avisos:[{id, evento, titulo, texto, ruta, creado_at, leido}] }) ──
export const EVENTOS_AVISO = { reporte_listo: 'reporte', faltan_compras: 'reporte', iva_vence: 'reporte', pago_confirmado: 'pagos', tramite_avanzo: 'trabajos', cobranza: 'pagos' };   // R3: cobranza = pagos (solo con Mi cuenta)
const RUTAS_AVISO = new Set(['inicio', 'reporte', 'cuenta', 'cuenta/pagado', 'trabajos', 'mas']);
/**
 * Fail-closed: solo eventos conocidos, rutas de la lista, ids enteros y textos acotados. Defensa en profundidad del permiso por vínculo:
 * aunque el servidor ya filtra, sin Mi cuenta los avisos de pagos NO se muestran.
 */
export function normalizarAvisos(j, perm) {
  if (!j || j.ok !== true || !Array.isArray(j.avisos)) return { noLeidos: 0, avisos: [], correo: { activo: false, disponible: false } };
  const avisos = j.avisos
    .filter((a) => a && Number.isInteger(a.id) && a.id > 0 && a.evento in EVENTOS_AVISO && (EVENTOS_AVISO[a.evento] !== 'pagos' || perm?.verMiCuenta === true))
    .map((a) => ({
      id: a.id, evento: a.evento, categoria: EVENTOS_AVISO[a.evento],
      titulo: String(a.titulo ?? '').slice(0, 120), texto: String(a.texto ?? '').slice(0, 500),
      ruta: RUTAS_AVISO.has(a.ruta) && (a.ruta.startsWith('cuenta') ? perm?.verMiCuenta === true : true) ? a.ruta : 'inicio',
      creado_at: typeof a.creado_at === 'string' ? a.creado_at : null, leido: a.leido === true,
    }));
  // R2: preferencia de correo de la cuenta (solo booleanos; sin dato = no disponible, fail-closed).
  const correo = { activo: j.correo?.activo === true, disponible: j.correo?.disponible === true };
  return { noLeidos: avisos.filter((a) => !a.leido).length, avisos, correo };
}

// ── Reporte mensual cerrado (REPORTE-AUTO C) ──────────────────────────────────────────────────────────────────
// Contrato (gestoor-backend, 202611211800_reporte_auto_c_micontadoor.sql): mc.mi_reporte(p_ref, p_periodo?) →
//   { ok, ref, seccion:{ disponible:false } | { disponible:true, datos:{ periodo:'AAAA-MM', version, enviado_at, validado:true, estado, pagado,
//       impuestos_estado, obligaciones:[{id, concepto, periodo, monto, vence|null, estado}], calculo:[{t, xs?, monto?|texto?, resta?, info?}],
//       total_f29, rrhh:{estado:'listo'|'pendiente'|'no_aplica'}, servicios:{folio, monto, estado:'emitida'}|null,
//       avisos:[{codigo:'F29_DECLARADO'|'F29_SIN_DECLARAR'|'F29_OBSERVADO'|'F29_EN_REVISION', periodos}
//               | {codigo:'F29_ESTADO_SIN_VERIFICAR', periodos} | {codigo:'SII_OBSERVACIONES', cartas, cumple, f22} | {codigo:'IU_PENDIENTE_RRHH'}],
//       historial:[{periodo, enviado_at, f29}],
//       foto:{al_cierre:true, cerrado_at, version},                                    (R2 · AUTO-C01: todo lo anterior es la foto del cierre)
//       situacion_actual:{consultado_en, periodo, f29_estado, f29_vence} } } }         (R2 · AUTO-C01: el F29 de ese período HOY en el SII)
//   Es la FOTO que guardó el analista al cerrar: no cambia aunque después cambien los datos. Sin notas internas.
//   Decisión de Luciano 19-11: el cliente ve TODO lo del SII (lo declarado, lo no declarado y lo observado).
const AVISOS_REPORTE = new Set(['F29_DECLARADO', 'F29_SIN_DECLARAR', 'F29_OBSERVADO', 'F29_EN_REVISION', 'F29_ESTADO_SIN_VERIFICAR', 'SII_OBSERVACIONES', 'IU_PENDIENTE_RRHH']);
const entero = (n) => (Number.isInteger(n) && n >= 0 && n <= 9999 ? n : 0);
const ESTADOS_OBLIG = new Set(['por_pagar', 'pagada', 'atrasada', 'anulada']);
const PER_GUION = /^(20\d{2})-(0[1-9]|1[0-2])$/;
/** Respuesta de mc.mi_reporte → sección 'reporte' que leen las pantallas. Fail-closed: lo que no se entiende, no se muestra. */
export function normalizarReporte(j) {
  const sec = j && j.ok === true ? j.seccion : null;
  if (!sec || sec.disponible !== true || !sec.datos || typeof sec.datos !== 'object') return { disponible: false };
  const d = sec.datos;
  if (!PER_GUION.test(String(d.periodo)) || d.validado !== true) return { disponible: false };
  const obligaciones = (Array.isArray(d.obligaciones) ? d.obligaciones : [])
    .filter((o) => o && texto(o.concepto, 80) && PER_GUION.test(String(o.periodo)) && pesos(o.monto) !== null && ESTADOS_OBLIG.has(o.estado)).slice(0, 10)
    .map((o) => ({ id: String(o.id ?? '').slice(0, 40), concepto: texto(o.concepto, 80), periodo: o.periodo, monto: pesos(o.monto),
                   vence: fechaOk(o.vence), estado: o.estado }));
  const calculo = (Array.isArray(d.calculo) ? d.calculo : []).filter((p) => p && texto(p.t, 80)).slice(0, 12).map((p) => {
    const x = { t: texto(p.t, 80) };
    if (texto(p.xs, 120)) x.xs = texto(p.xs, 120);
    if (typeof p.texto === 'string') x.texto = texto(p.texto, 40) || '—'; else x.monto = pesos(p.monto) ?? 0;
    if (p.resta === true) x.resta = true;
    return x;
  });
  const s = d.servicios && typeof d.servicios === 'object' && pesos(d.servicios.monto) !== null
    ? { folio: texto(d.servicios.folio, 60) || '—', monto: pesos(d.servicios.monto), estado: d.servicios.estado === 'pagada' ? 'pagada' : 'emitida' } : null;
  const avisos = (Array.isArray(d.avisos) ? d.avisos : []).filter((a) => a && AVISOS_REPORTE.has(a.codigo)).map((a) => (a.codigo === 'SII_OBSERVACIONES'
    ? { codigo: a.codigo, cartas: entero(a.cartas), cumple: typeof a.cumple === 'boolean' ? a.cumple : null, f22: entero(a.f22) }
    : { codigo: a.codigo, periodos: (Array.isArray(a.periodos) ? a.periodos : []).filter((p) => PER_GUION.test(String(p))).slice(0, 13) }))
    .filter((a) => a.codigo === 'SII_OBSERVACIONES' ? (a.cartas > 0 || a.cumple === false || a.f22 > 0) : a.codigo === 'IU_PENDIENTE_RRHH' || a.periodos.length > 0);
  const historial = (Array.isArray(d.historial) ? d.historial : []).filter((h) => h && PER_GUION.test(String(h.periodo))).slice(0, 12)
    .map((h) => ({ periodo: h.periodo, enviado_at: fechaOk(h.enviado_at), f29: pesos(h.f29) }));
  const rr = ['listo', 'pendiente', 'no_aplica'].includes(d.rrhh?.estado) ? d.rrhh.estado : 'pendiente';
  // AUTO-C01: la situación ACTUAL del F29 de ese período (calculada al consultar) va aparte de la foto. Lista blanca de campos.
  const sa = d.situacion_actual && typeof d.situacion_actual === 'object' && ESTADOS_F29.has(d.situacion_actual.f29_estado) && PER_GUION.test(String(d.situacion_actual.periodo))
    ? { consultado_en: fechaOk(d.situacion_actual.consultado_en), periodo: d.situacion_actual.periodo, f29_estado: d.situacion_actual.f29_estado, f29_vence: fechaOk(d.situacion_actual.f29_vence) } : null;
  // «Pagado» solo si TODAS las obligaciones del mes vienen marcadas pagadas (hoy el servidor las manda «por_pagar»: Conciliación las marcará).
  const delMes = obligaciones.filter((o) => o.periodo === d.periodo && o.estado !== 'anulada');
  const pagado = delMes.length > 0 && delMes.every((o) => o.estado === 'pagada');
  return { disponible: true, datos: {
    periodo: d.periodo, enviado_at: fechaOk(d.enviado_at), validado: true, estado: 'confirmado', pagado,
    total_pagado_mes: pagado ? delMes.reduce((x, o) => x + o.monto, 0) : null,
    obligaciones, calculo, total_f29: pesos(d.total_f29), servicios: s, avisos, historial, rrhh: rr,
    cerrado_at: fechaOk(d.foto?.cerrado_at) || fechaOk(d.enviado_at), situacion_actual: sa,
  } };
}
/** Copia del resumen con la sección 'reporte' tomada de mc.mi_reporte. Sin permiso: no se toca. Error: «aún no publicado» con aviso. */
export function conReporte(resumen, respuesta) {
  if (!resumen || typeof resumen !== 'object') return resumen;
  const e = estadoSeccion(resumen.secciones?.reporte);
  if (e === 'sin_permiso' || e === 'bloqueada') return resumen;
  const sec = respuesta === 'error' ? { disponible: false, error: true } : normalizarReporte(respuesta);
  const prev = resumen.secciones?.reporte?.datos;
  if (sec.disponible && prev && Array.isArray(prev.novedades)) sec.datos.novedades = prev.novedades;   // novedades del resumen (demo / MC-6)
  return { ...resumen, secciones: { ...(resumen.secciones || {}), reporte: sec } };
}
/** Situación ACTUAL del F29 del período (AUTO-C01/C03), en palabras para el cliente. */
export function textoSituacionF29(e) {
  return ({ declarado: 'Declarado en el SII ✓', observado: 'Con observación del SII', en_revision: 'En revisión del SII', sin_verificar: 'Declarado · estado del SII por verificar',
            por_declarar: 'Por declarar (aún en plazo)', no_declarado: 'No declarado', no_encontrado: 'No lo encontramos en el SII: lo estamos verificando',
            sin_dato: 'Aún sin dato del SII' })[e] || null;
}
/** Texto de un aviso del reporte para el cliente. */
export function textoAvisoReporte(a) {
  const meses = () => a.periodos.map((p) => periodoTitulo(p)).join(', ');
  if (a?.codigo === 'F29_DECLARADO') return `F29 declarados en el SII: ${meses()}.`;
  if (a?.codigo === 'F29_SIN_DECLARAR') return `Hay F29 sin declarar: ${meses()}. Tu equipo Contadoor te contactará para regularizarlos.`;
  if (a?.codigo === 'F29_OBSERVADO') return `El SII observó el F29 de: ${meses()}. Tu equipo Contadoor lo está revisando.`;
  if (a?.codigo === 'F29_EN_REVISION') return `F29 en revisión en el SII: ${meses()}.`;
  if (a?.codigo === 'F29_ESTADO_SIN_VERIFICAR') return `F29 declarados con un estado del SII que tu equipo Contadoor está verificando: ${meses()}.`;
  if (a?.codigo === 'SII_OBSERVACIONES') {
    const p = [];
    if (a.cartas > 0) p.push(a.cartas === 1 ? 'tienes 1 carta o notificación del SII en los últimos 12 meses' : `tienes ${a.cartas} cartas o notificaciones del SII en los últimos 12 meses`);
    if (a.cumple === false) p.push('tu situación de cumplimiento tributario figura «no cumple»');
    if (a.f22 > 0) p.push(a.f22 === 1 ? 'tu F22 tiene 1 observación' : `tu F22 tiene ${a.f22} observaciones`);
    return p.length ? `Observaciones del SII: ${p.join('; ')}. El detalle está en «Tu IVA del mes».` : null;
  }
  if (a?.codigo === 'IU_PENDIENTE_RRHH') return 'El impuesto único de tus trabajadores se agrega cuando Remuneraciones quede lista.';
  return null;
}
