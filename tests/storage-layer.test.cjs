/*
 * آزمون‌های لایه‌ی ذخیره‌سازی (مرحله ۲)
 *
 * هدف: قفل‌کردن رفتار فعلی `localStorage` پروژه پیش از هر بازآرایی معماری،
 * از جمله مسیرهای خطرناک «پر شدن فضا» و «انتقال بی‌صدا به حافظه‌ی موقت».
 *
 * کد تحت آزمون (کد واقعی برنامه، بدون بازنویسی):
 *   - 029-inline.js                     → __safeGet / __safeSet / __safeRemove
 *   - 005-hesabno-storage-capability.js → بررسی ماندگاری + جایگزین حافظه‌ای + بنر هشدار
 *   - 004-hesabno-apk-fixes.js          → نگاشت کلید حساب‌ها + هشدار پر شدن فضا
 *
 * نکته: jsdom سقف واقعی ۵ مگابایتی Web Storage را پیاده‌سازی می‌کند و در پر شدن،
 * `QuotaExceededError` با `code === 22` پرتاب می‌کند؛ همان چیزی که کد برنامه انتظار دارد.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const readScript = (name) => fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts', name), 'utf8');

const safeStorageScript = readScript('029-inline.js');
const capabilityScript = readScript('005-hesabno-storage-capability.js');
const apkFixesScript = readScript('004-hesabno-apk-fixes.js');

const CHUNK = 'x'.repeat(100 * 1000);

function createWindow() {
  const dom = new JSDOM('<!doctype html><html lang="fa" dir="rtl"><body></body></html>', {
    url: 'https://app.test/',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    virtualConsole: new VirtualConsole(),
  });
  return dom.window;
}

function run(window, script) {
  window.eval(script);
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

/**
 * سقف واقعی ۵ مگابایتی jsdom را کامل پر می‌کند (با اندازه‌های نزولی تا هیچ فضایی نماند)
 * تا کوچک‌ترین نوشتن بعدی هم با QuotaExceededError شکست بخورد.
 */
function exhaustQuota(window, tag = 'fill') {
  let written = 0;
  let lastError = null;
  for (const size of [CHUNK.length, 10000, 1000, 100, 10, 1]) {
    for (let index = 0; ; index += 1) {
      try {
        window.localStorage.setItem(`${tag}-${size}-${index}`, 'x'.repeat(size));
        written += size;
      } catch (error) {
        lastError = error;
        break;
      }
    }
  }
  if (!lastError) throw new Error('سقف ذخیره‌سازی پر نشد؛ آزمون معتبر نیست');
  return { written, error: lastError };
}

test('safe storage bridge persists values, reads them back and removes them', () => {
  const window = createWindow();
  run(window, safeStorageScript);

  assert.equal(window.__safeSet('hesabno:transactions', '[{"id":1}]'), true);
  assert.equal(window.localStorage.getItem('hesabno:transactions'), '[{"id":1}]');
  assert.equal(window.__safeGet('hesabno:transactions'), '[{"id":1}]');

  window.__safeRemove('hesabno:transactions');
  assert.equal(window.localStorage.getItem('hesabno:transactions'), null);
  assert.equal(window.__safeGet('hesabno:transactions'), null);
  assert.equal(Object.prototype.hasOwnProperty.call(window.__hesabnoMemoryStorage, 'hesabno:transactions'), false);
});

test('safe storage bridge reports failure and keeps data only in memory when the real quota is exhausted', async () => {
  const window = createWindow();
  run(window, safeStorageScript);
  const { error } = exhaustQuota(window);
  assert.equal(error.name, 'QuotaExceededError');

  const persisted = window.__safeSet('hesabno:transactions', 'y'.repeat(200000));

  // رفتار امروز برنامه: نوشتن شکست می‌خورد، خطا بالا نمی‌آید و داده فقط در حافظه می‌ماند.
  assert.equal(persisted, false, 'safeSet باید شکست را با false اعلام کند');
  assert.equal(window.__hesabnoMemoryStorage['hesabno:transactions'].length, 200000);
  assert.equal(window.__safeGet('hesabno:transactions').length, 200000, 'خواندن از حافظه‌ی موقت ادامه دارد');
  assert.equal(window.localStorage.getItem('hesabno:transactions'), null, 'داده در فضای ماندگار ذخیره نشده است');
});

