// Inicio, Reporte mensual (con arrastre de lo impago) e Historial.
import { html, clp, fecha, mesDe, periodoTitulo, MESES, parsePeriodo } from './util.js';
import { I, } from './iconos.js';
import { datosDe, calcularAcumulado, saldoFavorTexto } from './datos.js';
import { cabecera, sub, teaser, vacio, paso, waCard, chipEstadoProy } from './vistas-comunes.js';

const ICO_NOV = { reporte: ['i-a', I.grafico], pago: ['i-v', I.check], proy: ['i-i', I.calendario], te: ['i-m', I.llave] };

function listaMeses(origenes) {
  const n = origenes.map(mesDe).filter(Boolean);
  return n.length <= 1 ? n.join('') : n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1];
}

export function vInicio(ctx) {
  const rep = datosDe(ctx.resumen, 'reporte');
  const cta = ctx.perm.verMiCuenta ? datosDe(ctx.resumen, 'mi_cuenta') : null;
  const acu = rep ? calcularAcumulado(rep.obligaciones, rep.periodo) : null;
  const alDia = acu && acu.anteriores.length === 0 && (!cta || !(cta.vencido > 0));
  let tarjetaMes = '';
  if (rep) {
    const mes = mesDe(rep.periodo);
    if (rep.pagado && acu.anteriores.length === 0) {
      tarjetaMes = html`<div class="card osc"><div class="hd"><h2>Tu mes de ${mes}</h2><span class="chip c-ok-d">Pagado ✓</span></div>
        <div class="big">${clp(rep.total_pagado_mes)}</div><div class="sm">${rep.resumen || ''}</div>
        <div class="dos"><button type="button" class="btn" data-ir="reporte">Ver mi reporte</button>${ctx.perm.verMiCuenta ? html`<button type="button" class="btn lin" data-ir="cuenta/pagado">Comprobantes</button>` : ''}</div></div>`;
    } else {
      tarjetaMes = html`<div class="card osc"><div class="hd"><h2>Tu mes de ${mes}</h2><span class="chip c-pend">Por pagar</span></div>
        <div class="big">${clp(acu.total)}</div>
        <div class="sm">Este mes ${clp(acu.totalMes)}${acu.anteriores.length ? html` + pendientes de ${listaMeses(acu.origenes)} ${clp(acu.totalAnteriores)}` : ''}${acu.incompleto ? ' · hay montos por confirmar con tu analista' : ''}</div>
        <button type="button" class="btn" data-ir="reporte">Ver mi reporte</button></div>`;
    }
  } else {
    tarjetaMes = html`<div class="card osc"><div class="hd"><h2>Tu reporte del mes</h2><span class="chip c-gris">Aún no publicado</span></div>
      <div class="sm">Cuando tu analista lo envíe, lo verás aquí y en tu correo.</div></div>`;
  }
  const extra = html`${rep ? html`<div class="aldia${alDia ? '' : ' pend'}"><i></i>${alDia ? 'Tu empresa está al día' : 'Tienes pagos pendientes'}</div>` : ''}${tarjetaMes}`;

  const nov = (rep?.novedades || []).slice(0, 4);
  const piv = datosDe(ctx.resumen, 'pre_iva'); const pre = datosDe(ctx.resumen, 'pre_renta');
  let proy = '';
  if (ctx.perm.preIva === 'bloqueada' || ctx.perm.preRenta === 'bloqueada') {
    proy = teaser('Pre-IVA y Pre-Renta', [['IVA estimado del mes', '$•••.•••'], ['Renta proyectada', '$•.•••.•••']],
      ['Sabe antes cuánto viene de IVA cada mes', 'Proyección de tu renta anual para llegar a abril preparado'], ctx.waMejora);
  } else if (piv || pre) {
    proy = html`<div class="kpis mb">
      ${piv ? html`<button type="button" class="card kpi-btn" data-ir="preiva"><div class="hd"><b>Pre-IVA</b>${chipEstadoProy(piv.estado)}</div><div class="mid s21">${clp(piv.estimado, { aprox: true })}</div><div class="xs">IVA de ${mesDe(piv.periodo)} a hoy</div></button>` : html`<span></span>`}
      ${pre ? html`<button type="button" class="card kpi-btn" data-ir="prerenta"><div class="hd"><b>Pre-Renta</b><span class="chip c-proy">Proyección</span></div><div class="mid s21">${clp(pre.impuesto, { aprox: true })}</div><div class="xs">Renta AT ${pre.anio_tributario}</div></button>` : ''}
    </div>`;
  }
  const cuenta = cta ? html`<div class="card osc2"><div class="hd"><h3>Mi cuenta con Contadoor</h3><span class="chip ${cta.vencido > 0 ? 'c-venc' : 'c-ok-d'}">${cta.vencido > 0 ? 'Con vencidos' : 'Al día'}</span></div>
    <div class="kpis"><div class="kpi"><small>Por pagar</small><b class="claro">${clp(cta.por_pagar)}</b></div><div class="kpi"><small>Saldo a favor</small><b class="verde">${clp(cta.saldo_favor)}</b></div></div>
    ${cta.pendientes?.[0] ? html`<div class="sm mt8">Próximo: ${cta.pendientes[0].titulo}, vence el ${fecha(cta.pendientes[0].vence)}</div>` : ''}
    <button type="button" class="btn" data-ir="cuenta">Ver mi cuenta</button></div>` : '';

  return html`${cabecera(ctx, extra)}<div class="sec">
    ${nov.length ? html`<h2>Novedades</h2><div class="card">${nov.map((n) => { const [c, ic] = ICO_NOV[n.tipo] || ICO_NOV.reporte;
      return html`<button type="button" class="li kpi-btn" data-ir="${n.ir}"><span class="ic ${c}">${ic}</span><div class="t"><b>${n.t}</b><span class="sm">${n.xs}</span></div><span class="punto" aria-hidden="true"></span></button>`; })}</div>` : ''}
    ${proy}${cuenta}${waCard(ctx.waEquipo)}</div>`;
}

