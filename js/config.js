// MiContadoor · configuración PÚBLICA. Aquí va SOLO la clave pública (anon / publishable) de Supabase.
// NUNCA la service_role ni una clave sb_secret_: herramientas/verificar.mjs lo revisa antes de publicar.
// Si cambias SUPABASE_URL, actualiza también connect-src de la CSP en index.html, activar/index.html y 404.html.
export const CONFIG = Object.freeze({
  SUPABASE_URL: 'https://ulxoxqbuxiuylaolaqxj.supabase.co',   // proyecto Gestoor (las RPC del cliente viven en el esquema mc)
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVseG94cWJ1eGl1eWxhb2xhcXhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNDMwNDcsImV4cCI6MjA5OTcxOTA0N30.bN_KeSJFEBKSBzwTixRQs92y6aEhBo-SJs4fGxZgAbA',   // clave PÚBLICA anon (la misma del front de Gestoor; rol anon, sin acceso a mc)
  ESQUEMA: 'mc',               // las RPC del cliente viven en el esquema mc (Content-Profile: mc)
  TERMINOS_VERSION: '2026-11-09',  // texto BORRADOR: reemplazar por el aprobado (Ley 21.719) antes del piloto

  // Contrato de datos: qué RPC del cliente existen. MC-1 tiene las tres primeras; MC-5 agrega TRABAJOS.
  // TRABAJOS = null mientras MC-5 no esté instalado en Supabase (la sección Trabajos muestra "aún no publicado").
  // "Ya transferí" / "Ya lo pagué" quedan deshabilitados («Próximamente») mientras RPC_SOLICITUD_PAGO sea null.
  RPC: Object.freeze({
    SESION: 'mi_sesion',
    RESUMEN: 'empresa_resumen',
    TERMINOS: 'aceptar_terminos',
    TRABAJOS: null,            // MC-5 aún NO instalado en Supabase → «aún no publicado». Al instalar MC-5: 'trabajos'
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
