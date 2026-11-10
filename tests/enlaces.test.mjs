// Pruebas de los enlaces de los correos S2 (invite) y S4 (recovery): ?token_hash=…&type=… → verifyOtp (POST /auth/v1/verify).
// Evidencia 2 de MC_AUTH R2. Sin red y sin tocar el código de la app: tomarEnlace() se extrae del fuente de js/app.js
// y se ejecuta en un contexto aislado (node:vm) con location/history/st simulados. verificarEnlace() se prueba con
// crearApiReal y un fetch falso que registra la llamada. Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { crearApiReal } from '../js/api.js';
import { mensajeError } from '../js/datos.js';

// ── tomarEnlace() tal como está en js/app.js ──────────────────────────────────────────────────────────────────────────
const fuente = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const ini = fuente.indexOf('async function tomarEnlace()');
const fin = fuente.indexOf('\n}\n', ini);
assert.ok(ini > 0 && fin > ini, 'no se encontró tomarEnlace() en js/app.js');
const codigoTomarEnlace = fuente.slice(ini, fin + 2);

const TH = 'a'.repeat(56);   // forma de un token_hash de GoTrue: sha224 en hexadecimal (56 caracteres)

/** Arma un navegador falso con la URL dada y una api que registra las llamadas. */
function entorno(url, { verificar } = {}) {
  const u = new URL(url);
  const llamadas = [];
  const historial = [];
  const api = {
    async verificarEnlace(th, tipo) { llamadas.push(['verificarEnlace', th, tipo]); if (verificar) return verificar(th, tipo); },
    async tomarFragmento(...a) { llamadas.push(['tomarFragmento', ...a]); },
  };
  const ctx = {
    URLSearchParams,
    q: new URLSearchParams(u.search),
    esDemo: false,
    location: { pathname: u.pathname, search: u.search, hash: u.hash },
    history: { replaceState: (_s, _t, nueva) => historial.push(nueva) },
    st: { api, mensaje: null, tipoEnlace: 'invite' },
    mensajeError,
  };
  vm.createContext(ctx);
  vm.runInContext(codigoTomarEnlace + '\n;globalThis.tomarEnlace = tomarEnlace;', ctx);
  return { ctx, llamadas, historial, correr: () => ctx.tomarEnlace() };
}

test('enlace de invitación (S2): llama a verificarEnlace(token_hash, "invite") y saca el token de la barra', async () => {
  const e = entorno(`https://mi.contadoor.cl/?token_hash=${TH}&type=invite`);
  assert.equal(await e.correr(), true);
  assert.deepEqual(e.llamadas, [['verificarEnlace', TH, 'invite']]);
  assert.equal(e.ctx.st.tipoEnlace, 'invite');
  assert.equal(e.ctx.st.mensaje, null);
  assert.deepEqual(e.historial, ['/#/activar']);                     // sin ?token_hash en la barra ni en el historial
});

test('enlace de recuperación (S4): llama a verificarEnlace(token_hash, "recovery")', async () => {
  const e = entorno(`https://mi.contadoor.cl/?token_hash=${TH}&type=recovery`);
  assert.equal(await e.correr(), true);
  assert.deepEqual(e.llamadas, [['verificarEnlace', TH, 'recovery']]);
  assert.equal(e.ctx.st.tipoEnlace, 'recovery');
  assert.deepEqual(e.historial, ['/#/activar']);
});

test('enlace sin type: NO se llama a Auth (tomarEnlace devuelve false y el arranque sigue normal)', async () => {
  const e = entorno(`https://mi.contadoor.cl/?token_hash=${TH}`);
  assert.equal(await e.correr(), false);
  assert.deepEqual(e.llamadas, []);
  // Comportamiento actual documentado: la URL NO se limpia en este caso (ver hallazgo H-PWA-2 en R2).
  assert.deepEqual(e.historial, []);
});

test('token inválido o vencido (Auth responde error): mensaje ENLACE y vuelta a #/ingreso, sin sesión', async () => {
  const e = entorno(`https://mi.contadoor.cl/?token_hash=${TH}&type=invite`, {
    verificar: () => { throw Object.assign(new Error('ENLACE'), { codigo: 'ENLACE' }); },
  });
  assert.equal(await e.correr(), true);
  assert.deepEqual(e.llamadas, [['verificarEnlace', TH, 'invite']]);
  assert.equal(e.ctx.st.mensaje.texto, mensajeError('ENLACE'));
  assert.deepEqual(e.historial, ['/#/activar', '/#/ingreso']);
});

