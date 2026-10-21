/*
 * قاعدهٔ ثابت: «کد» فقط داخل خودِ حساب
 *
 * کاربر: «کد ریشه رو قرار بود از همه جا بردای و فقط تو دل حساب وجود داشته باشه».
 * این آزمون سه چیز را قفل می‌کند:
 *   ۱. هیچ لایه‌ای (جز بستهٔ اصلی ۰۶۷) برچسب «کد …» / «کد ریشه …» نمی‌سازد؛
 *      بقیهٔ برچسب‌های باقی‌مانده را فقط لایهٔ ۰۹۹ پنهان می‌کند.
 *   ۲. پنل «پرداخت جایگزین چک برگشتی» (۱۴۴) و انتخابگر حسابش هیچ کدی نشان نمی‌دهند.
 *   ۳. شمارش‌های «N سرفصل/حساب» و «تفصیلی N» پنهان نمی‌شوند و داخل صورت‌حساب
 *      (پنل حساب) کد دست‌نخورده می‌ماند.
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

const persianToday = (() => {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => (parts.find((part) => part.type === type) || {}).value;
  return `${get('year')}/${get('month')}/${get('day')}`;
})();

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

  const count = [...main.querySelectorAll('p, span, div')]
    .find((node) => node.firstElementChild === null && /^[\d۰-۹٠-٩]+\s+سرفصل\/حساب$/.test(normalize(node.textContent)));
  assert.ok(count, 'شمارش «N سرفصل/حساب» باید در صفحه بماند');
  assert.ok(isVisible(window, count), 'شمارش حساب‌ها نباید با پنهان‌کردن کدها پنهان شود');

  const detail = [...main.querySelectorAll('p, span')]
    .find((node) => node.firstElementChild === null && /^تفصیلی [\d۰-۹٠-٩]+$/.test(normalize(node.textContent)) && isVisible(window, node));
  assert.ok(detail, 'برچسب «تفصیلی N» باید دیده شود');
});

test('لایهٔ ۰۹۹ کد را بیرون حساب پنهان می‌کند و داخل صورت‌حساب نگه می‌دارد', { timeout: 90000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({ storage: FIRST_RUN_DONE });
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
  const statement = document.createElement('div');
  statement.className = 'hesabno-account-statement-panel';
  host.appendChild(statement);
  const insideCode = make('p', 'کد 11001', statement);

  await wait(500);
  assert.equal(plainCode.style.display, 'none', '«کد 11001» بیرون از حساب باید پنهان شود');
  assert.equal(rootCode.style.display, 'none', '«کد ریشه: 110/120» باید پنهان شود');
  assert.equal(normalize(withDetails.textContent), 'تفصیلی ۳', 'ردیف کد باید به «تفصیلی N» تبدیل شود');
  assert.notEqual(withDetails.style.display, 'none', '«تفصیلی N» باید دیده شود');
  assert.notEqual(countLine.style.display, 'none', 'شمارش «N سرفصل/حساب» نباید پنهان شود');
  assert.notEqual(insideCode.style.display, 'none', 'داخل صورت‌حساب، کد حساب باید بماند');

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
    date: persianToday,
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
