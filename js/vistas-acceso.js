// Pantallas de acceso (siempre oscuras, diseño aprobado): ingreso, recuperar, activar/definir contraseña, términos.
import { html } from './util.js';
import { I, iconoB } from './iconos.js';

const barras = html`<div class="barras" aria-hidden="true"><i></i><i></i><i></i></div>`;
const pie = html`<div class="pie">
  <div class="seguro">${I.seguro} Conexión segura · solo tú y tu equipo Contadoor ven tus datos</div>
  <img src="/img/contadoor_lockup_white.png" alt="Contadoor" width="150" height="62">
  <div class="razon">Asesorías Contadoor Ltda. · mi.contadoor.cl</div>
</div>`;
const msg = (m) => (m ? html`<p class="msg${m.ok ? ' ok' : ''}" role="${m.ok ? 'status' : 'alert'}">${m.texto}</p>` : '');

export function vIngreso({ mensaje, demo }) {
  return html`<section class="oscura" aria-label="Ingreso">${barras}
    <div class="rel">${iconoB(84, 'app', 'gB0')}</div>
    <div class="rel mt12"><h1 class="wm xl m0"><span class="mi">Mi</span><span class="co">Contadoor</span></h1>
      <p class="lema">Tu empresa al día, en un solo lugar: reportes, pagos y proyecciones.</p></div>
    <form data-form="ingreso" novalidate>
      <label>Correo electrónico<input name="correo" type="email" inputmode="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="tu@empresa.cl" required></label>
      <label>Contraseña<input name="clave" type="password" autocomplete="current-password" placeholder="••••••••" required enterkeyhint="go"></label>
      ${msg(mensaje)}
      <button type="submit" class="btn">Entrar</button>
      <a class="link" href="#/recuperar">¿Olvidaste tu contraseña?</a>
      <p class="xs c m0">Tu acceso lo crea Contadoor al activar tu servicio.${demo ? ' En la demo, cualquier correo y contraseña sirven.' : ''}</p>
    </form>${pie}</section>`;
}

export function vRecuperar({ mensaje }) {
  return html`<section class="oscura" aria-label="Recuperar contraseña">${barras}
    <div class="rel">${iconoB(64, 'app', 'gB0')}</div>
    <h1>Recupera tu acceso</h1>
    <p class="intro">Escribe el correo con que entras a MiContadoor. Si corresponde a una cuenta, te enviaremos un enlace para crear una contraseña nueva.</p>
    <form data-form="recuperar" novalidate>
      <label>Correo electrónico<input name="correo" type="email" inputmode="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="tu@empresa.cl" required enterkeyhint="send"></label>
      ${msg(mensaje)}
      <button type="submit" class="btn">Enviar enlace</button>
      <a class="btn lin" href="#/ingreso">Volver a ingresar</a>
    </form>${pie}</section>`;
}

export function vActivar({ tipo, mensaje, listo, pendiente }) {
  const recuperacion = tipo === 'recovery';
  return html`<section class="oscura" aria-label="Crear contraseña">${barras}
    <div class="rel">${iconoB(64, 'app', 'gB0')}</div>
    <h1>${recuperacion ? 'Crea tu nueva contraseña' : 'Activa tu acceso: crea tu contraseña'}</h1>
    <p class="intro">Usa al menos 10 caracteres, con letras y números. No la compartas con nadie, ni siquiera con Contadoor.</p>
    ${pendiente ? html`<form data-form="continuar" novalidate>
      <p class="xs m0">Por tu seguridad, el enlace se usa recién cuando tocas «Continuar».</p>
      ${msg(mensaje)}
      <button type="submit" class="btn">Continuar</button>
    </form>` : listo ? html`<form>${msg(mensaje)}<a class="btn" href="#/inicio">Entrar a MiContadoor</a></form>` : html`
    <form data-form="activar" novalidate>
      <label>Contraseña nueva<input name="a" type="password" autocomplete="new-password" minlength="10" maxlength="72" required></label>
      <label>Repite la contraseña<input name="b" type="password" autocomplete="new-password" minlength="10" maxlength="72" required enterkeyhint="done"></label>
      ${msg(mensaje)}
      <button type="submit" class="btn">Guardar contraseña</button>
    </form>`}${pie}</section>`;
}

