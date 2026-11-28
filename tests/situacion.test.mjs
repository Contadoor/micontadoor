import test from 'node:test';
import assert from 'node:assert/strict';
import { tarjetaSituacion } from '../js/vistas-impuestos.js';
import { normalizarCumplimiento } from '../js/datos.js';

const base = (obs) => ({ estado: 'ok', obs });
test('Situación tributaria: al día muestra «Al día ✓» y la fecha de consulta', () => {
  const cu = normalizarCumplimiento({ disponible: true, cumple: true, estado: 'Cumple', actualizado_en: '2026-11-20T03:26:04Z', condiciones: [] });
  const s = String(tarjetaSituacion(base({ items: [], cartas: { disponible: true, total: 0, items: [] }, cumplimiento: cu })));
  assert.ok(s.includes('Tu situación tributaria') && s.includes('Al día ✓') && s.includes('Cumple sus obligaciones tributarias') && s.includes('Ninguna en los últimos 12 meses'));
  assert.ok(/Consultado en el SII el/.test(s));
});
test('Situación tributaria: no cumple o F29 observado → «Requiere atención»', () => {
  const cu = normalizarCumplimiento({ disponible: true, cumple: false, condiciones: [{ titulo: 'x', cumple: false }] });
  const s = String(tarjetaSituacion(base({ items: [{ tipo: 'f29_no_declarado', periodo: '2026-09' }], cartas: { disponible: false, items: [] }, cumplimiento: cu })));
  assert.ok(s.includes('Requiere atención') && s.includes('Hay condiciones por regularizar') && s.includes('1 mes requiere revisión') && s.includes('Aún sin leer del SII'));
});
test('Situación tributaria: sin datos o con error no se muestra', () => {
  assert.equal(String(tarjetaSituacion(null)), '');
  assert.equal(String(tarjetaSituacion({ estado: 'error' })), '');
  assert.equal(String(tarjetaSituacion(base({ items: [], cartas: { disponible: false, items: [] }, cumplimiento: { disponible: false } }))), '');
});
