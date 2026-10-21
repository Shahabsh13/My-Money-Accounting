/*
 * فیلتر پیشرفتهٔ تراکنش‌ها
 *
 * گزارش کاربر (اسکرین‌شات فیلتر پیشرفته):
 *   • «توی فیلتر پیشرفته فونت اون دو تا بخشی که خط کشیدن سایزش اصلا به برنامه‌مون نمی‌خوره»
 *   • «ما اصلا رویداد نداریم پس حذفش کن»
 *   • «ببین بازم اگه جایی توی قسمت‌های نمونه یا انتخاب کردن فونتش این‌جوریه درستش کن»
 *
 * علت: قاعدهٔ سراسری `input,select,textarea{font-size:16px!important}` اندازهٔ متن
 * `<select>` را روی ۱۶px قفل می‌کرد، در حالی که برچسب‌های همان ردیف ۱۲px بودند.
 * این آزمون سه چیز را قفل می‌کند:
 *   ۱. فیلتر «رویداد» کاملاً حذف شده است (نه فقط پنهان).
 *   ۲. انتخابگرهای فیلتر پیشرفته ۱۲px هستند و با برچسب‌هایشان هم‌اندازه‌اند.
 *   ۳. همهٔ `select`های برنامه اندازهٔ کلاس خودشان را می‌گیرند (text-xs/text-sm/پیش‌فرض ۱۳px).
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
const stubs = (window) => {
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { width: 300, height: 120, top: 0, left: 0, right: 300, bottom: 120, x: 0, y: 0 };
  };
};

const readAsset = (relative) => fs.readFileSync(path.join(root, 'app/src/main/assets', relative), 'utf8');

async function openAdvancedFilter(t) {
  const dom = await bootApp({ storage: FIRST_RUN_DONE, stubs });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const d = window.document;
  const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  await wait(900);
  const skip = [...d.querySelectorAll('button')].find((button) => normalize(button.textContent) === 'رد کردن');
  if (skip) { click(skip); await wait(300); }
  click([...d.querySelectorAll('nav.fixed button')].find((button) => normalize(button.textContent) === 'تراکنش‌ها'));
  await wait(1400);
  const filterButton = d.querySelector('button[title="فیلتر تراکنش‌ها"]');
  assert.ok(filterButton, 'دکمهٔ فیلتر تراکنش‌ها باید باشد');
  click(filterButton);
  await wait(700);
  const advanced = [...d.querySelectorAll('button')].find((button) => normalize(button.textContent) === 'فیلتر پیشرفته');
  assert.ok(advanced, 'دکمهٔ «فیلتر پیشرفته» باید باشد');
  click(advanced);
  await wait(800);
  return { dom, window, d, panel: d.querySelector('.hesabno-advanced-filter') };
}

test('فیلتر «رویداد» از فیلتر پیشرفته حذف شده است', () => {
  const bundle = readAsset('src/scripts/067-inline.js');
  assert.equal(bundle.includes('انتخاب رویداد'), false, 'ردیف «انتخاب رویداد» نباید در بسته باشد');
  assert.equal(bundle.includes('عنوان رویداد یا برچسب'), false, 'فیلد «عنوان رویداد یا برچسب» نباید در بسته باشد');
  assert.equal(bundle.includes('رویداد'), false, 'برنامه اصلاً رویداد ندارد؛ هیچ رشتهٔ «رویداد» نباید در رابط بماند');
});

test('قاعده‌های اندازهٔ انتخابگر در لایهٔ ۲۳۵ ثبت شده‌اند', () => {
  const css = readAsset('src/styles/235-hesabno-text-root-and-display-stability.css');
  const base = readAsset('src/styles/010-core-base.css');
  assert.match(base, /input,select,textarea\{font-size:16px!important\}/,
    'قاعدهٔ پایهٔ ۱۶px باید سر جایش بماند (جلوگیری از زوم مرورگر)');
  assert.match(css, /html body \.hesabno-advanced-filter input,\s*html body \.hesabno-advanced-filter select,\s*html body \.hesabno-advanced-filter textarea\s*\{[^}]*font-size:\s*12px !important/,
    'انتخابگر و textarea فیلتر پیشرفته باید ۱۲px باشند');
  assert.match(css, /html body select \{ font-size: 13px !important; \}/,
    'selectهای بدون کلاس اندازه باید ۱۳px باشند نه ۱۶px');
  assert.match(css, /html body input\.text-xs,\s*html body textarea\.text-xs,\s*html body select\.text-xs \{ font-size: 12px !important; \}/,
    'فیلدهای با کلاس text-xs باید ۱۲px باشند');
  assert.match(css, /html body input\.text-sm,\s*html body textarea\.text-sm,\s*html body select\.text-sm \{ font-size: 14px !important; \}/,
    'فیلدهای با کلاس text-sm باید ۱۴px باشند');
});

test('انتخابگرهای پروژه و اعضا با برچسب‌هایشان هم‌اندازه‌اند و رویداد وجود ندارد', { timeout: 120000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const { window, panel } = await openAdvancedFilter(t);
  assert.ok(panel, 'پنل فیلتر پیشرفته باید باز شود');

  assert.equal(/رویداد/.test(normalize(panel.textContent)), false, 'هیچ ردیف رویدادی نباید در پنل باشد');

  const selects = [...panel.querySelectorAll('select')];
  assert.equal(selects.length, 2, 'فقط انتخابگر پروژه و انتخابگر اعضا باید بمانند');
  const labels = [...panel.querySelectorAll('span')].map((node) => normalize(node.textContent));
  assert.ok(labels.includes('انتخاب پروژه :'), 'برچسب «انتخاب پروژه :» باید بماند');
  assert.ok(labels.includes('انتخاب اعضا :'), 'برچسب «انتخاب اعضا :» باید بماند');

  for (const select of selects) {
    assert.equal(window.getComputedStyle(select).fontSize, '12px',
      `متن انتخابگر «${select.value || 'همه'}» باید هم‌اندازهٔ برچسب ۱۲pxی باشد`);
    /* ردیف برچسب با text-xs ساخته می‌شود؛ select هم دقیقاً همان ۱۲px را گرفته است */
    assert.match(String(select.closest('div').className), /(^|\s)text-xs(\s|$)/,
      'ردیف انتخابگر باید هم‌اندازهٔ برچسب text-xs باشد');
  }
  assert.deepEqual(selects.map((select) => [...select.options].map((option) => option.textContent)), [
    ['همه پروژه‌ها'],
    ['همه اعضا'],
  ], 'گزینه‌های پیش‌فرض باید دست‌نخورده بمانند');

  const textarea = panel.querySelector('textarea');
  assert.equal(window.getComputedStyle(textarea).fontSize, '12px', 'متن توضیحات فیلتر هم ۱۲px است');

  const submit = [...panel.querySelectorAll('button')].find((button) => normalize(button.textContent) === 'اعمال فیلتر');
  assert.ok(submit, 'دکمهٔ «اعمال فیلتر» باید باشد');
});

