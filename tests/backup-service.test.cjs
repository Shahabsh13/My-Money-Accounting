/*
 * آزمون لایه‌ی پشتیبان/اعتبارسنجی/بازیابی (مرحله ۸)
 *
 * چه چیزی را قفل می‌کند:
 *   • قرارداد فایل «5.1» بدون هیچ تغییر قالب.
 *   • سازگاری عقب‌رو: فایل ۲۳ کلیدی نسخه‌ی قبل پذیرفته و بازیابی می‌شود؛ کلید تازه دست نمی‌خورد.
 *   • رد قاطع فایل خراب/ناشناخته/ناقص — پیش از دست‌زدن به داده.
 *   • بازیابی اتمی: تأیید خواندن مجدد و بازگردانی کامل در صورت شکست.
 *   • هم‌رأی بودن ماژول با پیاده‌سازی واقعی ۱۰۸ روی یک ماتریس از فایل‌ها.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const backup = require('../app/src/main/assets/src/domain/backup.js');
const registry = require('../app/src/main/assets/src/storage/keys.js');

const root = path.resolve(__dirname, '..');
const KEYS = registry.backupKeys().map((entry) => entry.key).sort();
const LEGACY_KEYS = KEYS.filter((key) => key !== 'hesabno:check_settlement_dates');

/* Storage ساده با امکان تزریق شکست */
function makeStorage(seed = {}, options = {}) {
  const data = new Map(Object.entries(seed));
  const state = { failOnWrite: null, failOnDelete: null, dropUntil: 0, writes: 0, deletes: 0 };
  return {
    data,
    state,
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) {
      state.writes += 1;
      if (options.failWrite && options.failWrite(key, state.writes, state)) throw new Error('quota');
      if (state.failOnWrite !== null && state.writes >= state.failOnWrite) throw new Error('quota');
      /* dropUntil: نوشتن‌های اول بی‌صدا دور ریخته می‌شوند (بازگردانی بعدی اجازه‌ی نوشتن دارد) */
      if (state.writes > state.dropUntil) data.set(key, String(value));
    },
    removeItem(key) {
      state.deletes += 1;
      if (options.failDelete && options.failDelete(key, state.deletes)) throw new Error('delete blocked');
      data.delete(key);
    },
  };
}

function sampleStorageData(keys) {
  const data = {};
  keys.forEach((key, index) => {
    data[key] = index % 5 === 4 ? null : JSON.stringify({ key, index });
  });
  return data;
}

function sampleEnvelope(storageData) {
  return {
    version: '5.1',
    exportDate: '2026-10-17T00:00:00.000Z',
    shamsiDate: '1405/07/25',
    timestamp: 1760000000000,
    currency: 'rial',
    numberFormat: 'slash',
    accounts: [{ id: 1, name: 'بانک', group: 'bank' }],
    transactions: [{ id: 1, date: '1405/06/01', type: 'income', amount: 1000 }],
    checks: [],
    loans: [],
    installments: [],
    budgets: [],
    fiscalYears: [],
    activeFiscalYearId: '1',
    shortcuts: [],
    familyMembers: [],
    projects: [],
    storageData,
  };
}

/* برش واقعی ۱۰۸ — همان الگوی tests/backup-integrity.test.cjs */
function loadResetFlow() {
  const source = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/108-hesabno-complete-reset-flow.js'), 'utf8');
  const START = 'var backupKeys = [';
  const END = 'window.__hesabnoRestoreResetData = restoreResetData;';
  const start = source.indexOf(START);
  const end = source.indexOf(END);
  assert.ok(start > -1 && end > start);
  const context = { window: {}, console: { warn() {}, error() {} }, setTimeout() {} };
  context.window.setTimeout = () => {};
  vm.runInNewContext(source.slice(start, end + END.length), context);
  const store = new Map();
  context.window.__safeGet = (key) => (store.has(key) ? store.get(key) : null);
  context.window.__safeSet = (key, value) => store.set(key, String(value));
  context.window.__safeRemove = (key) => store.delete(key);
  /* توابع ۱۰۸ پیش از اتصال __safeGet ساخته شده‌اند و در زمان فراخوانی آن را می‌خوانند */
  return { window: context.window, store };
}

test('capture takes exactly the declared keys and marks missing ones as null', () => {
  const storage = makeStorage({ 'hesabno:transactions': '[{"id":1}]', 'hesabno:theme': 'dark' });
  const result = backup.capture(storage, KEYS);
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.data).sort(), KEYS);
  assert.equal(result.data['hesabno:transactions'], '[{"id":1}]');
  assert.equal(result.data['hesabno:loans'], null);
  assert.equal('hesabno:theme' in result.data, false, 'تنظیمات بیرون از فهرست پشتیبان برداشته نمی‌شود');
});

test('capture reports a failing storage read instead of silently writing null', () => {
  const storage = makeStorage({});
  storage.getItem = () => { throw new Error('blocked'); };
  const result = backup.capture(storage, ['hesabno:transactions']);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].key, 'hesabno:transactions');
});

