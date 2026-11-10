// Las pantallas escapan TODO dato del servidor: se inyecta HTML malicioso en cada campo y se busca que no salga crudo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demo } from '../js/demo.js';
import { permisos } from '../js/datos.js';
import { CONFIG } from '../js/config.js';
import { vInicio, vReporte, vHistorial } from '../js/vistas-reporte.js';
import { vCuenta, vPago, vPreIva, vPreRenta, vTrabajos, vMas, vAcceso, hojaEmpresas } from '../js/vistas-cuenta.js';

const MALO = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
function envenenar(x) {
  if (typeof x === 'string') return x + MALO;
  if (Array.isArray(x)) return x.map(envenenar);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, ['ref', 'rol', 'plan_nivel', 'periodo', 'estado', 'fecha', 'vence', 'al', 'enviado_at', 'publicado_at', 'info_hasta', 'confirmado_at', 'vigente_hasta', 'fecha_interna', 'destino', 'tipo', 'ir', 'e'].includes(k) ? v : envenenar(v)]));
  return x;
}
function ctx(ref, extra = {}) {
  const resumen = envenenar(demo.resumen(ref, extra));
  const sesion = envenenar(demo.sesion());
  return { cfg: CONFIG, api: { modo: 'demo', capacidades: { solicitudPago: true } }, sesion, empresa: sesion.empresas.find((e) => e.ref === ref), resumen,
    perm: permisos(resumen), tema: 'claro', version: 'x', abiertos: new Set(['te-041-3']), solicitudes: new Set(), waMejora: 'https://wa.me/1', waEquipo: 'https://wa.me/1', enlaceDoc: () => null };
}
test('ninguna pantalla deja pasar HTML de los datos', () => {
  for (const ref of Object.values(demo.refs)) {
    const c = ctx(ref);
    const salidas = [vInicio(c), vReporte(c), vHistorial(c), vCuenta(c, ''), vCuenta(c, 'pagado'), vPago(c, 'cp-f29-10'), vPreIva(c), vPreRenta(c), vTrabajos(c), vMas(c), vAcceso(c), hojaEmpresas(c)].map(String);
    for (const s of salidas) {
      assert.ok(!s.includes('<script>'), 'script crudo');
      assert.ok(!/<img src=x/.test(s), 'img crudo');
      assert.ok(!/onerror=/.test(s), 'atributo de evento crudo');
    }
  }
});
test('usuario adicional: ni Mi cuenta ni facturas aparecen en las pantallas', () => {
  const c = ctx(demo.refs.rio, { rol: 'consulta' });
  const rep = String(vReporte(c)); const cta = String(vCuenta(c, ''));
  assert.ok(!rep.includes('Nuestros servicios'));
  assert.ok(cta.includes('Sin acceso a esta sección') && !cta.includes('Pagar por transferencia'));
});
test('plan Cumplimiento: el teaser no contiene cifras reales, solo marcadores', () => {
  const c = ctx(demo.refs.aromos);
  const s = String(vPreIva(c));
  assert.ok(s.includes('Mejorar mi plan') && s.includes('$•••.•••'));
  assert.ok(!/\$\d/.test(s.replace(/\$•[•.]*/g, '')));
});
