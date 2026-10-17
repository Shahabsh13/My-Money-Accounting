/*
 * آزمون سایه‌ای لایه‌ی دامنه (مرحله ۵، تصمیم R5)
 *
 * هدف: اثبات اینکه ماژول‌های خالص `src/domain/` **مو‌به‌مو** همان نتیجه‌ی هسته‌ی مینیفای‌شده
 * (067-inline.js) را می‌دهند، بدون اینکه یک بایت از باندل اصلی تغییر کند.
 *
 * روش: برای هر سناریو (ثابت + تصادفی با دانه‌ی مشخص)، هم تابع هسته و هم ماژول دامنه اجرا
 * می‌شوند و خروجی‌ها با deepStrictEqual مقایسه می‌شوند:
 *   Nr  ↔ accountBalance      برای همه‌ی حساب‌ها (balance/initialBalance/debits/credits/count)
 *   Cs  ↔ splitTransaction    برای همه‌ی اسناد (income/expense/fee)
 *   gk  ↔ summarizeReports    برای کل مجموعه (شامل طلب/بدهی/اقساط/ارزش خالص)
 *   te,St,uk,F0,Kr,mg,Ot,lr ↔ numbers.js
 *
 * سناریوی تصادفی شامل همه‌ی شاخه‌هاست: سند عادی/ترکیبی/اصلاحی، چک با همه‌ی وضعیت‌ها، کارمزد،
 * انتقال، حساب‌های بانک/نقد/دارایی/شخص/درآمد/هزینه/بدهی/سرمایه، و حساب‌های «اسناد دریافتنی/پرداختنی».
 *
 * تفاوت عمدی و مستند: `addMonths(null)` در دامنه رشته‌ی خالی می‌دهد (تابع خالص)، ولی `lr(null)`
 * تاریخ امروز را می‌دهد؛ آزمون فقط تاریخ‌های واقعی را مقایسه می‌کند.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { bundle, loadAccountingKernel } = require('./helpers/production-slices.cjs');
const domainAccounts = require('../app/src/main/assets/src/domain/accounts.js');
const domainReports = require('../app/src/main/assets/src/domain/reports.js');
const domainNumbers = require('../app/src/main/assets/src/domain/numbers.js');
const reportService = require('../app/src/main/assets/src/application/report-service.js');

const kernel = loadAccountingKernel();

/* ---------- ابزارهای عددی هسته ---------- */
const NUMBER_START = 'te=t=>';
const NUMBER_END = 'Ma=(t,s)=>{';
const numberSource = (() => {
  const start = bundle.indexOf(NUMBER_START);
  const end = bundle.indexOf(NUMBER_END, start);
  assert.ok(start !== -1 && end > start, 'بخش عددی هسته باید در باندل باشد');
  return bundle.slice(start, end).replace(/,\s*$/, '');
})();

/* اشیای هسته داخل vm ساخته می‌شوند و prototypeشان با realm آزمون یکی نیست؛
   برای مقایسه‌ی ساختاری، هر دو طرف را به داده‌ی ساده تبدیل می‌کنیم. */
function plain(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }

function loadCoreNumbers(settings = {}) {
  const storage = new Map();
  if (settings.numFormat !== undefined) storage.set('hesabno:numFormat', settings.numFormat);
  if (settings.currency !== undefined) storage.set('hesabno:currency', settings.currency);
  const context = {
    console: { error: () => {}, warn: () => {} },
    __safeGet: (key) => (storage.has(key) ? storage.get(key) : null),
    __safeSet: (key, value) => { storage.set(key, String(value)); return true; },
    Intl, Date,
  };
  return vm.runInNewContext(`${numberSource};\n({ te, St, uk, F0, Kr, mg, Ot, lr });`, context, { timeout: 5000 });
}

/* ---------- تولید داده‌ی تصادفی با دانه‌ی مشخص ---------- */
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, list) { return list[Math.floor(rng() * list.length)]; }

