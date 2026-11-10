// Íconos SVG constantes (no contienen datos). Se insertan con raw().
import { raw } from './util.js';

const s = (d, w = 2) => raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`);

export const I = {
  campana: s('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  grafico: s('<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>'),
  check: s('<path d="M20 6 9 17l-5-5"/>', 2.2),
  checkG: s('<path d="M20 6 9 17l-5-5"/>', 2.4),
  calendario: s('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 16l3-2 2 1 3-3"/>'),
  llave: s('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'),
  tarjeta: s('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'),
  chat: s('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  candado: s('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 2.2),
  info: s('<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>'),
  atras: s('<path d="m15 18-6-6 6-6"/>'),
  inicio: s('<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  proyecciones: s('<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>'),
  mas: s('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'),
  persona: s('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  reloj: s('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/>'),
  documento: s('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>'),
  seguro: raw('<svg viewBox="0 0 24 24" fill="none" stroke="#5FCF9C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'),
};

/** Ícono B aprobado (persona hecha de barritas). forma: 'circulo' (cabecera) o 'app' (cuadrado rx 24). */
export function iconoB(tam, forma = 'circulo', id = 'gB') {
  const fondo = forma === 'app'
    ? `<rect width="100" height="100" rx="24" fill="url(#${id})"/><circle cx="50" cy="36" r="13" fill="#fff"/><rect x="22" y="60" width="56" height="9" rx="4.5" fill="#fff" transform="rotate(-18 50 64)"/><rect x="26" y="73" width="48" height="9" rx="4.5" fill="#fff" opacity=".85" transform="rotate(-18 50 77)"/>`
    : `<circle cx="50" cy="50" r="48" fill="url(#${id})"/><circle cx="50" cy="34" r="13" fill="#fff"/><rect x="22" y="58" width="56" height="9" rx="4.5" fill="#fff" transform="rotate(-18 50 62)"/><rect x="26" y="71" width="48" height="9" rx="4.5" fill="#fff" opacity=".85" transform="rotate(-18 50 75)"/>`;
  return raw(`<svg width="${tam}" height="${tam}" viewBox="0 0 100 100" role="img" aria-label="MiContadoor"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A4599C"/><stop offset="1" stop-color="#803889"/></linearGradient></defs>${fondo}</svg>`);
}

export const icoPreIva = raw('<svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="gpi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A4599C"/><stop offset="1" stop-color="#803889"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#gpi)"/><rect x="15" y="18" width="34" height="30" rx="5" fill="none" stroke="#fff" stroke-width="3.2"/><path d="M15 27 H49" stroke="#fff" stroke-width="3.2"/><path d="M23 14 V21 M41 14 V21" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M24 38 L30 34 L35 37 L41 31" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>');
export const icoMiRenta = raw('<svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="gmr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A4599C"/><stop offset="1" stop-color="#803889"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#gmr)"/><circle cx="32" cy="32" r="18" fill="none" stroke="#fff" stroke-width="3.4" opacity=".35"/><path d="M32 14 A18 18 0 1 1 15.6 39.4" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M24 36 L30 30 L34 33 L41 25" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
