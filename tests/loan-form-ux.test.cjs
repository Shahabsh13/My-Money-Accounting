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
