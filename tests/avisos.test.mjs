// MC-6 · Novedades y avisos push: normalización fail-closed, permisos por vínculo, privacidad del aviso del sistema (sw-avisos.js),
// estados de Más → Avisos (iOS / Android / bloqueado) y que el permiso nunca se pida al cargar.  Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { normalizarAvisos, permisos } from '../js/datos.js';
import { estadoAvisos, plataforma, pushConfigurado, claveAplicacion } from '../js/push.js';
import { demo } from '../js/demo.js';
import { crearApiDemo, crearApiReal } from '../js/api.js';
import { CONFIG } from '../js/config.js';
import { bloqueNovedades, vNovedades, tarjetaAvisos } from '../js/vistas-avisos.js';
import { vInicio } from '../js/vistas-reporte.js';
import { vMas } from '../js/vistas-cuenta.js';

const sw = (() => { const ctx = { self: {} }; vm.createContext(ctx); vm.runInContext(readFileSync(new URL('../js/sw-avisos.js', import.meta.url), 'utf8'), ctx); return ctx.self.MC_AVISO; })();
const REF = demo.refs.rio;
const permTit = permisos(demo.resumen(REF)); const permCon = permisos(demo.resumen(REF, { rol: 'consulta' }));
// Configuración «sin MC-6» (como antes de instalarlo): sirve para probar que, sin RPC, nada se ofrece ni se llama.
const APAGADO = { ...CONFIG, AVISOS_PUSH: false, VAPID_PUBLICA: '',
  RPC: { ...CONFIG.RPC, AVISOS: null, AVISOS_LEIDOS: null, PUSH_SUSCRIBIR: null, PUSH_DESUSCRIBIR: null, PUSH_PROBAR: null, AVISOS_CORREO: null } };

test('normalizarAvisos: fail-closed ante respuestas raras', () => {
  const VACIO = { noLeidos: 0, avisos: [], correo: { activo: false, disponible: false } };
  assert.deepEqual(normalizarAvisos(null, permTit), VACIO);
  assert.deepEqual(normalizarAvisos({ ok: false, codigo: 'MC_SIN_ACCESO' }, permTit), VACIO);
  const n = normalizarAvisos({ ok: true, avisos: [
    { id: 1, evento: 'reporte_listo', titulo: 't', texto: 'x', ruta: 'reporte', leido: false },
    { id: '2', evento: 'reporte_listo', titulo: 'id no entero' }, { id: 3, evento: 'evento_raro', titulo: 'x' },
    { id: 4, evento: 'tramite_avanzo', titulo: 't', ruta: 'javascript:alert(1)' }, null] }, permTit);
  assert.deepEqual(n.avisos.map((a) => a.id), [1, 4]);
  assert.equal(n.avisos[1].ruta, 'inicio');
  assert.equal(n.noLeidos, 2);
});
test('permiso por vínculo: el usuario adicional (sin Mi cuenta) no ve avisos de pagos aunque el servidor los mandara', () => {
  const j = { ok: true, avisos: [{ id: 1, evento: 'pago_confirmado', titulo: 'Pago confirmado ✅', ruta: 'cuenta/pagado' }, { id: 2, evento: 'reporte_listo', titulo: 'R', ruta: 'cuenta' }] };
  const n = normalizarAvisos(j, permCon);
  assert.deepEqual(n.avisos.map((a) => a.evento), ['reporte_listo']);
  assert.equal(n.avisos[0].ruta, 'inicio', 'una ruta a Mi cuenta se cambia por Inicio sin el permiso');
  assert.equal(normalizarAvisos(j, permTit).avisos.length, 2);
});
test('demo: el «servidor» omite los pagos al usuario adicional (empresa 3)', () => {
  const r = demo.avisos(demo.refs.alerce);
  assert.ok(r.avisos.every((a) => a.evento !== 'pago_confirmado'));
  assert.ok(demo.avisos(REF).avisos.some((a) => a.evento === 'pago_confirmado'));
  assert.equal(demo.avisos('00000000-0000-4000-8000-000000000000'), null);
});

