/*
 * تقویم انتخاب تاریخ باید یک «شیت پایین» باشد با پس‌زمینه‌ی محو (blur)، نه یک بخش
 * درون جریان فرم که گزینه‌های زیرش جابه‌جا شوند.
 *
 * باگ گزارش‌شده: هنگام باز شدن تقویم، بخشی از گزینه‌های فرم از زیر آن بیرون می‌آمد.
 * این آزمون باز شدن تقویم از فرم «ثبت سند هزینه» را بررسی می‌کند:
 *   • لایه‌ی تقویم position:fixed و چسبیده به پایین است،
 *   • پس‌زمینه‌ی آن blur واقعی دارد،
 *   • خود شیت پس‌زمینه‌ی مات و گردی بالای ۲۴px دارد،
 *   • باز شدن تقویم فرم را از DOM حذف/جابه‌جا نمی‌کند،
 *   • انتخاب روز و کلیک روی پس‌زمینه تقویم را می‌بندد.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { bootApp, closeApp, buttonByText, wait, normalize } = require('./helpers/app-boot.cjs');

let hasJsdom = true;
try {
  require('jsdom');
} catch (error) {
  hasJsdom = false;
}

function openTransactionForm(window) {
  const document = window.document;
  const payButton = buttonByText(document, 'پرداخت');
  assert.ok(payButton, 'دکمه‌ی «پرداخت» در داشبورد باید وجود داشته باشد');
  payButton.click();
  return wait(700);
}

function openDatePicker(window) {
  const document = window.document;
  const field = document.querySelector('#tx-date-input-container');
  assert.ok(field, 'فیلد تاریخ فرم باید وجود داشته باشد');
  field.click();
  return wait(450);
}

test('date picker is a bottom sheet with a blurred scrim', { timeout: 90000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');

  const dom = await bootApp();
  t.after(() => closeApp(dom));
  const { window } = dom;
  const document = window.document;

  await openTransactionForm(window);
  assert.ok(document.querySelector('#tx-date-input'), 'فرم تراکنش باید باز شده باشد');

  await openDatePicker(window);
  const backdrop = document.querySelector('#persian-datepicker-backdrop');
  const sheet = document.querySelector('#persian-datepicker-sheet');
  assert.ok(backdrop, 'لایه‌ی تقویم باید باز شود');
  assert.ok(sheet, 'شیت تقویم باید رندر شود');
  assert.equal(backdrop.getAttribute('data-hesabno-transaction-datepicker'), 'true', 'لایهٔ تقویم باید marker پایدار برای Back داشته باشد');
  assert.equal(backdrop.parentElement, document.body, 'تقویم باید خارج از فرم به body پورتال شود تا overflow یا transform فرم آن را جابه‌جا/بُرش ندهد');

  /* لایه: تمام‌صفحه، ثابت و چسبیده به پایین */
  assert.equal(backdrop.style.position, 'fixed', 'لایه باید fixed باشد تا با اسکرول فرم جابه‌جا نشود');
  assert.equal(backdrop.style.top, '0px');
  assert.equal(backdrop.style.bottom, '0px');
  assert.equal(backdrop.style.alignItems, 'flex-end', 'شیت باید به پایین صفحه بچسبد');
  assert.equal(backdrop.style.justifyContent, 'center');
  assert.equal(backdrop.style.zIndex, '60');

  /* پس‌زمینه‌ی محو */
  const blur = backdrop.style.backdropFilter || backdrop.style.webkitBackdropFilter || '';
  assert.match(blur, /blur\(\d+(\.\d+)?px\)/, 'پس‌زمینه‌ی تقویم باید blur داشته باشد');
  const blurPx = Number((blur.match(/blur\((\d+)/) || [])[1] || 0);
  assert.ok(blurPx >= 12, `blur باید محسوس باشد (حداقل ۱۲px)، اما ${blurPx}px است`);
  assert.match(backdrop.style.background, /rgba?\(/, 'لایه باید تیره باشد');

  /* شیت: مات، پایین‌چسب، با گوشه‌های بالایی گرد */
  assert.equal(sheet.style.background, 'rgb(22, 26, 35)', 'شیت باید پس‌زمینه‌ی مات داشته باشد (کلاس bg-[#161a23] در CSS تولید نمی‌شد)');
  assert.equal(sheet.style.borderTopLeftRadius, '24px');
  assert.equal(sheet.style.borderBottomLeftRadius, '0', 'گوشه‌های پایین شیت باید صاف باشند');
  assert.equal(sheet.style.maxHeight, '86vh');
  assert.equal(sheet.style.overflowY, 'auto', 'محتوای بلند تقویم باید داخل خودش اسکرول شود');
  assert.equal(sheet.getAttribute('role'), 'dialog');
  assert.equal(sheet.getAttribute('aria-modal'), 'true');
  assert.equal(sheet.parentElement, backdrop, 'شیت باید فرزند مستقیم لایه باشد');

  const handle = sheet.firstElementChild;
  assert.ok(handle && /rounded-full/.test(handle.className), 'دسته‌ی کشیدن شیت باید وجود داشته باشد');
  assert.equal(/sm:hidden/.test(handle.className), false, 'دسته فقط در موبایل پنهان نمی‌شود؛ شیت در همه اندازه‌ها از پایین باز می‌شود');

  const dateBeforeBack = document.querySelector('#tx-date-input').value;
  assert.equal(window.__hesabnoCloseTopLayer(), true, 'اولین Back باید فقط لایهٔ تقویم را ببندد');
  await wait(250);
  assert.equal(document.querySelector('#persian-datepicker-backdrop'), null, 'Back باید همان picker را ببندد');
  assert.equal(document.querySelector('#tx-date-input').value, dateBeforeBack, 'Back نباید مقدار تاریخ را تغییر دهد');
  assert.ok(document.querySelector('#tx-date-input-container'), 'فرم زیرین باید پس از Back باز بماند');

  await openDatePicker(window);
  const closeSheet = document.querySelector('#persian-datepicker-sheet');
  const dateBeforeDismiss = normalize(document.querySelector('#tx-date-input-container').textContent);
  const closeButton = closeSheet && closeSheet.querySelector('#datepicker-close-button');
  assert.ok(closeButton, 'تقویم باید دکمهٔ × برای بستن داشته باشد');
  assert.equal(normalize(closeButton.textContent), '×');
  assert.equal(closeButton.getAttribute('aria-label'), 'بستن تقویم');
  assert.equal(closeButton.getAttribute('data-hesabno-date-picker-close'), 'true', 'دکمهٔ × باید marker پایدار برای Back داشته باشد');
  closeButton.click();
  await wait(250);
  assert.equal(document.querySelector('#persian-datepicker-backdrop'), null, 'دکمهٔ × باید تقویم را ببندد');
  assert.equal(normalize(document.querySelector('#tx-date-input-container').textContent), dateBeforeDismiss, 'بستن با × نباید تاریخ را تغییر دهد');

  /* تقویم نباید فرم را از جریان خارج یا جابه‌جا کند */
  assert.ok(document.querySelector('#tx-date-input-container'), 'فیلد تاریخ باید سر جایش بماند');
  assert.equal(document.querySelectorAll('#tx-date-input-container').length, 1, 'فیلد تاریخ نباید تکرار شود');

  /* انتخاب روز: تقویم بسته می‌شود و مقدار فیلد عوض می‌شود */
  await openDatePicker(window);
  const selectionSheet = document.querySelector('#persian-datepicker-sheet');
  assert.ok(selectionSheet, 'تقویم باید پس از بستن با × دوباره باز شود');
  const dayButtons = [...selectionSheet.querySelectorAll('button')].filter((button) => /^[۰-۹]{1,2}$/.test(normalize(button.textContent)));
  const target = dayButtons.find((button) => normalize(button.textContent) === '۱۰') || dayButtons[9];
  assert.ok(target, 'دکمه‌ی روز باید در تقویم باشد');
  target.click();
  await wait(350);
  assert.equal(document.querySelector('#persian-datepicker-backdrop'), null, 'با انتخاب روز تقویم باید بسته شود');
  assert.match(normalize(document.querySelector('#tx-date-input-container').textContent), /۱۰/, 'تاریخ انتخاب‌شده باید در فیلد دیده شود');

  /* تم روشن: شیت باید پس‌زمینه‌ی روشن بگیرد (رنگ ثابت تیره نباید در تم روشن بماند) */
  document.documentElement.setAttribute('data-theme', 'light');
  await openDatePicker(window);
  const lightSheet = document.querySelector('#persian-datepicker-sheet');
  assert.ok(lightSheet, 'تقویم باید در تم روشن هم باز شود');
  assert.equal(lightSheet.style.background, 'rgb(238, 243, 246)', 'تم روشن باید پس‌زمینه‌ی روشن بگیرد');

  /* بستن با کلیک روی پس‌زمینه */
  const reopened = document.querySelector('#persian-datepicker-backdrop');
  reopened.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  await wait(250);
  assert.equal(document.querySelector('#persian-datepicker-backdrop'), null, 'کلیک روی پس‌زمینه باید تقویم را ببندد');
  document.documentElement.setAttribute('data-theme', 'dark');
});
