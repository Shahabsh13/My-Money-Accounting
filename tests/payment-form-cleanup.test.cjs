/*
 * پاک‌سازی فرم ثبت سند (پرداخت/دریافت/انتقال)
 *
 * گزارش کاربر با اسکرین‌شات فرم «ثبت پرداخت»:
 *   ۱) «دو تا کادر رو ابتدا و انتها رو موازی هم کن» — کادر «پرداخت به» و «از حساب»
 *      به‌خاطر عرض برچسب‌ها هم‌عرض نبودند.
 *   ۲) «توضیح زیر کارمزد رو بردار» — «ثبت خودکار در سرفصل «کارمزد بانکی»».
 *   ۳) «توضیح زیر پیوست رو بردار و جلوش توی اون کادر فقط بنویس انتخاب تصویر».
 *   ۴) «اون راهنمای زیر هم بردار» — «تکمیل مبلغ و حساب‌های مبدأ و مقصد ... الزامی است.»
 *   «اینو هر جایی ک دیدی اعمال کن» — پس فرم چک، فرم وام/قسط و پنل پرداخت جایگزین هم پاک شدند.
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

const REMOVED_COPY = [
  'ثبت خودکار در سرفصل',
  'عکس رسید بانکی',
  'عکس رو یا پشت برگه چک',
  'انتخاب تصویر فیش',
  'انتخاب تصویر چک',
  'برای ثبت سند الزامی است',
  'تراز بوده و ردیف‌ها',
];

async function openForm(t, from) {
  const dom = await bootApp({ storage: FIRST_RUN_DONE, stubs });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const d = window.document;
  const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  await wait(900);
  const skip = [...d.querySelectorAll('button')].find((button) => normalize(button.textContent) === 'رد کردن');
  if (skip) { click(skip); await wait(300); }
  const action = [...d.querySelectorAll('main button')].find((button) => normalize(button.textContent) === from);
  assert.ok(action, `دکمهٔ «${from}» در خانه باید باشد`);
  click(action);
  await wait(1300);
  const form = d.querySelector('main form');
  assert.ok(form, `فرم «${from}» باید باز شود`);
  return { dom, window, d, form };
}

test('متن‌های راهنمای اضافه از بستهٔ برنامه حذف شده‌اند', () => {
  const bundle = readAsset('src/scripts/067-inline.js');
  const leftovers = REMOVED_COPY.filter((copy) => bundle.includes(copy));
  assert.deepEqual(leftovers, [], `این متن‌ها نباید در رابط بمانند: ${leftovers.join(' ، ')}`);
  assert.ok(bundle.includes('انتخاب تصویر'), 'دکمهٔ پیوست باید «انتخاب تصویر» باشد');
  assert.ok(bundle.includes('این عملیات کارمزد دارد'), 'عنوان کارمزد باید بماند');
  assert.ok(bundle.includes('تصویر فیش / سند پیوست'), 'عنوان پیوست باید بماند');
});

test('پنل پرداخت جایگزین چک برگشتی هم همان متن‌ها را ندارد', () => {
  const source = readAsset('src/scripts/144-hesabno-check-return-confirm.js');
  assert.equal(source.includes('عکس رسید بانکی'), false, 'توضیح زیر پیوست در پنل پرداخت جایگزین نباید باشد');
  assert.equal(source.includes('انتخاب تصویر فیش'), false, 'دکمه نباید «انتخاب تصویر فیش» باشد');
  assert.ok(source.includes('انتخاب تصویر</span>'), 'دکمهٔ پیوست در پنل پرداخت جایگزین باید «انتخاب تصویر» باشد');
});

test('قاعدهٔ هم‌عرض‌کردن دو کادر مسیر سند در لایهٔ ۲۳۵ ثبت شده است', () => {
  const css = readAsset('src/styles/235-hesabno-text-root-and-display-stability.css');
  assert.match(css, /section:has\(#field-party\) > div:not\(:first-child\) > label \{[^}]*min-width: 4\.25rem !important/,
    'برچسب هر دو کادر باید عرض کمینهٔ یکسان بگیرد');
  assert.match(css, /section:has\(#field-party\) > div:not\(:first-child\):has\(> label \+ button \+ p\) \{[^}]*grid-template-columns: minmax\(4\.25rem, max-content\)/,
    'حالت خطای درون‌کادر هم باید همان ستون ثابت را داشته باشد');
});

for (const [label, action] of [['پرداخت', 'پرداخت'], ['دریافت', 'دریافت'], ['انتقال', 'انتقال']]) {
  test(`فرم «${label}»: دو کادر هم‌عرض، بدون متن‌های اضافه`, { timeout: 120000 }, async (t) => {
    if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
    const { window, form } = await openForm(t, action);
    const text = normalize(form.textContent);
    for (const copy of REMOVED_COPY) {
      assert.equal(text.includes(copy), false, `فرم «${label}» نباید «${copy}» داشته باشد`);
    }

    const rows = [...form.querySelectorAll('section:has(#field-party) > div:not(:first-child)')];
    assert.equal(rows.length, 2, 'فرم باید دو کادر مسیر (سرفصل و حساب) داشته باشد');
    const widths = rows.map((row) => {
      const field = window.getComputedStyle(row.querySelector('label'));
      return { label: normalize(row.querySelector('label').textContent), minWidth: field.minWidth, flex: field.flexBasis };
    });
    assert.equal(widths[0].minWidth, widths[1].minWidth,
      `عرض کمینهٔ برچسب هر دو کادر باید یکی باشد (${widths.map((item) => item.label + '=' + item.minWidth).join(' ، ')})`);
    assert.equal(widths[0].minWidth, '4.25rem', 'عرض کمینهٔ برچسب‌ها همان ۴٫۲۵rem مستند است');

    const attachment = [...form.querySelectorAll('label')]
      .find((element) => element.querySelector('input[type="file"]'));
    assert.ok(attachment, 'دکمهٔ پیوست فایل باید در فرم باشد');
    assert.equal(normalize(attachment.textContent), 'انتخاب تصویر', 'متن دکمهٔ پیوست باید فقط «انتخاب تصویر» باشد');
    const attachmentText = attachment.querySelector('span');
    assert.match(String(attachmentText.className), /\bwhitespace-nowrap\b/, 'متن دکمهٔ پیوست نباید دوخطی شود');
  });
}