test('sw-avisos: el texto válido del servidor se muestra tal cual', () => {
  const a = sw.avisoSeguro(JSON.stringify({ v: 1, titulo: 'Tu IVA vence el 19 ⏰', cuerpo: 'Revisa tu reporte en MiContadoor.', url: `/?e=${REF}#/reporte`, tag: 'mc-iva_vence-77' }));
  assert.equal(a.titulo, 'Tu IVA vence el 19 ⏰'); assert.equal(a.url, `/?e=${REF}#/reporte`); assert.equal(a.tag, 'mc-iva_vence-77');
});
test('PRIVACIDAD sw-avisos: montos, RUT, correos o cifras largas → texto genérico (nunca llegan a la pantalla bloqueada)', () => {
  for (const malo of ['Pagaste $214.000', 'Debes 1.234.567', 'RUT 76.000.001-K', 'Factura 12345', 'ana@empresa.cl', 'Total 214000']) {
    const a = sw.avisoSeguro({ v: 1, titulo: malo, cuerpo: 'ok', url: '/#/inicio' });
    assert.equal(a.titulo, 'MiContadoor'); assert.equal(a.cuerpo, 'Tienes un aviso nuevo de Contadoor');
    const b = sw.avisoSeguro({ v: 1, titulo: 'Pago confirmado ✅', cuerpo: malo, url: '/#/inicio' });
    assert.equal(b.cuerpo, 'Tienes un aviso nuevo de Contadoor');
  }
});
test('sw-avisos: carga ilegible, versión desconocida o vacía → genérico', () => {
  for (const x of [null, '', 'no-json', '{"v":2,"titulo":"x","cuerpo":"y"}', { titulo: 'sin v' }, 42]) assert.equal(sw.avisoSeguro(x).titulo, 'MiContadoor');
});
test('sw-avisos: la ruta al tocar el aviso solo puede ser propia y de la lista', () => {
  for (const u of ['https://evil.example.com/', '//evil.example.com', 'javascript:alert(1)', '/#/pago/123', '/?e=no-uuid#/inicio', '/x#/inicio', `/?e=${REF}&x=1#/reporte`])
    assert.equal(sw.urlSegura(u), '/#/inicio', u);
  assert.equal(sw.urlSegura('/#/cuenta/pagado'), '/#/cuenta/pagado');
});
test('sw.js: el push SIEMPRE pasa por MC_AVISO.avisoSeguro y la notificación lleva solo la url validada', () => {
  const s = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.ok(s.includes("importScripts('/js/sw-avisos.js')"));
  assert.ok(/const a = self\.MC_AVISO\.avisoSeguro\(datos\)/.test(s));
  assert.ok(/showNotification\(a\.titulo, \{\s*body: a\.cuerpo/.test(s));
  assert.ok(/self\.MC_AVISO\.urlSegura\(e\.notification\.data\?\.url\)/.test(s));
});

test('estados de Más → Avisos: iPhone sin instalar, sin soporte, bloqueado, inactivo, activo, apagado', () => {
  const base = { configurado: true, contextoSeguro: true, instalada: true, plataforma: 'android', tienePush: true, tieneNotificacion: true, permiso: 'default', suscrito: false };
  assert.equal(estadoAvisos({ ...base, configurado: false }), 'apagado');
  assert.equal(estadoAvisos({ ...base, plataforma: 'ios', instalada: false, tienePush: false }), 'ios_instalar');
  assert.equal(estadoAvisos({ ...base, plataforma: 'ios', instalada: true }), 'inactivo');
  assert.equal(estadoAvisos({ ...base, tienePush: false }), 'no_soportado');
  assert.equal(estadoAvisos({ ...base, permiso: 'denied' }), 'bloqueado');
  assert.equal(estadoAvisos({ ...base, permiso: 'granted', suscrito: true }), 'activo');
  assert.equal(estadoAvisos({ ...base, permiso: 'granted', suscrito: false }), 'inactivo');
});
test('plataforma: solo un valor grueso (nunca el user-agent)', () => {
  assert.equal(plataforma('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)'), 'ios');
  assert.equal(plataforma('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5), 'ios');     // iPad moderno
  assert.equal(plataforma('Mozilla/5.0 (Linux; Android 14; Pixel 8)'), 'android');
  assert.equal(plataforma('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'escritorio');
});
test('R4: push ENCENDIDO en la configuración publicada (MC6A instalado) con la VAPID pública y las RPC del contrato mc', () => {
  assert.equal(CONFIG.AVISOS_PUSH, true); assert.equal(pushConfigurado(CONFIG), true);
  assert.match(CONFIG.VAPID_PUBLICA, /^B[A-Za-z0-9_-]{86}$/); assert.equal(claveAplicacion(CONFIG.VAPID_PUBLICA).length, 65);
  assert.equal(claveAplicacion(CONFIG.VAPID_PUBLICA)[0], 4, 'punto P-256 sin comprimir');
  assert.deepEqual([CONFIG.RPC.AVISOS, CONFIG.RPC.AVISOS_LEIDOS, CONFIG.RPC.PUSH_SUSCRIBIR, CONFIG.RPC.PUSH_DESUSCRIBIR, CONFIG.RPC.PUSH_PROBAR, CONFIG.RPC.AVISOS_CORREO],
    ['avisos', 'avisos_leidos', 'push_suscribir', 'push_desuscribir', 'push_probar', 'avisos_correo']);
  assert.equal(pushConfigurado(APAGADO), false);
  const k = 'B' + 'A'.repeat(86);
  assert.equal(pushConfigurado({ ...CONFIG, AVISOS_PUSH: true, VAPID_PUBLICA: k, RPC: { PUSH_SUSCRIBIR: 'push_suscribir', PUSH_DESUSCRIBIR: 'push_desuscribir' } }), true);
  assert.equal(pushConfigurado({ ...CONFIG, AVISOS_PUSH: true, VAPID_PUBLICA: 'corta', RPC: { PUSH_SUSCRIBIR: 'x', PUSH_DESUSCRIBIR: 'y' } }), false);
  assert.equal(claveAplicacion(k).length, 65);
});
test('el permiso de notificaciones NUNCA se pide al cargar: solo en activarAvisos (push.js), llamado desde el clic', () => {
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const push = readFileSync(new URL('../js/push.js', import.meta.url), 'utf8');
  assert.ok(!/requestPermission/.test(app));
  assert.equal((push.match(/Notification\.requestPermission\(/g) || []).length, 1);
  const cuerpo = push.slice(push.indexOf('export async function activarAvisos'));
  assert.ok(!cuerpo.slice(0, cuerpo.indexOf('await Notification.requestPermission(')).includes('await '), 'no hay ningún await antes del permiso (Safari exige el gesto)');
  assert.ok(/acc === 'activar-avisos'/.test(app));
  const arranque = app.slice(app.indexOf('async function arrancar'));
  assert.ok(!/activarAvisos/.test(arranque));
});
test('capa api real: sin RPC de MC-6 no hay Novedades ni push (NO_DISPONIBLE), y valida ids', async () => {
  const api = crearApiReal({ ...APAGADO, SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_x' });
  assert.equal(api.capacidades.novedades, false); assert.equal(api.capacidades.push, false);
  await assert.rejects(api.avisos(REF), { codigo: 'NO_DISPONIBLE' });
  const api2 = crearApiReal({ ...APAGADO, SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_x', RPC: { ...APAGADO.RPC, AVISOS: 'avisos', AVISOS_LEIDOS: 'avisos_leidos' } });
  assert.equal(api2.capacidades.novedades, true);
  await assert.rejects(api2.avisosLeidos(REF, ['1; drop']), { codigo: 'MC_DATOS' });
  await assert.rejects(api2.avisos('no-uuid'), { codigo: 'MC_SIN_ACCESO' });
});

const MALO = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
function ctx(ref, extra = {}) {
  const resumen = demo.resumen(ref, extra); const sesion = demo.sesion(); const perm = permisos(resumen);
  const av = normalizarAvisos(demo.avisos(ref, extra), perm);
  for (const a of av.avisos) { a.titulo += MALO; a.texto += MALO; }
  return { cfg: CONFIG, api: { modo: 'demo', capacidades: {} }, sesion, empresa: sesion.empresas.find((e) => e.ref === ref), resumen, perm, tema: 'claro', version: 'x',
    abiertos: new Set(), solicitudes: new Set(), waMejora: 'https://wa.me/1', waEquipo: 'https://wa.me/1', enlaceDoc: () => null, avisos: av, pushEstado: 'inactivo', ...extra.ctx };
}
test('las vistas de Novedades y Avisos escapan todo dato del servidor', () => {
  for (const ref of Object.values(demo.refs)) {
    const c = ctx(ref);
    for (const s of [vInicio(c), vNovedades(c), bloqueNovedades(c), vMas(c), tarjetaAvisos(c)].map(String)) {
      assert.ok(!s.includes('<script>') && !/<img src=x/.test(s) && !/onerror=/.test(s));
    }
  }
});
test('Más → Avisos: botón explícito y texto de privacidad; consulta no ve «Confirmamos tu pago» en la lista', () => {
  const t = String(tarjetaAvisos(ctx(REF)));
  assert.ok(t.includes('data-accion="activar-avisos"') && t.includes('nunca muestran montos'));
  assert.ok(t.includes('Confirmamos tu pago'));
  assert.ok(!String(tarjetaAvisos(ctx(REF, { rol: 'consulta' }))).includes('Confirmamos tu pago'));
  assert.ok(String(tarjetaAvisos(ctx(REF, { ctx: { pushEstado: 'ios_instalar' } }))).includes('Agregar a pantalla de inicio'));
  assert.ok(String(tarjetaAvisos(ctx(REF, { ctx: { pushEstado: 'activo' } }))).includes('data-accion="probar-aviso"'));
  const sinNada = ctx(REF, { ctx: { pushEstado: 'apagado' } }); sinNada.avisos.correo = { activo: false, disponible: false };
  assert.equal(String(tarjetaAvisos(sinNada)), '', 'sin push ni correo disponibles no se promete nada');
});
test('Inicio muestra las Novedades del servidor con los no leídos', () => {
  const s = String(vInicio(ctx(REF)));
  assert.ok(s.includes('Novedades') && s.includes('sin leer') && s.includes('data-accion="aviso"'));
});
test('api demo: marcar leídos se refleja en la siguiente lectura', async () => {
  const api = crearApiDemo(demo, {});
  const antes = (await api.avisos(demo.refs.aromos)).no_leidos;
  await api.avisosLeidos(demo.refs.aromos, [201]);
  assert.equal((await api.avisos(demo.refs.aromos)).no_leidos, antes - 1);
});

// ── R2 (13-11) · correo ──
test('R2 normalizarAvisos: la preferencia de correo solo acepta booleanos verdaderos (fail-closed)', () => {
  assert.deepEqual(normalizarAvisos({ ok: true, avisos: [], correo: { activo: 'true', disponible: 1 } }, permTit).correo, { activo: false, disponible: false });
  assert.deepEqual(normalizarAvisos({ ok: true, avisos: [], correo: { activo: true, disponible: true } }, permTit).correo, { activo: true, disponible: true });
});
test('R2 Más → Avisos: interruptor de correo con el correo de la cuenta, horario 9–19 y agrupación; visible aunque el push esté apagado', () => {
  const c = ctx(REF, { ctx: { pushEstado: 'apagado' } });
  const t = String(tarjetaAvisos(c));
  assert.ok(t.includes('Avisos por correo') && t.includes('data-accion="correo-avisos"') && t.includes('data-valor="0"'));
  assert.ok(t.includes(c.sesion.cuenta.correo) && t.includes('Entre 9:00 y 19:00') && t.includes('nunca muestran montos'));
  assert.ok(!t.includes('activar-avisos'), 'con push apagado no se ofrece activar push');
  c.avisos.correo.activo = false;
  assert.ok(String(tarjetaAvisos(c)).includes('data-valor="1"'));
});
test('R2 api: preferencia de correo exige su RPC (NO_DISPONIBLE) y la demo la recuerda', async () => {
  const api = crearApiReal({ ...APAGADO, SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_x' });
  await assert.rejects(api.avisosCorreo(false), { codigo: 'NO_DISPONIBLE' });
  const d = crearApiDemo(demo, {});
  await d.avisosCorreo(false); assert.equal((await d.avisos(REF)).correo.activo, false);
  await d.avisosCorreo(true); assert.equal((await d.avisos(REF)).correo.activo, true);
});

// ── R3 (13-11) · cobranza ──
test('R3 cobranza: es categoría pagos (solo con Mi cuenta) y su ruta es Mi cuenta; el usuario adicional nunca la ve', () => {
  const j = { ok: true, avisos: [{ id: 7, evento: 'cobranza', titulo: 'Tienes una factura pendiente 📄', texto: 'x', ruta: 'cuenta' }] };
  assert.equal(normalizarAvisos(j, permTit).avisos[0].ruta, 'cuenta');
  assert.equal(normalizarAvisos(j, permCon).avisos.length, 0);
  assert.ok(demo.avisos(REF).avisos.some((a) => a.evento === 'cobranza'));
  assert.ok(!demo.avisos(REF, { rol: 'consulta' }).avisos.some((a) => a.evento === 'cobranza'));
});
test('R3 sw-avisos: los títulos de cobranza pasan la revisión de la pantalla bloqueada (sin cifras ni montos)', () => {
  for (const t of ['Tienes una factura pendiente 📄', 'Último día hábil del mes: ponte al día 📄', 'Hoy es el último día para evitar la suspensión ⚠️', 'Tu servicio fue suspendido ⏸️'])
    assert.equal(sw.avisoSeguro({ v: 1, titulo: t, cuerpo: 'Ponte al día a la brevedad. Revisa Mi cuenta en MiContadoor.', url: `/?e=${REF}#/cuenta`, tag: 'mc-cobranza-5' }).titulo, t);
});

// ── R4 (26-11) · rebase sobre main con el backend MC6A instalado ──
test('R4 api real: las 6 RPC de MC-6 van por POST al esquema mc con los parámetros exactos de la migración', async () => {
  const llamadas = []; const orig = globalThis.fetch;
  globalThis.fetch = async (url, op) => {
    llamadas.push({ url: String(url), op });
    if (String(url).includes('/auth/v1/token')) return new Response(JSON.stringify({ access_token: 't', refresh_token: 'r', expires_in: 3600 }), { status: 200 });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    const api = crearApiReal(CONFIG); await api.ingresar('a@b.cl', 'x');
    assert.equal(api.capacidades.novedades, true); assert.equal(api.capacidades.push, true);
    assert.equal(api.capacidades.terminosServidor, true, 'las capacidades de main siguen intactas');
    await api.avisos(REF); await api.avisosLeidos(REF, [7]); await api.avisosLeidos(REF, null); await api.avisosCorreo(true);
    await api.pushSuscribir({ endpoint: 'https://fcm.googleapis.com/x', p256dh: 'p', auth: 'a', plataforma: 'android' });
    await api.pushDesuscribir('https://fcm.googleapis.com/x', true); await api.pushProbar();
    const rpc = llamadas.filter((x) => x.url.includes('/rpc/'));
    assert.deepEqual(rpc.map((x) => x.url.split('/rpc/')[1]), ['avisos', 'avisos_leidos', 'avisos_leidos', 'avisos_correo', 'push_suscribir', 'push_desuscribir', 'push_probar']);
    assert.deepEqual(rpc.map((x) => JSON.parse(x.op.body)), [
      { p_ref: REF, p_limite: 30 }, { p_ref: REF, p_ids: [7] }, { p_ref: REF, p_ids: null }, { p_activo: true },
      { p_endpoint: 'https://fcm.googleapis.com/x', p_p256dh: 'p', p_auth: 'a', p_plataforma: 'android' },
      { p_endpoint: 'https://fcm.googleapis.com/x', p_todas: true }, {},
    ]);
    assert.ok(rpc.every((x) => x.op.method === 'POST' && x.op.headers['Content-Profile'] === 'mc'));
  } finally { globalThis.fetch = orig; }
});
test('R4 Más → Avisos: con el correo apagado en el servidor (disponible=false) se muestra «Pronto», sin botón de correo', () => {
  const c = ctx(REF, { ctx: { pushEstado: 'inactivo' } }); c.avisos.correo = { activo: true, disponible: false };
  const t = String(tarjetaAvisos(c));
  assert.ok(t.includes('Avisos por correo') && t.includes('Pronto'));
  assert.ok(!t.includes('data-accion="correo-avisos"'), 'no se puede cambiar una preferencia que el servidor no usa');
  assert.ok(!t.includes('y por correo'), 'no se promete correo en el texto de privacidad');
  assert.ok(t.includes('data-accion="activar-avisos"'));
});
