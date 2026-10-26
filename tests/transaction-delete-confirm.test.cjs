/*
 * تأیید حذف سند در فرم ویرایش (گزارش کاربر با اسکرین‌شات)
 *
 * قبلاً با زدن سطل زباله در هدر فرم ویرایش، یک نوار تأیید کوچک *کنار همان دکمه*
 * باز می‌شد («انصراف و حذف سند؟ / بله، حذف شود / انصراف») و صفحه را جابه‌جا می‌کرد.
 * حالا همان پرسش به یک دیالوگ وسط‌صفحه با پس‌زمینهٔ تیره تبدیل شده است.
 *
 * تصمیم دامنه‌ای: حذف سند هم در فرم ویرایش می‌ماند (زیرا کاربر سند را باز کرده و
 * جزئیاتش را می‌بیند) و هم در لیست تراکنش‌ها؛ اما در فرم *جدید* (سندی که هنوز ثبت
 * نشده) سطل زباله نمایش داده نمی‌شود، چون دکمهٔ بستن همان کار «انصراف» را می‌کند.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { bootApp, closeApp, wait, normalize } = require('./helpers/app-boot.cjs');

let hasJsdom = true;
try {
  require('jsdom');
} catch (error) {
  hasJsdom = false;
}

const root = path.resolve(__dirname, '..');
const readAsset = (relative) => fs.readFileSync(path.join(root, 'app/src/main/assets', relative), 'utf8');
const FIRST_RUN_DONE = {
  'hesabno:first_run_profile_done': 'true',
  'hesabno:first_run_intro_done': 'true',
};
const stubs = (window) => {
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { width: 300, height: 120, top: 0, left: 0, right: 300, bottom: 120, x: 0, y: 0 };
  };
};
const seed = [
  { id: 9001, documentNumber: 1, title: 'خرید نان', category: 'خرید روزانه', amount: 250000, date: '1405/07/29', time: '12:00', type: 'expense', method: 'normal', account: 'حساب اصلی', destinationAccount: 'نقد' },
  { id: 9002, documentNumber: 2, title: 'حقوق', category: 'درآمد', amount: 9000000, date: '1405/07/28', time: '09:00', type: 'income', method: 'normal', account: 'حساب اصلی', destinationAccount: 'حقوق' },
];

test('the inline header confirmation is gone and the centred dialog is in the bundle', () => {
  const bundle = readAsset('src/scripts/067-inline.js');
  assert.equal(bundle.includes('انصراف و حذف سند؟'), false,
    'نوار تأیید کنار دکمهٔ حذف نباید در هدر فرم بماند');
  assert.equal(bundle.includes('حذف کامل سند؟'), false,
    'متن قدیمی «حذف کامل سند؟» دیگر نباید در هدر فرم رندر شود');
  assert.ok(bundle.includes('data-hesabno-delete-confirm'),
    'دیالوگ تأیید حذف باید نشانهٔ اختصاصی داشته باشد');
  assert.match(bundle, /data-hesabno-delete-confirm[\s\S]{0,220}fixed inset-0[^"]*items-center justify-center/,
    'دیالوگ تأیید حذف باید تمام‌صفحه و وسط‌چین باشد');
  assert.ok(bundle.includes('"aria-modal":"true"'),
    'دیالوگ تأیید حذف باید role=dialog و aria-modal داشته باشد');
  assert.ok(bundle.includes('بله، حذف شود'), 'دکمهٔ تأیید حذف باید بماند');
  assert.ok(bundle.includes('بازگشت به فرم'), 'راه فرار از دیالوگ باید «بازگشت به فرم» باشد');
});

test('delete stays in the edit form only (centred dialog), not in the new-document form', { timeout: 150000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({ seed, storage: FIRST_RUN_DONE, stubs });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const d = window.document;
  const click = (el) => el && el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

  await wait(900);
  const skip = [...d.querySelectorAll('button')].find((button) => normalize(button.textContent) === 'رد کردن');
  if (skip) { click(skip); await wait(300); }

  /* فرم سند جدید: سطل زباله‌ای نباید باشد (بستن کار انصراف را می‌کند). */
  click([...d.querySelectorAll('main button')].find((button) => normalize(button.textContent) === 'پرداخت'));
  await wait(1200);
  const newHeader = d.querySelector('main header');
  assert.ok(newHeader, 'فرم ثبت پرداخت باید هدر داشته باشد');
  assert.equal(d.querySelectorAll('main header [title="حذف کامل سند"]').length, 0,
    'در فرم سند جدید دکمهٔ حذف نباید دیده شود');
  const keypadBeforeFormClose = d.getElementById('hesabno-amount-keyboard');
  if (keypadBeforeFormClose && !keypadBeforeFormClose.hidden) {
    keypadBeforeFormClose.querySelector('[data-hkap-action="close"]').click();
  }
  click(newHeader.querySelector('button[aria-label="بستن"]'));
  await wait(900);

  /* فرم ویرایش سند موجود: سطل زباله هست و تأیید آن وسط صفحه می‌آید. */
  click([...d.querySelectorAll('nav.fixed button')].find((button) => normalize(button.textContent) === 'تراکنش‌ها'));
  await wait(1400);
  const card = d.querySelector('article[id^="tx-card-"]');
  assert.ok(card, 'کارت تراکنش باید رندر شود');
  click(card.querySelector('div.cursor-pointer'));
  await wait(900);
  const edit = [...card.querySelectorAll('button')].find((button) => normalize(button.textContent) === 'ویرایش');
  assert.ok(edit, 'دکمهٔ ویرایش تراکنش باید باشد');
  click(edit);
  await wait(1500);

  const trash = d.querySelector('main header [title="حذف کامل سند"]');
  assert.ok(trash, 'در فرم ویرایش دکمهٔ حذف سند باید بماند');
  assert.equal(trash.getAttribute('aria-label'), 'حذف کامل سند');
  assert.equal(trash.getAttribute('aria-haspopup'), 'dialog');
  const keypadBeforeDelete = d.getElementById('hesabno-amount-keyboard');
  if (keypadBeforeDelete && !keypadBeforeDelete.hidden) {
    keypadBeforeDelete.querySelector('[data-hkap-action="close"]').click();
  }
  click(trash);
  await wait(700);

  const overlay = d.querySelector('[data-hesabno-delete-confirm]');
  assert.ok(overlay, 'با زدن سطل زباله باید دیالوگ تأیید باز شود');
  const dialog = overlay.querySelector('[role="dialog"]');
  assert.ok(dialog, 'دیالوگ باید role=dialog داشته باشد');
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.match(overlay.className, /\bfixed\b/, 'لایهٔ دیالوگ باید fixed باشد');
  assert.match(overlay.className, /\binset-0\b/, 'لایهٔ دیالوگ باید تمام صفحه را بپوشاند');
  assert.match(overlay.className, /\bitems-center\b/, 'دیالوگ باید عمودی وسط باشد');
  assert.match(overlay.className, /\bjustify-center\b/, 'دیالوگ باید افقی وسط باشد');
  assert.equal(overlay.closest('header'), null, 'دیالوگ نباید داخل هدر (کنار دکمه) رندر شود');
  assert.ok(Number(overlay.style.zIndex) > 1000, 'دیالوگ باید بالای بقیهٔ لایه‌ها باشد');

  const overlayText = normalize(overlay.textContent);
  assert.ok(overlayText.includes('حذف سند شماره #۱'), `عنوان دیالوگ باید شمارهٔ سند را بگوید: ${overlayText}`);
  assert.ok(overlayText.includes('خرید نان'), 'عنوان سند باید در دیالوگ دیده شود');
  assert.ok(overlayText.includes('بله، حذف شود'));
  assert.ok(overlayText.includes('بازگشت به فرم'));

  /* تا وقتی تأیید نشده، هیچ سندی نباید حذف شود. */
  const before = JSON.parse(window.localStorage.getItem('hesabno:transactions') || '[]');
  assert.equal(before.length, 2);
  click([...overlay.querySelectorAll('button')].find((button) => normalize(button.textContent) === 'بازگشت به فرم'));
  await wait(500);
  assert.equal(!!d.querySelector('[data-hesabno-delete-confirm]'), false, 'با «بازگشت به فرم» دیالوگ باید بسته شود');
  assert.equal(JSON.parse(window.localStorage.getItem('hesabno:transactions') || '[]').length, 2, 'انصراف نباید سندی را حذف کند');
  assert.ok(d.querySelector('main form'), 'فرم ویرایش باید باز بماند');

  click(d.querySelector('main header [title="حذف کامل سند"]'));
  await wait(500);
  click([...d.querySelectorAll('[data-hesabno-delete-confirm] button')].find((button) => normalize(button.textContent) === 'بله، حذف شود'));
  await wait(900);

  assert.equal(!!d.querySelector('[data-hesabno-delete-confirm]'), false, 'پس از تأیید، دیالوگ باید بسته شود');
  const after = JSON.parse(window.localStorage.getItem('hesabno:transactions') || '[]');
  assert.equal(after.length, 1, 'فقط سند تأییدشده باید حذف شود');
  assert.equal(after[0].id, 9002, 'سند شمارهٔ ۱ باید حذف شده و سند ۲ مانده باشد');
  assert.equal(typeof window.__hesabnoUndoTransaction, 'function', 'بازگردانی حذف (Undo) باید در دسترس بماند');
});
