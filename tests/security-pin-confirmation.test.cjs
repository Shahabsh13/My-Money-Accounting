const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { bootApp, closeApp, buttonByText, wait } = require('./helpers/app-boot.cjs');

const bundle = fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js', 'utf8');

test('security settings show a second PIN field and normalize both entries to four digits', () => {
  const primary = bundle.indexOf('id:"hesabno-security-pin-input"');
  const confirmation = bundle.indexOf('id:"hesabno-security-pin-confirm-input"');
  assert.ok(primary >= 0 && confirmation > primary, 'confirmation field must appear under the original PIN field');
  assert.ok(bundle.includes('تکرار رمز ۴ رقمی برای تأیید'));
  assert.ok(bundle.includes('برای فعال‌سازی، رمز را یک‌بار دیگر وارد کنید'));

  const primaryField = bundle.slice(primary, confirmation);
  const confirmationField = bundle.slice(confirmation, confirmation + 1200);
  for (const field of [primaryField, confirmationField]) {
    assert.ok(field.includes('maxLength:4'));
    assert.ok(field.includes('replace(/[۰-۹]/g'));
    assert.ok(field.includes('slice(0,4)'));
  }
  assert.ok(primaryField.includes('setHnSecurityPinConfirm("")'),
    'editing the PIN again must invalidate the previous confirmation');
  assert.ok(bundle.includes('✓ رمزها مطابقت دارند'), 'matching entries must be reported immediately');
  assert.ok(bundle.includes('✕ رمزها مطابقت ندارند'), 'a mismatch must be reported immediately');
});

test('both PIN fields have independent accessible eye controls', () => {
  assert.ok(bundle.includes('[hnSecurityPinVisible,setHnSecurityPinVisible]=M.useState(!1)'));
  assert.ok(bundle.includes('[hnSecurityPinConfirmVisible,setHnSecurityPinConfirmVisible]=M.useState(!1)'));
  assert.ok(bundle.includes('type:hnSecurityPinVisible?"text":"password"'));
  assert.ok(bundle.includes('type:hnSecurityPinConfirmVisible?"text":"password"'));
  assert.ok(bundle.includes('hnPinVisibilityControl(hnSecurityPinVisible,setHnSecurityPinVisible,"primary")'));
  assert.ok(bundle.includes('hnPinVisibilityControl(hnSecurityPinConfirmVisible,setHnSecurityPinConfirmVisible,"confirmation")'));
  assert.ok(bundle.includes('"data-hesabno-pin-visibility":field'));
  assert.ok(bundle.includes('"aria-label":visible?"پنهان کردن PIN":"نمایش PIN"'));
  assert.ok(bundle.includes('onClick:()=>setVisible(value=>!value)'));
  assert.ok(bundle.includes('visible&&e.jsx("path",{d:"m3 3 18 18"})'), 'visible PIN uses the eye-slash icon when hidden again');
});