function filaPendiente(o) {
  const base = o.monto_confirmado != null && o.intereses ? html`${clp(o.monto)} + intereses y multa ${clp(o.intereses)} · ` : '';
  const conf = o.porConfirmar ? 'Monto por confirmar: tu analista lo actualiza con intereses antes de cobrarlo'
    : o.confirmado_at ? html`monto confirmado por tu analista el ${fecha(o.confirmado_at)}${o.vigente_hasta ? html` · vale hasta el ${fecha(o.vigente_hasta)}` : ''}` : '';
  return html`<div class="fila"><div class="t"><b>${o.concepto} <span class="chip c-pend">de ${mesDe(o.periodo)}</span></b>
      <span class="xs">${base}${conf}</span>${o.respuesta?.texto ? html`<span class="xs">Tu respuesta: "${o.respuesta.texto}" (${fecha(o.respuesta.fecha)})</span>` : ''}</div>
    <div class="v">${o.porConfirmar ? html`<b>Por confirmar</b><span class="chip c-gris">Pendiente</span>` : html`<b>${clp(o.montoMostrado)}</b><span class="chip ${o.estado === 'atrasada' ? 'c-venc' : 'c-pend'}">${o.estado === 'atrasada' ? 'Atrasado' : 'Por pagar'}</span>`}</div></div>`;
}

