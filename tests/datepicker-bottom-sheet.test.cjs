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
 *   • دکمهٔ بستن و روزهای ماه در شیت موجودند،
 *   • Back فقط تقویم را می‌بندد و تاریخ/فرم زیرین را تغییر نمی‌دهد.
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

function clickRendered(window, element) {
  if (!element) return;
  const propsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'));
  const handler = propsKey && element[propsKey].onClick;
  if (handler) handler({ target: element, currentTarget: element, preventDefault() {}, stopPropagation() {} });
  else element.click();
}

function openTransactionForm(window) {
  const document = window.document;
  const payButton = buttonByText(document, 'پرداخت');
  assert.ok(payButton, 'دکمه‌ی «پرداخت» در داشبورد باید وجود داشته باشد');
  clickRendered(window, payButton);
  return wait(700);
}

function openDatePicker(window) {
  const document = window.document;
  const field = document.querySelector('#tx-date-input-container');
  assert.ok(field, 'فیلد تاریخ فرم باید وجود داشته باشد');
  clickRendered(window, field);
  return wait(450);
}

test('date picker is a bottom sheet with a blurred scrim', { timeout: 90000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');

  const bootOptions = {
    storage: {
      'hesabno:first_run_profile_done': '1',
      'hesabno:first_run_intro_done': '1',
    },
  };
  let dom = await bootApp(bootOptions);
  let window = dom.window;
  let document = window.document;
  t.after(() => closeApp(dom));
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
  assert.equal(backdrop.style.bottom, '0px', 'fixed inset باید تنها مرجع موقعیت عمودی لایه باشد');
  assert.equal(backdrop.style.height, '', 'ارتفاع صریح نباید با top/bottom هم‌زمان اعمال شود');
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
  assert.equal(sheet.style.maxHeight, `${Math.floor(window.innerHeight * 0.86)}px`, 'ارتفاع بیشینه‌ی شیت باید متناسب با viewport باشد');
  assert.equal(sheet.style.overflowY, 'auto', 'محتوای بلند تقویم باید داخل خودش اسکرول شود');
  assert.equal(sheet.getAttribute('role'), 'dialog');
  assert.equal(sheet.getAttribute('aria-modal'), 'true');
  assert.equal(sheet.parentElement, backdrop, 'شیت باید فرزند مستقیم لایه باشد');

  const handle = sheet.firstElementChild;
  assert.ok(handle && /rounded-full/.test(handle.className), 'دسته‌ی کشیدن شیت باید وجود داشته باشد');
  assert.equal(/sm:hidden/.test(handle.className), false, 'دسته فقط در موبایل پنهان نمی‌شود؛ شیت در همه اندازه‌ها از پایین باز می‌شود');

  const dateBeforeBack = document.querySelector('#tx-date-input').value;
  const closeButton = sheet.querySelector('#datepicker-close-button');
  assert.ok(closeButton, 'تقویم باید دکمهٔ × برای بستن داشته باشد');
  assert.equal(normalize(closeButton.textContent), '×');
  assert.equal(closeButton.getAttribute('aria-label'), 'بستن تقویم');
  assert.equal(closeButton.getAttribute('data-hesabno-date-picker-close'), 'true', 'دکمهٔ × باید marker پایدار برای Back داشته باشد');
  const dayButtons = [...sheet.querySelectorAll('button')]
    .filter((button) => /^[۰-۹]{1,2}$/.test(normalize(button.textContent)));
  assert.ok(dayButtons.length >= 28, 'روزهای ماه باید در شیت تقویم رندر شوند');

  /* Back باید فقط همان لایه را ببندد و فرم/تاریخ زیرین را دست‌نخورده بگذارد. */
  const backCloseButton = backdrop.querySelector('[data-hesabno-date-picker-close="true"]');
  assert.ok(backCloseButton, 'دکمهٔ بستن مخصوص تقویم باید وجود داشته باشد');
  // jsdom's HTMLElement.click does not consistently reach delegated React handlers.
  backCloseButton.click = () => clickRendered(window, backCloseButton);
  assert.equal(window.__hesabnoCloseTopLayer(), true, 'اولین Back باید فقط لایهٔ تقویم را ببندد');
  await wait(250);
  assert.equal(document.querySelector('#persian-datepicker-backdrop'), null, 'Back باید همان picker را ببندد');
  assert.equal(document.querySelector('#tx-date-input').value, dateBeforeBack, 'Back نباید مقدار تاریخ را تغییر دهد');
  assert.ok(document.querySelector('#tx-date-input-container'), 'فرم زیرین باید پس از Back باز بماند');
});

