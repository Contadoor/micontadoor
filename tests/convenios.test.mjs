import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarConvenios } from '../js/datos.js';
import { vConvenios, tarjetaConvenios } from '../js/vistas-convenios.js';
import { demo } from '../js/demo.js';

test('Convenios: demo Río → tarjeta con saldo, próxima cuota y cuota vencida; pantalla con cuotas', () => {
  const cv = normalizarConvenios(demo.convenios(demo.refs.rio));
  assert.equal(cv.estado, 'ok'); assert.equal(cv.activos.length, 1);
  const t = String(tarjetaConvenios(cv));
  assert.ok(t.includes('Tus convenios') && t.includes('1 cuota vencida') && t.includes('$512.400') && t.includes('Próxima cuota'));
  const v = String(vConvenios({}, cv));
  assert.ok(v.includes('Tesorería (TGR)') && v.includes('6 de 12 cuotas pagadas') && v.includes('Ver las 12 cuotas') && v.includes('Vencida'));
});
test('Convenios: sin convenios no hay tarjeta; error y null con mensajes neutros', () => {
  assert.equal(String(tarjetaConvenios(normalizarConvenios({ ok: true, convenios: [] }))), '');
  assert.ok(String(vConvenios({}, normalizarConvenios({ ok: true, convenios: [] }))).includes('No tienes convenios de pago'));
  assert.ok(String(vConvenios({}, { estado: 'error' })).includes('No pudimos cargar'));
  assert.ok(String(vConvenios({}, null)).includes('aún no están publicados'));
  assert.equal(normalizarConvenios(null).estado, 'error');
});
test('Convenios: texto escapado', () => {
  const cv = normalizarConvenios({ ok: true, convenios: [{ tipo: 'TGR', numero: '<b>1</b>', deuda: '<script>x</script>', estado: 'activo', n_cuotas: 1, cuotas: [] }] });
  const v = String(vConvenios({}, cv));
  assert.ok(!v.includes('<script>') && !v.includes('<b>1</b>'));
});

import { soloPpm, kpiImpuestos } from '../js/vistas-impuestos.js';
test('PPM exento: ventas solo exentas y débito 0 → «pagas solo PPM» (caso Asesorías Contadoor)', () => {
  const n = { estado: 'ok', periodo: '2026-11', vence: '2026-12-21', oficial: null, preiva: null,
    est: { exenta: false, ventas_neto: 0, ventas_exento: 19052512, debito: 0, ppm: 23816, iva_pagar: 0, total: 23816 } };
  assert.equal(soloPpm(n), true);
  assert.ok(String(kpiImpuestos(n)).includes('Ventas exentas: pagas solo PPM') && String(kpiImpuestos(n)).includes('$23.816'));
  assert.equal(soloPpm({ est: { ventas_neto: 100, ventas_exento: 0, debito: 19, ppm: 5 } }), false);
});
