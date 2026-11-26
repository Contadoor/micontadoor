// REPORTE-AUTO C · el reporte cerrado (mc.mi_reporte) en el portal. Datos ficticios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demo } from '../js/demo.js';
import { permisos, conReporte, normalizarReporte, datosDe, textoAvisoReporte, textoSituacionF29 } from '../js/datos.js';
import { CONFIG } from '../js/config.js';
import { vInicio, vReporte, vHistorial } from '../js/vistas-reporte.js';

const MALO = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
const base = () => ({ ok: true, ref: 'x', seccion: { disponible: true, datos: { periodo: '2026-10', version: 1, enviado_at: '2026-11-21T15:00:00Z', validado: true,
  obligaciones: [{ id: 'f29-2026-10', concepto: 'Impuestos del mes (F29)', periodo: '2026-10', monto: 993269, vence: '2026-11-20', estado: 'por_pagar' }],
  calculo: [{ t: 'IVA de tus ventas', xs: 'débito fiscal del mes', monto: 1900000 }, { t: 'Impuesto único de trabajadores', xs: 'se agrega cuando RR. HH. quede listo', texto: 'Pendiente' }],
  total_f29: 993269, rrhh: { estado: 'listo' }, servicios: null, comentario: 'NOTA INTERNA',
  avisos: [{ codigo: 'F29_DECLARADO', periodos: ['2026-01', '2026-02'] }, { codigo: 'F29_SIN_DECLARAR', periodos: ['2026-05', '2026-06'] }, { codigo: 'F29_OBSERVADO', periodos: ['2026-03'] },
           { codigo: 'SII_OBSERVACIONES', cartas: 2, cumple: false, f22: 0, titulo: 'TEXTO DE LA CARTA' }, { codigo: 'FACTURA_NO_EMITIDA', mensaje: 'interno' },
           { codigo: 'RRHH_PENDIENTE' }, { codigo: 'OTRO_INTERNO', motivo: 'x' }],
  historial: [{ periodo: '2026-10', enviado_at: '2026-11-21T15:00:00Z', f29: 993269 }] } } });

