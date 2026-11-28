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

import { normalizarF22 } from '../js/datos.js';
test('F22 real: falta el AT esperado (caso Asesorías Contadoor) → alerta con el año y el estado del SII', () => {
  const fe = normalizarF22({ disponible: true, at_esperado: 2026, declarado_esperado: false, hay_declaraciones: true, at_ultimo: 2025,
    texto: 'Previo a presentar su declaración en el plazo legal, usted solicito diferir el total o parte del impuesto a pagar, por lo tanto, ahora se está emitiendo el cobro por la diferencia no pagada.' });
  assert.equal(fe.nivel, 'falta'); assert.equal(fe.alerta_anterior, true);
  const s = String(tarjetaSituacion(base({ items: [], cartas: { disponible: true, total: 0, items: [] }, cumplimiento: { disponible: false }, f22: fe })));
  assert.ok(s.includes('No figura la del AT 2026 (última: AT 2025)') && s.includes('Requiere atención'));
});
test('F22 real: clasificación de textos del SII', () => {
  const n = (t) => normalizarF22({ disponible: true, at_esperado: 2026, declarado_esperado: true, hay_declaraciones: true, at_ultimo: 2026, texto: t }).nivel;
  assert.equal(n('Tu declaración de Renta no presenta diferencias con respecto a la información'), 'ok');
  assert.equal(n('Su declaración ha sido aceptada, dado que las inconsistencias detectadas han sido justificadas.'), 'ok');
  assert.equal(n('La devolución solicitada por $10.172 se autorizó totalmente, aún cuando persisten inconsistencias'), 'alerta');
  assert.equal(n('Producto de nueva información en las bases del SII, se detectaron o fueron confirmadas inconsistencias'), 'alerta');
  assert.equal(n('se ha efectuado una citación'), 'alerta');
  assert.equal(normalizarF22({ disponible: true, at_esperado: 2026, hay_declaraciones: false }).nivel, 'sin');
  assert.equal(normalizarF22({ disponible: false }), null);
});
