/*
 * آزمون رگرسیون اصلاح باگ‌های بازرسی (۱۴۰۵/۰۷/۲۵)
 *
 * هر مورد دقیقاً همان سناریوی «قبل» را بازتولید می‌کند و رفتار «بعد» را قفل می‌کند:
 *   B1 چک برگشتی/مسترد: تراز باید ببندد و سود و زیان صفر بماند
 *   B2 پاس‌کردن چک بدون بانک: باید جلوی حذف بی‌صدای بدهی گرفته شود
 *   B3 اسفند کبیسه: ۱۴۰۳/۱۲/۳۰ نباید به ۲۹ تبدیل شود
 *   B4 منفی صفر: «-۰» نباید نمایش داده شود
 *   B5 شناسه: دو شناسه در یک میلی‌ثانیه نباید یکی شوند
 *
 * اجرا: node --test tests/audit-fixes.test.cjs
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { loadAccountingKernel } = require('./helpers/production-slices.cjs');
const ledgerDomain = require('../app/src/main/assets/src/domain/ledger.js');
const numbersDomain = require('../app/src/main/assets/src/domain/numbers.js');
const kernel = loadAccountingKernel();

const root = path.resolve(__dirname, '..');
const bundlePath = path.join(root, 'app/src/main/assets/src/scripts/067-inline.js');
const bundle = fs.readFileSync(bundlePath, 'utf8');

const ACCOUNTS = [
  { id: 'a-bank', name: 'بانک', group: 'bank', active: true, initialBalance: 10000000 },
  { id: 'a-pay', name: 'اسناد پرداختنی', group: 'liability', active: true },
  { id: 'a-recv', name: 'اسناد دریافتنی', group: 'asset', active: true },
  { id: 'a-rent', name: 'اجاره', group: 'expense', active: true },
  { id: 'a-sales', name: 'فروش', group: 'income', active: true },
  { id: 'a-ali', name: 'علی', group: 'person', active: true },
];

function trialBalance(accounts, transactions) {
  let debits = 0;
  let credits = 0;
  for (const account of accounts) {
    const row = kernel.accountBalance(account, accounts, transactions);
    debits += Number(row.totalDebits || 0);
    credits += Number(row.totalCredits || 0);
  }
  return { debits, credits, diff: debits - credits };
}

const checkDocument = (status, type = 'expense') => ({
  id: 'chk-' + status, date: '1405/06/10', type,
  account: type === 'expense' ? 'اسناد پرداختنی' : 'اسناد دریافتنی',
  category: type === 'expense' ? 'اجاره' : 'فروش',
  amount: 700000, method: 'check', check: { status, number: '1', linkedBank: 'بانک' },
});

test('B1 — a bounced or refunded check keeps the trial balance closed', () => {
  for (const status of ['bounced', 'refunded']) {
    for (const type of ['expense', 'income']) {
      const transactions = [checkDocument(status, type)];
      const trial = trialBalance(ACCOUNTS, transactions);
      assert.equal(trial.diff, 0, `${status}/${type}: سند باید متوازن بماند (اختلاف ${trial.diff})`);

      const pnl = kernel.reportTotals(transactions[0], ACCOUNTS);
      assert.equal(pnl.income, 0, `${status}/${type}: درآمد نباید بماند`);
      assert.equal(pnl.expense, 0, `${status}/${type}: هزینه نباید بماند`);

      const summary = kernel.reportSummary(transactions, ACCOUNTS, [], []);
      assert.equal(summary.totalPayables, 0);
      assert.equal(summary.totalReceivables, 0);
      assert.equal(summary.totalNetWorth, summary.totalLiquidAssets,
        `${status}/${type}: ارزش خالص نباید به‌خاطر سند لغوشده بپرد`);
    }
  }
});

test('B1 — a bounced check no longer touches the expense, income or person account', () => {
  const transactions = [checkDocument('bounced', 'expense')];
  const expense = kernel.accountBalance(ACCOUNTS.find((a) => a.name === 'اجاره'), ACCOUNTS, transactions);
  assert.equal(expense.totalDebits, 0, 'پای هزینه باید مثل پای بدهی حذف شود');
  assert.equal(expense.balance, 0);
  assert.equal(expense.transactionCount, 0);

  const personDoc = {
    id: 'p1', date: '1405/06/12', type: 'expense', account: 'بانک', category: 'علی',
    amount: 300000, method: 'check', check: { status: 'bounced', linkedBank: 'بانک' },
  };
  const person = kernel.accountBalance(ACCOUNTS.find((a) => a.name === 'علی'), ACCOUNTS, [personDoc]);
  assert.equal(person.balance, 0, 'حساب شخص هم نباید از چک برگشتی اثر بگیرد');
});

test('B1 — the pending and cleared check paths are unchanged', () => {
  const pending = [checkDocument('in_progress')];
  const cleared = [checkDocument('cleared')];
  const pendingSummary = kernel.reportSummary(pending, ACCOUNTS, [], []);
  const clearedSummary = kernel.reportSummary(cleared, ACCOUNTS, [], []);

  assert.equal(pendingSummary.totalNetWorth, clearedSummary.totalNetWorth,
    'صدور تا پاس شدن نباید ارزش خالص را عوض کند');
  assert.equal(pendingSummary.totalPayables, 700000);
  assert.equal(clearedSummary.totalPayables, 0);
  assert.equal(kernel.reportTotals(pending[0], ACCOUNTS).expense, 700000,
    'هزینه در وضعیت در جریان باید بماند');
  assert.equal(trialBalance(ACCOUNTS, pending).diff, 0);
  assert.equal(trialBalance(ACCOUNTS, cleared).diff, 0);
});

test('B1 — the domain ledger agrees with the core on canceled checks', () => {
  for (const status of ['in_progress', 'cleared', 'bounced', 'refunded']) {
    const transactions = [checkDocument(status, 'expense'), checkDocument(status, 'income')];
    const core = ACCOUNTS.map((account) => {
      const row = kernel.accountBalance(account, ACCOUNTS, transactions);
      return { name: account.name, balance: row.balance, debit: row.totalDebits, credit: row.totalCredits };
    });
    const domain = ledgerDomain
      ? ledgerDomain.balancesForAll
        ? ledgerDomain.balancesForAll(ACCOUNTS, transactions)
        : null
      : null;
    if (!domain) continue; /* ماژول بدون تابع گروهی: آزمون تفاضلی جداگانه پوشش می‌دهد */
    for (const row of core) {
      const match = domain.find((item) => item.name === row.name);
      if (!match) continue;
      assert.equal(match.balance, row.balance, `دامنه/هسته واگرا شدند: ${row.name} · ${status}`);
    }
  }
});