test('storageData validation accepts current and legacy key sets, rejects everything else', () => {
  const current = sampleStorageData(KEYS);
  assert.equal(backup.validateStorageData(current, { keys: KEYS, legacyKeys: LEGACY_KEYS }).ok, true);

  const legacy = sampleStorageData(LEGACY_KEYS);
  const legacyResult = backup.validateStorageData(legacy, { keys: KEYS, legacyKeys: LEGACY_KEYS });
  assert.equal(legacyResult.ok, true);
  assert.equal(legacyResult.legacy, true);
  assert.equal(legacyResult.warnings[0].code, 'storage-legacy-version');

  const unknown = { ...current, 'hesabno:evil': 'x' };
  assert.equal(backup.validateStorageData(unknown, { keys: KEYS, legacyKeys: LEGACY_KEYS }).ok, false);

  const missing = { ...current };
  delete missing['hesabno:transactions'];
  assert.equal(backup.validateStorageData(missing, { keys: KEYS, legacyKeys: LEGACY_KEYS }).ok, false);

  assert.equal(backup.validateStorageData({ ...current, 'hesabno:transactions': 42 }, { keys: KEYS }).ok, false);
  assert.equal(backup.validateStorageData([current], { keys: KEYS }).ok, false);
  assert.equal(backup.validateStorageData(null, { keys: KEYS }).ok, false);
});

test('buildEnvelope produces the existing 5.1 format and passes validation', () => {
  const storage = makeStorage(Object.fromEntries(KEYS.slice(0, 5).map((key, index) => [key, JSON.stringify({ index })])));
  const captured = backup.capture(storage, KEYS).data;
  const built = backup.buildEnvelope({
    accounts: [{ id: 1 }], transactions: [{ id: 1, amount: 500 }], checks: [],
    storageData: captured, currency: 'toman', numberFormat: 'slash',
    exportDate: '2026-10-17T00:00:00.000Z', shamsiDate: '1405/07/25', timestamp: 1760000000000,
  }, { keys: KEYS, legacyKeys: LEGACY_KEYS });

  assert.equal(built.ok, true, JSON.stringify(built.errors));
  const envelope = built.envelope;
  assert.equal(envelope.version, '5.1');
  assert.deepEqual(Object.keys(envelope.storageData).sort(), KEYS);
  assert.equal(envelope.currency, 'toman');

  /* از مسیر واقعی JSON: همان چیزی که روی دیسک نوشته و خوانده می‌شود */
  const roundTripped = JSON.parse(JSON.stringify(envelope));
  const validation = backup.validateEnvelope(roundTripped, { keys: KEYS, legacyKeys: LEGACY_KEYS });
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  assert.equal(validation.stats.storageKeys, KEYS.length);
  assert.equal(validation.stats.transactions, 1);
});

test('buildEnvelope refuses to build a file from invalid storage data', () => {
  const built = backup.buildEnvelope({ accounts: [], transactions: [], storageData: { 'hesabno:evil': 'x' } },
    { keys: KEYS, legacyKeys: LEGACY_KEYS });
  assert.equal(built.ok, false);
  assert.equal(built.envelope, null);
});

test('envelope validation explains corruption instead of accepting it', () => {
  const valid = sampleEnvelope(sampleStorageData(KEYS));

  const wrongVersion = { ...valid, version: '4.0' };
  assert.equal(backup.validateEnvelope(wrongVersion, { keys: KEYS }).ok, false);

  const missingTransactions = { ...valid };
  delete missingTransactions.transactions;
  assert.equal(backup.validateEnvelope(missingTransactions, { keys: KEYS }).ok, false);

  const brokenTransactions = { ...valid, transactions: [{ id: 1 }, 'broken'] };
  assert.equal(backup.validateEnvelope(brokenTransactions, { keys: KEYS }).ok, false);

  const badAmount = { ...valid, transactions: [{ id: 1, amount: 'abc' }] };
  const badAmountResult = backup.validateEnvelope(badAmount, { keys: KEYS });
  assert.equal(badAmountResult.ok, true, 'مبلغ نامعتبر هشدار است، نه خطای ساختاری');
  assert.equal(badAmountResult.warnings.some((warning) => warning.code === 'transaction-amount'), true);

  const noStorageData = { ...valid };
  delete noStorageData.storageData;
  const noStorage = backup.validateEnvelope(noStorageData, { keys: KEYS, legacyKeys: LEGACY_KEYS });
  assert.equal(noStorage.ok, true);
  assert.equal(noStorage.warnings.some((warning) => warning.code === 'no-storage-data'), true);

  const badCurrency = { ...valid, currency: 'dollar' };
  assert.equal(backup.validateEnvelope(badCurrency, { keys: KEYS }).warnings.some((warning) => warning.code === 'currency'), true);
});

