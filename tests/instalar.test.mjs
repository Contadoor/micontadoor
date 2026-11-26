import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esIos, esSafari, mostrarGuiaIos, vGuiaIos } from '../js/vistas-instalar.js';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
test('GUIA-IOS: solo en iPhone/iPad sin instalar', () => {
  assert.equal(mostrarGuiaIos({ ua: IPHONE }), true);
  assert.equal(mostrarGuiaIos({ ua: IPAD, tactil: 5 }), true);
  assert.equal(mostrarGuiaIos({ ua: IPAD, tactil: 0 }), false, 'Mac de escritorio no');
  assert.equal(mostrarGuiaIos({ ua: ANDROID }), false, 'Android la ofrece solo');
  assert.equal(mostrarGuiaIos({ ua: IPHONE, instalada: true }), false, 'ya instalada');
});
test('GUIA-IOS: «Ahora no» la pausa 7 días', () => {
  const ahora = Date.UTC(2026, 10, 26);
  assert.equal(mostrarGuiaIos({ ua: IPHONE, cerradaAt: ahora - 2 * 864e5, ahora }), false);
  assert.equal(mostrarGuiaIos({ ua: IPHONE, cerradaAt: ahora - 8 * 864e5, ahora }), true);
});
test('GUIA-IOS: Safari vs otro navegador en iPhone', () => {
  assert.equal(esSafari(IPHONE), true); assert.equal(esSafari(IPHONE_CHROME), false); assert.equal(esIos(IPHONE_CHROME), true);
  const a = String(vGuiaIos({ safari: true })), b = String(vGuiaIos({ safari: false }));
  assert.match(a, /Agregar a pantalla de inicio/); assert.match(a, /data-accion="cerrar-guia-ios"/);
  assert.match(b, /ábrelo en <b>Safari<\/b>/);
});
