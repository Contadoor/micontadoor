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
  const decl = base(); decl.f29[0].estado = 'declarado';
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

test('etiquetas del monto (Luciano 19-11): Pre-IVA estimado antes del cierre, IVA validado con reporte; el F29 del SII solo informativo', () => {
  const est = String(vImpuestos(ctx(), normalizarImpuestos(base())));
  assert.ok(est.includes('Pre-IVA de octubre') && est.includes('Estimado con datos del SII') && !est.includes('Validado por Contadoor'));
  assert.ok(est.includes('Declarado en el SII ✓'), 'el estado del F29 muestra lo declarado en el SII');
  // Reporte cerrado → «IVA de octubre · Validado por Contadoor» con el monto del reporte y su detalle.
  const rep = base(); rep.oficial = { fuente: 'reporte', total: 1050000, debito: 1748000, credito: 969000, remanente: 118868, ppm: 238750, confirmado_en: '2026-11-14T15:30:00Z' };
  const sv = String(vImpuestos(ctx(), normalizarImpuestos(rep)));
  assert.ok(sv.includes('IVA de octubre') && sv.includes('Validado por Contadoor') && sv.includes('$1.050.000') && !sv.includes('Estimado con datos del SII'));
  assert.ok(sv.includes('Retenciones e impuesto único') && sv.includes('$151.118'), 'el detalle cuadra con el total del reporte');
  // Un F29 declarado en el SII (forma de MC-IMP-1) NUNCA es el monto principal: sigue la estimación.
  const sii = base(); sii.oficial = { fuente: 'sii_declarado', total: 777777 };
  const ss = String(vImpuestos(ctx(), normalizarImpuestos(sii)));
  assert.ok(!ss.includes('$777.777') && ss.includes('Estimado con datos del SII') && ss.includes('$898.882'));
  // Sin reporte pero con Pre-IVA enviado por el analista: manda esa estimación, con la misma etiqueta.
  const pv = base(); pv.preiva_enviado = { total: 880000, enviado_en: '2026-11-16T12:00:00Z' };
  const sp = String(vImpuestos(ctx(), normalizarImpuestos(pv)));
  assert.ok(sp.includes('$880.000') && sp.includes('Estimado con datos del SII') && sp.includes('Revisado por tu analista'));
  // Con reporte, el Pre-IVA enviado no cuenta.
  const ambos = base(); ambos.oficial = rep.oficial; ambos.preiva_enviado = { total: 880000 };
  assert.equal(totalMostrado(normalizarImpuestos(ambos)), 1050000);
  const k = String(kpiImpuestos(normalizarImpuestos(rep))) + String(kpiImpuestos(normalizarImpuestos(base())));
  assert.ok(k.includes('IVA de octubre') && k.includes('Validado') && k.includes('Pre-IVA de octubre') && k.includes('Estimado'));
});

test('Cumplimiento ve su IVA (sin candado); solo un servidor que aún bloquee muestra el teaser; no conectada y error sin cifras', () => {
  const cu = String(vImpuestos(ctx(demo.refs.aromos), normalizarImpuestos(demo.impuestos(demo.refs.aromos))));
  assert.ok(cu.includes('IVA de octubre') && cu.includes('$1.050.000') && !cu.includes('Mejorar mi plan'), 'Cumplimiento con cifras');
  const blo = String(vImpuestos(ctx(demo.refs.aromos), normalizarImpuestos({ ok: true, periodo: '202610', bloqueada: true })));
  assert.ok(blo.includes('Mejorar mi plan') && !/\$\d/.test(blo.replace(/\$•[•.]*/g, '')), 'teaser solo con marcadores');
  const nc = String(vImpuestos(ctx(demo.refs.alerce), normalizarImpuestos(demo.impuestos(demo.refs.alerce))));
  assert.ok(nc.includes('aún no está conectada al SII') && !/\$\d/.test(nc));
  const err = String(vImpuestos(ctx(), { estado: 'error' }));
  assert.ok(err.includes('No pudimos cargar tu IVA del mes') && !/\$\d/.test(err));
  const sinRem = base(); sinRem.estimacion.remanente = null; sinRem.estimacion.total = null; sinRem.estimacion.iva_pagar = null;
  const sr = String(vImpuestos(ctx(), normalizarImpuestos(sinRem)));
  assert.ok(sr.includes('Por confirmar') && !sr.includes('$0<'), 'sin remanente: por confirmar');
});