export function vTerminos({ version, mensaje }) {
  return html`<section class="oscura" aria-label="Términos de uso">${barras}
    <h1>Antes de empezar</h1>
    <p class="intro">Lee y acepta los términos de uso y el aviso de privacidad de MiContadoor.</p>
    <div class="terminos" tabindex="0">
      <p><b>Términos de uso y aviso de privacidad de MiContadoor</b> · versión ${version}</p>
      <h2>1. Qué es MiContadoor</h2>
      <p>MiContadoor es el portal de clientes de Asesorías Contadoor Ltda. (en adelante, «Contadoor»). Aquí ves la información que tu equipo Contadoor publica sobre tu empresa: reportes mensuales, estado de cuenta, proyecciones y trabajos especiales. El portal es solo de consulta: no reemplaza a tu equipo, al SII ni a la Tesorería.</p>
      <h2>2. Tu acceso es personal</h2>
      <p>Tu cuenta es solo para ti. No compartas tu contraseña. Si otra persona de tu empresa necesita acceso, pídelo a tu equipo Contadoor y le crearemos su propia cuenta. Si crees que alguien entró con tus datos, cambia tu contraseña y avísanos de inmediato.</p>
      <h2>3. Las cifras</h2>
      <p>Los montos de tu reporte son los que tu equipo revisó y confirmó. Las proyecciones (Pre-IVA y Pre-Renta) son estimaciones con la información disponible a la fecha y pueden cambiar; no son cifras definitivas. Ante cualquier diferencia, manda lo que te confirme tu equipo por escrito.</p>
      <h2>4. Pagos</h2>
      <p>Los botones «Ya transferí» y «Ya lo pagué» solo nos avisan: el pago se da por recibido cuando nuestro equipo lo confirma. Contadoor nunca te pedirá que transfieras a una cuenta distinta de la que aparece en este portal.</p>
      <h2>5. Qué información tratamos y para qué</h2>
      <p>Datos de tu empresa y de sus socios, documentos tributarios y contables, información de pagos y tus datos de contacto, solo lo necesario para prestar el servicio contratado (contabilidad, impuestos, reportes y asesoría). Nunca la vendemos ni la usamos para publicidad de terceros.</p>
      <h2>6. Quién accede y dónde se guarda</h2>
      <p>Solo el equipo asignado a tu empresa y la dirección de Contadoor, con usuario personal y registro de cada acceso, bajo deber de reserva. La información se guarda en nuestro sistema de gestión con acceso controlado. Se comparte solo con el SII, la Tesorería u otros organismos cuando el servicio lo requiere, y con proveedores tecnológicos que nos dan soporte bajo confidencialidad, salvo obligación legal.</p>
      <h2>7. Cuánto tiempo</h2>
      <p>Mientras dure el servicio y los plazos que exige la ley para la documentación tributaria. Al terminar el servicio, tu acceso a MiContadoor se cierra y te entregamos tu información.</p>
      <h2>8. Tus derechos</h2>
      <p>Conforme a la Ley N° 19.628 sobre protección de la vida privada y su actualización por la Ley N° 21.719, puedes pedir en cualquier momento acceder, corregir, eliminar u oponerte al uso de tus datos, o recibir una copia de ellos, escribiendo a info@contadoor.cl.</p>
      <h2>9. Si algo ocurre</h2>
      <p>Si detectamos un incidente que pueda afectar tu información, te avisamos sin demora, te contamos qué pasó y qué medidas tomamos.</p>
      <h2>10. Cambios</h2>
      <p>Si cambiamos estos términos, te pediremos aceptarlos de nuevo al entrar. Responsable: Asesorías Contadoor Ltda., RUT 77.166.269-2 · info@contadoor.cl.</p>
    </div>
    <form data-form="terminos" novalidate>
      <label class="chk"><input type="checkbox" name="ok" required> Leí y acepto los términos de uso y el aviso de privacidad.</label>
      ${msg(mensaje)}
      <button type="submit" class="btn">Aceptar y continuar</button>
      <button type="button" class="btn lin" data-accion="salir">Salir</button>
    </form></section>`;
}

export function vFuera() {
  return html`<section class="oscura"><h1>MiContadoor</h1><p class="intro">Por seguridad, MiContadoor solo se abre en su propia ventana: mi.contadoor.cl</p></section>`;
}
