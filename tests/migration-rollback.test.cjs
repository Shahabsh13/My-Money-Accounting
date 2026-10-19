/*
 * آزمون نگهبان مهاجرت (مرحله ۶.۰)
 *
 * مرحله ۲ نشان داد پنج مهاجرت برنامه هیچ مسیر بازگشتی ندارند. این آزمون قفل می‌کند که حالا:
 *   ۱) نوشتن بی‌صدا ردشده (fake storage) تشخیص داده می‌شود و داده به حالت قبل برمی‌گردد.
 *   ۲) شکست در میانه‌ی مهاجرت چندکلیدی، همه‌ی کلیدها را برمی‌گرداند (نه فقط کلید ناموفق).
 *   ۳) خطای پرتاب‌شده در بدنه‌ی مهاجرت هم بازگردانی می‌کند.
 *   ۴) مهاجرت موفق، دقیقاً مثل قبل نتیجه می‌دهد و هیچ کلید اضافه‌ای نمی‌گذارد.
 *   ۵) بدون نگهبان، رفتار قبلی (fallback حافظه) دقیقاً حفظ می‌شود.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SCRIPTS = path.join(__dirname, '..', 'app/src/main/assets/src/scripts');
const read = (name) => fs.readFileSync(path.join(SCRIPTS, name), 'utf8');

const guardSource = read('005b-hesabno-migration-guard.js');
const migrations = {
  '006': read('006-hesabno-loan-document-number-migration.js'),
  '007': read('007-hesabno-loan-received-description-migration.js'),
  '059': read('059-hesabno-remove-sample-fiscal-year-v2.js'),
  '065': read('065-hesabno-shortcut-category-migration.js'),
  '094': read('094-hesabno-check-system-accounts.js'),
};

/*
 * محیط Storage با قابلیت «شکست هدفمند»:
 *   failWritesTo: مجموعه‌ی کلیدهایی که نوشتنشان بی‌صدا نادیده گرفته می‌شود (شبیه‌سازی سهمیه/سندباکس)
 *   throwOn:      کلیدی که setItem برایش استثنا پرتاب می‌کند
 */
function createEnvironment(initial = {}, options = {}) {
  const store = new Map(Object.entries(initial).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
  const writes = [];
  const memory = {};
  const failWritesTo = new Set(options.failWritesTo || []);
  const throwOn = options.throwOn || null;
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      if (key === throwOn) throw new Error('QuotaExceededError');
      writes.push(key);
      if (failWritesTo.has(key)) return;      /* نوشتن بی‌صدا رد می‌شود */
      store.set(key, String(value));
    },
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
    console: { warn: () => {}, error: () => {} },
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
    memory,
    run(script) { vm.runInNewContext(script, context); },
    runGuard() { vm.runInNewContext(guardSource, context); },
    guard() { return window.__hesabnoMigration; },
    raw(key) { return store.has(key) ? store.get(key) : null; },
    json(key) { const value = store.get(key); return value == null ? null : JSON.parse(value); },
    has(key) { return store.has(key); },
    keys() { return [...store.keys()]; },
  };
}

const LOAN_TRANSACTIONS = [
  { id: 1, documentNumber: 7, title: 'خرید', amount: 1000 },
  { id: 2, loanId: 'loan-1', amount: 500000, description: 'دریافت وام' },
  { id: 3, installmentId: 'inst-1', amount: 20000, title: 'قسط' },
];

test('a silently dropped write is detected and the original data is restored', () => {
  const initial = { 'hesabno:transactions': LOAN_TRANSACTIONS };
  const env = createEnvironment(initial, { failWritesTo: ['hesabno:transactions'] });
  env.runGuard();
  env.run(migrations['006']);

  assert.equal(env.raw('hesabno:transactions'), JSON.stringify(LOAN_TRANSACTIONS),
    'داده باید بایت‌به‌بایت به حالت قبل برگردد');
  assert.equal(env.guard().failures.length, 1, 'شکست باید ثبت شود');
  assert.equal(env.guard().failures[0].id, '006-loan-document-number');
  assert.equal(env.guard().failures[0].restored, true);

  /* هیچ کلید کمکی/عکس‌برداری در storage نباید باقی بماند */
  assert.deepEqual(env.keys(), ['hesabno:transactions']);
});

test('a migration that succeeds writes exactly the same bytes as before', () => {
  const env = createEnvironment({ 'hesabno:transactions': LOAN_TRANSACTIONS });
  env.runGuard();
  env.run(migrations['006']);

  const written = env.json('hesabno:transactions');
  assert.equal(written[1].documentNumber, 8, 'شماره سند وام باید پر شود');
  assert.equal(written[2].documentNumber, 9);
  assert.equal(written[0].documentNumber, 7, 'سند عادی نباید تغییر کند');
  assert.equal(env.guard().failures.length, 0);
  assert.deepEqual(env.keys(), ['hesabno:transactions'], 'هیچ کلید تازه‌ای اضافه نشود');
});

test('a multi-key migration restores every key when one write fails midway (094)', () => {
  const accounts = [
    { id: 1, name: 'بانک ملی', group: 'bank', active: true },
    { id: 2, name: 'صندوق', group: 'cash', active: true },
  ];
  const initial = {
    'hesabno:accounts_v5': accounts,
    'hesabno:accounts': accounts,
  };
  /* نوشتن کلید دوم رد می‌شود؛ کلید اول و سوم نباید نیمه‌کاره بمانند */
  const env = createEnvironment(initial, { failWritesTo: ['hesabno:accounts'] });
  env.runGuard();
  env.run(migrations['094']);

  assert.equal(env.raw('hesabno:accounts_v5'), JSON.stringify(accounts), 'کلید اول باید بازگردانی شود');
  assert.equal(env.raw('hesabno:accounts'), JSON.stringify(accounts), 'کلید دوم باید بازگردانی شود');
  assert.equal(env.has('hesabno:check-system-accounts-v1'), false, 'کلید سوم نباید اصلاً ایجاد شود');

  const failure = env.guard().failures[0];
  assert.equal(failure.id, '094-check-system-accounts');
  assert.equal(failure.restored, true);
});

