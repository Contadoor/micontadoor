// MICONTADOOR-APERTURA (24-11): términos del servidor, Ayuda (soporte), «Tu incorporación», diagnóstico y menú del historial.
// Sin red: api real con fetch falso; vistas con datos envenenados; cargarTerminos() se extrae de js/app.js y corre en node:vm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { CONFIG } from '../js/config.js';
import { crearApiReal, crearApiDemo, capacidadesDe } from '../js/api.js';
import { demo, TERMINOS_V1_TEXTO } from '../js/demo.js';
import { sha256Hex } from '../js/util.js';
import { normalizarTerminos, bloquesTerminos, validarSoporte, normalizarSolicitudes, normalizarIncorporacion, normalizarMisTerminos, mensajeError, permisos } from '../js/datos.js';
import { vTerminosServidor, textoTerminos, vAyuda, vIncorporacion, tarjetaIncorporacion, bloqueDiagnostico, hojaTerminos, bloqueTerminosAceptados } from '../js/vistas-apertura.js';
import { tabs } from '../js/vistas-comunes.js';
import { vAcceso, vMas } from '../js/vistas-cuenta.js';
import { vInicio } from '../js/vistas-reporte.js';

const MALO = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
const limpio = (s) => { s = String(s); return !s.includes('<script>') && !/<img src=x/.test(s) && !/onerror=/.test(s); };
const REF = demo.refs.rio;

test('sha256Hex calza con el vector conocido y con Postgres (UTF-8)', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal((await sha256Hex('año «ñ»')).length, 64);
});

test('términos del servidor: bloques y escape de todo el texto', () => {
  const b = bloquesTerminos('## 1. Uno\n\nPárrafo uno.\r\n\r\n## 2. Dos\n\n\nPárrafo dos.');
  assert.deepEqual(b.map((x) => x.tipo), ['subtitulo', 'parrafo', 'subtitulo', 'parrafo']);
  const t = { version: '2026-11-16', titulo: 'T' + MALO, texto: `## Sub${MALO}\n\nTexto${MALO}`, sha256: 'a'.repeat(64) };
  assert.ok(limpio(textoTerminos(t)));
  const v = String(vTerminosServidor({ srv: { estado: 'ok', ...t }, mensaje: null }));
  assert.ok(limpio(v) && v.includes('data-form="terminos"') && v.includes('aaaa aaaa aaaa aaaa'));
});

test('términos: sin texto verificado no existe el botón Aceptar (error y cargando)', () => {
  for (const srv of [{ estado: 'error' }, { estado: 'cargando' }, null, { estado: 'error', texto: mensajeError('TERMINOS_HUELLA') }]) {
    const v = String(vTerminosServidor({ srv, mensaje: null }));
    assert.ok(!v.includes('data-form="terminos"') && !v.includes('Aceptar y continuar'));
  }
});

test('normalizarTerminos es fail-closed', () => {
  const ok = { ok: true, version: '2026-11-16', titulo: 'x', texto: 'hola', sha256: 'b'.repeat(64) };
  assert.ok(normalizarTerminos(ok));
  for (const malo of [null, { ...ok, ok: false }, { ...ok, version: '16-11-2026' }, { ...ok, texto: '' }, { ...ok, sha256: 'B'.repeat(64) }, { ...ok, sha256: 'x' }]) assert.equal(normalizarTerminos(malo), null);
});

// cargarTerminos() tal como está en js/app.js
const fuente = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const ini = fuente.indexOf('async function cargarTerminos()'); const fin = fuente.indexOf('\n}\n', ini);
assert.ok(ini > 0 && fin > ini, 'no se encontró cargarTerminos() en js/app.js');
async function correrCargar(respuesta) {
  const ctx = vm.createContext({ st: { api: { terminosVigentes: async () => { if (respuesta instanceof Error) throw respuesta; return respuesta; } } },
    normalizarTerminos, sha256Hex, mensajeError, ERR_CORTE: ['MC_SESION_INVALIDA', 'MC_BLOQUEADO'] });
  vm.runInContext(fuente.slice(ini, fin + 2) + '\nthis.cargarTerminos = cargarTerminos;', ctx);
  let lanzo = null; try { await ctx.cargarTerminos(); } catch (e) { lanzo = e; }
  return { srv: ctx.st.terminosSrv, lanzo };
}
test('cargarTerminos: huella correcta → ok; huella distinta → error (no se puede aceptar)', async () => {
  const bueno = await correrCargar(await demo.terminosVigentes());
  assert.equal(bueno.srv.estado, 'ok'); assert.equal(bueno.srv.texto, TERMINOS_V1_TEXTO);
  const malo = await correrCargar(await demo.terminosVigentes({ huella: 'mala' }));
  assert.equal(malo.srv.estado, 'error'); assert.equal(malo.srv.texto, mensajeError('TERMINOS_HUELLA'));
  const raro = await correrCargar({ ok: true, version: 'x' });
  assert.equal(raro.srv.estado, 'error');
  const ses = await correrCargar(Object.assign(new Error(), { codigo: 'MC_SESION_INVALIDA' }));
  assert.equal(ses.lanzo?.codigo, 'MC_SESION_INVALIDA');
});

