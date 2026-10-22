/*
 * آزمون‌های سرتاسری فرم «وام و اقساط» روی همان اپلیکیشن واقعی (index.html + jsdom):
 *   • کادر نام در باز شدن فرم قرمز نیست؛ فقط بعد از زدن «ثبت» و خالی بودن نام قرمز می‌شود
 *     و با تایپ پاک می‌شود (پاسخ به «چرا کادر نام قرمز است؟»).
 *   • «حساب واریز مبلغ وام» خالی باز می‌شود و کاربر باید خودش انتخاب کند؛ ثبت بدون آن
 *     با پیام روشن متوقف می‌شود.
 *   • دکمه‌ی بک گوشی اول انتخابگر حساب را می‌بندد و از فرم بیرون نمی‌رود.
 *   • دکمه‌ی بک وقتی کیبورد داخلی مبلغ بالاست فقط همان کیبورد را می‌بندد.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { bootApp, closeApp, wait, normalize } = require('./helpers/app-boot.cjs');

let hasJsdom = true;
try {
  require('jsdom');
} catch (error) {
  hasJsdom = false;
}

const root = path.resolve(__dirname, '..');
const FIRST_RUN_DONE = {
  'hesabno:first_run_profile_done': 'true',
  'hesabno:first_run_intro_done': 'true',
};

async function openLoanForm(t) {
  const dom = await bootApp({ storage: FIRST_RUN_DONE });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const d = window.document;
  const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

  const moreBtn = [...d.querySelectorAll('nav.fixed button')].find((button) => normalize(button.textContent) === 'بیشتر');
  assert.ok(moreBtn, 'تب «بیشتر» باید پیدا شود');
  click(moreBtn);
  await wait(900);

  const loansBtn = [...d.querySelectorAll('button')].find((button) => /وام‌ها|مدیریت وام/.test(normalize(button.textContent)));
  assert.ok(loansBtn, 'ورودی بخش وام‌ها باید پیدا شود');
  click(loansBtn);
  await wait(1000);

  const addBtn = [...d.querySelectorAll('button')].find((button) => normalize(button.textContent) === 'ثبت وام جدید');
  assert.ok(addBtn, 'دکمه‌ی «ثبت وام جدید» باید پیدا شود');
  click(addBtn);
  await wait(1200);

  const name = d.querySelector('input[placeholder*="وام مسکن"]');
  const amount = d.querySelector('input[placeholder*="۵۰,۰۰۰,۰۰۰"]');
  const submit = [...d.querySelectorAll('button')].find((button) => normalize(button.textContent) === 'ثبت وام و زمان‌بندی اقساط');
  assert.ok(name, 'فیلد نام وام باید ساخته شود');
  assert.ok(amount, 'فیلد مبلغ اصل وام باید ساخته شود');
  assert.ok(submit, 'دکمه‌ی ثبت فرم باید وجود داشته باشد');

  return { dom, window, d, click, name, amount, submit };
}

function typeInto(window, field, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(field, value);
  field.dispatchEvent(new window.Event('input', { bubbles: true }));
  field.dispatchEvent(new window.Event('change', { bubbles: true }));
}

function messages(d, pattern) {
  return [...d.querySelectorAll('*')]
    .filter((el) => el.children.length === 0 && pattern.test(normalize(el.textContent)))
    .map((el) => normalize(el.textContent));
}

const isRed = (field) => /border-rose-500/.test(String(field.className));

test('فرم وام با نام بدون قرمزی و حساب واریزِ خالی باز می‌شود', { timeout: 120000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const { d, name } = await openLoanForm(t);

  assert.equal(isRed(name), false, 'کادر نام در باز شدن فرم نباید قرمز باشد');
  assert.equal(name.getAttribute('aria-invalid'), null, 'فیلد نامِ دست‌نخورده نباید aria-invalid داشته باشد');

  const deposit = [...d.querySelectorAll('button')].find((button) => /انتخاب حساب دریافت وام|صندوق اصلی/.test(normalize(button.textContent)));
  assert.ok(deposit, 'دکمه‌ی انتخاب حساب واریز باید وجود داشته باشد');
  assert.match(normalize(deposit.textContent), /انتخاب حساب دریافت وام/, 'حساب واریز باید خالی و آماده‌ی انتخاب باشد');
  assert.doesNotMatch(normalize(deposit.textContent), /صندوق اصلی|کد 11001/, 'حساب واریز نباید با حساب پیش‌فرض پر شود');
});

test('قرمزی کادر نام فقط بعد از «ثبت» با نام خالی ظاهر و با تایپ پاک می‌شود', { timeout: 120000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const { window, d, name, submit } = await openLoanForm(t);

  submit.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  await wait(500);

  assert.equal(isRed(name), true, 'بعد از ثبت با نام خالی، کادر نام قرمز می‌شود');
  assert.equal(name.getAttribute('aria-invalid'), 'true');
  assert.ok(messages(d, /لطفاً نام وام یا تسهیلات/).length > 0, 'پیام خطای نام وام باید نمایش داده شود');

  typeInto(window, name, 'وام مسکن');
  await wait(500);
  assert.equal(isRed(name), false, 'با تایپ نام، قرمزی باید پاک شود');
  assert.equal(name.getAttribute('aria-invalid'), null);
});

test('ثبت وام بدون انتخاب حساب واریز با پیام روشن متوقف می‌شود', { timeout: 120000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const { window, d, name, amount, submit } = await openLoanForm(t);

  typeInto(window, name, 'وام آزمون حساب واریز');
  typeInto(window, amount, '50000000');
  await wait(600);

  submit.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  await wait(600);

  assert.ok(messages(d, /لطفاً حساب دریافت وام را انتخاب کنید/).length > 0,
    'نبودِ حساب واریز باید پیام اختصاصی داشته باشد');

  const stored = JSON.parse(window.localStorage.getItem('hesabno:loans') || '[]');
  assert.equal(stored.some((loan) => loan && loan.name === 'وام آزمون حساب واریز'), false,
    'بدون حساب واریز هیچ وامی نباید ذخیره شود');
});

test('بک گوشی در انتخاب حساب، اول همان انتخابگر را می‌بندد و از فرم بیرون نمی‌رود', { timeout: 120000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const { window, d, submit } = await openLoanForm(t);

  const deposit = [...d.querySelectorAll('button')].find((button) => /انتخاب حساب دریافت وام/.test(normalize(button.textContent)));
  deposit.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  await wait(900);
  assert.ok(d.querySelector('.hesabno-fullscreen-selector-overlay'), 'انتخاب‌گر حساب باید باز شود');

  const handled = window.__hesabnoNavigateBack();
  await wait(600);

  assert.equal(handled, true, 'بک باید «انجام شد» برگرداند تا برنامه از فرم خارج نشود');
  assert.equal(d.querySelector('.hesabno-fullscreen-selector-overlay'), null, 'انتخاب‌گر حساب باید بسته شود');
  assert.ok(d.querySelector('main') && normalize(d.body.textContent).includes('ثبت وام و زمان‌بندی اقساط'),
    'کاربر باید در همان فرم وام بماند');
  assert.equal(submit.isConnected, true);
});

test('بک گوشی با کیبورد داخلی باز، فقط کیبورد را می‌بندد و صفحه را عوض نمی‌کند', { timeout: 120000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const { window, d, amount, submit } = await openLoanForm(t);

  amount.dispatchEvent(new window.Event('pointerdown', { bubbles: true, cancelable: true }));
  await wait(300);
  const panel = d.getElementById('hesabno-amount-keyboard');
  assert.ok(panel, 'کیبورد داخلی مبلغ باید ساخته شود');
  assert.equal(panel.hidden, false, 'با لمس مبلغ، کیبورد داخلی باز می‌شود');

  const pageBefore = normalize(d.body.textContent);
  const handled = window.__hesabnoCloseAmountKeyboard();
  await wait(300);

  assert.equal(handled, true);
  assert.equal(panel.hidden, true, 'بک باید فقط کیبورد را ببندد');
  assert.equal(submit.isConnected, true, 'فرم وام باید همان‌جا بماند');
  assert.equal(normalize(d.body.textContent), pageBefore, 'محتوای صفحه نباید عوض شود');
});

test('دکمه‌ی بک اندروید قلاب‌های کیبورد و لایه‌ی رویی را قبل از ناوبری صدا می‌زند', () => {
  const java = fs.readFileSync(path.join(root, 'app/src/main/java/com/maymoney/app/MainActivity.java'), 'utf8');
  const keypadIdx = java.indexOf('__hesabnoCloseAmountKeyboard');
  const layerIdx = java.indexOf('__hesabnoCloseTopLayer');
  const navigateIdx = java.indexOf('window.__hesabnoNavigateBack');
  assert.ok(keypadIdx > 0, 'BACK_JS باید تابع بستن کیبورد داخلی را صدا بزند');
  assert.ok(layerIdx > 0, 'BACK_JS باید تابع بستن لایه‌ی رویی را صدا بزند');
  assert.ok(keypadIdx < navigateIdx, 'بستن کیبورد باید قبل از ناوبری باشد');
  assert.ok(layerIdx < navigateIdx, 'بستن لایه‌ی رویی باید قبل از ناوبری باشد');

  const html = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
  assert.ok(html.includes('237-hesabno-back-priority.js'), 'لایه‌ی اولویت بک باید در index.html بارگذاری شود');

  const keypad = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/214-hesabno-numeric-keyboard.js'), 'utf8');
  assert.match(keypad, /window\.__hesabnoCloseAmountKeyboard\s*=/, 'کیبورد داخلی باید تابع عمومی بستن داشته باشد');

  const accessible = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/198-hesabno-accessible-form-fields.js'), 'utf8');
  assert.match(accessible, /ثبت وام و زمان‌بندی اقساط/, 'فرم وام نباید قرمزکردن موازی داشته باشد');
});

function makeBackLayer(attributes, closeAttributes, order) {
  let connected = true;
  let closeClicks = 0;
  const has = (attrs, name) => Object.prototype.hasOwnProperty.call(attrs, name);
  const get = (attrs, name) => has(attrs, name) ? attrs[name] : null;
  const closeButton = {
    get isConnected() { return connected; },
    getClientRects: () => connected ? [{}] : [],
    hasAttribute: (name) => has(closeAttributes, name),
    getAttribute: (name) => get(closeAttributes, name),
    click: () => { closeClicks += 1; connected = false; },
  };
  const layer = {
    id: get(attributes, 'id') || '',
    hidden: false,
    classList: { contains: () => false },
    get isConnected() { return connected; },
    getClientRects: () => connected ? [{}] : [],
    hasAttribute: (name) => has(attributes, name),
    getAttribute: (name) => get(attributes, name),
    compareDocumentPosition(other) {
      if (this === other) return 0;
      return order < other.__order ? 4 : 2;
    },
    querySelector(selector) {
      if (selector === 'header') return null;
      if (selector === '[data-hesabno-date-picker-close="true"], [data-hesabno-settlement-datepicker-close], [data-return-date-close]') {
        return closeButton.hasAttribute('data-hesabno-date-picker-close') || closeButton.hasAttribute('data-hesabno-settlement-datepicker-close') || closeButton.hasAttribute('data-return-date-close') ? closeButton : null;
      }
      const match = selector.match(/^button\[(aria-label|title)="([^"]+)"\]$/);
      return match && closeButton.getAttribute(match[1]) === match[2] ? closeButton : null;
    },
    querySelectorAll(selector) { return selector === 'button' ? [closeButton] : []; },
    __order: order,
  };
  return { layer, closeButton, reopen() { connected = true; }, get closeClicks() { return closeClicks; } };
}

function bootBackPriorityFixture(layers) {
  let navigationCalls = 0;
  const formState = { date: '1405/07/30', cancelled: false };
  const document = {
    querySelectorAll(selector) {
      return layers.map((item) => item.layer).filter((layer) => {
        if (!layer.isConnected) return false;
        if (selector === '[role="dialog"][aria-modal="true"]') {
          return layer.getAttribute('role') === 'dialog' && layer.getAttribute('aria-modal') === 'true';
        }
        const marker = selector.match(/^\[(data-[\w-]+)="true"\]$/);
        return marker && layer.getAttribute(marker[1]) === 'true';
      });
    },
  };
  const window = {
    __hesabnoCloseAmountKeyboard: () => false,
    __hesabnoNavigateBack: () => {
      navigationCalls += 1;
      formState.date = '1405/08/01';
      formState.cancelled = true;
      return true;
    },
  };
  const source = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/237-hesabno-back-priority.js'), 'utf8');
  vm.runInNewContext(source, { window, document });
  return { window, formState, get navigationCalls() { return navigationCalls; } };
}

/* Mirrors the order in MainActivity.BACK_JS; this is a JS simulation, not a device test. */
function dispatchAndroidBack(window) {
  if (typeof window.__hesabnoCloseAmountKeyboard === 'function' && window.__hesabnoCloseAmountKeyboard()) return true;
  if (typeof window.__hesabnoCloseTopLayer === 'function' && window.__hesabnoCloseTopLayer()) return true;
  return typeof window.__hesabnoNavigateBack === 'function' && window.__hesabnoNavigateBack();
}