test('SII-OBS-2: cartas y cumplimiento con lista blanca, fail-closed y escapados', () => {
  const n = normalizarImpuestos(base());
  assert.equal(n.obs.cartas.disponible, true); assert.equal(n.obs.cartas.items.length, 1); assert.equal(n.obs.cumplimiento.cumple, true);
  const raro = base();
  raro.observaciones.cartas.items.push({ categoria: 'inventada', titulo: 'x' }, { categoria: 'carta', titulo: '' }, { categoria: 'carta', titulo: MALO, remitente: MALO, plazo: MALO, fecha: '2026-11-01', texto: 'NO', para: 'NO' });
  const r = normalizarImpuestos(raro);
  assert.equal(r.obs.cartas.items.length, 2, 'categoría desconocida o sin título no se muestra');
  assert.deepEqual(Object.keys(r.obs.cartas.items[1]).sort(), ['categoria', 'fecha', 'nueva', 'plazo', 'remitente', 'titulo'], 'lista blanca');
  const h = String(vImpuestos(ctx(), r));
  assert.ok(!h.includes('<img src=x') && !h.includes('<script>alert'), 'todo dato del servidor va escapado');
  assert.ok(h.includes('El SII te envió una notificación') && h.includes('Plazo para responder:'), 'muestra la notificación con su plazo');
  assert.ok(!h.includes('Muy pronto'), 'ya no dice «Muy pronto»');
  // Sin datos del SII: mensaje neutro; sin cartas: «Sin cartas ni notificaciones ✓»; no cumple: condiciones pendientes y «Requiere atención».
  const sd = base(); sd.observaciones.cartas = { disponible: false }; delete sd.observaciones.cumplimiento;
  const hs = String(vImpuestos(ctx(), normalizarImpuestos(sd)));
  assert.ok(hs.includes('apenas terminemos de leerlas del SII') && !hs.includes('Tu situación ante el SII'));
  const vac = base(); vac.observaciones.cartas = { disponible: true, total_12_meses: 0, items: [] };
  assert.ok(String(vImpuestos(ctx(), normalizarImpuestos(vac))).includes('Sin cartas ni notificaciones ✓'));
  const nc = base(); nc.observaciones.items = []; nc.observaciones.cartas = { disponible: true, items: [] };
  nc.observaciones.cumplimiento = { disponible: true, cumple: false, estado: 'No cumple', condiciones: [{ titulo: 'Condición pendiente (ejemplo)', cumple: false }, { titulo: 'Otra', cumple: true }] };
  const hn = String(vImpuestos(ctx(), normalizarImpuestos(nc)));
  assert.ok(hn.includes('Hay condiciones por regularizar') && hn.includes('Condición pendiente (ejemplo)') && !hn.includes('>Otra<') && hn.includes('Requiere atención'));
  assert.equal(normalizarImpuestos({ ...base(), observaciones: { items: [], cumplimiento: { disponible: true, cumple: 'si' } } }).obs.cumplimiento.disponible, false, 'cumple no booleano = no se muestra');
});
// ── R2 (AUTO-C02/C03): estados nuevos del F29 en «Tu IVA del mes» ──
test('R2 · normalizarImpuestos acepta sin_verificar y no_encontrado (distintos de no_declarado) y descarta estados desconocidos', () => {
  const j = base();
  j.f29 = [{ periodo: '202610', estado: 'por_declarar', vence: '2026-11-20' }, { periodo: '202609', estado: 'no_encontrado', vence: '2026-10-20' },
           { periodo: '202608', estado: 'sin_verificar', vence: '2026-09-22' }, { periodo: '202607', estado: 'inventado', vence: '2026-08-20' }];
  const n = normalizarImpuestos(j);
  assert.deepEqual(n.f29.map((x) => x.estado), ['por_declarar', 'no_encontrado', 'sin_verificar']);
});