function apiConFetch(respuestas) {
  const llamadas = []; const orig = globalThis.fetch;
  globalThis.fetch = async (url, op) => {
    llamadas.push({ url, op });
    if (String(url).includes('/auth/v1/token')) return new Response(JSON.stringify({ access_token: 't', refresh_token: 'r', expires_in: 3600 }), { status: 200 });
    const fn = String(url).split('/rpc/')[1];
    return new Response(JSON.stringify(respuestas[fn] ?? { ok: true }), { status: 200 });
  };
  return { llamadas, restaurar: () => { globalThis.fetch = orig; } };
}
test('api real: aceptar_terminos_v2, soporte, incorporación y mis_solicitudes van al esquema mc con los argumentos del contrato', async () => {
  const f = apiConFetch({ soporte_crear: { ok: true, folio: 'MC-2026-00001' }, mi_incorporacion: { ok: true, disponible: false } });
  try {
    const api = crearApiReal(CONFIG); await api.ingresar('a@b.cl', 'x');
    const sha = 'c'.repeat(64);
    await api.aceptarTerminosV2('2026-11-16', sha);
    await api.soporteCrear(REF, 'consulta', '  Hola, una consulta  ');
    await api.incorporacion(REF); await api.misSolicitudes(REF); await api.misTerminos(); await api.terminosTexto('2026-11-16');
    const rpc = f.llamadas.filter((x) => String(x.url).includes('/rpc/'));
    assert.deepEqual(rpc.map((x) => String(x.url).split('/rpc/')[1]), ['aceptar_terminos_v2', 'soporte_crear', 'mi_incorporacion', 'mis_solicitudes', 'mis_terminos', 'terminos_texto']);
    assert.deepEqual(JSON.parse(rpc[0].op.body), { p_version: '2026-11-16', p_sha256: sha });
    assert.deepEqual(JSON.parse(rpc[1].op.body), { p_ref: REF, p_tipo: 'consulta', p_mensaje: 'Hola, una consulta' });
    assert.ok(rpc.every((x) => x.op.headers['Content-Profile'] === 'mc' && x.op.headers['Accept-Profile'] === 'mc'));
    await assert.rejects(api.aceptarTerminosV2('2026-11-16', 'XYZ'), (e) => e.codigo === 'MC_DATOS');
    await assert.rejects(api.soporteCrear('no-uuid', 'consulta', 'hola hola hola'), (e) => e.codigo === 'MC_SIN_ACCESO');
  } finally { f.restaurar(); }
});
test('api real: MC_LIMITE del servidor llega como código; con RPC en null no se llama a la red', async () => {
  const f = apiConFetch({ soporte_crear: { ok: false, codigo: 'MC_LIMITE' } });
  try {
    const api = crearApiReal(CONFIG); await api.ingresar('a@b.cl', 'x');
    await assert.rejects(api.soporteCrear(REF, 'consulta', 'hola hola hola'), (e) => e.codigo === 'MC_LIMITE');
    const nulo = { ...CONFIG, RPC: { ...CONFIG.RPC, TERMINOS_VIGENTES: null, INCORPORACION: null, MIS_SOLICITUDES: null, MIS_TERMINOS: null, HISTORIAL_IMPUESTOS: null, MIS_CONVENIOS: null } };
    const api2 = crearApiReal(nulo); await api2.ingresar('a@b.cl', 'x');
    const antes = f.llamadas.length;
    assert.equal(await api2.terminosVigentes(), null); assert.equal(await api2.incorporacion(REF), null);
    assert.equal(await api2.misSolicitudes(REF), null); assert.equal(await api2.misTerminos(), null); assert.equal(await api2.diagnostico(REF), null);
    assert.equal(f.llamadas.length, antes);
    assert.deepEqual(capacidadesDe(nulo), { solicitudPago: false, terminosServidor: false, misTerminos: false, soporte: false, incorporacion: false, convenios: false, historialImpuestos: false });
  } finally { f.restaurar(); }
});

