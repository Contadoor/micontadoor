// REPORTE-AUTO C · el reporte cerrado (mc.mi_reporte) en el portal. Datos ficticios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demo } from '../js/demo.js';
import { permisos, conReporte, normalizarReporte, datosDe, textoAvisoReporte } from '../js/datos.js';
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
