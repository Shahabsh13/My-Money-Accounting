/*
 * حذف کامل ویجت «نمودار روند روزانه» (درخواست کاربر با اسکرین‌شات)
 *
 * پیش‌تر یک اسکریپت کوچک (008) تلاش می‌کرد ویجت را با نوشتن `chartTrend:false` در
 * `hesabno:homeWidgets` پنهان کند، اما آن پرچم فقط یک‌بار نوشته می‌شد و هر کاربری که
 * کلید را داشت (یا بعداً ضرایب ویجت‌ها را عوض می‌کرد) دوباره نمودار را می‌دید.
 * حالا خود ویجت، تعریفش، کلید چیدمانش و استایل کارت جزئیاتش از برنامه حذف شده‌اند.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readAsset = (relative) => fs.readFileSync(path.join(root, 'app/src/main/assets', relative), 'utf8');

const bundle = readAsset('src/scripts/067-inline.js');
const indexHtml = readAsset('index.html');
const stylesCss = readAsset('src/styles/235-hesabno-text-root-and-display-stability.css');

test('the daily trend widget has no code path left in the core bundle', () => {
  /* تنها جای مجاز برای نام کلید، پاک‌سازی مقادیر قدیمی هنگام خواندن تنظیمات است. */
  const cleanup = bundle.slice(bundle.indexOf('delete Ae.chartTrend') - 260, bundle.indexOf('delete Ae.chartTrend') + 160);
  const occurrences = bundle.split('chartTrend').length - 1;
  assert.ok(occurrences > 0 && occurrences <= 3,
    `نام کلید حذف‌شده فقط باید در پاک‌سازی مقدار قدیمی بماند (${occurrences} مورد)`);
  assert.equal(bundle.includes('نمودار روند روزانه درآمد و هزینه'), false, 'توضیح ویجت نباید در فهرست مدیریت بماند');
  assert.equal(cleanup.includes('delete Ae.chartTrend'), true, 'پاک‌سازی مقدار قدیمی باید سرجایش باشد');
  assert.equal(bundle.includes('نمودار روند روزانه'), false,
    'عنوان ویجت نباید در بسته باشد');
  assert.equal(bundle.includes('y9=({transactions:'), false,
    'کامپوننت نمودار روند روزانه باید حذف شده باشد');
  assert.equal(/case"chartTrend":/.test(bundle), false,
    'شاخهٔ رندر ویجت نباید در سوییچ ویجت‌های خانه بماند');
  assert.equal(bundle.includes('hesabno-trend-detail'), false,
    'نشانه‌های استایل کارت جزئیات نمودار هم نباید بمانند');
});

test('the widget is gone from the manage-widgets list and from the layout order', () => {
  const registry = bundle.slice(bundle.indexOf('iN={'), bundle.indexOf('iN={') + 2600);
  assert.ok(registry.includes('chartCategoryBars'), 'فهرست ویجت‌ها باید همچنان باشد');
  assert.equal(registry.includes('chartTrend'), false, 'ویجت حذف‌شده نباید در فهرست مدیریت ویجت‌ها باشد');
  const order = bundle.match(/const cl=\[[^\]]*\]/);
  assert.ok(order, 'آرایهٔ ترتیب ویجت‌ها باید پیدا شود');
  assert.equal(order[0].includes('chartTrend'), false, 'ویجت حذف‌شده نباید در ترتیب پیش‌فرض ویجت‌ها باشد');
  const defaults = bundle.match(/dl=\{[^}]*\}/);
  assert.ok(defaults);
  assert.equal(defaults[0].includes('chartTrend'), false, 'پرچم پیش‌فرض ویجت نباید بماند');
});

test('the old hide-only script is deleted and no longer loaded', () => {
  assert.equal(fs.existsSync(path.join(root, 'app/src/main/assets/src/scripts/008-hesabno-hide-daily-trend-widget.js')), false,
    'اسکریپت ۰۰۸ که فقط ویجت را پنهان می‌کرد باید حذف شود');
  assert.equal(indexHtml.includes('008-hesabno-hide-daily-trend-widget'), false,
    'برچسب اسکریپت ۰۰۸ نباید در index.html باشد');
  const manifest = readAsset('src/MANIFEST.txt');
  assert.equal(manifest.includes('008-hesabno-hide-daily-trend-widget'), false,
    'ردیف ۰۰۸ نباید در فهرست منابع بماند');
});

test('the detail-card stylesheet rules were removed with the widget', () => {
  assert.equal(stylesCss.includes('hesabno-trend-detail'), false,
    'قاعده‌های .hesabno-trend-detail باید از لایهٔ ۲۳۵ پاک شوند');
  assert.equal(stylesCss.includes('hesabno-trend-income'), false);
  assert.equal(stylesCss.includes('hesabno-trend-net'), false);
  /* قاعدهٔ سراسری placeholder باید همچنان آخرین قاعدهٔ فایل بماند. */
  assert.ok(stylesCss.lastIndexOf('font-size: 12px !important;') > stylesCss.lastIndexOf('[data-hesabno-transaction-search]::placeholder'));
});

test('legacy saved layout is normalized on load so no blank widget slot remains', () => {
  /* کاربرانی که ویجت را روشن داشتند هنوز chartTrend را در hesabno:homeWidgets دارند. */
  assert.match(bundle, /delete Ae\.chartTrend/,
    'مقدار قدیمی chartTrend باید هنگام خواندن تنظیمات کنار گذاشته شود');
  assert.match(bundle, /Ae\.order=Ae\.order\.filter\(Pe=>Pe!=="chartTrend"\)/,
    'chartTrend باید از آرایهٔ ترتیب ویجت‌ها هم فیلتر شود تا جای خالی نماند');
});

test('the other chart widgets keep their shared period selector', () => {
  /* حذف ویجت روند نباید انتخابگر بازه را از نمودارهای میله‌ای و دوناتی بگیرد. */
  assert.equal(bundle.includes('gg=({period:t,onChange:s'), true, 'انتخابگر بازه باید بماند');
  assert.ok((bundle.match(/jsx\(gg,/g) || []).length >= 2,
    'نمودارهای میله‌ای و دوناتی همچنان باید از انتخابگر بازه استفاده کنند');
});
