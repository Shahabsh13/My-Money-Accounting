/*
 * آزمون موتور گزارش‌ها (مرحله ۷.۲)
 *
 * سه لایه‌ی اعتبار:
 *   ۱) برابری کامل با هسته: خلاصه‌ی گزارش باید مو‌به‌مو با gk باندل ۰۶۷ یکی باشد (چند دانه).
 *   ۲) ناوردایی‌های تجمعی: جمع ماه‌ها = جمع خلاصه؛ جمع گروه‌ها = جمع ردیف‌ها؛ جمع صورت‌حساب = مانده.
 *   ۳) برابری مسیر نمایش: خروجی موتور باید دقیقاً همان اعداد و متن‌های buildReportSnapshot باشد،
 *      تا وقتی در آینده به UI وصل شود، هیچ عدد یا قالب‌بندی عوض نشود.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const reporting = require('../app/src/main/assets/src/domain/reporting.js');
const ledger = require('../app/src/main/assets/src/domain/ledger.js');
const reportsDomain = require('../app/src/main/assets/src/domain/reports.js');
const accountsDomain = require('../app/src/main/assets/src/domain/accounts.js');
const reportService = require('../app/src/main/assets/src/application/report-service.js');
const { loadAccountingKernel } = require('./helpers/production-slices.cjs');
const { makeAccounts, makeTransactions, makeInstallments } = require('./helpers/reporting-corpus.cjs');

const ACCOUNTS = makeAccounts();
const INSTALLMENTS = makeInstallments(2);
const SEEDS = [1, 2, 3];

test('summary equals the production gk exactly (three corpora)', () => {
  const kernel = loadAccountingKernel();
  for (const seed of SEEDS) {
    const transactions = makeTransactions(300, seed);
    const report = reporting.buildReport({ accounts: ACCOUNTS, transactions, installments: INSTALLMENTS });
    const expected = kernel.reportSummary(transactions, ACCOUNTS, [], INSTALLMENTS);
    assert.deepEqual(JSON.parse(JSON.stringify(report.summary)), JSON.parse(JSON.stringify(expected)),
      `دانه ${seed}: خلاصه باید مو‌به‌مو با gk یکی باشد`);
  }
});

test('refund receipts reduce expense in the domain summary and monthly reports', () => {
  const accounts = [
    { id: 'bank', name: 'Bank', group: 'bank', active: true },
    { id: 'rent', name: 'Rent', group: 'expense', active: true },
    { id: 'refund-income', name: 'Refund receipts', group: 'income', active: true },
  ];
  const transactions = [
    { id: 'expense-1', documentNumber: 10, date: '1405/06/01', type: 'expense', account: 'Bank', category: 'Rent', amount: 100 },
    {
      id: 'refund-1', documentNumber: 11, date: '1405/06/02', type: 'income', account: 'Bank',
      category: 'Refund receipts', amount: 40, isReversal: true, isRefundReceipt: true, reversalOfDocNumber: 10,
    },
  ];

  const refundSplit = reportsDomain.splitTransaction(transactions[1], accounts, transactions);
  assert.equal(refundSplit.income, 0);
  assert.equal(refundSplit.expense, -40);
  const persistedRefund = reportsDomain.splitTransaction({ ...transactions[1], refundCategoryGroup: 'expense' }, accounts);
  assert.equal(persistedRefund.income, 0, 'گروه ثبت‌شده باید برای مسیرهای تک‌سندی هم کافی باشد');
  assert.equal(persistedRefund.expense, -40);

  const report = reporting.buildReport({ accounts, transactions, installments: [] });
  assert.equal(report.summary.totalIncome, 0);
  assert.equal(report.summary.totalExpense, 60);
  assert.equal(report.summary.netSavings, -60);
  assert.equal(report.monthly[0].income, 0);
  assert.equal(report.monthly[0].expense, 60);

  const kernel = loadAccountingKernel();
  const productionSummary = kernel.reportSummary(transactions, accounts, [], []);
  assert.deepEqual(JSON.parse(JSON.stringify(report.summary)), JSON.parse(JSON.stringify(productionSummary)));
});

test('refund classification follows the linked document when its category is not P&L', () => {
  const accounts = [
    { id: 'bank', name: 'Bank', group: 'bank', active: true },
    { id: 'person', name: 'Friend', group: 'person', active: true },
    { id: 'refund-income', name: 'Refund receipts', group: 'income', active: true },
  ];
  const transactions = [
    { id: 'expense-1', documentNumber: 20, date: '1405/06/01', type: 'expense', account: 'Bank', category: 'Friend', amount: 100 },
    {
      id: 'refund-1', documentNumber: 21, date: '1405/06/02', type: 'income', account: 'Bank',
      category: 'Refund receipts', amount: 40, isReversal: true, isRefundReceipt: true, reversalOfDocNumber: 20,
    },
  ];

  const summary = reporting.buildReport({ accounts, transactions, installments: [] }).summary;
  assert.equal(summary.totalIncome, 0);
  assert.equal(summary.totalExpense, 0, 'برگشتِ سندِ غیرهزینه‌ای نباید هزینهٔ منفی بسازد');

  const kernel = loadAccountingKernel();
  const productionSummary = kernel.reportSummary(transactions, accounts, [], []);
  assert.deepEqual(JSON.parse(JSON.stringify(summary)), JSON.parse(JSON.stringify(productionSummary)));
});

test('monthly series sums exactly to the summary (no floating drift)', () => {
  for (const seed of SEEDS) {
    const transactions = makeTransactions(500, seed);
    const report = reporting.buildReport({ accounts: ACCOUNTS, transactions, installments: INSTALLMENTS });
    const income = report.monthly.reduce((sum, bucket) => sum + bucket.income, 0);
    const expense = report.monthly.reduce((sum, bucket) => sum + bucket.expense, 0);
    const fee = report.monthly.reduce((sum, bucket) => sum + bucket.fee, 0);
    const net = report.monthly.reduce((sum, bucket) => sum + bucket.net, 0);
    assert.equal(income, report.summary.totalIncome, 'جمع درآمد ماه‌ها = درآمد کل');
    assert.equal(expense, report.summary.totalExpense, 'جمع هزینه ماه‌ها = هزینه کل');
    assert.equal(net, report.summary.netSavings, 'جمع خالص ماه‌ها = پس‌انداز خالص');
    assert.ok(report.monthly.length >= 10, 'سری باید بیش از یک ماه داشته باشد');

    /* شناسه‌ی ماه جلالی: هفت نویسه‌ی اول تاریخ */
    for (const bucket of report.monthly) {
      assert.match(bucket.month, /^1405\/\d{2}$/);
      assert.equal(bucket.net, bucket.income - bucket.expense);
      assert.equal(bucket.count > 0, true);
      assert.equal(fee, fee); /* کارمزد جداگانه تجمیع می‌شود */
    }
  }
});

