import { sha256Hex } from './util.js';
// MiContadoor · DATOS FICTICIOS para el modo demo (?demo=1). Ninguna persona, empresa ni monto es real.
// Simula al servidor: respeta la forma del contrato mc y aplica las mismas omisiones (plan y permisos por vínculo).
const REF = {
  rio: '0b9d1c52-5d0e-4a8e-9b51-1f7a3c2e9a01',
  aromos: '7c4e2a10-93b1-4f6d-8a2c-5e0d1b7f4c02',
  alerce: 'a1f3e8d4-2b6c-4d9e-b7a0-9c8d6e5f4a03',
};

const EMPRESAS = [
  { ref: REF.rio, razon_social: 'Comercial Río SpA', rut: '76.000.001-K', rol: 'titular', plan_nivel: 'pro' },
  { ref: REF.aromos, razon_social: 'Panadería Los Aromos SpA', rut: '76.000.002-8', rol: 'titular', plan_nivel: 'basico' },
  { ref: REF.alerce, razon_social: 'Inversiones Alerce SpA', rut: '76.000.003-6', rol: 'consulta', plan_nivel: 'pro' },
];

const PREIVA = {   // misma forma que mc._preiva_mes_en_curso (MC-PREIVA 26-11): Pre-IVA del MES EN CURSO, publicado al marcarlo enviado
  periodo: '2026-11', estado: 'preliminar', publicado_at: '2026-11-12T21:30:00Z', info_hasta: '2026-11-11', vence: '2026-12-21',
  estimado: 897000,
  calculo: [
    { t: 'IVA de tus ventas a la fecha', xs: '31 documentos', monto: 1159000 },
    { t: 'menos IVA de tus compras a la fecha', xs: '14 documentos', monto: -457000 },
    { t: 'menos remanente de octubre', monto: 0, resta: true },
    { t: 'IVA a pagar estimado al cierre del mes', xs: 'Proyectamos los días que faltan con tu promedio diario', monto: 702000 },
    { t: 'más PPM (pago provisional mensual)', xs: 'Tasa 1,5 % sobre tus ventas', monto: 195000 },
  ],
  consejo: '2 facturas de compra están pendientes en el SII. No rebajan tu IVA hasta que se acepten; si se aceptan antes del cierre del mes, tu IVA baja.',
};
const PRERENTA = {
  anio_tributario: 2027, estado: 'preliminar', publicado_at: '2026-11-10T19:00:00Z',
  impuesto: 780000, ppm_pagados: 598000, ppm_meses: 'ene–oct', saldo_abril: 58000,
  calculo: [
    { t: 'Ingresos del año', xs: '10 meses reales + 2 estimados', texto: '$74,4 M' },
    { t: 'menos gastos del año', texto: '− $68,2 M' },
    { t: 'Base estimada', texto: '$6,2 M' },
    { t: '× tasa', xs: 'régimen Pro Pyme', texto: '12,5 %' },
  ],
  meses_contabilizados: 10,
  anteriores: [{ at: 'AT 2025', monto: 610000 }, { at: 'AT 2026', monto: 702000 }],
  nota: '¿Planeas una inversión grande antes de diciembre? Cuéntanos: puede cambiar tu renta.',
};

// «Tu IVA del mes» (forma de mc.mis_impuestos). Cifras ficticias, coherentes con la maqueta aprobada el 19-11.
const IMPUESTOS_RIO = {
  ok: true, ref: REF.rio, periodo: '202610', conexion: { estado: 'conectado', carga_inicial_lista: true },
  datos_al: '2026-11-18T10:25:00Z', cobertura_completa: true, vence: '2026-11-20',
  estimacion: {
    debito: 1748000, credito: 969000, ventas_neto: 9200000, ventas_exento: 350000, ventas_documentos: 18, compras_documentos: 41, compras_neto: 5100000, compras_exento: 0,
    compras_pendientes: { documentos: 2, iva: 85500 },
    remanente: { monto: 118868, cod77: 118000, periodo: '202609', utm_origen: 72151, utm_destino: 72440 }, remanente_motivo: null,
    ppm_base: 9550000, ppm_tasa: 2.5, ppm_tasa_fuente: 'sii', ppm: 238750,
    iva_determinado: 660132, iva_pagar: 660132, remanente_siguiente: 0, total: 898882, exenta: false,
  },
  oficial: null, preiva_enviado: null,
  f29: [
    { periodo: '202610', estado: 'por_declarar', vence: '2026-11-20', total: null },
    { periodo: '202609', estado: 'declarado', vence: '2026-10-20', total: 640000 },
    { periodo: '202608', estado: 'declarado', vence: '2026-09-21', total: 610000 },
    { periodo: '202607', estado: 'declarado', vence: '2026-08-20', total: 700000 },
    { periodo: '202606', estado: 'declarado', vence: '2026-07-20', total: 655000 },
    { periodo: '202605', estado: 'declarado', vence: '2026-06-22', total: 690000 },
  ],
  observaciones: {
    items: [{ tipo: 'f22_observacion', anio_tributario: 2026, codigo: 'F135', texto: 'Diferencia en los retiros informados por la empresa (ejemplo).' }],
    cartas: { disponible: true, total_12_meses: 1, items: [{ categoria: 'notificacion', titulo: 'Solicitud de antecedentes de 2 facturas de un proveedor (ejemplo)', fecha: '2026-11-12', remitente: 'Unidad de ejemplo del SII', plazo: 'Dentro de los 5 días hábiles', nueva: true }] },
    cumplimiento: { disponible: true, cumple: true, estado: 'Cumple sus obligaciones tributarias', actualizado_en: '2026-11-18T10:00:00Z', condiciones: [{ titulo: 'Sin deudas tributarias (ejemplo)', cumple: true }] },
  },
};

