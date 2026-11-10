# MiContadoor V1 · portal del cliente (PWA)

Portal para el celular de los clientes de Contadoor, para publicar en **mi.contadoor.cl**.
Estado: **BORRADOR LOCAL**. No tiene repo remoto, no está publicado y no está conectado a producción.

- Diseño: reproduce la maqueta aprobada `descargas/paquete_estructura/micontadoor_maqueta/index_v2.html`, con el GO de diseño de ChatGPT, más los expedientes D y E. Donde difieren, manda E.
- Datos: contrato **MC-1** del worktree `repos/gestoor-backend-mc1`, que todavía no está instalado. Se respetan exactamente sus RPC.
- Sitio estático: HTML, CSS y JS sin dependencias. Se puede alojar en GitHub Pages.

## 1. Cómo probarlo (modo DEMO, datos ficticios)

```bash
cd "repos/micontadoor-pwa"
npm run servir          # = python3 -m http.server 8765 --bind 127.0.0.1
```

Abre en Chrome: **http://127.0.0.1:8765/?demo=1**. Una franja morada avisa que los datos son ficticios. En la demo, cualquier correo y contraseña sirven.

| Parámetro | Qué hace |
|---|---|
| `?demo=1` | Activa la demo. Sin este parámetro, la app intenta conectarse a Supabase. |
| `&empresa=1` / `2` / `3` | 1 = Comercial Río SpA (Contadoor PRO, titular, al día, con saldo a favor). 2 = Panadería Los Aromos SpA (Cumplimiento, con pendientes de meses anteriores). 3 = Inversiones Alerce SpA (PRO, **usuario adicional**). |
| `&plan=cumpl` | Fuerza el plan Cumplimiento. |
| `&rol=consulta` | Fuerza el usuario adicional (sin Mi cuenta ni facturas). |
| `&tema=claro` / `oscuro` / `auto` | Apariencia para esa visita. El cliente la elige en Más → Apariencia y queda guardada en su aparato. |
| `&solicitudes=1` | Muestra cómo funcionarían «Ya transferí» y «Ya lo pagué» cuando exista la RPC. Por defecto aparecen en «Próximamente». |
| `&terminos=1` | Muestra la pantalla de términos del primer ingreso. |
| `#/ruta` | `ingreso`, `recuperar`, `activar`, `inicio`, `reporte`, `historial`, `cuenta`, `cuenta/pagado`, `pago/cp-f29-10`, `preiva`, `prerenta`, `trabajos`, `mas`, `acceso`. |

Pruebas y revisiones:

```bash
npm test                 # 25 pruebas: escape de HTML, permisos por vínculo, acumulado impago, capa api y pantallas
npm run verificar        # secretos, coherencia entre la CSP y la configuración, sin estilos ni scripts en línea, sin datos reales
npm run capturas -- <carpeta>   # 57 capturas con Chrome headless (390×844 y 1280; claro, oscuro y automático); requiere el servidor encendido
```

Las capturas quedaron en `descargas/micontadoor_pwa/capturas/`.

## 2. Qué hay

