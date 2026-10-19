const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { installSharedDomObserver } = require('./helpers/production-slices.cjs');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const keypadSource = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/214-hesabno-numeric-keyboard.js'), 'utf8');
const geometrySource = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/220-hesabno-stable-tab-geometry.js'), 'utf8');

async function settleAndClose(dom) { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

function mount(options = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"><div><main><div id="dashboard" style="padding-top: 12px"></div><div class="grow flex flex-col" id="page-content" style="padding-top: 84px" data-hesabno-header-pad="84"><label for="amount">مبلغ تراکنش</label><input id="amount" placeholder="مبلغ" value="" /><input id="ordinary" placeholder="نام شخص" /></div></main></div></div></body></html>`, { url: 'https://app.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  if (!options.legacyTouch) dom.window.PointerEvent = dom.window.MouseEvent; // jsdom lacks PointerEvent by default; emulate modern Android WebView support.
  dom.window.requestAnimationFrame = callback => { callback(); return 1; };
  dom.window.setTimeout = callback => { callback(); return 1; };
  installSharedDomObserver(dom.window);
  dom.window.eval(keypadSource);
  dom.window.eval(geometrySource);
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded", { bubbles: true }));
  return dom;
}

test('amount pointerdown is canceled before native focus while the custom keypad opens', async () => {
  const dom = mount(); const { window } = dom; const input = window.document.getElementById('amount');
  const event = new window.Event('pointerdown', { bubbles: true, cancelable: true });
  input.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(window.document.getElementById('hesabno-amount-keyboard').hidden, false);
  assert.notEqual(window.document.activeElement, input);
  assert.equal(input.readOnly, true);
  assert.equal(input.getAttribute('inputmode'), 'none');
  await settleAndClose(dom);
});


test('legacy WebView touchstart fallback suppresses native focus and opens the custom keypad', async () => {
  const dom = mount({ legacyTouch: true }); const { window } = dom; const input = window.document.getElementById('amount');
  const event = new window.Event('touchstart', { bubbles: true, cancelable: true }); input.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(window.document.getElementById('hesabno-amount-keyboard').hidden, false);
  assert.equal(input.readOnly, true);
  await settleAndClose(dom);
});

test('keypad keeps digits in its own display and writes the field only on confirm', async () => {
  const dom = mount(); const { window } = dom; const input = window.document.getElementById('amount');
  input.dispatchEvent(new window.Event('pointerdown', { bubbles: true, cancelable: true }));
  const panel = window.document.getElementById('hesabno-amount-keyboard');
  const display = panel.querySelector('[data-hkap-value]');
  const inputEvents = [];
  input.addEventListener('input', () => inputEvents.push(input.value));

  panel.querySelector('[data-value="7"]').click();
  panel.querySelector('[data-value="00"]').click();
  assert.equal(display.value, '۷۰۰', 'رقم‌ها فقط در نمایشگر کیبورد دیده می‌شوند');
  assert.equal(input.value, '', 'تا تأیید نشدن، فیلد نباید تغییر کند');
  assert.deepEqual(inputEvents, [], 'پیش از تأیید هیچ رویداد input منتشر نمی‌شود');

  let changes = 0; input.addEventListener('change', () => changes++);
  panel.querySelector('[data-hkap-action="confirm"]').click();
  assert.equal(input.value, '700', 'تأیید مقدار پیش‌نویس را می‌نویسد');
  assert.deepEqual(inputEvents, ['700'], 'دقیقاً یک رویداد input روی تأیید');
  assert.equal(changes, 1);
  assert.equal(panel.hidden, true);
  await settleAndClose(dom);
});

test('a pointer press registers the digit immediately, without waiting for click', async () => {
  const dom = mount(); const { window } = dom; const input = window.document.getElementById('amount');
  input.dispatchEvent(new window.Event('pointerdown', { bubbles: true, cancelable: true }));
  const panel = window.document.getElementById('hesabno-amount-keyboard');
  const button = panel.querySelector('[data-value="3"]');
  const press = new window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, detail: 1 });
  button.dispatchEvent(press);
  assert.equal(press.defaultPrevented, true, 'فشردن باید پیش‌فرض را لغو کند');
  assert.equal(panel.querySelector('[data-hkap-value]').value, '۳');
  assert.equal(input.value, '', 'هنوز تأیید نشده');
  await settleAndClose(dom);
});