const DATOS = {
  [REF.rio]: {
    reporte: {
      periodo: '2026-10', estado: 'confirmado', enviado_at: '2026-11-12T13:12:00Z', modalidad: 'contadoor', pagado: true,
      resumen: 'IVA (F29) $650.000 y cotizaciones $180.000: pagados por Contadoor el 13-11 con tu transferencia',
      obligaciones: [
        { id: 'r-f29-10', concepto: 'F29 · IVA de octubre', periodo: '2026-10', monto: 650000, estado: 'pagada', vence: '2026-11-20' },
        { id: 'r-cot-10', concepto: 'Cotizaciones de octubre', periodo: '2026-10', monto: 180000, estado: 'pagada', vence: '2026-11-13' },
      ],
      total_pagado_mes: 830000,
      calculo: [
        { t: 'IVA de tus ventas', xs: 'ventas netas $6.200.000', monto: 1178000 },
        { t: 'menos IVA de tus compras', xs: 'compras netas $3.900.000', monto: -741000 },
        { t: 'menos remanente anterior', monto: 0, resta: true },
        { t: 'IVA a pagar', monto: 437000 },
        { t: 'PPM', xs: 'tasa 1 % × ventas del mes', monto: 62000 },
        { t: 'Retenciones e impuesto único', monto: 151000 },
      ],
      total_f29: 650000,
      comentario: 'Tu crédito fiscal subió por la compra del horno. Guarda la factura: respalda el crédito ante el SII.',
      servicios: { monto: 120000, folio: '16.512', estado: 'pagada' },
      ppm_acumulado: 598000,
      historial: [
        { periodo: '2026-10', enviado_at: '2026-11-12', f29: 650000 }, { periodo: '2026-09', enviado_at: '2026-10-14', f29: 702300 },
        { periodo: '2026-08', enviado_at: '2026-09-12', f29: 588000 }, { periodo: '2026-07', enviado_at: '2026-08-13', f29: 610000 },
        { periodo: '2026-06', enviado_at: '2026-07-13', f29: 655000 }, { periodo: '2026-05', enviado_at: '2026-06-12', f29: 540000 },
      ],
    },
    mi_cuenta: {
      al: '2026-11-13', estado: 'al_dia', por_pagar: 180000, saldo_favor: 50000, vencido: 0,
      pendientes: [
        { id: 'te-041-3', titulo: 'Cuota 3 de 3 · trabajo especial', monto: 180000, vence: '2026-12-05', estado: 'por_vencer',
          detalle: 'Modificación de sociedad · TE-2026-041 · factura exenta N° 16.430', destino: 'contadoor', es_factura: true },
      ],
      proximos: [
        { titulo: 'Nuestros servicios · noviembre', xs: 'Se factura el 01-12 y vence el 21-12', chip: 'Aún no emitida', es_factura: true },
        { titulo: 'F29 · noviembre', xs: 'Se calcula al cierre del mes · lo pagamos con tu transferencia', chip: 'Aún no disponible' },
      ],
      pagado: [
        { id: 'tr-1211', fecha: '2026-11-12', monto: 1000000, estado: 'aplicada', origen: 'Banco de Chile · cuenta ···4417 · conciliada el 13-11',
          reparto: [
            { concepto: 'Nuestros servicios · octubre', xs: 'Factura N° 16.512', monto: 120000, es_factura: true },
            { concepto: 'F29 · IVA de octubre', xs: 'Pagado por Contadoor el 13-11', monto: 650000, comprobante: 'cp-f29-10' },
            { concepto: 'Cotizaciones de octubre', xs: 'Pagadas por Contadoor el 13-11 en Previred', monto: 180000, comprobante: 'cp-cot-10' },
          ],
          saldo_favor: 50000 },
        { id: 'tr-1211b', fecha: '2026-11-12', monto: 45000, estado: 'en_revision' },
      ],
      anteriores: [
        { fecha: '2026-10-14', detalle: 'servicios sep + F29 sep + cotizaciones sep', monto: 1268700, estado: 'aplicada' },
        { fecha: '2026-09-12', detalle: 'servicios ago + F29 ago + cotizaciones ago', monto: 1176400, estado: 'aplicada' },
      ],
      comprobantes: {
        'cp-f29-10': { titulo: 'F29 · octubre', aviso: 'Tu pago de IVA de octubre fue realizado con éxito.', monto: 650000, fecha: '2026-11-13',
          pagado_por: 'Contadoor', pagado_xs: 'Contadoor, con tu transferencia del 12-11', vence: '2026-11-20', folio: 'N° 0000000000 (ejemplo)', documento: 'Descargar comprobante del SII (PDF)' },
        'cp-cot-10': { titulo: 'Cotizaciones · octubre', aviso: 'Tu pago de cotizaciones de octubre fue realizado con éxito.', monto: 180000, fecha: '2026-11-13',
          pagado_por: 'Contadoor', pagado_xs: 'Contadoor, en Previred con tu transferencia del 12-11', vence: '2026-11-13', folio: 'N° 0000000000 (ejemplo)', documento: 'Descargar comprobante de Previred (PDF)' },
      },
    },
    pre_iva: PREIVA,
    pre_renta: PRERENTA,
    // Forma EXACTA de mc.trabajos (MC-5): la app la pasa por normalizarTrabajos(), igual que con el servidor real.
    trabajos: {
      activos: [{
        codigo: 'TE-2026-041', servicio: 'Modificación de sociedad', etapa: 'en_curso', estado: 'En ejecución', avance: 65, responsable: null,
        aceptado_el: '2026-10-02', iniciado_el: '2026-10-06', terminado_el: null, cerrado: false,
        pasos: [{ t: 'Revisión de antecedentes', e: 'ok', fecha: '2026-10-09' }, { t: 'Redacción de la escritura', e: 'ok', fecha: '2026-10-28' },
          { t: 'Firma en notaría', e: 'act', fecha: null }, { t: 'Inscripción en el Conservador', e: '', fecha: null }, { t: 'Publicación en el Diario Oficial', e: '', fecha: null }],
        proximo: 'Firma en notaría',
        pago: { total: 540000, cuotas_total: 3, pagado: 360000, pendiente: 180000, vencido: 0,
          cuotas: [{ n: 1, monto: 180000, vence: '2026-10-05', estado: 'pagada', pagada_el: '2026-10-04' },
            { n: 2, monto: 180000, vence: '2026-11-05', estado: 'pagada', pagada_el: '2026-11-04' },
            { n: 3, monto: 180000, vence: '2026-12-05', estado: 'por_pagar', pagada_el: null }],
          factura: { folio: '16.430', emitida_el: '2026-10-02' } },
        documentos: [{ t: 'Cotización aceptada', fecha: '2026-10-02', tipo: 'aceptacion' }, { t: 'Borrador de escritura', fecha: '2026-10-28', tipo: 'paso' }],
        documentos_retenidos: false,
      }],
      terminados: 2,
    },
    novedades: [
      { tipo: 'reporte', t: 'Tu reporte de octubre está listo', xs: 'También está en tu correo.', ir: 'reporte' },
      { tipo: 'pago', t: 'Tu pago de IVA de octubre fue realizado con éxito', xs: 'El comprobante ya está disponible.', ir: 'cuenta/pago/cp-f29-10', cuenta: true },
      { tipo: 'proy', t: 'Tu Pre-IVA de noviembre fue actualizado', xs: 'Estimación preliminar.', ir: 'preiva', pro: true },
      { tipo: 'te', t: 'Tu trabajo especial avanzó', xs: 'Ahora: firma en notaría.', ir: 'trabajos' },
    ],
  },
  [REF.aromos]: {
    reporte: {
      periodo: '2026-10', estado: 'confirmado', enviado_at: '2026-11-12T14:05:00Z', modalidad: 'directo', pagado: false,
      obligaciones: [
        { id: 'a-f29-10', concepto: 'F29 · octubre', periodo: '2026-10', monto: 398000, estado: 'pendiente', vence: '2026-11-20', fecha_interna: '2026-11-19' },
        { id: 'a-f29-09', concepto: 'IVA (F29)', periodo: '2026-09', monto: 412300, monto_confirmado: 431200, requiere_confirmacion: true, intereses: 18900,
          confirmado_at: '2026-11-07', vigente_hasta: '2026-11-20', estado: 'atrasada', respuesta: { texto: 'Pagaré el próximo mes', fecha: '2026-10-19' } },
        { id: 'a-dnp-08', concepto: 'Cotizaciones en DNP', periodo: '2026-08', monto: 171000, monto_confirmado: 186400, requiere_confirmacion: true, intereses: 15400,
          confirmado_at: '2026-11-07', vigente_hasta: '2026-11-20', estado: 'atrasada', respuesta: { texto: 'No pagaré este período', fecha: '2026-09-27' } },
        { id: 'a-dnp-09', concepto: 'Cotizaciones en DNP', periodo: '2026-09', monto: 164000, requiere_confirmacion: true, estado: 'pendiente' },
        { id: 'a-f29-08', concepto: 'IVA (F29)', periodo: '2026-08', monto: 377000, estado: 'pagada' },
      ],
      calculo: [
        { t: 'IVA de tus ventas', xs: 'ventas netas $3.400.000', monto: 646000 },
        { t: 'menos IVA de tus compras', xs: 'compras netas $1.520.000', monto: -288800 },
        { t: 'menos remanente anterior', monto: 0, resta: true },
        { t: 'IVA a pagar', monto: 357200 },
        { t: 'PPM', xs: 'tasa 1,2 % × ventas del mes', monto: 40800 },
      ],
      total_f29: 398000,
      comentario: 'Te recomendamos regularizar el IVA de septiembre antes del 20-11 para evitar que sigan subiendo los intereses.',
      servicios: { monto: 65000, folio: '16.540', estado: 'por_vencer', vence: '2026-11-23' },
      ppm_acumulado: 402000,
      historial: [
        { periodo: '2026-10', enviado_at: '2026-11-12', f29: 398000 }, { periodo: '2026-09', enviado_at: '2026-10-13', f29: 412300 },
        { periodo: '2026-08', enviado_at: '2026-09-12', f29: 377000 }, { periodo: '2026-07', enviado_at: '2026-08-12', f29: 351000 },
      ],
    },
    mi_cuenta: {
      al: '2026-11-09', estado: 'pendiente', por_pagar: 65000, saldo_favor: 0, vencido: 0,
      pendientes: [
        { id: 'fa-16540', titulo: 'Nuestros servicios · octubre', monto: 65000, vence: '2026-11-23', estado: 'por_vencer',
          detalle: 'Factura N° 16.540 · vence el 23-11 (el 21 es sábado)', destino: 'contadoor', es_factura: true },
        { id: 'a-f29-10', titulo: 'F29 · octubre (pagas tú en el SII)', monto: 398000, vence: '2026-11-19', estado: 'por_vencer',
          detalle: 'Tu fecha para pagar: jueves 19-11 · vence en el SII el viernes 20-11', destino: 'directo' },
      ],
      proximos: [],
      pagado: [],
      anteriores: [{ fecha: '2026-10-21', detalle: 'servicios sep', monto: 65000, estado: 'aplicada' }],
      comprobantes: {},
    },
    trabajos: { activos: [], terminados: 0 },
    novedades: [
      { tipo: 'reporte', t: 'Tu reporte de octubre está listo', xs: 'Incluye pendientes de meses anteriores.', ir: 'reporte' },
    ],
  },
  [REF.alerce]: {
    reporte: {
      periodo: '2026-10', estado: 'confirmado', enviado_at: '2026-11-11T15:00:00Z', modalidad: 'contadoor', pagado: false,
      obligaciones: [
        { id: 'l-f29-10', concepto: 'F29 · octubre', periodo: '2026-10', monto: 214000, estado: 'pendiente', vence: '2026-11-20', fecha_interna: '2026-11-19' },
      ],
      calculo: [
        { t: 'IVA de tus ventas', xs: 'ventas netas $1.800.000', monto: 342000 },
        { t: 'menos IVA de tus compras', xs: 'compras netas $720.000', monto: -136800 },
        { t: 'IVA a pagar', monto: 205200 }, { t: 'PPM', xs: 'tasa 0,5 % × ventas del mes', monto: 8800 },
      ],
      total_f29: 214000,
      comentario: 'Mes estable. No hay documentos pendientes.',
      servicios: { monto: 95000, folio: '16.533', estado: 'por_vencer', vence: '2026-11-23' },
      ppm_acumulado: 88000,
      historial: [{ periodo: '2026-10', enviado_at: '2026-11-11', f29: 214000 }, { periodo: '2026-09', enviado_at: '2026-10-12', f29: 198000 }],
    },
    mi_cuenta: { al: '2026-11-09', estado: 'al_dia', por_pagar: 95000, saldo_favor: 0, vencido: 0, pendientes: [], proximos: [], pagado: [], anteriores: [], comprobantes: {} },
    pre_iva: { ...PREIVA, estimado: 231000, consejo: 'Sin documentos pendientes a la fecha.' },
    pre_renta: { ...PRERENTA, impuesto: 240000, ppm_pagados: 88000, saldo_abril: 152000 },
    trabajos: { activos: [], terminados: 1 },
    novedades: [{ tipo: 'reporte', t: 'Tu reporte de octubre está listo', xs: 'Ya está en tu correo o lo puedes ver aquí.', ir: 'reporte' }],
  },
};

