// «Tu IVA del mes» (MC-IMP-1): IVA a pagar y cómo se calcula, estado del F29, recomendaciones y observaciones del SII.
// Diseño: maqueta aprobada por Luciano el 19-11-2026 (descargas/f2b_preiva_cartapra/maqueta_micontadoor.html). Todo escapado con html``.
import { html, clp, fecha, hora, mesDe, periodoTitulo, MESES, parsePeriodo } from './util.js';
import { I } from './iconos.js';
import { recomendacionesImpuestos, totalMostrado } from './datos.js';
import { sub, teaser, vacio } from './vistas-comunes.js';

const ESTADO_F29 = {
  declarado: ['c-ok', 'Declarado ✓'], en_revision: ['c-rev', 'En revisión del SII'], observado: ['c-venc', 'Con observación'],
  no_declarado: ['c-venc', 'No declarado'], por_declarar: ['c-pend', 'Por declarar'], sin_dato: ['c-gris', 'Sin dato'],
};
const FUENTE = { sii_declarado: 'Declarado en el SII', reporte: 'Confirmado por tu analista', preiva: 'Confirmado por tu analista' };
const mesSig = (p) => { const x = parsePeriodo(p); return x ? MESES[x.mes % 12] : ''; };
const pct = (t) => (t === null || t === undefined ? '' : String(t).replace('.', ','));
const hoyChile = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());

function seg(actual) {
  return html`<div class="seg" role="group" aria-label="Proyecciones"><button type="button" data-ir="preiva" class="${actual === 'preiva' ? 'on' : ''}" aria-pressed="${actual === 'preiva'}">Tu IVA</button><button type="button" data-ir="prerenta" class="${actual === 'prerenta' ? 'on' : ''}" aria-pressed="${actual === 'prerenta'}">Pre-Renta</button></div>`;
}

function linea(t, xs, v, clase = '') {
  return html`<div class="iv-paso ${clase}"><div class="t"><b>${t}</b>${xs ? html`<span class="xs">${xs}</span>` : ''}</div><div class="v">${v}</div></div>`;
}

function calculo(n) {
  const e = n.est;
  const filas = [linea('IVA de tus ventas', 'Débito fiscal', clp(e.debito))];
  filas.push(linea('IVA de tus compras', 'Crédito fiscal (facturas aceptadas)', e.credito === null ? 'No disponible' : '− ' + clp(e.credito), 'menos'));
  if (e.remanente) {
    const mesRem = mesDe(e.remanente.periodo);
    filas.push(linea('Remanente a tu favor', `Saldo del F29 de ${mesRem} (${clp(e.remanente.cod77)}), actualizado por UTM`, e.remanente.monto ? '− ' + clp(e.remanente.monto) : '$0', 'menos'));
  } else {
    filas.push(linea('Remanente a tu favor', 'Lo confirma tu analista con el F29 anterior', 'Por confirmar'));
  }
  filas.push(linea('IVA del mes', e.remanente_siguiente > 0 ? `Queda ${clp(e.remanente_siguiente)} a tu favor para el mes siguiente` : '', e.iva_pagar === null ? 'Por confirmar' : clp(e.iva_pagar), 'res'));
  filas.push(linea('PPM', e.ppm_tasa !== null && e.ppm_base !== null ? `${pct(e.ppm_tasa)} % de tus ventas del mes (${clp(e.ppm_base)})` : 'Falta la tasa de PPM: la confirma tu analista',
    e.ppm === null ? 'Por confirmar' : '+ ' + clp(e.ppm)));
  filas.push(linea('Total del F29', '', e.total === null ? 'Por confirmar' : clp(e.total), 'res'));
  return html`<div class="card"><h3 class="t15">Cómo se calcula</h3>${filas}</div>`;
}

function estadoF29(n) {
  const actual = n.f29.find((x) => x.periodo === n.periodo);
  const prev = n.f29.filter((x) => x.periodo !== n.periodo).slice(0, 6);
  const [ca, ta] = ESTADO_F29[actual?.estado] || ESTADO_F29.sin_dato;
  return html`<div class="card"><div class="hd"><h3 class="t15">Estado de tu F29</h3><span class="chip ${ca}">${ta}</span></div>
    <div class="estf29">${prev.map((x) => { const [, t] = ESTADO_F29[x.estado] || ESTADO_F29.sin_dato; const p = parsePeriodo(x.periodo);
      return html`<div class="${['observado', 'no_declarado'].includes(x.estado) ? 'alerta' : ''}">${p ? MESES[p.mes - 1].replace(/^./, (c) => c.toUpperCase()) : ''}<b>${t}</b></div>`; })}</div>
    <div class="xs mt8">Lo leemos directo del SII cada mañana.</div></div>`;
}

