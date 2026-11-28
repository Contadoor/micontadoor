// ASESORÍAS AL DÍA (Luciano 28-11): el cliente ve cuántas reuniones le quedan, agenda una, ve sus próximas y los ACUERDOS de cada reunión.
// Contrato: mc.mis_reuniones / mc.reunion_horarios / mc.reunion_solicitar / mc.reunion_cancelar (gestoor-backend 202611281600).
// Todo escapado con html``. Nunca se muestran notas internas del equipo (el servidor no las envía).
import { html, clp, fecha, hora } from './util.js';
import { I } from './iconos.js';
import { sub, vacio } from './vistas-comunes.js';

export const TEMAS = {
  estrategico: { t: 'Estrategia y números', xs: 'Con Luciano Duarte, fundador', ic: 'i-m', svg: 'grafico' },
  contable: { t: 'Contabilidad e impuestos', xs: 'Con tu asesor contable', ic: 'i-v', svg: 'documento' },
  rrhh: { t: 'Remuneraciones y RR. HH.', xs: 'Con tu asesor de RR. HH.', ic: 'i-a', svg: 'persona' },
};
const EST = {
  solicitada: ['c-pend', 'Por confirmar'], confirmada: ['c-ok', 'Confirmada'], cancelada: ['c-gris', 'Cancelada'],
  realizada: ['c-rev', 'Realizada'], no_asistio: ['c-gris', 'No se realizó'], cerrada: ['c-ok', 'Con minuta'],
};
const diaLargo = (iso) => { const d = new Date(iso); const s = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', weekday: 'long', day: 'numeric', month: 'long' }).format(d); return s.charAt(0).toUpperCase() + s.slice(1); };
const diaClave = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date(iso));

export function textoCupo(c) {
  if (!c) return '';
  const per = c.cada_meses === 3 ? 'este trimestre' : c.cada_meses === 1 ? 'este mes' : 'este período';
  if (!c.n) return 'Tu plan no incluye reuniones: puedes agendar una asesoría de 1 hora por ' + clp(c.precio_pagada) + '.';
  return c.disponibles > 0 ? `Te queda ${c.disponibles} de ${c.n} reunión incluida ${per}.` : `Ya usaste tu reunión incluida ${per}. Puedes agendar una asesoría adicional de 1 hora por ${clp(c.precio_pagada)}.`;
}

/** Tarjeta del Inicio. */
export function tarjetaReuniones(rn) {
  if (!rn || rn.estado !== 'ok') return '';
  const p = rn.proximas[0]; const ab = rn.acuerdos.length;
  return html`<button type="button" class="card kpi-btn reu-card" data-ir="reuniones"><div class="hd"><h3 class="con-ic"><span class="ic i-v">${I.agenda}</span>Tus reuniones</h3>
      <span class="chip ${rn.cupo.disponibles > 0 ? 'c-ok' : 'c-gris'}">${rn.cupo.n ? `${rn.cupo.disponibles} de ${rn.cupo.n} disponible` : 'Asesoría pagada'}</span></div>
    ${p ? html`<div class="sm"><b>${p.estado === 'confirmada' ? 'Próxima' : 'Por confirmar'}:</b> ${diaLargo(p.inicio)}, ${hora(p.inicio)} · ${TEMAS[p.tema]?.t || ''}</div>`
      : html`<div class="sm">${textoCupo(rn.cupo)}</div>`}
    ${ab ? html`<div class="xs mt8">${ab === 1 ? '1 acuerdo pendiente' : ab + ' acuerdos pendientes'} de tus reuniones</div>` : ''}
    <div class="xs mt8">${p ? 'Ver mis reuniones →' : 'Agendar una reunión →'}</div></button>`;
}