test('type desconocido (p. ej. magiclink): tomarEnlace lo pasa, pero verificarEnlace real lo rechaza sin red', async () => {
  const api = crearApiReal({ SUPABASE_URL: 'https://ejemplo.supabase.co', SUPABASE_ANON_KEY: 'clave-publica-de-prueba', RPC: {} });
  const e = entorno(`https://mi.contadoor.cl/?token_hash=${TH}&type=magiclink`, { verificar: (th, t) => api.verificarEnlace(th, t) });
  assert.equal(await e.correr(), true);
  assert.equal(e.ctx.st.tipoEnlace, 'invite');                       // pantalla por defecto…
  assert.equal(e.ctx.st.mensaje.texto, mensajeError('ENLACE'));       // …pero con error: nunca hay sesión
});

test('error en el fragmento (#error=access_denied…): mensaje ENLACE sin llamar a Auth', async () => {
  const e = entorno('https://mi.contadoor.cl/#error=access_denied&error_code=otp_expired');
  assert.equal(await e.correr(), true);
  assert.deepEqual(e.llamadas, []);
  assert.equal(e.ctx.st.mensaje.texto, mensajeError('ENLACE'));
  assert.deepEqual(e.historial, ['/#/ingreso']);
});

test('sin parámetros: tomarEnlace no hace nada', async () => {
  const e = entorno('https://mi.contadoor.cl/');
  assert.equal(await e.correr(), false);
  assert.deepEqual(e.llamadas, []);
  assert.deepEqual(e.historial, []);
});

// ── verificarEnlace() de la api real: contrato con GoTrue POST /auth/v1/verify ────────────────────────────────────────
function apiConFetch(respuesta) {
  const pedidos = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, op) => { pedidos.push({ url, op }); return respuesta(); };
  const api = crearApiReal({ SUPABASE_URL: 'https://ejemplo.supabase.co', SUPABASE_ANON_KEY: 'clave-publica-de-prueba', RPC: {} });
  return { api, pedidos, restaurar: () => { globalThis.fetch = original; } };
}
const okJson = (j, status = 200) => ({ ok: status < 400, status, json: async () => j });

for (const tipo of ['invite', 'recovery']) {
  test(`verificarEnlace(${tipo}): POST /auth/v1/verify con SOLO {type, token_hash} (GoTrue rechaza email/redirect_to junto a token_hash)`, async () => {
    const f = apiConFetch(() => okJson({ access_token: 'acc', refresh_token: 'ref', expires_in: 3600 }));
    try {
      globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
      await f.api.verificarEnlace(TH, tipo);
      assert.equal(f.pedidos.length, 1);
      assert.equal(f.pedidos[0].url, 'https://ejemplo.supabase.co/auth/v1/verify');
      assert.equal(f.pedidos[0].op.method, 'POST');
      assert.deepEqual(JSON.parse(f.pedidos[0].op.body), { type: tipo, token_hash: TH });
      assert.equal(f.pedidos[0].op.headers.apikey, 'clave-publica-de-prueba');
      assert.equal(f.pedidos[0].op.headers.Authorization, undefined);   // sin Bearer: el enlace es la credencial
      assert.equal(f.api.tieneSesion(), true);
    } finally { f.restaurar(); delete globalThis.localStorage; }
  });
}

test('verificarEnlace: 403 otp_expired de GoTrue → ErrorApi ENLACE y sin sesión', async () => {
  const f = apiConFetch(() => okJson({ code: 403, error_code: 'otp_expired', msg: 'Email link is invalid or has expired' }, 403));
  try {
    await assert.rejects(f.api.verificarEnlace(TH, 'recovery'), (e) => e.codigo === 'ENLACE');
    assert.equal(f.pedidos.length, 1);
    assert.equal(f.api.tieneSesion(), false);
  } finally { f.restaurar(); }
});

test('verificarEnlace: token con forma inválida o type no permitido → ENLACE SIN llamar a la red', async () => {
  const f = apiConFetch(() => { throw new Error('no debía llamar a la red'); });
  try {
    for (const [th, tipo] of [['corto', 'invite'], ['<script>xxxxxxxx', 'invite'], [TH, 'magiclink'], [TH, 'signup'], [TH, 'email'], [TH, ''], ['', 'invite'], [TH + '&type=x', 'invite']]) {
      await assert.rejects(f.api.verificarEnlace(th, tipo), (e) => e.codigo === 'ENLACE', `${th.slice(0, 12)}… / ${tipo}`);
    }
    assert.equal(f.pedidos.length, 0);
  } finally { f.restaurar(); }
});

test('activar/index.html y js/redir.js conservan ?token_hash&type y el #fragmento al pasar a la app', () => {
  const redir = readFileSync(new URL('../js/redir.js', import.meta.url), 'utf8');
  assert.match(redir, /location\.replace\('\/' \+ location\.search \+ location\.hash\)/);
  const activar = readFileSync(new URL('../activar/index.html', import.meta.url), 'utf8');
  assert.match(activar, /<script src="\/js\/redir\.js"><\/script>/);
  assert.match(activar, /name="referrer" content="no-referrer"/);    // el token no se filtra por Referer
});
