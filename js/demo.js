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

const PREIVA = {
  periodo: '2026-11', estado: 'preliminar', publicado_at: '2026-11-12T21:30:00Z', info_hasta: '2026-11-11', vence: '2026-12-21',
  estimado: 702000,
  calculo: [
    { t: 'IVA de tus ventas', xs: '19 % de $6.100.000 · 31 documentos', monto: 1159000 },
    { t: 'menos IVA de tus compras', xs: '19 % de $2.405.000 · 14 documentos', monto: -457000 },
    { t: 'menos remanente de octubre', monto: 0, resta: true },
  ],
  consejo: '2 facturas de compra aún no llegan. Si llegan antes del cierre, tu IVA baja ≈ $58.900.',
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
const rolDe = (e, opciones) => (opciones.rol === 'consulta' ? 'consulta' : e.rol);

export const demo = {
  refs: REF,
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
};
