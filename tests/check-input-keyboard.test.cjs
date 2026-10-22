const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const formSource = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/067-inline.js'), 'utf8');
const keypadSource = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/214-hesabno-numeric-keyboard.js'), 'utf8');
const legacyKeypadSource = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/225-hesabno-colorful-keypad.js'), 'utf8');

test('check serial and Sayadi identifier explicitly keep the native numeric keyboard', () => {
  const serial = formSource.match(/id:"field-check-number-input",type:"text",inputMode:"numeric"[^}]+/);
  const sayadi = formSource.match(/type:"text",inputMode:"numeric",maxLength:16[^}]+/);
  assert.ok(serial, 'فیلد شماره سریال چک باید پیدا شود');
  assert.ok(sayadi, 'فیلد شناسه صیاد باید پیدا شود');
  for (const [name, source] of [['شماره سریال چک', serial[0]], ['شناسه صیاد', sayadi[0]]]) {
    assert.match(source, /data-hesabno-amount-keyboard-field":"false"/, `${name} نباید با کیبورد مبلغ قفل شود`);
    assert.match(source, /inputMode:"numeric"/, `${name} باید صفحه‌کلید عددی سیستم را درخواست کند`);
  }
});

test('check identifiers are not intercepted and keep focus for the Android keyboard', () => {
  const dom = new JSDOM(`<!doctype html><html><body><label for="check-serial">شماره سریال چک</label><input id="check-serial" type="text" inputmode="numeric" placeholder="شماره برگ چک..." data-hesabno-amount-keyboard-field="false"></body></html>`, {
    url: 'https://app.test/', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const { window } = dom;
  window.requestAnimationFrame = callback => { callback(); return 1; };
  window.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };
  window.eval(keypadSource);
  window.eval(legacyKeypadSource);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  const input = window.document.getElementById('check-serial');
  const pointer = new window.Event('pointerdown', { bubbles: true, cancelable: true });
  input.dispatchEvent(pointer);
  assert.equal(pointer.defaultPrevented, false);
  assert.equal(input.readOnly, false);
  assert.equal(input.getAttribute('inputmode'), 'numeric');
  input.focus();
  assert.equal(window.document.activeElement, input);
  const keypad = window.document.getElementById('hesabno-amount-keyboard');
  assert.ok(!keypad || keypad.hidden, 'فیلد شماره نباید کیبورد مبلغ داخلی را باز کند');
  dom.window.close();
});

test('stale amount-keyboard locks are removed from explicitly non-money check fields', () => {
  const dom = new JSDOM(`<!doctype html><html><body><input id="check-serial" type="text" inputmode="none" readonly data-hesabno-amount-keyboard-field="false"></body></html>`, {
    url: 'https://app.test/', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const { window } = dom;
  window.requestAnimationFrame = callback => { callback(); return 1; };
  window.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };
  window.eval(keypadSource);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  const input = window.document.getElementById('check-serial');
  input.dispatchEvent(new window.Event('pointerdown', { bubbles: true, cancelable: true }));
  assert.equal(input.readOnly, false);
  assert.notEqual(input.getAttribute('inputmode'), 'none');
  assert.equal(window.document.getElementById('hesabno-amount-keyboard').hidden, true);
  dom.window.close();
});
