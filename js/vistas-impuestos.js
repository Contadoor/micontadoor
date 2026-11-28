// «Tu IVA del mes» (MC-IMP-1): IVA a pagar y cómo se calcula, estado del F29, recomendaciones y observaciones del SII.
// Diseño: maqueta aprobada por Luciano el 19-11-2026 (descargas/f2b_preiva_cartapra/maqueta_micontadoor.html). Todo escapado con html``.
import { html, clp, fecha, hora, mesDe, periodoTitulo, MESES, parsePeriodo } from './util.js';
import { I } from './iconos.js';
import { recomendacionesImpuestos, totalMostrado, validado, TEXTO_ESTADO_IVA } from './datos.js';
import { sub, teaser, vacio } from './vistas-comunes.js';

const ESTADO_F29 = {
  declarado: ['c-ok', 'Declarado en el SII ✓'], en_revision: ['c-rev', 'En revisión del SII'], observado: ['c-venc', 'Con observación'],
  no_declarado: ['c-venc', 'No declarado'], por_declarar: ['c-pend', 'Por declarar'], sin_dato: ['c-gris', 'Sin dato'],
  // R2 (AUTO-C02/C03): estados distintos de «no declarado».
  sin_verificar: ['c-gris', 'Declarado · por verificar'], no_encontrado: ['c-gris', 'Verificando en el SII'],
};
// Luciano 19-11: dos estados del monto principal. Antes de cerrar el reporte: «Pre-IVA de <mes>» · «Estimado con datos del SII».
// Con el reporte del período cerrado/enviado: «IVA de <mes>» · «Validado por Contadoor». El F29 del SII es solo informativo (estado del F29).
export const ETIQUETA = { estimado: 'Estimado con datos del SII', validado: 'Validado por Contadoor' };
// R4 (dictamen R3 · D6): cuatro estados del IVA del período, decididos por el servidor (mc.mis_impuestos.estado_iva).
const estadoDe = (n) => (validado(n) ? 'publicado' : (TEXTO_ESTADO_IVA[n?.estado_iva] ? n.estado_iva : 'estimado'));
const CHIP_IVA = { estimado: 'c-proy', revisado: 'c-rev', publicado: 'c-ok-d', en_revision: 'c-pend' };
const tituloDe = (n) => (n?.periodo ? (validado(n) ? 'IVA de ' : 'Pre-IVA de ') + mesDe(n.periodo) : 'Pre-IVA del mes');
const mesSig = (p) => { const x = parsePeriodo(p); return x ? MESES[x.mes % 12] : ''; };
const pct = (t) => (t === null || t === undefined ? '' : String(t).replace('.', ','));
const hoyChile = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());

// «Tu año» (mc.mis_impuestos_anio) aparece entre «Pre-IVA» y «Pre-Renta» cuando la RPC está disponible.
export function seg(actual, conAnio = false) {
  const b = (r, t) => html`<button type="button" data-ir="${r}" class="${actual === r ? 'on' : ''}" aria-pressed="${actual === r}">${t}</button>`;
  return html`<div class="seg" role="group" aria-label="Proyecciones">${b('preiva', 'Pre-IVA')}${conAnio ? b('impuestos-historial', 'Tu año') : ''}${b('prerenta', 'Pre-Renta')}</div>`;
}

function linea(t, xs, v, clase = '') {
  return html`<div class="iv-paso ${clase}"><div class="t"><b>${t}</b>${xs ? html`<span class="xs">${xs}</span>` : ''}</div><div class="v">${v}</div></div>`;
}