function buildScenario(seed) {
  const rng = random(seed);
  const groups = ['bank', 'cash', 'asset', 'person', 'income', 'expense', 'liability', 'equity'];
  const names = [
    'بانک ملی', 'بانک صادرات', 'صندوق نقدی', 'اسناد دریافتنی', 'اسناد پرداختنی', 'چک ها و اسناد پرداختنی',
    'درآمد حقوق', 'درآمد پروژه', 'هزینه اجاره', 'هزینه کارمزد و بهره', 'کارمزد انتقال و خدمات بانکی',
    'علی رضایی', 'مریم احمدی', 'سرمایه اولیه', 'دارایی خودرو',
  ];
  const accounts = [];
  let id = 1;
  for (const name of names) {
    accounts.push({
      id: `acc-${id++}`,
      name,
      group: pick(rng, groups),
      active: rng() > 0.15,
      parentId: accounts.length && rng() > 0.6 ? accounts[Math.floor(rng() * accounts.length)].id : null,
      initialBalance: rng() > 0.6 ? Math.round(rng() * 5000000) : 0,
    });
  }
  /* گروه‌های ثابت برای حساب‌های ویژه تا شاخه‌های خاص پوشش داده شوند */
  const byName = Object.fromEntries(accounts.map((account) => [account.name, account]));
  byName['اسناد دریافتنی'].group = 'asset';
  byName['اسناد پرداختنی'].group = 'liability';
  byName['هزینه کارمزد و بهره'].group = 'expense';

  const accountNames = accounts.map((account) => account.name);
  const transactions = [];
  const statuses = ['', 'cleared', 'bounced', 'in_progress', 'received', 'issued', 'in_bank', 'returned', 'refunded'];
  for (let index = 0; index < 40; index += 1) {
    const type = pick(rng, ['income', 'expense', 'transfer']);
    const amount = Math.round(rng() * 900000) + 1;
    const hasCheck = rng() > 0.55;
    const base = {
      id: `tx-${index + 1}`,
      type,
      amount: rng() > 0.9 ? String(amount) : amount,
      account: pick(rng, accountNames),
      category: pick(rng, accountNames),
      destinationAccount: pick(rng, accountNames),
      isReversal: rng() > 0.85,
      method: rng() > 0.5 ? 'check' : 'cash',
      check: hasCheck ? {
        status: pick(rng, statuses),
        linkedBank: rng() > 0.5 ? pick(rng, ['بانک ملی', 'بانک صادرات']) : '',
        debtCanceled: rng() > 0.9,
      } : undefined,
      feeAmount: rng() > 0.7 ? Math.round(rng() * 20000) : 0,
      feeAccount: rng() > 0.5 ? pick(rng, accountNames) : undefined,
    };
    if (rng() > 0.85) {
      const sourceAccount = pick(rng, accountNames);
      const destinationAccount = pick(rng, accountNames);
      transactions.push({
        ...base,
        isCompound: true,
        compoundSources: [{ account: sourceAccount, amount }],
        compoundDestinations: [{ account: destinationAccount, amount: Math.max(1, amount - 1000) }],
      });
    } else {
      transactions.push(base);
    }
  }

  const installments = [];
  for (let index = 0; index < 8; index += 1) {
    installments.push({ id: `inst-${index}`, amount: Math.round(rng() * 300000), status: pick(rng, ['pending', 'overdue', 'paid', 'canceled']) });
  }

  return { accounts, transactions, installments };
}

