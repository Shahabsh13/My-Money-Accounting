const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, closeApp, wait, normalize } = require('./helpers/app-boot.cjs');

let hasJsdom = true;
try { require('jsdom'); } catch { hasJsdom = false; }

const stubs = (window) => {
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { width: 300, height: 120, top: 0, left: 0, right: 300, bottom: 120, x: 0, y: 0 };
  };
  const nativeQuerySelectorAll = window.document.querySelectorAll.bind(window.document);
  window.__accountPickerOverlayScans = 0;
  window.document.querySelectorAll = (selector) => {
    if (selector === 'div.fixed.inset-0') window.__accountPickerOverlayScans += 1;
    return nativeQuerySelectorAll(selector);
  };
};

const transactions = Array.from({ length: 5 }, (_, index) => ({
  id: 90000 + index,
  documentNumber: index + 1,
  title: `سند آزمایشی ${index + 1}`,
  category: 'خرید روزانه',
  amount: 125000 + index,
  date: '1405/07/29',
  type: 'expense',
  method: 'normal',
  account: 'بانک ملت',
}));

test('انتخاب‌گر حساب بدون کلیک، از ناظر DOM برای بهبود overlay استفاده می‌کند', { timeout: 120000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');

  const dom = await bootApp({
    seed: transactions,
    storage: {
      'hesabno:first_run_profile_done': '1',
      'hesabno:first_run_intro_done': '1',
    },
    stubs,
  });
  t.after(() => closeApp(dom));

  const { window } = dom;
  const { document } = window;
  const click = (element) => {
    if (!element) return;
    const propsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'));
    const handler = propsKey && element[propsKey].onClick;
    if (handler) handler({ target: element, currentTarget: element, preventDefault() {}, stopPropagation() {} });
    else element.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
  };

  const payment = [...document.querySelectorAll('main button')]
    .find((button) => normalize(button.textContent) === 'پرداخت');
  assert.ok(payment, 'دکمهٔ ثبت پرداخت باید در خانه باشد');
  click(payment);
  await wait(1400);

  const partyField = document.getElementById('field-party');
  assert.ok(partyField, 'فرم پرداخت باید کادر انتخاب سرفصل را نشان دهد');
  click(partyField);
  await wait(40);

  const overlay = document.querySelector('.hesabno-fullscreen-selector-overlay');
  assert.ok(overlay, 'انتخاب‌گر باید باز شود');
  assert.ok(overlay.classList.contains('hesabno-account-picker-overlay'),
    'ناظر تغییرات باید overlay را بدون نیاز به رویداد کلیک ارتقا دهد');

  // پس از آرام‌شدن تغییرات بازشدن پنجره، کلیک بی‌اثر نباید پیمایش را در مسیر هم‌زمان اجرا کند.
  await wait(60);
  window.__accountPickerOverlayScans = 0;
  const heading = overlay.querySelector('h1');
  assert.ok(heading, 'عنوان انتخاب‌گر باید موجود باشد');
  click(heading);
  assert.equal(window.__accountPickerOverlayScans, 0,
    'کلیک بی‌اثر نباید پیمایش سراسری overlayها را به‌صورت هم‌زمان با تعامل کاربر اجرا کند');
});