test('soporte: validación, folio y límite de 5 en la demo', async () => {
  assert.equal(validarSoporte('x', 'hola hola hola'), 'Elige de qué se trata.');
  assert.match(validarSoporte('consulta', 'corto'), /al menos 10/);
  assert.match(validarSoporte('consulta', 'a'.repeat(1001)), /máximo 1\.000/);
  assert.equal(validarSoporte('seguridad', 'Vi un ingreso raro ayer'), null);
  const api = crearApiDemo(demo);
  const folios = [];
  for (let i = 0; i < 5; i++) folios.push((await api.soporteCrear(REF, 'consulta', 'Una consulta de prueba')).folio);
  assert.ok(folios.every((x) => /^MC-2026-\d{5}$/.test(x)) && new Set(folios).size === 5);
  await assert.rejects(api.soporteCrear(REF, 'consulta', 'Una consulta de prueba'), (e) => e.codigo === 'MC_LIMITE');
  assert.match(mensajeError('MC_LIMITE'), /WhatsApp/);
  const lista = normalizarSolicitudes(await api.misSolicitudes(REF));
  assert.equal(lista.length, 6);
  const otra = normalizarSolicitudes(await api.misSolicitudes(demo.refs.aromos));
  assert.equal(otra.length, 0, 'las solicitudes son por empresa');
  assert.equal(normalizarSolicitudes({ ok: true, solicitudes: [{ folio: 'malo' }, { folio: 'MC-2026-1', estado: 'raro', tipo: 'x' }] })[0].estado, 'abierta');
});

const ctxBase = (extra = {}) => {
  const resumen = demo.resumen(REF); const sesion = demo.sesion();
  return { cfg: CONFIG, api: { modo: 'demo', capacidades: { solicitudPago: false, misTerminos: true, soporte: true, historialImpuestos: false } }, sesion, empresa: sesion.empresas[0], resumen,
    perm: permisos(resumen), tema: 'claro', version: 'x', abiertos: new Set(), solicitudes: new Set(), waMejora: 'https://wa.me/1', waEquipo: 'https://wa.me/1', waAyuda: 'https://wa.me/2', enlaceDoc: () => null, ...extra };
};
test('Ayuda: formulario solo con soporte configurado; solicitudes y textos escapados', () => {
  const s = String(vAyuda(ctxBase(), { soporte: true, solicitudes: [{ folio: 'MC-2026-00001', tipo: 'datos', estado: 'en_curso', creada_at: '2026-11-20T12:00:00Z' }], texto: MALO, mensaje: MALO }));
  assert.ok(limpio(s) && s.includes('data-form="soporte"') && s.includes('MC-2026-00001') && s.includes('En revisión') && s.includes('info@contadoor.cl') && !s.includes('https://wa.me/2'));
  const sin = String(vAyuda(ctxBase(), { soporte: false }));
  assert.ok(!sin.includes('data-form="soporte"') && !sin.includes('https://wa.me/2') && sin.includes('Cerrar sesión en todos mis aparatos'));
  const fol = String(vAyuda(ctxBase(), { soporte: true, enviada: true, folio: 'MC-2026-00012', solicitudes: [] }));
  assert.ok(fol.includes('Tu número de solicitud es <b>MC-2026-00012</b>'));
  assert.ok(String(vAyuda(ctxBase(), { soporte: true, tipo: 'seguridad', solicitudes: [] })).includes('value="seguridad" selected'));
});

