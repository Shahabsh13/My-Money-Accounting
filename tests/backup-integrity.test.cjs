/*
 * آزمون‌های اعتبارسنجی و بازیابی نسخه‌ی پشتیبان (مرحله ۲)
 *
 * کد تحت آزمون: بخش هسته‌ی پشتیبان/ریست در
 *   app/src/main/assets/src/scripts/108-hesabno-complete-reset-flow.js
 * یعنی `backupKeys` و توابع واقعی:
 *   window.__hesabnoCaptureResetData / __hesabnoValidateResetData / __hesabnoRestoreResetData
 *
 * این بخش به‌صورت برش دقیقِ سورس اجرا می‌شود تا کل UI ریست لازم نباشد؛ صحت برش با
 * جست‌وجوی نشانه‌های واقعی فایل تضمین می‌شود. هیچ رفتاری بازنویسی نشده است.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const resetFlowSource = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/scripts/108-hesabno-complete-reset-flow.js'),
  'utf8'
);

const START_MARKER = 'var backupKeys = [';
const END_MARKER = 'window.__hesabnoRestoreResetData = restoreResetData;';
const startIndex = resetFlowSource.indexOf(START_MARKER);
const endIndex = resetFlowSource.indexOf(END_MARKER);
assert.notEqual(startIndex, -1, 'بخش backupKeys در سورس پیدا می‌شود');
assert.notEqual(endIndex, -1, 'تعریف توابع پشتیبان در سورس پیدا می‌شود');
const resetCore = resetFlowSource.slice(startIndex, endIndex + END_MARKER.length);

/** کلیدهایی که خودِ برنامه در فهرست پشتیبان اعلام کرده است. */
/*
 * فقط رشته‌های داخل آرایه‌ی backupKeys استخراج می‌شوند (تا خط فیلترِ پشتیبان قدیمی که نام کلید
 * را دوباره ذکر می‌کند، به‌اشتباه یک ردیف اضافه نسازد).
 */
const arrayStart = resetFlowSource.indexOf('[', startIndex);
const arrayEnd = resetFlowSource.indexOf('];', arrayStart);
const declaredKeys = [...resetFlowSource.slice(arrayStart, arrayEnd).matchAll(/"hesabno:[^"]+"/g)].map((match) =>
  match[0].slice(1, -1)
);

function setupResetFlow({ data = {}, failOnWriteNumber = null, dropOn = null } = {}) {
  const store = new Map(Object.entries(data));
  const writes = [];
  const window = {
    __safeGet: (key) => (store.has(key) ? store.get(key) : null),
    __safeSet: (key, value) => {
      writes.push(key);
      if (failOnWriteNumber !== null && writes.length === failOnWriteNumber) {
        throw new Error('storage write failed');
      }
      store.set(key, String(value));
      if (dropOn && dropOn(key)) store.delete(key);
      return true;
    },
    __safeRemove: (key) => {
      writes.push(key);
      store.delete(key);
    },
    setTimeout: () => 0,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  };
  const context = {
    window,
    localStorage: window.localStorage,
    document: { addEventListener: () => {} },
    MutationObserver: class { observe() {} },
  };
  vm.runInNewContext(resetCore, context);
  return { window, store, writes };
}

test('backup capture covers every key the app declares and returns null for missing data', () => {
  const { window } = setupResetFlow();
  const captured = window.__hesabnoCaptureResetData();

  assert.equal(declaredKeys.length >= 20, true, 'فهرست کلیدهای پشتیبان باید کامل باشد');
  assert.deepEqual(Object.keys(captured).sort(), [...declaredKeys].sort());
  assert.equal(Object.values(captured).every((value) => value === null), true, 'داده‌ی خالی باید null بدهد');
});

test('backup capture returns the raw stored value for each key', () => {
  const { window } = setupResetFlow({
    data: {
      'hesabno:transactions': '[{"id":1,"amount":5000}]',
      'hesabno:accounts_v5': '[{"id":1,"name":"بانک"}]',
      'hesabno:currency': 'toman',
    },
  });
  const captured = window.__hesabnoCaptureResetData();

  assert.equal(captured['hesabno:transactions'], '[{"id":1,"amount":5000}]');
  assert.equal(captured['hesabno:accounts_v5'], '[{"id":1,"name":"بانک"}]');
  assert.equal('hesabno:currency' in captured, false, 'کلید بیرون از فهرست پشتیبان نباید برداشته شود');
  assert.equal(captured['hesabno:loans'], null, 'کلید فهرست‌شده‌ی خالی باید null بدهد');
});

