/*
 * آزمون‌های مهاجرت داده (مرحله ۲)
 *
 * چرا مهم است: این اسکریپت‌ها در راه‌اندازی روی داده‌ی واقعی کاربر می‌نویسند و هیچ
 * نسخه/بازگشتی ندارند. آزمون‌ها سه ویژگی را قفل می‌کنند:
 *   ۱) اثر درست روی داده‌ی هدف، ۲) بی‌اثر بودن روی داده‌ی نامرتبط، ۳) خودتکرار نبودن (idempotency).
 *
 * کدهای تحت آزمون (اجرای واقعی فایل‌های برنامه):
 *   006-hesabno-loan-document-number-migration.js
 *   007-hesabno-loan-received-description-migration.js
 *   059-hesabno-remove-sample-fiscal-year-v2.js
 *   065-hesabno-shortcut-category-migration.js
 *   094-hesabno-check-system-accounts.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SCRIPTS = path.join(__dirname, '..', 'app/src/main/assets/src/scripts');
const read = (name) => fs.readFileSync(path.join(SCRIPTS, name), 'utf8');

const loanDocumentMigration = read('006-hesabno-loan-document-number-migration.js');
const loanDescriptionMigration = read('007-hesabno-loan-received-description-migration.js');
const sampleFiscalYearCleanup = read('059-hesabno-remove-sample-fiscal-year-v2.js');
const shortcutCategoryMigration = read('065-hesabno-shortcut-category-migration.js');
const checkSystemAccounts = read('094-hesabno-check-system-accounts.js');

/** محیط شبیه‌سازی‌شده‌ی مرورگر با Storage واقعیِ درون‌حافظه‌ای و شمارش نوشتن‌ها. */
function createEnvironment(initial = {}) {
  const store = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  const writes = [];
  const memory = {};
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { writes.push(key); store.set(key, String(value)); },
    removeItem: (key) => { writes.push(key); store.delete(key); },
    key: (index) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  };
  const window = {
    localStorage,
    __hesabnoMemoryStorage: memory,
    __safeGet: (key) => localStorage.getItem(key),
    __safeSet: (key, value) => { localStorage.setItem(key, value); return true; },
    __safeRemove: (key) => localStorage.removeItem(key),
    setTimeout: () => 0,
    addEventListener: () => {},
  };
  const context = {
    window,
    localStorage,
    document: { addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [], body: {}, head: {} },
    MutationObserver: class { observe() {} },
    console: { warn: () => {}, error: () => {} },
  };
  return {
    window,
    writes,
    run(script) { vm.runInNewContext(script, context); },
    value(key) {
      const value = store.get(key);
      if (value == null) return null;
      try { return JSON.parse(value); } catch (error) { return value; }
    },
    setRaw(key, value) { store.set(key, String(value)); },
    raw(key) { return store.has(key) ? store.get(key) : null; },
    json(key) { const value = store.get(key); return value == null ? null : JSON.parse(value); },
    has(key) { return store.has(key); },
  };
}

test('loan document number migration fills missing numbers once and keeps other transactions intact', () => {
  const env = createEnvironment({
    'hesabno:transactions': [
      { id: 1, documentNumber: 7, title: 'خرید', amount: 1000 },
      { id: 2, loanId: 'loan-1', amount: 500000, description: 'دریافت وام' },
      { id: 3, installmentId: 'inst-1', amount: 20000, title: 'قسط' },
      { id: 4, loanId: 'loan-2', amount: 30000, documentNumber: '' },
    ],
  });

  env.run(loanDocumentMigration);

  const transactions = env.json('hesabno:transactions');
  assert.equal(transactions[0].documentNumber, 7, 'سند عادی نباید تغییر کند');
  assert.equal(transactions[1].documentNumber, 8, 'شماره‌ی بعدی از بیشینه‌ی موجود ادامه می‌یابد');
  assert.equal(transactions[2].documentNumber, 9);
  assert.equal(transactions[3].documentNumber, 10, 'شماره‌ی خالی باید پر شود');
  assert.equal(transactions[1].title, 'دریافت وام', 'عنوان خالی از شرح پر می‌شود');

  const afterFirstRun = JSON.stringify(transactions);
  env.run(loanDocumentMigration);
  assert.equal(JSON.stringify(env.json('hesabno:transactions')), afterFirstRun, 'اجرای دوباره نباید چیزی عوض کند');
});

