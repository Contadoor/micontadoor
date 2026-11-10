// Mi cuenta (Por pagar / Pagado), detalle de pago, Pre-IVA, Pre-Renta, Trabajos especiales, Más, Mi acceso y hojas.
import { html, clp, fecha, hora, mesDe, pct } from './util.js';
import { I, icoPreIva, icoMiRenta } from './iconos.js';
import { datosDe, saldoFavorTexto, planTexto } from './datos.js';
import { sub, teaser, vacio, paso, waCard, chipEstadoProy, leyendaEstados, botonSolicitud } from './vistas-comunes.js';

const CHIP_VENCE = { por_vencer: 'c-pend', vencida: 'c-venc' };

export function vCuenta(ctx, vista) {
  if (!ctx.perm.verMiCuenta) return html`${sub('Mi cuenta con Contadoor')}<div class="sec">${vacio(I.candado, 'Sin acceso a esta sección', 'Tu usuario no tiene permiso para ver pagos ni facturas de esta empresa. Si lo necesitas, pídelo al titular o a tu equipo Contadoor.')}</div>`;
  const c = datosDe(ctx.resumen, 'mi_cuenta');
  if (!c) return html`${sub('Mi cuenta con Contadoor')}<div class="sec">${vacio(I.tarjeta, 'Tu estado de cuenta aún no está publicado', 'Pronto verás aquí lo que tienes por pagar, lo pagado y tu saldo a favor.')}</div>`;
  const fact = ctx.perm.verFacturas;
  const pend = (c.pendientes || []).filter((p) => fact || !p.es_factura);
  const prox = (c.proximos || []).filter((p) => fact || !p.es_factura);
  const pagado = vista === 'pagado';
  const t = ctx.cfg.TRANSFERENCIA;
  return html`${sub('Mi cuenta con Contadoor')}<div class="sec">
    <div class="card osc2"><div class="hd"><h2>Resumen al ${fecha(c.al)}</h2><span class="chip ${c.vencido > 0 ? 'c-venc' : 'c-ok-d'}">${c.vencido > 0 ? 'Con vencidos' : 'Al día'}</span></div>
      <div class="kpis"><div class="kpi"><small>Por pagar</small><b class="claro">${clp(c.por_pagar)}</b></div><div class="kpi"><small>Saldo a favor disponible</small><b class="verde">${clp(c.saldo_favor)}</b></div></div>
      <p class="xs m0 mt8">Vencido: ${clp(c.vencido)} · <b>${saldoFavorTexto(c.saldo_favor)}</b></p></div>
    <div class="seg" role="group" aria-label="Vista"><button type="button" data-ir="cuenta" class="${pagado ? '' : 'on'}" aria-pressed="${!pagado}">Por pagar</button><button type="button" data-ir="cuenta/pagado" class="${pagado ? 'on' : ''}" aria-pressed="${pagado}">Pagado</button></div>
    ${!pagado ? html`
      ${pend.length ? pend.map((p) => html`<div class="card"><div class="hd"><h3>${p.titulo}</h3></div>
        <div class="fila"><div class="mid">${clp(p.monto)}</div><span class="chip ${CHIP_VENCE[p.estado] || 'c-pend'}">Vence ${fecha(p.vence)}</span></div>
        <div class="xs">${p.detalle}</div>
        ${p.destino === 'contadoor' ? html`
          <button type="button" class="btn" data-accion="transferencia" data-id="${p.id}" aria-expanded="${ctx.abiertos.has(p.id)}">Pagar por transferencia</button>
          ${ctx.abiertos.has(p.id) ? html`<div class="datos"><b>${t.razon_social}</b><br>RUT ${t.rut} · ${t.banco}<br>${t.cuenta} · ${t.correo}</div>` : ''}
          ${botonSolicitud(ctx, 'transferi', p.id)}` : botonSolicitud(ctx, 'pague', p.id)}
      </div>`) : vacio(I.check, 'No tienes nada por pagar', 'Cuando haya un pago pendiente con Contadoor lo verás aquí.')}
      ${prox.length ? html`<div class="card">${prox.map((x) => html`<div class="fila"><div class="t"><b>${x.titulo}</b><span class="xs">${x.xs}</span></div><div class="v"><span class="chip c-gris">${x.chip}</span></div></div>`)}</div>` : ''}
      <p class="xs">"Ya transferí" y "Ya lo pagué" no marcan el pago: tu analista lo confirma con la cartola o el comprobante y te avisamos.</p>`
    : html`
      ${(c.pagado || []).map((tr) => tr.estado === 'aplicada' ? html`<div class="card"><div class="hd"><h3>Transferencia recibida · ${fecha(tr.fecha)}</h3><span class="chip c-ok">Aplicada</span></div>
          <div class="mid">${clp(tr.monto)}</div><div class="xs">${tr.origen}</div>
          <h3 class="t15 mt12">Cómo se aplicó</h3>
          ${(tr.reparto || []).filter((r) => fact || !r.es_factura).map((r) => html`<div class="fila"><div class="t"><b>${r.concepto}</b><span class="xs">${r.xs}</span></div><div class="v"><b>${clp(r.monto)}</b>${r.comprobante ? html`<button type="button" class="link" data-ir="pago/${r.comprobante}">Comprobante</button>` : ''}</div></div>`)}
          ${tr.saldo_favor > 0 ? html`<div class="fila"><div class="t"><b class="verde">Saldo a favor</b><span class="xs">Disponible · lo definimos contigo (próximo pago o devolución)</span></div><div class="v"><b class="verde">${clp(tr.saldo_favor)}</b></div></div>` : ''}
        </div>` : html`<div class="card"><div class="hd"><h3>Transferencia recibida · ${fecha(tr.fecha)}</h3><span class="chip c-rev">En revisión</span></div>
          <div class="mid s22">${clp(tr.monto)}</div><div class="xs">La estamos conciliando. Te mostraremos cómo se aplicó cuando esté lista.</div></div>`)}
      ${c.anteriores?.length ? html`<div class="card"><h3 class="t15">Meses anteriores</h3>${c.anteriores.map((a) => html`<div class="fila"><div class="t"><b>Transferencia · ${fecha(a.fecha)}</b><span class="xs">${a.detalle}</span></div><div class="v"><b>${clp(a.monto)}</b><span class="chip c-ok">Aplicada</span></div></div>`)}</div>` : ''}
      ${!(c.pagado?.length || c.anteriores?.length) ? vacio(I.tarjeta, 'Aún no hay pagos registrados', 'Cuando concilemos una transferencia verás cómo se aplicó cada peso.') : ''}
      <div class="estados"><div><span class="chip c-rev">En revisión</span><br>Recibida; aún no está conciliada al 100 %.</div><div><span class="chip c-ok">Aplicada</span><br>Conciliada: ves el reparto exacto.</div></div>`}
  </div>`;
}