test('همهٔ فیلدهای فرم اندازهٔ کلاس خودشان را می‌گیرند', { timeout: 120000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({ storage: FIRST_RUN_DONE, stubs });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const d = window.document;
  await wait(600);

  const make = (tag, classes) => {
    const field = d.createElement(tag);
    if (classes) field.className = classes;
    if (tag === 'select') {
      const option = d.createElement('option');
      option.textContent = 'نمونه';
      field.appendChild(option);
    }
    d.body.appendChild(field);
    return field;
  };

  for (const tag of ['input', 'textarea', 'select']) {
    for (const [classes, size] of [['text-xs', '12px'], ['text-sm', '14px'], ['text-[11px]', '11px']]) {
      const field = make(tag, classes);
      assert.equal(window.getComputedStyle(field).fontSize, size,
        `${tag} با کلاس ${classes} باید ${size} باشد نه 16px`);
    }
  }
  /* بدون کلاس، همان ۱۶px پایه می‌ماند (فیلدهای فرم‌های اصلی) */
  for (const tag of ['input', 'textarea']) {
    assert.equal(window.getComputedStyle(make(tag, '')).fontSize, '16px',
      `${tag} بدون کلاس باید ۱۶px بماند`);
  }
  assert.equal(window.getComputedStyle(make('select', '')).fontSize, '13px',
    'select بدون کلاس ۱۳px است');
});