/* ---------- سناریوهای ثابت (اعداد قفل‌شده‌ی مرحله ۲) ---------- */
const FIXED_SCENARIOS = [
  {
    name: 'بانک: افتتاحیه + درآمد + هزینه + انتقال',
    accounts: [
      { id: 'a1', name: 'بانک ملی', group: 'bank', active: true, initialBalance: 1000000 },
      { id: 'a2', name: 'صندوق', group: 'cash', active: true, initialBalance: 0 },
      { id: 'a3', name: 'درآمد حقوق', group: 'income', active: true },
      { id: 'a4', name: 'هزینه اجاره', group: 'expense', active: true },
    ],
    transactions: [
      { id: 't1', type: 'income', amount: 5000000, account: 'بانک ملی', category: 'درآمد حقوق' },
      { id: 't2', type: 'expense', amount: 1200000, account: 'بانک ملی', category: 'هزینه اجاره' },
      { id: 't3', type: 'transfer', amount: 300000, account: 'بانک ملی', destinationAccount: 'صندوق' },
    ],
    installments: [],
  },
  {
    name: 'ترکیبی + کارمزد + اصلاحی',
    accounts: [
      { id: 'b1', name: 'بانک صادرات', group: 'bank', active: true, initialBalance: 200000 },
      { id: 'b2', name: 'درآمد پروژه', group: 'income', active: true },
      { id: 'b3', name: 'هزینه کارمزد و بهره', group: 'expense', active: true },
    ],
    transactions: [
      {
        id: 'c1', type: 'income', amount: 900000, isCompound: true,
        compoundSources: [{ account: 'بانک صادرات', amount: 900000 }],
        compoundDestinations: [{ account: 'درآمد پروژه', amount: 900000 }],
      },
      { id: 'c2', type: 'expense', amount: 100000, account: 'بانک صادرات', category: 'هزینه اجاره', feeAmount: 5000, feeAccount: 'هزینه کارمزد و بهره' },
      { id: 'c3', type: 'income', amount: 400000, account: 'بانک صادرات', category: 'درآمد پروژه', isReversal: true },
    ],
    installments: [],
  },
  {
    name: 'چک: در جریان، برگشتی، تسویه‌شده',
    accounts: [
      { id: 'd1', name: 'بانک ملی', group: 'bank', active: true },
      { id: 'd2', name: 'چک ها و اسناد پرداختنی', group: 'liability', active: true },
      { id: 'd3', name: 'علی رضایی', group: 'person', active: true },
    ],
    transactions: [
      { id: 'e1', type: 'income', amount: 700000, account: 'بانک ملی', category: 'علی رضایی', method: 'check', check: { status: 'in_progress' } },
      { id: 'e2', type: 'expense', amount: 200000, account: 'بانک ملی', category: 'علی رضایی', method: 'check', check: { status: 'bounced', debtCanceled: true } },
      { id: 'e3', type: 'expense', amount: 150000, account: 'بانک ملی', category: 'علی رضایی', method: 'check', check: { status: 'cleared' } },
    ],
    installments: [{ id: 'i1', amount: 90000, status: 'pending' }, { id: 'i2', amount: 50000, status: 'paid' }],
  },
];

test('fixed scenarios: domain matches the core kernel exactly', () => {
  for (const scenario of FIXED_SCENARIOS) {
    for (const account of scenario.accounts) {
      assert.deepStrictEqual(
        plain(domainAccounts.accountBalance(account, scenario.accounts, scenario.transactions)),
        plain(kernel.accountBalance(account, scenario.accounts, scenario.transactions)),
        `${scenario.name} / حساب ${account.name}`,
      );
    }
    for (const transaction of scenario.transactions) {
      assert.deepStrictEqual(
        plain(domainReports.splitTransaction(transaction, scenario.accounts)),
        plain(kernel.reportTotals(transaction, scenario.accounts)),
        `${scenario.name} / سند ${transaction.id}`,
      );
    }
    assert.deepStrictEqual(
      plain(domainReports.summarizeReports(scenario.transactions, scenario.accounts, [], scenario.installments)),
      plain(kernel.reportSummary(scenario.transactions, scenario.accounts, [], scenario.installments)),
      `${scenario.name} / خلاصه`,
    );
  }
});

test('randomized scenarios: every account, transaction and summary matches', () => {
  /* اطمینان از اینکه داده‌ی تصادفی واقعاً شاخه‌ها را پوشش می‌دهد، نه اینکه همه‌چیز صفر باشد */
  const coverage = { compound: 0, reversal: 0, fee: 0, canceled: 0, checkStatuses: new Set(), withCheck: 0 };
  for (let seed = 1; seed <= 25; seed += 1) {
    const { accounts, transactions, installments } = buildScenario(seed);
    coverage.compound += transactions.filter((item) => item.isCompound).length;
    coverage.reversal += transactions.filter((item) => item.isReversal).length;
    coverage.fee += transactions.filter((item) => item.feeAmount > 0).length;
    coverage.withCheck += transactions.filter((item) => !!item.check).length;
    coverage.canceled += transactions.filter((item) => item.check && ['bounced', 'returned', 'refunded', 'dishonored', 'returned_check'].includes(item.check.status)).length;
    transactions.filter((item) => item.check).forEach((item) => coverage.checkStatuses.add(item.check.status));

    for (const account of accounts) {
      assert.deepStrictEqual(
        plain(domainAccounts.accountBalance(account, accounts, transactions)),
        plain(kernel.accountBalance(account, accounts, transactions)),
        `seed ${seed} / حساب ${account.name}`,
      );
    }
    for (const transaction of transactions) {
      assert.deepStrictEqual(
        plain(domainReports.splitTransaction(transaction, accounts)),
        plain(kernel.reportTotals(transaction, accounts)),
        `seed ${seed} / سند ${transaction.id}`,
      );
    }
    assert.deepStrictEqual(
      plain(domainReports.summarizeReports(transactions, accounts, [], installments)),
      plain(kernel.reportSummary(transactions, accounts, [], installments)),
      `seed ${seed} / خلاصه`,
    );
  }
  assert.ok(coverage.compound > 10, `سند ترکیبی کافی: ${coverage.compound}`);
  assert.ok(coverage.reversal > 10, `سند اصلاحی کافی: ${coverage.reversal}`);
  assert.ok(coverage.fee > 20, `سند با کارمزد کافی: ${coverage.fee}`);
  assert.ok(coverage.withCheck > 30, `سند با چک کافی: ${coverage.withCheck}`);
  assert.ok(coverage.canceled > 3, `چک برگشتی/مسترد کافی: ${coverage.canceled}`);
  assert.ok(coverage.checkStatuses.size >= 5, `تنوع وضعیت چک: ${[...coverage.checkStatuses].join(',')}`);
});