test('× closes the transaction calendar through the animated close path', { timeout: 90000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({ storage: {
    'hesabno:first_run_profile_done': '1',
    'hesabno:first_run_intro_done': '1',
  } });
  t.after(() => closeApp(dom));
  const { window } = dom;
  await openTransactionForm(window);
  await openDatePicker(window);
  const sheet = window.document.querySelector('#persian-datepicker-sheet');
  assert.ok(sheet);
  const closeButton = sheet.querySelector('[aria-label="بستن تقویم"]');
  assert.ok(closeButton);
  clickRendered(window, closeButton);
  assert.ok(sheet.classList.contains('hesabno-single-date-sheet-closing'), 'کلاس خروج باید پیش از حذف اضافه شود');
  await wait(360);
  assert.equal(window.document.querySelector('#persian-datepicker-backdrop'), null, 'بعد از حرکت، overlay باید حذف شود');
  assert.ok(window.document.querySelector('#tx-date-input-container'), 'فرم تراکنش باید باز بماند');
});

test('touching the transaction calendar backdrop closes it without selecting a date', { timeout: 90000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({ storage: {
    'hesabno:first_run_profile_done': '1',
    'hesabno:first_run_intro_done': '1',
  } });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;
  await openTransactionForm(window);
  await openDatePicker(window);
  const valueBefore = document.querySelector('#tx-date-input').value;
  const backdrop = document.querySelector('#persian-datepicker-backdrop');
  assert.ok(backdrop);
  clickRendered(window, backdrop);
  await wait(360);
  assert.equal(document.querySelector('#persian-datepicker-backdrop'), null);
  assert.equal(document.querySelector('#tx-date-input').value, valueBefore, 'لمس بیرون نباید تاریخ را عوض کند');
});

test('repeated transaction calendar open/close cycles do not stack overlays or close listeners', { timeout: 90000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({ storage: {
    'hesabno:first_run_profile_done': '1',
    'hesabno:first_run_intro_done': '1',
  } });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;
  await openTransactionForm(window);
  const field = document.querySelector('#tx-date-input-container');
  for (let cycle = 0; cycle < 3; cycle += 1) {
    clickRendered(window, field);
    await wait(350);
    const backdrop = document.querySelector('#persian-datepicker-backdrop');
    assert.ok(backdrop, `تقویم باید در چرخهٔ ${cycle + 1} باز شود`);
    assert.equal(document.querySelectorAll('[data-hesabno-transaction-datepicker="true"]').length, 1);
    clickRendered(window, backdrop.querySelector('[aria-label="بستن تقویم"]'));
    await wait(360);
    assert.equal(document.querySelector('#persian-datepicker-backdrop'), null, `چرخهٔ ${cycle + 1} باید کامل بسته شود`);
  }
});

test('loan receive-date and first-installment-date controls open the shared picker and update only the clicked field', { timeout: 120000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({ storage: {
    'hesabno:first_run_profile_done': 'true',
    'hesabno:first_run_intro_done': 'true',
  } });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;
  const navMore = [...document.querySelectorAll('nav.fixed button')]
    .find((button) => normalize(button.textContent) === 'بیشتر');
  assert.ok(navMore);
  clickRendered(window, navMore);
  await wait(900);
  const loansButton = [...document.querySelectorAll('button')]
    .find((button) => /وام‌ها|مدیریت وام/.test(normalize(button.textContent)));
  assert.ok(loansButton);
  clickRendered(window, loansButton);
  await wait(1000);
  const addButton = [...document.querySelectorAll('button')]
    .find((button) => normalize(button.textContent) === 'ثبت وام جدید');
  assert.ok(addButton);
  clickRendered(window, addButton);
  await wait(1000);

  const dateFields = [
    document.querySelector('#loan-receive-date-container'),
    document.querySelector('#loan-first-installment-date-container'),
  ];
  assert.ok(dateFields.every(Boolean), 'فرم وام باید فیلدهای یکتای تاریخ دریافت و تاریخ اولین قسط داشته باشد');
  assert.equal(document.querySelectorAll('[id="loan-receive-date-container"]').length, 1);
  assert.equal(document.querySelectorAll('[id="loan-first-installment-date-container"]').length, 1);
  for (const field of dateFields) {
    const before = normalize(field.textContent);
    clickRendered(window, field);
    await wait(350);
    const backdrop = document.querySelector('#persian-datepicker-backdrop');
    assert.ok(backdrop, 'هر تاریخ فرم وام باید از همان DatePicker باز شود');
    assert.equal(backdrop.parentElement, document.body, 'overlay پورتال‌شده باید بیرون از modal باشد');
    const day = [...backdrop.querySelectorAll('.grid-cols-7.gap-y-2 button')]
      .find((button) => !button.disabled && !/bg-blue-600/.test(button.className));
    assert.ok(day, 'حداقل یک روز قابل انتخاب و متفاوت از تاریخ جاری باید وجود داشته باشد');
    clickRendered(window, day);
    await wait(360);
    assert.equal(document.querySelector('#persian-datepicker-backdrop'), null);
    assert.notEqual(normalize(field.textContent), before, 'تاریخ باید فقط در همان کنترل انتخاب‌شده منعکس شود');
  }
});