test('a thrown storage error also triggers a full restore (059, two keys)', () => {
  const years = [
    { id: 'fy-1403', title: 'سال مالی 1403', startDate: '1403/01/01', endDate: '1403/12/29', isClosed: false, summary: {}, archivedTransactions: [] },
  ];
  const sample = {
    id: 'fy-1404', title: 'سال مالی 1404', startDate: '1404/01/01', endDate: '1404/12/29', closedBy: 'auto', closingDocNumber: 142,
    summary: { totalIncome: 185000000, totalExpense: 112000000, netProfitLoss: 73000000 },
    archivedTransactions: [{ id: 991 }, { id: 992 }, { id: 993 }],
  };
  const initial = {
    'hesabno:fiscal_years': [years[0], sample],
    'hesabno:active_fiscal_year_id': 'fy-1404',
  };
  const env = createEnvironment(initial, { throwOn: 'hesabno:active_fiscal_year_id' });
  env.runGuard();
  env.run(migrations['059']);

  assert.deepEqual(env.json('hesabno:fiscal_years'), [years[0], sample], 'سال‌های مالی باید بازگردانی شوند');
  assert.equal(env.raw('hesabno:active_fiscal_year_id'), 'fy-1404', 'سال فعال باید بازگردانی شود');
  assert.equal(env.guard().failures[0].restored, true);
});

test('the guard reports a failure but never throws into the boot sequence', () => {
  const env = createEnvironment({ 'hesabno:shortcuts': [] }, { failWritesTo: ['hesabno:shortcuts'] });
  env.runGuard();
  const source = `
    var result = window.__hesabnoMigration.run('probe', ['probe:key'], function (db) {
      db.set('probe:key', 'value');
      throw new Error('boom');
    });
    window.__probeResult = result;
  `;
  assert.doesNotThrow(() => vm.runInNewContext(source, { window: env.window }));
  assert.equal(env.window.__probeResult.ok, false);
  assert.equal(env.window.__probeResult.restored, true);
  assert.equal(env.has('probe:key'), false, 'کلید نیمه‌نوشته باید پاک شود');
});

test('writes to keys that were not declared upfront are still rolled back', () => {
  const env = createEnvironment({ 'declared:key': 'before', 'sneaky:key': 'original' });
  env.runGuard();
  env.runGuard();
  const result = env.window.__hesabnoMigration.run('probe-undeclared', ['declared:key'], function (db) {
    db.set('declared:key', 'after');
    db.set('sneaky:key', 'changed');
    throw new Error('fail after undeclared write');
  });
  assert.equal(result.ok, false);
  assert.equal(env.raw('declared:key'), 'before');
  assert.equal(env.raw('sneaky:key'), 'original', 'کلید اعلام‌نشده هم باید بازگردانی شود');
});

test('without the guard the five migrations keep their previous fallback behavior', () => {
  /* مسیر بدون نگهبان: استثنای storage → fallback حافظه (همان رفتار قبل از ۶.۰) */
  const initial = { 'hesabno:transactions': LOAN_TRANSACTIONS };
  const env = createEnvironment(initial, { throwOn: 'hesabno:transactions' });
  env.run(migrations['006']);

  assert.equal(env.raw('hesabno:transactions'), JSON.stringify(LOAN_TRANSACTIONS), 'storage دست‌نخورده');
  assert.ok(env.memory['hesabno:transactions'], 'نتیجه در حافظه‌ی جایگزین نوشته می‌شود (رفتار قبلی)');
  assert.equal(JSON.parse(env.memory['hesabno:transactions'])[1].documentNumber, 8);

  /* و تفاوت کلیدی با ۶.۰: نوشتن بی‌صدا (بدون استثنا) در مسیر قبلی گم می‌شد */
  const silent = createEnvironment(initial, { failWritesTo: ['hesabno:transactions'] });
  silent.run(migrations['006']);
  assert.equal(silent.memory['hesabno:transactions'], undefined,
    'بدون نگهبان، نوشتن بی‌صدا هیچ ردپایی نمی‌گذاشت (همان شکافی که ۶.۰ می‌بندد)');
});

test('the guard is wired before every protected migration in index.html', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'app/src/main/assets/index.html'), 'utf8');
  const order = [...indexHtml.matchAll(/src="src\/scripts\/([^"?]+)[^"]*"/g)].map((match) => match[1]);
  const guardIndex = order.indexOf('005b-hesabno-migration-guard.js');
  assert.ok(guardIndex > -1, 'نگهبان باید در index.html باشد');
  for (const file of [
    '006-hesabno-loan-document-number-migration.js',
    '007-hesabno-loan-received-description-migration.js',
    '059-hesabno-remove-sample-fiscal-year-v2.js',
    '065-hesabno-shortcut-category-migration.js',
    '094-hesabno-check-system-accounts.js',
  ]) {
    const position = order.indexOf(file);
    assert.ok(position > guardIndex, `${file} باید بعد از نگهبان بارگذاری شود`);
  }
});

test('every protected migration routes its writes through the guard', () => {
  for (const [id, source] of Object.entries(migrations)) {
    assert.match(source, /__hesabnoMigration\.run\(/, `مهاجرت ${id} باید از نگهبان استفاده کند`);
  }
});
