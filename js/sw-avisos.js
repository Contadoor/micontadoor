// MiContadoor · lógica PURA del aviso push que usa sw.js (se carga con importScripts; las pruebas la cargan con node:vm).
// Defensa en profundidad: aunque el servidor ya manda textos fijos, aquí se vuelve a validar. Si algo no calza, se muestra el
// texto GENÉRICO. Regla dura: la notificación del sistema NUNCA lleva montos, RUT ni nombres; el detalle, solo dentro de la app.
(function (g) {
  var GENERICO = { titulo: 'MiContadoor', cuerpo: 'Tienes un aviso nuevo de Contadoor', url: '/#/inicio', tag: 'mc' };
  var RUTA = /^\/(\?e=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?#\/(inicio|novedades|reporte|cuenta|cuenta\/pagado|trabajos|mas)$/;
  // Lo prohibido en la pantalla bloqueada: signo $, cifras de 3 o más dígitos (montos, folios), algo con forma de RUT o de correo.
  var PROHIBIDO = /[$]|\d{3,}|\d{1,2}\.\d{3}|\d-[\dkK]\b|@/;
  function texto(v, max) { return typeof v === 'string' && v.trim().length > 0 && v.length <= max && !PROHIBIDO.test(v) ? v.trim() : null; }
  /** data (objeto o string JSON del push) → {titulo, cuerpo, url, tag} SIEMPRE seguro. */
  function avisoSeguro(data) {
    var d = data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
    if (!d || typeof d !== 'object' || d.v !== 1) return GENERICO;
    var t = texto(d.titulo, 60), c = texto(d.cuerpo, 80);
    if (!t || !c) return { titulo: GENERICO.titulo, cuerpo: GENERICO.cuerpo, url: urlSegura(d.url), tag: GENERICO.tag };
    return { titulo: t, cuerpo: c, url: urlSegura(d.url), tag: typeof d.tag === 'string' && /^mc-[a-z_]{3,30}-\d{1,18}$/.test(d.tag) ? d.tag : GENERICO.tag };
  }
  function urlSegura(u) { return typeof u === 'string' && RUTA.test(u) ? u : GENERICO.url; }
  g.MC_AVISO = { avisoSeguro: avisoSeguro, urlSegura: urlSegura, GENERICO: GENERICO };
})(typeof self !== 'undefined' ? self : globalThis);
