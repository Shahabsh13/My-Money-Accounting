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
 *   • انتخاب روز فقط تاریخ موقت را عوض می‌کند و تأیید آن را ثبت می‌کند،
 *   • لمس پس‌زمینه یا Escape تقویم را نمی‌بندد و فقط تأیید/ضربدر آن را می‌بندند.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
  const keypad = document.getElementById('hesabno-amount-keyboard');
  if (keypad && !keypad.hidden) keypad.querySelector('[data-hkap-action="close"]').click();
  const field = document.querySelector('#tx-date-input-container');
  assert.ok(field, 'فیلد تاریخ فرم باید وجود داشته باشد');
  field.click();
  return wait(450);
}

test('date picker CSS overrides the app-wide full-screen blur opt-out', () => {
  const css = fs.readFileSync(path.join(__dirname, '..',
    'app/src/main/assets/src/styles/235-hesabno-text-root-and-display-stability.css'), 'utf8');
  assert.match(css, /html body #persian-datepicker-backdrop,[\s\S]*?html body #hesabno-return-datepicker-backdrop/,
    'هر سه تقویم باید از استثنای اختصاصی blur استفاده کنند');
  assert.match(css, /#hesabno-return-datepicker-backdrop \{[\s\S]*?background:\s*rgba\(2, 6, 23, \.36\) !important;[\s\S]*?-webkit-backdrop-filter:\s*blur\(16px\) saturate\(120%\) !important;[\s\S]*?backdrop-filter:\s*blur\(16px\) saturate\(120%\) !important;/,
    'استثنای تقویم باید قانون عمومیِ none!important را شکست دهد');
  assert.match(css, /html\[data-theme="light"\] body #persian-datepicker-backdrop,[\s\S]*?background:\s*rgba\(15, 23, 42, \.42\) !important;/,
    'در تم روشن هم پرده باید سطح سفید را به‌وضوح تیره کند، نه اینکه تقریباً سفید بماند');
});

