// MiContadoor · utilidades puras (sin DOM). Todo texto que viene de datos pasa por esc() o por la plantilla html``.

const MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '=': '&#61;' };

/** Escapa cualquier valor para insertarlo en HTML (texto o atributo entre comillas). null/undefined → ''. */
export function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"'`=]/g, (c) => MAPA[c]);
}

/** HTML ya seguro (solo lo producen html`` y raw de constantes del propio código). */
export class Seguro {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

/** Para fragmentos CONSTANTES del código (íconos SVG). Nunca usar con datos. */
export const raw = (s) => new Seguro(String(s));

function pieza(v) {
  if (v instanceof Seguro) return v.s;
  if (Array.isArray(v)) return v.map(pieza).join('');
  if (v === false || v === null || v === undefined) return '';
  return esc(v);
}

/** Plantilla que escapa cada valor interpolado. Los arreglos se unen; false/null no imprimen nada. */
export function html(partes, ...valores) {
  let out = partes[0];
  for (let i = 0; i < valores.length; i++) out += pieza(valores[i]) + partes[i + 1];
  return new Seguro(out);
}

/** Entero de pesos válido o null (sin dato = "No disponible", nunca $0). */
export function pesos(n) {
  if (n === null || n === undefined || n === '') return null;
  const x = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x);
}

/** $1.234.567 · negativos con "− $" · sin dato → "No disponible". */
export function clp(n, { aprox = false } = {}) {
  const x = pesos(n);
  if (x === null) return 'No disponible';
  const abs = String(Math.abs(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (x < 0 ? '− ' : '') + (aprox ? '≈ ' : '') + '$' + abs;
}

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** '2026-10' → { anio: 2026, mes: 10 } o null. */
export function parsePeriodo(p) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(p ?? ''));
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return { anio: Number(m[1]), mes };
}
export function mesDe(p) { const x = parsePeriodo(p); return x ? MESES[x.mes - 1] : ''; }
export function periodoLargo(p) { const x = parsePeriodo(p); return x ? `${MESES[x.mes - 1]} ${x.anio}` : ''; }
export function periodoTitulo(p) { const s = periodoLargo(p); return s ? s[0].toUpperCase() + s.slice(1) : ''; }
export function comparaPeriodo(a, b) { return String(a).localeCompare(String(b)); }

/** Fecha 'YYYY-MM-DD' (sin zona) o ISO con hora → 'dd-mm' / 'dd-mm-aaaa', en hora de Chile. */
export function fecha(v, { anio = false } = {}) {
  if (!v) return '';
  const solo = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  let d, m, a;
  if (solo) { a = solo[1]; m = solo[2]; d = solo[3]; }
  else {
    const t = new Date(v);
    if (Number.isNaN(t.getTime())) return '';
    const f = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(t);
    d = f.find((x) => x.type === 'day').value; m = f.find((x) => x.type === 'month').value; a = f.find((x) => x.type === 'year').value;
  }
  return anio ? `${d}-${m}-${a}` : `${d}-${m}`;
}

/** Hora de Chile 'HH:MM' de un ISO con hora. */
export function hora(v) {
  const t = new Date(v);
  if (!v || Number.isNaN(t.getTime())) return '';
  return new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false }).format(t);
}

/** Solo URLs https a hosts permitidos (o rutas propias). Cualquier otra cosa → null (no se enlaza). */
export function urlSegura(u, hostsPermitidos = []) {
  if (typeof u !== 'string' || !u) return null;
  if (/^\/(?!\/)/.test(u)) return u;
  try {
    const x = new URL(u);
    if (x.protocol !== 'https:') return null;
    if (!hostsPermitidos.includes(x.hostname)) return null;
    return x.href;
  } catch { return null; }
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Primer nombre para el saludo. */
export function primerNombre(n) {
  const s = String(n ?? '').trim().split(/\s+/)[0] || '';
  return s.slice(0, 40);
}

/** Porcentaje entero 0–100 (para barras). */
export function pct(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}
