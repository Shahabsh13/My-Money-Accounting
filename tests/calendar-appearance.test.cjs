/*
 * آزمون لایهٔ ظاهر برای تقویم داشبورد.
 *
 * قرارداد: دکمهٔ بستن تقویم و کارت آن هیچ style درون‌خطی ندارند؛ ظاهرشان از کلاس
 * (`hesabno-calendar-close` / `hesabno-calendar-card`) و متغیرهای بستهٔ ۲۳۵ می‌آید.
 * قبلاً ۱۱۶ دوازده ویژگی را با style.cssText روی دکمه می‌نوشت؛ همین آزمون جلوی
 * برگشت آن عادت را می‌گیرد.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appBundle = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/067-inline.js'), 'utf8');
const { bootApp, closeApp, wait, normalize } = require('./helpers/app-boot.cjs');

let hasJsdom = true;
try {
  require('jsdom');
} catch (error) {
  hasJsdom = false;
}

test('home brand emphasizes the product name and keeps its subtitle smaller', () => {
  assert.match(appBundle, /e\.jsx\("h2",\{className:"font-black text-sm text-stone-100 leading-tight",style:\{fontWeight:900\},children:"My Money"\}\)/,
    'نام My Money باید وزن بولد صریح داشته باشد');
  assert.match(appBundle, /e\.jsx\("p",\{className:"text-\[10px\] text-stone-400 font-medium mt-0\.5",style:\{fontSize:"9px"\},children:"مدیریت حسابداری شخصی"\}\)/,
    'زیرعنوان باید یک پله کوچک‌تر، ۹ پیکسل، نمایش داده شود');
});

const persianToday = (() => {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => (parts.find((part) => part.type === type) || {}).value;
  return `${get('year')}/${get('month')}/${get('day')}`;
})();

const seedTransactions = [
  { id: 1, type: 'expense', amount: 1000, date: persianToday, title: 'آزمون پایداری', account: 'بانک ملت', documentNumber: 1, project: 'ساختمان', familyMember: 'علی', isCompound: true },
  { id: 2, type: 'expense', amount: 2500, date: persianToday, title: 'آزمون درآمد', account: 'بانک ملت', documentNumber: 2, check: { status: 'bounced', debtCanceled: true, returnedWithCorrection: true, correctionDate: persianToday } },
  { id: 3, type: 'expense', amount: 2000000, date: persianToday, title: 'اجاره‌بها', category: 'اجاره‌بها', account: 'بانک سامان', documentNumber: 3 },
  { id: 4, type: 'expense', amount: 800000, date: persianToday, title: 'اجاره‌بها', category: 'اجاره‌بها', account: 'صندوق اصلی', documentNumber: 4 },
  { id: 5, type: 'expense', amount: 500000, date: persianToday, title: 'اجاره‌بها', category: 'اجاره‌بها', account: 'بانک دی', documentNumber: 5 },
];

const jsdomStubs = (window) => {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { width: 300, height: 120, top: 0, left: 0, right: 300, bottom: 120, x: 0, y: 0 };
  };
};

test('calendar close button takes its appearance from a class, not inline style', { timeout: 60000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({
    stubs: jsdomStubs,
    storage: { 'hesabno:first_run_intro_done': '1' },
  });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;

  const dateButton = document.querySelector('button[title="مشاهده تقویم و تاریخ امروز"]');
  assert.ok(dateButton, 'دکمهٔ تاریخ داشبورد باید وجود داشته باشد');
  dateButton.click();
  await wait(1200);

  const close = document.querySelector('[data-hesabno-calendar-close]');
  assert.ok(close, 'تقویم باید باز شود و دکمهٔ بستن داشته باشد');
  assert.match(close.className, /\bhesabno-calendar-close\b/, 'دکمهٔ بستن باید کلاس معنایی داشته باشد');
  assert.equal(close.getAttribute('style'), null, 'دکمهٔ بستن نباید style درون‌خطی داشته باشد');

  const card = document.querySelector('.hesabno-calendar-card');
  assert.ok(card, 'کارت تقویم باید کلاس hesabno-calendar-card را بگیرد');
  assert.equal(card.getAttribute('style'), null, 'کارت تقویم نباید style درون‌خطی داشته باشد');
  assert.equal(close.parentElement, card, 'دکمهٔ بستن باید فرزند کارت باشد');
  const headingBlock = card.querySelector('.space-y-1');
  assert.ok(headingBlock, 'عنوان روز هفته باید در کارت باقی بماند');
  assert.equal(headingBlock.querySelectorAll('p').length, 0,
    'دو خط تاریخ تکراریِ زیر عنوان روز هفته باید حذف شده باشند');
  assert.match(normalize(card.textContent), /ماه و سال:.*تاریخ میلادی:/,
    'جزئیات ماه و تاریخ میلادی باید در کارت اطلاعات باقی بمانند');
  assert.doesNotMatch(card.textContent, /هجری خورشیدی/,
    'برچسب تاریخ هجری شمسیِ تکراری نباید زیر عنوان نمایش داده شود');

  /* بعد از باز شدن، هیچ لایه‌ای نباید ظاهر تقویم را دوباره بنویسد. */
  let styleWrites = 0;
  const observer = new window.MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes' && record.attributeName === 'style') styleWrites += 1;
    }
  });
  observer.observe(document.getElementById('root'), { attributes: true, subtree: true });
  await wait(1200);
  observer.disconnect();
  assert.equal(styleWrites, 0, `تقویمِ باز نباید بعد از استقرار style بنویسد (${styleWrites} نوشتن)`);
});

test('dashboard calendar can close through its React state and reopen repeatedly', { timeout: 60000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({
    stubs: jsdomStubs,
    storage: { 'hesabno:first_run_intro_done': '1' },
  });
  t.after(() => closeApp(dom));
  const { document } = dom.window;
  const findCalendar = () => Array.from(document.querySelectorAll('.fixed')).find((node) => {
    const text = normalize(node.textContent);
    return text.includes('روز هفته:') && text.includes('تاریخ میلادی:');
  });
  const openCalendar = async () => {
    const dateButton = document.querySelector('button[title="مشاهده تقویم و تاریخ امروز"]');
    assert.ok(dateButton, 'دکمهٔ تاریخ داشبورد باید وجود داشته باشد');
    dateButton.click();
    await wait(1200);
    return findCalendar();
  };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const calendar = await openCalendar();
    assert.ok(calendar, `تقویم باید در بار ${attempt} باز شود`);
    const injectedClose = calendar.querySelector('[data-hesabno-calendar-close]');
    assert.ok(injectedClose, 'دکمهٔ بستن سفارشی باید وجود داشته باشد');
    assert.equal(typeof dom.window.__hesabnoCloseDashboardCalendar, 'function',
      'بستن سفارشی باید کنترل state متعلق به React را صدا بزند');

    injectedClose.click();
    await wait(100);
    assert.equal(findCalendar(), undefined, `بستن در بار ${attempt} باید state را ببندد، نه فقط DOM را حذف کند`);
  }
});