test('Back-priority controller closes each of the three date-picker layers before navigation (mock DOM)', () => {
  const cases = [
    ['data-hesabno-settlement-datepicker', 'data-hesabno-settlement-datepicker-close', false],
    ['data-hesabno-return-date-picker', 'data-return-date-close', true],
    ['data-hesabno-transaction-datepicker', 'data-hesabno-date-picker-close', false],
  ];
  for (const [layerMarker, closeMarker, modal] of cases) {
    const attributes = { [layerMarker]: 'true' };
    if (modal) Object.assign(attributes, { role: 'dialog', 'aria-modal': 'true' });
    const picker = makeBackLayer(attributes, { [closeMarker]: '' }, 1);
    const fixture = bootBackPriorityFixture([picker]);

    assert.equal(dispatchAndroidBack(fixture.window), true, `${layerMarker}: Back باید رسیدگی شود`);
    assert.equal(picker.layer.isConnected, false, `${layerMarker}: فقط خود تقویم باید بسته شود`);
    assert.equal(picker.closeClicks, 1, `${layerMarker}: باید دکمهٔ بستن خود تقویم کلیک شود`);
    assert.equal(fixture.navigationCalls, 0, `${layerMarker}: ناوبری صفحه نباید اجرا شود`);
    assert.equal(fixture.formState.date, '1405/07/30', `${layerMarker}: تاریخ نباید تغییر کند`);
    assert.equal(fixture.formState.cancelled, false, `${layerMarker}: فرم زیرین نباید لغو شود`);
  }
});