export function vPago(ctx, id) {
  const c = ctx.perm.verMiCuenta ? datosDe(ctx.resumen, 'mi_cuenta') : null;
  const p = c?.comprobantes && Object.prototype.hasOwnProperty.call(c.comprobantes, id) ? c.comprobantes[id] : null;
  if (!p) return html`${sub('Comprobante', { volver: 'cuenta/pagado' })}<div class="sec">${vacio(I.documento, 'Comprobante no disponible', 'No encontramos este comprobante.')}</div>`;
  const url = ctx.enlaceDoc(p.url);
  return html`${sub(p.titulo, { volver: 'cuenta/pagado', chip: html`<span class="chip c-ok">Pagado</span>` })}<div class="sec"><div class="card">
    <div class="aviso ok">${I.checkG}<span><b>${p.aviso}</b></span></div>
    <div class="fila"><div class="t"><b>Monto pagado</b></div><div class="v"><b>${clp(p.monto)}</b></div></div>
    <div class="fila"><div class="t"><b>Fecha de pago</b></div><div class="v"><b>${fecha(p.fecha, { anio: true })}</b></div></div>
    <div class="fila"><div class="t"><b>Pagado por</b><span class="xs">${p.pagado_xs}</span></div><div class="v"><b>${p.pagado_por}</b></div></div>
    <div class="fila"><div class="t"><b>Vencimiento</b></div><div class="v"><b>${fecha(p.vence, { anio: true })}</b></div></div>
    <div class="fila"><div class="t"><b>Folio del comprobante</b></div><div class="v"><b>${p.folio}</b></div></div>
    ${url ? html`<a class="btn" href="${url}" target="_blank" rel="noopener noreferrer">${p.documento}</a>` : html`<button type="button" class="btn" disabled>${p.documento} <span class="prox">Próximamente</span></button>`}
  </div><p class="xs c">Los recordatorios de este vencimiento se detuvieron al registrar el pago.</p></div>`;
}

