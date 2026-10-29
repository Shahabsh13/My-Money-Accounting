/*
 * قاعدهٔ ثابت: کد حساب هیچ‌جا به کاربر نشان داده نمی‌شود
 *
 * کاربر: «کد ریشه رو قرار بود از همه جا بردای و فقط تو دل حساب وجود داشته باشه»
 * و بعد روشن کرد: «اون حساب کد داره ولی فقط برای کاربر نمایش داده نشه».
 * یعنی کد شناسهٔ داخلی داده است و حتی داخل صورت‌حساب/جزئیات حساب هم نباید دیده شود.
 * این آزمون سه چیز را قفل می‌کند:
 *   ۱. هیچ لایه‌ای (جز بستهٔ اصلی ۰۶۷) برچسب «کد …» / «کد ریشه …» نمی‌سازد؛
 *      بقیهٔ برچسب‌های باقی‌مانده را فقط لایهٔ ۰۹۹ پنهان می‌کند.
 *   ۲. پنل «پرداخت جایگزین چک برگشتی» (۱۴۴) و انتخابگر حسابش هیچ کدی نشان نمی‌دهند.
 *   ۳. شمارش‌های «N سرفصل/حساب» و «تفصیلی N» پنهان نمی‌شوند، ولی «کد …» حتی داخل
 *      صورت‌حساب هم پنهان می‌ماند.
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

const FIRST_RUN_DONE = {
  'hesabno:first_run_profile_done': 'true',
  'hesabno:first_run_intro_done': 'true',
};

const scriptsDir = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'src', 'scripts');
/* ۰۶۷ بستهٔ اصلی است و برچسب‌هایش را ۰۹۹ پنهان می‌کند؛ ۰۹۹ خودش قاعده را در regex دارد */
const CODE_OWNER_LAYERS = new Set(['067-inline.js', '099-hesabno-hide-account-code-metadata.js']);

const isVisible = (window, node) => {
  for (let current = node; current; current = current.parentElement) {
    if (current.style && current.style.display === 'none') return false;
    if (window.getComputedStyle(current).display === 'none') return false;
  }
  return true;
};

const leafCodeNodes = (window, root) => [...root.querySelectorAll('p, span, div, li, small, strong, em, td, th, label')]
  .filter((node) => node.firstElementChild === null
    && /کد/.test(normalize(node.textContent))
    && isVisible(window, node));

const persianDateAt = (date) => {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type) => (parts.find((part) => part.type === type) || {}).value;
  return `${get('year')}/${get('month')}/${get('day')}`;
};
const persianToday = persianDateAt(new Date());
const persianPastDate = persianDateAt(new Date(Date.now() - 60 * 86400000));