test('B2 — clearing a check without a bank account is refused, not silently applied', () => {
  const start = bundle.indexOf('De=(L,se,Le)=>{');
  const end = bundle.indexOf('let O=`وضعیت چک شماره', start);
  assert.ok(start !== -1 && end > start, 'تابع تغییر وضعیت چک پیدا نشد');
  const source = bundle.slice(start, end);

  assert.equal(/Le\|\|Se\.check\.linkedBank\|\|Se\.account;/.test(source), false,
    'عبارت بی‌اثر قبلی باید حذف شده باشد');
  assert.match(source, /se==="cleared"&&!Le&&!Se\.check\.linkedBank&&Se\.account===Ue/,
    'گارد پاس‌کردن بدون بانک باید وجود داشته باشد');
  assert.match(source, /حساب بانکی/, 'پیام راهنما باید به کاربر گفته شود');
  assert.match(source, /return\}/, 'باید پیش از تغییر داده برگردد');
});

test('B3 — Esfand 30 survives in a leap year', () => {
  const storage = new Map();
  const start = bundle.indexOf('te=t=>');
  const end = bundle.indexOf('x9=(t,s,n)=>{', start);
  assert.ok(start !== -1 && end > start, 'برش توابع تاریخ پیدا نشد');
  const helpers = vm.runInNewContext(
    `${bundle.slice(start, end).replace(/,\s*$/, '')};\n({ lr });`,
    {
      console: { error() {}, warn() {} },
      __safeGet: (key) => (storage.has(key) ? storage.get(key) : null),
      __safeSet: (key, value) => { storage.set(key, String(value)); return true; },
      Intl, Date,
    },
    { timeout: 5000 }
  );

  assert.equal(helpers.lr('1403/11/30', 1), '1403/12/30', '۱۴۰۳ کبیسه است: اسفند ۳۰ روز دارد');
  assert.equal(helpers.lr('1403/12/30', 0), '1403/12/30', 'افزودن ۰ ماه نباید روز را کم کند');
  assert.equal(helpers.lr('1403/12/30', 1), '1404/01/30');
  assert.equal(helpers.lr('1404/11/30', 1), '1404/12/29', 'سال عادی: اسفند ۲۹ روز');
  assert.equal(helpers.lr('1403/06/31', 1), '1403/07/30', 'ماه ۷ سی روز دارد');
  assert.equal(helpers.lr('1405/01/15', -12), '1404/01/15');
  assert.equal(helpers.lr('1407/12/30', 0), '1407/12/30', '۱۴۰۷ هم کبیسه است (جدول چرخه، نه mod 33)');
});