| Pantalla | Contenido |
|---|---|
| Ingreso / Recuperar / Crear contraseña / Términos | Siempre oscuras, como en la maqueta. Correo + **contraseña**. Los enlaces de invitación (S2) y de restablecer (S4) llegan a `/activar?token_hash=…&type=invite\|recovery`. Los mensajes son genéricos, así no se puede saber si un correo existe. |
| Inicio | Saludo, empresa (selector si tiene varias), "Tu mes de …", novedades, Pre-IVA / Pre-Renta (o un teaser bloqueado), Mi cuenta y WhatsApp. |
| Reporte + Historial | Lo que se paga en el mes, **Pendientes de meses anteriores** (arrastre con período de origen, monto confirmado y vigencia, y respuesta del cliente), "¿Cómo llegamos a tu impuesto?", comentario del analista, nuestros servicios (solo si el vínculo ve facturas) y el PPM acumulado. El historial muestra un gráfico de 6 meses. |
| Mi cuenta (Por pagar / Pagado) | Resumen con el **saldo a favor siempre visible** y el texto aprobado. Datos para transferir, «Ya transferí» y «Ya lo pagué» con comprobante (**Próximamente**). El reparto de cada transferencia, las transferencias en revisión y los comprobantes. |
| Pre-IVA / Pre-Renta | Solo lectura, con su estado (Preliminar / Validado / Pendiente / Desactualizado) y la leyenda. En Cumplimiento se ve la vista borrosa **con marcadores (nunca cifras)** y el botón «Mejorar mi plan», que abre el WhatsApp comercial. |
| Trabajos especiales | Etapa, % de avance, pasos, próximo paso, pago por cuotas y documentos. |
| Más | Trabajos, Mi acceso, **Mi plan** (lo incluido ✓ y lo bloqueado 🔒 con «Mejorar»), **Apariencia** (Claro / Oscuro / Automático) y el logo: glossy en tema claro y blanco en tema oscuro. |
| Mi acceso | Empresas y rol de cada una, cambiar la contraseña (por enlace al correo), cerrar sesión y **cerrar sesión en todos los aparatos**. |

Reglas que se aplican en el código:

- **Permisos por vínculo (D2):** la app solo muestra lo que el servidor permite explícitamente. Si falta una sección o no se entiende, no se muestra. Un usuario adicional (`consulta`) no ve Mi cuenta ni facturas, salvo que su vínculo lo permita (`js/datos.js → permisos`). Sin Mi cuenta, desaparece también la pestaña.
- **Acumulado impago** (`calcularAcumulado`): suma todo lo impago de todos los meses anteriores, sin duplicar. Usa el monto confirmado con intereses. Si un monto requiere confirmación y no la tiene, queda "Por confirmar", no se suma y el total se marca "Falta confirmar". «Ya lo pagué» no cierra nada.
- **Sin dato = "No disponible"**, nunca $0. Todas las fechas van en hora de Chile.
- **Escape:** todo el HTML sale de la plantilla `html```, que escapa cada valor. Las pruebas inyectan HTML malicioso en todos los campos.
- **Pantalla de bloqueo:** los avisos push no están en la V1. Cuando la app pasa a segundo plano, todo se difumina, así la vista previa del selector de apps no muestra montos (hay que comprobarlo en un celular real). El texto del aviso que queda preparado es genérico.
- **PWA:** manifest, íconos (incluido el maskable y el de Apple), y un service worker que **guarda solo los archivos de la app**. Todo lo que va a Supabase o a otro origen pasa directo a la red, sin caché. Además, red primero: la caché solo se usa sin conexión. Se aplicaron las reglas de mobile-native: `100dvh`, áreas seguras (`viewport-fit=cover` + `env()`), inputs de 16 px (sin zoom y sin bloquear el zoom), `touch-action: manipulation`, sin destello al tocar, `:hover` solo con mouse, `overscroll-behavior` y `theme-color` según la pantalla.
- **CSP** en `<meta>`: `default-src 'none'`, scripts solo propios, sin `unsafe-inline`, `connect-src` solo hacia el proyecto Supabase, `form-action 'none'` y `base-uri 'none'`. GitHub Pages no permite el encabezado `frame-ancestors`, así que la app se niega a mostrarse dentro de un marco (anti-clickjacking por JS).
- **Avisos push:** fuera de la V1. El lugar queda preparado en `js/push.js` y en `sw.js` (comentado), y `CONFIG.AVISOS_PUSH = false`. No se promete nada al cliente.

## 3. Arquitectura

```
index.html            CSP, metas PWA, carga css/app.css y js/app.js (módulo)
activar/index.html    enlace de los correos → /?token_hash=…&type=…  (js/redir.js)
404.html              cualquier ruta desconocida → la app
sw.js                 caché SOLO de la app; nunca datos
js/config.js          SOLO configuración pública (URL + clave anon/publishable, RPC, WhatsApp, datos para transferir)
js/api.js             ÚNICA capa de datos (Auth GoTrue + PostgREST con Content-Profile: mc) y backend demo
js/datos.js           reglas puras: permisos, acumulado, saldo a favor, mensajes, contraseña
js/demo.js            datos FICTICIOS (simula al servidor, también sus omisiones)
js/vistas-*.js        pantallas (devuelven HTML escapado)
js/app.js             rutas (#/…), estado, eventos y tema
tests/                node --test
herramientas/         verificar.mjs, capturas.mjs
```