test('account tree helpers match the core (lookup, group, person, descendant)', () => {
  const { accounts } = buildScenario(7);
  for (const account of accounts) {
    assert.deepStrictEqual(
      plain(domainAccounts.findAccountByName(account.name, accounts)),
      plain(kernel.accountLookup(account.name, accounts)),
      `جست‌وجوی ${account.name}`,
    );
    assert.equal(domainAccounts.accountGroup(account.name, accounts), kernel.accountGroup(account.name, accounts));
    assert.equal(domainAccounts.isPersonAccount(account.name, accounts), kernel.isPersonAccount(account.name, accounts));
    for (const other of accounts) {
      assert.equal(
        domainAccounts.isDescendantAccount(account.name, other.name, accounts),
        kernel.isDescendantAccount(account.name, other.name, accounts),
        `فرزندبودن ${account.name} زیر ${other.name}`,
      );
    }
  }
  assert.equal(domainAccounts.findAccountByName('حساب ناموجود', accounts), undefined);
});

test('numbers module matches te/St/uk/F0/Kr/mg/Ot for all formats', () => {
  for (const numFormat of [undefined, 'standard', 'slash', 'space', 'unknown']) {
    const core = loadCoreNumbers({ numFormat });
    const separator = domainNumbers.separatorFor(numFormat);
    assert.equal(separator, core.uk(), `جداکننده برای ${numFormat}`);

    for (const value of [0, 1, 999, 1000, 1234567, -1234567, 1.5, -1.5, 0.49, 999.99, null, undefined, NaN, '', '1234']) {
      assert.equal(domainNumbers.formatAmount(value, numFormat), core.F0(value), `F0(${String(value)}) با ${numFormat}`);
      assert.equal(domainNumbers.formatMoney(value, 'toman', numFormat), core.mg(value, 'toman'), `mg(${String(value)})`);
      assert.equal(domainNumbers.formatMoney(value, 'rial', numFormat), core.mg(value, 'rial'), `mg ریال`);
    }

    for (const input of ['0123456789', '1405/06/10', '-12،3', null, undefined, 0, '۱۲۳۴', '1٬234', '1,234', 1234.5]) {
      assert.equal(domainNumbers.toPersianDigits(input), core.te(input), `te(${String(input)})`);
      assert.equal(domainNumbers.normalizeDigits(input), core.St(input), `St(${String(input)})`);
    }

    for (const input of ['', null, undefined, '1234', '۱۲۳۴۵۶', '-5', '−5', '1,234,567', '-', 'هیچ', '00012']) {
      assert.equal(domainNumbers.parseAmountInput(input, numFormat), core.Ot(input), `Ot(${String(input)})`);
    }
  }
});

test('currency label matches Kr for both currencies', () => {
  const coreToman = loadCoreNumbers({ currency: 'toman' });
  const coreRial = loadCoreNumbers({ currency: 'rial' });
  assert.equal(domainNumbers.currencyLabel('toman'), coreToman.Kr('toman'));
  assert.equal(domainNumbers.currencyLabel('rial'), coreRial.Kr('rial'));
  /* وقتی ارز صریح داده نشود، پیش‌فرض دامنه «تومان» است؛ هسته هم بدون تنظیم، تومان می‌دهد */
  assert.equal(domainNumbers.currencyLabel(''), coreToman.Kr(undefined));
  assert.equal(domainNumbers.currencyLabel(undefined), coreToman.Kr(undefined));
  /* مقدار صریح بر تنظیمات ذخیره‌شده اولویت دارد (هم در دامنه، هم در Kr) */
  assert.equal(domainNumbers.currencyLabel('toman'), coreRial.Kr('toman'));
  assert.equal(domainNumbers.currencyLabel('rial'), coreToman.Kr('rial'));
});

