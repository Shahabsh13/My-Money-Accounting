/*
 * آزمون زنده‌ی مرحله ۴ — لایه‌ی مشترک observer روی برنامه‌ی واقعی
 *
 * این آزمون، ابزار tools/bench/live-regression-probe.cjs را در یک فرآیند جدا اجرا می‌کند (تا عمر
 * jsdom با اجراکننده‌ی آزمون قاطی نشود) و سه چیز را تضمین می‌کند:
 *  ۱) نگهبان معماری: observerهای ساخته‌شده روی هدف‌های مشترک (body/html/#root/document) باید از
 *     لایه‌ی مشترک ۲۳۶ بیایند — مگر از فایل‌های ممنوعه (چک/کیبورد) یا باندل اصلی ۰۶۷.
 *  ۲) رفتار زنده: لایه‌ی ۰۹۰ (داشبورد ثابت) پس از جهش DOM دوباره کلاس خود را می‌گذارد؛ یعنی
 *     callbackها واقعاً از مسیر لایه‌ی مشترک اجرا می‌شوند.
 *  ۳) سلامت لایه: صفر خطا، چهار observer مشترک، ثبت‌کننده‌ها و تحویل‌های واقعی.
 *
 * محدودیت صریح: برای ۰۶۹ (بهبود مصرف بانک) و ۱۱۴ (فرم وام) آزمون رفتاری اختصاصی نوشته نشده، چون
 * اثر آن‌ها فقط با تعامل واقعی UI دیده می‌شود و در این محیط مرورگر واقعی وجود ندارد؛ برای این دو
 * فایل، شاهد «بی‌تغییر بودن DOM بوت» (docs/dom-equivalence-*.json) و اجرای کامل آزمون‌هاست.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const probe = path.join(root, 'tools/bench/live-regression-probe.cjs');

const PROHIBITED = /(check|keypad|numeric-keyboard|^214-|^225-)/;
const CORE_BUNDLE = /067-inline\.js/;
const SHARED_LAYER = /236-hesabno-shared-dom-observer\.js/;
const SHARED_TARGETS = new Set(['BODY', 'HTML', '#document', 'DIV#root']);

let payload = null;
function runProbe() {
  if (payload) return payload;
  const output = execFileSync(process.execPath, [probe], { encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024 });
  payload = JSON.parse(output.slice(output.indexOf('{')));
  return payload;
}

test('the live probe boots the app and reports the shared layer', (t) => {
  const data = runProbe();
  if (data.skipped) return t.skip(data.skipped);
  assert.equal(data.registryVersion, 3);
  assert.equal(data.stats.activeObservers, 4, 'چهار observer مشترک: body / html / #root / document');
  assert.ok(data.stats.handlers > 70, `ثبت‌کننده‌های لایه‌ی مشترک باید زیاد باشند (${data.stats.handlers})`);
  assert.equal(data.stats.errors, 0, 'هیچ خطایی در callbackها نباید رخ دهد');
});

test('observers on shared targets come only from the shared layer', (t) => {
  const data = runProbe();
  if (data.skipped) return t.skip(data.skipped);
  const onSharedTargets = data.observers.filter((record) => SHARED_TARGETS.has(record.target));
  assert.ok(onSharedTargets.length >= 4, 'حداقل چهار observer روی هدف‌های مشترک');
  const strays = onSharedTargets
    .map((record) => record.creator)
    .filter((creator) => !SHARED_LAYER.test(creator) && !PROHIBITED.test(creator) && !CORE_BUNDLE.test(creator));
  assert.deepEqual([...new Set(strays)], [],
    'هیچ اسکریپتی جز لایه‌ی مشترک (و فایل‌های ممنوعه/۰۶۷) نباید observer مستقل روی هدف مشترک بسازد');
  const fromLayer = onSharedTargets.filter((record) => SHARED_LAYER.test(record.creator)).length;
  assert.ok(fromLayer >= 4, 'چهار observer مشترک باید از خودِ لایه ساخته شده باشند');
});

test('fixed-dashboard layer (090) re-applies its class after a DOM mutation', (t) => {
  const data = runProbe();
  if (data.skipped) return t.skip(data.skipped);
  assert.equal(data.live.hasMain, true, 'صفحه‌ی خانه باید main داشته باشد');
  assert.ok(data.live.dashboardWidgets > 0, 'ویجت‌های داشبورد ساخته شده‌اند');
  assert.equal(data.live.dashboardClassRestored, true,
    'لایه‌ی ۰۹۰ باید پس از جهش دوباره کلاس را بگذارد (اثبات اجرای callback از مسیر لایه‌ی مشترک)');
  assert.ok(data.live.deliveredAfterMutation > 0, 'تحویل رخداد پس از جهش تازه ادامه دارد');
});

test('jsdom probe excludes only the canvas-dependent contrast helper and has no jsdom errors', (t) => {
  const data = runProbe();
  if (data.skipped) return t.skip(data.skipped);
  assert.deepEqual(data.jsdomExcludedScripts, ['/src/scripts/901-light-theme-contrast.js'],
    'فقط ابزار کنتراستِ وابسته به Canvas باید در jsdom اجرا نشود');
  assert.deepEqual(data.jsdomErrors, [], 'پس از حذف هدفمند اسکریپت Canvas، خطای jsdom نباید باقی بماند');
});