const clon = (x) => JSON.parse(JSON.stringify(x));

// ── MICONTADOOR-APERTURA · términos del servidor (mismo texto V1 del 16-11, en formato de texto: «## » = subtítulo) ──
export const TERMINOS_V1_TEXTO = [
  '## 1. Qué es MiContadoor',
  'MiContadoor es el portal de clientes de Asesorías Contadoor Ltda. (en adelante, «Contadoor»). Aquí ves la información que tu equipo Contadoor publica sobre tu empresa: reportes mensuales, estado de cuenta, proyecciones y trabajos especiales. El portal es solo de consulta: no reemplaza a tu equipo, al SII ni a la Tesorería.',
  '## 2. Tu acceso es personal',
  'Tu cuenta es solo para ti. No compartas tu contraseña. Si otra persona de tu empresa necesita acceso, pídelo a tu equipo Contadoor y le crearemos su propia cuenta. Si crees que alguien entró con tus datos, cambia tu contraseña y avísanos de inmediato.',
  '## 3. Las cifras',
  'Los montos de tu reporte son los que tu equipo revisó y confirmó. Las proyecciones (Pre-IVA y Pre-Renta) son estimaciones con la información disponible a la fecha y pueden cambiar; no son cifras definitivas. Ante cualquier diferencia, manda lo que te confirme tu equipo por escrito.',
  '## 4. Pagos',
  'Los botones «Ya transferí» y «Ya lo pagué» solo nos avisan: el pago se da por recibido cuando nuestro equipo lo confirma. Contadoor nunca te pedirá que transfieras a una cuenta distinta de la que aparece en este portal.',
  '## 5. Qué información tratamos y para qué',
  'Datos de tu empresa y de sus socios, documentos tributarios y contables, información de pagos y tus datos de contacto, solo lo necesario para prestar el servicio contratado (contabilidad, impuestos, reportes y asesoría). Nunca la vendemos ni la usamos para publicidad de terceros.',
  '## 6. Quién accede y dónde se guarda',
  'Solo el equipo asignado a tu empresa y la dirección de Contadoor, con usuario personal y registro de cada acceso, bajo deber de reserva. La información se guarda en nuestro sistema de gestión con acceso controlado. Se comparte solo con el SII, la Tesorería u otros organismos cuando el servicio lo requiere, y con proveedores tecnológicos que nos dan soporte bajo confidencialidad, salvo obligación legal.',
  '## 7. Cuánto tiempo',
  'Mientras dure el servicio y los plazos que exige la ley para la documentación tributaria. Al terminar el servicio, tu acceso a MiContadoor se cierra y te entregamos tu información.',
  '## 8. Tus derechos',
  'Conforme a la Ley N° 19.628 sobre protección de la vida privada y su actualización por la Ley N° 21.719, puedes pedir en cualquier momento acceder, corregir, eliminar u oponerte al uso de tus datos, o recibir una copia de ellos, escribiendo a info@contadoor.cl.',
  '## 9. Si algo ocurre',
  'Si detectamos un incidente que pueda afectar tu información, te avisamos sin demora, te contamos qué pasó y qué medidas tomamos.',
  '## 10. Cambios',
  'Si cambiamos estos términos, te pediremos aceptarlos de nuevo al entrar. Responsable: Asesorías Contadoor Ltda., RUT 77.166.269-2 · info@contadoor.cl.',
].join('\n\n');
const TERMINOS_TITULO = 'Términos de uso y aviso de privacidad de MiContadoor';

