// Pruebas unitarias de la capa de datos: escape, permisos por vínculo y acumulado impago. Correr: npm test  (node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, html, raw, clp, urlSegura, fecha, periodoLargo } from '../js/util.js';
import { permisos, estadoSeccion, datosDe, calcularAcumulado, normalizarSesion, saldoFavorTexto, validarContrasena, planTexto, mensajeError } from '../js/datos.js';
import { demo } from '../js/demo.js';
import { crearApiDemo, crearApiReal } from '../js/api.js';

// ── Escape ───────────────────────────────────────────────────────────────────────────────────────────────────
test('esc neutraliza HTML y atributos', () => {
  assert.equal(esc('<img src=x onerror="alert(1)">'), '&lt;img src&#61;x onerror&#61;&quot;alert(1)&quot;&gt;');
  assert.equal(esc("O'Higgins & `Cía`"), 'O&#39;Higgins &amp; &#96;Cía&#96;');
  assert.equal(esc(null), ''); assert.equal(esc(undefined), ''); assert.equal(esc(0), '0');
});
test('html`` escapa cada valor interpolado, también dentro de arreglos', () => {
  const malo = '<script>alert(1)</script>';
  const s = String(html`<b>${malo}</b><ul>${[malo, 'ok'].map((x) => html`<li>${x}</li>`)}</ul>`);
  assert.ok(!s.includes('<script>'));
  assert.equal(s, '<b>&lt;script&gt;alert(1)&lt;/script&gt;</b><ul><li>&lt;script&gt;alert(1)&lt;/script&gt;</li><li>ok</li></ul>');
  assert.equal(String(html`<p class="${'" onclick="x'}">`), '<p class="&quot; onclick&#61;&quot;x">');
  assert.equal(String(html`${raw('<svg/>')}${false}${null}`), '<svg/>');
});
test('urlSegura solo deja https a hosts permitidos o rutas propias', () => {
  assert.equal(urlSegura('javascript:alert(1)', ['a.supabase.co']), null);
  assert.equal(urlSegura('http://a.supabase.co/x.pdf', ['a.supabase.co']), null);
  assert.equal(urlSegura('https://otro.com/x.pdf', ['a.supabase.co']), null);
  assert.equal(urlSegura('//evil.com/x', []), null);
  assert.equal(urlSegura('https://a.supabase.co/x.pdf', ['a.supabase.co']), 'https://a.supabase.co/x.pdf');
  assert.equal(urlSegura('/img/x.png'), '/img/x.png');
});
test('clp: miles con punto, negativos, aproximado y "No disponible" (nunca $0 sin dato)', () => {
  assert.equal(clp(1015600), '$1.015.600'); assert.equal(clp(-457000), '− $457.000');
  assert.equal(clp(702000, { aprox: true }), '≈ $702.000'); assert.equal(clp(0), '$0');
  assert.equal(clp(null), 'No disponible'); assert.equal(clp('abc'), 'No disponible'); assert.equal(clp(undefined), 'No disponible');
});
test('fechas y períodos en español, hora de Chile', () => {
  assert.equal(fecha('2026-11-20'), '20-11'); assert.equal(fecha('2026-11-20', { anio: true }), '20-11-2026');
  assert.equal(fecha('2026-11-13T02:30:00Z'), '12-11');               // 23:30 del 12 en Chile (UTC−3)
  assert.equal(periodoLargo('2026-10'), 'octubre 2026'); assert.equal(periodoLargo('2026-13'), '');
});