test('dashboard widgets and transaction card icons use CSS appearance rules without injected <style> or inline style', { timeout: 60000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({
    seed: seedTransactions,
    stubs: jsdomStubs,
    storage: { 'hesabno:first_run_intro_done': '1' },
  });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;

  await wait(1200);

  /* این تگ‌های <style> قبلاً توسط ۱۰۴، ۱۲۷، ۱۳۱، ۱۴۵ و ۱۸۹ به <head> تزریق می‌شدند؛
     حالا در بستهٔ ۲۳۵ و ۰۶۰ هستند و دیگر نباید در DOM ساخته شوند. */
  assert.equal(document.querySelector('style[data-hesabno-counterparty-icon-style]'), null);
  assert.equal(document.querySelector('style[data-hesabno-tx-status-badge-style]'), null);
  assert.equal(document.querySelector('style[data-hesabno-compact-widget-actions-style]'), null);
  assert.equal(document.getElementById('hesabno-recent-account-logo-style'), null);
  assert.equal(document.querySelector('style[data-hesabno-compound-title-style]'), null);
  assert.equal(document.querySelector('style[data-hesabno-canonical-metadata-style]'), null);
  assert.equal(document.getElementById('hesabno-amount-keyboard-style'), null);
  assert.equal(document.getElementById('hesabno-amount-keyboard-theme-adaptive-style'), null);
  for (const sel of [
    'style[data-hesabno-check-due-style]',
    'style[data-hesabno-check-status-actions-style]',
    'style[data-hesabno-check-card-status-colors-style]',
    'style[data-hesabno-check-card-layout-style]',
    'style[data-hesabno-check-card-layout-safe-style]',
    'style[data-hesabno-check-card-header-style]',
    'style[data-hesabno-loan-installment-style]',
    'style[data-hesabno-loan-stable-style]',
    'style[data-hesabno-loan-preview-clarity-style]',
    'style[data-hesabno-form-presets-hidden-style]',
    '#hesabno-loan-card-light-contrast',
    '#hesabno-family-project-report-style',
    '#hesabno-family-project-report-dashboard-style',
    'style[data-hesabno-simple-report-safe-style]',
    'style[data-hesabno-simple-report-tooltip-zones-style]',
    'style[data-hesabno-report-bank-logo-and-description-style]',
    '#hn-toast-style',
    'style[data-hesabno-settlement-date-style]',
    '#hn-theme-instant-style',
  ]) {
    assert.equal(document.querySelector(sel), null, `${sel} نباید به <head> تزریق شود`);
  }

  const keypad = document.getElementById('hesabno-amount-keyboard');
  assert.ok(keypad, 'پنل صفحه‌کلید عددی باید وجود داشته باشد');
  assert.equal(keypad.querySelectorAll('[style]').length, 0,
    'هیچ گره‌ای داخل صفحه‌کلید عددی نباید style درون‌خطی داشته باشد');

  const recentLogo = document.querySelector('.hesabno-recent-account-logo');
  assert.ok(recentLogo, 'قاب لوگوی حساب در آخرین تراکنش‌های داشبورد باید کلاس معنایی بگیرد');
  assert.equal(recentLogo.getAttribute('style'), null, 'قاب لوگو نباید style درون‌خطی داشته باشد');

  const compactAction = document.querySelector('.hesabno-compact-widget-action');
  assert.ok(compactAction, 'دکمهٔ ویجت داشبورد باید کلاس hesabno-compact-widget-action بگیرد');

  const txTab = [...document.querySelectorAll('nav.fixed button')].find((button) =>
    normalize(button.textContent).includes('تراکنش'));
  assert.ok(txTab, 'تب تراکنش باید وجود داشته باشد');
  txTab.click();
  await wait(1200);

  const transactionAmount = document.querySelector('[data-hesabno-transaction-amount]');
  assert.ok(transactionAmount, 'مبلغ تراکنش باید در فهرست نمایش داده شود');
  assert.equal(transactionAmount.classList.contains('font-mono'), false,
    'فونت تک‌عرضی نباید به کل متن مبلغ و ارقامش اعمال شود');
  const amountNumber = transactionAmount.querySelector('[data-hesabno-amount-number="true"]');
  assert.ok(amountNumber, 'بخش عددی مبلغ باید جداگانه علامت‌گذاری شود');
  assert.match(amountNumber.textContent, /[۰-۹]/, 'عدد مبلغ باید در بخش عددی باقی بماند');
  assert.ok(amountNumber.querySelector('[data-hesabno-unified-number-font="true"]'),
    'عدد مبلغ باید پس از یکدست‌سازی در پوشش monospace قرار بگیرد');
  assert.ok([...transactionAmount.querySelectorAll('.font-mono')]
    .some((node) => ['تومان', 'ریال'].includes(normalize(node.textContent))),
  'فونت علامت و واحد پول نباید در این تغییر عوض شود');

  const icons = [...document.querySelectorAll('.hesabno-counterparty-icon')];
  assert.ok(icons.length >= 2, 'کارت‌های تراکنش باید کلاس hesabno-counterparty-icon بگیرند');
  for (const icon of icons) {
    assert.equal(icon.getAttribute('style'), null,
      'آیکون کارت تراکنش نباید style درون‌خطی داشته باشد (قبلاً ۱۰۴ و ۱۲۹ روی آن می‌نوشتند)');
  }

  for (const selector of [
    '[data-hesabno-meta-separator]',
    '[data-hesabno-compound-badge]',
    '[data-hesabno-returned-effect]',
    '[data-hesabno-returned-correction]',
  ]) {
    const node = document.querySelector(selector);
    assert.ok(node, `گرهٔ ${selector} باید در کارت تراکنش ساخته شود`);
    assert.equal(node.getAttribute('style'), null,
      `گرهٔ ${selector} نباید style درون‌خطی داشته باشد (ظاهر از بستهٔ ۲۳۵)`);
  }

  const statusBadge = document.querySelector('article[id^="tx-card-"] [data-hesabno-tx-status-badge]');
  assert.ok(statusBadge, 'نشان وضعیت چک در پاورقی تراکنش باید وجود داشته باشد');
  assert.equal(statusBadge.getAttribute('data-hesabno-status-tone'), 'red',
    'نشان وضعیت چک برگشتی باید دارای data-hesabno-status-tone="red" باشد');

  const duplicateFootnotes = [...document.querySelectorAll('article[id^="tx-card-"] [data-hesabno-metadata-duplicate="true"]')];
  assert.ok(duplicateFootnotes.length >= 2, 'نشان‌های تکراری پاورقی (پروژه/خانواده/سند مرکب/وضعیت چک) باید علامت‌گذاری شوند');
  for (const dup of duplicateFootnotes) {
    assert.equal(window.getComputedStyle(dup).display, 'none',
      `نشان تکراری پاورقی (${dup.className || dup.tagName}: ${dup.textContent}) باید display: none باشد و کنار نشان استاندارد تکرار نشود`);
  }
  const txCard1 = document.getElementById('tx-card-1');
  if (txCard1) {
    const visibleProjectChips = [...txCard1.querySelectorAll('.hesabno-tx-project-chip, [data-hesabno-metadata-canonical-item="project"]')]
      .filter((el) => window.getComputedStyle(el).display !== 'none');
    assert.equal(visibleProjectChips.length, 1, 'در کارت تراکنش فقط یک نشان پروژه («پروژه: ساختمان») باید قابل‌مشاهده باشد');
    assert.equal(normalize(visibleProjectChips[0].textContent), normalize('پروژه: ساختمان'));

    const visibleFamilyChips = [...txCard1.querySelectorAll('.hesabno-tx-family-chip, [data-hesabno-metadata-canonical-item="family"]')]
      .filter((el) => window.getComputedStyle(el).display !== 'none');
    assert.equal(visibleFamilyChips.length, 1, 'در کارت تراکنش فقط یک نشان عضو خانواده («عضو خانواده: علی») باید قابل‌مشاهده باشد');
    assert.equal(normalize(visibleFamilyChips[0].textContent), normalize('عضو خانواده: علی'));
  }

  const footnotemarkedByLc = document.querySelectorAll(
    'article[id^="tx-card-"] [data-hesabno-metadata-canonical] [data-hn-lc], ' +
    'article[id^="tx-card-"] [data-hesabno-footnote-kind][data-hn-lc], ' +
    'article[id^="tx-card-"] [data-hesabno-footnote-kind] [data-hn-lc]'
  );
  assert.equal(footnotemarkedByLc.length, 0,
    '۹۰۱ نباید رنگ آیتم‌های پاورقی تراکنش را بازنویسی کند');

  /* گزارش ساده: انتخاب سرفصل باید ساختار تاریخِ سرگروه و کپسول تراکنش را بدون جابه‌جایی گره‌های React بسازد و تغییر تاریخ بالا نباید صفحه را سفید کند. */
  const reportsTab = [...document.querySelectorAll('nav.fixed button')].find((button) =>
    normalize(button.textContent).includes('گزارش'));
  assert.ok(reportsTab, 'تب گزارش‌ها باید وجود داشته باشد');
  reportsTab.click();
  await wait(800);

  const categoryItem = [...document.querySelectorAll('button, div.cursor-pointer')].find((node) =>
    normalize(node.textContent).includes('اجاره‌بها') || normalize(node.textContent).includes('اجارهبها'));
  assert.ok(categoryItem, 'ردیف سرفصل در گزارش ساده باید وجود داشته باشد');
  categoryItem.click();
  await wait(800);

  const reportCard = document.querySelector('.hesabno-report-transaction-card.hesabno-simple-report-detail-card');
  assert.ok(reportCard, 'کارت تراکنش‌های سرفصل در گزارش ساده باید کلاس hesabno-simple-report-detail-card بگیرد');
  const detailRightHeader = document.querySelector('main button[aria-label="بازگشت"] > h1.text-xl.font-black.text-stone-100');
  assert.ok(detailRightHeader && normalize(detailRightHeader.textContent) === normalize('گزارش‌ها'),
    'در سمت راست بالای دکمهٔ جهت در صفحهٔ جزئیات گزارش ساده باید عنوان «گزارش‌ها» دقیقاً مشابه صفحهٔ قبل نمایش داده شود');
  const detailLeftBackBtn = document.querySelector('main button[data-hesabno-simple-report-back="true"]');
  assert.ok(detailLeftBackBtn && normalize(detailLeftBackBtn.textContent).includes('بازگشت') && !detailLeftBackBtn.classList.contains('invisible'),
    'در سمت چپ بالای صفحهٔ جزئیات گزارش ساده باید دکمهٔ قابل‌مشاهدهٔ «بازگشت» وجود داشته باشد');
  const reportRows = [...reportCard.querySelectorAll('.hesabno-report-transaction-row')];
  assert.ok(reportRows.length >= 2, 'ردیف‌های تراکنش در گزارش ساده باید وجود داشته باشند');
  const reportRow = reportRows.find((r) => normalize(r.textContent).includes('بانک سامان')) || reportRows[0];
  const cashRow = reportRows.find((r) => normalize(r.textContent).includes('صندوق اصلی'));
  assert.ok(reportRow.parentElement.classList.contains('divide-y'),
    'ردیف تراکنش باید فرزند مستقیم لیست React بماند تا تغییر تاریخ باعث کرش removeChild نشود');
  const dateGroup = reportRows[0].querySelector('.hesabno-simple-report-date-group');
  const rowBox = reportRow.querySelector('.hesabno-simple-report-row-box');
  const bankWrap = reportRow.querySelector('.hesabno-simple-report-bank-wrap');
  const bankLabel = reportRow.querySelector('.hesabno-simple-report-bank');
  const amountLabel = reportRow.querySelector('.hesabno-simple-report-amount');
  assert.ok(dateGroup && !dateGroup.hidden && normalize(dateGroup.textContent).length > 0,
    'سرگروه تاریخ بالای ردیف تراکنش باید نمایش داده شود');
  assert.ok(rowBox && bankWrap && bankLabel && amountLabel,
    'کپسول تراکنش گزارش ساده باید شامل لوگوی بانک، نام بانک و مبلغ باشد');
  assert.equal(normalize(bankLabel.textContent), 'بانک سامان');
  assert.ok(bankWrap.querySelector('.hesabno-bank-mark img'),
    'ردیف بانک باید لوگوی رسمی بانک را کنار نام بانک نمایش دهد');
  assert.equal(reportRow.querySelector('.hesabno-simple-report-description'), null,
    'آیکون سرفصل انتخاب‌شده نباید به‌عنوان توضیح زیر نام حساب نمایش داده شود');

  assert.ok(cashRow, 'ردیف تراکنش صندوق اصلی باید در گزارش ساده وجود داشته باشد');
  const cashWrap = cashRow.querySelector('.hesabno-simple-report-bank-wrap');
  const cashIcon = cashWrap && cashWrap.querySelector('.hesabno-bank-mark.hesabno-report-account-icon');
  assert.ok(cashIcon && cashIcon.getAttribute('data-hesabno-report-account-icon') === '💵',
    'ردیف صندوق باید آیکون صندوق (💵) را کنار نام صندوق نمایش دهد، نه آیکون سرفصل انتخاب‌شده');
  assert.equal(cashIcon.classList.contains('hesabno-report-bank-logo'), false,
    'آیکون متنی صندوق نباید کلاس hesabno-report-bank-logo بگیرد که font-size:0 و color:transparent دارد');
  assert.equal(cashRow.querySelector('.hesabno-simple-report-description'), null,
    'زیر نام صندوق اصلی در تراکنش بدون توضیح نباید آیکون سرفصل انتخاب‌شده نمایش داده شود');

  const dayRow = reportRows.find((r) => normalize(r.textContent).includes('بانک دی'));
  assert.ok(dayRow, 'ردیف تراکنش بانک دی باید در گزارش ساده وجود داشته باشد');
  const dayMark = dayRow.querySelector('.hesabno-simple-report-bank-wrap .hesabno-bank-mark');
  const dayImg = dayMark && dayMark.querySelector('img');
  assert.ok(dayMark && dayImg, 'ردیف بانک دی باید لوگوی بانک داشته باشد');
  assert.equal(dayMark.getAttribute('data-hesabno-bank-logo'), 'دی',
    'در ماه مهر، لوگوی بانک دی نباید به‌خاطر نام ماه «مهر» به بانک مهر تغییر کند');
  assert.equal(dayImg.getAttribute('src'), window.__HESABNO_OFFICIAL_BANK_LOGOS['دی'],
    'تصویر لوگوی بانک دی باید دقیقاً لوگوی رسمی بانک دی باشد، نه بانک مهر');

  const prevPeriodBtn = document.querySelector('button[aria-label="دوره قبل"]');
  const nextPeriodBtn = document.querySelector('button[aria-label="دوره بعد"]');
  assert.ok(prevPeriodBtn && nextPeriodBtn, 'دکمه‌های دوره قبل و بعد در بالای گزارش ساده باید وجود داشته باشند');
  prevPeriodBtn.click();
  await wait(400);
  nextPeriodBtn.click();
  await wait(400);

  for (const modeLabel of ['سالانه', 'هفتگی', 'روزانه', 'ماهانه']) {
    const topDateBtn = prevPeriodBtn.nextElementSibling;
    assert.ok(topDateBtn, 'دکمهٔ انتخاب بازهٔ تاریخ در بالای گزارش ساده باید وجود داشته باشد');
    topDateBtn.click();
    await wait(300);
    const modeOption = [...document.querySelectorAll('button')].find((btn) =>
      normalize(btn.textContent) === modeLabel);
    assert.ok(modeOption, `گزینهٔ ${modeLabel} باید در شیت انتخاب بازه وجود داشته باشد`);
    modeOption.click();
    await wait(400);
    prevPeriodBtn.click();
    await wait(300);
    nextPeriodBtn.click();
    await wait(300);
    const detailHeading = [...document.querySelectorAll('h2')].find((h) =>
      normalize(h.textContent).includes('تراکنش‌های'));
    assert.ok(detailHeading, `صفحهٔ جزئیات گزارش ساده پس از جابه‌جایی تاریخ در حالت ${modeLabel} نباید سفید شود`);
  }

  detailLeftBackBtn.click();
  await wait(250);
  const mainEl = document.querySelector('main');
  assert.ok(mainEl && !mainEl.classList.contains('hesabno-page-exit-down'),
    'پس از بازگشت از جزئیات گزارش ساده، کلاس hesabno-page-exit-down (که pointer-events:none دارد) نباید روی main باقی بماند');
  const accountBtnAgain = [...document.querySelectorAll('button, div.cursor-pointer')].find((b) =>
    normalize(b.textContent).includes('اجاره‌بها') || normalize(b.textContent).includes('اجارهبها'));
  assert.ok(accountBtnAgain, 'پس از بازگشت به صفحهٔ گزارش ساده، فهرست سرفصل‌ها باید قابل انتخاب باشد');
  accountBtnAgain.click();
  await wait(400);
  assert.ok(document.querySelector('main button[data-hesabno-simple-report-back="true"]'),
    'پس از بازگشت از یک سرفصل، انتخاب مجدد سرفصل باید بدون قفل‌شدن صفحه کار کند');

  // بررسی دکمهٔ «ثبت و ذخیره بانک» در حالت تیره + فریز فوتر فرم + رفتار در برابر کیبورد گوشی و کیبورد داخلی برنامه
  const accountsNavBtn = [...document.querySelectorAll('nav button, button')].find((b) =>
    normalize(b.textContent) === 'حساب‌ها' || normalize(b.textContent) === 'سرفصل‌ها');
  if (accountsNavBtn) {
    accountsNavBtn.click();
    await wait(350);
    const addBankTrigger = [...document.querySelectorAll('button')].find((b) =>
      normalize(b.textContent).includes('تعریف بانک جدید') || normalize(b.textContent).includes('بانک جدید'));
    if (addBankTrigger) {
      addBankTrigger.click();
      await wait(350);
      const saveBankBtn = [...document.querySelectorAll('button')].find((b) =>
        normalize(b.textContent) === 'ثبت و ذخیره بانک');
      assert.ok(saveBankBtn, 'دکمهٔ «ثبت و ذخیره بانک» باید در فرم تعریف بانک وجود داشته باشد');
      assert.equal(saveBankBtn.disabled, false,
        'دکمهٔ «ثبت و ذخیره بانک» در حالت تیره نباید غیرفعال (disabled) و خاکستری باشد');
      assert.ok(saveBankBtn.className.includes('bg-sky-500') && !saveBankBtn.className.includes('disabled:bg-stone-800'),
        'دکمهٔ «ثبت و ذخیره بانک» باید در حالت تیره هم مانند حالت روشن آبی فعال (bg-sky-500) باشد');
      const stickyFooter = saveBankBtn.closest('.hesabno-sticky-form-footer');
      const bankFormPage = saveBankBtn.closest('.hesabno-bank-form-page');
      assert.ok(stickyFooter && bankFormPage,
        'فوتر دکمهٔ ثبت در فرم بانک باید دارای کلاس‌های فریز (hesabno-sticky-form-footer در hesabno-bank-form-page) باشد');
      saveBankBtn.click();
      await wait(150);
      assert.ok(normalize(bankFormPage.textContent).includes('لطفاً بانک مورد نظر را انتخاب کنید'),
        'کلیک روی دکمهٔ «ثبت و ذخیره بانک» در حالت خالی باید پیام راهنمای اعتبارسنجی را نمایش دهد');

      // شبیه‌سازی باز شدن کیبورد گوشی روی فیلد متنی در مقابل کیبورد داخلی برنامه (#hesabno-amount-keyboard)
      const textInput = [...bankFormPage.querySelectorAll('input')].find((inp) =>
        inp.getAttribute('data-hesabno-numkb-bound') !== '1' && !inp.readOnly);
      if (textInput && typeof window.__hesabnoSyncViewportForKeyboard === 'function') {
        textInput.focus();
        window.__hesabnoSyncViewportForKeyboard();
        assert.equal(document.documentElement.getAttribute('data-hesabno-native-kb'), '1',
          'هنگام فوکوس روی فیلد متنی عادی (کیبورد گوشی)، صفت data-hesabno-native-kb باید فعال شود تا دکمهٔ ثبت بالای کیبورد گوشی قرار بگیرد');
        const internalKb = document.getElementById('hesabno-amount-keyboard');
        if (internalKb) {
          internalKb.hidden = false;
          internalKb.setAttribute('aria-hidden', 'false');
          window.__hesabnoSyncViewportForKeyboard();
          assert.equal(document.documentElement.getAttribute('data-hesabno-native-kb'), null,
            'هنگام باز بودن کیبورد داخلی برنامه (#hesabno-amount-keyboard)، دکمهٔ ثبت نباید بالای کیبورد داخلی بیاید');
          internalKb.hidden = true;
          internalKb.setAttribute('aria-hidden', 'true');
        }
        textInput.blur();
        window.__hesabnoSyncViewportForKeyboard();
      }
    }
  }

  /* ── ۹. صورتحساب صندوق/بانک به‌عنوان پنجره مستقل و کاملاً کدر روی پنجره قبلی ── */
  const fs = require('node:fs');
  const path = require('node:path');
  const appearanceCss = fs.readFileSync(
    path.join(__dirname, '..', 'app/src/main/assets/src/styles/235-hesabno-text-root-and-display-stability.css'),
    'utf8'
  );
  assert.doesNotMatch(appearanceCss,
    /\.font-mono:not\(/,
    'کلاس .font-mono نباید با :not(...) وزن اختصاصی بالا بگیرد و display: none !important در لیست تراکنش‌ها را بازنویسی کند');
  assert.match(appearanceCss,
    /html\[data-theme="light"\] body \.hesabno-account-statement-panel\.fixed\.inset-0[\s\S]*?background-color:\s*#eef3f6\s*!important/,
    'در تم روشن، پس‌زمینهٔ پنجرهٔ صورتحساب باید کاملاً کدر (#eef3f6) باشد تا پنجرهٔ زیرین مشخص نباشد');
  assert.match(appearanceCss,
    /html:not\(\[data-theme="light"\]\) body \.hesabno-account-statement-panel\.fixed\.inset-0[\s\S]*?background-color:\s*#121519\s*!important/,
    'در تم تیره، پس‌زمینهٔ پنجرهٔ صورتحساب باید کاملاً کدر (#121519) باشد تا پنجرهٔ زیرین مشخص نباشد');
  assert.match(appearanceCss,
    /\.hesabno-account-statement-panel > header \+ div > \.grid\.grid-cols-3\s*\{[\s\S]*?display:\s*grid\s*!important;\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*!important/,
    'سطر جمع واریز، برداشت و مانده نهایی در صورتحساب باید در ۳ ستون کنار هم قرار بگیرد');
  assert.match(appearanceCss,
    /\.hesabno-account-statement-panel\[data-hesabno-report-statement-section="true"\] \.hesabno-statement-columns/,
    'نوار عنوان ستون‌ها در گزارش صورتحساب باید تمام‌عرض و هماهنگ با کارت‌های صورتحساب باشد');
  assert.match(appearanceCss,
    /html\[data-theme="light"\] \.hesabno-day-balance,\s*html\[data-theme="light"\] \.hesabno-day-balance\.neg\s*\{\s*color:\s*#1e293b\s*!important;\s*\}/,
    'عدد جمع روزانه در تم روشن باید رنگ خنثی و کاملاً خوانا (#1e293b) داشته باشد');
  assert.match(appearanceCss,
    /html:not\(\[data-theme="light"\]\) \.hesabno-day-balance[\s\S]*?color:\s*#e2e8f0\s*!important/,
    'عدد جمع روزانه در تم تیره باید رنگ خنثی و کاملاً خوانا (#e2e8f0) داشته باشد');
  assert.match(appearanceCss,
    /button\[title="باز کردن همه اسناد"\],\s*button\[title="بستن همه اسناد"\]\s*\{\s*display:\s*none\s*!important;\s*\}/,
    'دکمه باز/بستن همه اسناد در بالای دفتر تراکنش‌ها باید حذف شود');
  assert.match(appearanceCss,
    /html\[data-theme="light"\] main\[data-hesabno-transactions-page="true"\]\s*\{\s*background-color:\s*#e7eff5\s*!important/,
    'پس‌زمینه دفتر تراکنش‌ها در تم روشن حتی در تب‌های خالی باید ثابت و روشن (#e7eff5) بماند');
  assert.match(appearanceCss,
    /section\[data-hesabno-today-widget-section\] \[data-hesabno-today-row="true"\]\s*\{\s*padding:\s*7px 10px\s*!important/,
    'ارتفاع و پدینگ کارت‌های تراکنش در ویجت هزینه‌های امروز و درآمدهای امروز باید فشرده و متناسب باشد');
  assert.match(appearanceCss,
    /section\[data-hesabno-today-widget-section\] \[data-hesabno-today-row="true"\] > span:first-child\s*\{[\s\S]*?width:\s*34px\s*!important;\s*height:\s*34px\s*!important/,
    'کادر آیکون سرفصل در هزینه‌های امروز و درآمدهای امروز باید جمع‌وجور (34x34) باشد');
  assert.match(appearanceCss,
    /\[data-hesabno-liquidity-row\] \[data-hesabno-liquidity-amount-wrap="true"\]\s*\{[\s\S]*?display:\s*inline-flex\s*!important;\s*flex-direction:\s*row\s*!important;\s*flex-wrap:\s*nowrap\s*!important/,
    'مبلغ و فلش در ردیف‌های موجودی نقد و بانک باید همیشه کنار هم و در یک خط افقی بمانند');

  /* ── ۱۰. باز شدن تراکنش در حالت ویرایش با مبلغ داخل کیبورد داخلی ── */
  const txNavBtn = Array.from(document.querySelectorAll('nav button')).find((b) => b.textContent.includes('اسناد') || b.textContent.includes('تراکنش'));
  if (txNavBtn) {
    txNavBtn.click();
    await wait(120);
    const rentCard = Array.from(document.querySelectorAll('main div.cursor-pointer')).find((d) => d.textContent.includes('اجاره'));
    if (rentCard) {
      rentCard.click();
      await wait(80);
      const editTxBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'ویرایش' || b.textContent.includes('ویرایش'));
      assert.ok(editTxBtn, 'دکمه ویرایش تراکنش باید وجود داشته باشد');
      editTxBtn.click();
      await wait(120);
      const editAmountInput = document.getElementById('field-amount-input');
      const editKeypad = document.getElementById('hesabno-amount-keyboard');
      const editKeypadDisplay = editKeypad ? editKeypad.querySelector('[data-hkap-value]') : null;
      assert.ok(editAmountInput && editKeypadDisplay, 'فیلد مبلغ و نمایشگر کیبورد داخلی باید در حالت ویرایش وجود داشته باشند');
      assert.equal(editKeypad.hidden, false, 'کیبورد داخلی باید در حالت ویرایش باز باشد');
      assert.notEqual(editKeypadDisplay.value, '۰', 'نمایشگر کیبورد داخلی در حالت ویرایش نباید خالی (۰) باشد');
      assert.equal(editKeypadDisplay.value, editAmountInput.value.replace(/،/g, '٬'), 'نمایشگر کیبورد داخلی باید دقیقاً مبلغ تراکنش در حال ویرایش را نشان دهد');
      assert.equal(editKeypadDisplay.value, '۵۰۰٬۰۰۰', 'نمایشگر کیبورد داخلی باید مبلغ سند اجاره‌بها (۵۰۰٬۰۰۰) را نشان دهد');

      // در ویرایش پرداخت عادی، دکمه «پرداخت مرکب» و «چک صیادی» باید خاموش و غیرفعال باشند
      const formButtons = Array.from(document.querySelectorAll('form button'));
      const compoundModeBtn = formButtons.find((b) => b.textContent.includes('پرداخت مرکب') || b.textContent.includes('دریافت مرکب'));
      const checkModeBtn = formButtons.find((b) => b.textContent.includes('چک صیادی'));
      assert.ok(compoundModeBtn && checkModeBtn, 'دکمه‌های مرکب و چک صیادی باید در فرم وجود داشته باشند');
      assert.equal(compoundModeBtn.disabled, true, 'دکمه پرداخت مرکب در حالت ویرایش پرداخت عادی باید غیرفعال باشد');
      assert.equal(compoundModeBtn.getAttribute('data-hesabno-tx-edit-mode-locked'), 'true');
      assert.equal(checkModeBtn.disabled, true, 'دکمه چک صیادی در حالت ویرایش پرداخت عادی باید غیرفعال باشد');
      assert.equal(checkModeBtn.getAttribute('data-hesabno-tx-edit-mode-locked'), 'true');
      compoundModeBtn.click();
      checkModeBtn.click();
      await wait(40);
      assert.ok(document.getElementById('field-amount-input'), 'کلیک روی دکمه‌های خاموش نباید نوع فرم را عوض کند');

      // ۱۱. بررسی انتخاب پروژه و عضو خانواده در حالت ویرایش بدون سیاه شدن صفحه
      window.localStorage.setItem('hesabno:projects', JSON.stringify(['پروژه بازسازی']));
      window.localStorage.setItem('hesabno:familyMembers', JSON.stringify(['امیر']));
      const moreOptsBtn = Array.from(document.querySelectorAll('form button')).find((b) => b.textContent.includes('گزینه‌ها و امکانات بیشتر'));
      const keypad = document.getElementById('hesabno-amount-keyboard');
      if (keypad && !keypad.hidden) keypad.querySelector('[data-hkap-action="close"]').click();
      if (moreOptsBtn) {
        moreOptsBtn.click();
        await wait(60);
      }
      const projectLabel = Array.from(document.querySelectorAll('form label')).find((l) => l.textContent.includes('انتساب به پروژه'));
      const projectBtn = projectLabel && projectLabel.parentElement.querySelector('button');
      assert.ok(projectBtn, 'دکمه انتخاب پروژه باید در فرم ویرایش وجود داشته باشد');
      projectBtn.click();
      await wait(80);
      assert.ok(document.getElementById('root').innerHTML.length > 0, 'کلیک روی انتخاب پروژه نباید باعث سیاه شدن صفحه شود');
      const projectOpt = Array.from(document.querySelectorAll('.hesabno-catalog-picker-overlay button')).find((b) => b.textContent.trim() === 'پروژه بازسازی');
      assert.ok(projectOpt, 'پروژه تعریف‌شده باید در لیست انتخاب پروژه نمایش داده شود');
      projectOpt.click();
      await wait(60);
      assert.equal(projectBtn.textContent.trim(), 'پروژه بازسازی');

      const familyLabel = Array.from(document.querySelectorAll('form label')).find((l) => l.textContent.includes('عضو خانواده'));
      const familyBtn = familyLabel && familyLabel.parentElement.querySelector('button');
      assert.ok(familyBtn, 'دکمه انتخاب عضو خانواده باید در فرم ویرایش وجود داشته باشد');
      familyBtn.click();
      await wait(80);
      const familyOpt = Array.from(document.querySelectorAll('.hesabno-catalog-picker-overlay button')).find((b) => b.textContent.trim() === 'امیر');
      assert.ok(familyOpt, 'عضو خانواده جدید باید بلافاصله در لیست انتخاب عضو خانواده نمایش داده شود');
      familyOpt.click();
      await wait(60);
      assert.equal(familyBtn.textContent.trim(), 'امیر');

      const editStickyHeader = document.querySelector('header.sticky.top-0');
      assert.ok(editStickyHeader, 'هدر چسبان فرم ویرایش سند باید وجود داشته باشد');
      assert.equal(editStickyHeader.classList.contains('backdrop-blur'), false, 'هدر فرم ویرایش نباید کلاس backdrop-blur داشته باشد تا روی دکمه‌های زیرین هاله بلر نیندازد');
      const editHeaderStyle = window.getComputedStyle(editStickyHeader);
      assert.equal(editHeaderStyle.getPropertyValue('box-shadow'), 'none', 'هدر فرم ویرایش نباید box-shadow داشته باشد تا حاشیه سایه باعث بلر شدن دکمه‌های زیرین نشود');

      // ۱۲. بستن فرم ویرایش و بررسی لوگوی صندوق اصلی و چیدمان مبلغ منفی کنار فلش در پنجره «موجودی نقد و بانک»
      const closeTxBtn = Array.from(document.querySelectorAll('header button')).find((b) => b.getAttribute('title') && b.getAttribute('title').includes('بستن'));
      if (closeTxBtn) {
        closeTxBtn.click();
        await wait(80);
      }
      const homeNavBtn = Array.from(document.querySelectorAll('nav button')).find((b) => b.textContent.includes('خانه'));
      if (homeNavBtn) {
        homeNavBtn.click();
        await wait(120);
        const heroBalanceCard = Array.from(document.querySelectorAll('div.cursor-pointer')).find((d) => d.textContent.includes('موجودی'));
        if (heroBalanceCard) {
          heroBalanceCard.click();
          await wait(120);
          const cashTabBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('صندوق‌ها'));
          assert.ok(cashTabBtn, 'تب صندوق‌ها باید در پنجره موجودی نقد و بانک وجود داشته باشد');
          cashTabBtn.click();
          await wait(120);
          const cashRow = document.querySelector('[data-hesabno-liquidity-row="cash"]');
          assert.ok(cashRow, 'ردیف صندوق اصلی باید در تب صندوق‌ها وجود داشته باشد');
          const cashLogo = cashRow.querySelector('[data-hesabno-cash-logo="true"]');
          assert.ok(cashLogo, 'کادر لوگوی صندوق باید وجود داشته باشد');
          assert.equal(cashLogo.textContent.trim(), '💵', 'لوگوی صندوق اصلی باید لوگوی صندوق (💵) باشد نه آیکون وکتور عمومی');
          assert.equal(cashLogo.querySelector('svg'), null, 'کادر لوگوی صندوق نباید شامل svg عمومی باشد');
          const amountWrap = cashRow.querySelector('[data-hesabno-liquidity-amount-wrap="true"]');
          assert.ok(amountWrap, 'ظرف مبلغ و فلش باید در ردیف صندوق وجود داشته باشد');
          assert.equal(amountWrap.getAttribute('data-hesabno-money-rtl'), null, 'ظرف فلکس مبلغ و فلش نباید صفت data-hesabno-money-rtl بگیرد که باعث شکستن خط شود');
          assert.equal(window.getComputedStyle(amountWrap).display, 'inline-flex', 'ظرف مبلغ و فلش باید inline-flex بماند تا فلش کنار عدد بماند و به خط پایین نرود');
          assert.equal(window.getComputedStyle(amountWrap).flexWrap, 'nowrap', 'ظرف مبلغ و فلش باید nowrap باشد');

          // بررسی پنجره صورتحساب صندوق اصلی: حذف فلش سرصفحه، ماندن فلش در سمت راست هنگام باز شدن، و باز/بسته شدن با لمس هر نقطه از بخش جمع
          cashRow.click();
          await wait(120);
          const stmtPanel = document.querySelector('.hesabno-account-statement-panel');
          assert.ok(stmtPanel, 'پنجره صورتحساب صندوق اصلی باید باز شود');
          const headerSummaryBtn = stmtPanel.querySelector('header button[title*="سطر جمع"]');
          assert.equal(headerSummaryBtn, null, 'دکمه فلش اضافی در سرصفحه بالای صورتحساب باید حذف شده باشد');

          const openSummaryDiv = stmtPanel.querySelector('header + div');
          assert.ok(openSummaryDiv, 'در حالت باز، بخش جمع واریز، برداشت و مانده باید نمایش داده شود');
          const closeRowArrow = openSummaryDiv.querySelector('button[title="بستن این سطر"]');
          assert.ok(closeRowArrow, 'فلش بستن سطر جمع باید وجود داشته باشد');
          assert.ok(closeRowArrow.classList.contains('right-2') && !closeRowArrow.classList.contains('left-2'),
            'فلش سطر جمع هنگام باز بودن نیز باید در سمت راست (right-2) باقی بماند');

          // لمس روی متن داخل بخش جمع (نه فقط روی دکمه فلش) باید آن را ببندد
          const inflowLabel = Array.from(openSummaryDiv.querySelectorAll('span')).find((s) => s.textContent.includes('واریز'));
          assert.ok(inflowLabel, 'عنوان واریز باید در بخش جمع وجود داشته باشد');
          inflowLabel.click();
          await wait(80);
          const collapsedSummaryBtn = stmtPanel.querySelector('header + button[title="برای باز کردن سطر جمع گردش کلیک کنید"]');
          assert.ok(collapsedSummaryBtn, 'لمس روی هر نقطه از بخش جمع بازشده باید آن را ببندد');

          // لمس روی متن سمت چپ نوار بسته (نه فقط روی فلش سمت راست) باید دوباره آن را باز کند
          const balanceTextSpan = Array.from(collapsedSummaryBtn.querySelectorAll('span')).find((s) => s.textContent.includes('مانده:'));
          assert.ok(balanceTextSpan, 'متن مانده باید در نوار بسته وجود داشته باشد');
          balanceTextSpan.click();
          await wait(80);
          assert.ok(stmtPanel.querySelector('header + div button[title="بستن این سطر"]'),
            'لمس روی هر نقطه از نوار بسته باید بخش جمع را دوباره باز کند');

          const closeStmtBtn = stmtPanel.querySelector('button[title="بستن پنل صورتحساب"]');
          if (closeStmtBtn) {
            closeStmtBtn.click();
            await wait(20);
            const stmtGhost = document.querySelector('.hesabno-account-statement-panel.hesabno-fullpage-ghost');
            assert.ok(stmtGhost, 'کپی خروج پنجره صورتحساب باید کلاس hesabno-fullpage-ghost بگیرد');
            assert.equal(stmtGhost.childElementCount, 0, 'خروج فقط پوسته‌ی سبک پنجره را کپی می‌کند، نه جدول کامل گزارش را');
            assert.equal(window.getComputedStyle(stmtGhost).width, '100%', 'پنجره صورتحساب هنگام بسته شدن نباید کوچک شود');
            assert.equal(window.getComputedStyle(stmtGhost).borderRadius, '0px', 'پنجره صورتحساب هنگام بسته شدن نباید گوشه‌گرد و وسط‌چین شود');
            await wait(80);
          }

          // با بستن صورتحساب، کاربر به همان کادر وسط «موجودی نقد و بانک» با سایز فیکس و اسکرول داخلی برمی‌گردد
          const liqHeroModal = document.querySelector('[data-hesabno-dashboard-hero-modal="true"]:not(.hesabno-overlay-ghost)');
          const liqHeroCard = liqHeroModal && liqHeroModal.querySelector('[data-hesabno-dashboard-hero-modal-card="true"]');
          assert.ok(liqHeroModal && liqHeroCard, 'پس از بستن صورتحساب، کادر وسط موجودی نقد و بانک باید همچنان باز باشد');
          assert.equal(liqHeroModal.classList.contains('hesabno-fullpage-layer'), false, 'کادر موجودی نقد و بانک نباید تمام‌صفحه شود بلکه باید وسط صفحه باز شود');
          assert.equal(window.getComputedStyle(liqHeroModal).alignItems, 'center', 'کادر موجودی نقد و بانک باید وسط صفحه تراز شود');
          assert.equal(window.getComputedStyle(liqHeroCard).maxWidth, '28rem', 'عرض کادر موجودی نقد و بانک باید فیکس (28rem) باشد');
          assert.equal(window.getComputedStyle(liqHeroCard).height, '74vh', 'ارتفاع کادر موجودی نقد و بانک باید فیکس (74vh) باشد');
          assert.equal(window.getComputedStyle(liqHeroCard).minHeight, '74vh', 'حداقل ارتفاع کادر موجودی نقد و بانک باید فیکس (74vh) باشد');
          assert.equal(window.getComputedStyle(liqHeroCard).maxHeight, '74vh', 'حداکثر ارتفاع کادر موجودی نقد و بانک باید فیکس (74vh) باشد');
          const liqList = liqHeroCard.querySelector('div.grow.overflow-y-auto');
          assert.ok(liqList, 'لیست حساب‌ها در کادر موجودی نقد و بانک باید وجود داشته باشد');
          assert.equal(window.getComputedStyle(liqList).overflowY, 'auto', 'لیست حساب‌ها در کادر موجودی باید قابل اسکرول باشد');
          assert.equal(window.getComputedStyle(liqList).maxHeight, 'none', 'سقف ارتفاع لیست داخلی باید برداشته شود تا کل فضای کادر فیکس را پوشش دهد');

          // بستن کادر موجودی با لمس بیرون کادر (backdrop)
          liqHeroModal.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
          await wait(80);
          assert.equal(!!document.querySelector('[data-hesabno-dashboard-hero-modal="true"]:not(.hesabno-overlay-ghost)'), false, 'لمس بیرون کادر موجودی باید پنجره را ببندد');

          // باز کردن کادر «هزینه‌ها و درآمدها» از داشبورد، بررسی سایز فیکس و برگشت از ویرایش سند به همان کادر وسط
          const expenseHero = Array.from(document.querySelectorAll('div.cursor-pointer')).find((el) => normalize(el.textContent).includes('هزینه') && !normalize(el.textContent).includes('موجودی') && !normalize(el.textContent).includes('هزینه‌های امروز'));
          if (expenseHero) {
            expenseHero.click();
            await wait(80);
            let d9Modal = document.querySelector('[data-hesabno-dashboard-hero-modal="true"]:not(.hesabno-overlay-ghost)');
            let d9Card = d9Modal && d9Modal.querySelector('[data-hesabno-dashboard-hero-modal-card="true"]');
            assert.ok(d9Modal && d9Card, 'کادر هزینه‌ها و درآمدها باید وسط صفحه باز شود');
            assert.equal(d9Modal.classList.contains('hesabno-fullpage-layer'), false, 'کادر هزینه‌ها و درآمدها نباید تمام‌صفحه شود');
            assert.equal(window.getComputedStyle(d9Card).height, '74vh', 'ارتفاع کادر هزینه‌ها و درآمدها باید فیکس (74vh) باشد');
            const d9MonthBtn = Array.from(d9Card.querySelectorAll('button')).find((b) => normalize(b.textContent).includes('ماهانه'));
            if (d9MonthBtn) {
              d9MonthBtn.click();
              await wait(60);
            }
            const d9Row = d9Card.querySelector('div.grow.overflow-y-auto div.cursor-pointer');
            if (d9Row) {
              assert.equal(window.getComputedStyle(d9Row).flexShrink, '0', 'سطرهای لیست داخل کادر فیکس نباید جمع شوند تا اسکرول کار کند');
              d9Row.click();
              await wait(80);
              const vqBackBtn = document.querySelector('div.absolute.inset-0.z-50 header button[aria-label="بستن"]');
              assert.ok(vqBackBtn, 'کلیک روی ردیف هزینه باید فرم ویرایش سند را باز کند');
              vqBackBtn.click();
              await wait(80);
              d9Modal = document.querySelector('[data-hesabno-dashboard-hero-modal="true"]:not(.hesabno-overlay-ghost)');
              assert.ok(d9Modal && !d9Modal.closest('.hidden'), 'با زدن دکمه برگشت در ویرایش سند، کاربر باید به همان کادر وسط هزینه‌ها و درآمدها برگردد');
            }
            d9Modal.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
            await wait(80);
            assert.equal(!!document.querySelector('[data-hesabno-dashboard-hero-modal="true"]:not(.hesabno-overlay-ghost)'), false, 'لمس بیرون کادر هزینه‌ها و درآمدها باید پنجره را ببندد');
          }
        }
      }

      // ۱۳. در «گزارش مانده ها» باز کردن جزئیات هر حساب باید لوگوی حساب مقابل را در ردیف‌های تراکنش نشان دهد نه لوگوی خود حساب بازشده
      const repTabBtn = Array.from(document.querySelectorAll('nav button')).find((b) => normalize(b.textContent).includes('گزارش'));
      if (repTabBtn) {
        repTabBtn.click();
        await wait(120);
        const advModeBtn = Array.from(document.querySelectorAll('button')).find((b) => normalize(b.textContent) === 'پیشرفته');
        if (advModeBtn) {
          advModeBtn.click();
          await wait(100);
        }
        const balReportBtn = Array.from(document.querySelectorAll('button, div.cursor-pointer')).find((el) => normalize(el.textContent).includes('گزارش مانده'));
        assert.ok(balReportBtn, 'گزینه گزارش مانده ها باید در بخش گزارش‌های پیشرفته وجود داشته باشد');
        balReportBtn.click();
        await wait(100);

        const cashGroup = Array.from(document.querySelectorAll('div.cursor-pointer, button')).find((el) => normalize(el.textContent).includes('صندوق‌ها'));
        assert.ok(cashGroup, 'سرفصل صندوق‌ها باید در گزارش مانده ها وجود داشته باشد');
        cashGroup.click();
        await wait(100);

        const mainCash = Array.from(document.querySelectorAll('div.cursor-pointer')).find((el) => normalize(el.textContent).includes('صندوق اصلی') && !el.querySelector('div.cursor-pointer'));
        assert.ok(mainCash, 'ردیف صندوق اصلی باید در گزارش مانده ها وجود داشته باشد');
        mainCash.click();
        await wait(100);

        const counterpartyBoxes = Array.from(document.querySelectorAll('[data-hesabno-counterparty-account]'));
        assert.ok(counterpartyBoxes.length >= 1, 'ردیف‌های تراکنش در جزئیات حساب گزارش مانده ها باید دارای لوگوی حساب مقابل باشند');
        for (const box of counterpartyBoxes) {
          const cpName = normalize(box.getAttribute('data-hesabno-counterparty-account'));
          assert.notEqual(cpName, 'صندوق اصلی', 'در پنجره جزئیات صندوق اصلی، لوگوی ردیف تراکنش باید متعلق به حساب مقابل باشد نه خود صندوق اصلی');
        }

        // ۱۴. در «ترازنامه آزمایشی» (هر دو حالت ۲ ستونه و ۴ ستونه) همه سلول‌های th و td.font-mono باید display: table-cell داشته باشند تا ستون‌ها بهم نریزند
        const closeDetailBtn = document.querySelector('div.fixed.inset-0 button');
        if (closeDetailBtn) {
          closeDetailBtn.click();
          await wait(80);
        }
        const backToReportsBtn = document.querySelector('button[title="بازگشت به منوی گزارش‌ها"]');
        if (backToReportsBtn) {
          backToReportsBtn.click();
          await wait(80);
        }
        const trialBalanceBtn = Array.from(document.querySelectorAll('button, div.cursor-pointer')).find((el) => normalize(el.textContent).includes('ترازنامه آزمایشی'));
        if (trialBalanceBtn) {
          trialBalanceBtn.click();
          await wait(100);
          for (const modeLabel of ['۲ ستونه', '۴ ستونه']) {
            const modeBtn = Array.from(document.querySelectorAll('button')).find((b) => normalize(b.textContent) === modeLabel);
            assert.ok(modeBtn, `دکمه ${modeLabel} در ترازنامه آزمایشی باید وجود داشته باشد`);
            modeBtn.click();
            await wait(60);
            const cells = Array.from(document.querySelectorAll('main table th, main table td'));
            assert.ok(cells.length >= 9, `جدول ترازنامه آزمایشی در حالت ${modeLabel} باید سلول داشته باشد`);
            for (const cell of cells) {
              assert.equal(window.getComputedStyle(cell).display, 'table-cell',
                `سلول جدول ترازنامه آزمایشی در حالت ${modeLabel} باید table-cell بماند و inline-block نشود`);
            }
          }
        }

        // ۱۵. در «پشتیبان‌گیری و بازیابی داده‌ها» بخش «پشتیبان‌گیری ابری گوگل درایو» باید اتصال، همگام‌سازی و بازیابی را با سپر سلامت انجام دهد
        const moreTabBtn = Array.from(document.querySelectorAll('nav button')).find((b) => normalize(b.textContent) === 'بیشتر');
        if (moreTabBtn) {
          moreTabBtn.click();
          await wait(100);
          const rootEl = document.getElementById('root');
          const backupMenuBtn = Array.from(rootEl.querySelectorAll('button, div.cursor-pointer')).find((el) => normalize(el.textContent).includes('پشتیبان‌گیری'));
          if (backupMenuBtn) {
            backupMenuBtn.click();
            await wait(100);
            const gdriveBackupCard = document.querySelector('[data-hesabno-gdrive-card="backup"]');
            assert.ok(gdriveBackupCard, 'کارت پشتیبان‌گیری ابری گوگل درایو باید در تب پشتیبان‌گیری وجود داشته باشد');
            const syncBtn = gdriveBackupCard.querySelector('[data-hesabno-gdrive-sync="true"]');
            assert.ok(syncBtn, 'دکمه اتصال و ذخیره در گوگل درایو باید وجود داشته باشد');
            syncBtn.click();
            await wait(80);
            const badge = gdriveBackupCard.querySelector('[data-hesabno-gdrive-badge]');
            assert.equal(badge && badge.getAttribute('data-hesabno-gdrive-badge'), 'connected', 'پس از اتصال، وضعیت گوگل درایو باید متصل شود');

            const restoreTabBtn = Array.from(document.querySelectorAll('button')).find((b) => normalize(b.textContent).includes('بازیابی و معادل‌سازی'));
            assert.ok(restoreTabBtn, 'تب بازیابی و معادل‌سازی باید وجود داشته باشد');
            restoreTabBtn.click();
            await wait(80);
            const gdriveRestoreCard = document.querySelector('[data-hesabno-gdrive-card="restore"]');
            assert.ok(gdriveRestoreCard, 'کارت بازیابی ابری از گوگل درایو باید در تب بازیابی وجود داشته باشد');
            const restoreConnectedBtn = gdriveRestoreCard.querySelector('[data-hesabno-gdrive-restore-connected="true"]');
            assert.ok(restoreConnectedBtn, 'دکمه دریافت آخرین نسخه از گوگل درایو متصل باید نمایش داده شود');
            restoreConnectedBtn.click();
            await wait(120);
            assert.ok(normalize(document.body.textContent).includes('سپر سلامت فایل: ساختار فایل سالم و معتبر است'),
              'فراخوانی پشتیبان از گوگل درایو باید فایل را از سپر سلامت عبور داده و آماده بازیابی کند');

            // ۱۷. آنالیز فایل پشتیبان واقعی SQLite پارمیس (.par نسخه ۱۰) روی دکمه پارمیس و ۱۱ تب کامل
            const parmisCard = document.getElementById('hn-parmis-card');
            assert.ok(parmisCard, 'کارت ورود و آنالیز فایل پشتیبان پارمیس (.par) باید در تب بازیابی وجود داشته باشد');
            assert.equal(parmisCard.getAttribute('style'), null, 'کارت پارمیس نباید style درون‌خطی داشته باشد');
            const parmisOpenBtn = document.getElementById('hn-parmis-open-btn');
            assert.ok(parmisOpenBtn, 'دکمه باز کردن ابزار ورود پارمیس باید روی کارت وجود داشته باشد');
            parmisOpenBtn.click();
            const parmisOv = document.getElementById('hn-parmis-ov');
            assert.ok(parmisOv, 'با کلیک روی دکمه پارمیس، پنجره کامل نسخه ۱۰ پارمیس (#hn-parmis-ov) باید باز شود');

            const SQL = await window.__hesabnoInitSqlJs();
            const sqliteDb = new SQL.Database();
            sqliteDb.run(`
              CREATE TABLE FiscalYear (fiscal_id INTEGER, fiscal_name TEXT, fiscal_beginDate TEXT, fiscal_endDate TEXT, fiscal_status INTEGER);
              INSERT INTO FiscalYear VALUES (1, '1405', '1405/01/01', '1405/12/29', 1);
              CREATE TABLE Bank (id INTEGER, Bank_name TEXT, imageName TEXT, systematic INTEGER);
              INSERT INTO Bank VALUES (1, 'بانک سامان', 'saman.png', 1);
              CREATE TABLE accounts (Ac_id INTEGER, Ac_parent_id INTEGER, Ac_title TEXT, Ac_balance REAL, Ac_isSystematic INTEGER, ac_icon TEXT, Ac_fav TEXT, Ac_pin INTEGER, Ac_info TEXT);
              INSERT INTO accounts VALUES (1, 0, 'هزینه‌ها', 0, 1, '', '0', 0, '');
              INSERT INTO accounts VALUES (4, 0, 'بانک‌ها', 0, 1, '', '0', 0, '');
              INSERT INTO accounts VALUES (10, 4, 'بانک سامان پارمیس', 0, 0, '', '0', 0, '');
              INSERT INTO accounts VALUES (20, 1, 'هزینه ایاب و ذهاب پارمیس', 0, 0, '', '0', 0, '');
              CREATE TABLE BankAccounts (BAc_id INTEGER, BAc_ac_id INTEGER, BAc_bank_id INTEGER, BAc_info TEXT, BAc_sheba TEXT, BAc_cart_number TEXT, BAc_account_cod TEXT, BAc_branch_name TEXT, read_sms INTEGER, BAc_isenable INTEGER);
              INSERT INTO BankAccounts VALUES (1, 10, 1, 'حساب اصلی سامان', 'IR120560000000001234567890', '6219861012345678', '123456', 'مرکزی', 1, 1);
              CREATE TABLE Activity (Act_id INTEGER, Act_ser INTEGER, Act_date TEXT, Act_time TEXT, Act_amount REAL, Act_info TEXT, RecivePath TEXT, PayPath TEXT, Act_accRecive_id INTEGER, Act_rec_Subacc_id INTEGER, Act_rec_Root_id INTEGER, Act_accPay_id INTEGER, Act_pay_Subacc_id INTEGER, Act_pay_Root_id INTEGER, Act_attribute INTEGER, Act_set INTEGER, Act_cheq_id INTEGER, Act_isCheq_passed INTEGER, Act_Fiscal_id INTEGER, Act_multiId INTEGER, Act_multiType INTEGER, Act_accMember_id INTEGER, Act_latitude TEXT, Act_longitude TEXT);
              INSERT INTO Activity VALUES (1, 101, '1405/07/20', '14:30', 450000, 'تاکسی اینترنتی پارمیس', '4,10', '1,20', 10, 10, 4, 20, 20, 1, 0, 1, 0, 0, 1, 0, 0, 0, NULL, NULL);
            `);
            const sqliteBytes = sqliteDb.export();
            sqliteDb.close();

            const parFile = new window.File([sqliteBytes], 'backup-parmis-v10.par', { type: 'application/octet-stream' });
            await window.__hesabnoAnalyzeParmisFile(parFile);
            await wait(80);
            assert.equal(parmisOv.querySelectorAll('[style]').length, 0, 'پنجره نسخه ۱۰ پارمیس نباید هیچ style درون‌خطی داشته باشد');
            const tabButtons = parmisOv.querySelectorAll('.tab');
            assert.equal(tabButtons.length, 11, 'هر ۱۱ تب نسخه ۱۰ پارمیس باید نمایش داده شوند');
            const mappingBox = document.querySelector('[data-hesabno-parmis-mapping-box="true"]');
            assert.ok(mappingBox, 'پس از آنالیز فایل .par پارمیس، جعبه معادل‌سازی حساب‌های فایل باید نمایش داده شود');
            assert.ok(mappingBox.querySelector('[data-hesabno-map-select="بانک سامان پارمیس"]'),
              'انتخابگر معادل‌سازی برای حساب‌های استخراج‌شده از دیتابیس SQLite پارمیس باید وجود داشته باشد');
            parmisOv.remove();
          }
        }

        // ۱۶. در اولین ورود (#hesabno-first-run)، صفحه بازیابی از گوگل درایو باید یک مرحله قبل از وارد کردن اطلاعات باشد و دکمه بازگشت در صفحه اطلاعات به آن برگردد
        const frOverlay = document.getElementById('hesabno-first-run');
        assert.ok(frOverlay, 'لایه شروع کار (#hesabno-first-run) باید در اولین اجرا وجود داشته باشد');
        assert.equal(frOverlay.querySelectorAll('[style]').length, 0, 'لایه شروع کار نباید هیچ style درون‌خطی داشته باشد');
        const frCard = frOverlay.querySelector('.hesabno-fr-card');
        assert.equal(frCard.getAttribute('data-hesabno-fr-active-step'), 'restore',
          'مرحله اول قبل از وارد کردن اطلاعات باید صفحه بازیابی از گوگل درایو باشد');

        const goProfileBtn = frOverlay.querySelector('[data-hesabno-fr-go-profile="true"]');
        assert.ok(goProfileBtn, 'دکمه رفتن به صفحه وارد کردن اطلاعات کاربری باید وجود داشته باشد');
        goProfileBtn.click();
        assert.equal(frCard.getAttribute('data-hesabno-fr-active-step'), 'profile',
          'با زدن دکمه ادامه، صفحه وارد کردن اطلاعات کاربری باید باز شود');

        // پس از تکمیل اطلاعات کاربری در فرم ورود، باید مرحله ۳ (لیست سطح دسترسی‌ها همراه با دلیل هر دسترسی در زیر آن) باز شود
        const frFirstInput = frOverlay.querySelector('#hesabno-fr-first');
        const frLastInput = frOverlay.querySelector('#hesabno-fr-last');
        assert.ok(frFirstInput && frLastInput, 'فیلدهای نام و نام خانوادگی در فرم ورود باید وجود داشته باشند');
        frFirstInput.value = 'علی';
        frLastInput.value = 'رضایی';
        await wait(280);
        frCard.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
        await wait(280);
        assert.equal(frCard.getAttribute('data-hesabno-fr-active-step'), 'permissions',
          'پس از تکمیل اطلاعات فرم ورود، مرحله لیست دسترسی‌ها باید باز شود');

        const permsListEl = frOverlay.querySelector('[data-hesabno-fr-perms-list="true"]');
        assert.ok(permsListEl, 'لیست دسترسی‌ها در مرحله سوم فرم ورود باید وجود داشته باشد');
        for (const permKey of ['notifications', 'sms', 'camera', 'storage']) {
          const itemEl = permsListEl.querySelector(`[data-hesabno-fr-perm-item="${permKey}"]`);
          const reasonEl = permsListEl.querySelector(`[data-hesabno-fr-perm-reason="${permKey}"]`);
          const swEl = permsListEl.querySelector(`[data-hesabno-fr-perm-key="${permKey}"]`);
          assert.ok(itemEl && reasonEl && swEl, `ردیف، کلید و دلیل دسترسی «${permKey}» باید در لیست فرم ورود وجود داشته باشد`);
          assert.ok((reasonEl.textContent || '').trim().length > 15, `توضیح دلیل نیاز به دسترسی «${permKey}» باید در زیر عنوان آن نوشته شده باشد`);
        }

        // دکمه «بعدی» زیر لیست دسترسی‌ها باید فقط به فرم تنظیمات نهایی برود و اجازه ورود مستقیم ندهد.
        const nextFromPermsBtn = frOverlay.querySelector('[data-hesabno-fr-next-from-perms="true"]');
        assert.ok(nextFromPermsBtn && (nextFromPermsBtn.textContent || '').includes('بعدی'),
          'زیر لیست دسترسی‌ها باید گزینه «بعدی» وجود داشته باشد');
        nextFromPermsBtn.click();
        assert.equal(frCard.getAttribute('data-hesabno-fr-active-step'), 'preferences',
          'زدن «بعدی» در مرحله دسترسی‌ها باید فرم زمان یادآوری روزانه، چک و وام و واحد پول را باز کند');
        await wait(280);

        const currRialBtn = frOverlay.querySelector('[data-hesabno-fr-currency="rial"]');
        const currTomanBtn = frOverlay.querySelector('[data-hesabno-fr-currency="toman"]');
        const dailyToggleBtn = frOverlay.querySelector('[data-hesabno-fr-daily-toggle="true"]');
        const dailyTimeInput = frOverlay.querySelector('#hesabno-fr-reminder-time');
        const checkDays3Btn = frOverlay.querySelector('[data-hesabno-fr-check-days="3"]');
        const checkDays5Btn = frOverlay.querySelector('[data-hesabno-fr-check-days="5"]');
        assert.ok(currRialBtn && currTomanBtn && dailyToggleBtn && dailyTimeInput && checkDays3Btn && checkDays5Btn,
          'در فرم تنظیمات اولیه باید انتخاب واحد پول، زمان یادآوری روزانه و یادآوری چک وام و قسط وجود داشته باشد');

        const backToPermsBtn = frOverlay.querySelector('[data-hesabno-fr-back-perms="true"]');
        assert.ok(backToPermsBtn, 'دکمه بازگشت به مرحله دسترسی‌ها باید وجود داشته باشد');
        backToPermsBtn.click();
        assert.equal(frCard.getAttribute('data-hesabno-fr-active-step'), 'permissions',
          'زدن بازگشت در فرم یادآورها باید به مرحله دسترسی‌ها برگردد');
        await wait(280);

        const backToProfileBtn = frOverlay.querySelector('[data-hesabno-fr-back-profile="true"]');
        assert.ok(backToProfileBtn, 'دکمه بازگشت به ویرایش مشخصات در صفحه دسترسی‌های فرم ورود باید وجود داشته باشد');
        backToProfileBtn.click();
        assert.equal(frCard.getAttribute('data-hesabno-fr-active-step'), 'profile',
          'زدن دکمه بازگشت در صفحه دسترسی‌ها باید کاربر را به صفحه مشخصات برگرداند');
        await wait(280);

        const backToRestoreBtn = frOverlay.querySelector('[data-hesabno-fr-back-restore="true"]');
        assert.ok(backToRestoreBtn, 'در صفحه وارد کردن اطلاعات باید دکمه بازگشت به صفحه بازیابی از گوگل درایو وجود داشته باشد');
        backToRestoreBtn.click();
        assert.equal(frCard.getAttribute('data-hesabno-fr-active-step'), 'restore',
          'زدن دکمه بازگشت در صفحه اطلاعات باید کاربر را به صفحه بازیابی از گوگل درایو برگرداند');

        // حتی پس از بازیابی بک‌آپ، ورود به برنامه باید فقط پس از عبور از پروفایل، دسترسی‌ها و تنظیمات نهایی ممکن باشد.
        const frGdriveBtn = frOverlay.querySelector('[data-hesabno-fr-gdrive-btn="true"]');
        assert.ok(frGdriveBtn, 'دکمه بازیابی اطلاعات از گوگل درایو در صفحه اول شروع کار باید وجود داشته باشد');
        frGdriveBtn.click();
        await wait(60);
        assert.equal(frCard.getAttribute('data-hesabno-fr-active-step'), 'restore',
          'بازیابی بک‌آپ نباید بدون کلیک «بعدی» از صفحه بازیابی عبور کند');
        assert.equal(frCard.getAttribute('data-hesabno-fr-restored'), 'true',
          'حالت بازیابی از بک‌آپ باید روی کارت ثبت شود');
        assert.notEqual(window.localStorage.getItem('hesabno:first_run_profile_done'), '1',
          'پرچم تکمیل موجود در بک‌آپ نباید مسیر شروع کار را دور بزند');
        frOverlay.querySelector('[data-hesabno-fr-go-profile="true"]').click();
        assert.equal(frCard.getAttribute('data-hesabno-fr-active-step'), 'profile');
        const restoredFirst = frOverlay.querySelector('#hesabno-fr-first');
        const restoredLast = frOverlay.querySelector('#hesabno-fr-last');
        if (!normalize(restoredFirst.value)) restoredFirst.value = 'علی';
        if (!normalize(restoredLast.value)) restoredLast.value = 'رضایی';
        await wait(280);
        frCard.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
        await wait(280);
        assert.equal(frCard.getAttribute('data-hesabno-fr-active-step'), 'permissions',
          'پس از کلیک «بعدی» روی پروفایل، مرحله دسترسی‌ها باید باز شود');
        nextFromPermsBtn.click();
        assert.equal(frCard.getAttribute('data-hesabno-fr-active-step'), 'preferences',
          'دکمه «بعدی» دسترسی‌ها باید تنظیمات نهایی را نشان دهد و ورود مستقیم نکند');
        await wait(280);
        assert.equal(document.getElementById('hesabno-first-run'), frOverlay,
          'پنجره شروع کار تا تکمیل صفحه نهایی باید باز بماند');
        assert.notEqual(window.localStorage.getItem('hesabno:first_run_profile_done'), '1');
        frOverlay.querySelector('[data-hesabno-fr-finish="true"]').click();
        await wait(40);
        assert.equal(document.getElementById('hesabno-first-run'), null,
          'ورود به برنامه فقط پس از تکمیل آخرین صفحه مجاز است');
        assert.equal(window.localStorage.getItem('hesabno:first_run_profile_done'), '1',
          'پس از تکمیل همه مراحل، پرچم شروع کار ثبت می‌شود');

        // ۱۸. کلیک روی انتخاب تصویر پیوست باید پنجرهٔ «دوربین یا گالری» (#hesabno-attachment-source-modal) را بدون style درون‌خطی باز کند و عکس دوربین را تحویل دهد
        const dummyLabel = document.createElement('label');
        const dummyFileInput = document.createElement('input');
        dummyFileInput.type = 'file';
        dummyFileInput.setAttribute('accept', 'image/*');
        let receivedCameraFile = null;
        dummyFileInput.addEventListener('change', () => {
          receivedCameraFile = dummyFileInput.files && dummyFileInput.files[0];
        });
        dummyLabel.appendChild(dummyFileInput);
        document.body.appendChild(dummyLabel);

        dummyLabel.click();
        const attModal = document.getElementById('hesabno-attachment-source-modal');
        assert.ok(attModal, 'با کلیک روی انتخاب تصویر پیوست، پنجرهٔ انتخاب دوربین یا گالری باید باز شود');
        assert.equal(attModal.querySelectorAll('[style]').length, 0,
          'پنجرهٔ انتخاب دوربین یا گالری نباید هیچ style درون‌خطی داشته باشد');
        const camBtn = attModal.querySelector('[data-hesabno-att-source="camera"]');
        const galBtn = attModal.querySelector('[data-hesabno-att-source="gallery"]');
        assert.ok(camBtn && galBtn, 'هر دو گزینهٔ ثبت عکس با دوربین و انتخاب از گالری باید وجود داشته باشند');
        camBtn.click();
        assert.equal(document.getElementById('hesabno-attachment-source-modal'), null,
          'پس از انتخاب دوربین، پنجرهٔ انتخاب منبع باید بسته شود');

        const tinyJpegDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
        window.__hesabnoReceiveCameraPhoto(tinyJpegDataUrl, 'receipt-cam.jpg');
        await wait(30);
        assert.ok(receivedCameraFile, 'تصویر ثبت‌شده با دوربین باید به ورودی فایل پیوست تحویل داده شود');
        assert.equal(receivedCameraFile.name, 'receipt-cam.jpg');
        dummyLabel.remove();

        // ۱۹. دریافت خودکار پیامک‌های بانکی از گوشی و افزودن به صندوق پیام‌بانک بدون تکرار
        const addedSmsCount = window.__hesabnoIngestNativeSmsJson(JSON.stringify([
          {
            id: 'native-sms-9001',
            address: '982000',
            body: 'بانک ملت\nبرداشت از حساب: ۴۹۲۱\nمبلغ: ۳,۷۵۰,۰۰۰ ریال\nمانده: ۱۸,۲۰۰,۰۰۰ ریال\nبابت: خرید فروشگاه',
            date: Date.now(),
          },
        ]));
        assert.equal(addedSmsCount, 1, 'پیامک بانکی خوانده‌شده از گوشی باید به صندوق پیام‌بانک اضافه شود');
        const duplicateSmsCount = window.__hesabnoIngestNativeSmsJson(JSON.stringify([
          {
            id: 'native-sms-9001',
            address: '982000',
            body: 'بانک ملت\nبرداشت از حساب: ۴۹۲۱\nمبلغ: ۳,۷۵۰,۰۰۰ ریال\nمانده: ۱۸,۲۰۰,۰۰۰ ریال\nبابت: خرید فروشگاه',
            date: Date.now(),
          },
        ]));
        assert.equal(duplicateSmsCount, 0, 'پیامک بانکی تکراری نباید دوباره اضافه شود');

        // ۲۰. متن ثابت اعلان روزانه («وقتشه حسابامونو صاف کنیم» و زیرنویس «یادآوری ثبت روزانه») و ارسال به پل اعلان اندروید
        let lastNotifSent = null;
        window.HnBridge.showNotification = (title, body) => {
          lastNotifSent = { title, body };
          return true;
        };
        const savedRem = window.__hesabnoGetReminderCustomText();
        assert.equal(savedRem.title, 'وقتشه حسابامونو صاف کنیم');
        assert.equal(savedRem.body, 'یادآوری ثبت روزانه');
        const sendRes = window.__hesabnoSendCustomNotification();
        assert.equal(sendRes.ok, true);
        assert.deepEqual(lastNotifSent, {
          title: 'وقتشه حسابامونو صاف کنیم',
          body: 'یادآوری ثبت روزانه',
        }, 'اعلان روزانه باید دقیقاً با عنوان «وقتشه حسابامونو صاف کنیم» و زیرنویس «یادآوری ثبت روزانه» ارسال شود');

        // ۲۱. اعلان ۴ روز عدم ورود به برنامه («حساب کتاب رفته مرخصی؟😂» و زیرنویس «بیا دوباره مرتبش کنیم»)
        const inactCfg = window.__hesabnoGetInactivityReminderText();
        assert.equal(inactCfg.days, 4);
        assert.equal(inactCfg.title, 'حساب کتاب رفته مرخصی؟😂');
        assert.equal(inactCfg.body, 'بیا دوباره مرتبش کنیم');
        lastNotifSent = null;
        const before4Days = window.__hesabnoCheckInactivityReminder(1000, 1000 + 3 * 86400 * 1000);
        assert.equal(before4Days.ok, false, 'قبل از گذشت ۴ روز کامل نباید اعلان عدم ورود ارسال شود');
        assert.equal(lastNotifSent, null);
        const after4Days = window.__hesabnoCheckInactivityReminder(1000, 1000 + 4 * 86400 * 1000);
        assert.equal(after4Days.ok, true, 'پس از گذشت ۴ روز کامل عدم ورود، اعلان باید ارسال شود');
        assert.deepEqual(lastNotifSent, {
          title: 'حساب کتاب رفته مرخصی؟😂',
          body: 'بیا دوباره مرتبش کنیم',
        }, 'اعلان ۴ روز عدم ورود باید با عنوان «حساب کتاب رفته مرخصی؟😂» و زیرنویس «بیا دوباره مرتبش کنیم» ارسال شود');

        // ۲۲. اعلان‌های ۵ مرحله‌ای چک صیادی با شرط روزهای تنظیمات، زیرنویس حساب تفصیلی و ورود مستقیم به بخش چک‌ها
        const sampleCheckTx = {
          id: 'chk-tx-501',
          type: 'expense',
          method: 'check',
          category: 'لباس',
          account: 'اسناد پرداختنی',
          amount: 15000000,
          date: '1405/07/25',
          check: {
            number: '998877',
            dueDate: '1405/08/05',
            status: 'issued',
          },
        };

        // وقتی کاربر ۵ روز قبل را انتخاب کرده: در ۵ روز قبل (1405/07/30) اعلان شماره ۱ باید بیاید، اما در ۳ روز قبل نباید بیاید
        const stg1At5 = window.__hesabnoBuildCheckNotification(sampleCheckTx, '1405/07/30', 5);
        assert.deepEqual(stg1At5, {
          stage: 1,
          diffDays: 5,
          title: 'چک داره از راه می‌رسه! 🚶',
          body: 'چک (لباس) • سررسید: ۱۴۰۵/۰۸/۰۵',
          target: 'checks',
          checkId: 'chk-tx-501',
        });
        assert.equal(window.__hesabnoBuildCheckNotification(sampleCheckTx, '1405/08/02', 5), null,
          'وقتی کاربر ۵ روز قبل را انتخاب کرده، اعلان شماره ۱ نباید دوباره در ۳ روز قبل ارسال شود');

        // وقتی کاربر ۳ روز قبل را انتخاب کرده:
        assert.equal(window.__hesabnoBuildCheckNotification(sampleCheckTx, '1405/08/02', 3).title, 'چک داره از راه می‌رسه! 🚶');
        assert.equal(window.__hesabnoBuildCheckNotification(sampleCheckTx, '1405/08/03', 3).title, 'چک رو بذار توی لیست کارات! 📝');
        assert.equal(window.__hesabnoBuildCheckNotification(sampleCheckTx, '1405/08/04', 3).title, 'فردا قرار چکی داریم! 😉');
        assert.equal(window.__hesabnoBuildCheckNotification(sampleCheckTx, '1405/08/05', 3).title, 'امروز موعد چکه؛ غافلگیر نشی! ⏰');

        // وقتی کاربر ۱ روز قبل را انتخاب کرده: شماره ۱ و ۲ نباید ارسال شوند
        assert.equal(window.__hesabnoBuildCheckNotification(sampleCheckTx, '1405/08/02', 1), null,
          'با تنظیم ۱ روز قبل، اعلان شماره ۱ نباید ارسال شود');
        assert.equal(window.__hesabnoBuildCheckNotification(sampleCheckTx, '1405/08/03', 1), null,
          'با تنظیم ۱ روز قبل، اعلان شماره ۲ نباید ارسال شود');
        assert.equal(window.__hesabnoBuildCheckNotification(sampleCheckTx, '1405/08/04', 1).title, 'فردا قرار چکی داریم! 😉');

        // مرحله ۵ (بعد از سررسید): اول ۱ روز بعد از سررسید (+1 = 1405/08/06) و بعد هر ۳ روز یک‌بار (+4 = 1405/08/09 و +7 = 1405/08/12)
        assert.equal(window.__hesabnoBuildCheckNotification(sampleCheckTx, '1405/08/06', 3).title, 'چکه هنوز منتظر پیگیریته! 👀');
        assert.equal(window.__hesabnoBuildCheckNotification(sampleCheckTx, '1405/08/07', 3), null, 'روز دوم بعد از سررسید نباید اعلان ارسال شود');
        assert.equal(window.__hesabnoBuildCheckNotification(sampleCheckTx, '1405/08/08', 3), null, 'روز سوم بعد از سررسید نباید اعلان ارسال شود');
        assert.equal(window.__hesabnoBuildCheckNotification(sampleCheckTx, '1405/08/09', 3).title, 'چکه هنوز منتظر پیگیریته! 👀');
        assert.equal(window.__hesabnoBuildCheckNotification(sampleCheckTx, '1405/08/12', 3).title, 'چکه هنوز منتظر پیگیریته! 👀');

        // لمس اعلان چک باید کاربر را مستقیماً وارد بخش «مدیریت چک‌ها» کند
        window.__hesabnoOpenChecksFromNotification();
        await wait(60);
        assert.ok(document.body.textContent.includes('مدیریت چک‌ها'),
          'با لمس اعلان چک، صفحه مدیریت چک‌ها باید باز شود');

        // ۲۳) قرمز شدن کادر فیلدهای اجباری خالی هنگام زدن دکمه ثبت در فرم ثبت وام و سایر فرم‌های برنامه (Task 56)
        window.__hesabnoOpenDashboardFromNotification();
        await wait(60);
        const moreNavBtn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'بیشتر');
        if (moreNavBtn) {
          moreNavBtn.click();
          await wait(60);
        }
        const loansMenuBtn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('وام و اقساط'));
        assert.ok(loansMenuBtn, 'دکمه وام و اقساط در بخش بیشتر باید وجود داشته باشد');
        loansMenuBtn.click();
        await wait(80);
        const addLoanBtn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('ثبت وام جدید'));
        assert.ok(addLoanBtn, 'دکمه ثبت وام جدید باید در صفحه وام‌ها وجود داشته باشد');
        addLoanBtn.click();
        await wait(120);

        const loanNameInput = document.querySelector('input[placeholder*="وام مسکن"]');
        const loanTotalInput = document.querySelector('input[placeholder*="۵۰,۰۰۰,۰۰۰"]');
        const loanCountInput = document.querySelector('input[placeholder*="۱۲"]');
        const loanInstInput = document.querySelector('input[placeholder="مبلغ قسط"]');
        const loanSubmitBtn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('ثبت وام و زمان‌بندی اقساط'));

        assert.ok(loanNameInput && loanTotalInput && loanCountInput && loanInstInput && loanSubmitBtn,
          'فیلدهای اجباری و دکمه ثبت فرم وام باید در DOM باشند');

        loanSubmitBtn.click();
        await wait(80);

        for (const [label, el] of [
          ['نام وام یا تسهیلات', loanNameInput],
          ['مبلغ اصل وام دریافتی', loanTotalInput],
          ['تعداد اقساط', loanCountInput],
          ['مبلغ هر قسط', loanInstInput],
        ]) {
          assert.equal(el.getAttribute('aria-invalid'), 'true', `فیلد اجباری خالی «${label}» پس از زدن ثبت باید aria-invalid="true" بگیرد`);
          assert.equal(el.getAttribute('data-hesabno-invalid'), 'true', `فیلد اجباری خالی «${label}» پس از زدن ثبت باید data-hesabno-invalid="true" بگیرد`);
          assert.ok(el.classList.contains('border-rose-500/80'), `کادر فیلد اجباری خالی «${label}» پس از زدن ثبت باید کلاس قرمز border-rose-500/80 بگیرد`);
          assert.equal(window.getComputedStyle(el).borderColor, 'rgba(244, 63, 94, 0.85)',
            `رنگ کادر محاسبه‌شده فیلد اجباری خالی «${label}» باید قرمز باشد`);
        }

        // به محض پر شدن فیلد، کادر قرمز آن باید برطرف شود
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(loanNameInput, 'وام مسکن');
        loanNameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
        await wait(60);
        assert.notEqual(loanNameInput.getAttribute('data-hesabno-invalid'), 'true',
          'پس از وارد کردن نام وام، وضعیت نامعتبر آن باید پاک شود');
        assert.equal(loanTotalInput.getAttribute('data-hesabno-invalid'), 'true',
          'سایر فیلدهای اجباری که هنوز خالی هستند باید همچنان کادر قرمز داشته باشند');

        // ۲۴) حذف بخش هشدار از فرم ثبت وام و اقساط و پیروی از هشدار یکپارچه «چک وام و قسط» (Task 57)
        assert.equal(document.body.textContent.includes('تنظیم یادآور سررسید اقساط'), false,
          'بخش هشدار مجزا در فرم ثبت وام و اقساط نباید وجود داشته باشد');
        assert.equal(document.body.textContent.includes('هشدار و یادآوری قبل از موعد سررسید'), false,
          'گزینه هشدار مجزا در فرم ثبت وام و اقساط نباید وجود داشته باشد');

        window.__hesabnoOpenDashboardFromNotification();
        await wait(60);
        const moreNavBtn2 = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'بیشتر');
        if (moreNavBtn2) {
          moreNavBtn2.click();
          await wait(60);
        }
        const settingsBtn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('تنظیمات پایه'));
        if (settingsBtn) {
          settingsBtn.click();
          await wait(80);
          const notifRow = document.querySelector('#setting-row-notifications');
          assert.ok(notifRow && (notifRow.textContent || '').includes('چک وام و قسط'),
            'ردیف اعلان‌ها در تنظیمات باید عبارت «چک وام و قسط» را نمایش دهد');
          notifRow.click();
          await wait(80);
          const notifTabs = [...document.querySelectorAll('.hesabno-notification-tab')].map((el) => (el.textContent || '').trim());
          assert.ok(notifTabs.includes('چک وام و قسط'),
            'تب دوم تنظیمات اعلان‌ها باید «چک وام و قسط» نام‌گذاری شده باشد');
        }

        // ۲۵) اعلان‌های ۴ مرحله‌ای اقساط وام و خرید اقساطی و هدایت مستقیم به بخش وام و اقساط (Task 58)
        assert.equal(typeof window.__hesabnoBuildInstallmentNotification, 'function',
          'سازنده اعلان ۴ مرحله‌ای قسط باید تعریف شده باشد');
        assert.equal(typeof window.__hesabnoEvaluateInstallmentNotifications, 'function',
          'ارزیاب اعلان‌های قسط باید تعریف شده باشد');
        assert.equal(typeof window.__hesabnoOpenLoansFromNotification, 'function',
          'هدایت‌کننده اعلان قسط به بخش وام و اقساط باید تعریف شده باشد');

        const sampleLoan = { id: 'loan-notif-1', title: 'وام مسکن بانک مسکن', type: 'bank_loan', status: 'active' };
        const sampleInst = { id: 'inst-notif-1', loanId: 'loan-notif-1', installmentNumber: 1, amount: 8500000, dueDate: '1405/08/05', status: 'pending' };

        // مرحله ۱ (۳ روز مانده با تنظیم پیش‌فرض ۳ روز)
        const instStg1 = window.__hesabnoBuildInstallmentNotification(sampleInst, sampleLoan, '1405/08/02', 3);
        assert.ok(instStg1 && instStg1.stage === 1, 'مرحله ۱ قسط در فاصله ۳ روز مانده باید فعال شود');
        assert.equal(instStg1.title, 'یه قسط تو راهه؛ از الان آماده‌ای؟ 👀');
        assert.equal(instStg1.body, 'قسط (وام مسکن بانک مسکن) • سررسید: ۱۴۰۵/۰۸/۰۵');
        assert.equal(instStg1.target, 'loans');

        // در فاصله ۲ روز مانده وقتی تنظیم روی ۳ روز است نباید تکراری بفرستد، اما اگر تنظیم روی ۲ روز باشد مرحله ۱ فعال می‌شود
        assert.equal(window.__hesabnoBuildInstallmentNotification(sampleInst, sampleLoan, '1405/08/03', 3), null);
        const instStg1When2 = window.__hesabnoBuildInstallmentNotification(sampleInst, sampleLoan, '1405/08/03', 2);
        assert.ok(instStg1When2 && instStg1When2.stage === 1, 'وقتی هشدار روی ۲ روز تنظیم شده، مرحله ۱ در ۲ روز مانده فعال می‌شود');

        // مرحله ۲ (۱ روز مانده به سررسید)
        const instStg2 = window.__hesabnoBuildInstallmentNotification(sampleInst, sampleLoan, '1405/08/04', 3);
        assert.ok(instStg2 && instStg2.stage === 2, 'مرحله ۲ قسط در ۱ روز مانده باید فعال شود');
        assert.equal(instStg2.title, 'فردا موعد قسطته؛ یادت نره! ⏰');

        // مرحله ۳ (روز سررسید)
        const instStg3 = window.__hesabnoBuildInstallmentNotification(sampleInst, sampleLoan, '1405/08/05', 3);
        assert.ok(instStg3 && instStg3.stage === 3, 'مرحله ۳ قسط در روز سررسید باید فعال شود');
        assert.equal(instStg3.title, 'امروز موعد پرداختته؛ حواست هست؟ 🔔');

        // مرحله ۴ (۱ روز پس از سررسید و سپس هر ۳ روز یک‌بار تا زمان تسویه)
        const instStg4Day1 = window.__hesabnoBuildInstallmentNotification(sampleInst, sampleLoan, '1405/08/06', 3);
        assert.ok(instStg4Day1 && instStg4Day1.stage === 4, 'مرحله ۴ قسط در ۱ روز پس از سررسید باید فعال شود');
        assert.equal(instStg4Day1.title, 'این قسط هنوز تسویه نشده! یه بررسیش کن. 🙈');
        assert.equal(window.__hesabnoBuildInstallmentNotification(sampleInst, sampleLoan, '1405/08/07', 3), null,
          '۲ روز پس از سررسید نباید اعلان مرحله ۴ ارسال شود');
        assert.equal(window.__hesabnoBuildInstallmentNotification(sampleInst, sampleLoan, '1405/08/08', 3), null,
          '۳ روز پس از سررسید نباید اعلان مرحله ۴ ارسال شود');
        const instStg4Day4 = window.__hesabnoBuildInstallmentNotification(sampleInst, sampleLoan, '1405/08/09', 3);
        assert.ok(instStg4Day4 && instStg4Day4.stage === 4, '۴ روز پس از سررسید (۳ روز بعد از مرحله اول دیرکرد) باید دوباره مرحله ۴ فعال شود');

        // قسط پرداخت‌شده نباید اعلان بفرستد
        assert.equal(window.__hesabnoBuildInstallmentNotification({ ...sampleInst, status: 'paid' }, sampleLoan, '1405/08/05', 3), null,
          'قسط تسویه‌شده نباید هیچ اعلانی تولید کند');

        // هدایت به صفحه وام و اقساط با کلیک روی اعلان قسط
        const openedLoans = window.__hesabnoOpenLoansFromNotification();
        await wait(80);
        assert.equal(openedLoans, true, 'فراخوانی هدایت اعلان قسط باید true برگرداند');
        assert.ok(document.body.textContent.includes('وام و تسهیلات') || document.body.textContent.includes('ثبت وام جدید'),
          'ضربه روی اعلان قسط باید کاربر را مستقیماً به بخش وام و اقساط ببرد');

        // ۲۶) اعلان پیامک بانکی و باز شدن مستقیم فرم ثبت سند با نوع، مبلغ و بانک پیش‌فرض (Task 58)
        assert.equal(typeof window.__hesabnoBuildSmsNotification, 'function',
          'سازنده اعلان پیامک بانکی باید تعریف شده باشد');
        assert.equal(typeof window.__hesabnoOpenSmsFromNotification, 'function',
          'هدایت‌کننده اعلان پیامک بانکی به فرم ثبت سند باید تعریف شده باشد');

        const sentTargetNotifs = [];
        window.HnBridge = {
          showNotificationWithTarget: (title, body, target) => {
            sentTargetNotifs.push({ title, body, target });
            return true;
          },
        };

        // ۱. پیامک برداشت از بانک ملت
        window.__hesabnoOnNativeSmsReceived('98200033', 'بانک ملت\nبرداشت مبلغ 4,500,000 ریال\nمانده: 12,000,000 ریال', 1729368001000);
        await wait(60);
        assert.equal(sentTargetNotifs.length, 1, 'دریافت پیامک بانکی جدید باید یک اعلان ارسال کند');
        assert.equal(sentTargetNotifs[0].title, 'پیامکش اومد؛ ثبتش نمیکنی؟');
        assert.equal(sentTargetNotifs[0].body, 'بانک ملت');
        assert.equal(sentTargetNotifs[0].target, 'sms:native-sms-1729368001000');

        // ضربه روی اعلان پیامک برداشت -> باز شدن مستقیم ثبت سند روی «ثبت پرداخت» با مبلغ و بانک ملت
        const openedExpenseSms = window.__hesabnoOpenSmsFromNotification('native-sms-1729368001000');
        await wait(100);
        assert.equal(openedExpenseSms, true, 'ضربه روی اعلان پیامک برداشت باید فرم ثبت سند را باز کند');
        const amountInputExp = document.getElementById('field-amount-input');
        const walletBtnExp = document.getElementById('field-wallet');
        assert.ok(amountInputExp, 'فیلد مبلغ در فرم ثبت سند باید باز شده باشد');
        assert.equal(amountInputExp.value.replace(/[^\d۰-۹]/g, ''), '۴۵۰۰۰۰۰',
          'مبلغ پیامک برداشت باید در فیلد مبلغ فرم ثبت سند قرار گرفته باشد');
        assert.ok(walletBtnExp && (walletBtnExp.textContent || '').includes('بانک ملت'),
          'حساب بانکی «بانک ملت» باید در فیلد از حساب فرم ثبت پرداخت انتخاب شده باشد');
        assert.ok(document.body.textContent.includes('از حساب:'),
          'فرم ثبت سند برای پیامک برداشت باید در حالت «ثبت پرداخت» (از حساب:) باشد');

        // ۲. پیامک واریز به بانک سامان
        window.__hesabnoOnNativeSmsReceived('98200077', 'بانک سامان\nواریز به حساب\nمبلغ: 65,000,000 ریال\nمانده: 84,000,000 ریال', 1729368002000);
        await wait(60);
        assert.equal(sentTargetNotifs.length, 2, 'دریافت پیامک واریز بانکی باید اعلان دوم را ارسال کند');
        assert.equal(sentTargetNotifs[1].title, 'پیامکش اومد؛ ثبتش نمیکنی؟');
        assert.equal(sentTargetNotifs[1].body, 'بانک سامان');
        assert.equal(sentTargetNotifs[1].target, 'sms:native-sms-1729368002000');

        // ضربه روی اعلان پیامک واریز -> باز شدن مستقیم ثبت سند روی «ثبت دریافت» با مبلغ و بانک سامان
        const openedIncomeSms = window.__hesabnoOpenSmsFromNotification('native-sms-1729368002000');
        await wait(100);
        assert.equal(openedIncomeSms, true, 'ضربه روی اعلان پیامک واریز باید فرم ثبت سند را باز کند');
        const amountInputInc = document.getElementById('field-amount-input');
        const walletBtnInc = document.getElementById('field-wallet');
        assert.ok(amountInputInc, 'فیلد مبلغ در فرم ثبت دریافت باید وجود داشته باشد');
        assert.equal(amountInputInc.value.replace(/[^\d۰-۹]/g, ''), '۶۵۰۰۰۰۰۰',
          'مبلغ پیامک واریز باید در فیلد مبلغ فرم ثبت دریافت قرار گرفته باشد');
        assert.ok(walletBtnInc && (walletBtnInc.textContent || '').includes('بانک سامان'),
          'حساب بانکی «بانک سامان» باید در فیلد به حساب فرم ثبت دریافت انتخاب شده باشد');
        assert.ok(document.body.textContent.includes('به حساب:'),
          'فرم ثبت سند برای پیامک واریز باید در حالت «ثبت دریافت» (به حساب:) باشد');

        // ۲۷) همگام‌سازی واقعی وضعیت گزینه‌های «مدیریت دسترسی‌ها» در تب «بیشتر» و ارسال درخواست مجوز به گوشی (Task 59)
        let deviceNotifGranted = false;
        let deviceSmsGranted = false;
        let deviceCamGranted = false;
        let requestedNotifCount = 0;
        let requestedSmsCount = 0;
        let requestedCamCount = 0;

        window.HnBridge = {
          hasNotificationPermission: () => deviceNotifGranted,
          requestNotificationPermission: () => {
            requestedNotifCount += 1;
            return false; // منتظر تأیید کاربر در پنجره سیستم اندروید
          },
          hasSmsPermission: () => deviceSmsGranted,
          requestSmsPermission: () => {
            requestedSmsCount += 1;
            return false;
          },
          hasCameraPermission: () => deviceCamGranted,
          requestCameraPermission: () => {
            requestedCamCount += 1;
            return false;
          },
          hasStoragePermission: () => true,
        };

        // بستن فرم ثبت سند و رفتن به تب «بیشتر» -> «مدیریت دسترسی‌ها»
        window.__hesabnoNavigateToPage('more');
        await wait(80);
        const managePermsBtn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('مدیریت دسترسی‌ها'));
        assert.ok(managePermsBtn, 'گزینه «مدیریت دسترسی‌ها» در تب بیشتر باید وجود داشته باشد');
        managePermsBtn.click();
        await wait(80);

        const notifSwitch = document.querySelector('button[data-hesabno-permission-key="notifications"]');
        const smsSwitch = document.querySelector('button[data-hesabno-permission-key="sms"]');
        const camSwitch = document.querySelector('button[data-hesabno-permission-key="camera"]');
        assert.ok(notifSwitch && smsSwitch && camSwitch, 'کلیدهای اعلان، پیامک و دوربین باید در پنجره مدیریت دسترسی‌ها وجود داشته باشند');

        // وقتی دسترسی در گوشی داده نشده، تیک/سوییچ آن‌ها نباید فعال باشد
        assert.equal(notifSwitch.getAttribute('aria-checked'), 'false',
          'وقتی دسترسی اعلان در گوشی داده نشده، گزینه اعلان نباید فعال باشد');
        assert.equal(smsSwitch.getAttribute('aria-checked'), 'false',
          'وقتی دسترسی پیامک در گوشی داده نشده، گزینه پیامک نباید فعال باشد');
        assert.equal(camSwitch.getAttribute('aria-checked'), 'false',
          'وقتی دسترسی دوربین در گوشی داده نشده، گزینه دوربین نباید فعال باشد');

        // کلیک روی اعلان -> ارسال درخواست مجوز به گوشی (بدون فعال شدن کاذب پیش از تأیید کاربر)
        notifSwitch.click();
        await wait(60);
        assert.equal(requestedNotifCount, 1, 'کلیک روی گزینه غیرفعال اعلان باید درخواست مجوز را به گوشی بفرستد');
        assert.equal(notifSwitch.getAttribute('aria-checked'), 'false',
          'تا پیش از تأیید کاربر در پنجره گوشی، گزینه اعلان نباید به صورت کاذب تیک بخورد');

        // شبیه‌سازی تأیید مجوز اعلان توسط کاربر روی گوشی
        deviceNotifGranted = true;
        window.__hesabnoOnNativePermissionResult('notifications', true);
        await wait(60);
        assert.equal(notifSwitch.getAttribute('aria-checked'), 'true',
          'پس از تأیید مجوز اعلان در گوشی، گزینه اعلان باید فعال شود');

        // کلیک روی پیامک و دوربین -> ارسال درخواست مجوز به گوشی و فعال شدن پس از تأیید
        smsSwitch.click();
        await wait(50);
        assert.equal(requestedSmsCount, 1, 'کلیک روی گزینه پیامک باید درخواست مجوز پیامک را به گوشی بفرستد');
        deviceSmsGranted = true;
        window.__hesabnoOnNativePermissionResult('sms', true);
        await wait(50);
        assert.equal(smsSwitch.getAttribute('aria-checked'), 'true',
          'پس از تأیید مجوز پیامک در گوشی، گزینه پیامک باید فعال شود');

        camSwitch.click();
        await wait(50);
        assert.equal(requestedCamCount, 1, 'کلیک روی گزینه دوربین باید درخواست مجوز دوربین را به گوشی بفرستد');
        deviceCamGranted = true;
        window.__hesabnoOnNativePermissionResult('camera', true);
        await wait(50);
        assert.equal(camSwitch.getAttribute('aria-checked'), 'true',
          'پس از تأیید مجوز دوربین در گوشی، گزینه دوربین باید فعال شود');

        delete window.HnBridge;

        /* ۲۸. بخش کاربری (پروفایل): دکمه «ذخیره و تأیید» در پایین صفحه اطلاعات را ثبت کرده و از بخش کاربری خارج می‌شود */
        const moreTabBtn2 = [...document.querySelectorAll('nav button')]
          .find((b) => (b.textContent || '').includes('بیشتر'));
        if (moreTabBtn2) {
          moreTabBtn2.click();
          await wait(60);
        }
        const openProfileBtn = document.querySelector('[title="مشاهده و ویرایش پروفایل کاربری"]') ||
          [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('ویرایش پروفایل'));
        assert.ok(openProfileBtn, 'دکمه ورود به بخش کاربری (پروفایل) باید وجود داشته باشد');
        openProfileBtn.click();
        await wait(80);

        const profileSaveConfirmBtn = document.querySelector('button.hesabno-sticky-page-submit[data-hesabno-profile-save-confirm="true"]');
        assert.ok(profileSaveConfirmBtn, 'دکمه پایین صفحه «ذخیره و تأیید» در بخش کاربری باید وجود داشته باشد');
        assert.equal((profileSaveConfirmBtn.textContent || '').trim(), 'ذخیره و تأیید',
          'متن دکمه پایین بخش کاربری باید دقیقاً «ذخیره و تأیید» باشد');

        profileSaveConfirmBtn.click();
        await wait(80);
        assert.equal(document.querySelector('button[data-hesabno-profile-save-confirm="true"]'), null,
          'پس از زدن «ذخیره و تأیید»، اطلاعات باید ثبت شده و از بخش کاربری خارج شود');

        /* ۲۹. خروجی PDF و اشتراک‌گذاری سریع صورتحساب در پنل صورتحساب (A9) */
        const shareResult = window.__hesabnoShareOrExportStatement(
          'صندوق اصلی',
          [{ id: 777, documentNumber: 777, date: '1405/07/27', title: 'واریز آزمایشی', amount: 4500000, runningBalance: 4500000 }],
          'ریال',
          { totalDebit: 4500000, totalCredit: 0, finalBalance: 4500000 }
        );
        assert.ok(shareResult && shareResult.file && shareResult.summaryText,
          'خروجی PDF و متن خلاصه صورتحساب باید تولید شود');
        assert.ok(shareResult.summaryText.includes('📊 صورتحساب: صندوق اصلی') && shareResult.summaryText.includes('مانده نهایی'),
          'متن خلاصه صورتحساب باید شامل عنوان حساب و مانده نهایی برای اشتراک‌گذاری باشد');

        /* ۳۰. جستجوی سراسری سریع در بالای صفحه تراکنش‌ها بر اساس مبلغ، شماره چک و شماره سند */
        const txNavBtn = [...document.querySelectorAll('nav button')]
          .find((b) => (b.textContent || '').includes('تراکنش'));
        if (txNavBtn) {
          txNavBtn.click();
          await wait(80);
          const globalSearchInput = document.getElementById('transactions-global-search-input');
          assert.ok(globalSearchInput, 'فیلد جستجوی سراسری سریع در بالای صفحه تراکنش‌ها باید وجود داشته باشد');
          assert.ok((globalSearchInput.getAttribute('placeholder') || '').includes('شماره چک'),
            'راهنمای جستجوی سراسری باید اشاره به مبلغ، شماره چک و شماره سند داشته باشد');
        }

        /* ۳۱. قفل امنیتی ورود به برنامه با اثر انگشت و رمز ۴ رقمی (#hesabno-app-lock-overlay) */
        window.__safeSet('hesabno:lock', 'true');
        window.__safeSet('hesabno:pin', '2580');
        window.__safeSet('hesabno:biometric', 'true');
        window.__hesabnoLockApp();
        await wait(60);

        const lockOverlay = document.getElementById('hesabno-app-lock-overlay');
        assert.ok(lockOverlay, 'لایه قفل امنیتی برنامه باید نمایش داده شود');
        const bioUnlockBtn = document.getElementById('hesabno-biometric-unlock-btn');
        assert.ok(bioUnlockBtn, 'دکمه «بازگشایی با اثر انگشت» باید در قفل برنامه وجود داشته باشد');

        // تست رمز اشتباه (1111)
        const key1 = lockOverlay.querySelector('[data-hesabno-lock-key="1"]');
        key1.click(); await wait(20);
        key1.click(); await wait(20);
        key1.click(); await wait(20);
        key1.click(); await wait(40);
        assert.ok(document.querySelector('[data-hesabno-lock-error="true"]'),
          'وارد کردن رمز ۴ رقمی اشتباه باید پیام خطا نمایش دهد و قفل را باز نکند');
        assert.ok(document.getElementById('hesabno-app-lock-overlay'),
          'با رمز اشتباه قفل برنامه باید همچنان بسته بماند');

        // تست رمز صحیح (2580)
        lockOverlay.querySelector('[data-hesabno-lock-key="2"]').click(); await wait(20);
        lockOverlay.querySelector('[data-hesabno-lock-key="5"]').click(); await wait(20);
        lockOverlay.querySelector('[data-hesabno-lock-key="8"]').click(); await wait(20);
        lockOverlay.querySelector('[data-hesabno-lock-key="0"]').click(); await wait(50);
        assert.equal(document.getElementById('hesabno-app-lock-overlay'), null,
          'وارد کردن رمز ۴ رقمی صحیح باید قفل برنامه را باز کند');

        // تست بازگشایی زیستی: نبود Bridge یا پاسخ ناموفق نباید قفل را باز کند.
        window.__hesabnoLockApp();
        await wait(50);
        assert.ok(document.getElementById('hesabno-app-lock-overlay'), 'قفل برنامه دوباره فعال شد');
        window.HnBridge = undefined;
        document.getElementById('hesabno-biometric-unlock-btn').click();
        await wait(50);
        assert.ok(document.getElementById('hesabno-app-lock-overlay'),
          'در وب، نبود احراز هویت بومی نباید دکمه اثر انگشت را به مسیر ورود تبدیل کند');
        assert.ok(document.querySelector('[data-hesabno-lock-error="true"]'),
          'در دسترس نبودن اثر انگشت باید به‌عنوان شکست احراز هویت اعلام شود');
        window.__hesabnoOnBiometricAuthResult('true');
        await wait(30);
        assert.ok(document.getElementById('hesabno-app-lock-overlay'),
          'پاسخ غیر Boolean از callback اثر انگشت نباید قفل را باز کند');

        // فقط پاسخ موفق واقعیِ Bridge می‌تواند قفل را باز کند.
        window.HnBridge = { authenticateBiometric: () => window.__hesabnoOnBiometricAuthResult(true) };
        document.getElementById('hesabno-biometric-unlock-btn').click();
        await wait(50);
        assert.equal(document.getElementById('hesabno-app-lock-overlay'), null,
          'فقط نتیجه موفق احراز هویت زیستی باید قفل برنامه را باز کند');
        window.__safeSet('hesabno:lock', 'false');

        /* ۳۲. تب بیشتر: نمایش نسخه دقیق نرم‌افزار در پایین تب بیشتر به جای «نسخه همراه» */
        window.HnBridge = { getAppVersionName: () => '1.0.2' };
        const moreTabBtn3 = [...document.querySelectorAll('nav button')]
          .find((b) => (b.textContent || '').includes('بیشتر'));
        if (moreTabBtn3) {
          moreTabBtn3.click();
          await wait(70);
          const moreVerNode = document.querySelector('[data-hesabno-more-version="true"]');
          assert.ok(moreVerNode, 'نشانگر نسخه نرم‌افزار در پایین تب بیشتر باید وجود داشته باشد');
          assert.equal((moreVerNode.textContent || '').trim(), 'My Money · نسخه ۱.۰.۲',
            'پایین تب بیشتر باید نسخه دقیق نرم‌افزار (مثلاً «My Money · نسخه ۱.۰.۲») را نمایش دهد');
        }
        delete window.HnBridge;
      }
    }
  }
});