test('the synthetic click after a press does not apply the digit twice', async () => {
  const dom = mount(); const { window } = dom; const input = window.document.getElementById('amount');
  input.dispatchEvent(new window.Event('pointerdown', { bubbles: true, cancelable: true }));
  const panel = window.document.getElementById('hesabno-amount-keyboard');
  const button = panel.querySelector('[data-value="8"]');
  button.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, detail: 1 }));
  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  assert.equal(panel.querySelector('[data-hkap-value]').value, '۸', 'یک ضربه = یک رقم');
  await settleAndClose(dom);
});

test('legacy touch WebView registers digits on touchstart because click is suppressed', async () => {
  const dom = mount({ legacyTouch: true }); const { window } = dom; const input = window.document.getElementById('amount');
  input.dispatchEvent(new window.Event('touchstart', { bubbles: true, cancelable: true }));
  const panel = window.document.getElementById('hesabno-amount-keyboard');
  const button = panel.querySelector('[data-value="5"]');
  const touch = new window.Event('touchstart', { bubbles: true, cancelable: true });
  button.dispatchEvent(touch);
  assert.equal(touch.defaultPrevented, true);
  assert.equal(panel.querySelector('[data-hkap-value]').value, '۵',
    'در WebViewهای قدیمی که click پس از preventDefault نمی‌آید، touchstart باید رقم را ثبت کند');
  assert.equal(input.value, '');
  /* شبیه‌سازی سوپرشن click: هیچ رویداد کلیکی نمی‌آید؛ تأیید باید با فشردن انجام شود */
  const confirm = panel.querySelector('[data-hkap-action="confirm"]');
  confirm.dispatchEvent(new window.Event('touchstart', { bubbles: true, cancelable: true }));
  assert.equal(input.value, '5', 'تأیید لمسی باید مقدار پیش‌نویس را بنویسد');
  await settleAndClose(dom);
});

test('draft starts from the current field value and supports backspace', async () => {
  const dom = mount(); const { window } = dom; const input = window.document.getElementById('amount');
  input.value = '1200';
  input.dispatchEvent(new window.Event('pointerdown', { bubbles: true, cancelable: true }));
  const panel = window.document.getElementById('hesabno-amount-keyboard');
  const display = panel.querySelector('[data-hkap-value]');
  assert.equal(display.value, '۱٬۲۰۰', 'نمایشگر از مقدار فعلی فیلد شروع می‌کند');
  panel.querySelector('[data-hkap-action="backspace"]').click();
  assert.equal(display.value, '۱۲۰');
  assert.equal(input.value, '1200');
  panel.querySelector('[data-hkap-action="confirm"]').click();
  assert.equal(input.value, '120');
  await settleAndClose(dom);
});

test('closing the keypad without confirm discards the draft', async () => {
  const dom = mount(); const { window } = dom; const input = window.document.getElementById('amount');
  input.value = '5000';
  const events = [];
  input.addEventListener('input', () => events.push('input'));
  input.addEventListener('change', () => events.push('change'));
  input.dispatchEvent(new window.Event('pointerdown', { bubbles: true, cancelable: true }));
  const panel = window.document.getElementById('hesabno-amount-keyboard');
  panel.querySelector('[data-value="7"]').click();
  panel.querySelector('[data-value="000"]').click();
  assert.equal(panel.querySelector('[data-hkap-value]').value, '۵۰٬۰۰۷٬۰۰۰',
    'پیش‌نویس از مقدار فعلی فیلد ادامه می‌یابد');
  panel.querySelector('[data-hkap-action="close"]').click();
  assert.equal(panel.hidden, true);
  assert.equal(input.value, '5000', 'بستن بدون تأیید مقدار قبلی را حفظ می‌کند');
  assert.deepEqual(events, [], 'بستن هیچ رویدادی منتشر نمی‌کند');
  await settleAndClose(dom);
});

