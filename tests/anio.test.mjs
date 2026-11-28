// REPORTE-HISTORIAL-SII «Tu año con el SII»: normalización fail-closed del contrato mc.mis_impuestos_anio, pantalla y escape. Datos ficticios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demo } from '../js/demo.js';
import { normalizarImpuestosAnio, ESTADOS_PAGO } from '../js/datos.js';
import { CONFIG } from '../js/config.js';
import { vAnio } from '../js/vistas-anio.js';
import { vImpuestos } from '../js/vistas-impuestos.js';
import { normalizarImpuestos } from '../js/datos.js';

const MALO = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
const base = (ref = demo.refs.rio, anio = 2026) => JSON.parse(JSON.stringify(demo.impuestosAnio(ref, anio)));
const ctx = (extra = {}) => ({ cfg: CONFIG, anualOk: true, ...extra });

test('contrato: 12 meses en orden; cualquier otra forma es error (nunca se rellena)', () => {
  const n = normalizarImpuestosAnio(base());
  assert.equal(n.estado, 'ok'); assert.equal(n.anio, 2026); assert.equal(n.meses.length, 12);
  assert.deepEqual(n.meses.map((m) => m.mes), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(normalizarImpuestosAnio(null).estado, 'error');
  assert.equal(normalizarImpuestosAnio({ ok: false, codigo: 'MC_SIN_ACCESO' }).estado, 'error');
  const once = base(); once.meses.pop(); assert.equal(normalizarImpuestosAnio(once).estado, 'error', '11 meses');
  const des = base(); [des.meses[0], des.meses[1]] = [des.meses[1], des.meses[0]]; assert.equal(normalizarImpuestosAnio(des).estado, 'error', 'desordenado');
  const otroAnio = base(); otroAnio.meses[3].periodo = '202504'; assert.equal(normalizarImpuestosAnio(otroAnio).estado, 'error', 'mes de otro año');
});

test('lista blanca: estado de pago y fuente desconocidos no se muestran; sin montos no hay cifras', () => {
  const r = base();
  r.meses[0].pago = { estado: 'pagado_inventado', fuente: 'contadoor' };
  r.meses[1].pago = { estado: 'pagado', fuente: 'obligacion_gestoor', folio: 123 };
  r.meses[2].f29.montos = false;
  r.meses[3].f29.folio = 9999; r.meses[3].cliente_id = 617;
  const n = normalizarImpuestosAnio(r);
  assert.equal(n.meses[0].pago, null);
  assert.deepEqual(n.meses[1].pago, { estado: 'pagado', fuente: null, fecha: null });
  assert.equal(n.meses[2].f29.total, null); assert.equal(n.meses[2].f29.ppm, null);
  assert.ok(!JSON.stringify(n).includes('9999') && !JSON.stringify(n).includes('617'), 'folio e ids no pasan');
  assert.deepEqual(Object.keys(ESTADOS_PAGO).sort(), ['girado', 'nada_que_pagar', 'pagado', 'pendiente', 'postergado', 'sin_informacion']);
});

test('pantalla: 12 meses, chips con los colores pedidos, futuros vacíos y totales', () => {
  const h = String(vAnio(ctx(), normalizarImpuestosAnio(base())));
  for (const m of ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']) assert.ok(h.includes(`<b>${m}</b>`), m);
  assert.match(h, /chip c-ok">Pagado/); assert.match(h, /chip c-pend">Postergado/); assert.match(h, /chip c-venc">Pendiente de pago/); assert.match(h, /chip c-venc">Girado/);
  assert.match(h, /chip c-gris">Sin información/); assert.match(h, /chip c-gris">Sin monto a pagar/);
  assert.match(h, /Aún no llega/); assert.match(h, /Mes en curso/);
  assert.match(h, /A tu favor \$85\.000/, 'remanente'); assert.match(h, /1,25 %/, '% PPM con coma');
  assert.match(h, /No declarado/); assert.match(h, /Reajustes, intereses y multas/);
  assert.match(h, /Tus F29 de 2026/); assert.match(h, /9 de 12 meses/);
  assert.match(h, /data-accion="anio" data-anio="2025"/, 'se puede ver el año anterior');
  assert.ok(!/\$0<\/b><\/div><div class="fila"><span>Compras/.test(h));
});

test('estados vacíos: no publicado, cargando, error y empresa sin conexión', () => {
  assert.match(String(vAnio(ctx(), null)), /aún no está publicado/);
  assert.match(String(vAnio(ctx(), { estado: 'cargando' })), /role="status"/);
  assert.match(String(vAnio(ctx(), { estado: 'error' })), /No pudimos cargar tu año/);
  assert.match(String(vAnio(ctx(), normalizarImpuestosAnio(base(demo.refs.alerce)))), /aún no está conectada al SII/);
});

test('escape: nada del servidor se inyecta como HTML', () => {
  const r = base(); r.meses[0].pago.fecha = MALO; r.meses[0].f29.estado = MALO; r.meses[0].ventas.documentos = MALO; r.datos_al = MALO;
  const h = String(vAnio(ctx(), normalizarImpuestosAnio(r)));
  assert.ok(!h.includes('<img') && !h.includes('<script>'));
});

test('«Tu año» aparece en «Tu IVA» solo si la RPC está disponible; la config publicada la deja apagada hasta instalar', () => {
  const n = normalizarImpuestos(JSON.parse(JSON.stringify(demo.impuestos(demo.refs.rio))));
  const c = { cfg: CONFIG, perm: {}, waMejora: 'https://wa.me/1' };
  assert.match(String(vImpuestos({ ...c, anualOk: true }, n)), /data-ir="impuestos-historial"/);
  assert.ok(!String(vImpuestos({ ...c, anualOk: false }, n)).includes('data-ir="impuestos-historial"'));
  assert.equal(CONFIG.RPC.HISTORIAL_IMPUESTOS, 'mis_impuestos_anio', 'publicada 28-11 (migración 202611241500 instalada)');
});

import { resumenNegocio, tarjetasNegocio } from '../js/vistas-anio.js';
test('Gráficos: ventas y compras suman afecto + exento; meses futuros sin barra; margen sobre ventas', () => {
  const m = (mes, v, c, o = {}) => ({ mes, futuro: false, en_curso: false, ventas: v === null ? null : { neto: 0, exento: v, documentos: 1 }, compras: c === null ? null : { neto: c, exento: 0, documentos: 1 }, ...o });
  const meses = [m(1, 1000, 400), m(2, 2000, 2500), ...Array.from({ length: 10 }, (_, i) => m(i + 3, null, null, { futuro: true }))];
  const r = resumenNegocio(meses);
  assert.equal(r.meses, 2); assert.equal(r.ventas, 3000); assert.equal(r.compras, 2900); assert.equal(r.dif, 100); assert.equal(r.margen, 3.3);
  const s = String(tarjetasNegocio({ anio: 2026, meses }));
  assert.ok(s.includes('Ventas y compras 2026') && s.includes('3,3 % de tus ventas') && s.includes('No es tu utilidad') && s.includes('<svg'));
  assert.equal(String(tarjetasNegocio({ anio: 2026, meses: meses.map((x) => ({ ...x, ventas: null, compras: null })) })), '');
});
