// MiContadoor · configuración PÚBLICA. Aquí va SOLO la clave pública (anon / publishable) de Supabase.
// NUNCA la service_role ni una clave sb_secret_: herramientas/verificar.mjs lo revisa antes de publicar.
// Si cambias SUPABASE_URL, actualiza también connect-src de la CSP en index.html, activar/index.html y 404.html.
export const CONFIG = Object.freeze({
  SUPABASE_URL: '',            // ej. 'https://xxxxxxxxxxxx.supabase.co' (vacío = sin backend: solo modo demo)
  SUPABASE_ANON_KEY: '',       // clave PÚBLICA (anon o sb_publishable_…)
  ESQUEMA: 'mc',               // las RPC del cliente viven en el esquema mc (Content-Profile: mc)
  TERMINOS_VERSION: '2026-11-09',  // texto BORRADOR: reemplazar por el aprobado (Ley 21.719) antes del piloto

  // Contrato de datos: qué RPC del cliente existen. MC-1 solo tiene estas tres.
  // "Ya transferí" / "Ya lo pagué" quedan deshabilitados («Próximamente») mientras RPC_SOLICITUD_PAGO sea null.
  RPC: Object.freeze({
    SESION: 'mi_sesion',
    RESUMEN: 'empresa_resumen',
    TERMINOS: 'aceptar_terminos',
    SOLICITUD_PAGO: null,      // MC-3: p. ej. 'solicitud_pago_crear' cuando exista con su GO
  }),

  // Hosts desde los que se aceptan enlaces de documentos (PDF firmados de Storage). Vacío = no se enlaza nada.
  HOSTS_DOCUMENTOS: [],

  // Equipo comercial / asistente por WhatsApp (plan B de ventas = asistente IA, memoria 02-11).
  WHATSAPP_COMERCIAL: '56946754390',
  WHATSAPP_EQUIPO: '56946754390',

  // Datos para transferir a Contadoor (de la maqueta aprobada; VERIFICAR con Pagos antes de publicar).
  TRANSFERENCIA: Object.freeze({
    razon_social: 'Asesorías Contadoor Ltda.',
    rut: '77.166.269-2',
    banco: 'Banco Itaú',
    cuenta: 'Cuenta corriente ···9517',
    correo: 'info@contadoor.cl',
  }),

  // Avisos push: fuera de la V1. Queda el lugar preparado (js/push.js y sw.js) pero apagado.
  AVISOS_PUSH: false,
});
