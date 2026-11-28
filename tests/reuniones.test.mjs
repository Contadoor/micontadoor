import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarReuniones, normalizarHorarios, mensajeError } from '../js/datos.js';
import { vReuniones, vReunionNueva, tarjetaReuniones, textoCupo } from '../js/vistas-reuniones.js';
import { demo } from '../js/demo.js';

const R = demo.refs.rio;
test('Reuniones: cupo PRO trimestral, reunión pasada con minuta y acuerdos visibles para el cliente', () => {
  const rn = normalizarReuniones(demo.reuniones(R));
  assert.equal(rn.estado, 'ok'); assert.equal(rn.cupo.cada_meses, 3);
  const v = String(vReuniones({}, rn));
  assert.ok(v.includes('Agendar una reunión') && v.includes('Lo que conversamos') && v.includes('Acuerdos pendientes') && v.includes('Solicitar al SII la rebaja'));
  assert.ok(String(tarjetaReuniones(rn)).includes('Tus reuniones'));
});
test('Reuniones: agendar pide tema → hora → motivo; sin cupo exige aceptar $35.000', () => {
  const rn = normalizarReuniones(demo.reuniones(R));
  const hs = normalizarHorarios(demo.reunionHorarios(R, 'contable'));
  assert.ok(Array.isArray(hs) && hs.length > 0);
  const s1 = String(vReunionNueva({}, rn, {}));
  assert.ok(s1.includes('¿Sobre qué quieres conversar?') && !s1.includes('Elige el día'));
  const s3 = String(vReunionNueva({}, rn, { tema: 'contable', horarios: hs, sel: hs[0].inicio }));
  assert.ok(s3.includes('data-form="reunion"') && s3.includes('Cuéntanos qué quieres revisar'));
  const pag = hs.map((h) => ({ ...h, incluida: false }));
  assert.ok(String(vReunionNueva({}, rn, { tema: 'contable', horarios: pag, sel: pag[0].inicio })).includes('Acepto que es una asesoría adicional'));
  assert.match(textoCupo({ n: 0, precio_pagada: 35000 }), /\$35\.000/);
});
test('Reuniones: solicitar y cancelar en la demo; errores con mensaje claro', () => {
  const hs = normalizarHorarios(demo.reunionHorarios(R, 'estrategico'));
  const r = demo.reunionSolicitar(R, 'estrategico', hs[0].inicio, 'Planificar el próximo año', false);
  assert.equal(r.ok, hs[0].incluida); // si ya no hay cupo, exige pagada
  assert.equal(demo.reunionSolicitar(R, 'estrategico', '2020-01-01T00:00:00Z', 'x x x x x', true).codigo, 'ASE_HORA_NO_DISPONIBLE');
  assert.match(mensajeError('ASE_SIN_CLAVES'), /contraseñas/);
  assert.equal(normalizarReuniones(null).estado, 'error');
  assert.ok(String(vReuniones({}, null)).includes('aún no están publicadas'));
});
test('Reuniones: escapa el texto y no acepta enlaces de reunión que no sean de Google Meet', () => {
  const j = { ok: true, cupo: { n: 1, cada_meses: 1, disponibles: 1, usadas: 0 }, temas: [], acuerdos_abiertos: [], historial: [],
    proximas: [{ id: 1, tema: 'contable', estado: 'confirmada', inicio: '2030-01-01T13:30:00Z', fin: '2030-01-01T14:00:00Z', motivo: '<img src=x onerror=1>', meet_url: 'https://malo.cl/x', puede_cancelar: true }] };
  const rn = normalizarReuniones(j); const v = String(vReuniones({}, rn));
  assert.ok(!v.includes('<img') && !v.includes('malo.cl'));
});
