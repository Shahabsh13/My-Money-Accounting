/*
 * آزمون‌های لایه‌ی ذخیره‌سازی (مرحله ۲)
 *
 * هدف: قفل‌کردن رفتار فعلی `localStorage` پروژه پیش از هر بازآرایی معماری،
 * از جمله مسیرهای خطرناک «پر شدن فضا» و «انتقال بی‌صدا به حافظه‌ی موقت».
 *
 * کد تحت آزمون (کد واقعی برنامه، بدون بازنویسی):
 *   - 029-inline.js                     → __safeGet / __safeSet / __safeRemove
 *   - 005-hesabno-storage-capability.js → بررسی ماندگاری + جایگزین حافظه‌ای + بنر هشدار
 *   - 004-hesabno-apk-fixes.js          → نگاشت کلید حساب‌ها + پنجره‌ی داخل برنامه (window.alert)
 *   - src/storage/write-guard.js + 000a → هشدار پر شدن فضا (در مرحله ۶.۲ از ۰۰۴ منتقل شد)
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
const writeGuardScript = fs.readFileSync(path.join(root, 'app/src/main/assets/src/storage/write-guard.js'), 'utf8');
const writeGuardInstaller = readScript('000a-hesabno-storage-write-guard.js');

/* ترتیب واقعی بوت: ماژول نگهبان → نصب‌کننده → ۰۰۴ (که window.alert را به پنجره‌ی داخلی تبدیل می‌کند) */
function runStorageStack(window) {
  run(window, writeGuardScript);
  run(window, writeGuardInstaller);
  run(window, apkFixesScript);
}

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
  runStorageStack(window);

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
  runStorageStack(window);

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

