/*
 * آزمون رفتار واقعی کارت بالای داشبورد (hero):
 *   • در حالت «ماه» برچسب‌ها «این ماه» و مقادیر جمع کل ماه هستند.
 *   • با انتخاب «امروز» در مودال هزینه‌ها/درآمدها، برچسب‌ها «امروز» می‌شوند
 *     و مقادیر فقط جمع امروز را نشان می‌دهند (باگ: قبلاً همیشه «این ماه» می‌ماند).
 *
 * این آزمون کل اپلیکیشن را با jsdom بوت می‌کند و از همان index.html و اسکریپت‌های
 * واقعی استفاده می‌کند؛ منابع از دیسک خوانده می‌شوند تا به شبکه/سرور نیاز نباشد.
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

/** تاریخ شمسی امروز، دقیقاً با همان روش تولید (Intl با تقویم فارسی و منطقه تهران). */
function persianToday() {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const pick = (type) => (parts.find((part) => part.type === type) || {}).value;
  return { year: pick('year') || '1405', month: pick('month') || '01', day: pick('day') || '01' };
}

function heroSnapshot(window) {
  const document = window.document;
  return {
    labels: [...document.querySelectorAll('.hero-label')].slice(0, 2).map((el) => normalize(el.textContent)),
    income: normalize((document.querySelector('.hero-income-value') || {}).textContent),
    expense: normalize((document.querySelector('.hero-expense-value') || {}).textContent),
  };
}

test('hero card follows the selected dashboard period (today vs month)', { timeout: 90000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');

  const today = persianToday();
  const todayDate = `${today.year}/${today.month}/${today.day}`;
  // روز دیگری از همان ماه (اگر امروز اول ماه است، روز دوم؛ در غیر این صورت روز اول).
  const otherDate = `${today.year}/${today.month}/${today.day === '01' ? '02' : '01'}`;

  const seed = [
    { id: 990001, type: 'income', amount: 1000000, date: todayDate, title: 'درآمد امروز — آزمون دوره', account: 'بانک ملت' },
    { id: 990002, type: 'income', amount: 2000000, date: otherDate, title: 'درآمد روز دیگر ماه — آزمون دوره', account: 'بانک ملت' },
    { id: 990003, type: 'expense', amount: 500000, date: otherDate, title: 'هزینه روز دیگر ماه — آزمون دوره', account: 'بانک ملت' },
  ];

  const dom = await bootApp({ seed });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const document = window.document;

  const month = heroSnapshot(window);
  const dashboardDate = document.querySelector('.hesabno-dashboard-date-value');
  assert.ok(dashboardDate, 'تاریخ داشبورد باید وجود داشته باشد');
  const dateNumberRuns = [...dashboardDate.querySelectorAll('[data-hesabno-unified-number-font="true"]')];
  assert.ok(dateNumberRuns.length >= 2, 'روز و سال تاریخ داشبورد باید فونت monospace بگیرند');
  assert.ok(dateNumberRuns.every((node) => node.classList.contains('font-mono') && node.getAttribute('dir') === 'ltr'));
  assert.ok([...dashboardDate.childNodes].some((node) => node.nodeType === 3 && /[آ-ی]/.test(node.textContent)),
    'متن فارسی روز و ماه در تاریخ داشبورد نباید فونت monospace بگیرد');
  for (const selector of ['.hero-balance-value', '.hero-income-value', '.hero-expense-value']) {
    const amount = document.querySelector(selector);
    assert.ok(amount, `${selector} باید در کارت داشبورد باشد`);
    assert.equal(amount.classList.contains('font-mono'), true,
      `${selector} باید فونت monospace قبلی را حفظ کند`);
    assert.equal(amount.getAttribute('dir'), 'ltr',
      `${selector} باید ترتیب ارقام و جداکننده‌ها را از چپ به راست حفظ کند`);
  }
  assert.deepEqual(month.labels, ['درآمد این ماه', 'هزینه این ماه'], 'حالت پیش‌فرض ماهانه است');
  assert.equal(month.income, '۳،۰۰۰،۰۰۰', 'درآمد ماه باید جمع هر سه ردیف درآمد باشد');
  assert.equal(month.expense, '۵۰۰،۰۰۰', 'هزینه ماه باید جمع هزینه‌های ماه باشد');

  // باز کردن مودال با کلیک روی ردیف هزینه و انتخاب «امروز»
  const expenseRow = [...document.querySelectorAll('div')].find(
    (el) => /cursor-pointer/.test(String(el.className)) && normalize(el.textContent).startsWith('هزینه این ماه'),
  );
  assert.ok(expenseRow, 'ردیف «هزینه این ماه» باید در کارت پیدا شود');
  expenseRow.click();
  await wait(600);

  const todayButton = [...document.querySelectorAll('button')].find(
    (button) => normalize(button.textContent).startsWith('امروز (') && !/ساعتی/.test(normalize(button.textContent)),
  );
  assert.ok(todayButton, 'دکمه‌ی «امروز» در مودال باید وجود داشته باشد');
  todayButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  await wait(600);

  const todayView = heroSnapshot(window);
  assert.deepEqual(todayView.labels, ['درآمد امروز', 'هزینه امروز'], 'با انتخاب «امروز»، برچسب‌ها باید «امروز» شوند');
  assert.equal(todayView.income, '۱،۰۰۰،۰۰۰', 'در حالت امروز فقط درآمد امروز نمایش داده می‌شود');
  assert.equal(todayView.expense, '۰', 'هزینه‌ی امروز جدا از هزینه‌های ماه است');
  assert.equal(window.localStorage.getItem('hesabno:dashboardPeriod'), 'today', 'انتخاب دوره باید ذخیره شود');

  // اطمینان از اینکه بستن مودال با دکمه‌ی بستن ممکن است (بدون تغییر رفتار قبلی)
  const closeButton = document.querySelector('[title="بستن"]');
  assert.ok(closeButton || buttonByText(document, 'بستن'), 'دکمه‌ی بستن مودال باید وجود داشته باشد');
});