test('normalizarReporte: fail-closed (sin validar, período raro o ok:false → no publicado)', () => {
  assert.deepEqual(normalizarReporte({ ok: false, codigo: 'MC_SIN_ACCESO' }), { disponible: false });
  assert.deepEqual(normalizarReporte({ ok: true, seccion: { disponible: false } }), { disponible: false });
  const a = base(); a.seccion.datos.validado = false; assert.equal(normalizarReporte(a).disponible, false);
  const b = base(); b.seccion.datos.periodo = '202610'; assert.equal(normalizarReporte(b).disponible, false);
});
test('normalizarReporte: solo lo del contrato (sin comentario ni avisos desconocidos); IU «Pendiente»', () => {
  const n = normalizarReporte(base());
  assert.equal(n.disponible, true); assert.equal(n.datos.validado, true);
  assert.equal(n.datos.comentario, undefined, 'el portal nunca muestra notas internas');
  assert.deepEqual(n.datos.avisos.map((a) => a.codigo), ['F29_DECLARADO', 'F29_SIN_DECLARAR', 'F29_OBSERVADO', 'SII_OBSERVACIONES'], 'factura y otros internos fuera');
  assert.deepEqual(n.datos.avisos[3], { codigo: 'SII_OBSERVACIONES', cartas: 2, cumple: false, f22: 0 }, 'sin texto de la carta');
  assert.equal(n.datos.calculo[1].texto, 'Pendiente');
  assert.equal(n.datos.obligaciones[0].monto, 993269);
});
test('textoAvisoReporte: lo declarado, lo no declarado y lo observado', () => {
  assert.match(textoAvisoReporte({ codigo: 'F29_SIN_DECLARAR', periodos: ['2026-05', '2026-06'] }), /^Hay F29 sin declarar: Mayo 2026, Junio 2026\./);
  assert.match(textoAvisoReporte({ codigo: 'F29_DECLARADO', periodos: ['2026-01'] }), /^F29 declarados en el SII: Enero 2026\./);
  assert.match(textoAvisoReporte({ codigo: 'F29_OBSERVADO', periodos: ['2026-03'] }), /^El SII observó el F29 de: Marzo 2026\./);
  assert.match(textoAvisoReporte({ codigo: 'SII_OBSERVACIONES', cartas: 1, cumple: false, f22: 0 }), /1 carta o notificación.*«no cumple»/);
  assert.equal(textoAvisoReporte({ codigo: 'SII_OBSERVACIONES', cartas: 0, cumple: null, f22: 0 }), null);
});
test('conReporte reemplaza la sección; sin permiso no se toca; error → aún no publicado', () => {
  const r = demo.resumen(demo.refs.rio);
  const c = conReporte(r, base());
  assert.equal(datosDe(c, 'reporte').total_f29, 993269);
  assert.equal(permisos(c).verReporte, true);
  assert.equal(datosDe(conReporte(r, 'error'), 'reporte'), null);
  const sp = { ...r, secciones: { ...r.secciones, reporte: { sin_permiso: true } } };
  assert.equal(conReporte(sp, base()), sp);
});
function ctx(resumen) {
  const sesion = demo.sesion();
  return { cfg: CONFIG, api: { modo: 'demo', capacidades: {} }, sesion, empresa: sesion.empresas[0], resumen, perm: permisos(resumen), tema: 'oscuro', version: 'x',
    abiertos: new Set(), solicitudes: new Set(), waMejora: 'https://wa.me/1', waEquipo: 'https://wa.me/1', enlaceDoc: () => null };
}
test('vReporte: «Validado por Contadoor», avisos y sin notas internas', () => {
  const s = String(vReporte(ctx(conReporte(demo.resumen(demo.refs.rio), base()))));
  assert.ok(s.includes('Validado por Contadoor'));
  assert.ok(s.includes('Hay F29 sin declarar: Mayo 2026, Junio 2026'));
  assert.ok(s.includes('El SII observó el F29 de: Marzo 2026') && s.includes('F29 declarados en el SII'));
  assert.ok(!s.includes('TEXTO DE LA CARTA') && !s.includes('interno'));
  assert.ok(!s.includes('NOTA INTERNA') && !s.includes('Comentario de tu analista'));
  assert.ok(s.includes('Validado y cerrado por tu equipo Contadoor'));
});
test('vReporte / vInicio / vHistorial escapan HTML de la foto', () => {
  const j = base(); const d = j.seccion.datos;
  d.obligaciones[0].concepto += MALO; d.calculo[0].t += MALO; d.calculo[0].xs += MALO;
  const c = ctx(conReporte(demo.resumen(demo.refs.rio), j));
  for (const s of [vReporte(c), vInicio(c), vHistorial(c)].map(String)) { assert.ok(!s.includes('<script>')); assert.ok(!/<img src=x/.test(s)); }
});
test('demo.reporte: Aromos con lo que ve del SII; consulta sin Nuestros servicios', () => {
  const a = normalizarReporte(demo.reporte(demo.refs.aromos));
  assert.deepEqual(a.datos.avisos.map((x) => x.codigo), ['F29_DECLARADO', 'F29_SIN_DECLARAR', 'SII_OBSERVACIONES']);
  assert.equal(normalizarReporte(demo.reporte(demo.refs.rio, { rol: 'consulta' })).datos.servicios, null);
  assert.ok(normalizarReporte(demo.reporte(demo.refs.rio)).datos.servicios.monto > 0);
});
test('CONFIG.RPC.REPORTE apunta a mi_reporte (publicar solo con la migración C instalada)', () => { assert.equal(CONFIG.RPC.REPORTE, 'mi_reporte'); });
test('pagado solo si todas las obligaciones del mes vienen pagadas (Río demo: Pagado ✓ $830.000)', () => {
  const n = normalizarReporte(demo.reporte(demo.refs.rio));
  assert.equal(n.datos.pagado, true); assert.equal(n.datos.total_pagado_mes, 830000);
  assert.equal(normalizarReporte(base()).datos.pagado, false);
});
// ── R2 (dictamen 19-11) ──
test('R2 · AUTO-C01: foto al cierre y situación actual separadas; lista blanca de campos', () => {
  const j = base(); const d = j.seccion.datos;
  d.foto = { al_cierre: true, cerrado_at: '2026-11-21T15:00:00Z', version: 1, cerrado_por: 'NOMBRE INTERNO' };
  d.situacion_actual = { consultado_en: '2026-11-25T10:00:00Z', periodo: '2026-10', f29_estado: 'declarado', f29_vence: '2026-11-20', interno: 'x' };
  const n = normalizarReporte(j);
  assert.deepEqual(n.datos.situacion_actual, { consultado_en: '2026-11-25T10:00:00Z', periodo: '2026-10', f29_estado: 'declarado', f29_vence: '2026-11-20' });
  assert.equal(n.datos.cerrado_at, '2026-11-21T15:00:00Z');
  assert.ok(!JSON.stringify(n).includes('NOMBRE INTERNO'));
  const s = String(vReporte(ctx(conReporte(demo.resumen(demo.refs.rio), j))));
  assert.ok(s.includes('Según el SII al cierre del') && s.includes('Hoy en el SII') && s.includes('Declarado en el SII ✓'));
  assert.ok(s.includes('queda tal como se validó al cierre'));
});
test('R2 · situación actual con estado desconocido o con HTML → no se muestra (fail-closed)', () => {
  const j = base(); j.seccion.datos.situacion_actual = { consultado_en: 'x', periodo: '2026-10', f29_estado: '<script>alert(1)</script>' };
  assert.equal(normalizarReporte(j).datos.situacion_actual, null);
  assert.ok(!String(vReporte(ctx(conReporte(demo.resumen(demo.refs.rio), j)))).includes('Hoy en el SII'));
});
test('R2 · AUTO-C02/C03: aviso de estado por verificar y textos de la situación (no encontrado ≠ no declarado)', () => {
  const j = base(); j.seccion.datos.avisos.push({ codigo: 'F29_ESTADO_SIN_VERIFICAR', periodos: ['2026-09'] }, { codigo: 'F29_NO_ENCONTRADO', periodos: ['2026-08'] });
  const n = normalizarReporte(j);
  assert.ok(n.datos.avisos.some((a) => a.codigo === 'F29_ESTADO_SIN_VERIFICAR'));
  assert.ok(!n.datos.avisos.some((a) => a.codigo === 'F29_NO_ENCONTRADO'), 'no encontrado es interno: no llega al cliente');
  assert.match(textoAvisoReporte({ codigo: 'F29_ESTADO_SIN_VERIFICAR', periodos: ['2026-09'] }), /verificando: Septiembre 2026/);
  assert.match(textoSituacionF29('no_encontrado'), /verificando/);
  assert.equal(textoSituacionF29('no_declarado'), 'No declarado');
  assert.equal(textoSituacionF29('raro'), null);
});

