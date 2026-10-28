const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { installSharedDomObserver } = require('./helpers/production-slices.cjs');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts', name), 'utf8');
const accessibleSource = read('198-hesabno-accessible-form-fields.js');
const keypadSource = read('214-hesabno-numeric-keyboard.js');
const themeSource = read('225-hesabno-colorful-keypad.js');

/* همان چیدمان واقعی فرم «ثبت وام بانکی و تسهیلات» (برشی از باندل ۰۶۷). */
const LOAN_FORM = `
<main class="hesabno-tab-shell">
  <div class="space-y-3">
    <div class="space-y-1.5">
      <label class="text-xs text-stone-300 font-medium">نام وام یا تسهیلات</label>
      <input id="loan-name" type="text" required placeholder="مثلاً وام مسکن، تسهیلات بانک مهر..."
             data-hesabno-amount-keyboard-field="false"
             class="w-full bg-stone-800/80 border rounded-2xl px-4 py-2.5 text-sm" />
    </div>
    <div class="space-y-1.5">
      <label class="text-xs text-stone-300 font-medium">مبلغ اصل وام دریافتی</label>
      <div class="relative">
        <input id="loan-principal" type="text" dir="ltr" placeholder="مثلاً ۵۰,۰۰۰,۰۰۰"
               class="w-full bg-stone-800/80 border rounded-2xl pl-4 pr-12 py-2.5 text-sm font-mono" />
      </div>
    </div>
    <div class="space-y-1.5">
      <label class="text-xs text-stone-300 font-medium">توضیحات یا یادداشت (اختیاری)</label>
      <input id="loan-note" type="text" placeholder="مثلاً ضامن، شماره پیگیری، نحوه تسویه..."
             class="w-full bg-stone-800/80 border rounded-2xl px-4 py-2.5 text-sm" />
    </div>
  </div>
</main>`;

const CHECK_IDENTIFIER_FORM = `
<main>
  <label for="field-check-number-input">شماره سریال چک *</label>
  <input id="field-check-number-input" type="text" inputmode="numeric"
         data-hesabno-amount-keyboard-field="false" placeholder="شماره برگ چک..." />
  <label for="field-sayadi-id-input">شناسه ۱۶ رقمی صیاد (اختیاری)</label>
  <input id="field-sayadi-id-input" type="text" inputmode="numeric" maxlength="16"
         data-hesabno-amount-keyboard-field="false" placeholder="شناسه ۱۶ رقمی صیادی..." />
  <label for="legacy-check-serial">شماره سریال چک قدیمی</label>
  <input id="legacy-check-serial" type="text" inputmode="numeric" placeholder="شماره برگ چک..." />
</main>`;

function mount(markup = LOAN_FORM) {
  const dom = new JSDOM(`<!doctype html><html lang="fa" dir="rtl"><body>${markup}</body></html>`, {
    url: 'https://app.test/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  window.PointerEvent = window.MouseEvent;
  window.requestAnimationFrame = callback => { callback(); return 1; };
  installSharedDomObserver(window);
  window.eval(accessibleSource);
  window.eval(keypadSource);
  window.eval(themeSource);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return dom;
}

const settle = () => new Promise(resolve => setImmediate(resolve));
const pointerDown = window => new window.Event('pointerdown', { bubbles: true, cancelable: true });

test('loan name field keeps the text keyboard (no readonly lock, no numeric keypad)', async () => {
  const dom = mount();
  const { window } = dom;
  await settle();
  const name = window.document.getElementById('loan-name');

  assert.equal(name.getAttribute('aria-label'), 'نام وام یا تسهیلات', 'برچسب دسترس‌پذیری از فروم خوانده می‌شود');

  const event = pointerDown(window);
  name.dispatchEvent(event);

  assert.equal(event.defaultPrevented, false, 'ضربه روی نام وام نباید پیش‌فرض را لغو کند');
  assert.equal(name.readOnly, false, 'نام وام نباید readOnly شود');
  assert.equal(name.hasAttribute('readonly'), false);
  assert.notEqual(name.getAttribute('inputmode'), 'none', 'نام وام نباید inputmode=none بگیرد');
  assert.notEqual(name.getAttribute('inputmode'), 'numeric', 'نام وام باید کیبورد متنی بگیرد');

  name.focus();
  assert.equal(window.document.activeElement, name, 'فیلد نام باید فوکوس بپذیرد');
  const panel = window.document.getElementById('hesabno-amount-keyboard');
  assert.ok(!panel || panel.hidden, 'کیبورد مبلغ نباید برای نام وام باز شود');
  dom.window.close();
});

test('loan note field keeps the text keyboard instead of inputmode=numeric', async () => {
  const dom = mount();
  const { window } = dom;
  await settle();
  const note = window.document.getElementById('loan-note');

  assert.equal(note.getAttribute('aria-label'), 'توضیحات یا یادداشت (اختیاری)');
  assert.notEqual(note.getAttribute('inputmode'), 'numeric',
    '«توضیحات یا یادداشت» فیلد متنی است و فقط چون نمونه‌ی placeholder واژه‌ی «شماره پیگیری» دارد نباید کیبورد عددی بگیرد');
  const event = pointerDown(window);
  note.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(note.readOnly, false);
  dom.window.close();
});

test('check serial and Sayad identifiers keep the native numeric keyboard', async () => {
  const dom = mount(CHECK_IDENTIFIER_FORM);
  const { window } = dom;
  await settle();
  const fields = [
    window.document.getElementById('field-check-number-input'),
    window.document.getElementById('field-sayadi-id-input'),
    window.document.getElementById('legacy-check-serial')
  ];

  for (const field of fields) {
    const event = pointerDown(window);
    field.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, `${field.id} باید لمس عادی را حفظ کند`);
    assert.equal(field.readOnly, false, `${field.id} نباید به‌اشتباه readOnly شود`);
    assert.equal(field.hasAttribute('readonly'), false);
    assert.equal(field.getAttribute('inputmode'), 'numeric', `${field.id} باید کیبورد عددی گوشی را درخواست کند`);
    assert.equal(window.document.getElementById('hesabno-amount-keyboard').hidden, true,
      'کیبورد مبلغ برای شناسهٔ چک نباید باز شود');
  }
  dom.window.close();
});

test('money fields of the same loan form still open the internal amount keypad', async () => {
  const dom = mount();
  const { window } = dom;
  await settle();
  const principal = window.document.getElementById('loan-principal');
  const event = pointerDown(window);
  principal.dispatchEvent(event);

  assert.equal(event.defaultPrevented, true, 'مبلغ اصل وام باید کیبورد داخلی باز کند');
  assert.equal(principal.readOnly, true);
  assert.equal(principal.getAttribute('inputmode'), 'none');
  assert.equal(window.document.getElementById('hesabno-amount-keyboard').hidden, false);
  dom.window.close();
});

test('a stale readonly/inputmode lock on a marked text field is repaired automatically', async () => {
  const dom = mount();
  const { window } = dom;
  await settle();
  const name = window.document.getElementById('loan-name');
  /* شبیه‌سازی قفلی که نسخه‌های قبلی روی فیلد نام گذاشته‌اند */
  name.readOnly = true;
  name.setAttribute('readonly', 'readonly');
  name.setAttribute('inputmode', 'none');

  const event = pointerDown(window);
  name.dispatchEvent(event);

  assert.equal(name.readOnly, false, 'قفل قدیمی باید برداشته شود');
  assert.equal(name.hasAttribute('readonly'), false);
  assert.notEqual(name.getAttribute('inputmode'), 'none');
  dom.window.close();
});
