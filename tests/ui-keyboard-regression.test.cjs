const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const keypad = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/214-hesabno-numeric-keyboard.js'), 'utf8');
const geometry = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/220-hesabno-stable-tab-geometry.js'), 'utf8');

test('custom keypad marks all detected money fields readonly and disables the native input mode', () => {
  assert.match(keypad, /function markMoneyInput\(input\)[\s\S]*?input\.readOnly = true[\s\S]*?setAttribute\("inputmode", "none"\)/);
  assert.match(keypad, /document\.addEventListener\("pointerdown", handlePointerDown, true\)/);
});

test('pointerdown prevents native focus on marked money fields before custom keypad activation', () => {
  assert.match(geometry, /document\.addEventListener\('pointerdown',[\s\S]*?input\.getAttribute\('data-hesabno-amount-keyboard-field'\) === 'true'[\s\S]*?event\.preventDefault\(\)/);
  assert.match(keypad, /function handlePointerDown\(event\)[\s\S]*?activateInput\(input, true\)/);
});

test('keypad display and buttons do not steal focus and summon the system keyboard', () => {
  assert.match(geometry, /#hesabno-amount-keyboard button, #hesabno-amount-keyboard input\[data-hkap-value\]/);
  assert.match(geometry, /if \(keypadControl && event\.cancelable\) event\.preventDefault\(\)/);
  assert.match(keypad, /data-hkap-value value=.*?readonly inputmode=\\\"none\\\" tabindex=\\\"0\\\"/);
});

test('native keyboard prevention is scoped to money fields and keypad controls, not other form inputs', () => {
  assert.doesNotMatch(geometry, /document\.addEventListener\('focusin',[\s\S]*?preventDefault/);
  assert.match(geometry, /if \(!input \|\| input\.getAttribute\('data-hesabno-amount-keyboard-field'\) !== 'true'\)/);
});

test('non-dashboard tabs clear stale header padding without changing dashboard styling', () => {
  assert.doesNotMatch(geometry, /paddingTop\s*=\s*pad|measuredHeaderHeight|headerHeight\s*\|\|/);
  assert.match(geometry, /content\.style\.paddingTop = ''/);
  assert.match(geometry, /removeAttribute\('data-hesabno-header-pad'\)/);
  assert.doesNotMatch(geometry, /dashboard\.style|dashboard\.classList|#dashboard/);
});
