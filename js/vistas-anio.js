// «Tu año con el SII» (REPORTE-HISTORIAL-SII, 24-11-2026): los 12 meses del año con compras, ventas y el F29 de cada mes
// (IVA o remanente, retenciones, impuesto único, PPM con su %, total) y el estado de pago. Contrato: mc.mis_impuestos_anio.
// Todo escapado con html``. Sin dato = «—» o «No disponible», nunca $0. Los meses futuros se muestran vacíos.
import { html, clp, fecha, hora, MESES } from './util.js';
import { I } from './iconos.js';
import { ESTADOS_PAGO } from './datos.js';
import { sub, vacio } from './vistas-comunes.js';
import { seg } from './vistas-impuestos.js';

const Mes = (m) => MESES[m - 1].replace(/^./, (c) => c.toUpperCase());
const F29_TXT = { declarado: 'Declarado en el SII ✓', en_revision: 'En revisión del SII', observado: 'Con observación', no_declarado: 'No declarado', por_declarar: 'Por declarar', sin_dato: 'Sin dato', futuro: '' };
const tasa = (t) => (t === null || t === undefined ? '' : String(t).replace('.', ',') + ' %');
const v = (x) => (x === null || x === undefined ? '—' : clp(x));

function chipPago(p) {
  if (!p) return '';
  const [c, t] = ESTADOS_PAGO[p.estado] || ESTADOS_PAGO.sin_informacion;
  return html`<span class="chip ${c}">${t}</span>`;
}
const FUENTE = { sii: 'Según tu F29 en el SII', contadoor: 'Según el registro de Contadoor' };

function mes(m) {
  const f = m.f29;
  if (m.futuro || (m.en_curso && !f.montos)) {
    return html`<div class="an-mes fut"><div class="an-cab"><b>${Mes(m.mes)}</b><span class="xs">${m.en_curso ? 'Mes en curso' : 'Aún no llega'}</span></div></div>`;
  }
  const imp = !f.montos ? null : f.resultado === 'remanente' ? html`<span class="verde">A tu favor ${clp(f.remanente)}</span>` : clp(f.iva);
  return html`<details class="an-mes"><summary class="an-cab"><b>${Mes(m.mes)}</b>
      <span class="an-tot">${f.montos ? clp(f.total) : html`<span class="xs">${F29_TXT[f.estado] || 'Sin dato'}</span>`}</span>${chipPago(m.pago)}</summary>
    <div class="an-det">
      <div class="fila"><span>Ventas${m.ventas ? html` <span class="xs">(${m.ventas.documentos} doc.)</span>` : ''}</span><b>${m.ventas ? clp(m.ventas.neto + (m.ventas.exento || 0)) : '—'}</b></div>
      <div class="fila"><span>Compras${m.compras ? html` <span class="xs">(${m.compras.documentos} doc.)</span>` : ''}</span><b>${m.compras ? clp(m.compras.neto + (m.compras.exento || 0)) : '—'}</b></div>
      <div class="fila"><span>${f.resultado === 'remanente' ? 'Remanente de IVA' : 'IVA del mes'}</span><b>${imp === null ? '—' : imp}</b></div>
      <div class="fila"><span>Retenciones</span><b>${v(f.retenciones)}</b></div>
      <div class="fila"><span>Impuesto único</span><b>${v(f.impuesto_unico)}</b></div>
      <div class="fila"><span>PPM${f.ppm_tasa !== null ? html` <span class="xs">(${tasa(f.ppm_tasa)})</span>` : ''}</span><b>${v(f.ppm)}</b></div>
      ${f.recargos ? html`<div class="fila"><span>Reajustes, intereses y multas</span><b>${clp(f.recargos)}</b></div>` : ''}
      <div class="fila total"><span><b>Total del F29</b></span><b>${v(f.total)}</b></div>
      <p class="xs m0 mt8">${F29_TXT[f.estado] || 'Sin dato'}${f.rectificada ? ' · rectificado' : ''}${m.pago?.fuente ? ' · ' + FUENTE[m.pago.fuente] : ''}${m.pago?.fecha ? ' · pagado el ' + fecha(m.pago.fecha, { anio: true }) : ''}</p>
    </div></details>`;
}