test('loan document number migration ignores timestamp-style ids and reversal documents', () => {
  const timestamp = 1763200000000;
  const env = createEnvironment({
    'hesabno:transactions': [
      { id: timestamp, documentNumber: timestamp, loanId: 'loan-1', amount: 100 },
      { id: 5, loanId: 'loan-2', amount: 200, documentNumber: 2, isReversal: true },
    ],
  });

  env.run(loanDocumentMigration);

  const transactions = env.json('hesabno:transactions');
  assert.equal(transactions[0].documentNumber, 3, 'شناسه‌ی زمانی نباید به‌عنوان شماره‌ی سند پذیرفته شود؛ از بیشینه‌ی معتبر ادامه می‌دهد');
  assert.equal(transactions[1].documentNumber, 2, 'سند اصلاحی نباید شماره‌ی تازه بگیرد');
});

test('loan description migration rewrites only received-loan income rows and is idempotent', () => {
  const env = createEnvironment({
    'hesabno:transactions': [
      { id: 1, type: 'income', loanId: 'loan-1', description: 'دریافت وجه وام مسکن', title: 'دریافت وجه وام مسکن' },
      { id: 2, type: 'expense', loanId: 'loan-1', description: 'دریافت وجه اشتباه' },
      { id: 3, type: 'income', description: 'دریافت وجه فروش' },
    ],
  });

  env.run(loanDescriptionMigration);

  const transactions = env.json('hesabno:transactions');
  assert.equal(transactions[0].description, 'وام مسکن - وام دریافتی');
  assert.equal(transactions[0].title, 'وام مسکن - وام دریافتی');
  assert.equal(transactions[1].description, 'دریافت وجه اشتباه', 'ردیف هزینه نباید تغییر کند');
  assert.equal(transactions[2].description, 'دریافت وجه فروش', 'تراکنش بدون وام نباید تغییر کند');

  const afterFirstRun = JSON.stringify(transactions);
  env.run(loanDescriptionMigration);
  assert.equal(JSON.stringify(env.json('hesabno:transactions')), afterFirstRun, 'اجرای دوباره نباید پیشوند اضافه کند');
});

test('sample fiscal year cleanup removes only the built-in sample and repoints the active year', () => {
  const sample = {
    id: 'fy-1404',
    title: 'سال مالی 1404',
    startDate: '1404/01/01',
    endDate: '1404/12/29',
    closedBy: 'auto',
    closingDocNumber: 142,
    summary: { totalIncome: 185000000, totalExpense: 112000000, netProfitLoss: 73000000 },
    archivedTransactions: [{ id: 991 }, { id: 992 }, { id: 993 }],
  };
  const realYear = { id: 'fy-user', title: 'سال مالی 1405', startDate: '1405/01/01', endDate: '1405/12/29' };
  const env = createEnvironment({
    'hesabno:fiscal_years': [sample, realYear],
    'hesabno:transactions': [{ id: 1, amount: 500 }],
  });
  env.setRaw('hesabno:active_fiscal_year_id', 'fy-1404');

  env.run(sampleFiscalYearCleanup);

  const years = env.json('hesabno:fiscal_years');
  assert.equal(years.length, 1);
  assert.equal(years[0].id, 'fy-user', 'سال مالی واقعی کاربر باید بماند');
  assert.equal(env.raw('hesabno:active_fiscal_year_id'), 'fy-user', 'سال فعال باید به سال معتبر منتقل شود');
  assert.deepEqual(env.json('hesabno:transactions'), [{ id: 1, amount: 500 }], 'تراکنش‌ها نباید دست بخورند');

  const afterFirstRun = env.json('hesabno:fiscal_years');
  env.run(sampleFiscalYearCleanup);
  assert.deepEqual(env.json('hesabno:fiscal_years'), afterFirstRun);
});