function filaReunion(r, ctx) {
  const [c, t] = EST[r.estado] || EST.solicitada; const tm = TEMAS[r.tema] || {};
  const m = r.minuta;
  return html`<div class="card reu"><div class="hd"><h3 class="con-ic"><span class="ic ${tm.ic || 'i-m'}">${I[tm.svg] || I.reunion}</span>${tm.t || 'Reunión'}</h3><span class="chip ${c}">${t}</span></div>
    <div class="sm">${diaLargo(r.inicio)} · ${hora(r.inicio)} a ${hora(r.fin)}${r.con?.nombre ? ' · con ' + r.con.nombre : ''}</div>
    ${r.pagada ? html`<div class="xs">Asesoría adicional · ${clp(r.precio)}</div>` : ''}
    <div class="xs mt8">Tu motivo: ${r.motivo}</div>
    ${r.meet_url ? html`<a class="btn mt8" href="${r.meet_url}" target="_blank" rel="noopener noreferrer"><span class="btn-ic">${I.reunion}</span>Unirme a la reunión</a>` : ''}
    ${r.estado === 'solicitada' ? html`<p class="xs m0 mt8">Tu asesor la confirmará pronto y te llegará la invitación.</p>` : ''}
    ${r.puede_cancelar ? (ctx.aseCancelar === r.id
      ? html`<div class="fila mt8"><span class="sm">¿Cancelar esta reunión? Se te devuelve el cupo.</span></div><div class="fila"><button type="button" class="btn lin gris" data-accion="ase-cancelar-no">No</button><button type="button" class="btn" data-accion="ase-cancelar-si" data-id="${r.id}">Sí, cancelar</button></div>`
      : html`<button type="button" class="btn lin gris mt8" data-accion="ase-cancelar" data-id="${r.id}">Cancelar reunión</button>`) : ''}
    ${m ? html`<div class="minuta mt12"><h3 class="t15">Lo que conversamos</h3><p class="sm">${m.resumen}</p>
        ${m.acuerdos?.length ? html`<h3 class="t15 mt8">Acuerdos</h3>${m.acuerdos.map((g) => html`<div class="fila"><span><span class="ic-mini ${g.estado === 'cumplido' ? 'i-v' : 'i-n'}" aria-hidden="true">${g.estado === 'cumplido' ? '✓' : '•'}</span> ${g.descripcion}<span class="xs bloque">${g.quien}${g.vence ? ' · para el ' + fecha(g.vence) : ''}</span></span><span class="chip ${g.estado === 'cumplido' ? 'c-ok' : 'c-pend'}">${g.estado === 'cumplido' ? 'Cumplido' : 'Pendiente'}</span></div>`)}` : ''}
        ${m.seguimiento ? html`<p class="xs mt8"><b>Seguimiento:</b> ${m.seguimiento}</p>` : ''}
        ${m.proxima ? html`<p class="xs"><b>Próxima reunión sugerida:</b> ${m.proxima}</p>` : ''}</div>` : ''}
  </div>`;
}

/** Pantalla «Tus reuniones». rn = normalizarReuniones(...) | {estado:'error'} | null. */
export function vReuniones(ctx, rn) {
  let cuerpo;
  if (!rn) cuerpo = vacio(I.calendario, 'Tus reuniones aún no están publicadas', 'Muy pronto podrás agendar tus reuniones con tu equipo Contadoor desde aquí.');
  else if (rn.estado === 'cargando') cuerpo = html`<div class="cargando" role="status" aria-label="Cargando"><div class="spin"></div></div>`;
  else if (rn.estado !== 'ok') cuerpo = vacio(I.calendario, 'No pudimos cargar tus reuniones', 'Vuelve a intentarlo en unos minutos. Si sigue igual, escríbenos.');
  else {
    const c = rn.cupo;
    cuerpo = html`<div class="card osc"><div class="hd"><h2 class="con-ic"><span class="ic i-v">${I.agenda}</span>${c.n ? `${c.disponibles} de ${c.n}` : 'Sin reuniones incluidas'}</h2><span class="chip c-proy">${c.cada_meses === 3 ? 'Trimestre' : 'Mes'} ${fecha(c.desde)} al ${fecha(c.hasta)}</span></div>
        <div class="sm">${textoCupo(c)}</div><div class="xs mt8">Las reuniones incluidas no se acumulan. Si cancelas o no puedes conectarte, se te devuelve.</div>
        <button type="button" class="btn mt12" data-ir="reunion-nueva"><span class="btn-ic">${I.agenda}</span>Agendar una reunión</button></div>
      ${rn.acuerdos.length ? html`<div class="card"><div class="hd"><h3>Acuerdos pendientes</h3><span class="chip c-pend">${rn.acuerdos.length}</span></div>
        ${rn.acuerdos.map((g) => html`<div class="fila"><span>${g.descripcion}<span class="xs bloque">${g.quien}${g.vence ? ' · para el ' + fecha(g.vence) : ''}</span></span>${g.vencido ? html`<span class="chip c-venc">Vencido</span>` : ''}</div>`)}</div>` : ''}
      ${rn.proximas.length ? html`<h2>Próximas</h2>${rn.proximas.map((r) => filaReunion(r, ctx))}` : ''}
      ${rn.historial.length ? html`<h2>Anteriores</h2>${rn.historial.map((r) => filaReunion(r, ctx))}` : ''}
      ${!rn.proximas.length && !rn.historial.length ? vacio(I.calendario, 'Aún no tienes reuniones', 'Agenda tu primera reunión: eliges el tema, la hora y nos cuentas qué quieres revisar.') : ''}`;
  }
  return html`${sub('Tus reuniones', { volver: 'inicio' })}<div class="sec">${cuerpo}</div>`;
}