// ── Gráficos (Luciano 28-11): ventas vs. compras mes a mes y la diferencia, con los datos del SII que trae Cartapra ──
// Ventas y compras = neto + exento (lo afecto y lo exento). Mes sin dato = sin barra (nunca $0 inventado).
const tot = (l) => (l ? (l.neto || 0) + (l.exento || 0) : null);
const corto = (x) => { const a = Math.abs(x); const s = x < 0 ? '−' : '';
  return a >= 1e6 ? s + '$' + (a / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + 'M' : a >= 1e3 ? s + '$' + Math.round(a / 1e3) + 'K' : s + '$' + Math.round(a); };
const INI = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
export function resumenNegocio(meses) {
  const filas = meses.map((m) => ({ mes: m.mes, v: m.futuro ? null : tot(m.ventas), c: m.futuro ? null : tot(m.compras), parcial: m.en_curso }));
  const con = filas.filter((f) => f.v !== null || f.c !== null);
  const ventas = con.reduce((s, f) => s + (f.v || 0), 0); const compras = con.reduce((s, f) => s + (f.c || 0), 0);
  return { filas, meses: con.length, ventas, compras, dif: ventas - compras, margen: ventas > 0 ? Math.round(((ventas - compras) / ventas) * 1000) / 10 : null };
}
function graficoBarras(r) {
  const W = 340, H = 170, top = 14, base = 140, x0 = 6, paso = (W - 12) / 12, bw = paso * 0.34;
  const max = Math.max(1, ...r.filas.map((f) => Math.max(f.v || 0, f.c || 0)));
  const y = (val) => base - (val / max) * (base - top);
  const barras = r.filas.map((f, i) => { const cx = x0 + i * paso + paso / 2;
    return html`${f.v !== null ? html`<rect class="g-v${f.parcial ? ' parcial' : ''}" x="${(cx - bw - 1).toFixed(1)}" y="${y(f.v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(base - y(f.v)).toFixed(1)}" rx="2"><title>${Mes(f.mes)} · ventas ${clp(f.v)}</title></rect>` : ''}
      ${f.c !== null ? html`<rect class="g-c${f.parcial ? ' parcial' : ''}" x="${(cx + 1).toFixed(1)}" y="${y(f.c).toFixed(1)}" width="${bw.toFixed(1)}" height="${(base - y(f.c)).toFixed(1)}" rx="2"><title>${Mes(f.mes)} · compras ${clp(f.c)}</title></rect>` : ''}
      <text class="g-eje" x="${cx.toFixed(1)}" y="${base + 14}" text-anchor="middle">${INI[f.mes - 1]}</text>`; });
  return html`<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ventas y compras de cada mes">
    <line class="g-base" x1="${x0}" y1="${base}" x2="${W - 6}" y2="${base}"></line>
    <text class="g-eje" x="${x0}" y="${top - 3}">${corto(max)}</text>${barras}</svg>`;
}
function graficoDiferencia(r) {
  const W = 340, H = 130, top = 10, bot = 108, x0 = 6, paso = (W - 12) / 12, bw = paso * 0.55;
  const vals = r.filas.map((f) => (f.v === null && f.c === null ? null : (f.v || 0) - (f.c || 0)));
  const max = Math.max(1, ...vals.filter((v) => v !== null).map((v) => Math.abs(v)));
  const hayNeg = vals.some((v) => v !== null && v < 0);
  const cero = hayNeg ? top + (bot - top) / 2 : bot;
  const esc = hayNeg ? (bot - top) / 2 : bot - top;
  const barras = vals.map((v, i) => { const cx = x0 + i * paso + paso / 2; if (v === null) return html`<text class="g-eje" x="${cx.toFixed(1)}" y="${bot + 14}" text-anchor="middle">${INI[i]}</text>`;
    const h = Math.abs(v) / max * esc; const yy = v >= 0 ? cero - h : cero;
    return html`<rect class="${v >= 0 ? 'g-pos' : 'g-neg'}${r.filas[i].parcial ? ' parcial' : ''}" x="${(cx - bw / 2).toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" rx="2"><title>${Mes(i + 1)} · diferencia ${clp(v)}</title></rect>
      <text class="g-eje" x="${cx.toFixed(1)}" y="${bot + 14}" text-anchor="middle">${INI[i]}</text>`; });
  return html`<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Diferencia entre ventas y compras de cada mes">
    <line class="g-base" x1="${x0}" y1="${cero.toFixed(1)}" x2="${W - 6}" y2="${cero.toFixed(1)}"></line>${barras}</svg>`;
}
export function tarjetasNegocio(n) {
  const r = resumenNegocio(n.meses);
  if (!r.meses) return '';
  return html`<div class="card negocio"><div class="hd"><h3 class="t15">Ventas y compras ${n.anio}</h3><span class="xs">${r.meses} ${r.meses === 1 ? 'mes' : 'meses'} con datos</span></div>
      <div class="leyenda"><span><i class="pt g-v"></i>Ventas</span><span><i class="pt g-c"></i>Compras</span></div>
      ${graficoBarras(r)}
      <div class="kpis"><div class="kpi"><small>Ventas</small><b>${clp(r.ventas)}</b></div><div class="kpi"><small>Compras</small><b>${clp(r.compras)}</b></div></div></div>
    <div class="card negocio"><div class="hd"><h3 class="t15">Diferencia ventas − compras</h3>${r.margen !== null ? html`<span class="chip ${r.dif >= 0 ? 'c-ok' : 'c-venc'}">${String(r.margen).replace('.', ',')} % de tus ventas</span>` : ''}</div>
      ${graficoDiferencia(r)}
      <div class="kpis"><div class="kpi"><small>En el año</small><b class="${r.dif >= 0 ? 'verde' : 'rojo'}">${clp(r.dif)}</b></div></div>
      <p class="xs m0 mt8">Es una referencia con tus facturas del SII (afecto + exento, sin IVA). No es tu utilidad: no incluye sueldos, honorarios, arriendos sin factura ni otros gastos. ${r.filas.some((f) => f.parcial && (f.v !== null || f.c !== null)) ? 'El mes en curso va parcial.' : ''}</p></div>`;
}

/** Pantalla «Tu año con el SII». n = normalizarImpuestosAnio(respuesta) | {estado:'cargando'|'error'} | null (RPC no configurada). */
export function vAnio(ctx, n) {
  const anioAct = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric' }).format(new Date()));
  const anio = n?.anio || ctx.anioPedido || anioAct;
  const selAnio = html`<div class="seg mb" role="group" aria-label="Año">${[anioAct, anioAct - 1].map((a) => html`<button type="button" data-accion="anio" data-anio="${a}" class="${a === anio ? 'on' : ''}" aria-pressed="${a === anio}">${a}</button>`)}</div>`;
  let cuerpo;
  if (!n) cuerpo = vacio(I.calendario, 'Tu año con el SII aún no está publicado', 'Muy pronto verás aquí los 12 meses de tu año: compras, ventas, tu F29 y si cada mes está pagado.');
  else if (n.estado === 'cargando') cuerpo = html`<div class="cargando" role="status" aria-label="Cargando"><div class="spin"></div></div>`;
  else if (n.estado === 'error') cuerpo = vacio(I.calendario, 'No pudimos cargar tu año', 'Vuelve a intentarlo en unos minutos. Si sigue igual, escríbenos.');
  else if (n.estado === 'no_conectado') cuerpo = vacio(I.calendario, 'Tu empresa aún no está conectada al SII', 'Cuando tu equipo Contadoor la conecte, aquí verás los 12 meses de tu año con tus datos del SII.');
  else {
    const t = n.totales;
    cuerpo = html`<div class="card osc"><div class="hd"><h2>Tus F29 de ${n.anio}</h2><span class="chip c-proy">${t.meses_f29} de 12 meses</span></div>
        <div class="big">${clp(t.total)}</div>
        <div class="sm">Total declarado en el SII · PPM del año <b class="claro">${clp(t.ppm)}</b></div>
        ${n.datos_al ? html`<div class="act"><i></i>Datos del SII al ${fecha(n.datos_al, { anio: true })}, ${hora(n.datos_al)}</div>` : ''}</div>
      ${tarjetasNegocio(n)}
      <div class="card an-lista"><div class="hd"><h3 class="t15">Mes a mes</h3><span class="xs">Toca un mes para ver el detalle</span></div>${n.meses.map(mes)}</div>
      <div class="card an-ley"><h3 class="t15">Qué significa cada estado</h3>
        <div class="estados"><span><span class="chip c-ok">Pagado</span> tenemos el pago registrado</span><span><span class="chip c-pend">Postergado</span> el IVA se pagará después, con autorización del SII</span>
        <span><span class="chip c-venc">Pendiente de pago</span> aún falta pagar o transferir</span><span><span class="chip c-venc">Girado</span> la deuda está en un convenio con la Tesorería</span>
        <span><span class="chip c-gris">Sin información</span> aún no tenemos el comprobante; si ya pagaste, envíanoslo</span></div></div>
      <p class="xs c">Montos tal como se declararon en el SII. Ante cualquier duda, escríbele a tu analista.</p>`;
  }
  return html`${sub('Tu año con el SII', { volver: 'preiva' })}<div class="sec">${seg('impuestos-historial', true)}${selAnio}${cuerpo}</div>`;
}