test('opening the keypad puts a blurred backdrop behind it and hides it on close', async () => {
  const dom = mount(); const { window } = dom; const input = window.document.getElementById('amount');
  input.dispatchEvent(new window.Event('pointerdown', { bubbles: true, cancelable: true }));
  const panel = window.document.getElementById('hesabno-amount-keyboard');
  const backdrop = window.document.getElementById('hesabno-amount-keyboard-backdrop');
  assert.ok(backdrop, 'پرده باید ساخته شود');
  assert.equal(backdrop.hidden, false, 'وقتی کیبورد باز است پرده دیده می‌شود');
  assert.ok(Number(backdrop.style.zIndex || 0) === 0, 'z-index از CSS می‌آید');
  const css = Array.from(window.document.querySelectorAll('style')).map(s => s.textContent).join('\n');
  assert.match(css, /#hesabno-amount-keyboard-backdrop\{[^}]*backdrop-filter:blur\(/,
    'پرده باید صفحه‌ی زیر را تار کند');
  panel.querySelector('[data-hkap-action="confirm"]').click();
  assert.equal(backdrop.hidden, true, 'پس از بستن، پرده برداشته می‌شود');
  await settleAndClose(dom);
});

test('physical digits edit the draft and Enter commits it', async () => {
  const dom = mount(); const { window } = dom; const input = window.document.getElementById('amount');
  input.dispatchEvent(new window.Event('pointerdown', { bubbles: true, cancelable: true }));
  const panel = window.document.getElementById('hesabno-amount-keyboard');
  const type = (key) => panel.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  type('4'); type('2');
  assert.equal(input.value, '', 'ورودی فیزیکی هم تا تأیید نمی‌نشیند');
  assert.equal(panel.querySelector('[data-hkap-value]').value, '۴۲');
  type('Enter');
  assert.equal(input.value, '42');
  assert.equal(panel.hidden, true);
  await settleAndClose(dom);
});

test('ordinary text inputs keep normal pointer focus; keypad suppression is scoped', async () => {
  const dom = mount(); const { window } = dom; const input = window.document.getElementById('ordinary');
  const event = new window.Event('pointerdown', { bubbles: true, cancelable: true }); input.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(input.readOnly, false);
  await settleAndClose(dom);
});

test('non-dashboard content clears stale top padding after initial render and tab rerender, dashboard is untouched', async () => {
  const dom = mount(); const { window } = dom; const content = window.document.getElementById('page-content');
  assert.equal(content.style.paddingTop, '');
  assert.equal(content.hasAttribute('data-hesabno-header-pad'), false);
  const dashboard = window.document.getElementById('dashboard');
  assert.equal(dashboard.style.paddingTop, '12px');
  content.style.paddingTop = '72px'; content.setAttribute('data-hesabno-header-pad', '72');
  content.appendChild(window.document.createElement('section'));
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(content.style.paddingTop, '');
  assert.equal(content.hasAttribute('data-hesabno-header-pad'), false);
  assert.equal(dashboard.style.paddingTop, '12px');
  await settleAndClose(dom);
});

test('geometry script does not own keyboard events and does not add synthetic header padding', () => {
  assert.doesNotMatch(geometrySource, /addEventListener\(['"](?:pointerdown|touchstart|mousedown|focusin)['"]/);
  assert.doesNotMatch(geometrySource, /paddingTop\s*=\s*[^'"\s]/);
  assert.match(geometrySource, /content\.style\.paddingTop = ''/);
});

test('keypad syncs untouched draft when edit-mode useEffect populates input value after autoFocus, without overwriting user clear', async () => {
  const dom = mount(); const { window } = dom; const input = window.document.getElementById('amount');
  // 1) Simulate React mounting #field-amount-input with autoFocus (value === "") and populating value in useEffect
  input.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
  const panel = window.document.getElementById('hesabno-amount-keyboard');
  const display = panel.querySelector('[data-hkap-value]');
  assert.equal(panel.hidden, false);
  input.value = '۲،۰۰۰،۰۰۰';
  await Promise.resolve();
  assert.equal(display.value, '۲٬۰۰۰٬۰۰۰', 'مبلغ تراکنش در حالت ویرایش باید داخل نمایشگر کیبورد داخلی قرار بگیرد');

  // 2) If user presses C (clear), syncUntouchedDraft must NOT overwrite user cleared draft with input.value
  panel.querySelector('[data-hkap-action="clear"]').click();
  assert.equal(display.value, '۰', 'پاک کردن توسط کاربر نباید دوباره با مقدار قبلی فیلد پر شود');
  await Promise.resolve();
  assert.equal(display.value, '۰');
  await settleAndClose(dom);
});

