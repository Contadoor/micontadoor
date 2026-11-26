// MiContadoor · configuración PÚBLICA. Aquí va SOLO la clave pública (anon / publishable) de Supabase.
// NUNCA la service_role ni una clave sb_secret_: herramientas/verificar.mjs lo revisa antes de publicar.
// Si cambias SUPABASE_URL, actualiza también connect-src de la CSP en index.html, activar/index.html y 404.html.
export const CONFIG = Object.freeze({
  SUPABASE_URL: 'https://ulxoxqbuxiuylaolaqxj.supabase.co',   // proyecto Gestoor (las RPC del cliente viven en el esquema mc)
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVseG94cWJ1eGl1eWxhb2xhcXhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNDMwNDcsImV4cCI6MjA5OTcxOTA0N30.bN_KeSJFEBKSBzwTixRQs92y6aEhBo-SJs4fGxZgAbA',   // clave PÚBLICA anon (la misma del front de Gestoor; rol anon, sin acceso a mc)
  ESQUEMA: 'mc',               // las RPC del cliente viven en el esquema mc (Content-Profile: mc)
  TERMINOS_VERSION: '2026-11-16',  // texto V1 APROBADO por Luciano 16-11; publicar requiere GO-FRONT

  // Contrato de datos: qué RPC del cliente existen. MC-1 tiene las tres primeras; MC-5 agrega TRABAJOS.
  // TRABAJOS = null mientras MC-5 no esté instalado en Supabase (la sección Trabajos muestra "aún no publicado").
  // "Ya transferí" / "Ya lo pagué" quedan deshabilitados («Próximamente») mientras RPC_SOLICITUD_PAGO sea null.
  RPC: Object.freeze({
    SESION: 'mi_sesion',
    RESUMEN: 'empresa_resumen',
    TERMINOS: 'aceptar_terminos',
    TRABAJOS: null,            // MC-5 aún NO instalado en Supabase → «aún no publicado». Al instalar MC-5: 'trabajos'
    SOLICITUD_PAGO: null,      // MC-3: p. ej. 'solicitud_pago_crear' cuando exista con su GO
    // MC-IMP-1 «Tu IVA del mes» (mc.mis_impuestos). Publicar el portal DESPUÉS de instalar la migración 202611191200.
    // Si hubiera que publicar antes, dejarlo en null: la pantalla vuelve al Pre-IVA de siempre («aún no publicado»).
    IMPUESTOS: 'mis_impuestos',

    // ── MICONTADOOR-APERTURA (24-11) · contrato en descargas/micontadoor_apertura/CONTRATO_DATOS.md ──
    // ORDEN: publicar el portal SOLO DESPUÉS de instalar en Supabase las migraciones del paquete (términos versionados,
    // soporte y 202611231910 «Tu incorporación»). Si hubiera que publicar antes, poner estas en null: el portal vuelve
    // a lo de hoy (términos locales con aceptar_terminos, Ayuda solo con WhatsApp y correo, sin «Tu incorporación»).
    TERMINOS_VIGENTES: 'terminos_vigentes',     // texto vigente + SHA-256 (se verifica en el aparato antes de aceptar)
    TERMINOS_V2: 'aceptar_terminos_v2',         // acepta versión + huella; el servidor guarda la aceptación inmutable
    MIS_TERMINOS: 'mis_terminos',               // «Términos que aceptaste» en Mi acceso
    TERMINOS_TEXTO: 'terminos_texto',           // texto exacto de una versión aceptada
    SOPORTE_CREAR: 'soporte_crear',             // «Cuéntanos qué pasa» → folio MC-AAAA-NNNNN
    MIS_SOLICITUDES: 'mis_solicitudes',         // «Tus solicitudes»
    INCORPORACION: 'mi_incorporacion',          // «Tu incorporación» (ONBOARDING-V2)
    DIAGNOSTICO: null,                          // «Tu diagnóstico "Aquí partimos"»: aún sin informe ni RPC (espacio listo)
    HISTORIAL_IMPUESTOS: null,                  // historial anual (otro paquete, feat/reporte-historial-sii): menú oculto mientras sea null

    // MC-6 (avisos) · backend MC6A instalado en producción (migración 202611121400_mc6a_avisos). null = sin Novedades ni «Activar avisos».
    AVISOS: 'avisos',                   // mc.avisos(p_ref, p_limite)
    AVISOS_LEIDOS: 'avisos_leidos',     // mc.avisos_leidos(p_ref, p_ids)
    PUSH_SUSCRIBIR: 'push_suscribir',
    PUSH_DESUSCRIBIR: 'push_desuscribir',
    PUSH_PROBAR: 'push_probar',
    AVISOS_CORREO: 'avisos_correo',     // R2: hoy el servidor responde disponible=false → la UI muestra «Pronto»

    // REPORTE-AUTO C: el reporte mensual CERRADO (mc.mi_reporte). Publicar el portal DESPUÉS de instalar la migración 202611211800.
    // Si hubiera que publicar antes, dejarlo en null: la pantalla Reporte sigue con «Tu reporte aún no está publicado».
    REPORTE: 'mi_reporte',
  }),

  // Hosts desde los que se aceptan enlaces de documentos (PDF firmados de Storage). Vacío = no se enlaza nada.
  HOSTS_DOCUMENTOS: [],

  // Equipo comercial / asistente por WhatsApp (plan B de ventas = asistente IA, memoria 02-11).
  WHATSAPP_COMERCIAL: '56946754390',
  WHATSAPP_EQUIPO: '56946754390',

  // Datos para transferir a Contadoor: CONFIRMADOS por Luciano 16-11.
  TRANSFERENCIA: Object.freeze({
    razon_social: 'Asesorías Contadoor Ltda.',
    rut: '77.166.269-2',
    banco: 'Banco Itaú',
    cuenta: 'Cuenta corriente ···9517',
    correo: 'info@contadoor.cl',
  }),

  // Avisos push (MC-6). Se enciende SOLO con MC6A + MC6B instalados, la Edge mc-push-send desplegada y la clave PÚBLICA VAPID
  // de MiContadoor (MC_VAPID_PUBLIC_KEY, la privada nunca sale de los secretos de Supabase). Nunca la clave del equipo (Gestoor).
  AVISOS_PUSH: true,
  VAPID_PUBLICA: 'BIbnKeL3WOsy5hMd64YhEkci3GVNZO_Zm5k5Cj-wPuXo7bg1FE18xQRDFlXOjQ8eHgidBzjxHXffJpt3PrT4AOQ',   // clave PÚBLICA VAPID de MiContadoor (base64url, 87 caracteres). Vacía = no se ofrece «Activar avisos».
});
