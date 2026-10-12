const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const keypad = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/214-hesabno-numeric-keyboard.js'), 'utf8');
const geometry = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/220-hesabno-stable-tab-geometry.js'), 'utf8');

test('custom keypad marks detected money fields readonly and disables the native input mode', () => {
  assert.ok(keypad.includes('input.readOnly = true'));
  assert.ok(keypad.includes('setAttribute("inputmode", "none")'));
  assert.ok(keypad.includes('document.addEventListener("pointerdown", handlePointerDown, true)'));
});

test('pointerdown prevents native focus on marked money fields before custom keypad activation', () => {
  assert.ok(geometry.includes("input.getAttribute('data-hesabno-amount-keyboard-field') === 'true'"));
  assert.ok(geometry.includes('if (event.cancelable) event.preventDefault();'));
  assert.ok(keypad.includes('activateInput(input, true)'));
});

test('keypad display and buttons do not steal focus and summon the system keyboard', () => {
  assert.ok(geometry.includes('#hesabno-amount-keyboard button, #hesabno-amount-keyboard input[data-hkap-value]'));
  assert.ok(geometry.includes('if (keypadControl && event.cancelable) event.preventDefault();'));
  assert.ok(keypad.includes('data-hkap-value'));
});

test('native keyboard prevention is scoped to money fields and keypad controls, not other form inputs', () => {
  assert.ok(geometry.includes("if (input && input.getAttribute('data-hesabno-amount-keyboard-field') === 'true')"));
  assert.doesNotMatch(geometry, /document\.addEventListener\('focusin',[\s\S]*?preventDefault/);
});

test('non-dashboard tabs clear stale header padding without changing dashboard styling', () => {
  assert.doesNotMatch(geometry, /paddingTop\s*=\s*pad|measuredHeaderHeight|headerHeight\s*\|\|/);
  assert.ok(geometry.includes("content.style.paddingTop = ''"));
  assert.ok(geometry.includes("removeAttribute('data-hesabno-header-pad')"));
  assert.doesNotMatch(geometry, /dashboard\.style|dashboard\.classList|#dashboard/);
});