Si el contrato `mc` cambia, se ajusta **solo `js/api.js`**, y `js/datos.js` si cambia la forma de los datos.

## 4. Qué falta para conectarlo (etapas MC-1 en adelante)

Contrato que usa la app hoy (MC-1 R2, worktree `gestoor-backend-mc1`, **no instalado**):

| RPC (esquema `mc`, rol `mc_cliente`) | Uso en la app |
|---|---|
| `mc.mi_sesion()` | Cuenta, términos pendientes y empresas (`ref`, `razon_social`, `rut`, `rol`, `plan_nivel`). Activa la cuenta invitada en el primer ingreso. |
| `mc.empresa_resumen(p_ref)` | Secciones: `{disponible:false}`, `{sin_permiso:true}` o `{bloqueada:true, mejora:'comercial'}`. Hoy no trae datos, así que cada pantalla muestra su estado vacío ("aún no publicado"). |
| `mc.aceptar_terminos(p_version)` | Pantalla de términos. |
| `mc.trabajos(p_ref, p_codigo?)` (MC-5) | Trabajos especiales: etapa, avance, pasos con texto para el cliente, próximo paso, pago por cuotas (según permisos) y documentos. |

Pasos, en orden y cada uno con su GO:

1. **MC-1 (R3 en curso en otra sesión):** H1 hook fail-closed, H2 reenvío, H3 huella. Instalar los pasos 1 a 6 con el GO de ChatGPT y la orden de Luciano. Activar el hook en Authentication → Hooks.
2. **Exponer el esquema `mc` en la Data API** (Settings → API → Exposed schemas: agregar `mc`). Sin eso, PostgREST rechaza `Content-Profile: mc`. La Edge `mc-invitar` también lo necesita.
3. **Auth:**
   - Agregar `https://mi.contadoor.cl/activar` a Redirect URLs.
   - Site URL o plantillas: en la rama `.Data.micontadoor`, el enlace de las plantillas S0/S2/S4 hoy apunta a `gestoor.contadoor.cl/reset-password.html?token_hash=…`. Para el portal debe ser `https://mi.contadoor.cl/activar?token_hash={{ .TokenHash }}&type=invite` (y `type=recovery` en S4).
   - Activar la protección contra contraseñas filtradas (plan Pro) y un mínimo de 10 caracteres.
4. **`js/config.js`:** poner `SUPABASE_URL` y la clave **pública**. Reemplazar `https://TU-PROYECTO.supabase.co` en la CSP de `index.html`. Correr `npm run verificar`.
5. **MC-2 Reporte + historial:** foto `mc.reportes_publicados` y `v_obligaciones_abiertas_cliente` con el monto confirmado y su vigencia, lo que destraba el arrastre. Debe devolver `secciones.reporte = {disponible:true, datos:{periodo, obligaciones[], calculo[], total_f29, comentario, servicios?, ppm_acumulado, historial[], pdf_url?}}`, como en `js/demo.js`.
6. **MC-3 Mi cuenta:**
   - `mc.v_estado_cuenta`, pagos recibidos con su reparto y el saldo a favor, y comprobantes.
   - **RPC de solicitud** para «Ya transferí» / «Ya lo pagué». Crea la tarea y nunca marca el pago. Cuando exista, poner su nombre en `CONFIG.RPC.SOLICITUD_PAGO`.
   - Bucket privado para el comprobante, con subida firmada. Hoy la app solo valida el archivo (PDF/JPG/PNG de hasta 5 MB) y todavía no lo sube.
   - Agregar el host de Storage en `HOSTS_DOCUMENTOS` y en `connect-src`.
