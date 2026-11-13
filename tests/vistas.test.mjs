// Las pantallas escapan TODO dato del servidor: se inyecta HTML malicioso en cada campo y se busca que no salga crudo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demo } from '../js/demo.js';
import { permisos, conTrabajos } from '../js/datos.js';
import { CONFIG } from '../js/config.js';
import { vInicio, vReporte, vHistorial } from '../js/vistas-reporte.js';
import { vCuenta, vPago, vPreIva, vPreRenta, vTrabajos, vMas, vAcceso, hojaEmpresas } from '../js/vistas-cuenta.js';

const MALO = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
function envenenar(x) {
  if (typeof x === 'string') return x + MALO;
  if (Array.isArray(x)) return x.map(envenenar);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, ['ref', 'rol', 'plan_nivel', 'periodo', 'estado', 'fecha', 'vence', 'al', 'enviado_at', 'publicado_at', 'info_hasta', 'confirmado_at', 'vigente_hasta', 'fecha_interna', 'destino', 'tipo', 'ir', 'e', 'codigo', 'etapa', 'emitida_el', 'pagada_el', 'aceptado_el', 'iniciado_el'].includes(k) ? v : envenenar(v)]));
  return x;
}
function ctx(ref, extra = {}) {
  // Igual que app.js: el resumen (MC-1) + la sección trabajos de mc.trabajos (MC-5), ambos envenenados ANTES de normalizar.
  const resumen = conTrabajos(envenenar(demo.resumen(ref, extra)), envenenar(demo.trabajos(ref, extra)));
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
test('trabajos especiales (MC-5): titular ve pasos, pago y folio; usuario adicional no ve ningún monto', () => {
  const t = String(vTrabajos(ctx(demo.refs.rio)));
  assert.ok(t.includes('Firma en notaría') && t.includes('$540.000') && t.includes('16.430') && t.includes('cuotas 1 y 2'));
  const c = String(vTrabajos(ctx(demo.refs.rio, { rol: 'consulta' })));
  assert.ok(c.includes('Firma en notaría') && c.includes('TE-2026-041'));
  assert.ok(!c.includes('Pago del trabajo') && !/\$\d/.test(c) && !c.includes('16.430'));
  assert.ok(!/honorario/i.test(t + c));
});
test('trabajos especiales: error de la RPC muestra un aviso, nunca datos', () => {
  const base = ctx(demo.refs.rio);
  const c = { ...base, resumen: conTrabajos(demo.resumen(demo.refs.rio), 'error') };
  const s = String(vTrabajos(c));
  assert.ok(s.includes('No pudimos cargar tus trabajos especiales') && !s.includes('TE-2026-041'));
});