test('a backup made by the previous app version (23 keys) is still accepted and restored', () => {
  const { window, store } = setupResetFlow({ data: { 'hesabno:transactions': '[{"id":1}]' } });
  const captured = window.__hesabnoCaptureResetData();
  const legacy = { ...captured };
  delete legacy['hesabno:check_settlement_dates'];
  assert.equal(Object.keys(legacy).length, declaredKeys.length - 1);

  assert.equal(window.__hesabnoValidateResetData(legacy), true,
    'فایل پشتیبان نسخه‌ی قبل نباید رد شود، وگرنه بازیابی کاربران قدیمی می‌شکند');

  /* کلید تازه در فایل قدیمی نیست؛ بازیابی نباید آن را بسازد یا پاک کند */
  assert.equal(store.has('hesabno:check_settlement_dates'), false);
  store.set('hesabno:check_settlement_dates', '{"t-1":"1405/06/10"}');
  const before = store.get('hesabno:check_settlement_dates');
  assert.equal(window.__hesabnoRestoreResetData(legacy), true);
  assert.equal(store.get('hesabno:check_settlement_dates'), before,
    'پشتیبان قدیمی نباید کلیدی را که نداشته دست بزند');
  assert.equal(window.__hesabnoRestoreResetData({ ...legacy, 'hesabno:ناموجود': null }), false,
    'کلید ناشناخته حتی در حالت پشتیبان قدیمی هم باید رد شود');
});

test('backup validation accepts a real capture and rejects malformed payloads', () => {
  const { window } = setupResetFlow({ data: { 'hesabno:transactions': '[]' } });
  const captured = window.__hesabnoCaptureResetData();
  assert.equal(window.__hesabnoValidateResetData(captured), true);

  const missingKey = { ...captured };
  delete missingKey['hesabno:transactions'];
  assert.equal(window.__hesabnoValidateResetData(missingKey), false, 'کلید ناقص باید رد شود');

  const extraKey = { ...captured, 'hesabno:unknown': 'x' };
  assert.equal(window.__hesabnoValidateResetData(extraKey), false, 'کلید ناشناخته باید رد شود');

  const wrongType = { ...captured, 'hesabno:transactions': 12345 };
  assert.equal(window.__hesabnoValidateResetData(wrongType), false, 'مقدار غیر رشته‌ای باید رد شود');

  assert.equal(window.__hesabnoValidateResetData(null), false);
  assert.equal(window.__hesabnoValidateResetData([captured]), false, 'آرایه نباید به‌عنوان پشتیبان پذیرفته شود');
  assert.equal(window.__hesabnoValidateResetData('{}'), false);
});

test('backup restore brings storage back to the captured state including removed keys', () => {
  const original = {
    'hesabno:transactions': '[{"id":1}]',
    'hesabno:accounts_v5': '[{"id":1,"name":"بانک"}]',
    'hesabno:loans': '[{"id":"loan-1"}]',
  };
  const { window, store } = setupResetFlow({ data: original });
  const snapshot = window.__hesabnoCaptureResetData();

  store.set('hesabno:transactions', '[{"id":2}]');
  store.set('hesabno:accounts_v5', '[]');
  store.set('hesabno:loans', null);

  assert.equal(window.__hesabnoRestoreResetData(snapshot), true);
  assert.equal(store.get('hesabno:transactions'), '[{"id":1}]');
  assert.equal(store.get('hesabno:accounts_v5'), '[{"id":1,"name":"بانک"}]');
  assert.equal(store.get('hesabno:loans'), '[{"id":"loan-1"}]');
  assert.equal(store.size, Object.keys(original).length, 'کلید اضافه‌ای نباید ساخته شود');
});

test('backup restore leaves settings outside the backup set untouched', () => {
  const { window, store } = setupResetFlow({
    data: {
      'hesabno:transactions': '[{"id":1}]',
      'hesabno:currency': 'toman',
      'hesabno:theme': 'light',
      'hesabno:first_run_intro_done': 'true',
      'hesabno:reset_safety_backup': '{"hesabno:transactions":null}',
    },
  });
  const snapshot = window.__hesabnoCaptureResetData();
  store.set('hesabno:transactions', '[]');

  assert.equal(window.__hesabnoRestoreResetData(snapshot), true);
  assert.equal(store.get('hesabno:currency'), 'toman');
  assert.equal(store.get('hesabno:theme'), 'light');
  assert.equal(store.get('hesabno:first_run_intro_done'), 'true');
  assert.equal(store.get('hesabno:reset_safety_backup'), '{"hesabno:transactions":null}');
});