// ── Permisos por vínculo (D2) ─────────────────────────────────────────────────────────────────────────────────
const resumen = (sec, extra = {}) => ({ ok: true, ref: 'x', rol: 'titular', plan_nivel: 'pro', secciones: sec, ...extra });
test('estadoSeccion es fail-closed', () => {
  assert.equal(estadoSeccion(undefined), 'sin_permiso'); assert.equal(estadoSeccion(null), 'sin_permiso');
  assert.equal(estadoSeccion([]), 'sin_permiso'); assert.equal(estadoSeccion({}), 'sin_permiso');
  assert.equal(estadoSeccion({ sin_permiso: true, disponible: true, datos: {} }), 'sin_permiso');
  assert.equal(estadoSeccion({ bloqueada: true, mejora: 'comercial' }), 'bloqueada');
  assert.equal(estadoSeccion({ disponible: false }), 'vacia');
  assert.equal(estadoSeccion({ disponible: true, datos: { a: 1 } }), 'ok');
});
test('usuario adicional (consulta) con el contrato MC-1: sin Mi cuenta ni facturas', () => {
  const p = permisos(resumen({ reporte: { disponible: false }, mi_cuenta: { sin_permiso: true }, facturas: { sin_permiso: true },
    trabajos: { disponible: false }, pre_iva: { disponible: false }, pre_renta: { disponible: false } }, { rol: 'consulta' }));
  assert.equal(p.rol, 'consulta'); assert.equal(p.verMiCuenta, false); assert.equal(p.verFacturas, false);
  assert.equal(p.verReporte, true); assert.equal(p.verTrabajos, true);
});
test('el permiso lo da el vínculo, no el rol: un consulta con ver_mi_cuenta = true sí ve Mi cuenta', () => {
  const p = permisos(resumen({ mi_cuenta: { disponible: false }, facturas: { sin_permiso: true } }, { rol: 'consulta' }));
  assert.equal(p.verMiCuenta, true); assert.equal(p.verFacturas, false);
});
test('si el servidor omite una sección, no se muestra (aunque sea titular)', () => {
  const p = permisos(resumen({ reporte: { disponible: false } }));
  assert.equal(p.verMiCuenta, false); assert.equal(p.verFacturas, false); assert.equal(p.preIva, 'sin_permiso');
  assert.equal(permisos(null).verReporte, false); assert.equal(permisos({ secciones: 'x' }).verMiCuenta, false);
});
test('plan Cumplimiento: Pre-IVA y Pre-Renta bloqueadas y sin datos', () => {
  const r = demo.resumen(demo.refs.aromos);
  const p = permisos(r);
  assert.equal(p.pro, false); assert.equal(p.preIva, 'bloqueada'); assert.equal(p.preRenta, 'bloqueada');
  assert.equal(datosDe(r, 'pre_iva'), null); assert.equal(r.secciones.pre_iva.datos, undefined);
});
test('demo simula al servidor: el consulta no recibe datos de Mi cuenta ni de facturas', () => {
  const r = demo.resumen(demo.refs.alerce);
  assert.deepEqual(r.secciones.mi_cuenta, { sin_permiso: true });
  assert.equal(datosDe(r, 'mi_cuenta'), null);
  assert.equal(datosDe(r, 'reporte').servicios, undefined);
  const forzado = demo.resumen(demo.refs.rio, { rol: 'consulta' });
  assert.equal(permisos(forzado).verMiCuenta, false); assert.equal(datosDe(forzado, 'reporte').servicios, undefined);
});
test('normalizarSesion valida refs y no inventa permisos', () => {
  const n = normalizarSesion({ ok: true, cuenta: { correo: 'a@b.cl', terminos_pendientes: true },
    empresas: [{ ref: 'no-es-uuid', razon_social: 'X' }, { ref: demo.refs.rio, razon_social: 'Río', rol: 'jefe', plan_nivel: 'oro' }] });
  assert.equal(n.empresas.length, 1); assert.equal(n.empresas[0].rol, 'consulta'); assert.equal(n.empresas[0].plan_nivel, 'basico');
  assert.equal(n.cuenta.terminos_pendientes, true);
  assert.deepEqual(normalizarSesion({ ok: false, codigo: 'MC_BLOQUEADO' }), { ok: false, codigo: 'MC_BLOQUEADO' });
});