test('monthly buckets match a manual split, month by month', () => {
  const transactions = makeTransactions(200, 9);
  const report = reporting.buildReport({ accounts: ACCOUNTS, transactions, installments: [] });
  const manual = new Map();
  for (const transaction of transactions) {
    const month = String(transaction.date).slice(0, 7);
    const entry = manual.get(month) || { income: 0, expense: 0, count: 0 };
    const split = reportsDomain.splitTransaction(transaction, ACCOUNTS);
    entry.income += split.income;
    entry.expense += split.expense;
    entry.count += 1;
    manual.set(month, entry);
  }
  assert.equal(report.monthly.length, manual.size);
  for (const bucket of report.monthly) {
    const expected = manual.get(bucket.month);
    assert.equal(bucket.income, expected.income, `درآمد ${bucket.month}`);
    assert.equal(bucket.expense, expected.expense, `هزینه ${bucket.month}`);
    assert.equal(bucket.count, expected.count, `تعداد سند ${bucket.month}`);
  }
});

test('group cash flow adds up to the balance rows', () => {
  const transactions = makeTransactions(400, 4);
  const report = reporting.buildReport({ accounts: ACCOUNTS, transactions, installments: [] });
  const groupBalance = report.groupCashFlow.reduce((sum, group) => sum + group.balance, 0);
  const rowBalance = report.balances.reduce((sum, row) => sum + row.balance, 0);
  const groupDebits = report.groupCashFlow.reduce((sum, group) => sum + group.totalDebits, 0);
  const rowDebits = report.balances.reduce((sum, row) => sum + row.totalDebits, 0);
  assert.equal(groupBalance, rowBalance, 'جمع مانده‌ی گروه‌ها = جمع ردیف‌ها');
  assert.equal(groupDebits, rowDebits, 'جمع بدهکار گروه‌ها = جمع ردیف‌ها');

  const groupCounts = report.groupCashFlow.reduce((sum, group) => sum + group.accounts, 0);
  assert.equal(groupCounts, ACCOUNTS.length, 'هر حساب دقیقاً در یک گروه');
});