function segProy(actual) {
  return html`<div class="seg" role="group" aria-label="Proyecciones"><button type="button" data-ir="preiva" class="${actual === 'preiva' ? 'on' : ''}" aria-pressed="${actual === 'preiva'}">Pre-IVA</button><button type="button" data-ir="prerenta" class="${actual === 'prerenta' ? 'on' : ''}" aria-pressed="${actual === 'prerenta'}">Pre-Renta</button></div>`;
}

export function vPreIva(ctx) {
  const e = ctx.perm.preIva; const d = datosDe(ctx.resumen, 'pre_iva');
  let cuerpo;
  if (e === 'bloqueada') cuerpo = teaser('Pre-IVA', [['IVA estimado del mes', '$•••.•••'], ['Crédito acumulado', '$••.•••']], ['Estimación de tu IVA antes del cierre del mes', 'Aviso cuando tu analista la actualiza', 'Sin sorpresas el día 20'], ctx.waMejora);
  else if (!d) cuerpo = vacio(I.calendario, 'Tu Pre-IVA aún no está publicado', 'Cuando tu analista publique la estimación del mes, la verás aquí con su estado.');
  else cuerpo = html`<div class="card"><div class="li centro">${icoPreIva}<div class="t"><b>IVA estimado de ${mesDe(d.periodo)}</b><span class="xs">Publicado por tu analista el ${fecha(d.publicado_at)}, ${hora(d.publicado_at)}</span></div></div>
      <div class="mid s32">${clp(d.estimado, { aprox: true })}</div><div class="sm mt8">Con lo que llegó al SII hasta el ${fecha(d.info_hasta)}. Se declara y paga hasta el ${fecha(d.vence)}.</div></div>
    <div class="card"><h3 class="t15">Cómo se calcula</h3>${(d.calculo || []).map(paso)}<div class="total-l"><span>IVA estimado</span><span>${clp(d.estimado, { aprox: true })}</span></div></div>
    ${d.consejo ? html`<div class="nota"><b>Lo que te conviene saber</b><div class="cuerpo">${d.consejo}</div></div>` : ''}
    ${leyendaEstados}<p class="xs c">El monto final es el del F29 que te confirmamos en tu reporte.</p>`;
  return html`${sub('Pre-IVA', { chip: d ? chipEstadoProy(d.estado) : '' })}<div class="sec">${segProy('preiva')}${cuerpo}</div>`;
}