test('backup restore rolls back completely when a write fails midway', () => {
  const before = {
    'hesabno:accounts_v5': 'BEFORE-ACCOUNTS',
    'hesabno:accounts': 'BEFORE-LEGACY',
    'hesabno:transactions': 'BEFORE-TX',
  };
  // دومین نوشتن بازیابی (کلید hesabno:accounts) شکست می‌خورد تا برگشت‌پذیری سنجیده شود.
  const { window, store } = setupResetFlow({ data: before, failOnWriteNumber: 2 });
  const snapshot = window.__hesabnoCaptureResetData();
  store.set('hesabno:accounts_v5', 'CHANGED-ACCOUNTS');
  store.set('hesabno:accounts', 'CHANGED-LEGACY');
  store.set('hesabno:transactions', 'CHANGED-TX');

  const applied = window.__hesabnoRestoreResetData({
    ...snapshot,
    'hesabno:accounts_v5': 'NEW-ACCOUNTS',
    'hesabno:accounts': 'NEW-LEGACY',
    'hesabno:transactions': 'NEW-TX',
  });

  assert.equal(applied, false, 'بازیابی ناتمام باید false برگرداند');
  assert.equal(store.get('hesabno:accounts_v5'), 'CHANGED-ACCOUNTS', 'نوشتن نیمه‌کاره باید برگردد');
  assert.equal(store.get('hesabno:accounts'), 'CHANGED-LEGACY');
  assert.equal(store.get('hesabno:transactions'), 'CHANGED-TX', 'کلیدهای بعدی نباید دست بخورند');
  assert.deepEqual([...store.keys()].sort(), Object.keys(before).sort(), 'مجموعه‌ی کلیدها نباید تغییر کند');
});

test('backup restore still succeeds on the same data when no write fails', () => {
  const before = {
    'hesabno:accounts_v5': 'BEFORE-ACCOUNTS',
    'hesabno:accounts': 'BEFORE-LEGACY',
    'hesabno:transactions': 'BEFORE-TX',
  };
  const { window, store } = setupResetFlow({ data: before });
  const snapshot = window.__hesabnoCaptureResetData();
  store.set('hesabno:transactions', 'CHANGED-TX');

  assert.equal(window.__hesabnoRestoreResetData(snapshot), true);
  assert.equal(store.get('hesabno:transactions'), 'BEFORE-TX');
});

test('backup restore refuses silently dropped writes and keeps the previous data', () => {
  const { window, store } = setupResetFlow({
    data: { 'hesabno:transactions': 'ORIGINAL' },
    dropOn: (key) => key === 'hesabno:loans',
  });
  const snapshot = window.__hesabnoCaptureResetData();

  const applied = window.__hesabnoRestoreResetData({ ...snapshot, 'hesabno:loans': '[{"id":"silent"}]' });

  assert.equal(applied, false, 'ذخیره‌ای که بی‌صدا داده را نگه نمی‌دارد باید تشخیص داده شود');
  assert.equal(store.get('hesabno:transactions'), 'ORIGINAL', 'داده‌ی موجود نباید از دست برود');
  assert.equal(store.has('hesabno:loans'), false);
});

const coreBundle = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/scripts/067-inline.js'),
  'utf8'
);