test('Android BACK_JS order closes a picker once, then restores the original navigation on the next Back', () => {
  const picker = makeBackLayer(
    { 'data-hesabno-transaction-datepicker': 'true' },
    { 'data-hesabno-date-picker-close': 'true' },
    1,
  );
  const fixture = bootBackPriorityFixture([picker]);

  assert.equal(dispatchAndroidBack(fixture.window), true, 'اولین Back باید فقط picker را ببندد');
  assert.equal(picker.layer.isConnected, false);
  assert.equal(picker.closeClicks, 1);
  assert.equal(fixture.navigationCalls, 0, 'اولین Back نباید به navigation برسد');
  assert.equal(fixture.formState.date, '1405/07/30', 'اولین Back نباید تاریخ را تغییر دهد');
  assert.equal(fixture.formState.cancelled, false, 'فرم زیرین نباید با اولین Back لغو شود');

  assert.equal(dispatchAndroidBack(fixture.window), true, 'Back بعدی باید handler قبلی navigation را اجرا کند');
  assert.equal(picker.closeClicks, 1, 'همان picker نباید دوباره بسته یا handler آن تکراری اجرا شود');
  assert.equal(fixture.navigationCalls, 1);
  assert.equal(fixture.formState.date, '1405/08/01', 'تغییر فرم فقط از مسیر navigation شبیه‌سازی‌شده انجام شود');
});