test('statement ends exactly at the account balance', () => {
  const transactions = makeTransactions(350, 6);
  const rows = ledger.balancesForAll(ACCOUNTS, transactions);
  for (const account of ACCOUNTS.filter((item) => item.name && item.group !== "equity")) {
    const statement = reporting.statement(account.id, ACCOUNTS, transactions);
    assert.ok(statement, `صورت‌حساب برای ${account.name}`);
    const row = ledger.balanceOf(rows, account.id);
    assert.equal(statement.finalBalance, row.balance, `مانده نهایی ${account.name}`);
    assert.equal(statement.closingBalance, row.balance, `مانده پایانی بدون برش ${account.name}`);
    assert.equal(statement.totalDebits, row.totalDebits);
    assert.equal(statement.totalCredits, row.totalCredits);

    /* مانده‌ی روان: هر ردیف = ردیف قبلی + تغییر همان سند */
    let running = statement.initialBalance;
    for (const entry of statement.entries) {
      running += entry.deltaBalance;
      assert.equal(entry.balance, running, `مانده روان ${account.name}`);
    }
    assert.equal(running, row.balance, `جمع تغییرها باید مانده باشد: ${account.name}`);
    assert.equal(statement.entries.length, row.transactionCount,
      `تعداد ردیف‌های صورت‌حساب باید با شمارنده‌ی سند یکی باشد: ${account.name}`);
  }
});

test('statement range slicing keeps the accounting identity', () => {
  const transactions = makeTransactions(250, 8);
  const account = ACCOUNTS.find((item) => item.name === "بانک ملت");
  const full = reporting.statement(account.id, ACCOUNTS, transactions);
  const range = reporting.statement(account.id, ACCOUNTS, transactions, { from: "1405/04/01", to: "1405/08/30" });

  assert.ok(range.entries.length <= full.entries.length);
  assert.equal(range.entries.length > 0, true, 'بازه باید سند داشته باشد');
  for (const entry of range.entries) {
    assert.ok(String(entry.date) >= "1405/04/01" && String(entry.date) <= "1405/08/30");
  }
  const deltaSum = range.entries.reduce((sum, entry) => sum + entry.deltaBalance, 0);
  assert.equal(range.closingBalance, range.openingBalance + deltaSum,
    'مانده پایانی = مانده ابتدای بازه + تغییرهای بازه');

  /* همان اتحاد برای کل بازه: ابتدا + همه‌ی تغییرها = مانده کل */
  const allDeltas = full.entries.reduce((sum, entry) => sum + entry.deltaBalance, 0);
  assert.equal(full.initialBalance + allDeltas, full.finalBalance,
    'مانده اولیه + جمع تغییرها = مانده نهایی');
  const beforeRange = full.entries
    .filter((entry) => String(entry.date) < "1405/04/01")
    .reduce((sum, entry) => sum + entry.deltaBalance, 0);
  assert.equal(range.openingBalance, full.initialBalance + beforeRange,
    'مانده ابتدای بازه = مانده اولیه + تغییرهای پیش از بازه');
  assert.equal(range.finalBalance, full.finalBalance, 'مانده کل نباید با برش بازه عوض شود');
});

test('the engine report is numerically and textually identical to the current report path', () => {
  const settings = { currency: "rial", numberFormat: "fa" };
  for (const seed of SEEDS) {
    const input = {
      accounts: ACCOUNTS,
      transactions: makeTransactions(300, seed),
      installments: INSTALLMENTS,
      settings,
    };
    const current = reportService.buildReportSnapshot(input);
    const engine = reportService.buildEngineReport(input);
    assert.deepEqual(engine.summary, current.summary, `خلاصه، دانه ${seed}`);
    assert.deepEqual(engine.accountRows, current.accountRows, `ردیف حساب‌ها، دانه ${seed}`);
    assert.deepEqual(engine.personRows, current.personRows, `ردیف اشخاص، دانه ${seed}`);
    assert.deepEqual(engine.totals, current.totals, `متن جمع‌ها، دانه ${seed}`);
  }
});

test('the reporting engine is not loaded by index.html (zero boot cost)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'app/src/main/assets/index.html'), "utf8");
  assert.equal(/src\/domain\/|src\/application\//.test(html), false,
    'هیچ ماژول دامنه/کاربرد نباید در بوت بارگذاری شود');
});