test('storage capability probe marks persistent storage as available and shows no warning', () => {
  const window = createWindow();
  run(window, capabilityScript);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

  assert.equal(window.__hesabnoStoragePersistent, true);
  assert.equal(window.document.getElementById('hesabno-storage-warning'), null);
});

test('storage capability installs a working memory fallback and warns the user when writes fail', () => {
  const window = createWindow();
  const { error } = exhaustQuota(window, 'probe');
  assert.equal(error.name, 'QuotaExceededError');

  run(window, capabilityScript);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

  assert.equal(window.__hesabnoStoragePersistent, false);
  const banner = window.document.getElementById('hesabno-storage-warning');
  assert.ok(banner, 'بنر هشدار ذخیره‌سازی موقت باید نمایش داده شود');
  assert.equal(banner.getAttribute('role'), 'alert');
  assert.match(banner.textContent, /ذخیره‌سازی ماندگار/);

  // جایگزین باید قرارداد Storage را رعایت کند
  window.localStorage.setItem('hesabno:theme', 'light');
  assert.equal(window.localStorage.getItem('hesabno:theme'), 'light');
  assert.equal(window.__hesabnoMemoryStorage['hesabno:theme'], 'light');
  assert.equal(window.localStorage.length >= 1, true);
  window.localStorage.removeItem('hesabno:theme');
  assert.equal(window.localStorage.getItem('hesabno:theme'), null);
});

test('quota exhaustion reaches the user with an in-app dialog and is not swallowed', async () => {
  const window = createWindow();
  const { error } = exhaustQuota(window, 'apk');
  assert.equal(error.name, 'QuotaExceededError');
  run(window, apkFixesScript);

  assert.throws(
    () => window.localStorage.setItem('hesabno:transactions', 'z'.repeat(200000)),
    (thrown) => thrown && thrown.name === 'QuotaExceededError',
    'خطای پر شدن فضا باید به فراخوان بالا برود تا ذخیره‌نشدن تغییر پنهان نماند'
  );

  await flush();
  const dialog = window.document.querySelector('[data-hn-dialog]');
  assert.ok(dialog, 'پنجره‌ی هشدار داخل برنامه باید نمایش داده شود');
  assert.match(dialog.textContent, /فضای ذخیره‌سازی پر شده/);
  assert.match(dialog.textContent, /پشتیبان/);
});

test('repeated quota failures inside the throttle window show a single dialog', async () => {
  const window = createWindow();
  exhaustQuota(window, 'throttle');
  run(window, apkFixesScript);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    assert.throws(() => window.localStorage.setItem(`hesabno:big${attempt}`, 'q'.repeat(200000)));
  }
  await flush();

  assert.equal(window.document.querySelectorAll('[data-hn-dialog]').length, 1, 'هشدار نباید تکرار شود');
});

test('legacy accounts key is migrated to the v5 key and the old value is backed up', () => {
  const window = createWindow();
  window.localStorage.setItem('hesabno:accounts_v5', 'NEW-DATA');
  window.localStorage.setItem('hesabno:accounts', 'OLD-DATA');

  run(window, apkFixesScript);

  assert.equal(window.localStorage.getItem('hesabno:accounts_v5'), 'NEW-DATA', 'داده‌ی v5 نباید بازنویسی شود');
  assert.equal(window.localStorage.getItem('hesabno:accounts_backup_old'), 'OLD-DATA', 'مقدار قدیمی باید پشتیبان شود');
  assert.equal(window.localStorage.getItem('hesabno:accounts'), 'NEW-DATA', 'خواندن کلید قدیمی به v5 نگاشت می‌شود');

  window.localStorage.setItem('hesabno:accounts', 'WRITTEN');
  assert.equal(window.localStorage.getItem('hesabno:accounts_v5'), 'WRITTEN', 'نوشتن کلید قدیمی روی v5 می‌نشیند');
});