test('repeated picker open/Back-close cycles handle one Back each without stale handlers', () => {
  const picker = makeBackLayer(
    { 'data-hesabno-transaction-datepicker': 'true' },
    { 'data-hesabno-date-picker-close': 'true' },
    1,
  );
  const fixture = bootBackPriorityFixture([picker]);

  for (let cycle = 1; cycle <= 3; cycle += 1) {
    if (cycle > 1) picker.reopen();
    assert.equal(dispatchAndroidBack(fixture.window), true, `چرخهٔ ${cycle}: Back باید فقط picker را ببندد`);
    assert.equal(picker.layer.isConnected, false, `چرخهٔ ${cycle}: picker باید بسته شود`);
    assert.equal(picker.closeClicks, cycle, `چرخهٔ ${cycle}: دقیقاً یک close باید اجرا شود`);
    assert.equal(fixture.navigationCalls, 0, `چرخهٔ ${cycle}: navigation نباید زودتر اجرا شود`);
    assert.equal(fixture.formState.date, '1405/07/30', `چرخهٔ ${cycle}: تاریخ باید ثابت بماند`);
  }

  assert.equal(dispatchAndroidBack(fixture.window), true, 'پس از بسته‌بودن picker، Back به مسیر عادی برسد');
  assert.equal(picker.closeClicks, 3, 'پس از بسته‌شدن، handler یتیمی نباید picker را دوباره ببندد');
  assert.equal(fixture.navigationCalls, 1);
});

test('a later overlay remains the Back target while the shared date picker is underneath', () => {
  const picker = makeBackLayer(
    { 'data-hesabno-transaction-datepicker': 'true' },
    { 'data-hesabno-date-picker-close': 'true' },
    1,
  );
  const upperLayer = makeBackLayer(
    { role: 'dialog', 'aria-modal': 'true' },
    { 'aria-label': 'بستن' },
    2,
  );
  const fixture = bootBackPriorityFixture([picker, upperLayer]);

  assert.equal(fixture.window.__hesabnoCloseTopLayer(), true);
  assert.equal(upperLayer.layer.isConnected, false, 'ابتدا باید لایهٔ DOM بالاتر بسته شود');
  assert.equal(picker.layer.isConnected, true, 'تقویم زیرین نباید زودتر بسته شود');
  assert.equal(fixture.window.__hesabnoCloseTopLayer(), true);
  assert.equal(picker.layer.isConnected, false, 'در Back بعدی باید تقویم بسته شود');
});

test('when neither target date picker is open, the existing Back navigation path is preserved', () => {
  const fixture = bootBackPriorityFixture([]);

  assert.equal(dispatchAndroidBack(fixture.window), true);
  assert.equal(fixture.navigationCalls, 1, 'بدون تقویم باز باید تابع ناوبری قبلی اجرا شود');
});