/** Agendar: 1) tema · 2) hora · 3) motivo y confirmar. nv = st.aseNueva = {tema, horarios, sel, motivo, aceptoPago, mensaje, enviando}. */
export function vReunionNueva(ctx, rn, nv = {}) {
  if (!rn || rn.estado !== 'ok') return vReuniones(ctx, rn);
  const temas = rn.temas.filter((t) => t.disponible);
  const paso1 = html`<div class="card"><h3 class="t15">1. ¿Sobre qué quieres conversar?</h3>
    ${temas.map((t) => { const m = TEMAS[t.tema]; return html`<button type="button" class="li kpi-btn ${nv.tema === t.tema ? 'sel' : ''}" data-accion="ase-tema" data-tema="${t.tema}" aria-pressed="${nv.tema === t.tema}">
      <span class="ic ${m.ic}">${I[m.svg]}</span><div class="t"><b>${m.t}</b><span class="sm">${t.con?.nombre ? 'Con ' + t.con.nombre : m.xs}</span></div></button>`; })}
    ${!temas.length ? html`<p class="sm">Aún no tienes asesores asignados para agendar. Escríbenos y lo resolvemos.</p>` : ''}</div>`;
  let paso2 = '';
  if (nv.tema) {
    const hs = nv.horarios;
    if (hs === 'cargando' || hs == null) paso2 = html`<div class="card"><h3 class="t15">2. Elige el día y la hora</h3><div class="cargando chico" role="status"><div class="spin"></div></div></div>`;
    else if (hs === 'error') paso2 = html`<div class="card"><h3 class="t15">2. Elige el día y la hora</h3><p class="aviso error">No pudimos cargar los horarios. Inténtalo de nuevo.</p></div>`;
    else if (!hs.length) paso2 = html`<div class="card"><h3 class="t15">2. Elige el día y la hora</h3><p class="sm">No hay horarios libres en las próximas 3 semanas para este tema. Escríbenos y te buscamos un espacio.</p></div>`;
    else {
      const dias = []; for (const h of hs) { const k = diaClave(h.inicio); let d = dias.find((x) => x.k === k); if (!d) { d = { k, ini: h.inicio, hs: [] }; dias.push(d); } d.hs.push(h); }
      paso2 = html`<div class="card"><h3 class="t15 con-ic"><span class="ic i-a">${I.calendario}</span>2. Elige el día y la hora</h3><p class="xs m0 con-ic-xs"><span class="btn-ic">${I.reunion}</span>Hora de Chile · ${hs[0].incluida ? '30 minutos' : '1 hora'} por Google Meet</p>
        ${dias.map((d) => html`<div class="reu-dia"><b class="sm">${diaLargo(d.ini)}</b><div class="reu-horas">${d.hs.map((h) => html`<button type="button" class="chip-h ${nv.sel === h.inicio ? 'on' : ''} ${h.incluida ? '' : 'pago'}" data-accion="ase-hora" data-inicio="${h.inicio}" aria-pressed="${nv.sel === h.inicio}">${hora(h.inicio)}${h.incluida ? '' : ' · ' + clp(rn.cupo.precio_pagada)}</button>`)}</div></div>`)}</div>`;
    }
  }
  let paso3 = '';
  const sel = Array.isArray(nv.horarios) ? nv.horarios.find((h) => h.inicio === nv.sel) : null;
  if (sel) {
    paso3 = html`<form class="card campos" data-form="reunion" novalidate><h3 class="t15">3. Cuéntanos qué quieres revisar</h3>
      <div class="sm"><b>${TEMAS[nv.tema].t}</b> · ${diaLargo(sel.inicio)}, ${hora(sel.inicio)} a ${hora(sel.fin)}</div>
      <label class="xs">Motivo de la reunión<textarea name="motivo" rows="4" minlength="5" maxlength="1000" required placeholder="Por ejemplo: quiero revisar cómo bajar el PPM o planificar la renta. No escribas contraseñas ni claves.">${nv.motivo || ''}</textarea></label>
      ${sel.incluida ? html`<p class="xs m0">Esta reunión está incluida en tu plan.</p>`
        : html`<label class="check"><input type="checkbox" name="pago" ${nv.aceptoPago ? 'checked' : ''}><span>Acepto que es una asesoría adicional de 1 hora por <b>${clp(rn.cupo.precio_pagada)}</b>, que se agrega a mi próxima factura.</span></label>`}
      ${nv.mensaje ? html`<p class="aviso error" role="alert">${nv.mensaje}</p>` : ''}
      <button type="submit" class="btn" ${nv.enviando ? 'disabled' : ''}>Pedir la reunión</button>
      <p class="xs m0 mt8">Tu asesor la confirma y te llega la invitación a tu correo con el enlace de Google Meet.</p></form>`;
  }
  return html`${sub('Agendar una reunión', { volver: 'reuniones' })}<div class="sec"><div class="card osc"><div class="sm">${textoCupo(rn.cupo)}</div></div>${paso1}${paso2}${paso3}</div>`;
}
