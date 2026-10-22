const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const assets = path.resolve(__dirname, '../app/src/main/assets');
const read = (file) => fs.readFileSync(path.join(assets, file), 'utf8');

test('تقویم‌های تکی فرم و قسط وام پایین‌چسب، محوشده و دارای × هستند', () => {
  const bundle = read('src/scripts/067-inline.js');
  assert.match(bundle, /alignItems:"flex-end"[\s\S]{0,300}backdropFilter:"blur\(16px\) saturate\(120%\)"/,
    'تقویم مشترک فرم تراکنش و تاریخ قسط وام باید با استایل درون‌خطی پایین‌چسب و blur باشد');
  assert.ok(bundle.includes('id:"datepicker-close-button"') && bundle.includes('"aria-label":"بستن تقویم"'),
    'تقویم مشترک فرم تراکنش و تاریخ قسط وام باید ضربدر دسترس‌پذیر داشته باشد');
});

test('تقویم تاریخ وصول چک پایین‌چسب، محوشده و دارای دکمهٔ × است', () => {
  const script = read('src/scripts/142-hesabno-check-settlement-date.js');
  assert.match(script, /backdrop\.className\s*=\s*"[^"]*backdrop-blur-md[^"]*items-end[^"]*"/,
    'لایهٔ تقویم وصول باید blur محسوس داشته باشد و شیت را پایین نگه دارد');
  assert.match(script, /backdrop\.style\.alignItems\s*=\s*"flex-end"[\s\S]{0,500}backdrop\.style\.setProperty\("backdrop-filter", "blur\(16px\) saturate\(120%\)"\)/,
    'پایین‌چسبی و blur باید مستقل از تولید CSS کلاس‌ها تضمین شوند');
  assert.match(script, /grid-template-columns:auto minmax\(0,1fr\) auto/,
    'چیدمان سرصفحه باید فضای × را در عرض موبایل رزرو کند');
  assert.match(script, /data-hesabno-settlement-datepicker-close aria-label=\\"بستن تقویم\\"/,
    'دکمهٔ ضربدر باید برچسب دسترس‌پذیر داشته باشد');
  assert.match(script, /hasAttribute\("data-hesabno-settlement-datepicker-close"\)[\s\S]{0,120}closeSettlementPicker\(state\)/,
    'ضربدر باید همان تقویم را ببندد');
});

test('تقویم پرداخت جایگزین چک پایین‌چسب، محوشده و دارای × باقی می‌ماند', () => {
  const script = read('src/scripts/144-hesabno-check-return-confirm.js');
  assert.match(script, /overlay\.className\s*=\s*"[^"]*backdrop-blur-md[^"]*items-end[^"]*"/,
    'لایهٔ تقویم پرداخت جایگزین باید blur محسوس داشته باشد و شیت را پایین نگه دارد');
  assert.match(script, /overlay\.style\.alignItems\s*=\s*"flex-end"[\s\S]{0,550}overlay\.style\.setProperty\("backdrop-filter", "blur\(16px\) saturate\(120%\)"\)/,
    'پایین‌چسبی و blur تقویم پرداخت باید با استایل مستقیم پایدار باشند');
  assert.match(script, /grid-template-columns:auto minmax\(0,1fr\) auto/,
    'چیدمان سرصفحه باید برای × جا نگه دارد حتی در موبایل باریک');
  assert.match(script, /picker\.className\s*=\s*"[^"]*rounded-t-3xl rounded-b-none/,
    'کارت تقویم باید مانند شیت از پایین باز شود');
  assert.match(script, /data-return-date-close[^>]*aria-label="بستن تقویم"[^>]*>×/,
    'دکمهٔ ضربدر دسترس‌پذیر باید در سربرگ تقویم باشد');
  assert.match(script, /var closeDatePicker = function \(\) \{ overlay\.remove\(\); if \(escapeHandler\) document\.removeEventListener\("keydown", escapeHandler\); \};/,
    'بستن تقویم برگشت فقط باید آن را ببندد و listener را پاک کند؛ مقدار تاریخ نباید تغییر کند');
  assert.match(script, /if \(button\.hasAttribute\("data-return-date-close"\)\) \{ closeDatePicker\(\); return; \}/,
    'مسیر ضربدر باید پیش از شاخه‌های انتخاب تاریخ اجرا شود');
});
