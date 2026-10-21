/*
 * پیش‌فرض جداکنندهٔ ارقام (گزارش کاربر با اسکرین‌شات «اطلاعات پایه»)
 *
 * در تنظیمات، گزینهٔ «خط مورب اسلش (/)» به‌عنوان انتخاب‌شده دیده می‌شد، در حالی که
 * همهٔ مبالغ برنامه با «،» (ویرگول فارسی) نمایش داده می‌شدند. علت: وضعیت اولیهٔ صفحهٔ
 * تنظیمات «slash» بود، اما لایهٔ قالب‌بندی مبلغ (`uk`/`F0`) وقتی کلیدی ذخیره نشده باشد
 * «،» را برمی‌گرداند. خواستهٔ کاربر: پیش‌فرض روی کاما باشد و صفحه با نمایش واقعی بخواند.
 *
 * قاعده: مقدار ذخیره‌شدهٔ کاربر همیشه محترم است؛ فقط «نبودِ مقدار» کاما می‌شود.
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

test('no code path falls back to the slash separator any more', () => {
  const bundle = readAsset('src/scripts/067-inline.js');
  assert.equal(bundle.includes('||"slash"'), false,
    'هیچ پیش‌فرضی نباید «slash» باشد؛ وگرنه تنظیمات و نمایش واقعی از هم جدا می‌شوند');
  assert.ok(bundle.includes('return ge==="slash"||ge==="space"||ge==="standard"||ge==="comma"?ge:"comma"'),
    'وضعیت اولیهٔ صفحهٔ تنظیمات باید مقدار معتبر ذخیره‌شده را بخواند و در نبود آن «comma» باشد');
  assert.ok(bundle.includes('currentNumberFormat:o="comma"'),
    'پیش‌فرض خودِ دیالوگ قالب ارقام هم باید کاما باشد');
  assert.match(bundle, /numberFormat:__safeGet\("hesabno:numFormat"\)\|\|__safeGet\("hesabno:number_format"\)\|\|"comma"/,
    'فایل پشتیبان هم باید کلید جدید را اول بخواند و پیش‌فرضش کاما باشد');
});

test('the number layer already formats with the Persian comma by default', () => {
  const domain = readAsset('src/domain/numbers.js');
  assert.match(domain, /function separatorFor\(format\) \{[\s\S]*?return "،";[\s\S]*?\}/,
    'لایهٔ دامنه در نبود تنظیم باید «،» بدهد (هم‌رفتار با uk در ۰۶۷)');
});

test('settings default to Persian comma and stay in sync with the displayed amounts', { timeout: 180000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({ storage: FIRST_RUN_DONE, stubs });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const d = window.document;
  const click = (el) => el && el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

  await wait(900);
  const skip = [...d.querySelectorAll('button')].find((button) => normalize(button.textContent) === 'رد کردن');
  if (skip) { click(skip); await wait(300); }

  /* هیچ کلیدی ذخیره نشده است — پس نمایش و تنظیمات هر دو باید کاما باشند. */
  assert.equal(window.localStorage.getItem('hesabno:numFormat'), null);

  click([...d.querySelectorAll('nav.fixed button')].find((button) => normalize(button.textContent) === 'بیشتر'));
  await wait(1200);
  click([...d.querySelectorAll('button')].find((button) => normalize(button.textContent).startsWith('تنظیمات پایه')));
  await wait(1200);

  const row = d.querySelector('#setting-row-currency-format');
  assert.ok(row, 'ردیف «واحد پول و جداسازی ارقام» باید در تنظیمات پایه باشد');
  const badge = normalize(row.textContent);
  assert.ok(badge.includes('ویرگول فارسی'), `برچسب ردیف باید «ویرگول فارسی» بگوید، نه اسلش: ${badge}`);
  assert.equal(badge.includes('اسلش'), false, 'برچسب ردیف نباید اسلش نشان دهد');

  click(row);
  await wait(900);

  const title = [...d.querySelectorAll('h2')].find((heading) => normalize(heading.textContent) === 'واحد پول و جداسازی ارقام');
  assert.ok(title, 'دیالوگ «واحد پول و جداسازی ارقام» باید باز شود');
  const modal = title.closest('div.fixed');

  const preview = [...modal.querySelectorAll('span')]
    .map((span) => normalize(span.textContent))
    .find((text) => /^[۰-۹][۰-۹،,/ ]* (ریال|تومان)$/.test(text));
  assert.equal(preview, '۲۵،۰۰۰،۰۰۰ ریال', 'پیش‌نمایش بالای دیالوگ باید با ویرگول فارسی باشد');

  const options = [...modal.querySelectorAll('div.cursor-pointer')]
    .filter((card) => /کاما|ویرگول|اسلش|فاصله/.test(normalize(card.textContent)));
  assert.equal(options.length, 4, 'چهار حالت جداسازی باید باشد');
  const selected = options.filter((card) => /bg-indigo-500\/15/.test(card.className));
  assert.equal(selected.length, 1, 'دقیقاً یک گزینه باید انتخاب‌شده باشد');
  assert.ok(normalize(selected[0].textContent).startsWith('ویرگول فارسی'),
    `گزینهٔ انتخاب‌شده باید «ویرگول فارسی» باشد: ${normalize(selected[0].textContent)}`);
  assert.equal(normalize(selected[0].textContent).includes('اسلش'), false, 'اسلش نباید انتخاب‌شده باشد');
  assert.ok(selected[0].querySelector('svg'), 'گزینهٔ انتخاب‌شده باید علامت تیک داشته باشد');

  /* انتخاب صریح کاربر باید ذخیره و در برچسب ردیف هم منعکس شود. */
  const standard = options.find((card) => normalize(card.textContent).startsWith('کاما انگلیسی'));
  click(standard);
  await wait(300);
  click([...modal.querySelectorAll('button')].find((button) => normalize(button.textContent).includes('تأیید و ذخیره')));
  await wait(900);

  assert.equal(window.localStorage.getItem('hesabno:numFormat'), 'standard',
    'انتخاب کاربر باید در hesabno:numFormat ذخیره شود');
  assert.ok(normalize(d.querySelector('#setting-row-currency-format').textContent).includes('کاما انگلیسی'),
    'برچسب ردیف باید انتخاب جدید را نشان دهد');
});