function recomendaciones(n) {
  const r = recomendacionesImpuestos(n, hoyChile());
  if (!r.length) return '';
  return html`<div class="card"><div class="hd"><h3 class="t15">Recomendaciones para ti</h3><span class="chip c-conc">${r.length} de este mes</span></div>
    ${r.map((x) => html`<div class="reco"><div class="q"><i class="${x.color}"></i>${x.q}</div>
      <p>${x.detectado}</p><p><b>Lo que significa:</b> ${x.significa}</p><p><b>Qué hacer:</b> ${x.accion}</p>
      <div class="reco-pie"><span class="chip ${x.quien === 'tu' ? 'c-pend' : 'c-rev'}">${x.quien === 'tu' ? 'Lo haces: tú' : 'Lo hace: tu analista'}</span>${x.plazo ? html`<span class="chip c-gris">Plazo: ${x.plazo}</span>` : ''}</div></div>`)}
    <div class="xs mt8">Ordenadas por impacto en pesos. Son orientaciones con tus datos del SII, no montos definitivos.</div></div>`;
}

function observaciones(n) {
  const it = n.obs.items;
  const f29 = it.filter((x) => x.tipo.startsWith('f29_'));
  const f22 = it.filter((x) => x.tipo === 'f22_observacion');
  const mesesTxt = (xs) => xs.map((x) => mesDe(x.periodo)).filter(Boolean).join(', ');
  const nd = f29.filter((x) => x.tipo === 'f29_no_declarado'); const ob = f29.filter((x) => x.tipo !== 'f29_no_declarado');
  const filas = [];
  if (nd.length) filas.push(html`<div class="li"><span class="ic i-n" aria-hidden="true">!</span><div class="t"><b>F29 sin declarar</b>
    <span class="sm">El SII no registra tu declaración de IVA de ${mesesTxt(nd)}.</span><span class="chip c-rev">Tu analista ya lo está revisando</span></div></div>`);
  if (ob.length) filas.push(html`<div class="li"><span class="ic i-n" aria-hidden="true">!</span><div class="t"><b>F29 con observación del SII</b>
    <span class="sm">Tu declaración de ${mesesTxt(ob)} tiene una marca del SII para revisar.</span><span class="chip c-rev">Tu analista ya lo está revisando</span></div></div>`);
  if (!f29.length) filas.push(html`<div class="li"><span class="ic i-v" aria-hidden="true">✓</span><div class="t"><b>Tus declaraciones de IVA (F29)</b><span class="sm"><span class="ok-txt">Sin observaciones ✓</span> en los últimos meses.</span></div></div>`);
  if (f22.length) filas.push(html`<div class="li"><span class="ic i-n" aria-hidden="true">!</span><div class="t"><b>Tu declaración de renta${f22[0].anio ? ' (AT ' + f22[0].anio + ')' : ''} tiene observaciones</b>
    ${f22.map((x) => html`<span class="sm bloque">${x.texto || 'Observación del SII'}${x.codigo ? html` <span class="xs">(${x.codigo})</span>` : ''}</span>`)}<span class="chip c-rev">Tu analista ya lo está revisando</span></div></div>`);
  else filas.push(html`<div class="li"><span class="ic i-v" aria-hidden="true">✓</span><div class="t"><b>Tu declaración de renta (F22)</b><span class="sm"><span class="ok-txt">Sin observaciones ✓</span></span></div></div>`);
  if (!n.obs.cartas) filas.push(html`<div class="li"><span class="ic i-m" aria-hidden="true">${I.documento}</span><div class="t"><b>Cartas y notificaciones del SII</b><span class="sm">Muy pronto las verás aquí.</span></div></div>`);
  const atencion = nd.length || ob.length || f22.length;
  return html`<div class="card obs"><div class="hd"><h3 class="t15">Observaciones del SII</h3><span class="chip ${atencion ? 'c-pend' : 'c-ok'}">${atencion ? 'Requiere atención' : 'Sin observaciones ✓'}</span></div>
    ${filas}<div class="xs mt8">No necesitas hacer nada: si hace falta algún documento, tu analista te escribe.</div></div>`;
}