// Tu incorporación (forma de mc.mi_incorporacion). Pasos y fechas ficticios.
const PASOS_INC = ['Te damos la bienvenida', 'Pagas tu plan de activación', 'Nos compartes tus claves y balances anteriores', 'Creas tu acceso a MiContadoor',
  'Preparamos tu diagnóstico "Aquí partimos"', 'Reunión de entrega del diagnóstico'];
function incorporacionDe(ref, opciones) {
  if (opciones.inc === 'error') return 'error';
  if (ref === REF.alerce || opciones.inc === 'no') return { ok: true, disponible: false };
  const listoDiag = ref === REF.aromos || opciones.inc === 'diag';
  const terminado = opciones.inc === 'terminado';
  const est = terminado ? ['listo', 'listo', 'listo', 'listo', 'listo', 'listo']
    : listoDiag ? ['listo', 'listo', 'listo', 'listo', 'listo', 'pendiente']
      : ['listo', 'listo', 'esperando_tu_respuesta', 'en_curso', 'pendiente', 'pendiente'];
  return { ok: true, disponible: true, terminado, avance: { listos: terminado ? 10 : listoDiag ? 9 : 4, total: 10 },
    fecha_reunion: listoDiag || terminado ? '2026-12-02' : null, diagnostico: { emitido: listoDiag || terminado },
    pasos: PASOS_INC.map((titulo, i) => ({ orden: i + 1, titulo, estado: est[i] })) };
}
const rolDe = (e, opciones) => (opciones.rol === 'consulta' ? 'consulta' : e.rol);
// «Tu año con el SII» (forma de mc.mis_impuestos_anio). Cifras FICTICIAS: un mes de cada estado de pago.
const F29_VACIO = { estado: 'sin_dato', rectificada: false, montos: false, iva_determinado: null, remanente: null, resultado: null, retenciones: null, impuesto_unico: null, ppm: null, ppm_tasa: null, recargos: null, total_a_pagar: null };
const f29d = (iva, ppm, o = {}) => ({ ...F29_VACIO, estado: 'declarado', montos: true, iva_determinado: iva, remanente: 0, resultado: iva > 0 ? 'iva_a_pagar' : 'cero', retenciones: 15000, impuesto_unico: 42000, ppm, ppm_tasa: 1.25,
  total_a_pagar: iva + ppm + 57000, ...o });
