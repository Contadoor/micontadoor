// Capturas del modo DEMO con Chrome headless por DevTools Protocol (emula el celular de verdad: 390×844, táctil).
// Uso: node herramientas/capturas.mjs <carpeta_salida> [puerto]
// Requiere un servidor local en la raíz del repo: python3 -m http.server 8765 --bind 127.0.0.1
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = process.argv[2]; const PORT = process.argv[3] || '8765';
if (!OUT) { console.error('Falta la carpeta de salida'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const perfil = mkdtempSync(join(tmpdir(), 'mc-cap-'));
const DPORT = 9333;
const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${DPORT}`, `--user-data-dir=${perfil}`, 'about:blank'], { stdio: 'ignore' });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let ws; let id = 0; const pend = new Map(); const errores = [];
async function conectar() {
  for (let i = 0; i < 50; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${DPORT}/json/list`)).json(); const p = l.find((x) => x.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch { /* aún no */ }
    await espera(200);
  }
  throw new Error('Chrome no respondió');
}
function cmd(method, params = {}) {
  return new Promise((ok, mal) => { const n = ++id; pend.set(n, { ok, mal }); ws.send(JSON.stringify({ id: n, method, params })); });
}

const B = `http://127.0.0.1:${PORT}/?demo=1`;
const CEL = [
  ['01_ingreso', '', 'ingreso'], ['02_inicio', '&empresa=1', 'inicio'], ['03_reporte', '&empresa=1', 'reporte'], ['04_historial', '&empresa=1', 'historial'],
  ['05_reporte_con_pendientes_anteriores', '&empresa=2', 'reporte', true], ['06_mi_cuenta_por_pagar', '&empresa=1', 'cuenta'],
  ['07_mi_cuenta_pagado', '&empresa=1', 'cuenta/pagado', true], ['08_comprobante', '&empresa=1', 'pago/cp-f29-10'],
  ['09_preiva', '&empresa=1', 'preiva'], ['10_prerenta', '&empresa=1', 'prerenta'], ['11_trabajos', '&empresa=1', 'trabajos'],
  ['12_mas_mi_plan_apariencia', '&empresa=1', 'mas'], ['13_mi_acceso', '&empresa=1', 'acceso'],
  ['14_cumplimiento_inicio', '&empresa=2', 'inicio'], ['15_cumplimiento_preiva_bloqueado', '&empresa=2', 'preiva'],
  ['16_cumplimiento_prerenta_bloqueada', '&empresa=2', 'prerenta'], ['17_cumplimiento_mi_plan', '&empresa=2', 'mas'],
  ['18_usuario_adicional_inicio', '&empresa=3', 'inicio'], ['19_usuario_adicional_mi_cuenta', '&empresa=3', 'cuenta'],
  ['20_mi_cuenta_por_pagar_cumplimiento', '&empresa=2', 'cuenta'],
  ['24_trabajos_usuario_adicional', '&empresa=1&rol=consulta', 'trabajos'],
  ['21_activar_contrasena', '', 'activar'], ['22_recuperar', '', 'recuperar'], ['23_terminos', '&terminos=1', 'inicio'],
];
const WEB = [['01_ingreso', '', 'ingreso'], ['02_inicio', '&empresa=1', 'inicio'], ['03_reporte_con_pendientes', '&empresa=2', 'reporte'],
  ['04_mi_cuenta', '&empresa=1', 'cuenta'], ['05_preiva_bloqueado', '&empresa=2', 'preiva']];

async function foto(nombre, ancho, alto, movil, url, completa, oscuro) {
  await cmd('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: movil ? 2 : 1, mobile: movil });
  await cmd('Emulation.setTouchEmulationEnabled', movil ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: oscuro ? 'dark' : 'light' }] });
  await cmd('Page.navigate', { url: 'about:blank' }); await espera(100);
  await cmd('Page.navigate', { url }); await espera(1800);
  if (completa) {   // página completa: se agranda la ventana al alto real (así la barra inferior queda al pie, no en medio)
    const h = (await cmd('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight', returnByValue: true })).result.value;
    await cmd('Emulation.setDeviceMetricsOverride', { width: ancho, height: Math.max(alto, h), deviceScaleFactor: movil ? 2 : 1, mobile: movil });
    await espera(400);
  }
  const r = await cmd('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, nombre + '.png'), Buffer.from(r.data, 'base64'));
}

try {
  ws = new WebSocket(await conectar());
  await new Promise((ok) => ws.addEventListener('open', ok));
  ws.addEventListener('message', (m) => {
    const j = JSON.parse(m.data);
    if (j.id && pend.has(j.id)) { const p = pend.get(j.id); pend.delete(j.id); if (j.error) p.mal(new Error(j.error.message)); else p.ok(j.result); }
    if (j.method === 'Runtime.exceptionThrown') errores.push(j.params.exceptionDetails?.exception?.description || j.params.exceptionDetails?.text);
    if (j.method === 'Log.entryAdded' && j.params.entry.level === 'error') errores.push(j.params.entry.text + ' ' + (j.params.entry.url || ''));
    if (j.method === 'Runtime.consoleAPICalled' && j.params.type === 'error') errores.push(j.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Log.enable');
  for (const tema of ['claro', 'oscuro']) {
    for (const [n, p, r, comp] of CEL) await foto(`cel390_${tema}_${n}`, 390, 844, true, `${B}&tema=${tema}${p}#/${r}`, comp, tema === 'oscuro');
    for (const [n, p, r] of WEB) await foto(`web1280_${tema}_${n}`, 1280, 860, false, `${B}&tema=${tema}${p}#/${r}`, false, tema === 'oscuro');
  }
  // Automático: sigue al celular (prefers-color-scheme: dark) sin parámetro de tema
  await foto('cel390_automatico_con_celular_oscuro_02_inicio', 390, 844, true, `${B}&empresa=1#/inicio`, false, true);
  console.log(`Listo: ${CEL.length * 2 + WEB.length * 2 + 1} capturas en ${OUT}`);
  console.log(errores.length ? 'ERRORES DE CONSOLA:\n' + [...new Set(errores)].join('\n') : 'Consola sin errores.');
} finally {
  try { ws?.close(); } catch { /* */ }
  ch.kill('SIGTERM'); await espera(300); rmSync(perfil, { recursive: true, force: true });
}
