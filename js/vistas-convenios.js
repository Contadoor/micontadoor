// MC-CONV-1 (Luciano 28-11): «Tus convenios» con la Tesorería / SII. Solo lectura, datos de Gestoor (módulo Convenios).
// Todo escapado con html``. Sin dato = «—», nunca $0 inventado.
import { html, clp, fecha } from './util.js';
import { I } from './iconos.js';
import { sub, vacio } from './vistas-comunes.js';

const CHIP = { pagada: ['c-ok', 'Pagada'], pendiente: ['c-pend', 'Por pagar'], vencida: ['c-venc', 'Vencida'] };

/** Tarjeta del Inicio: solo si hay convenios activos. */
export function tarjetaConvenios(cv) {
  if (!cv || cv.estado !== 'ok' || !cv.activos.length) return '';
  const saldo = cv.activos.reduce((s, c) => s + (c.saldo || 0), 0);
  const venc = cv.activos.reduce((s, c) => s + c.vencidas, 0);
  const prox = cv.activos.map((c) => c.prox).filter((q) => q && q.vence).sort((a, b) => a.vence.localeCompare(b.vence))[0];
  return html`<button type="button" class="card kpi-btn conv-card" data-ir="convenios"><div class="hd"><h3>Tus convenios</h3><span class="chip ${venc ? 'c-venc' : 'c-ok'}">${venc ? (venc === 1 ? '1 cuota vencida' : venc + ' cuotas vencidas') : 'Al día'}</span></div>
    <div class="kpis"><div class="kpi"><small>${cv.activos.length === 1 ? '1 convenio activo' : cv.activos.length + ' convenios activos'}</small><b>${clp(saldo)}</b><span class="xs">por pagar</span></div>
      ${prox ? html`<div class="kpi"><small>Próxima cuota</small><b>${clp(prox.monto)}</b><span class="xs">vence el ${fecha(prox.vence)}</span></div>` : ''}</div>
    <div class="xs mt8">Ver el detalle de cada convenio →</div></button>`;
}

function convenio(c) {
  const pct = c.n ? Math.round((c.pagadas / c.n) * 100) : 0;
  return html`<div class="card"><div class="hd"><h3>${c.tipoTxt}${c.numero ? html` <span class="xs">N° ${c.numero}</span>` : ''}</h3>
      <span class="chip ${!c.activo ? 'c-gris' : c.vencidas ? 'c-venc' : 'c-ok'}">${!c.activo ? 'Terminado' : c.vencidas ? 'Con cuotas vencidas' : 'Al día'}</span></div>
    ${c.deuda ? html`<div class="sm">Deuda: ${c.deuda}</div>` : ''}
    <div class="prog mt8" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i data-w="${pct}"></i></div>
    <div class="xs">${c.pagadas} de ${c.n} cuotas pagadas</div>
    <div class="kpis mt8"><div class="kpi"><small>Total del convenio</small><b>${clp(c.total)}</b></div><div class="kpi"><small>Por pagar</small><b class="${c.vencidas ? 'rojo' : ''}">${clp(c.saldo)}</b></div></div>
    ${c.activo && c.prox ? html`<div class="sm mt8">Próxima: cuota ${c.prox.numero} de ${clp(c.prox.monto)}${c.prox.vence ? ', vence el ' + fecha(c.prox.vence, { anio: true }) : ''}</div>` : ''}
    <details class="an-mes mt8"><summary class="an-cab"><b>Ver las ${c.cuotas.length} cuotas</b></summary><div class="an-det">
      ${c.cuotas.map((q) => { const [k, t] = CHIP[q.estado]; return html`<div class="fila"><span>Cuota ${q.numero}${q.vence ? html` <span class="xs">· ${fecha(q.vence, { anio: true })}</span>` : ''}</span><span><b>${clp(q.monto)}</b> <span class="chip ${k}">${t}</span></span></div>`; })}
    </div></details></div>`;
}

/** Pantalla «Tus convenios». cv = normalizarConvenios(...) | {estado:'error'} | null (RPC no configurada). */
export function vConvenios(ctx, cv) {
  let cuerpo;
  if (!cv) cuerpo = vacio(I.documento, 'Tus convenios aún no están publicados', 'Muy pronto verás aquí tus convenios de pago con la Tesorería y sus cuotas.');
  else if (cv.estado !== 'ok') cuerpo = vacio(I.documento, 'No pudimos cargar tus convenios', 'Vuelve a intentarlo en unos minutos. Si sigue igual, escríbenos.');
  else if (!cv.lista.length) cuerpo = vacio(I.check, 'No tienes convenios de pago', 'Si algún día repactamos una deuda con la Tesorería o el SII, la verás aquí con sus cuotas.');
  else cuerpo = html`${cv.lista.map(convenio)}<p class="xs c">Cuotas según el registro de Contadoor. Si pagaste una cuota y aún figura por pagar, envíanos el comprobante.</p>`;
  return html`${sub('Tus convenios', { volver: 'inicio' })}<div class="sec">${cuerpo}</div>`;
}