function calculo(n) {
  if (validado(n)) {   // con el reporte cerrado, el detalle es el del reporte (no el cálculo con datos del SII)
    const o = n.oficial;
    const iva = o.debito !== null && o.credito !== null && o.remanente !== null ? Math.max(o.debito - o.credito - o.remanente, 0) : null;
    const otros = iva !== null && o.ppm !== null && o.total !== null ? o.total - iva - o.ppm : null;
    return html`<div class="card"><h3 class="t15">Cómo se calcula</h3>
      ${linea('IVA de tus ventas', 'Débito fiscal', clp(o.debito))}
      ${linea('IVA de tus compras', 'Crédito fiscal', o.credito === null ? 'No disponible' : '− ' + clp(o.credito), 'menos')}
      ${linea('Remanente a tu favor', 'Del mes anterior', o.remanente === null ? 'No disponible' : o.remanente ? '− ' + clp(o.remanente) : '$0', 'menos')}
      ${linea('IVA del mes', '', iva === null ? 'No disponible' : clp(iva), 'res')}
      ${linea('PPM', '', o.ppm === null ? 'No disponible' : '+ ' + clp(o.ppm))}
      ${otros !== null && otros > 0 ? linea('Retenciones e impuesto único', '', '+ ' + clp(otros)) : ''}
      ${linea('Total del F29', 'Según tu reporte del mes', clp(o.total), 'res')}</div>`;
  }
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
  return html`<div class="card"><h3 class="t15">Cómo se calcula</h3>${n.preiva ? html`<p class="xs m0">Con tus datos del SII al día de hoy.</p>` : ''}${filas}</div>`;
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

/** Línea del F22 con el estado real (MC-F22-1). f22obs = observaciones de la lista del SII (si las hay, se muestran). */
function filaF22(fe, f22obs) {
  const ic = (k) => (k === 'ok' ? ['i-v', '✓'] : k === 'sin' || k === 'neutro' ? ['i-m', '·'] : ['i-n', '!']);
  const k = f22obs.length && fe.nivel === 'ok' ? 'alerta' : fe.nivel; const [c, s] = ic(k);
  const t = k === 'falta' ? `No figura tu declaración de renta del AT ${fe.at_esperado}` : k === 'sin' ? 'Declaración de renta (F22)'
    : `Tu declaración de renta (AT ${fe.at_ultimo || fe.at_esperado})`;
  const xs = k === 'falta' ? `El SII no registra el F22 del AT ${fe.at_esperado}.${fe.at_ultimo ? ' La última que registra es la del AT ' + fe.at_ultimo + '.' : ''}`
    : k === 'sin' ? 'El SII no registra declaraciones de renta para esta empresa.' : k === 'ok' && !fe.texto ? html`<span class="ok-txt">Sin observaciones ✓</span>` : '';
  return html`<div class="li"><span class="ic ${c}" aria-hidden="true">${s}</span><div class="t"><b>${t}</b>
    ${xs ? html`<span class="sm">${xs}</span>` : ''}
    ${fe.texto ? html`<span class="sm bloque">${k === 'falta' ? 'Estado del AT ' + fe.at_ultimo + ' en el SII: ' : 'Estado en el SII: '}${fe.texto}</span>` : ''}
    ${f22obs.map((x) => html`<span class="sm bloque">${x.texto || 'Observación del SII'}${x.codigo ? html` <span class="xs">(${x.codigo})</span>` : ''}</span>`)}
    ${k === 'falta' || k === 'alerta' || fe.alerta_anterior ? html`<span class="chip c-rev">Tu analista ya lo está revisando</span>` : ''}</div></div>`;
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
  const fe = n.obs.f22;
  if (fe) filas.push(filaF22(fe, f22));
  else {
  if (f22.length) filas.push(html`<div class="li"><span class="ic i-n" aria-hidden="true">!</span><div class="t"><b>Tu declaración de renta${f22[0].anio ? ' (AT ' + f22[0].anio + ')' : ''} tiene observaciones</b>
    ${f22.map((x) => html`<span class="sm bloque">${x.texto || 'Observación del SII'}${x.codigo ? html` <span class="xs">(${x.codigo})</span>` : ''}</span>`)}<span class="chip c-rev">Tu analista ya lo está revisando</span></div></div>`);
  else filas.push(html`<div class="li"><span class="ic i-v" aria-hidden="true">✓</span><div class="t"><b>Tu declaración de renta (F22)</b><span class="sm"><span class="ok-txt">Sin observaciones ✓</span></span></div></div>`);
  }
  // SII-OBS-2: cartas y notificaciones del SII (últimos 12 meses) y situación ante el SII.
  const ca = n.obs.cartas || { disponible: false, items: [] };
  const nuevas = ca.disponible ? ca.items.filter((x) => x.nueva) : [];
  if (!ca.disponible) filas.push(html`<div class="li"><span class="ic i-m" aria-hidden="true">${I.documento}</span><div class="t"><b>Cartas y notificaciones del SII</b><span class="sm">Las verás aquí apenas terminemos de leerlas del SII.</span></div></div>`);
  else if (!ca.items.length) filas.push(html`<div class="li"><span class="ic i-v" aria-hidden="true">✓</span><div class="t"><b>Cartas y notificaciones del SII</b><span class="sm"><span class="ok-txt">Sin cartas ni notificaciones ✓</span> en los últimos 12 meses.</span></div></div>`);
  else ca.items.forEach((x) => filas.push(html`<div class="li"><span class="ic ${x.nueva ? 'i-n' : 'i-m'}" aria-hidden="true">${x.nueva ? '!' : I.documento}</span><div class="t">
    <b>${x.categoria === 'notificacion' ? 'El SII te envió una notificación' : 'El SII te envió una carta'}</b>
    <span class="sm">${x.titulo}</span>
    <span class="xs bloque">${[x.fecha ? 'Recibida el ' + fecha(x.fecha, { anio: true }) : '', x.remitente ? 'de ' + x.remitente : ''].filter(Boolean).join(' · ')}</span>
    ${x.plazo ? html`<span class="sm bloque">Plazo para responder: ${x.plazo}</span>` : ''}
    ${x.nueva ? html`<span class="chip c-rev">Tu analista ya lo está revisando</span>` : ''}</div></div>`));
  const cu = n.obs.cumplimiento || { disponible: false };
  if (cu.disponible) filas.push(html`<div class="li"><span class="ic ${cu.cumple ? 'i-v' : 'i-n'}" aria-hidden="true">${cu.cumple ? '✓' : '!'}</span><div class="t"><b>Tu situación ante el SII</b>
    <span class="sm">${cu.cumple ? html`<span class="ok-txt">Al día ✓</span>` : 'Hay condiciones por regularizar'}${cu.estado ? ' · ' + cu.estado : ''}</span>
    ${!cu.cumple ? cu.condiciones.filter((x) => x.cumple === false).map((x) => html`<span class="sm bloque">${x.titulo}</span>`) : ''}
    ${!cu.cumple ? html`<span class="chip c-rev">Tu analista ya lo está revisando</span>` : ''}</div></div>`);
  const fe2 = n.obs.f22; const f22mal = fe2 ? (fe2.nivel === 'falta' || fe2.nivel === 'alerta' || fe2.alerta_anterior || f22.length > 0) : f22.length > 0;
  const atencion = nd.length || ob.length || f22mal || nuevas.length || (cu.disponible && !cu.cumple);
  return html`<div class="card obs"><div class="hd"><h3 class="t15">Observaciones del SII</h3><span class="chip ${atencion ? 'c-pend' : 'c-ok'}">${atencion ? 'Requiere atención' : 'Sin observaciones ✓'}</span></div>
    ${filas}<div class="xs mt8">No necesitas hacer nada: si hace falta algún documento, tu analista te escribe.</div></div>`;
}

/** Pantalla «Tu IVA del mes». n = normalizarImpuestos(respuesta) | null (RPC no configurada) | {estado:'error'}. */
export function vImpuestos(ctx, n) {
  const titulo = tituloDe(n);
  const est = estadoDe(n);
  // Estimado: «IVA estimado · Estimado con datos del SII»; revisado / en revisión con su texto; publicado: «Validado por Contadoor».
  const chipEstado = (v) => html`<span class="chip ${CHIP_IVA[est]}">${v ? ETIQUETA.validado : est === 'estimado' ? ETIQUETA.estimado : TEXTO_ESTADO_IVA[est]}</span>`;
  const lineaEstado = html`<div class="xs mt8" data-estado-iva="${est}"><b>${TEXTO_ESTADO_IVA[est]}</b>${est === 'revisado' ? ' · el monto definitivo es el del reporte mensual publicado' : est === 'en_revision' ? ' · tu equipo Contadoor está revisando nuevamente este período' : ''}</div>`;
  let cuerpo;
  if (n?.estado === 'bloqueada') {   // solo si el servidor aún bloquea por plan (antes de MC-IMP-1b)
    cuerpo = teaser('Pre-IVA del mes', [['IVA estimado del mes', '$•••.•••'], ['Crédito del mes', '$••.•••']], ['Tu IVA calculado con tus datos del SII', 'Recomendaciones para pagar menos y sin atrasos', 'Observaciones del SII a tiempo'], ctx.waMejora);
  } else if (!n || n.estado === 'error') {
    cuerpo = vacio(I.calendario, 'No pudimos cargar tu IVA del mes', 'Vuelve a intentarlo en unos minutos. Si sigue igual, escríbenos.');
  } else if (n.estado === 'no_conectado') {
    const t = totalMostrado(n);
    cuerpo = html`${t !== null ? html`<div class="card osc"><div class="hd"><h2>${validado(n) ? 'Tu F29 de ' : 'Tu IVA estimado de '}${mesDe(n.periodo)}</h2>${chipEstado(validado(n))}</div><div class="big">${clp(t)}</div>${n.vence ? html`<div class="sm">Se declara y paga hasta el <b class="claro">${fecha(n.vence, { anio: true })}</b></div>` : ''}${lineaEstado}</div>` : ''}
      ${vacio(I.calendario, 'Tu empresa aún no está conectada al SII', 'Cuando tu equipo Contadoor la conecte, aquí verás tu IVA del mes calculado con tus datos del SII, todos los días.')}`;
  } else {
    const e = n.est; const total = totalMostrado(n); const v = validado(n);
    const detalle = v ? (n.oficial.confirmado_en ? `Reporte mensual publicado el ${fecha(n.oficial.confirmado_en, { anio: true })}` : 'Según tu reporte del mes')
      : n.preiva ? `Revisado por tu analista${n.preiva.enviado_en ? ' el ' + fecha(n.preiva.enviado_en, { anio: true }) : ''}; puede cambiar hasta que se publique el reporte`
        : (e.iva_pagar !== null && e.ppm !== null ? (soloPpm(n) ? `Tus ventas son exentas de IVA: este mes pagas solo el PPM (${clp(e.ppm)})` : `IVA ${clp(e.iva_pagar)} + PPM ${clp(e.ppm)}`) : 'Falta un dato para el total: lo confirma tu analista');
    cuerpo = html`<div class="card osc"><div class="hd"><h2>${v ? 'IVA a pagar en ' : 'IVA estimado a pagar en '}${mesSig(n.periodo)}</h2>${chipEstado(v)}</div>
        <div class="big">${total === null ? 'Por confirmar' : clp(total)}</div>
        <div class="sm">${detalle}${n.vence ? html` · se declara y paga hasta el <b class="claro">${fecha(n.vence, { anio: true })}</b>` : ''}</div>
        ${n.datos_al ? html`<div class="act"><i></i>Datos del SII actualizados al ${fecha(n.datos_al, { anio: true })}, ${hora(n.datos_al)}</div>` : ''}
        ${!n.cobertura_completa ? html`<div class="xs mt8">Algunos documentos del mes aún se están leyendo del SII.</div>` : ''}${lineaEstado}</div>
      <div class="kpis mb">
        <div class="card kpi"><small>Ventas del mes</small><b>${clp(e.ventas_neto !== null ? e.ventas_neto + (e.ventas_exento || 0) : null)}</b><span class="xs">${e.ventas_documentos !== null ? e.ventas_documentos + ' documentos · ' : ''}IVA ${clp(e.debito)}</span></div>
        <div class="card kpi"><small>Compras del mes</small><b>${clp(e.compras_neto !== null ? e.compras_neto + (e.compras_exento || 0) : null)}</b><span class="xs">${e.compras_documentos !== null ? e.compras_documentos + ' documentos · ' : ''}IVA ${clp(e.credito)}</span></div>
      </div>
      ${calculo(n)}${estadoF29(n)}${recomendaciones(n)}${observaciones(n)}
      <p class="xs c">${v ? 'Este es el monto de tu reporte del mes, validado por Contadoor.' : 'Es una estimación con tus datos del SII: el monto final es el del reporte que cierra tu analista.'}</p>`;
  }
  return html`${sub(titulo, { chip: n?.estado === 'ok' || n?.estado === 'no_conectado' ? chipEstado(validado(n)) : '' })}<div class="sec">${seg('preiva', ctx.anualOk === true)}${cuerpo}</div>`;
}

/** Tarjeta del Inicio con el total del mes (solo con datos del SII). */
/** Luciano 27-11: «Tu situación tributaria» SIEMPRE visible en el Inicio (no solo cuando hay un problema).
 *  Resume lo que ya trae mc.mis_impuestos: cumplimiento ante el SII, F29, F22 y cartas. Fail-closed: sin datos, no se muestra. */
export function tarjetaSituacion(n) {
  if (!n || n.estado !== 'ok' || !n.obs) return '';
  const cu = n.obs.cumplimiento || { disponible: false }; const ca = n.obs.cartas || { disponible: false, items: [] };
  const it = n.obs.items || [];
  const f29 = it.filter((x) => String(x.tipo || '').startsWith('f29_')).length; const f22 = it.filter((x) => x.tipo === 'f22_observacion').length;
  const fe = n.obs.f22; const f22mal = fe ? (fe.nivel === 'falta' || fe.nivel === 'alerta' || fe.alerta_anterior || f22 > 0) : f22 > 0;
  if (!cu.disponible && !ca.disponible && !it.length) return '';
  const fila = (ok, t, xs) => html`<div class="li"><span class="ic ${ok === null ? 'i-m' : ok ? 'i-v' : 'i-n'}" aria-hidden="true">${ok === null ? '·' : ok ? '✓' : '!'}</span><div class="t"><b>${t}</b><span class="sm">${xs}</span></div></div>`;
  const filas = [
    cu.disponible ? fila(cu.cumple, 'Cumplimiento tributario (SII)', cu.cumple ? 'Cumple sus obligaciones tributarias' : 'Hay condiciones por regularizar') : fila(null, 'Cumplimiento tributario (SII)', 'Aún sin consulta al SII'),
    fila(!f29, 'Declaraciones de IVA (F29)', f29 ? (f29 === 1 ? '1 mes requiere revisión' : f29 + ' meses requieren revisión') : 'Sin observaciones'),
    (() => { const fe = n.obs.f22;
      if (!fe) return fila(!f22, 'Declaración de renta (F22)', f22 ? 'Tiene observaciones del SII' : 'Sin observaciones');
      if (fe.nivel === 'falta') return fila(false, 'Declaración de renta (F22)', 'No figura la del AT ' + fe.at_esperado + (fe.at_ultimo ? ' (última: AT ' + fe.at_ultimo + ')' : ''));
      if (fe.nivel === 'sin') return fila(null, 'Declaración de renta (F22)', 'Sin declaraciones registradas en el SII');
      if (fe.nivel === 'alerta' || f22) return fila(false, 'Declaración de renta (F22)', 'AT ' + (fe.at_ultimo || fe.at_esperado) + ' con observaciones del SII');
      if (fe.nivel === 'neutro') return fila(null, 'Declaración de renta (F22)', 'AT ' + (fe.at_ultimo || fe.at_esperado) + ' declarada · ver estado');
      return fila(true, 'Declaración de renta (F22)', 'AT ' + (fe.at_ultimo || fe.at_esperado) + ' declarada · sin observaciones'); })(),
    ca.disponible ? fila(!ca.total, 'Cartas y notificaciones', ca.total ? (ca.total === 1 ? '1 en los últimos 12 meses' : ca.total + ' en los últimos 12 meses') : 'Ninguna en los últimos 12 meses') : fila(null, 'Cartas y notificaciones', 'Aún sin leer del SII'),
  ];
  const alerta = (cu.disponible && !cu.cumple) || f29 > 0 || f22mal || (ca.disponible && ca.items.some((x) => x.nueva));
  return html`<div class="card situ"><div class="hd"><h3>Tu situación tributaria</h3><span class="chip ${alerta ? 'c-pend' : 'c-ok'}">${alerta ? 'Requiere atención' : 'Al día ✓'}</span></div>
    ${filas}
    <div class="xs mt8">${cu.actualizado ? 'Consultado en el SII el ' + fecha(cu.actualizado, { anio: true }) + '. ' : ''}${alerta ? 'Tu analista ya lo está revisando.' : 'No necesitas hacer nada.'}</div>
    <button type="button" class="btn lin" data-ir="preiva">Ver el detalle</button></div>`;
}

/** MC-PPM-1 (Luciano 28-11): ventas solo exentas (sin IVA de ventas) → lo que se paga en el F29 es el PPM. */
export function soloPpm(n) {
  const e = n?.est; if (!e) return false;
  return (e.exenta || ((e.ventas_neto ?? 0) === 0 && (e.ventas_exento ?? 0) > 0)) && (e.debito ?? 0) === 0 && e.ppm !== null && e.ppm > 0;
}

export function kpiImpuestos(n) {
  if (!n || n.estado !== 'ok') return '';
  const t = totalMostrado(n); const v = validado(n);
  return html`<button type="button" class="card kpi-btn" data-ir="preiva"><div class="hd"><b>${tituloDe(n)}</b><span class="chip ${v ? 'c-ok' : 'c-proy'}">${v ? 'Validado' : 'Estimado'}</span></div>
    <div class="mid s21">${t === null ? 'Por confirmar' : clp(t)}</div><div class="xs">${soloPpm(n) && !v ? 'Ventas exentas: pagas solo PPM · ' : ''}${n.vence ? 'Vence el ' + fecha(n.vence) : periodoTitulo(n.periodo)}</div></button>`;
}