test('installment-payment date portal is visible above its modal and writes back to its own field', { timeout: 120000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const loan = {
    id: 'calendar-loan-1', type: 'bank_loan', name: 'وام آزمون تقویم', amount: 5000000,
    receiveDate: '1405/07/01', installmentsCount: 1, installmentAmount: 5000000,
    status: 'active', destinationAccount: 'حساب اصلی',
  };
  const installment = {
    id: 'calendar-installment-1', loanId: loan.id, loanName: loan.name,
    installmentNumber: 1, totalInstallments: 1, amount: 5000000,
    dueDate: '1405/08/01', status: 'pending',
  };
  const dom = await bootApp({ storage: {
    'hesabno:first_run_profile_done': 'true',
    'hesabno:first_run_intro_done': 'true',
    'hesabno:loans': JSON.stringify([loan]),
    'hesabno:installments': JSON.stringify([installment]),
  } });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;
  const navMore = [...document.querySelectorAll('nav.fixed button')]
    .find((button) => normalize(button.textContent) === 'بیشتر');
  assert.ok(navMore);
  clickRendered(window, navMore);
  await wait(900);
  const loansButton = [...document.querySelectorAll('button')]
    .find((button) => /وام‌ها|مدیریت وام/.test(normalize(button.textContent)));
  assert.ok(loansButton);
  clickRendered(window, loansButton);
  await wait(1100);
  const pay = [...document.querySelectorAll('button')]
    .find((button) => normalize(button.textContent) === 'پرداخت');
  assert.ok(pay, 'قسط آزمایشی باید دکمهٔ پرداخت داشته باشد');
  clickRendered(window, pay);
  await wait(500);
  const paymentDate = document.querySelector('#loan-installment-payment-date');
  assert.ok(paymentDate, 'کنترل تاریخ پرداخت قسط باید با DatePicker مشترک ساخته شود');
  const dateContainer = document.querySelector('#loan-installment-payment-date-container');
  assert.ok(dateContainer);
  const before = normalize(dateContainer.textContent);
  clickRendered(window, dateContainer);
  await wait(350);
  const backdrop = document.querySelector('#persian-datepicker-backdrop');
  assert.ok(backdrop, 'تقویم تاریخ پرداخت قسط باید باز شود');
  assert.equal(backdrop.parentElement, document.body, 'overlay از modal به body پورتال می‌شود');
  const paymentStyle = document.querySelector('style[data-hesabno-payment-date-style]');
  assert.match(paymentStyle.textContent, /\[data-hesabno-transaction-datepicker="true"\]\{z-index:70!important\}/,
    'قانون z-index باید با marker پورتال مطابقت داشته باشد');
  const day = [...backdrop.querySelectorAll('.grid-cols-7.gap-y-2 button')]
    .find((button) => !button.disabled && !/bg-blue-600/.test(button.className));
  assert.ok(day);
  clickRendered(window, day);
  await wait(360);
  assert.equal(document.querySelector('#persian-datepicker-backdrop'), null);
  assert.notEqual(normalize(dateContainer.textContent), before, 'تاریخ پرداخت باید به فیلد همان قسط برگردد');
});

test('selecting a day in the transaction calendar updates the transaction date field', { timeout: 90000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({ storage: {
    'hesabno:first_run_profile_done': '1',
    'hesabno:first_run_intro_done': '1',
  } });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;
  await openTransactionForm(window);
  const dateField = document.querySelector('#tx-date-input');
  const before = dateField.value;
  await openDatePicker(window);
  const backdrop = document.querySelector('#persian-datepicker-backdrop');
  const day = [...backdrop.querySelectorAll('.grid-cols-7.gap-y-2 button')]
    .find((button) => !button.disabled && !/bg-blue-600/.test(button.className));
  assert.ok(day, 'باید روزی متفاوت و قابل انتخاب وجود داشته باشد');
  clickRendered(window, day);
  await wait(360);
  assert.equal(document.querySelector('#persian-datepicker-backdrop'), null, 'انتخاب روز باید تقویم را ببندد');
  assert.notEqual(dateField.value, before, 'تاریخ انتخابی باید در فیلد تراکنش منعکس شود');
});