test('Android auto-backup layer mirrors localStorage to HnBridge and restores data on reinstall before default seeds run', () => {
  let nativeDiskPayload = '';
  const defaultAccountsScript = readScript('000-default-accounts.js');

  // ۱. اجرای اول برنامه روی گوشی کاربر و ثبت حساب، تراکنش، چک و تنظیمات
  const firstInstallWindow = createWindow();
  firstInstallWindow.HnBridge = {
    readAutoBackup: () => nativeDiskPayload,
    saveAutoBackup: (payload) => {
      nativeDiskPayload = String(payload || '');
      return true;
    },
  };
  run(firstInstallWindow, writeGuardScript);
  run(firstInstallWindow, writeGuardInstaller);
  run(firstInstallWindow, defaultAccountsScript);

  const customTx = JSON.stringify([{ id: 'tx-999', type: 'expense', amount: 850000, title: 'خرید تستی', account: 'بانک ملت' }]);
  const customChecks = JSON.stringify([{ id: 'chk-1', amount: 5000000, status: 'pending' }]);
  firstInstallWindow.localStorage.setItem('hesabno:transactions', customTx);
  firstInstallWindow.localStorage.setItem('hesabno:checks', customChecks);
  firstInstallWindow.localStorage.setItem('hesabno:currency', 'toman');
  firstInstallWindow.localStorage.setItem('hesabno:theme', 'light');

  assert.equal(firstInstallWindow.__hesabnoFlushAutoBackup(), true, 'فلاش پشتیبان خودکار باید با موفقیت در پل بومی ذخیره شود');
  assert.ok(nativeDiskPayload.length > 50, 'تصویر JSON پشتیبان خودکار باید در فایل بومی نوشته شده باشد');

  // ۲. شبیه‌سازی حذف و نصب مجدد برنامه (WebView کاملاً خالی، اما فایل پشتیبان بومی توسط Android Auto Backup برگشته است)
  const reinstalledWindow = createWindow();
  assert.equal(reinstalledWindow.localStorage.length, 0, 'پیش از بوت مجدد، حافظه WebView کاملاً خالی است');
  reinstalledWindow.HnBridge = {
    readAutoBackup: () => nativeDiskPayload,
    saveAutoBackup: (payload) => {
      nativeDiskPayload = String(payload || '');
      return true;
    },
  };

  run(reinstalledWindow, writeGuardScript);
  run(reinstalledWindow, writeGuardInstaller);
  assert.equal(reinstalledWindow.__hesabnoAutoBackupRestored, true, 'لایه 000a باید پیش از اجرای 000 اطلاعات را از پشتیبان خودکار بازیابی کند');

  // اجرای اسکریپت 000 پس از بازیابی نباید اطلاعات کاربر را پاک کند
  run(reinstalledWindow, defaultAccountsScript);

  assert.equal(reinstalledWindow.localStorage.getItem('hesabno:transactions'), customTx, 'تراکنش‌های کاربر باید پس از نصب مجدد دقیقاً بازیابی شوند');
  assert.equal(reinstalledWindow.localStorage.getItem('hesabno:checks'), customChecks, 'چک‌های کاربر باید پس از نصب مجدد دقیقاً بازیابی شوند');
  assert.equal(reinstalledWindow.localStorage.getItem('hesabno:currency'), 'toman', 'تنظیم واحد پول باید پس از نصب مجدد حفظ شود');
  assert.equal(reinstalledWindow.localStorage.getItem('hesabno:theme'), 'light', 'تنظیم پوسته باید پس از نصب مجدد حفظ شود');

  // ۳. اطمینان از وجود قوانین Android Auto Backup در مانیفست و فایل‌های XML اندروید
  const manifestXml = fs.readFileSync(path.join(root, 'app/src/main/AndroidManifest.xml'), 'utf8');
  const backupRulesXml = fs.readFileSync(path.join(root, 'app/src/main/res/xml/backup_rules.xml'), 'utf8');
  const extractionRulesXml = fs.readFileSync(path.join(root, 'app/src/main/res/xml/data_extraction_rules.xml'), 'utf8');
  const mainActivityJava = fs.readFileSync(path.join(root, 'app/src/main/java/com/maymoney/app/MainActivity.java'), 'utf8');

  assert.match(manifestXml, /android:allowBackup="true"/);
  assert.match(manifestXml, /android:fullBackupContent="@xml\/backup_rules"/);
  assert.match(manifestXml, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
  assert.match(backupRulesXml, /hesabno_auto_backup\.json/);
  assert.match(extractionRulesXml, /hesabno_auto_backup\.json/);
  assert.match(backupRulesXml, /hesabno_cloud_prefs\.xml/);
  assert.match(extractionRulesXml, /hesabno_cloud_prefs\.xml/);
  assert.match(mainActivityJava, /public boolean saveAutoBackup\(String jsonPayload\)/);
  assert.match(mainActivityJava, /public String readAutoBackup\(\)/);
  assert.match(mainActivityJava, /public boolean connectCloudDrive\(final String jsonPayload, final String suggestedName\)/);
  assert.match(mainActivityJava, /public boolean syncToCloudDrive\(String jsonPayload\)/);
  assert.match(mainActivityJava, /public String readFromCloudDrive\(\)/);
  assert.match(mainActivityJava, /public boolean pickCloudBackupToRestore\(\)/);
  assert.match(mainActivityJava, /public String getCloudDriveStatus\(\)/);
  assert.match(mainActivityJava, /public boolean disconnectCloudDrive\(\)/);

  // ۴. پشتیبانی 000a از هر دو قالب پشتیبان خودکار (entries) و پشتیبان ابری گوگل درایو (storageData نسخه ۵.۱)
  const cloudWindow = createWindow();
  cloudWindow.HnBridge = {
    readAutoBackup: () => JSON.stringify({
      version: '5.1',
      storageData: {
        'hesabno:accounts_v5': '[{"id":"acc-gd","name":"بانک پاسارگاد"}]',
        'hesabno:transactions': '[{"id":"tx-gd","amount":1250000}]',
        'hesabno:currency': 'toman'
      }
    }),
    saveAutoBackup: () => true
  };
  run(cloudWindow, writeGuardScript);
  run(cloudWindow, writeGuardInstaller);
  assert.equal(cloudWindow.__hesabnoAutoBackupRestored, true, 'لایه 000a باید قالب storageData نسخه ۵.۱ گوگل درایو را نیز بازیابی کند');
  assert.equal(cloudWindow.localStorage.getItem('hesabno:accounts_v5'), '[{"id":"acc-gd","name":"بانک پاسارگاد"}]');
  assert.equal(cloudWindow.localStorage.getItem('hesabno:transactions'), '[{"id":"tx-gd","amount":1250000}]');
});