7. **MC-4 Pre-IVA / Pre-Renta:** fotos que publica el analista, con su estado.
8. **MC-5 Trabajos especiales (rama `feat/mc5-trabajos`, backend `sql/micontadoor-mc5`, NO instalado):** RPC `mc.trabajos(p_ref, p_codigo?)` sobre vistas internas en lista blanca (`mc.v_trabajos`, `mc.v_trabajo_pasos` solo con `texto_cliente`, cuotas, factura de producción y documentos marcados para el cliente). La app la llama después de `empresa_resumen` (`CONFIG.RPC.TRABAJOS`) y reemplaza la sección `trabajos` con `normalizarTrabajos()` (`js/datos.js`). Sin "Mi cuenta" en el vínculo no llega ningún monto; sin facturas, no llega el folio. Si la RPC falla, la pantalla muestra un aviso, nunca datos. Si MC-5 aún no está instalado al publicar, dejar `RPC.TRABAJOS = null`. La descarga de PDF de los documentos queda para la Edge `mc-documento-url` (otra etapa): hoy dice «PDF próximamente».
9. **MC-6 Avisos** (fuera de la V1): VAPID `MC_VAPID_*`, `mc.push_suscripciones` y `mc-push-send`. Activar `js/push.js` y el bloque comentado de `sw.js`.
10. **Brechas del contrato que conviene cerrar:**
    - `plan_nombre` en `empresa_resumen`. Hoy "basico" se muestra como "Cumplimiento" y "pro" como "Contadoor PRO", aunque sea Estratégico.
    - Las novedades del inicio, que hoy vienen dentro de `reporte.novedades` en la demo.
    - El texto legal definitivo de los términos (Ley 21.719) y su versión en `CONFIG.TERMINOS_VERSION`.

## 5. Checklist de publicación (decisiones de Luciano: nada de esto está hecho)

- [ ] **Revisión de secretos:** `npm run verificar` sin PROBLEMAS. Revisar a mano que en `js/config.js` solo esté la clave anon/publishable (nunca `service_role` ni `sb_secret_`). Revisar `git log -p` completo, porque el repo será **público**: sin datos de clientes, sin correos reales y sin la dirección personal.
- [ ] Verificar con Pagos los datos para transferir (`CONFIG.TRANSFERENCIA`) y el número de WhatsApp comercial (`CONFIG.WHATSAPP_*`, hoy el del asistente, +56 9 4675 4390).
- [ ] Reemplazar el texto BORRADOR de términos y privacidad por el aprobado.
- [ ] Recomendado: alojar Montserrat e Inter en el propio sitio (hoy se cargan de Google Fonts, permitido en la CSP) y quitar `fonts.googleapis.com` / `fonts.gstatic.com` de la CSP.
- [ ] Crear el repo en GitHub (público, decisión de Luciano), hacer push de `main` y activar Pages: Settings → Pages → Deploy from branch `main` / root. Activar **Enforce HTTPS**.
- [ ] El archivo `CNAME` ya contiene `mi.contadoor.cl`. Confirmar que en Settings → Pages → Custom domain aparezca ese dominio.
- [ ] **DNS en Hostinger** (zona de contadoor.cl): agregar **solo** un registro `CNAME` con nombre `mi` que apunte a `<usuario-u-org>.github.io.`. **No tocar** los registros de gestoor, agenda, M365 ni el sitio. Esperar la propagación y verificar el certificado.
- [ ] Recomendado: verificar el dominio en GitHub (Settings → Pages → Verified domains, registro TXT `_github-pages-challenge-…`) para evitar que alguien lo tome.
- [ ] Prueba de punta a punta con la cuenta de prueba de Asesorías Contadoor: invitación → crear contraseña → ingreso → términos → ver secciones → cerrar sesión en todos los aparatos → revocar el acceso y comprobar el corte.
- [ ] **En un celular real** (iPhone y Android): instalar en la pantalla de inicio, áreas seguras y notch, teclado, que no haya zoom en los inputs, el difuminado al pasar a segundo plano y el modo oscuro automático.
- [ ] Al publicar una versión nueva: subir `VERSION` en `sw.js`.