// ── Acumulado impago (arrastre) ──────────────────────────────────────────────────────────────────────────────
test('acumula TODO lo impago de meses anteriores con su período de origen y suma al total', () => {
  const a = calcularAcumulado([
    { id: 1, concepto: 'F29', periodo: '2026-12', monto: 398000, estado: 'pendiente' },
    { id: 2, concepto: 'F29', periodo: '2026-10', monto: 412300, monto_confirmado: 431200, requiere_confirmacion: true, estado: 'atrasada' },
    { id: 3, concepto: 'DNP', periodo: '2026-09', monto: 171000, monto_confirmado: 186400, requiere_confirmacion: true, estado: 'atrasada' },
    { id: 4, concepto: 'F29', periodo: '2026-11', monto: 300000, estado: 'en_revision' },     // "Ya lo pagué": sigue pendiente
    { id: 5, concepto: 'F29', periodo: '2026-08', monto: 999, estado: 'pagada' },
    { id: 6, concepto: 'F29', periodo: '2026-07', monto: 999, estado: 'anulada' },
  ], '2026-12');
  assert.deepEqual(a.anteriores.map((x) => x.periodo), ['2026-09', '2026-10', '2026-11']);
  assert.equal(a.totalAnteriores, 186400 + 431200 + 300000);
  assert.equal(a.totalMes, 398000);
  assert.equal(a.total, 398000 + 186400 + 431200 + 300000);
  assert.deepEqual(a.origenes, ['2026-09', '2026-10', '2026-11']);
  assert.equal(a.incompleto, false);
});
test('sin monto confirmado (DNP con intereses): queda "por confirmar", no se suma y el total se marca incompleto', () => {
  const a = calcularAcumulado([
    { id: 'd', concepto: 'DNP', periodo: '2026-09', monto: 164000, requiere_confirmacion: true, estado: 'pendiente' },
    { id: 'm', concepto: 'F29', periodo: '2026-10', monto: 100, estado: 'pendiente' },
  ], '2026-10');
  assert.equal(a.anteriores[0].porConfirmar, true); assert.equal(a.anteriores[0].montoMostrado, null);
  assert.equal(a.total, 100); assert.equal(a.incompleto, true);
});
test('no duplica (mismo id), ignora períodos futuros y datos basura', () => {
  const a = calcularAcumulado([
    { id: 7, concepto: 'F29', periodo: '2026-09', monto: 1000, estado: 'pendiente' },
    { id: 7, concepto: 'F29', periodo: '2026-09', monto: 1000, estado: 'pendiente' },
    { id: 8, concepto: 'F29', periodo: '2027-01', monto: 5, estado: 'pendiente' },
    { id: 9, concepto: 'F29', periodo: 'sept', monto: 5, estado: 'pendiente' },
    null, 'x', { id: 10, concepto: 'X', periodo: '2026-09', monto: 'abc', estado: 'pendiente' },
  ], '2026-10');
  assert.equal(a.anteriores.length, 2); assert.equal(a.totalAnteriores, 1000); assert.equal(a.incompleto, true);
  assert.equal(calcularAcumulado(null, '2026-10').total, 0); assert.equal(calcularAcumulado([], 'malo').total, 0);
});
test('datos demo: Los Aromos arrastra agosto y septiembre', () => {
  const rep = datosDe(demo.resumen(demo.refs.aromos), 'reporte');
  const a = calcularAcumulado(rep.obligaciones, rep.periodo);
  assert.deepEqual(a.origenes, ['2026-08', '2026-09']);
  assert.equal(a.totalAnteriores, 617600); assert.equal(a.total, 1015600); assert.equal(a.incompleto, true);
});

// ── Otras reglas ─────────────────────────────────────────────────────────────────────────────────────────────
test('saldo a favor siempre visible y nunca aplicado solo', () => {
  assert.match(saldoFavorTexto(50000), /\$50\.000\. Lo definimos contigo/);
  assert.equal(saldoFavorTexto(0), 'No tienes saldo a favor.');
  assert.equal(saldoFavorTexto(null), 'Saldo a favor: no disponible.');
});
test('contraseña: largo, letras + números, coincidencia', () => {
  assert.ok(validarContrasena('corta1', 'corta1')); assert.ok(validarContrasena('sololetrasaqui', 'sololetrasaqui'));
  assert.ok(validarContrasena('Contadoor2026', 'Contadoor2027')); assert.equal(validarContrasena('Contadoor2026', 'Contadoor2026'), null);
});
test('textos: plan y errores genéricos', () => {
  assert.equal(planTexto('pro'), 'Contadoor PRO'); assert.equal(planTexto('basico'), 'Cumplimiento'); assert.equal(planTexto('pro', 'Estratégico'), 'Estratégico');
  assert.equal(mensajeError('CREDENCIALES'), mensajeError('CREDENCIALES')); assert.ok(!/existe/i.test(mensajeError('CREDENCIALES')));
});

// ── Capa api ─────────────────────────────────────────────────────────────────────────────────────────────────
test('api real: sin configuración (o URL que no es de Supabase) no se crea', () => {
  const base = { SUPABASE_URL: '', SUPABASE_ANON_KEY: '', RPC: {} };
  assert.equal(crearApiReal(base), null);
  assert.equal(crearApiReal({ ...base, SUPABASE_URL: 'https://evil.com', SUPABASE_ANON_KEY: 'k' }), null);
  assert.ok(crearApiReal({ ...base, SUPABASE_URL: 'https://abcd.supabase.co', SUPABASE_ANON_KEY: 'k', RPC: { SOLICITUD_PAGO: null } }));
});
test('"Ya transferí"/"Ya lo pagué": deshabilitados si el contrato no trae la RPC', async () => {
  const real = crearApiReal({ SUPABASE_URL: 'https://abcd.supabase.co', SUPABASE_ANON_KEY: 'k', ESQUEMA: 'mc', RPC: { SOLICITUD_PAGO: null } });
  assert.equal(real.capacidades.solicitudPago, false);
  await assert.rejects(real.solicitudPago({}), (e) => e.codigo === 'NO_DISPONIBLE');
  const d = crearApiDemo(demo);
  assert.equal(d.capacidades.solicitudPago, false);
  await assert.rejects(d.solicitudPago({}), (e) => e.codigo === 'NO_DISPONIBLE');
});
test('api demo: ref ajeno → MC_SIN_ACCESO', async () => {
  const d = crearApiDemo(demo);
  await assert.rejects(d.resumen('00000000-0000-0000-0000-000000000000'), (e) => e.codigo === 'MC_SIN_ACCESO');
});
