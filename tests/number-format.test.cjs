/*
 * آزمون‌های لایه‌ی عدد و قالب‌بندی از باندل مینیفای‌شده‌ی اصلی (مرحله ۲)
 *
 * چرا مهم است: `067-inline.js` قلب محاسبات و نمایش برنامه است و منبع اصلی (source) ندارد.
 * این آزمون‌ها با «برش» دقیقِ توابع خالص از همان فایل واقعی، رفتار پولی/عددی را قفل می‌کنند:
 * تبدیل ارقام فارسی، نرمال‌سازی ورودی، جداکننده‌ی هزارگان، قالب پول، برچسب ارز و
 * جمع/تفریق ماه روی تاریخ جلالی بدون هیچ تغییری در فایل برنامه.
 *
 * اگر ساختار باندل عوض شود، برش پیدا نمی‌شود و آزمون با پیام روشن می‌شکند (نه با خطای مبهم).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const BUNDLE = path.join(__dirname, '..', 'app/src/main/assets/src/scripts/067-inline.js');
const source = fs.readFileSync(BUNDLE, 'utf8');

const START = 'te=t=>';
const END = 'x9=(t,s,n)=>{';

function sliceSection(from, to) {
  const startIndex = source.indexOf(from);
  const endIndex = source.indexOf(to, startIndex + from.length);
  assert.ok(startIndex !== -1, `برش «${from}» در باندل پیدا نشد`);
  assert.ok(endIndex !== -1 && endIndex > startIndex, `پایان برش «${to}» در باندل پیدا نشد`);
  return source.slice(startIndex, endIndex).replace(/,\s*$/, '');
}

const section = sliceSection(START, END);

function loadHelpers({ numFormat, currency } = {}) {
  const storage = new Map();
  if (numFormat !== undefined) storage.set('hesabno:numFormat', numFormat);
  if (currency !== undefined) storage.set('hesabno:currency', currency);
  const context = {
    console: { error: () => {}, warn: () => {} },
    __safeGet: (key) => (storage.has(key) ? storage.get(key) : null),
    __safeSet: (key, value) => { storage.set(key, String(value)); return true; },
    Intl,
    Date,
  };
  const code = `${section};\n({ te, St, uk, F0, Kr, mg, Ot, lr, Rt });`;
  const helpers = vm.runInNewContext(code, context, { timeout: 5000 });
  return { helpers, storage };
}

test('Persian digit conversion keeps non-digits and handles empty input', () => {
  const { helpers } = loadHelpers();
  assert.equal(helpers.te('0123456789'), '۰۱۲۳۴۵۶۷۸۹');
  assert.equal(helpers.te('1405/06/10'), '۱۴۰۵/۰۶/۱۰');
  assert.equal(helpers.te('-12،3'), '-۱۲،۳', 'نویسه‌های غیررقمی باید دست‌نخورده بمانند');
  assert.equal(helpers.te(null), '');
  assert.equal(helpers.te(undefined), '');
  assert.equal(helpers.te(0), '۰');
});

test('input normalization converts Persian/Arabic digits and drops separators', () => {
  const { helpers } = loadHelpers();
  assert.equal(helpers.St('۱۲۳۴۵۶۷۸۹۰'), '1234567890');
  assert.equal(helpers.St('۱٬۲۳۴٬۵۶۷'), '1234567');
  assert.equal(helpers.St('1,234,567'), '1234567');
  // یافته‌ی مرحله ۲: ارقام عربی-هندی (٣ U+0663) در این تابع نرمال نمی‌شوند؛
  // ورودی‌های چسبیده از منابع عربی («٣» به‌جای «۳») یک رقم غیررقمی باقی می‌مانند.
  assert.equal(helpers.St('۱۲٣'), '12٣');
  assert.equal(helpers.St(helpers.te('1234567')), '1234567', 'رفت‌وبرگشت با ارقام فارسی (بدون جداکننده) باید درست باشد');
  assert.equal(helpers.St(null), '');
});

test('money formatting groups digits, rounds, and keeps big amounts exact', () => {
  const { helpers } = loadHelpers();
  const F0 = helpers.F0;
  assert.equal(F0(0), '۰');
  assert.equal(F0(999), '۹۹۹');
  assert.equal(F0(1000), '۱،۰۰۰');
  assert.equal(F0(1234567), '۱،۲۳۴،۵۶۷');
  assert.equal(F0(-1234), '-۱،۲۳۴', 'علامت منفی باید حفظ شود');
  assert.equal(F0(1234.4), '۱،۲۳۴');
  assert.equal(F0(1234.5), '۱،۲۳۵', 'گرد کردن به نزدیک‌ترین عدد صحیح');
  assert.equal(F0('2500000'), '۲،۵۰۰،۰۰۰');
  assert.equal(F0(1000000000000), '۱،۰۰۰،۰۰۰،۰۰۰،۰۰۰', 'مبالغ بزرگ نباید نماد علمی یا اعشار بگیرند');
  assert.equal(F0(NaN), '۰');
  assert.equal(F0(null), '۰');
  assert.equal(F0(undefined), '۰');
  // یافته‌ی مرحله ۲: جداکننده‌ی پیش‌فرض فارسی «،» (U+060C) توسط St حذف نمی‌شود
  // (فقط «٬» عربی و «,» لاتین حذف می‌شوند)، پس رفت‌وبرگشت نمایش→خواندن با جداکننده‌ی پیش‌فرض
  // کامل نیست. Ot از این مسیر استفاده نمی‌کند و سالم است، اما St در جای دیگر برنامه نیز استفاده می‌شود.
  assert.equal(helpers.St(F0(1234567)), '1،234،567');
  assert.equal(helpers.St(F0(1234567)).replace(/،/g, ''), '1234567');
});

test('thousands separator follows the saved number-format setting', () => {
  assert.equal(loadHelpers().helpers.F0(1234567), '۱،۲۳۴،۵۶۷', 'پیش‌فرض فارسی است');
  assert.equal(loadHelpers({ numFormat: 'slash' }).helpers.F0(1234567), '۱/۲۳۴/۵۶۷');
  assert.equal(loadHelpers({ numFormat: 'space' }).helpers.F0(1234567), '۱ ۲۳۴ ۵۶۷');
  assert.equal(loadHelpers({ numFormat: 'standard' }).helpers.F0(1234567), '۱,۲۳۴,۵۶۷', 'حالت استاندارد فقط جداکننده را لاتین می‌کند، ارقام فارسی می‌مانند');
  assert.equal(loadHelpers({ numFormat: 'nonsense' }).helpers.F0(1234567), '۱،۲۳۴،۵۶۷', 'مقدار ناشناخته به پیش‌فرض برمی‌گردد');
  const legacy = loadHelpers();
  legacy.storage.set('hesabno:number_format', 'slash');
  assert.equal(legacy.helpers.F0(1000), '۱/۰۰۰', 'کلید قدیمی numFormat هم باید خوانده شود');
});

test('amount input parsing strips junk, groups digits, and rejects negatives', () => {
  const { helpers } = loadHelpers();
  const Ot = helpers.Ot;
  assert.equal(Ot('1234567'), '۱،۲۳۴،۵۶۷');
  assert.equal(Ot('۱۲٬۳۴۵'), '۱۲،۳۴۵');
  assert.equal(Ot(' 1,234 '), '۱،۲۳۴');
  assert.equal(Ot('۵۰۰ تومان'), '۵۰۰');
  assert.equal(Ot('-۵۰۰'), '', 'مبلغ منفی در ورودی نباید پذیرفته شود');
  assert.equal(Ot('−۵۰۰'), '', 'علامت منفی یونیکد هم رد می‌شود');
  assert.equal(Ot(''), '');
  assert.equal(Ot('abc'), '');
  assert.equal(Ot(null), '');
  assert.equal(Ot(0), '۰');
});

test('currency label and money+currency composition follow the active currency', () => {
  const toman = loadHelpers({ currency: 'toman' }).helpers;
  assert.equal(toman.Kr(), 'تومان');
  assert.equal(toman.Kr('rial'), 'ریال');
  assert.equal(toman.mg(2500000), '۲،۵۰۰،۰۰۰ تومان');

  const rial = loadHelpers({ currency: 'rial' }).helpers;
  assert.equal(rial.Kr(), 'ریال');
  assert.equal(rial.mg(-1500), '-۱،۵۰۰ ریال');
  assert.equal(rial.mg(0, 'toman'), '۰ تومان');
  assert.equal(rial.mg(NaN), '۰ ریال');
});

test('Jalali month arithmetic keeps day and clamps month lengths', () => {
  const { helpers } = loadHelpers();
  const lr = helpers.lr;
  assert.equal(lr('1404/12/29', 1), '1405/01/29', 'پایان سال باید به فروردین سال بعد برود');
  assert.equal(lr('1405/01/01', -1), '1404/12/01');
  assert.equal(lr('1404/07/31', 1), '1404/08/30', 'ماه‌های ۷ تا ۱۱ سی روزه‌اند');
  assert.equal(lr('1404/11/31', 1), '1404/12/29', 'اسفند حداکثر ۲۹ روز در سال عادی');
  assert.equal(lr('1404/06/31', 6), '1404/12/29');
  assert.equal(lr('1404-06-31', 1), '1404/07/30', 'جداکننده‌ی خط تیره هم پذیرفته می‌شود');
  assert.equal(lr('1404/06/31', 0), '1404/06/31', 'مقدار صفر نباید تغییر بدهد');
  assert.equal(lr('abc', 1), 'abc', 'ورودی نامعتبر باید بدون تغییر برگردد');
  assert.equal(lr('1404/06', 1), '1404/06', 'تاریخ ناقص باید بدون تغییر برگردد');

  const today = lr('', 0);
  assert.match(today, /^\d{4}\/\d{2}\/\d{2}$/, 'ورودی خالی باید تاریخ امروز جلالی بدهد');
  const parts = today.split('/').map(Number);
  const nextYear = lr(today, 12).split('/').map(Number);
  assert.equal(nextYear[0], parts[0] + 1, 'دوازده ماه بعد باید سال بعد باشد');
  assert.equal(nextYear[1], parts[1], 'ماه باید یکسان بماند');
  assert.equal(nextYear[2], Math.min(parts[2], parts[1] === 12 ? 29 : 31), 'روز در صورت لزوم به انتهای ماه محدود می‌شود');
});