export function vPreRenta(ctx) {
  const e = ctx.perm.preRenta; const d = datosDe(ctx.resumen, 'pre_renta');
  let cuerpo;
  if (e === 'bloqueada') cuerpo = teaser('Pre-Renta', [['Renta proyectada', '$•.•••.•••'], ['PPM pagados', '$•••.•••']], ['Proyección de tu renta anual durante el año', 'Decisiones a tiempo antes del 31-12', 'Llegas a abril preparado'], ctx.waMejora);
  else if (!d) cuerpo = vacio(I.proyecciones, 'Tu Pre-Renta aún no está publicada', 'Cuando tu analista publique la proyección de tu renta, la verás aquí.');
  else cuerpo = html`<div class="aviso">${I.info}<span><b>Es una proyección, no una cifra definitiva.</b> Se actualiza con tu contabilidad y la revisamos contigo.</span></div>
    <div class="card osc"><div class="li centro">${icoMiRenta}<div class="t"><b class="wm"><span class="mi">Mi</span><span class="co">Renta</span></b><span class="xs">Publicada por tu analista el ${fecha(d.publicado_at)} · </span>${chipEstadoProy(d.estado)}</div></div>
      <div class="sm">Impuesto de primera categoría proyectado</div><div class="big">${clp(d.impuesto, { aprox: true })}</div>
      <div class="kpis mt12"><div class="kpi"><small>PPM pagados (${d.ppm_meses})</small><b class="claro">${clp(d.ppm_pagados)}</b></div><div class="kpi"><small>En abril pagarías</small><b class="cifra">${clp(d.saldo_abril, { aprox: true })}</b></div></div></div>
    <div class="card"><h3 class="t15">Cómo se proyecta</h3>${(d.calculo || []).map(paso)}
      <div class="mt12"><div class="xs fila"><span>Meses contabilizados</span><b>${d.meses_contabilizados} de 12</b></div><div class="prog"><i data-w="${pct((d.meses_contabilizados / 12) * 100)}"></i></div></div></div>
    ${d.anteriores?.length ? html`<div class="card"><h3 class="t15">Tus rentas anteriores</h3>${d.anteriores.map((a) => html`<div class="fila"><span>${a.at}</span><b>${clp(a.monto)}</b></div>`)}<div class="fila"><b class="cifra">AT ${d.anio_tributario} (proyección)</b><b>${clp(d.impuesto, { aprox: true })}</b></div></div>` : ''}
    ${d.nota ? html`<div class="nota">${d.nota}</div>` : ''}`;
  return html`${sub('Pre-Renta', { chip: d ? html`<span class="chip c-proy">AT ${d.anio_tributario}</span>` : '' })}<div class="sec">${segProy('prerenta')}${cuerpo}</div>`;
}

export function vTrabajos(ctx) {
  const sec = ctx.resumen?.secciones?.trabajos;
  const d = datosDe(ctx.resumen, 'trabajos');
  const act = d?.activos || [];
  if (sec?.error) {
    return html`${sub('Trabajos especiales', { volver: 'mas' })}<div class="sec">
      ${vacio(I.llave, 'No pudimos cargar tus trabajos especiales', 'Inténtalo de nuevo en unos minutos. Si sigue igual, escríbenos.')}${waCard(ctx.waEquipo)}</div>`;
  }
  return html`${sub('Trabajos especiales', { volver: 'mas' })}<div class="sec">
    ${act.length ? act.map((t) => html`<div class="card"><div class="hd"><span class="chip c-conc">${t.codigo}</span><span class="chip c-rev">${t.estado}</span></div>
      <h3 class="mt8">${t.servicio}</h3><div class="sm">A cargo de: ${t.responsable || 'tu equipo Contadoor'}</div>
      ${t.avance === null ? html`<div class="xs mt8">El avance se informa cuando el trabajo comienza.</div>`
        : html`<div class="prog mt12"><i data-w="${pct(t.avance)}"></i></div><div class="xs mt8">Avance ${pct(t.avance)} %</div>`}
      ${t.pasos?.length ? html`<ul class="pasos-te">${t.pasos.map((p) => html`<li class="${p.e === 'ok' ? 'ok' : p.e === 'act' ? 'act' : ''}"><span class="bol" aria-hidden="true">${p.e === 'ok' ? I.checkG : ''}</span><span>${p.t}${p.e === 'act' ? ' · ahora' : ''}</span></li>`)}</ul>` : ''}
      ${t.proximo ? html`<div class="nota mt8 mb0">Próximo paso: ${t.proximo}</div>` : ''}</div>
      ${t.pago ? html`<div class="card"><h3 class="t15">Pago del trabajo</h3>
        <div class="fila"><div class="t"><b>Valor total</b><span class="xs">${t.pago.cuotas === 1 ? 'pago único' : html`${t.pago.cuotas} cuotas`}${t.pago.folio ? html` · factura N° ${t.pago.folio}` : ''}</span></div><div class="v"><b>${clp(t.pago.total)}</b></div></div>
        <div class="fila"><div class="t"><b>Pagado</b><span class="xs">${t.pago.pagado_xs}</span></div><div class="v"><b>${clp(t.pago.pagado)}</b>${t.pago.pagado > 0 ? html`<span class="chip c-conc">Conciliado</span>` : ''}</div></div>
        ${t.pago.pendiente > 0 ? html`<div class="fila"><div class="t"><b>Pendiente</b><span class="xs">${t.pago.pendiente_xs}</span></div><div class="v"><b>${clp(t.pago.pendiente)}</b><span class="chip ${t.pago.vencido > 0 ? 'c-venc' : 'c-pend'}">${t.pago.vencido > 0 ? 'Vencido' : 'Por pagar'}</span></div></div>` : ''}
        ${ctx.perm.verMiCuenta ? html`<button type="button" class="btn lin" data-ir="cuenta">Ver en mi estado de cuenta</button>` : ''}</div>` : ''}
      ${t.documentos?.length || t.documentos_retenidos ? html`<div class="card"><h3 class="t15">Documentos del trabajo</h3>${(t.documentos || []).map((x) => html`<div class="fila"><div class="t"><b>${x.t}</b><span class="xs">${fecha(x.fecha)}</span></div>${ctx.enlaceDoc(x.url) ? html`<a href="${ctx.enlaceDoc(x.url)}" target="_blank" rel="noopener noreferrer">PDF</a>` : html`<span class="xs">PDF próximamente</span>`}</div>`)}
        ${t.documentos_retenidos ? html`<p class="xs mt8">Los documentos finales estarán disponibles aquí al completar la entrega.</p>` : ''}</div>` : ''}`)
      : vacio(I.llave, 'No tienes trabajos especiales en curso', '¿Necesitas una constitución, modificación u otro trámite? Escríbenos y te cotizamos.')}
    ${d?.terminados ? html`<p class="xs c">Trabajos terminados: ${d.terminados}</p>` : ''}
    ${act.length ? '' : waCard(ctx.waEquipo)}</div>`;
}