test('eye controls reveal and hide each PIN field independently', async () => {
  const dom = await bootApp({ storage: {
    'hesabno:first_run_intro_done': 'true',
    'hesabno:first_run_profile_done': 'true',
  } });
  try {
    const document = dom.window.document;
    buttonByText(document, 'بیشتر').click();
    await wait(900);
    const baseSettings = [...document.querySelectorAll('button')].find((button) =>
      (button.textContent || '').trim().startsWith('تنظیمات پایه'));
    assert.ok(baseSettings, 'base settings must be reachable from the More tab');
    baseSettings.click();
    await wait(900);
    const securityRow = document.getElementById('setting-row-security');
    assert.ok(securityRow);
    securityRow.click();
    await wait(100);
    const lockToggle = document.getElementById('hesabno-security-lock-toggle');
    assert.ok(lockToggle);
    lockToggle.click();
    await wait(100);

    const primary = document.getElementById('hesabno-security-pin-input');
    const confirmation = document.getElementById('hesabno-security-pin-confirm-input');
    const primaryEye = document.querySelector('[data-hesabno-pin-visibility="primary"]');
    const confirmationEye = document.querySelector('[data-hesabno-pin-visibility="confirmation"]');
    assert.ok(primary && confirmation && primaryEye && confirmationEye);
    assert.equal(primary.type, 'password');
    assert.equal(confirmation.type, 'password');
    primaryEye.click();
    await wait(50);
    assert.equal(document.getElementById('hesabno-security-pin-input').type, 'text');
    assert.equal(document.getElementById('hesabno-security-pin-confirm-input').type, 'password', 'showing the first PIN must not reveal confirmation');
    assert.equal(document.querySelector('[data-hesabno-pin-visibility="primary"]').getAttribute('aria-pressed'), 'true');
    document.querySelector('[data-hesabno-pin-visibility="confirmation"]').click();
    await wait(50);
    assert.equal(document.getElementById('hesabno-security-pin-input').type, 'text');
    assert.equal(document.getElementById('hesabno-security-pin-confirm-input').type, 'text');
    document.querySelector('[data-hesabno-pin-visibility="primary"]').click();
    await wait(50);
    assert.equal(document.getElementById('hesabno-security-pin-input').type, 'password');
    assert.equal(document.getElementById('hesabno-security-pin-confirm-input').type, 'text', 'hiding the first PIN must not hide confirmation');
  } finally {
    closeApp(dom);
  }
});

test('PIN and lock preferences are saved only after matching entries and Save', () => {
  const save = bundle.indexOf('data-hesabno-save-security');
  assert.ok(save >= 0);
  const handler = bundle.slice(save, save + 1800);
  assert.ok(handler.includes('V&&C!==hnSecurityPinConfirm'), 'mismatched PIN entries must block saving');
  assert.ok(handler.includes('رمزها یکسان نیستند'));
  assert.ok(handler.includes('if(V)__safeSet("hesabno:pin",C)'),
    'the PIN should be persisted only by the successful Save handler');
  assert.ok(handler.includes('__safeSet("hesabno:lock",String(V))'),
    'the lock preference should be committed only by Save');

  const primary = bundle.indexOf('id:"hesabno-security-pin-input"');
  const confirmation = bundle.indexOf('id:"hesabno-security-pin-confirm-input"');
  assert.ok(!bundle.slice(primary, confirmation).includes('__safeSet("hesabno:pin",v)'),
    'typing the first PIN must not persist an unconfirmed value');

  const lockToggle = bundle.indexOf('id:"hesabno-security-lock-toggle"');
  const pinBlock = bundle.indexOf('id:"hesabno-security-pin-input"', lockToggle);
  const lockHandler = bundle.slice(lockToggle, pinBlock);
  assert.ok(!lockHandler.includes('__safeSet("hesabno:lock"'),
    'checking the lock must not activate it before the PIN has been confirmed and saved');
});

test('biometric cannot be selected until a valid PIN is present and confirmed', () => {
  assert.ok(bundle.includes('disabled:!hnSecurityPinReady&&!B'));
  assert.ok(bundle.includes('if(Ae&&!hnSecurityPinReady)return'), 'the change handler must enforce the disabled state too');
  assert.ok(bundle.includes('ابتدا رمز ۴ رقمی را وارد و تأیید کنید'));
  assert.ok(bundle.includes('String(C||"").length===4&&(C===String(__safeGet("hesabno:pin")||"")||C===hnSecurityPinConfirm)'),
    'biometrics should unlock only for a stored PIN or a matching new confirmation');
});

test('an invalid legacy lock with no four-digit PIN is cleared instead of trapping the user', () => {
  assert.ok(bundle.includes('if(enabled&&!/^\\d{4}$/.test(savedPin))'));
  assert.ok(bundle.includes('__safeSet("hesabno:lock","false"),__safeSet("hesabno:biometric","false")'));
});