// REPORTE-AUTO R3 (flujo 19-11): el reporte se cierra en Contable después de validar el IVA. Una empresa NO conectada al SII (validada
// con libros) llega sin avisos del SII ni situación de hoy: el portal muestra igual el reporte validado, sin inventar «Según el SII».
test('R3 · reporte validado en Contable de una empresa sin SII: «Validado por Contadoor» sin avisos del SII', () => {
  const j = base(); j.seccion.datos.avisos = []; delete j.seccion.datos.situacion_actual;
  const n = normalizarReporte(j);
  assert.equal(n.disponible, true); assert.deepEqual(n.datos.avisos, []);
  const s = String(vReporte(ctx(conReporte(demo.resumen(demo.refs.rio), j))));
  assert.ok(s.includes('Validado por Contadoor'));
  assert.ok(!s.includes('Según el SII al cierre') && !s.includes('Hoy en el SII'));
  assert.ok(!/Pre-IVA|pasar al reporte/i.test(s), 'el reporte cerrado no habla del Pre-IVA');
});

test('R4 · D6/D5: reporte reabierto → «Información en revisión» sin montos; RR. HH. confirmado al cerrar → «Estamos verificando…»', async () => {
  const { normalizarReporte } = await import('../js/datos.js');
  const er = normalizarReporte({ ok: true, seccion: { disponible: false, estado: 'en_revision', periodo: '2026-10' } });
  assert.deepEqual(er, { disponible: false, en_revision: true, periodo: '2026-10' });
  assert.deepEqual(normalizarReporte({ ok: true, seccion: { disponible: false, estado: 'en_revision', periodo: 'x' } }), { disponible: false });
  const { vReporte } = await import('../js/vistas-reporte.js');
  const s = String(vReporte({ resumen: { secciones: { reporte: er } }, perm: {}, enlaceDoc: () => null }));
  assert.ok(s.includes('Información en revisión') && s.includes('octubre') && !/\$\d/.test(s));
  const j = { ok: true, seccion: { disponible: true, datos: { periodo: '2026-10', validado: true, enviado_at: '2026-11-14T15:30:00Z', obligaciones: [], calculo: [], total_f29: 10000, rrhh: { estado: 'verificando' }, avisos: [], historial: [] } } };
  const n = normalizarReporte(j);
  assert.equal(n.datos.rrhh, 'verificando');
  const v = String(vReporte({ resumen: { secciones: { reporte: n } }, perm: {}, enlaceDoc: () => null }));
  assert.ok(v.includes('Estamos verificando la información de este período'));
});