test('planRestore writes present keys, deletes nulls, and leaves legacy gaps untouched', () => {
  const current = sampleStorageData(KEYS);
  const plan = backup.planRestore(makeStorage({}), current, { keys: KEYS, legacyKeys: LEGACY_KEYS });
  assert.equal(plan.ok, true);
  assert.equal(plan.writes.length + plan.deletes.length, KEYS.length);
  assert.equal(plan.deletes.length, Object.values(current).filter((value) => value === null).length);
  assert.deepEqual(plan.untouched, []);

  const legacyPlan = backup.planRestore(makeStorage({}), sampleStorageData(LEGACY_KEYS), { keys: KEYS, legacyKeys: LEGACY_KEYS });
  assert.equal(legacyPlan.ok, true);
  assert.deepEqual(legacyPlan.untouched, ['hesabno:check_settlement_dates']);
  assert.equal(legacyPlan.writes.some((write) => write.key === 'hesabno:check_settlement_dates'), false);
  assert.equal(legacyPlan.deletes.includes('hesabno:check_settlement_dates'), false);
});

test('applyRestore round-trips every key and removes nulls', () => {
  const source = makeStorage(Object.fromEntries(KEYS.map((key, index) => [key, index % 3 === 0 ? null : JSON.stringify({ key, index })])));
  const captured = backup.capture(source, KEYS).data;
  const target = makeStorage({ 'hesabno:theme': 'dark' });
  const plan = backup.planRestore(target, captured, { keys: KEYS, legacyKeys: LEGACY_KEYS });
  const result = backup.applyRestore(target, plan);
  assert.equal(result.ok, true, result.error);

  for (const key of KEYS) {
    assert.equal(target.getItem(key), captured[key], `مقدار ${key}`);
  }
  assert.equal(target.getItem('hesabno:theme'), 'dark', 'تنظیمات بیرون از پشتیبان نباید عوض شود');
});

test('applyRestore rolls back completely when a write fails midway', () => {
  /*
   * شکست «یک‌باره» در نوشتن ششم شبیه سهمیه‌ی واقعی است: همان نوشتن بزرگ رد می‌شود، ولی
   * نوشتن مقادیر قبلی (کوچک‌تر) هنگام بازگردانی موفق است.
   */
  let failed = false;
  const target = makeStorage(
    Object.fromEntries(KEYS.map((key) => [key, 'ORIGINAL'])),
    { failWrite: (key, count) => { if (count === 6 && !failed) { failed = true; return true; } return false; } }
  );
  const before = new Map(target.data);
  const plan = backup.planRestore(target, sampleStorageData(KEYS), { keys: KEYS, legacyKeys: LEGACY_KEYS });
  const result = backup.applyRestore(target, plan);

  assert.equal(result.ok, false);
  assert.equal(result.rolledBack, true);
  assert.equal(result.applied, 5, 'پنج نوشتن موفق پیش از شکست');
  for (const key of KEYS) {
    assert.equal(target.getItem(key), before.get(key), `بازگردانی ${key}`);
  }
});

test('applyRestore detects a silently dropped write and restores the previous data', () => {
  const target = makeStorage(Object.fromEntries(KEYS.map((key) => [key, 'ORIGINAL'])));
  const before = new Map(target.data);
  const captured = sampleStorageData(KEYS);
  const plan = backup.planRestore(target, captured, { keys: KEYS, legacyKeys: LEGACY_KEYS });
  target.state.dropUntil = target.state.writes + 3; /* سه نوشتن اول بی‌صدا دور ریخته می‌شوند */
  const result = backup.applyRestore(target, plan);
  target.state.dropUntil = 0;

  assert.equal(result.ok, false);
  assert.match(result.error, /verify failed/);
  for (const key of KEYS) {
    assert.equal(target.getItem(key), before.get(key), `داده‌ی قبلی ${key}`);
  }
});

test('the pure module and the real 108 implementation agree on every payload', () => {
  const { window } = loadResetFlow();
  const current = sampleStorageData(KEYS);
  const legacy = sampleStorageData(LEGACY_KEYS);
  const payloads = [
    current,
    legacy,
    { ...current, 'hesabno:evil': 'x' },
    { ...current, 'hesabno:transactions': 12345 },
    (() => { const copy = { ...current }; delete copy['hesabno:transactions']; return copy; })(),
    null,
    [],
    '{}',
  ];
  for (const payload of payloads) {
    const mine = backup.validateStorageData(payload, { keys: KEYS, legacyKeys: LEGACY_KEYS }).ok;
    const theirs = window.__hesabnoValidateResetData(payload);
    assert.equal(mine, theirs, `اختلاف رأی برای ${JSON.stringify(payload && Object.keys(payload).slice(0, 2))}`);
  }
});

test('summarize reports counts and legacy status without touching data', () => {
  const current = backup.summarize(sampleEnvelope(sampleStorageData(KEYS)));
  assert.equal(current.accounts, 1);
  assert.equal(current.transactions, 1);
  assert.equal(current.storageKeys, KEYS.length);
  assert.equal(current.legacy, false);

  const legacy = backup.summarize(sampleEnvelope(sampleStorageData(LEGACY_KEYS)));
  assert.equal(legacy.legacy, true);
  assert.equal(backup.summarize(null).storageKeys, 0);
});
