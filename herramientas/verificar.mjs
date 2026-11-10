// Revisión ANTES de publicar: secretos, CSP coherente con la config, sin estilos/scripts en línea, sin datos reales conocidos.
// Uso: node herramientas/verificar.mjs   (sale con código 1 si hay un problema)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../js/config.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const problemas = []; const avisos = [];
const archivos = [];
(function rec(d) {
  for (const n of readdirSync(d)) {
    if (['.git', 'node_modules'].includes(n)) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) rec(p); else archivos.push(p);
  }
})(RAIZ);
const texto = archivos.filter((p) => ['.js', '.mjs', '.html', '.css', '.json', '.webmanifest', '.md', '.sh', ''].includes(extname(p)));

// 1. Secretos: service_role, sb_secret_, claves privadas, JWT con role distinto de anon.
for (const p of texto) {
  const s = readFileSync(p, 'utf8'); const rel = p.slice(RAIZ.length);
  if (rel.startsWith('herramientas/verificar.mjs')) continue;
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(s)) problemas.push(`${rel}: contiene una clave sb_secret_`);
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s)) problemas.push(`${rel}: contiene una clave privada`);
  if (/SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"]+['"]/.test(s)) problemas.push(`${rel}: asigna una SERVICE_ROLE_KEY`);
  for (const jwt of s.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) || []) {
    try {
      const carga = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
      if (carga.role !== 'anon') problemas.push(`${rel}: JWT con role "${carga.role}" (solo se permite la clave anon)`);
    } catch { problemas.push(`${rel}: JWT ilegible`); }
  }
}
if (CONFIG.SUPABASE_ANON_KEY && !/^(eyJ|sb_publishable_)/.test(CONFIG.SUPABASE_ANON_KEY)) problemas.push('config.js: SUPABASE_ANON_KEY no parece una clave pública (anon / sb_publishable_)');

// 2. CSP: connect-src = proyecto configurado; sin 'unsafe-inline' / 'unsafe-eval'; sin <script> ni style="" en línea.
for (const h of ['index.html', 'activar/index.html', '404.html']) {
  const s = readFileSync(join(RAIZ, h), 'utf8');
  const csp = (s.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
  if (!csp) { problemas.push(`${h}: sin CSP`); continue; }
  if (/unsafe-(inline|eval)/.test(csp)) problemas.push(`${h}: la CSP permite unsafe-inline/eval`);
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(s)) problemas.push(`${h}: script en línea`);
  if (/\sstyle="/i.test(s)) problemas.push(`${h}: estilo en línea`);
  if (h === 'index.html') {
    if (CONFIG.SUPABASE_URL && !csp.includes(CONFIG.SUPABASE_URL)) problemas.push(`index.html: connect-src no incluye ${CONFIG.SUPABASE_URL}`);
    if (csp.includes('TU-PROYECTO')) (CONFIG.SUPABASE_URL ? problemas : avisos).push('index.html: connect-src todavía tiene el marcador TU-PROYECTO.supabase.co');
  }
}
for (const p of texto.filter((x) => /\/js\/.*\.js$/.test(x))) {
  const s = readFileSync(p, 'utf8');
  if (/\sstyle="/.test(s)) problemas.push(`${p.slice(RAIZ.length)}: genera style="" (lo bloquea la CSP)`);
  if (/\beval\(|new Function\(/.test(s)) problemas.push(`${p.slice(RAIZ.length)}: usa eval/Function`);
}

// 3. Datos reales: nada de la dirección personal ni RUT de clientes conocidos; la demo solo usa RUT 76.000.00x.
for (const p of texto) {
  const s = readFileSync(p, 'utf8'); const rel = p.slice(RAIZ.length);
  if (rel.startsWith('herramientas/verificar.mjs')) continue;
  if (/Laguna del Inca/i.test(s)) problemas.push(`${rel}: contiene una dirección personal`);
}
const ruts = (readFileSync(join(RAIZ, 'js/demo.js'), 'utf8').match(/\d{1,2}\.\d{3}\.\d{3}-[\dkK]/g) || []).filter((r) => !/^76\.000\.00\d-/.test(r));
if (ruts.length) problemas.push(`demo.js: RUT que no son ficticios: ${ruts.join(', ')}`);

// 4. Avisos de publicación
if (!CONFIG.SUPABASE_URL) avisos.push('config.js: SUPABASE_URL vacío → el sitio solo funciona en modo demo');
if (CONFIG.RPC.SOLICITUD_PAGO === null) avisos.push('"Ya transferí" / "Ya lo pagué" quedan en «Próximamente» (no hay RPC en el contrato mc)');
if (CONFIG.AVISOS_PUSH) problemas.push('config.js: AVISOS_PUSH debe ser false en la V1');

console.log(problemas.length ? 'PROBLEMAS:\n - ' + problemas.join('\n - ') : 'Sin problemas de seguridad detectados.');
if (avisos.length) console.log('Avisos:\n - ' + avisos.join('\n - '));
process.exit(problemas.length ? 1 : 0);
