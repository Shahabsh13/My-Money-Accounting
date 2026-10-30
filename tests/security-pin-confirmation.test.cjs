const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const bundle = fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js', 'utf8');

test('security settings show a second PIN field and normalize both entries to four digits', () => {
  const primary = bundle.indexOf('id:"hesabno-security-pin-input"');
  const confirmation = bundle.indexOf('id:"hesabno-security-pin-confirm-input"');
  assert.ok(primary >= 0 && confirmation > primary, 'confirmation field must appear under the original PIN field');
  assert.ok(bundle.includes('تکرار رمز ۴ رقمی برای تأیید'));
  assert.ok(bundle.includes('برای فعال‌سازی، رمز را یک‌بار دیگر وارد کنید'));

  const primaryField = bundle.slice(primary, confirmation);
  const confirmationField = bundle.slice(confirmation, confirmation + 900);
  for (const field of [primaryField, confirmationField]) {
    assert.ok(field.includes('maxLength:4'));
    assert.ok(field.includes('replace(/[۰-۹]/g'));
    assert.ok(field.includes('slice(0,4)'));
  }
  assert.ok(primaryField.includes('setHnSecurityPinConfirm("")'),
    'editing the PIN again must invalidate the previous confirmation');
});

test('PIN is saved only after both entries match and the security settings are saved', () => {
  const save = bundle.indexOf('data-hesabno-save-security');
  assert.ok(save >= 0);
  const handler = bundle.slice(save, save + 1500);
  assert.ok(handler.includes('C!==hnSecurityPinConfirm'), 'mismatched PIN entries must block saving');
  assert.ok(handler.includes('رمزها یکسان نیستند'));
  assert.ok(handler.includes('if(V)__safeSet("hesabno:pin",C)'),
    'the PIN should be persisted only by the successful Save handler');

  const primary = bundle.indexOf('id:"hesabno-security-pin-input"');
  const confirmation = bundle.indexOf('id:"hesabno-security-pin-confirm-input"');
  assert.ok(!bundle.slice(primary, confirmation).includes('__safeSet("hesabno:pin",v)'),
    'typing the first PIN must not persist an unconfirmed value');
});