test('incorporación: normalización (estados, terminado, no disponible, error)', () => {
  assert.deepEqual(normalizarIncorporacion(null), { estado: 'error' });
  assert.deepEqual(normalizarIncorporacion({ ok: false, codigo: 'MC_SIN_ACCESO' }), { estado: 'error' });
  assert.deepEqual(normalizarIncorporacion({ ok: true, disponible: false }), { estado: 'ok', disponible: false });
  const n = normalizarIncorporacion(demo.incorporacion(REF));
  assert.equal(n.actual, 5); assert.equal(n.total, 10); assert.equal(n.listos, 4); assert.equal(n.diagnostico.emitido, false);
  assert.deepEqual(n.pasos.map((p) => p.estado), ['listo', 'listo', 'esperando_tu_respuesta', 'en_curso', 'pendiente', 'pendiente']);
  const raro = normalizarIncorporacion({ ok: true, disponible: true, avance: { listos: 99, total: 10 }, pasos: [{ orden: 2, titulo: 'B', estado: 'hackeado' }, { orden: 1, titulo: 'A', estado: 'listo' }, { titulo: 'sin orden' }] });
  assert.equal(raro.listos, 10); assert.deepEqual(raro.pasos.map((p) => [p.titulo, p.estado]), [['A', 'listo'], ['B', 'pendiente']]);
  const t = normalizarIncorporacion(demo.incorporacion(REF, { inc: 'terminado' }));
  assert.equal(t.terminado, true); assert.equal(t.actual, 10);
});
test('incorporación: tarjeta de Inicio solo en curso; vista con error neutro y sin pasos inventados', () => {
  const enCurso = normalizarIncorporacion(demo.incorporacion(REF));
  assert.ok(String(tarjetaIncorporacion(enCurso)).includes('Paso 5 de 10'));
  assert.equal(String(tarjetaIncorporacion(normalizarIncorporacion(demo.incorporacion(REF, { inc: 'terminado' })))), '');
  assert.equal(String(tarjetaIncorporacion({ estado: 'ok', disponible: false })), '');
  assert.equal(String(tarjetaIncorporacion({ estado: 'error' })), '');
  assert.ok(String(vInicio(ctxBase({ incorporacion: enCurso }))).includes('data-ir="incorporacion"'));
  assert.ok(!String(vInicio(ctxBase({ incorporacion: { estado: 'error' } }))).includes('Tu incorporación'));
  const err = String(vIncorporacion(ctxBase(), { estado: 'error' }));
  assert.ok(err.includes('No pudimos cargar tu incorporación') && !err.includes('Paso '));
  const v = String(vIncorporacion(ctxBase(), normalizarIncorporacion({ ...demo.incorporacion(REF), pasos: [{ orden: 1, titulo: 'X' + MALO, estado: 'listo' }] })));
  assert.ok(limpio(v) && v.includes('Esperando') === false && v.includes('Paso 5 de 10'));
  assert.ok(String(vIncorporacion(ctxBase(), normalizarIncorporacion(demo.incorporacion(REF, { inc: 'terminado' })))).includes('Incorporación terminada'));
});
test('diagnóstico "Aquí partimos": en preparación vs listo con fecha de la reunión', () => {
  const prep = String(bloqueDiagnostico(normalizarIncorporacion(demo.incorporacion(REF))));
  assert.ok(prep.includes('Tu diagnóstico &quot;Aquí partimos&quot;') && prep.includes('Lo estamos preparando') && prep.includes('reunión de entrega') && prep.includes('En preparación'));
  const listo = String(bloqueDiagnostico(normalizarIncorporacion(demo.incorporacion(demo.refs.aromos))));
  assert.ok(listo.includes('Tu diagnóstico está listo') && listo.includes('02-12-2026'));
  const sinFecha = String(bloqueDiagnostico({ diagnostico: { emitido: true }, fecha_reunion: null }));
  assert.ok(sinFecha.includes('te contactará para agendarla'));
  assert.ok(!/href=/.test(listo), 'sin enlace ni documento todavía');
});

test('menú: «Mis impuestos · historial» solo con la capacidad (28-11: publicada con mis_impuestos_anio)', () => {
  assert.equal(CONFIG.RPC.HISTORIAL_IMPUESTOS, 'mis_impuestos_anio'); assert.equal(CONFIG.RPC.DIAGNOSTICO, null);
  const c = ctxBase({ api: { modo: 'demo', capacidades: { historialImpuestos: false } } });
  assert.ok(!String(tabs(c, 'inicio')).includes('impuestos-historial') && !String(vMas(c)).includes('impuestos-historial'));
  const c2 = ctxBase({ api: { modo: 'demo', capacidades: { historialImpuestos: true } } });
  assert.ok(String(tabs(c2, 'inicio')).includes('Mis impuestos · historial') && String(vMas(c2)).includes('impuestos-historial'));
  assert.ok(String(tabs(c, 'ayuda')).includes('data-ir="ayuda"'));
});

test('Mi acceso: términos aceptados (escapados) y hoja con el texto exacto', async () => {
  const mis = normalizarMisTerminos(await demo.misTerminos());
  const s = String(vAcceso(ctxBase({ misTerminos: mis })));
  assert.ok(s.includes('Términos que aceptaste') && s.includes('Versión 2026-11-16') && s.includes('16-11-2026') && s.includes('data-accion="ver-terminos"'));
  assert.ok(String(bloqueTerminosAceptados('error')).includes('No pudimos cargar'));
  assert.ok(!String(vAcceso(ctxBase({ api: { modo: 'demo', capacidades: { misTerminos: false } } }))).includes('Términos que aceptaste'));
  const t = await demo.terminosTexto('2026-11-16');
  assert.ok(String(hojaTerminos({ estado: 'ok', ...normalizarTerminos(t) })).includes('Tus derechos'));
  assert.ok(String(hojaTerminos({ estado: 'error' })).includes('No pudimos mostrar'));
  assert.equal((await demo.terminosTexto('2025-01-01')).codigo, 'MC_SIN_ACCESO');
});

test('la versión visible es 1.1.0', () => { assert.match(fuente, /const VERSION = '1\.1\.0';/); });