/** Pantalla «Tu IVA del mes». n = normalizarImpuestos(respuesta) | null (RPC no configurada) | {estado:'error'}. */
export function vImpuestos(ctx, n) {
  const titulo = n?.periodo ? `Tu IVA de ${mesDe(n.periodo)}` : 'Tu IVA del mes';
  let cuerpo;
  if (n?.estado === 'bloqueada' || ctx.perm.preIva === 'bloqueada') {
    cuerpo = teaser('Tu IVA del mes', [['IVA estimado del mes', '$•••.•••'], ['Crédito del mes', '$••.•••']], ['Tu IVA calculado con tus datos del SII', 'Recomendaciones para pagar menos y sin atrasos', 'Observaciones del SII a tiempo'], ctx.waMejora);
  } else if (!n || n.estado === 'error') {
    cuerpo = vacio(I.calendario, 'No pudimos cargar tu IVA del mes', 'Vuelve a intentarlo en unos minutos. Si sigue igual, escríbenos.');
  } else if (n.estado === 'no_conectado') {
    cuerpo = html`${n.oficial ? html`<div class="card osc"><div class="hd"><h2>Tu F29 de ${mesDe(n.periodo)}</h2><span class="chip c-ok-d">${FUENTE[n.oficial.fuente]}</span></div><div class="big">${clp(n.oficial.total)}</div>${n.vence ? html`<div class="sm">Se declara y paga hasta el <b class="claro">${fecha(n.vence, { anio: true })}</b></div>` : ''}</div>` : ''}
      ${vacio(I.calendario, 'Tu empresa aún no está conectada al SII', 'Cuando tu equipo Contadoor la conecte, aquí verás tu IVA del mes calculado con tus datos del SII, todos los días.')}`;
  } else {
    const e = n.est; const total = totalMostrado(n); const of = n.oficial;
    const actual = n.f29.find((x) => x.periodo === n.periodo);
    const [ca, ta] = of ? ['c-ok-d', FUENTE[of.fuente]] : (ESTADO_F29[actual?.estado] || ESTADO_F29.por_declarar);
    const detalle = of ? (of.confirmado_en ? `Confirmado el ${fecha(of.confirmado_en, { anio: true })}` : '')
      : (e.iva_pagar !== null && e.ppm !== null ? `IVA ${clp(e.iva_pagar)} + PPM ${clp(e.ppm)}` : 'Falta un dato para el total: lo confirma tu analista');
    cuerpo = html`<div class="card osc"><div class="hd"><h2>${of?.fuente === 'sii_declarado' ? 'F29 declarado' : 'IVA a pagar en ' + mesSig(n.periodo)}</h2><span class="chip ${ca}">${ta}</span></div>
        <div class="big">${total === null ? 'Por confirmar' : clp(total)}</div>
        <div class="sm">${detalle}${n.vence ? html` · se declara y paga hasta el <b class="claro">${fecha(n.vence, { anio: true })}</b>` : ''}</div>
        ${n.datos_al ? html`<div class="act"><i></i>Datos del SII actualizados al ${fecha(n.datos_al, { anio: true })}, ${hora(n.datos_al)}</div>` : ''}
        ${!n.cobertura_completa ? html`<div class="xs mt8">Algunos documentos del mes aún se están leyendo del SII.</div>` : ''}</div>
      <div class="kpis mb">
        <div class="card kpi"><small>Ventas del mes</small><b>${clp(e.ventas_neto !== null ? e.ventas_neto + (e.ventas_exento || 0) : null)}</b><span class="xs">${e.ventas_documentos !== null ? e.ventas_documentos + ' documentos · ' : ''}IVA ${clp(e.debito)}</span></div>
        <div class="card kpi"><small>Compras del mes</small><b>${clp(e.compras_neto !== null ? e.compras_neto + (e.compras_exento || 0) : null)}</b><span class="xs">${e.compras_documentos !== null ? e.compras_documentos + ' documentos · ' : ''}IVA ${clp(e.credito)}</span></div>
      </div>
      ${calculo(n)}${estadoF29(n)}${recomendaciones(n)}${observaciones(n)}
      <p class="xs c">El monto final es el del F29 que te confirma tu analista en el reporte.</p>`;
  }
  return html`${sub(titulo, { chip: n?.estado === 'ok' ? html`<span class="chip c-proy">Del SII</span>` : '' })}<div class="sec">${seg('preiva')}${cuerpo}</div>`;
}

/** Tarjeta del Inicio con el total del mes (solo con datos del SII). */
export function kpiImpuestos(n) {
  if (!n || n.estado !== 'ok') return '';
  const t = totalMostrado(n);
  return html`<button type="button" class="card kpi-btn" data-ir="preiva"><div class="hd"><b>Tu IVA de ${mesDe(n.periodo)}</b><span class="chip ${n.oficial ? 'c-ok' : 'c-proy'}">${n.oficial ? 'Confirmado' : 'Del SII'}</span></div>
    <div class="mid s21">${t === null ? 'Por confirmar' : clp(t)}</div><div class="xs">${n.vence ? 'Vence el ' + fecha(n.vence) : periodoTitulo(n.periodo)}</div></button>`;
}
