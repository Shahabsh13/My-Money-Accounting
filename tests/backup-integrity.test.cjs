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
const declaredKeys = [...resetFlowSource.slice(startIndex, endIndex).matchAll(/"hesabno:[^"]+"/g)].map((match) =>
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
