/*
 * آزمون تفاضلی موتور تک‌گذر (مرحله ۷.۱)
 *
 * چه چیزی را قفل می‌کند: خروجی `ledger.balancesForAll` برای **هر حساب** باید مو‌به‌مو با
 * `accountBalance` (نسخه‌ی خالص دامنه) و همچنین تابع واقعی تولید `Nr` از باندل ۰۶۷ یکی باشد.
 *
 * چرا تفاضلی و تصادفی؟ چون قواعد مانده‌ی حساب پر از حالت‌های خاص است (چک برگشتی، سند مرکب،
 * کارمزد، حساب دریافتنی/پرداختنی، والد و فرزند، نام تکراری). فهرست دستی همه‌ی ترکیب‌ها را
 * پوشش نمی‌دهد؛ PRNG با دانه‌ی ثابت هم تکرارپذیر است و هم گسترده.
 *
 * اصل «هیچ عددی عوض نشود»: اگر یک روز موتور با هسته واگرا شود، این آزمون می‌شکند — پیش از آنکه
 * کسی به فکر اتصال موتور به UI بیفتد.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const ledger = require('../app/src/main/assets/src/domain/ledger.js');
const accountsDomain = require('../app/src/main/assets/src/domain/accounts.js');
const { loadAccountingKernel } = require('./helpers/production-slices.cjs');
const { makeAccounts, makeTransactions, expandAccounts } = require('./helpers/reporting-corpus.cjs');

const FIELDS = ['balance', 'initialBalance', 'totalDebits', 'totalCredits', 'transactionCount', 'entriesCount'];

function rowOf(row) {
  return {
    balance: row.balance,
    initialBalance: row.initialBalance,
    totalDebits: row.totalDebits,
    totalCredits: row.totalCredits,
    transactionCount: row.transactionCount,
    entriesCount: row.entriesCount,
  };
}

test('single-pass balances equal accountBalance on every account (8 corpora)', () => {
  const accounts = makeAccounts();
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const transactions = makeTransactions(400, seed);
    const rows = ledger.balancesForAll(accounts, transactions);
    assert.equal(rows.length, accounts.length, 'یک ردیف برای هر حساب');
    for (let index = 0; index < accounts.length; index += 1) {
      const expected = accountsDomain.accountBalance(accounts[index], accounts, transactions);
      const actual = rows[index];
      assert.equal(actual.id, accounts[index].id, 'ترتیب حساب‌ها باید حفظ شود');
      for (const field of FIELDS) {
        assert.equal(actual[field], expected[field],
          `دانه ${seed} · حساب «${accounts[index].name || accounts[index].id}» · ${field}`);
      }
    }
  }
});

test('single-pass balances equal the real production Nr from bundle 067', () => {
  const kernel = loadAccountingKernel();
  const accounts = makeAccounts();
  for (const seed of [11, 12]) {
    const transactions = makeTransactions(300, seed);
    const rows = ledger.balancesForAll(accounts, transactions);
    for (let index = 0; index < accounts.length; index += 1) {
      const expected = kernel.accountBalance(accounts[index], accounts, transactions);
      for (const field of FIELDS) {
        assert.equal(rows[index][field], expected[field],
          `هسته · دانه ${seed} · «${accounts[index].name || accounts[index].id}» · ${field}`);
      }
    }
  }
});

test('single-pass balances stay equal on a 75-account list (name-containment quirk)', () => {
  const accounts = expandAccounts(3);
  for (const seed of [13, 14]) {
    const transactions = makeTransactions(500, seed);
    const rows = ledger.balancesForAll(accounts, transactions);
    for (let index = 0; index < accounts.length; index += 1) {
      const expected = accountsDomain.accountBalance(accounts[index], accounts, transactions);
      for (const field of FIELDS) {
        assert.equal(rows[index][field], expected[field],
          `دانه ${seed} · حساب «${accounts[index].name || accounts[index].id}» · ${field}`);
      }
    }
  }
});

test('empty and single-document inputs behave exactly like the core', () => {
  const accounts = makeAccounts();
  const emptyRows = ledger.balancesForAll(accounts, []);
  for (let index = 0; index < accounts.length; index += 1) {
    const expected = accountsDomain.accountBalance(accounts[index], accounts, []);
    assert.deepEqual(rowOf(emptyRows[index]), rowOf(expected));
  }
  const one = makeTransactions(1, 5);
  const singleRows = ledger.balancesForAll(accounts, one);
  for (let index = 0; index < accounts.length; index += 1) {
    const expected = accountsDomain.accountBalance(accounts[index], accounts, one);
    assert.deepEqual(rowOf(singleRows[index]), rowOf(expected));
  }
});

test('the engine does not mutate accounts or transactions', () => {
  const accounts = makeAccounts();
  const transactions = makeTransactions(120, 21);
  const accountsBefore = JSON.stringify(accounts);
  const transactionsBefore = JSON.stringify(transactions);
  ledger.balancesForAll(accounts, transactions);
  assert.equal(JSON.stringify(accounts), accountsBefore, 'حساب‌ها نباید تغییر کنند');
  assert.equal(JSON.stringify(transactions), transactionsBefore, 'اسناد نباید تغییر کنند');
});

test('scale guard: the one-pass engine is faster than per-account scanning at 10k', () => {
  const accounts = makeAccounts();
  const transactions = makeTransactions(10000, 31);

  const time = (callback) => {
    const started = process.hrtime.bigint();
    const value = callback();
    return { value, ms: Number(process.hrtime.bigint() - started) / 1e6 };
  };

  /* گرم‌کردن کش‌ها پیش از اندازه‌گیری */
  ledger.balancesForAll(accounts, makeTransactions(200, 30));

  const core = time(() => accounts.map((account) => accountsDomain.accountBalance(account, accounts, transactions)));
  const engine = time(() => ledger.balancesForAll(accounts, transactions));

  for (let index = 0; index < accounts.length; index += 1) {
    for (const field of FIELDS) {
      assert.equal(engine.value[index][field], core.value[index][field],
        `در مقیاس ۱۰k هم باید برابر باشد: «${accounts[index].name || accounts[index].id}» · ${field}`);
    }
  }

  /* حاشیه‌ی امن: حتی روی ماشین کند/شلوغ هم پیمایش تک‌گذر نباید کندتر باشد */
  assert.ok(engine.ms < core.ms,
    `موتور تک‌گذر (${engine.ms.toFixed(1)}ms) باید از پیمایش هر حساب (${core.ms.toFixed(1)}ms) سریع‌تر باشد`);
});