test('هیچ لایه‌ای برچسب «کد» یا «کد ریشه» نمی‌سازد', () => {
  const offenders = [];
  fs.readdirSync(scriptsDir).filter((name) => name.endsWith('.js')).forEach((name) => {
    if (CODE_OWNER_LAYERS.has(name)) return;
    const source = fs.readFileSync(path.join(scriptsDir, name), 'utf8');
    if (source.includes('کد ریشه')) offenders.push(`${name}: «کد ریشه»`);
    if (/(["'`])کد \1\s*\+/.test(source)) offenders.push(`${name}: «کد » + code`);
  });
  assert.deepEqual(offenders, [], `برچسب کد باید فقط داخل حساب دیده شود؛ موارد بازمانده: ${offenders.join(' ، ')}`);
});

test('صفحهٔ حساب‌ها کد نشان نمی‌دهد ولی شمارش و «تفصیلی N» می‌ماند', { timeout: 90000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({ storage: FIRST_RUN_DONE });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;
  const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

  click([...document.querySelectorAll('nav.fixed button')].find((button) => normalize(button.textContent) === 'بیشتر'));
  await wait(900);
  click([...document.querySelectorAll('button')].find((button) => /^سرفصل حساب‌ها/.test(normalize(button.textContent))));
  await wait(1200);

  const main = document.querySelector('main');
  assert.ok(main, 'صفحهٔ حساب‌ها باید باز شود');
  assert.deepEqual(leafCodeNodes(window, main).map((node) => normalize(node.textContent)), [],
    'در فهرست حساب‌ها هیچ «کد …» نباید دیده شود');

  const hasDirectText = (node, pattern) => [...node.childNodes]
    .some((child) => child.nodeType === window.Node.TEXT_NODE && pattern.test(child.textContent));
  const count = [...main.querySelectorAll('p, span, div')]
    .find((node) => /^[\d۰-۹٠-٩]+\s+سرفصل\/حساب$/.test(normalize(node.textContent))
      && hasDirectText(node, /سرفصل\/حساب/));
  assert.ok(count, 'شمارش «N سرفصل/حساب» باید در صفحه بماند');
  assert.ok(isVisible(window, count), 'شمارش حساب‌ها نباید با پنهان‌کردن کدها پنهان شود');

  const detail = [...main.querySelectorAll('p, span')]
    .find((node) => /^تفصیلی [\d۰-۹٠-٩]+$/.test(normalize(node.textContent))
      && hasDirectText(node, /تفصیلی/)
      && isVisible(window, node));
  assert.ok(detail, 'برچسب «تفصیلی N» باید دیده شود');
});

test('لایهٔ ۰۹۹ کد را همه‌جا پنهان می‌کند، حتی داخل صورت‌حساب', { timeout: 90000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const accounts = [
    { id: 101, group: 'cash', code: '11001', name: 'صندوق اصلی', active: true, parentId: null },
    { id: 102, group: 'expense', code: '50101', name: 'خرید روزانه', active: true, parentId: 50 },
  ];
  const dom = await bootApp({ storage: { ...FIRST_RUN_DONE, 'hesabno:accounts_v5': JSON.stringify(accounts) } });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;
  await wait(600);

  const host = document.createElement('div');
  host.id = 'root-code-scope-probe';
  document.body.appendChild(host);
  const make = (tag, text, parent = host) => {
    const node = document.createElement(tag);
    node.textContent = text;
    parent.appendChild(node);
    return node;
  };

  const plainCode = make('p', 'کد 11001', host);
  const rootCode = make('span', 'کد ریشه: 110/120', host);
  const withDetails = make('p', 'کد 501 · ۳ حساب تفصیلی', host);
  const countLine = make('p', '۹۲ سرفصل/حساب', host);
  const codingLine = make('p', 'کدینگ سرفصل: 501', host);
  const statement = document.createElement('div');
  statement.className = 'hesabno-account-statement-panel';
  host.appendChild(statement);
  const insideCode = make('p', 'کد 11001', statement);
  const insideCoding = make('span', 'کد ریشه: 110', statement);

  /* نشان کدِ بدون برچسب (سرصفحهٔ صورت‌حساب/ردیف تراز): کدِ مونو کنار نام همان حساب */
  const header = document.createElement('div');
  header.className = 'flex items-center gap-2';
  host.appendChild(header);
  const badge = make('span', '11001', header);
  badge.className = 'text-[10px] font-mono bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded';
  const badgeName = make('h3', 'صندوق اصلی', header);

  /* مبلغ هم‌شماره با کد نباید با کد اشتباه گرفته شود (ستون عددی) */
  const amountRow = document.createElement('div');
  amountRow.className = 'flex items-center gap-2';
  host.appendChild(amountRow);
  const amount = make('span', '11001', amountRow);
  amount.className = 'text-xs font-bold font-mono tabular-nums';
  const amountName = make('span', 'صندوق اصلی', amountRow);

  await wait(500);
  assert.equal(plainCode.style.display, 'none', '«کد 11001» بیرون از حساب باید پنهان شود');
  assert.equal(rootCode.style.display, 'none', '«کد ریشه: 110/120» باید پنهان شود');
  assert.equal(normalize(withDetails.textContent), 'تفصیلی ۳', 'ردیف کد باید به «تفصیلی N» تبدیل شود');
  assert.notEqual(withDetails.style.display, 'none', '«تفصیلی N» باید دیده شود');
  assert.notEqual(countLine.style.display, 'none', 'شمارش «N سرفصل/حساب» نباید پنهان شود');
  assert.equal(codingLine.style.display, 'none', '«کدینگ سرفصل: 501» هم کد است و باید پنهان شود');
  assert.equal(insideCode.style.display, 'none', 'داخل صورت‌حساب هم کد حساب نباید به کاربر نشان داده شود');
  assert.equal(insideCoding.style.display, 'none', '«کد ریشه» داخل صورت‌حساب هم باید پنهان شود');
  assert.equal(badge.getAttribute('data-hesabno-subsidiary-account-code'), 'true',
    'نشان کدِ بدون برچسب کنار نام حساب باید پنهان شود');
  assert.equal(isVisible(window, badge), false, 'کد کنار نام حساب نباید دیده شود');
  assert.notEqual(amount.getAttribute('data-hesabno-subsidiary-account-code'), 'true',
    'مبلغ هم‌شماره با کد حساب نباید به‌عنوان کد پنهان شود');
  assert.equal(isVisible(window, amount), true, 'مبلغ باید دیده شود');
  assert.notEqual(badgeName.style.display, 'none', 'نام حساب نباید پنهان شود');
  assert.notEqual(amountName.style.display, 'none', 'نام حساب کنار مبلغ نباید پنهان شود');

  /* متن همان گره با رندر بعدی برنامه عوض می‌شود؛ کد جدید باید دوباره پنهان شود */
  plainCode.textContent = 'کد ۱۲۰۰۲';
  await wait(500);
  assert.equal(plainCode.style.display, 'none', 'تغییر متن به کد جدید باید دوباره پنهان شود');

  plainCode.textContent = 'توضیح آزاد';
  await wait(500);
  assert.notEqual(plainCode.style.display, 'none', 'گره‌ای که دیگر کد نیست باید دوباره دیده شود');

  host.remove();
});

test('پرداخت جایگزین چک برگشتی هیچ کد یا «کد ریشه» نشان نمی‌دهد', { timeout: 120000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const accounts = [
    { id: 101, group: 'cash', code: '11001', name: 'صندوق اصلی', active: true, pinned: true, picture: '💵' },
    { id: 103, group: 'bank', code: '12001', name: 'بانک سامان', active: true, pinned: false, picture: '🏦' },
  ];
  const seed = [{
    id: 2,
    type: 'expense',
    amount: 2500000,
    date: persianPastDate,
    title: 'چک پرداختی',
    account: 'بانک سامان',
    category: 'خرید',
    documentNumber: 2,
    check: { status: 'bounced', number: '123456', dueDate: persianToday },
  }];
  const dom = await bootApp({
    seed,
    storage: { ...FIRST_RUN_DONE, 'hesabno:accounts_v5': JSON.stringify(accounts) },
  });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;
  const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

  assert.equal(typeof window.__hesabnoOpenCheckPayment, 'function', 'دسترسی باز کردن پرداخت جایگزین باید وجود داشته باشد');
  const trigger = document.createElement('button');
  trigger.setAttribute('data-hesabno-return-next', '2');
  document.body.appendChild(trigger);
  window.__hesabnoOpenCheckPayment('2', trigger);
  await wait(900);

  const modal = document.querySelector('[data-hesabno-return-confirm]');
  assert.ok(modal, 'پنل پیگیری برگشت چک باید باز شود');
  assert.deepEqual(leafCodeNodes(window, modal).map((node) => normalize(node.textContent)), [],
    'پنل پرداخت جایگزین نباید هیچ «کد …» نشان دهد');

  const replacementChoice = modal.querySelector("[data-hesabno-return-choice='account']");
  assert.ok(replacementChoice, 'گزینهٔ «ثبت پرداخت جایگزین» باید وجود داشته باشد');
  click(replacementChoice);
  await wait(900);

  assert.equal(modal.querySelector('[data-hesabno-return-account-code]'), null,
    'حساب انتخاب‌شده نباید زیرنویس کد داشته باشد');
  const selectedLabel = modal.querySelector('[data-hesabno-return-account-name]');
  assert.ok(selectedLabel, 'نام حساب انتخاب‌شده باید نمایش داده شود');
  assert.equal(/کد/.test(normalize(selectedLabel.textContent)), false, 'نام حساب نباید کد داشته باشد');

  const paymentDateControl = modal.querySelector('[data-hesabno-return-payment-date-open]');
  assert.ok(paymentDateControl, 'انتخاب تاریخ پرداخت جایگزین باید در دسترس باشد');
  const paymentDateLabel = modal.querySelector('[data-hesabno-return-payment-date-label]');
  const originalPaymentDate = normalize(paymentDateLabel.textContent);
  click(paymentDateControl);
  let datePicker = document.querySelector('[data-hesabno-return-date-picker]');
  assert.ok(datePicker, 'تقویم پرداخت جایگزین باید باز شود');
  assert.equal(datePicker.style.zIndex, '2147483000', 'تقویم باید بالای دکمه‌های فرم نمایش داده شود');
  assert.equal(datePicker.style.position, 'fixed', 'لایهٔ تقویم باید تمام‌صفحه و ثابت باشد');
  assert.equal(datePicker.style.top, '0px');
  assert.equal(datePicker.style.bottom, '0px');
  assert.equal(datePicker.style.alignItems, 'flex-end', 'تقویم باید پایین صفحه بماند حتی بدون کلاس‌های CSS');
  assert.equal(datePicker.style.background, 'rgba(2, 6, 23, 0.36)',
    'صفحهٔ زیر تقویم باید از پشت لایهٔ نیمه‌شفاف و بلرشده دیده شود');
  assert.match(datePicker.style.backdropFilter || datePicker.style.webkitBackdropFilter || '', /blur\(16px\)/,
    'لایهٔ پشت تقویم باید صفحهٔ زیر را blur کند');
  assert.equal(datePicker.querySelector('#hesabno-return-datepicker-sheet').style.borderTopLeftRadius, '24px');
  assert.ok(datePicker.querySelector('[data-return-date-close]'), 'ضربدر بستن باید در بالای تقویم باشد');
  const confirmButton = datePicker.querySelector('[data-return-date-confirm]');
  assert.ok(confirmButton, 'تأیید باید پایین تقویم باشد');
  const confirmFooter = confirmButton.parentElement;
  const returnSheet = datePicker.querySelector('#hesabno-return-datepicker-sheet');
  assert.equal(returnSheet.style.height, '86vh', 'ارتفاع شیت باید برای ایجاد فضای خالی بالای تقویم حفظ شود');
  assert.equal(returnSheet.style.display, 'flex', 'شیت باید نوار تأیید را از ناحیهٔ روزها جدا کند');
  assert.equal(returnSheet.style.flexDirection, 'column');
  assert.equal(returnSheet.firstElementChild.style.marginTop, 'auto', 'دسته و سربرگ باید همراه تاریخ‌ها به پایین منتقل شوند');
  assert.equal(returnSheet.style.overflow, 'hidden');
  const dateCalendarBody = returnSheet.querySelector('[data-date-calendar]');
  assert.equal(dateCalendarBody.style.flex, '0 1 auto', 'ناحیهٔ تقویم نباید بین سربرگ و تاریخ‌ها کش بیاید');
  assert.equal(dateCalendarBody.style.overflowY, 'auto', 'روزها باید مستقل از نوار تأیید اسکرول شوند');
  const calendarCard = dateCalendarBody.firstElementChild;
  assert.equal(calendarCard.style.flex, '0 0 auto', 'کادر ماه باید پایین‌چین بماند');
  assert.equal(calendarCard.style.marginTop, 'auto', 'فضای خالی باید بالای کل تقویم بماند');
  assert.equal(calendarCard.style.paddingBottom, '0px', 'پایین‌ترین ردیف تاریخ باید به لبهٔ داخلی کادر برسد');
  assert.equal(confirmFooter.style.flex, '0 0 auto', 'ردیف تأیید نباید با کوچک‌شدن پنل جمع شود');
  assert.equal(confirmFooter.style.marginTop, '', 'فضای خالی باید بالای دستهٔ شیت باشد، نه بین تاریخ‌ها و تأیید');
  assert.equal(returnSheet.lastElementChild, confirmFooter, 'ردیف تأیید باید آخرین بخش شیت باقی بماند');
  assert.match(confirmFooter.style.paddingBottom, /calc\(4px \+ env\(/, 'فاصلهٔ پایین تأیید باید مثل کیبورد و فقط به‌اندازهٔ safe-area باشد');
  assert.equal(returnSheet.style.paddingBottom, '0px', 'فاصلهٔ قبلیِ زیر شیت نباید دکمهٔ تأیید را از کف بلند کند');
  let selectableDays = [...datePicker.querySelectorAll('[data-date-day]')].filter((button) => !button.disabled);
  if (selectableDays.length < 2) {
    click(datePicker.querySelector('[data-return-date-prev-month]'));
    await wait(100);
    selectableDays = [...datePicker.querySelectorAll('[data-date-day]')].filter((button) => !button.disabled);
  }
  const currentSelectedDay = datePicker.querySelector('[data-date-day].bg-blue-600');
  const candidateDay = selectableDays.find((button) => button !== currentSelectedDay);
  assert.ok(candidateDay, 'یک روز مجاز دیگر باید برای انتخاب موقت وجود داشته باشد');
  click(candidateDay);
  assert.equal(normalize(paymentDateLabel.textContent), originalPaymentDate,
    'انتخاب روز نباید پیش از زدن تأیید مقدار فرم را تغییر دهد');
  datePicker.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.ok(document.querySelector('[data-hesabno-return-date-picker]'), 'لمس پس‌زمینه یا Escape نباید تقویم را ببندد');
  click(datePicker.querySelector('[data-return-date-confirm]'));
  assert.equal(document.querySelector('[data-hesabno-return-date-picker]'), null, 'تأیید باید تقویم را ببندد');
  const confirmedPaymentDate = normalize(paymentDateLabel.textContent);
  assert.notEqual(confirmedPaymentDate, originalPaymentDate, 'تأیید باید روز انتخاب‌شده را در فرم ثبت کند');

  click(paymentDateControl);
  datePicker = document.querySelector('[data-hesabno-return-date-picker]');
  const cancelDay = [...datePicker.querySelectorAll('[data-date-day]')]
    .find((button) => !button.disabled && !button.classList.contains('bg-blue-600'));
  assert.ok(cancelDay, 'روز دیگری برای آزمون لغو باید قابل انتخاب باشد');
  click(cancelDay);
  click(datePicker.querySelector('[data-return-date-close]'));
  assert.equal(document.querySelector('[data-hesabno-return-date-picker]'), null, 'ضربدر باید تقویم را ببندد');
  assert.equal(normalize(paymentDateLabel.textContent), confirmedPaymentDate, 'ضربدر باید تغییر موقت را لغو کند');

  click(modal.querySelector('[data-hesabno-return-account-open]'));
  await wait(1000);

  const overlay = document.querySelector('.hesabno-fullscreen-selector-overlay');
  assert.ok(overlay, 'انتخابگر حساب باید باز شود');
  assert.equal(document.querySelector('[data-account-root]'), null, 'نشان «کد ریشه» نباید ساخته شود');
  assert.deepEqual(leafCodeNodes(window, overlay).map((node) => normalize(node.textContent)), [],
    'ردیف‌های انتخابگر حساب نباید کد نشان دهند');

  const rows = [...overlay.querySelectorAll('[role="button"]')];
  assert.ok(rows.length >= 1, 'حساب‌های موجود باید در انتخابگر فهرست شوند');
  rows.forEach((row) => assert.equal(/کد/.test(normalize(row.textContent)), false,
    `ردیف «${normalize(row.textContent)}» نباید کد داشته باشد`));

  const count = overlay.querySelector('[data-account-count]');
  assert.ok(count, 'شمارش حساب‌های انتخابگر باید بماند');
  assert.match(normalize(count.textContent), /سرفصل\/حساب$/, 'شمارش انتخابگر نباید حذف شود');

  trigger.remove();
});
