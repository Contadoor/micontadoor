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
      <p><b>BORRADOR · texto legal pendiente de aprobación (versión ${version}).</b></p>
      <p>MiContadoor es el portal de clientes de Asesorías Contadoor Ltda. Aquí ves la información que tu equipo Contadoor publica sobre tu empresa: reportes, estado de cuenta, proyecciones y trabajos especiales.</p>
      <p>Las proyecciones (Pre-IVA y Pre-Renta) son estimaciones, no cifras definitivas. Los montos finales son los que te confirmamos en tu reporte.</p>
      <p>Tus datos se tratan conforme a la Ley 19.628 y la Ley 21.719 de protección de datos personales. Tu acceso es personal: no compartas tu contraseña.</p>
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