test('sample fiscal year cleanup leaves user-created years with similar ids alone', () => {
  const lookalike = {
    id: 'fy-1404',
    title: 'سال مالی 1404 من',
    startDate: '1404/01/01',
    endDate: '1404/12/29',
    summary: { totalIncome: 185000000, totalExpense: 112000000, netProfitLoss: 999 },
    archivedTransactions: [{ id: 1 }, { id: 2 }, { id: 3 }],
  };
  const env = createEnvironment({
    'hesabno:fiscal_years': [lookalike],
  });
  env.setRaw('hesabno:active_fiscal_year_id', 'fy-1404');

  env.run(sampleFiscalYearCleanup);

  assert.deepEqual(env.json('hesabno:fiscal_years'), [lookalike], 'سال مالی کاربر نباید حذف شود');
  assert.equal(env.raw('hesabno:active_fiscal_year_id'), 'fy-1404');
});

test('shortcut category migration rewrites the legacy label only and stops rewriting afterwards', () => {
  const env = createEnvironment({
    'hesabno:shortcuts': [
      { id: 104, name: 'شارژ ساختمان', to: 'هزینه‌های عمومی و شارژ' },
      { id: 105, name: 'خرید روزانه', to: 'خرید روزانه و سوپرمارکت' },
    ],
    'hesabno:currency': 'toman',
  });

  env.run(shortcutCategoryMigration);

  const shortcuts = env.json('hesabno:shortcuts');
  assert.equal(shortcuts[0].to, 'شارژ ساختمان و مجتمع');
  assert.equal(shortcuts[1].to, 'خرید روزانه و سوپرمارکت', 'میانبر نامرتبط نباید تغییر کند');
  assert.equal(env.value('hesabno:currency'), 'toman', 'کلید نامرتبط نباید دست بخورد');

  const writesAfterMigration = env.writes.length;
  env.run(shortcutCategoryMigration);
  assert.equal(env.writes.length, writesAfterMigration, 'اجرای دوباره نباید بنویسد');
});

test('check system accounts migration adds both accounts once and keeps existing data', () => {
  const env = createEnvironment({
    'hesabno:accounts_v5': [
      { id: 1, name: 'بانک ملت', group: 'asset', code: '101', system: false },
      { id: 5, name: 'اسناد دریافتنی', group: 'asset', code: '106', system: false },
    ],
  });

  env.run(checkSystemAccounts);

  const accounts = env.json('hesabno:accounts_v5');
  const receiving = accounts.find((account) => account.name === 'اسناد دریافتنی');
  const payable = accounts.find((account) => account.name === 'اسناد پرداختنی');
  assert.ok(receiving && payable, 'هر دو حساب سیستمی باید وجود داشته باشند');
  assert.equal(receiving.system, true, 'حساب موجود باید سیستمی شود');
  assert.equal(payable.system, true);
  assert.equal(payable.id, 6, 'شناسه‌ی بعدی از بیشینه‌ی موجود ادامه می‌یابد');
  assert.equal(accounts[0].name, 'بانک ملت');
  assert.equal(accounts[0].system, false, 'حساب کاربر نباید سیستمی شود');
  assert.equal(env.raw('hesabno:check-system-accounts-v1'), 'done');
  assert.deepEqual(env.json('hesabno:accounts'), accounts, 'کلید قدیمی هم برای سازگاری به‌روز می‌شود');

  const snapshot = JSON.stringify(accounts);
  const writesAfterMigration = env.writes.length;
  env.run(checkSystemAccounts);
  assert.equal(JSON.stringify(env.json('hesabno:accounts_v5')), snapshot, 'اجرای دوباره نباید حساب اضافه کند');
  assert.equal(env.writes.length, writesAfterMigration, 'اجرای دوباره نباید بنویسد');
});