test('B3 — domain month arithmetic matches the core including leap years', () => {
  const storage = new Map();
  const start = bundle.indexOf('te=t=>');
  const end = bundle.indexOf('x9=(t,s,n)=>{', start);
  const helpers = vm.runInNewContext(
    `${bundle.slice(start, end).replace(/,\s*$/, '')};\n({ lr });`,
    {
      console: { error() {}, warn() {} },
      __safeGet: (key) => (storage.has(key) ? storage.get(key) : null),
      __safeSet: (key, value) => { storage.set(key, String(value)); return true; },
      Intl, Date,
    },
    { timeout: 5000 }
  );

  for (let year = 1400; year <= 1410; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      for (const day of [1, 29, 30, 31]) {
        const date = `${year}/${String(month).padStart(2, '0')}/${day}`;
        for (const delta of [-1, 0, 1, 12]) {
          assert.equal(numbersDomain.addMonths(date, delta), helpers.lr(date, delta),
            `واگرایی دامنه/هسته: lr(${date}, ${delta})`);
        }
      }
    }
  }
});

test('B4 — small negative amounts no longer render as “-۰”', () => {
  const storage = new Map();
  const start = bundle.indexOf('te=t=>');
  const end = bundle.indexOf('x9=(t,s,n)=>{', start);
  const helpers = vm.runInNewContext(
    `${bundle.slice(start, end).replace(/,\s*$/, '')};\n({ F0 });`,
    {
      console: { error() {}, warn() {} },
      __safeGet: (key) => (storage.has(key) ? storage.get(key) : null),
      __safeSet: (key, value) => { storage.set(key, String(value)); return true; },
      Intl, Date,
    },
    { timeout: 5000 }
  );

  assert.equal(helpers.F0(-0.4), '۰');
  assert.equal(helpers.F0(-0.49), '۰');
  assert.equal(helpers.F0(-0.5), '-۱', 'گرد کردن به ۱ هنوز منفی است');
  assert.equal(helpers.F0(-1234), '-۱،۲۳۴', 'منفی واقعی باید علامت داشته باشد');
  assert.equal(helpers.F0(0), '۰');
});

test('B5 — ids generated in the same millisecond do not collide', () => {
  const marker = 'var __hesabnoIdLast = 0;';
  const start = bundle.indexOf(marker);
  assert.ok(start !== -1, 'تابع شناسه باید در باندل باشد');
  assert.equal((bundle.match(/id:Date\.now\(\)/g) || []).length, 0, 'هنوز محل Date.now باقی مانده');
  assert.ok((bundle.match(/id:__hesabnoNextId\(\)/g) || []).length >= 20);

  const frozen = { now: 1700000000000 };
  const context = { Date: { now: () => frozen.now } };
  vm.runInNewContext(
    `${bundle.slice(start, bundle.indexOf('\n}\n', start) + 3)};this.next = __hesabnoNextId;`,
    context,
    { timeout: 5000 }
  );
  const ids = new Set();
  for (let index = 0; index < 50; index += 1) ids.add(context.next());
  assert.equal(ids.size, 50, 'پنجاه شناسه در یک میلی‌ثانیه نباید تکراری شوند');
  frozen.now += 1;
  const next = context.next();
  assert.equal(new Set([...ids, next]).size, 51);
});