export function vMas(ctx) {
  const pro = ctx.perm.pro;
  return html`${sub('Más')}<div class="sec">
    <div class="card">
      <div class="li centro"><span class="ic i-m">${I.llave}</span><div class="t"><b>Trabajos especiales</b><span class="sm">${(datosDe(ctx.resumen, 'trabajos')?.activos || []).length} en curso</span></div><button type="button" class="btn lin auto" data-ir="trabajos">Abrir</button></div>
      <div class="li centro"><span class="ic i-a">${I.persona}</span><div class="t"><b>Mi acceso</b><span class="sm">Empresas, contraseña, cerrar sesión</span></div><button type="button" class="btn lin auto" data-ir="acceso">Abrir</button></div>
    </div>
    <div class="card miplan"><div class="hd"><h3>Mi plan</h3><span class="chip c-conc">${planTexto(ctx.resumen?.plan_nivel, ctx.resumen?.plan_nombre)}</span></div>
      <div class="fila"><div class="t"><b>✓ Reporte mensual e historial</b></div></div>
      ${ctx.perm.verMiCuenta ? html`<div class="fila"><div class="t"><b>✓ Mi cuenta: por pagar y pagado</b></div></div>` : ''}
      <div class="fila"><div class="t"><b>✓ Trabajos especiales</b></div></div>
      ${pro ? html`<div class="fila"><div class="t"><b>✓ Pre-IVA y Pre-Renta</b></div></div>`
        : html`<div class="fila"><div class="t"><b class="bloq-t">${I.candado} Pre-IVA y Pre-Renta</b><span class="xs">Incluido en Contadoor PRO</span></div><a class="btn auto" href="${ctx.waMejora}" target="_blank" rel="noopener noreferrer">Mejorar</a></div>`}
    </div>
    <div class="card"><div class="hd"><h3>Apariencia</h3></div><div class="sm">Elige cómo prefieres ver MiContadoor.</div>
      <div class="seg mb0 mt8" role="radiogroup" aria-label="Apariencia">${[['claro', 'Claro'], ['oscuro', 'Oscuro'], ['auto', 'Automático']].map(([v, t]) =>
        html`<button type="button" role="radio" data-apariencia="${v}" aria-checked="${ctx.tema === v}">${t}</button>`)}</div>
      <div class="xs mt8">"Automático" sigue la configuración de tu celular.</div></div>
    ${waCard(ctx.waEquipo)}
    <div class="marca-pie"><img class="logo-cla" src="/img/contadoor_lockup_glossy.png" alt="Contadoor" width="170" height="38"><img class="logo-osc" src="/img/contadoor_lockup_white.png" alt="Contadoor" width="170" height="70"></div>
    <p class="xs c">MiContadoor V1 · ${ctx.version}${ctx.api.modo === 'demo' ? ' · DEMO con datos ficticios' : ''}</p></div>`;
}