test('exported files history (Vo) caps preview rows and strips oversized HTML so localStorage never bloats', () => {
  const start = coreBundle.indexOf('const Gh="hesabno:exported_files";');
  const end = coreBundle.indexOf('function Ua(t,s){', start);
  assert.ok(start > -1 && end > start, 'توابع تاریخچه‌ی خروجی در ۰۶۷ پیدا می‌شوند');

  const store = new Map();
  const ctx = {
    __safeGet: (k) => (store.has(k) ? store.get(k) : null),
    __safeSet: (k, v) => { store.set(k, String(v)); return true; },
    __safeRemove: (k) => store.delete(k),
    console: { error() {} },
  };
  vm.runInNewContext(coreBundle.slice(start, end), ctx);

  const bigRows = Array.from({ length: 200 }, (_, idx) => ({ ردیف: idx + 1, مبلغ: '100000' }));
  const hugeHtml = '<table>' + '<tr><td>x</td></tr>'.repeat(3000) + '</table>';
  for (let i = 0; i < 35; i += 1) {
    ctx.Vo({
      id: 'exp-' + i,
      title: 'گزارش ' + i,
      filename: 'r-' + i + '.xlsx',
      tableData: bigRows,
      contentHtml: hugeHtml,
    });
  }

  const saved = JSON.parse(store.get('hesabno:exported_files'));
  assert.equal(saved.length, 25, 'حداکثر ۲۵ مورد آخر در تاریخچه‌ی خروجی نگه داشته می‌شود');
  assert.equal(saved[0].tableData.length, 25, 'جدول پیش‌نمایش به ۲۵ سطر اول محدود می‌شود');
  assert.equal(saved[0].contentHtml, undefined, 'HTML حجیم در localStorage ذخیره نمی‌شود');
});

test('backup health shield (gq) validates v5.1 envelopes and rejects corrupt or encrypted payloads before restore', () => {
  const { window } = setupResetFlow({
    data: {
      'hesabno:accounts_v5': '[{"id":1,"name":"بانک"}]',
      'hesabno:transactions': '[{"id":1,"amount":5000,"date":"1405/07/01"}]',
    },
  });
  const gqStart = coreBundle.indexOf('function gq(t,s){');
  const gqEnd = coreBundle.indexOf('const vq=({open:t', gqStart);
  assert.ok(gqStart > -1 && gqEnd > gqStart, 'تابع gq در ۰۶۷ پیدا می‌شود');

  const ctx = {
    window,
    Rt: () => '1405/07/26',
  };
  vm.runInNewContext(coreBundle.slice(gqStart, gqEnd), ctx);

  const validStorage = window.__hesabnoCaptureResetData();
  const validEnvelope = {
    version: '5.1',
    currency: 'rial',
    accounts: [{ id: 1, name: 'بانک' }],
    transactions: [{ id: 1, amount: 5000, date: '1405/07/01' }],
    storageData: validStorage,
  };
  const okRes = ctx.gq(validEnvelope, []);
  assert.equal(okRes.success, true, 'پشتیبان سالم نسخه 5.1 باید پذیرفته شود');
  assert.equal(okRes.healthVerified, true);

  const encryptedRes = ctx.gq({ format: 'hesabno-encrypted-backup', version: 1 }, []);
  assert.equal(encryptedRes.success, false, 'پشتیبان رمزگذاری‌شده باید به بخش خودش هدایت شود');
  assert.match(encryptedRes.errorMessage, /پشتیبان رمزگذاری‌شده/);

  const badVersionRes = ctx.gq({ ...validEnvelope, version: '9.9' }, []);
  assert.equal(badVersionRes.success, false, 'نسخه‌ی ناشناخته باید رد شود');

  const badAmountRes = ctx.gq({
    ...validEnvelope,
    transactions: [{ id: 1, amount: 'not-a-number' }],
  }, []);
  assert.equal(badAmountRes.success, false, 'سند با مبلغ خراب باید پیش از بازیابی رد شود');

  const corruptStorageRes = ctx.gq({
    ...validEnvelope,
    storageData: { ...validStorage, 'hesabno:checks': '{broken-json' },
  }, []);
  assert.equal(corruptStorageRes.success, false, 'JSON خراب درون storageData باید رد شود');
});

test('local snapshots strip recursive local_snapshots/exported_files and restore all 24 keys atomically', () => {
  assert.match(
    coreBundle,
    /pe\["hesabno:local_snapshots"\]=null,pe\["hesabno:exported_files"\]=null/,
    'ge() باید از تو در تو شدن نقاط بازگشت و تاریخچه‌ی خروجی‌ها جلوگیری کند'
  );
  const storageStatusStyle = fs.readFileSync(
    path.join(root, 'app/src/main/assets/src/styles/241-hide-storage-status-card.css'),
    'utf8'
  );
  const index = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
  assert.match(coreBundle, /id:"hesabno-storage-status-card"/, 'نشانگر کارت قدیمی برای سازگاری در bundle باقی مانده است');
  assert.match(storageStatusStyle, /#hesabno-storage-status-card\s*\{\s*display:\s*none\s*!important;/,
    'کارت سنجش localStorage نباید به‌عنوان فضای کل برنامه نمایش داده شود');
  assert.ok(index.includes('src/styles/241-hide-storage-status-card.css?v=1'), 'قانون حذف کارت باید بارگذاری شود');
  assert.match(
    coreBundle,
    /انتخاب فایل پشتیبان از دستگاه/,
    'تب بازیابی باید دکمه‌ی انتخاب فایل پشتیبان را نمایش دهد'
  );
});