const pg = (estado, fuente = 'contadoor') => ({ estado, fuente, fecha: null });
const ANIO_2026 = {
  1: { f: f29d(310000, 48000), p: pg('pagado') }, 2: { f: f29d(0, 49500, { remanente: 85000, resultado: 'remanente', total_a_pagar: 106500 }), p: pg('sin_informacion', null) },
  3: { f: f29d(0, 51000, { resultado: 'cero', total_a_pagar: 108000 }), p: pg('postergado', 'sii') }, 4: { f: f29d(290000, 52500), p: pg('pagado') },
  5: { f: { ...F29_VACIO, estado: 'no_declarado' }, p: pg('sin_informacion', null) }, 6: { f: f29d(305000, 55500, { rectificada: true }), p: pg('postergado') },
  7: { f: f29d(298000, 57000), p: pg('girado') }, 8: { f: f29d(321000, 58500), p: pg('pendiente') },
  9: { f: { ...f29d(0, 0), retenciones: 0, impuesto_unico: 0, total_a_pagar: 0 }, p: pg('nada_que_pagar', 'sii') }, 10: { f: f29d(334000, 61500, { recargos: 9800 }), p: pg('sin_informacion', null) },
};
const ANIO_2025 = (m) => ({ f: f29d(250000 + m * 4000, 40000 + m * 1000), p: pg(m <= 10 ? 'pagado' : 'sin_informacion', m <= 10 ? 'contadoor' : null) });


// MC-6 · Novedades ficticias (forma de mc.avisos). El servidor las crea POR VÍNCULO; aquí se simula su filtro de permisos.
const hace = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
const AVISOS = {
  [REF.rio]: [
    { id: 100, evento: 'cobranza', titulo: 'Tienes una factura pendiente 📄', texto: 'Revisa el detalle y cómo pagar en Mi cuenta. Si ya pagaste, gracias.', ruta: 'cuenta', h: 1 },
    { id: 101, evento: 'reporte_listo', titulo: 'Tu reporte de octubre está listo 📊', texto: 'Revisa lo que pagas este mes y cómo llegamos a tu impuesto. También te llegó por correo.', ruta: 'reporte', h: 3 },
    { id: 102, evento: 'pago_confirmado', titulo: 'Pago confirmado ✅', texto: 'Registramos tu pago. Puedes ver el detalle en Mi cuenta → Pagado.', ruta: 'cuenta/pagado', h: 20 },
    { id: 103, evento: 'tramite_avanzo', titulo: 'Tu trámite avanzó ✍️', texto: 'Firma en notaría', ruta: 'trabajos', h: 30, leido: true },
    { id: 104, evento: 'iva_vence', titulo: 'Tu IVA vence el 19 ⏰', texto: 'Revisa el monto en tu reporte y paga a tiempo para evitar multas e intereses.', ruta: 'reporte', h: 50, leido: true },
  ],
  [REF.aromos]: [
    { id: 201, evento: 'faltan_compras', titulo: 'Ojo: faltan facturas de compra ⚠️', texto: 'Tu analista no encuentra algunas facturas de compra de octubre. Si las tienes, pídeselas a tu proveedor o escríbenos: así se pueden rebajar de tu IVA.', ruta: 'inicio', h: 5 },
    { id: 202, evento: 'reporte_listo', titulo: 'Tu reporte de octubre está listo 📊', texto: 'Revisa lo que pagas este mes y cómo llegamos a tu impuesto. También te llegó por correo.', ruta: 'reporte', h: 26 },
  ],
  [REF.alerce]: [
    { id: 301, evento: 'reporte_listo', titulo: 'Tu reporte de octubre está listo 📊', texto: 'Revisa lo que pagas este mes y cómo llegamos a tu impuesto. También te llegó por correo.', ruta: 'reporte', h: 8 },
    { id: 302, evento: 'pago_confirmado', titulo: 'Pago confirmado ✅', texto: 'Registramos tu pago.', ruta: 'cuenta/pagado', h: 9 },   // el «servidor» lo omite al usuario adicional
  ],
};
const leidos = new Set();