export function vAcceso(ctx) {
  const s = ctx.sesion;
  return html`${sub('Mi acceso', { volver: 'mas' })}<div class="sec">
    <div class="card"><div class="fila"><div class="t"><b>${s.cuenta.nombre || 'Tu cuenta'}</b><span class="xs">${s.cuenta.correo}</span></div></div></div>
    <div class="card"><h3 class="t15">Tus empresas</h3>${s.empresas.map((e) => html`<div class="fila"><div class="t"><b>${e.razon_social}</b><span class="xs">${e.rut} · ${e.rol === 'titular' ? 'Titular' : 'Usuario adicional'}</span></div>${e.ref === ctx.empresa.ref ? html`<span class="chip c-conc">Viendo</span>` : html`<button type="button" class="link" data-accion="elegir" data-ref="${e.ref}">Ver</button>`}</div>`)}
      <p class="xs m0 mt8">Los usuarios adicionales ven el reporte y las proyecciones; Mi cuenta y las facturas, solo si el titular lo pide a Contadoor.</p></div>
    <div class="card">
      <button type="button" class="btn lin" data-accion="cambiar-clave">Cambiar mi contraseña</button>
      <button type="button" class="btn lin" data-accion="salir">Cerrar sesión</button>
      <button type="button" class="btn lin gris" data-accion="salir-todos">Cerrar sesión en todos mis aparatos</button>
      <p class="xs m0 mt8">Úsalo si perdiste tu celular o crees que alguien conoce tu contraseña.</p></div></div>`;
}

export function hojaEmpresas(ctx) {
  return html`<div class="velo" data-accion="cerrar-hoja"><div class="hoja" role="dialog" aria-modal="true" aria-label="Elegir empresa">
    <h2>Elige la empresa</h2>${ctx.sesion.empresas.map((e) => html`<button type="button" class="opc${e.ref === ctx.empresa.ref ? ' on' : ''}" data-accion="elegir" data-ref="${e.ref}"><span><b>${e.razon_social}</b><span class="xs">${e.rut} · ${e.rol === 'titular' ? 'Titular' : 'Usuario adicional'}</span></span>${e.ref === ctx.empresa.ref ? I.check : ''}</button>`)}
    <button type="button" class="btn lin" data-accion="cerrar-hoja">Cerrar</button></div></div>`;
}

export function hojaSolicitud(ctx, tipo, item, mensaje) {
  const pague = tipo === 'pague';
  return html`<div class="velo" data-accion="cerrar-hoja"><div class="hoja" role="dialog" aria-modal="true" aria-label="${pague ? 'Ya lo pagué' : 'Ya transferí'}">
    <h2>${pague ? 'Ya lo pagué' : 'Ya transferí'}</h2>
    <p class="sm">${item?.titulo || ''} · ${clp(item?.monto)}</p>
    <form data-form="solicitud" data-tipo="${tipo}" data-id="${item?.id || ''}" novalidate>
      <label class="xs">Fecha del pago<input type="date" name="fecha" required></label>
      <label class="xs">Comprobante ${pague ? '(obligatorio)' : '(opcional)'}<input type="file" name="archivo" accept="application/pdf,image/jpeg,image/png" ${pague ? 'required' : ''}></label>
      ${mensaje ? html`<p class="aviso error mt8">${mensaje}</p>` : ''}
      <button type="submit" class="btn">Avisar a mi analista</button>
      <button type="button" class="btn lin" data-accion="cerrar-hoja">Cancelar</button>
      <p class="xs m0 mt8">Esto no marca el pago: tu analista lo revisa con la cartola o el comprobante y te confirmamos.</p>
    </form></div></div>`;
}
