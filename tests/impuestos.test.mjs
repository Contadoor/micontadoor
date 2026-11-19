// MC-IMP-1 «Tu IVA del mes»: normalización fail-closed, recomendaciones (solo con datos reales) y escape de TODO dato del servidor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demo } from '../js/demo.js';
import { permisos, normalizarImpuestos, recomendacionesImpuestos, totalMostrado, RECO } from '../js/datos.js';
import { CONFIG } from '../js/config.js';
import { vImpuestos, kpiImpuestos } from '../js/vistas-impuestos.js';

const MALO = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
const base = () => JSON.parse(JSON.stringify(demo.impuestos(demo.refs.rio)));
function ctx(ref = demo.refs.rio, extra = {}) {
  const resumen = demo.resumen(ref, extra);
  return { cfg: CONFIG, perm: permisos(resumen), resumen, waMejora: 'https://wa.me/1' };
}

test('normaliza la respuesta del servidor y descarta lo que no entiende', () => {
  const n = normalizarImpuestos(base());
  assert.equal(n.estado, 'ok'); assert.equal(n.periodo, '2026-10'); assert.equal(n.est.total, 898882);
  assert.equal(n.est.remanente.periodo, '2026-09'); assert.equal(n.f29.length, 6);
  assert.equal(normalizarImpuestos(null).estado, 'error');
  assert.equal(normalizarImpuestos({ ok: false, codigo: 'MC_SIN_ACCESO' }).estado, 'error');
  assert.equal(normalizarImpuestos({ ok: true, periodo: '2026-10' }).estado, 'error', 'período con guion = forma desconocida');
  const raro = base(); raro.f29.push({ periodo: '202604', estado: 'pagado_inventado', total: 1 }); raro.oficial = { fuente: 'otra', total: 5 };
  raro.observaciones.items.push({ tipo: 'carta_inventada', texto: 'x' });
  const r = normalizarImpuestos(raro);
  assert.equal(r.f29.length, 6, 'estado de F29 desconocido no se muestra'); assert.equal(r.oficial, null, 'fuente desconocida no es oficial');
  assert.equal(r.obs.items.length, 1, 'tipo de observación desconocido no se muestra');
  const sinTotal = base(); sinTotal.estimacion.total = null; sinTotal.estimacion.remanente = null;
  assert.equal(totalMostrado(normalizarImpuestos(sinTotal)), null, 'sin total = Por confirmar, nunca $0');
});

test('recomendaciones: reserva y facturas pendientes con cifras; nada si faltan datos', () => {
  const n = normalizarImpuestos(base());
  const r = recomendacionesImpuestos(n, '2026-11-10');
  assert.deepEqual(r.map((x) => x.id), ['reserva', 'pendientes'], 'ordenadas por impacto');
  assert.match(r[0].detectado, /\$898\.882/); assert.match(r[0].accion, /20-11/);
  assert.ok(r.length <= RECO.max);
  // Con menos de 4 meses declarados no hay promedio → sin reserva; a 3 días del vencimiento aparece el aviso de pago.
  const pocos = base(); pocos.f29 = pocos.f29.slice(0, 3);
  assert.deepEqual(recomendacionesImpuestos(normalizarImpuestos(pocos), '2026-11-17').map((x) => x.id), ['vencimiento', 'pendientes']);
  // Pendientes bajo el umbral del motor ($50.000) no se muestran.
  const chico = base(); chico.estimacion.compras_pendientes = { documentos: 1, iva: 9000 };
  assert.ok(!recomendacionesImpuestos(normalizarImpuestos(chico), '2026-11-10').some((x) => x.id === 'pendientes'));
  // Ya declarado: no se pide reservar ni pagar.
  const decl = base(); decl.oficial = { fuente: 'sii_declarado', total: 898882 }; decl.f29[0].estado = 'declarado';
  assert.ok(!recomendacionesImpuestos(normalizarImpuestos(decl), '2026-11-17').some((x) => ['reserva', 'vencimiento'].includes(x.id)));
  assert.deepEqual(recomendacionesImpuestos({ estado: 'no_conectado' }, '2026-11-17'), []);
});

test('la pantalla escapa todo texto del servidor', () => {
  const j = base();
  j.observaciones.items[0].texto = MALO; j.observaciones.items[0].codigo = MALO.slice(0, 18);
  const s = String(vImpuestos(ctx(), normalizarImpuestos(j))) + String(kpiImpuestos(normalizarImpuestos(j)));
  assert.ok(!s.includes('<script>') && !/<img src=x/.test(s) && !/onerror=/.test(s));
  assert.ok(s.includes('Recomendaciones para ti') && s.includes('Observaciones del SII') && s.includes('Estado de tu F29'));
  assert.ok(s.includes('Datos del SII actualizados al'));
});

test('estados: bloqueada sin cifras, no conectada sin estimación, error con aviso, oficial «Confirmado por tu analista»', () => {
  const blo = String(vImpuestos(ctx(demo.refs.aromos), normalizarImpuestos(demo.impuestos(demo.refs.aromos))));
  assert.ok(blo.includes('Mejorar mi plan') && !/\$\d/.test(blo.replace(/\$•[•.]*/g, '')), 'Cumplimiento: solo marcadores');
  const nc = String(vImpuestos(ctx(demo.refs.alerce), normalizarImpuestos(demo.impuestos(demo.refs.alerce))));
  assert.ok(nc.includes('aún no está conectada al SII') && !/\$\d/.test(nc));
  const err = String(vImpuestos(ctx(), { estado: 'error' }));
  assert.ok(err.includes('No pudimos cargar tu IVA del mes') && !/\$\d/.test(err));
  const of = base(); of.oficial = { fuente: 'reporte', total: 900000, confirmado_en: '2026-11-15T15:00:00Z' };
  const so = String(vImpuestos(ctx(), normalizarImpuestos(of)));
  assert.ok(so.includes('Confirmado por tu analista') && so.includes('$900.000'));
  const sinRem = base(); sinRem.estimacion.remanente = null; sinRem.estimacion.total = null; sinRem.estimacion.iva_pagar = null;
  const sr = String(vImpuestos(ctx(), normalizarImpuestos(sinRem)));
  assert.ok(sr.includes('Por confirmar') && !sr.includes('$0<'), 'sin remanente: por confirmar');
});