test('date picker is a bottom sheet with a blurred scrim', { timeout: 180000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');

  const dom = await bootApp({ storage: { 'hesabno:first_run_profile_done': '1' } });
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
  assert.equal(backdrop.parentElement, document.body,
    'تقویم باید با React portal بیرون از درخت transform‌شدهٔ فرم و مستقیم زیر body رندر شود');

  /* لایه: تمام‌صفحه، ثابت و چسبیده به پایین */
  assert.equal(backdrop.style.position, 'fixed', 'لایه باید fixed باشد تا با اسکرول فرم جابه‌جا نشود');
  assert.equal(backdrop.style.top, '0px');
  assert.equal(backdrop.style.bottom, '0px');
  assert.equal(backdrop.style.alignItems, 'flex-end', 'شیت باید به پایین صفحه بچسبد');
  assert.equal(backdrop.style.justifyContent, 'center');
  assert.equal(sheet.style.position, 'fixed', 'خود تقویم هم باید مستقل از flex به viewport متصل باشد');
  assert.equal(sheet.style.bottom, '0px', 'لبهٔ پایین تقویم باید مستقیماً به پایین viewport بچسبد');
  assert.equal(sheet.style.left, '0px', 'شیت باید به لبهٔ چپ viewport متصل باشد');
  assert.equal(sheet.style.right, '0px', 'شیت باید به لبهٔ راست viewport متصل باشد');
  assert.equal(sheet.style.marginLeft, 'auto', 'عرض محدود شیت باید در viewport افقی وسط‌چین شود');
  assert.equal(sheet.style.marginRight, 'auto', 'عرض محدود شیت باید در viewport افقی وسط‌چین شود');
  assert.equal(backdrop.style.zIndex, '2147483000', 'لایهٔ تقویم باید روی دکمهٔ ثبت فرم قرار بگیرد');

  /* پس‌زمینه‌ی محو */
  const blur = backdrop.style.backdropFilter || backdrop.style.webkitBackdropFilter || '';
  assert.match(blur, /blur\(\d+(\.\d+)?px\)/, 'پس‌زمینه‌ی تقویم باید blur داشته باشد');
  const blurPx = Number((blur.match(/blur\((\d+)/) || [])[1] || 0);
  assert.ok(blurPx >= 12, `blur باید محسوس باشد (حداقل ۱۲px)، اما ${blurPx}px است`);
  assert.equal(backdrop.style.background, 'rgba(2, 6, 23, 0.36)',
    'لایه باید نیمه‌شفاف باشد تا صفحهٔ محوشدهٔ زیر آن دیده شود');

  /* شیت: مات، پایین‌چسب، با گوشه‌های بالایی گرد */
  assert.equal(sheet.style.background, 'rgb(22, 26, 35)', 'شیت باید پس‌زمینه‌ی مات داشته باشد (کلاس bg-[#161a23] در CSS تولید نمی‌شد)');
  assert.equal(sheet.style.borderTopLeftRadius, '24px');
  assert.equal(sheet.style.borderBottomLeftRadius, '0', 'گوشه‌های پایین شیت باید صاف باشند');
  assert.equal(sheet.style.maxHeight, '86vh');
  assert.equal(sheet.style.height, '86vh', 'ارتفاع شیت باید برای ایجاد فضای خالی بالای تقویم حفظ شود');
  assert.equal(sheet.style.display, 'flex', 'شیت باید برای جداکردن ناحیهٔ روزها از نوار تأیید از flex استفاده کند');
  assert.equal(sheet.style.flexDirection, 'column');
  assert.equal(sheet.style.overflow, 'hidden', 'اسکرول باید به محتوای تقویم محدود بماند');
  const calendarBody = sheet.children[2];
  assert.equal(calendarBody.style.flex, '0 1 auto', 'ناحیهٔ تاریخ باید فقط به اندازهٔ محتوایش باشد تا سربرگ همراه آن پایین بیاید');
  assert.equal(calendarBody.style.overflowY, 'auto', 'محتوای بلند تقویم باید مستقل از نوار تأیید اسکرول شود');
  assert.equal(calendarBody.style.display, 'flex');
  assert.equal(calendarBody.style.flexDirection, 'column');
  assert.equal(calendarBody.style.paddingBottom, '0px', 'پایین‌ترین ردیف تاریخ باید به لبهٔ داخلی کادر برسد');
  assert.equal(calendarBody.children[0].style.flex, '0 0 auto', 'نام روزهای هفته هم باید همراه تاریخ‌ها پایین بماند');
  assert.equal(calendarBody.children[0].style.marginTop, 'auto', 'فضای خالی باید بالای کل تقویم بماند');
  assert.equal(calendarBody.children[1].style.flex, '0 0 auto', 'ردیف‌های تاریخ نباید هنگام چیدمان جمع شوند');
  assert.equal(sheet.getAttribute('role'), 'dialog');
  assert.equal(sheet.getAttribute('aria-modal'), 'true');
  assert.equal(sheet.parentElement, backdrop, 'شیت باید فرزند مستقیم لایه باشد');
  assert.ok(sheet.querySelector('#datepicker-close-button[aria-label="بستن تقویم"]'), 'ضربدر بستن باید در سرِ شیت باشد');
  const confirmButton = sheet.querySelector('#datepicker-confirm-button');
  assert.ok(confirmButton, 'دکمهٔ تأیید باید پایین تقویم باشد');
  const confirmFooter = confirmButton.parentElement;
  assert.equal(confirmFooter.style.flex, '0 0 auto', 'ردیف تأیید نباید با کوچک‌شدن پنل جمع شود');
  assert.equal(confirmFooter.style.marginTop, '', 'فضای خالی باید بالای دستهٔ شیت باشد، نه بین تاریخ‌ها و تأیید');
  assert.equal(sheet.lastElementChild, confirmFooter, 'ردیف تأیید باید آخرین بخش شیت باقی بماند');
  assert.match(confirmFooter.style.paddingBottom, /calc\(4px \+ env\(/, 'فاصلهٔ پایین تأیید باید مثل کیبورد و فقط به‌اندازهٔ safe-area باشد');
  assert.equal(confirmFooter.style.background, 'rgb(22, 26, 35)', 'ردیف چسبیده باید زمینهٔ مات داشته باشد');

  const handle = sheet.firstElementChild;
  assert.ok(handle && /rounded-full/.test(handle.className), 'دسته‌ی کشیدن شیت باید وجود داشته باشد');
  assert.equal(handle.style.marginTop, 'auto', 'دسته و نوار ماه/سال باید همراه تاریخ‌ها به پایین منتقل شوند');
  assert.equal(/sm:hidden/.test(handle.className), false, 'دسته فقط در موبایل پنهان نمی‌شود؛ شیت در همه اندازه‌ها از پایین باز می‌شود');

  /* تقویم نباید فرم را از جریان خارج یا جابه‌جا کند */
  assert.ok(document.querySelector('#tx-date-input-container'), 'فیلد تاریخ باید سر جایش بماند');
  assert.equal(document.querySelectorAll('#tx-date-input-container').length, 1, 'فیلد تاریخ نباید تکرار شود');

  /* انتخاب روز فقط مقدار موقت را عوض می‌کند؛ تأیید، آن را ثبت و تقویم را می‌بندد. */
  const dayButtons = [...sheet.querySelectorAll('button')].filter((button) => /^[۰-۹]{1,2}$/.test(normalize(button.textContent)));
  const target = dayButtons.find((button) => !button.disabled && !button.classList.contains('bg-blue-600'))
    || dayButtons.find((button) => !button.disabled);
  assert.ok(target, 'یک دکمه‌ی روز قابل‌انتخاب باید در تقویم باشد');
  const selectedDay = normalize(target.textContent);
  const dateField = document.querySelector('#tx-date-input-container');
  const originalDateLabel = normalize(dateField.textContent);
  target.click();
  await wait(150);
  assert.ok(document.querySelector('#persian-datepicker-backdrop'), 'انتخاب روز نباید تقویم را ببندد');
  assert.equal(normalize(dateField.textContent), originalDateLabel, 'انتخاب روز پیش از تأیید نباید فرم را تغییر دهد');

  const backdropTap = document.querySelector('#persian-datepicker-backdrop');
  backdropTap.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(100);
  assert.ok(document.querySelector('#persian-datepicker-backdrop'), 'لمس بیرون یا Escape نباید تقویم را ببندد');

  document.querySelector('#datepicker-confirm-button').click();
  await wait(350);
  assert.equal(document.querySelector('#persian-datepicker-backdrop'), null, 'تأیید باید تقویم را ببندد');
  assert.match(normalize(dateField.textContent), new RegExp(selectedDay), 'تاریخ تأییدشده باید در فیلد دیده شود');

  /* تم روشن: شیت باید پس‌زمینه‌ی روشن بگیرد (رنگ ثابت تیره نباید در تم روشن بماند) */
  document.documentElement.setAttribute('data-theme', 'light');
  await openDatePicker(window);
  const lightSheet = document.querySelector('#persian-datepicker-sheet');
  assert.ok(lightSheet, 'تقویم باید در تم روشن هم باز شود');
  assert.equal(lightSheet.style.background, 'rgb(238, 243, 246)', 'تم روشن باید پس‌زمینه‌ی روشن بگیرد');

  /* ضربدر لغو می‌کند؛ لمس پس‌زمینه مجاز به بستن نیست و تاریخ قبلی را نگه می‌دارد. */
  const reopened = document.querySelector('#persian-datepicker-backdrop');
  const committedDateLabel = normalize(dateField.textContent);
  const secondDay = [...lightSheet.querySelectorAll('button')].find((button) =>
    /^[۰-۹]{1,2}$/.test(normalize(button.textContent)) && !button.disabled && !button.classList.contains('bg-blue-600'));
  assert.ok(secondDay, 'روز دیگری برای آزمایش لغو باید موجود باشد');
  secondDay.click();
  await wait(100);
  assert.equal(normalize(dateField.textContent), committedDateLabel, 'تغییر موقت باید تا تأیید در تقویم بماند');
  reopened.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  assert.ok(document.querySelector('#persian-datepicker-backdrop'), 'لمس scrim نباید تقویم را ببندد');
  lightSheet.querySelector('#datepicker-close-button').click();
  await wait(250);
  assert.equal(document.querySelector('#persian-datepicker-backdrop'), null, 'ضربدر باید تقویم را ببندد');
  assert.equal(normalize(dateField.textContent), committedDateLabel, 'ضربدر باید انتخاب موقت را لغو کند');
  document.documentElement.setAttribute('data-theme', 'dark');
});

test('dates outside the allowed range stay visibly disabled and cannot be selected by a synthetic click', { timeout: 90000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(tomorrow);
  const part = (type) => (parts.find((item) => item.type === type) || {}).value;
  const futureDate = `${part('year')}/${part('month')}/${part('day')}`;
  const futureDayLabel = new Intl.NumberFormat('fa-IR').format(Number(part('day')));
  const dom = await bootApp({
    seed: [{
      id: 781, documentNumber: 7, title: 'سند با تاریخ آینده', category: 'اجاره',
      amount: 100000, date: futureDate, time: '12:00', type: 'expense', method: 'normal',
      account: 'بانک ملت', destinationAccount: 'اجاره',
    }],
    storage: { 'hesabno:first_run_profile_done': '1', 'hesabno:first_run_intro_done': '1' },
    stubs: (window) => {
      window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    },
  });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;
  const click = (element) => element.dispatchEvent(new window.MouseEvent('click', {
    bubbles: true, cancelable: true, view: window,
  }));

  const transactionsTab = [...document.querySelectorAll('nav.fixed button')]
    .find((button) => normalize(button.textContent) === 'تراکنش‌ها');
  assert.ok(transactionsTab, 'تب تراکنش‌ها باید وجود داشته باشد');
  click(transactionsTab);
  await wait(1000);

  const card = document.querySelector('article[id^="tx-card-"]');
  assert.ok(card, 'سند آزمایشی باید در فهرست دیده شود');
  click(card.querySelector('div.cursor-pointer'));
  await wait(300);
  const edit = [...card.querySelectorAll('button')]
    .find((button) => normalize(button.textContent) === 'ویرایش');
  assert.ok(edit, 'سند باید قابل ویرایش باشد');
  click(edit);
  await wait(1400);

  const dateField = document.querySelector('#tx-date-input-container');
  assert.ok(dateField, 'فیلد تاریخ سند باید باز شده باشد');
  const keypad = document.getElementById('hesabno-amount-keyboard');
  if (keypad && !keypad.hidden) keypad.querySelector('[data-hkap-action="close"]').click();
  click(dateField);
  await wait(500);

  const sheet = document.querySelector('#persian-datepicker-sheet');
  assert.ok(sheet, 'تقویم انتخاب روز باید باز شود');
  const tomorrowButton = [...sheet.querySelectorAll('button')]
    .find((button) => normalize(button.textContent) === futureDayLabel);
  assert.ok(tomorrowButton, `روز آیندهٔ ${futureDayLabel} باید در تقویم باشد`);
  assert.equal(tomorrowButton.disabled, true, 'تاریخ آینده باید غیرفعال باشد');
  assert.match(tomorrowButton.className, /opacity-25.*cursor-not-allowed/,
    'روز غیرفعال باید در حالت روز هم از نظر ظاهری خاموش باشد');
  assert.doesNotMatch(tomorrowButton.className, /bg-blue-600|border-blue-400/,
    'روز ممنوع نباید ظاهر انتخاب‌شده و روشن بگیرد');

  const originalDateLabel = normalize(dateField.textContent);
  tomorrowButton.click();
  click(tomorrowButton); // تلاش برای دور زدن disabled با رویداد مصنوعی
  await wait(100);
  assert.equal(document.querySelector('#persian-datepicker-sheet'), sheet,
    'تلاش برای انتخاب روز ممنوع نباید تقویم را ببندد');
  assert.equal(normalize(dateField.textContent), originalDateLabel,
    'حتی رویداد مصنوعی هم نباید تاریخ ممنوع را روی سند ثبت کند');
});