export function vReporte(ctx) {
  const rep = datosDe(ctx.resumen, 'reporte');
  if (!rep) return html`${sub('Reporte mensual')}<div class="sec">${vacio(I.grafico, 'Tu reporte aún no está publicado', 'Cuando tu analista envíe el reporte del mes, aparecerá aquí, igual al que recibes por correo.')}</div>`;
  const acu = calcularAcumulado(rep.obligaciones, rep.periodo);
  const mes = mesDe(rep.periodo);
  const hayAnt = acu.anteriores.length > 0;
  const top = hayAnt
    ? html`<div class="card osc"><div class="hd"><h2>Total a pagar</h2>${acu.incompleto ? html`<span class="chip c-pend">Falta confirmar</span>` : html`<span class="chip c-ok-d">Confirmado</span>`}</div><div class="big">${clp(acu.total)}</div>
        <div class="sm">Este mes ${clp(acu.totalMes)} + pendientes acumulados ${clp(acu.totalAnteriores)} (${listaMeses(acu.origenes)})${acu.incompleto ? ' · más los montos por confirmar' : ''}</div></div>`
    : html`<div class="card osc"><div class="hd"><h2>Lo que pagas por ${mes}</h2><span class="chip c-ok-d">Confirmado</span></div>
        <div class="big">${clp(rep.pagado ? rep.total_pagado_mes : acu.totalMes)}</div>
        <div class="sm">${(rep.obligaciones || []).filter((o) => o.periodo === rep.periodo).map((o, i) => html`${i ? ' + ' : ''}${o.concepto} ${clp(o.monto)} (vence ${fecha(o.vence)})`)}${rep.pagado ? ' · ya pagados ✓' : ''}</div></div>`;
  const arrastre = hayAnt ? html`<div class="card arrastre"><div class="hd"><h3>Pendientes de meses anteriores</h3></div>
      ${acu.anteriores.map(filaPendiente)}
      <div class="fila total"><div class="t"><b>Total pendiente acumulado</b></div><div class="v"><b>${clp(acu.totalAnteriores)}</b></div></div>
      <p class="xs m0 mt8">Cada mes se suman aquí todos los pagos que siguen pendientes, con su mes de origen, hasta que se paguen. Si pagas después de la fecha de vigencia, tu analista actualiza los montos.</p></div>
    <div class="card"><h3 class="t15">Este mes</h3>${acu.mes.map((o) => html`<div class="fila"><div class="t"><b>${o.concepto}</b><span class="xs">${o.fecha_interna ? html`Tu fecha para pagar: ${fecha(o.fecha_interna)} · ` : ''}vence ${fecha(o.vence)}</span></div><div class="v"><b>${clp(o.montoMostrado)}</b><span class="chip c-pend">Por pagar</span></div></div>`)}</div>` : '';
  const serv = ctx.perm.verFacturas && rep.servicios
    ? html`<div class="fila"><div class="t"><b>Nuestros servicios del mes</b><span class="xs">Factura N° ${rep.servicios.folio} · ${mes}</span></div><div class="v"><b>${clp(rep.servicios.monto)}</b><span class="chip ${rep.servicios.estado === 'pagada' ? 'c-ok' : 'c-pend'}">${rep.servicios.estado === 'pagada' ? 'Pagada' : 'Por pagar'}</span></div></div>` : '';
  return html`${sub('Reporte mensual', { chip: html`<span class="chip c-conc">${periodoTitulo(rep.periodo)}</span>` })}<div class="sec">
    <div class="seg" role="group" aria-label="Vista"><button type="button" class="on" aria-pressed="true">Este mes</button><button type="button" data-ir="historial" aria-pressed="false">Historial</button></div>
    ${top}${arrastre}
    ${rep.calculo?.length ? html`<div class="card"><h3 class="t15">¿Cómo llegamos a tu impuesto?</h3>${rep.calculo.map(paso)}<div class="total-l"><span>Total F29</span><span>${clp(rep.total_f29)}</span></div></div>` : ''}
    ${rep.comentario ? html`<div class="nota"><b>Comentario de tu analista</b><div class="cuerpo">"${rep.comentario}"</div></div>` : ''}
    ${serv || rep.ppm_acumulado != null ? html`<div class="card">${serv}${rep.ppm_acumulado != null ? html`<div class="fila"><div class="t"><b>PPM acumulado del año</b><span class="xs">a cuenta de la renta de abril</span></div><div class="v"><b>${clp(rep.ppm_acumulado)}</b></div></div>` : ''}</div>` : ''}
    ${ctx.enlaceDoc(rep.pdf_url) ? html`<a class="btn lin" href="${ctx.enlaceDoc(rep.pdf_url)}" target="_blank" rel="noopener noreferrer">Descargar el reporte (PDF)</a>` : html`<button type="button" class="btn lin" disabled>Descargar el reporte (PDF) <span class="prox">Próximamente</span></button>`}
    <p class="xs c mt8">Es el mismo reporte que te enviamos por correo el ${fecha(rep.enviado_at)}.</p></div>`;
}

export function vHistorial(ctx) {
  const rep = datosDe(ctx.resumen, 'reporte');
  const h = (rep?.historial || []).slice(0, 12);
  if (!h.length) return html`${sub('Historial de reportes', { volver: 'reporte' })}<div class="sec">${vacio(I.grafico, 'Aún no hay reportes guardados', 'Cada reporte que te enviemos quedará aquí, tal como se envió.')}</div>`;
  const ult = h.slice(0, 6).reverse();
  const max = Math.max(...ult.map((x) => Number(x.f29) || 0), 1);
  const prom = Math.round(ult.reduce((s, x) => s + (Number(x.f29) || 0), 0) / ult.length);
  return html`${sub('Historial de reportes', { volver: 'reporte' })}<div class="sec">
    <div class="card"><h3 class="t15">Tu F29 de los últimos ${ult.length} meses</h3>
      <div class="chart" aria-hidden="true">${ult.map((x, i) => html`<i data-h="${Math.round(((Number(x.f29) || 0) / max) * 100)}" class="${i === ult.length - 1 ? 'act' : ''}"></i>`)}</div>
      <div class="mes">${ult.map((x) => { const p = parsePeriodo(x.periodo); return html`<span>${p ? MESES[p.mes - 1].slice(0, 3).replace(/^./, (c) => c.toUpperCase()) : ''}</span>`; })}</div>
      <p class="xs m0 mt8">Promedio: ${clp(prom)} al mes</p></div>
    <div class="card">${h.map((x) => html`<div class="fila"><div class="t"><b>${periodoTitulo(x.periodo)}</b><span class="xs">Enviado el ${fecha(x.enviado_at)} · F29 ${clp(x.f29)}</span></div><div class="v">${x.periodo === rep.periodo ? html`<button type="button" class="link" data-ir="reporte">Abrir</button>` : html`<span class="xs">PDF próximamente</span>`}</div></div>`)}</div>
    <p class="xs c">Cada reporte se guarda tal como se envió: no cambia aunque después cambien los datos.</p></div>`;
}

export { saldoFavorTexto };