export const demo = {
  /** Igual que mc.mis_impuestos_anio (REPORTE-HISTORIAL-SII). Río: año completo con todos los estados de pago; Alerce: aún no conectada. */
  impuestosAnio(ref, anio) {
    const e = EMPRESAS.find((x) => x.ref === ref);
    if (!e) return null;
    const a = Number.isInteger(anio) ? anio : 2026;
    if (a !== 2026 && a !== 2025) return { ok: false, codigo: 'MC_PERIODO_INVALIDO' };
    const meses = [];
    for (let m = 1; m <= 12; m++) {
      const futuro = a === 2026 && m === 12; const enCurso = a === 2026 && m === 11; const x = a === 2026 ? ANIO_2026[m] : ANIO_2025(m);
      const conRcv = ref !== REF.alerce && !futuro;
      meses.push({ periodo: `${a}${String(m).padStart(2, '0')}`, mes: m, futuro, en_curso: enCurso, vence: `${m === 12 ? a + 1 : a}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-20`,
        ventas: conRcv ? { neto: 3800000 + m * 125000, exento: 0, iva: 722000 + m * 23750, documentos: 40 + m } : null,
        compras: conRcv ? { neto: 2100000 + m * 60000, exento: 0, iva: 399000 + m * 11400, documentos: 22 + (m % 5) } : null,
        f29: ref !== REF.alerce && x ? x.f : { ...F29_VACIO, estado: futuro || enCurso ? 'futuro' : 'sin_dato' }, pago: ref !== REF.alerce && x ? x.p : null });
    }
    const f = meses.filter((z) => z.f29.montos);
    return { ok: true, ref, anio: a, conexion: { estado: ref === REF.alerce ? 'no_conectado' : 'conectado' }, datos_al: '2026-11-24T12:05:00Z',
      totales: { ventas_neto: meses.reduce((s, z) => s + (z.ventas?.neto || 0), 0), compras_neto: meses.reduce((s, z) => s + (z.compras?.neto || 0), 0),
        total_a_pagar: f.reduce((s, z) => s + z.f29.total_a_pagar, 0), ppm: f.reduce((s, z) => s + z.f29.ppm, 0), meses_con_f29: f.length },
      meses };
  },
  refs: REF,
  correo: true,                         // R2: preferencia de correo simulada (la cambia «Avisos por correo»)
  /** Igual que mc.avisos(p_ref): por vínculo; sin Mi cuenta, el servidor no entrega avisos de pagos. */
  avisos(ref, opciones = {}) {
    const e = EMPRESAS.find((x) => x.ref === ref);
    if (!e) return null;
    const rol = opciones.rol === 'consulta' ? 'consulta' : e.rol;
    const lista = (AVISOS[ref] || []).filter((a) => rol === 'titular' || (a.evento !== 'pago_confirmado' && a.evento !== 'cobranza'))
      .map((a) => ({ id: a.id, evento: a.evento, titulo: a.titulo, texto: a.texto, ruta: a.ruta, creado_at: hace(a.h), leido: a.leido === true || leidos.has(a.id) }));
    return { ok: true, no_leidos: lista.filter((a) => !a.leido).length, avisos: lista, correo: { activo: this.correo !== false && opciones.correo !== '0', disponible: true } };
  },
  avisosLeidos(ref, ids) {
    for (const a of AVISOS[ref] || []) if (ids === null || ids.includes(a.id)) leidos.add(a.id);
    return { ok: true };
  },
  /** ASESORÍAS AL DÍA en memoria (forma de mc.mis_reuniones). Río: plan PRO (1 por trimestre) con una reunión pasada con minuta. Cifras FICTICIAS. */
  _reu: null,
  _reuBase() {
    if (this._reu) return this._reu;
    const iso = (d, h) => new Date(Date.UTC(2026, 10, d, h + 3, h === 10 ? 30 : 30)).toISOString();
    this._reu = { seq: 10, lista: [{ id: 1, tema: 'contable', estado: 'cerrada', inicio: iso(12, 10), fin: iso(12, 11).replace(':30:', ':00:'), motivo: 'Revisar el PPM y la proyección de renta', pagada: false, precio: null,
      con: { nombre: 'Leticia Romero' }, meet_url: null, puede_cancelar: false,
      minuta: { resumen: 'Revisamos el PPM del año: va por sobre lo necesario. Acordamos bajar la tasa y preparar la renta con tiempo.', seguimiento: 'Revisamos de nuevo en diciembre con el cierre de noviembre.', proxima: 'Diciembre, después del día 20',
        acuerdos: [{ descripcion: 'Enviar las facturas de compra de octubre que faltan', quien: 'Tú', vence: '2026-12-05', estado: 'pendiente' },
                   { descripcion: 'Solicitar al SII la rebaja de la tasa de PPM', quien: 'Leticia Romero', vence: '2026-12-10', estado: 'pendiente' }] } }] };
    return this._reu;
  },
  reuniones(ref) {
    if (!EMPRESAS.some((e) => e.ref === ref)) return null;
    const b = this._reuBase(); const usadas = b.lista.filter((r) => !r.pagada && ['solicitada', 'confirmada', 'realizada', 'cerrada'].includes(r.estado) && r.inicio >= '2026-10-01').length;
    const vivas = (r) => ['solicitada', 'confirmada'].includes(r.estado) && Date.parse(r.fin) > Date.now();
    return { ok: true, ref, cupo: { plan: 'asesoria', n: 1, cada_meses: 3, desde: '2026-10-01', hasta: '2026-12-31', usadas, disponibles: Math.max(1 - usadas, 0), precio_pagada: 35000 },
      temas: [{ tema: 'estrategico', disponible: true, con: { nombre: 'Luciano Duarte' } }, { tema: 'contable', disponible: true, con: { nombre: 'Leticia Romero' } }, { tema: 'rrhh', disponible: true, con: { nombre: 'Daniela Cáceres' } }],
      proximas: b.lista.filter(vivas).sort((x, y) => x.inicio.localeCompare(y.inicio)), historial: b.lista.filter((r) => !vivas(r)),
      acuerdos_abiertos: b.lista.flatMap((r) => (r.minuta?.acuerdos || []).filter((g) => g.estado === 'pendiente').map((g, i) => ({ id: r.id * 100 + i, ...g, vencido: false }))) };
  },
  reunionHorarios(ref, tema) {
    const r = this.reuniones(ref); const incl = r.cupo.disponibles > 0; const out = [];
    const base = new Date(); base.setUTCHours(12, 0, 0, 0);
    for (let k = 3; out.length < 12 && k < 30; k++) {
      const d = new Date(base.getTime() + k * 864e5); const dow = d.getUTCDay();
      if (dow === 0 || dow === 6 || (tema !== 'estrategico' && ![2, 3, 4].includes(dow))) continue;
      for (const [h, m] of incl ? [[13, 30], [14, 25], [19, 30], [20, 25]] : [[13, 30], [19, 30]]) {
        const i = new Date(d); i.setUTCHours(h, m, 0, 0); const f = new Date(i.getTime() + (incl ? 40 : 60) * 6e4);
        out.push({ inicio: i.toISOString(), fin: f.toISOString(), incluida: incl });
      }
    }
    return { ok: true, tema, horarios: out };
  },
  reunionSolicitar(ref, tema, inicio, motivo, pagada) {
    const h = this.reunionHorarios(ref, tema).horarios.find((x) => x.inicio === inicio);
    if (!h) return { ok: false, codigo: 'ASE_HORA_NO_DISPONIBLE' };
    if (String(motivo || '').trim().length < 5) return { ok: false, codigo: 'ASE_MOTIVO' };
    if (!h.incluida && !pagada) return { ok: false, codigo: 'ASE_SIN_CUPO' };
    const b = this._reuBase(); const id = ++b.seq;
    const con = { estrategico: 'Luciano Duarte', contable: 'Leticia Romero', rrhh: 'Daniela Cáceres' }[tema];
    b.lista.push({ id, tema, estado: 'solicitada', inicio: h.inicio, fin: h.fin, motivo: String(motivo).trim(), pagada: !h.incluida, precio: h.incluida ? null : 35000, con: { nombre: con }, meet_url: null, puede_cancelar: true, minuta: null });
    return { ok: true, id };
  },
  reunionCancelar(ref, id) {
    const r = this._reuBase().lista.find((x) => x.id === id && x.puede_cancelar);
    if (!r) return { ok: false, codigo: 'ASE_NO_CANCELABLE' };
    r.estado = 'cancelada'; r.puede_cancelar = false; return { ok: true, id };
  },
  /** Igual que mc.mis_convenios. Río: un convenio TGR activo (cifras FICTICIAS); el resto, sin convenios. */
  convenios(ref) {
    if (!EMPRESAS.some((e) => e.ref === ref)) return null;
    if (ref !== REF.rio) return { ok: true, ref, convenios: [] };
    const cuotas = Array.from({ length: 12 }, (_, i) => ({ numero: i + 1, monto: 85400, vence: `${i < 11 ? 2026 : 2027}-${String(((i + 5) % 12) + 1).padStart(2, '0')}-28`, estado: i < 6 ? 'pagada' : i === 6 ? 'vencida' : 'pendiente' }));
    return { ok: true, ref, convenios: [{ id: 1, tipo: 'TGR', numero: '1234567', deuda: 'IVA de marzo y abril 2026', estado: 'activo', monto_total: 1024800, monto_cuota: 85400, n_cuotas: 12,
      fecha_inicio: '2026-05-28', fecha_termino: '2027-04-28', pagadas: 6, saldo: 512400, cuotas }] };
  },
  incorporacion(ref, opciones = {}) { return EMPRESAS.some((e) => e.ref === ref) ? incorporacionDe(ref, opciones) : null; },
  async terminosVigentes(opciones = {}) {
    const sha = await sha256Hex(TERMINOS_V1_TEXTO);
    return { ok: true, version: '2026-11-16', titulo: TERMINOS_TITULO, texto: TERMINOS_V1_TEXTO, sha256: opciones.huella === 'mala' ? 'f'.repeat(64) : sha };
  },
  async misTerminos() { return { ok: true, aceptaciones: [{ version: '2026-11-16', sha256: await sha256Hex(TERMINOS_V1_TEXTO), aceptada_at: '2026-11-16T19:52:00Z' }] }; },
  async terminosTexto(v) {
    if (v !== '2026-11-16') return { ok: false, codigo: 'MC_SIN_ACCESO' };
    return { ok: true, version: v, titulo: TERMINOS_TITULO, texto: TERMINOS_V1_TEXTO, sha256: await sha256Hex(TERMINOS_V1_TEXTO) };
  },
  /** Soporte en memoria (como mc.soporte_crear / mc.mis_solicitudes): folio correlativo y máx. 5 por cuenta en 24 h. */
  soporteNuevo() {
    const lista = [{ folio: 'MC-2026-00007', ref: REF.rio, tipo: 'datos', estado: 'cerrada', creada_at: '2026-11-18T13:10:00Z', actualizada_at: '2026-11-18T16:40:00Z' }];
    let n = 11; let hoy = 0;
    return {
      crear(ref, tipo, mensaje) {
        if (!EMPRESAS.some((e) => e.ref === ref)) return { ok: false, codigo: 'MC_SIN_ACCESO' };
        if (String(mensaje).trim().length < 10) return { ok: false, codigo: 'MC_DATOS' };
        if (hoy >= 5) return { ok: false, codigo: 'MC_LIMITE' };
        hoy += 1; n += 1; const folio = `MC-2026-${String(n).padStart(5, '0')}`; const at = new Date().toISOString();
        lista.unshift({ folio, ref, tipo, estado: 'abierta', creada_at: at, actualizada_at: at });
        return { ok: true, folio };
      },
      listar(ref) { return { ok: true, solicitudes: lista.filter((x) => x.ref === ref).map(({ ref: _r, ...x }) => clon(x)) }; },
    };
  },
  sesion({ terminos = false } = {}) {
    return { ok: true, cuenta: { correo: 'carolina@ejemplo.cl', nombre: 'Carolina Demo', terminos_pendientes: terminos }, empresas: clon(EMPRESAS) };
  },
  /** Igual que mc.empresa_resumen + datos publicados (MC-2…MC-5). opciones.plan='cumpl' / opciones.rol='consulta' fuerzan el caso. */
  resumen(ref, opciones = {}) {
    const e = EMPRESAS.find((x) => x.ref === ref);
    if (!e) return null;
    const rol = rolDe(e, opciones);
    const nivel = opciones.plan === 'cumpl' ? 'basico' : e.plan_nivel;
    const d = clon(DATOS[ref]);
    const verCuenta = rol === 'titular'; const verFact = rol === 'titular';   // D2: valores por defecto del vínculo
    const sec = (datos) => (datos ? { disponible: true, datos } : { disponible: false });
    if (!verFact) {                                                            // el servidor omite lo de facturas
      delete d.reporte.servicios;
      if (d.mi_cuenta) d.mi_cuenta = null;
    }
    d.novedades = (d.novedades || []).filter((n) => (verCuenta || !n.cuenta) && (nivel === 'pro' || !n.pro));
    if (d.reporte) d.reporte.novedades = d.novedades;
    const bloq = { bloqueada: true, mejora: 'comercial' };
    return {
      ok: true, ref: e.ref, rol, plan_nivel: nivel,
      secciones: {
        reporte: sec(d.reporte),
        mi_cuenta: verCuenta ? sec(d.mi_cuenta) : { sin_permiso: true },
        facturas: verFact ? { disponible: false } : { sin_permiso: true },
        trabajos: { disponible: false },   // como el servidor: empresa_resumen no trae trabajos; vienen de mc.trabajos (demo.trabajos)
        pre_iva: nivel === 'pro' ? sec(d.pre_iva) : bloq,
        pre_renta: nivel === 'pro' ? sec(d.pre_renta) : bloq,
      },
    };
  },
  /** Igual que mc.trabajos (MC-5): mismas omisiones D2 (sin Mi cuenta → pago {sin_permiso:true}; sin facturas → factura {sin_permiso:true}). */
  trabajos(ref, opciones = {}) {
    const e = EMPRESAS.find((x) => x.ref === ref);
    if (!e) return null;
    const verCuenta = rolDe(e, opciones) === 'titular'; const verFact = verCuenta;
    const d = clon(DATOS[ref].trabajos || { activos: [], terminados: 0 });
    for (const t of d.activos) {
      if (!verCuenta) t.pago = { sin_permiso: true };
      else if (!verFact) t.pago.factura = { sin_permiso: true };
    }
    return { ok: true, ref, seccion: { disponible: true, datos: d } };
  },
  /** Igual que mc.mi_reporte (REPORTE-AUTO C): la FOTO del reporte cerrado; Nuestros servicios solo con ver_facturas; sin comentario interno.
   *  Aromos muestra lo que el cliente ve del SII (decisión 19-11): F29 declarados, sin declarar y observaciones del SII. */
  reporte(ref, opciones = {}) {
    const e = EMPRESAS.find((x) => x.ref === ref);
    if (!e) return null;
    const r = clon(DATOS[ref].reporte || null);
    if (!r) return { ok: true, ref, seccion: { disponible: false } };
    const verFact = rolDe(e, opciones) === 'titular';
    const datos = { periodo: r.periodo, version: 1, enviado_at: r.enviado_at, validado: true, estado: 'confirmado', pagado: false, impuestos_estado: 'ok',
      obligaciones: r.obligaciones, calculo: r.calculo, total_f29: r.total_f29, rrhh: { estado: ref === REF.aromos ? 'no_aplica' : 'listo' },
      servicios: verFact && r.servicios ? { folio: r.servicios.folio, monto: r.servicios.monto, estado: r.servicios.estado === 'pagada' ? 'pagada' : 'emitida' } : null,
      avisos: ref === REF.aromos ? [{ codigo: 'F29_DECLARADO', periodos: ['2026-05', '2026-06', '2026-09'] }, { codigo: 'F29_SIN_DECLARAR', periodos: ['2026-07', '2026-08'] },
                                    { codigo: 'SII_OBSERVACIONES', cartas: 1, cumple: false, f22: 0 }] : [],
      historial: r.historial || [{ periodo: r.periodo, enviado_at: r.enviado_at, f29: r.total_f29 }],
      foto: { al_cierre: true, cerrado_at: r.enviado_at, version: 1 },
      situacion_actual: { consultado_en: new Date().toISOString(), periodo: r.periodo, f29_estado: ref === REF.aromos ? 'declarado' : 'por_declarar', f29_vence: null } };
    return { ok: true, ref, seccion: { disponible: true, datos } };
  },
  /** Igual que mc.mis_impuestos (MC-IMP-1 + 1b). Río: Pre-IVA estimado; Aromos (Cumplimiento): reporte validado; Alerce: aún no conectada. */
  impuestos(ref, opciones = {}) {
    const e = EMPRESAS.find((x) => x.ref === ref);
    if (!e) return null;
    // Luciano 19-11: también el plan Cumplimiento ve su IVA. Aromos (Cumplimiento) muestra el caso con el reporte cerrado.
    if (ref === REF.aromos) {
      const r = clon(IMPUESTOS_RIO); r.ref = ref;
      r.oficial = { fuente: 'reporte', total: 1050000, debito: 1748000, credito: 969000, remanente: 118868, ppm: 238750, confirmado_en: '2026-11-14T15:30:00Z' };
      return r;
    }
    if (ref !== REF.rio) return { ok: true, ref, periodo: '202610', conexion: { estado: 'no_conectado' }, oficial: null, preiva_enviado: null, vence: '2026-11-20' };
    return clon(IMPUESTOS_RIO);
  },
};