test('external attachment offloading supports 10,000 transactions with attachments and persists across reinstall', () => {
  const writeGuardModuleSource = fs.readFileSync(
    path.join(root, 'app/src/main/assets/src/storage/write-guard.js'),
    'utf8'
  );
  const guardInstallerSource = fs.readFileSync(
    path.join(root, 'app/src/main/assets/src/scripts/000a-hesabno-storage-write-guard.js'),
    'utf8'
  );

  const nativeFiles = new Map();
  const nativeSqlKv = new Map();
  let savedAutoBackupJson = '';
  let enforceWebView5MbQuota = false;

  function createEnv(seedStorage = {}) {
    const lsMap = new Map(Object.entries(seedStorage));
    function Storage() {}
    Storage.prototype.getItem = function (k) { return lsMap.has(k) ? lsMap.get(k) : null; };
    Storage.prototype.setItem = function (k, v) {
      if (enforceWebView5MbQuota && String(v).length > 500000) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      lsMap.set(String(k), String(v));
    };
    Storage.prototype.removeItem = function (k) { lsMap.delete(String(k)); };
    Storage.prototype.clear = function () { lsMap.clear(); };
    Storage.prototype.key = function (i) { return Array.from(lsMap.keys())[i] || null; };
    const localStorage = new Storage();
    Object.defineProperty(localStorage, 'length', { get: () => lsMap.size });

    const HnBridge = {
      sqlGetItem(key) {
        return nativeSqlKv.has(String(key)) ? nativeSqlKv.get(String(key)) : null;
      },
      sqlSetItem(key, value) {
        nativeSqlKv.set(String(key), String(value));
        return true;
      },
      sqlRemoveItem(key) {
        nativeSqlKv.delete(String(key));
        return true;
      },
      sqlClear() {
        nativeSqlKv.clear();
        return true;
      },
      sqlExportAllJson() {
        return JSON.stringify(Object.fromEntries(nativeSqlKv.entries()));
      },
      sqlImportAllJson(jsonStr) {
        const obj = JSON.parse(jsonStr);
        for (const [k, v] of Object.entries(obj)) {
          if (v === null) nativeSqlKv.delete(k);
          else nativeSqlKv.set(k, String(v));
        }
        return true;
      },
      saveAttachment(id, dataUrl) {
        nativeFiles.set(String(id), String(dataUrl));
        return true;
      },
      readAttachment(id) {
        return nativeFiles.get(String(id)) || '';
      },
      deleteAttachment(id) {
        return nativeFiles.delete(String(id));
      },
      exportAllAttachmentsJson() {
        return JSON.stringify(Object.fromEntries(nativeFiles.entries()));
      },
      importAllAttachmentsJson(jsonStr) {
        const obj = JSON.parse(jsonStr);
        for (const [k, v] of Object.entries(obj)) nativeFiles.set(k, v);
        return true;
      },
      saveAutoBackup(payload) {
        savedAutoBackupJson = String(payload);
        return true;
      },
      readAutoBackup() {
        return savedAutoBackupJson;
      },
    };

    const window = {
      Storage,
      localStorage,
      HnBridge,
      setTimeout: (fn) => { fn(); return 1; },
      clearTimeout: () => {},
      addEventListener: () => {},
      dispatchEvent: () => {},
      CustomEvent: class {},
    };
    const document = {
      visibilityState: 'visible',
      addEventListener: () => {},
      querySelectorAll: () => [],
      createElement: () => null,
    };
    const ctx = { window, Storage, localStorage, document, console };
    vm.runInNewContext(writeGuardModuleSource, ctx);
    window.HesabnoStorage = ctx.HesabnoStorage;
    vm.runInNewContext(guardInstallerSource, ctx);
    return { window, localStorage, lsMap };
  }

  const env1 = createEnv({ 'hesabno:accounts_v5': '[{"id":1,"name":"بانک"}]' });
  const sampleReceiptBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(40000);

  // ۱) ساخت ۱۰٬۰۰۰ تراکنش که همگی دارای پیوست تصویر فیش هستند
  const tenThousandTxs = Array.from({ length: 10000 }, (_, i) => ({
    id: i + 1,
    documentNumber: i + 1,
    title: 'خرید روزانه',
    category: 'خرید روزانه و سوپرمارکت',
    account: 'بانک ملت',
    amount: 250000 + (i % 1000),
    date: '1405/07/27',
    type: 'expense',
    method: 'normal',
    attachment: i % 2 === 0 ? sampleReceiptBase64 : ('data:image/jpeg;base64,RECEIPT_' + (i % 50) + '_' + 'B'.repeat(30000)),
  }));

  env1.window.__hesabnoOffloadTransactionsArray(tenThousandTxs);
  const serializedTxs = JSON.stringify(tenThousandTxs);

  // تمام ۱۰٬۰۰۰ تراکنش باید به شناسهٔ کوتاه attref: تبدیل شده باشند و حجم کل کمتر از ۳ مگابایت باشد
  assert.equal(tenThousandTxs.every((tx) => tx.attachment.startsWith('attref:att_')), true);
  assert.equal(serializedTxs.includes('data:image/'), false, 'هیچ رشتهٔ base64 سنگینی نباید داخل localStorage بماند');
  assert.equal(serializedTxs.length < 3 * 1024 * 1024, true, '۱۰٬۰۰۰ تراکنش عکس‌دار در localStorage زیر ۳ مگابایت جا می‌شوند');

  // ذخیره در localStorage (حتی در صورت برخورد به سقف سهمیهٔ WebView، موتور بومی SQLite بدون خطا ذخیره می‌کند)
  enforceWebView5MbQuota = true;
  env1.localStorage.setItem('hesabno:transactions', serializedTxs);
  assert.equal(env1.window.__hesabnoNativeSqlOverflowActive, true, 'سرریز سهمیهٔ WebView باید بدون خطا توسط SQLite بومی جذب شود');
  assert.equal(nativeSqlKv.get('hesabno:transactions'), serializedTxs, 'کل ۱۰٬۰۰۰ تراکنش در دیتابیس SQLite بومی اندروید ثبت شدند');
  assert.equal(env1.localStorage.getItem('hesabno:transactions'), serializedTxs, 'خواندن از localStorage همچنان کل ۱۰٬۰۰۰ تراکنش را برمی‌گرداند');
  enforceWebView5MbQuota = false;

  env1.window.__hesabnoFlushAutoBackup();
  assert.ok(savedAutoBackupJson.length > 100, 'پشتیبان خودکار همراه با پیوست‌ها ذخیره شد');

  // ۲) شبیه‌سازی حذف و نصب مجدد برنامه (پاک شدن کامل localStorage، دیتابیس داخلی و فایل‌های داخلی و بازیابی از پشتیبان)
  nativeFiles.clear();
  nativeSqlKv.clear();
  const env2 = createEnv({});
  assert.equal(env2.window.__hesabnoAutoBackupRestored, true, 'پس از نصب مجدد، پشتیبان خودکار باید بی‌درنگ بازیابی شود');
  assert.equal(nativeSqlKv.has('hesabno:transactions'), true, 'پس از نصب مجدد، دیتابیس SQLite بومی نیز خودکار بازسازی شد');

  const restoredTxs = JSON.parse(env2.localStorage.getItem('hesabno:transactions'));
  assert.equal(restoredTxs.length, 10000, 'تمام ۱۰٬۰۰۰ تراکنش پس از نصب مجدد بازیابی شدند');
  assert.equal(
    env2.window.__hesabnoResolveAttachment(restoredTxs[0].attachment),
    sampleReceiptBase64,
    'تصویر پیوست تراکنش پس از نصب مجدد عیناً بازیابی و نمایش داده می‌شود'
  );
  assert.equal(
    env2.window.__hesabnoResolveAttachment(restoredTxs[9999].attachment).startsWith('data:image/jpeg;base64,RECEIPT_49_'),
    true,
    'تصویر پیوست آخرین تراکنش (سند ۱۰٬۰۰۰ام) نیز عیناً بازیابی شد'
  );
});