test('jalali month arithmetic matches lr across 24 months of edge days', () => {
  const core = loadCoreNumbers();
  const years = [1403, 1404, 1405];
  const months = [1, 2, 6, 7, 11, 12];
  const days = [1, 15, 29, 30, 31];
  for (const year of years) {
    for (const month of months) {
      for (const day of days) {
        const date = `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
        for (const delta of [-13, -12, -6, -1, 0, 1, 6, 12, 13]) {
          assert.equal(
            domainNumbers.addMonths(date, delta),
            core.lr(date, delta),
            `lr(${date}, ${delta})`,
          );
        }
      }
    }
  }
  for (const invalid of ['1405', 'نامعتبر', '1405/06', 'abc/def/ghi']) {
    assert.equal(domainNumbers.addMonths(invalid, 1), core.lr(invalid, 1), `lr نامعتبر ${invalid}`);
  }
});

test('application report service builds the same totals the core would produce', () => {
  const { accounts, transactions, installments } = buildScenario(11);
  const snapshot = reportService.buildReportSnapshot({
    accounts, transactions, installments, settings: { currency: 'rial', numberFormat: 'standard' },
  });
  const coreSummary = kernel.reportSummary(transactions, accounts, [], installments);
  const core = loadCoreNumbers({ currency: 'rial', numFormat: 'standard' });

  assert.deepStrictEqual(plain(snapshot.summary), plain(coreSummary));
  assert.equal(snapshot.totals.netWorthText, core.mg(coreSummary.totalNetWorth));
  assert.equal(snapshot.totals.incomeText, core.mg(coreSummary.totalIncome));
  assert.equal(snapshot.totals.expenseText, core.mg(coreSummary.totalExpense));
  assert.equal(snapshot.totals.netSavingsText, core.mg(coreSummary.netSavings));
  assert.equal(snapshot.totals.liquidText, core.mg(coreSummary.totalLiquidAssets));
  assert.equal(snapshot.totals.receivablesText, core.mg(coreSummary.totalReceivables));
  assert.equal(snapshot.totals.payablesText, core.mg(coreSummary.totalPayables));
  assert.equal(snapshot.totals.installmentsText, core.mg(coreSummary.totalRemainingInstallments));

  for (const row of snapshot.accountRows) {
    const coreBalance = kernel.accountBalance(row, accounts, transactions);
    assert.equal(row.balance, coreBalance.balance, `مانده‌ی ردیف ${row.name}`);
    assert.equal(row.balanceText, core.mg(coreBalance.balance));
  }
  for (const row of snapshot.personRows) {
    assert.equal(row.balance, snapshot.summary.personBalances[row.name].balance);
    assert.equal(row.balanceText, core.mg(Math.abs(row.balance)));
  }
});

test('the domain layer is pure: no DOM, no storage, no global state', () => {
  const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const file of ['numbers.js', 'accounts.js', 'reports.js']) {
    const source = stripComments(fs.readFileSync(path.join(__dirname, '..', 'app/src/main/assets/src/domain', file), 'utf8'));
    for (const forbidden of ['document.', 'window.', 'localStorage', 'sessionStorage', 'fetch(', 'XMLHttpRequest']) {
      assert.equal(source.includes(forbidden), false, `${file} نباید به ${forbidden} وابسته باشد`);
    }
  }
  const service = stripComments(fs.readFileSync(path.join(__dirname, '..', 'app/src/main/assets/src/application/report-service.js'), 'utf8'));
  for (const forbidden of ['document.', 'window.', 'localStorage', 'sessionStorage']) {
    assert.equal(service.includes(forbidden), false, `report-service نباید به ${forbidden} وابسته باشد`);
  }
});

test('the domain layer is not loaded by index.html yet (zero boot cost)', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'app/src/main/assets/index.html'), 'utf8');
  assert.equal(/src\/domain\//.test(indexHtml), false, 'تا مرحله ۷ هیچ فایل دامنه‌ای در index.html بارگذاری نمی‌شود');
});

test('account tree caching mirrors the core (same array, same object identity semantics)', () => {
  const { accounts } = buildScenario(3);
  const first = domainAccounts.buildAccountTree(accounts);
  const second = domainAccounts.buildAccountTree(accounts);
  assert.equal(first, second, 'درخت برای همان آرایه کش می‌شود (مثل sN در هسته)');
  assert.equal(kernel.accountTree(accounts), kernel.accountTree(accounts));
});
