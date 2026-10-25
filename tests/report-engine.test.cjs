/*
 * آزمون‌های موتور گزارش‌ها (مرحله ۲)
 *
 * هدف: قفل کردن رفتار «گزارش» برنامه روی داده‌ی واقعی، آن هم با توابع واقعی تولید
 * (Nr مانده حساب، Cs تفکیک سند، gk خلاصه‌ی گزارش‌ها) که از باندل 067 برش داده می‌شوند.
 *
 * اصولی که آزمون می‌کند:
 *   • هر سند باید متوازن باشد: جمع بدهکار = جمع بستانکار (در سطح برگ‌ها).
 *   • صورت سود و زیان باید با حرکت واقعی دارایی‌ها جفت شود.
 *   • ارزش خالص = دارایی نقدی + طلب − بدهی − اقساط باقی‌مانده.
 *   • اعداد ریالی بزرگ باید بدون خطای شناور و دقیق بمانند.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAccountingKernel } = require('./helpers/production-slices.cjs');

const kernel = loadAccountingKernel();
const { accountBalance, reportTotals, reportSummary, accountTree } = kernel;

const ACCOUNTS = [
  { id: 'a-bank', name: 'بانک ملت', group: 'bank', active: true, initialBalance: 5000000 },
  { id: 'a-cash', name: 'صندوق', group: 'cash', active: true, initialBalance: 200000 },
  { id: 'a-bank-off', name: 'بانک غیرفعال', group: 'bank', active: false, initialBalance: 999999 },
  { id: 'a-ali', name: 'علی رضایی', group: 'person', active: true },
  { id: 'a-sales', name: 'فروش محصول', group: 'income', active: true },
  { id: 'a-rent', name: 'اجاره محل', group: 'expense', active: true },
  { id: 'a-fee', name: 'کارمزد بانکی', group: 'expense', active: true },
];

/** یک ماه فعالیت معمولی: درآمد، هزینه، انتقال، تسویه با اشخاص و کارمزد بانکی. */
const MONTH = [
  { id: 't1', date: '1405/06/01', type: 'income', account: 'بانک ملت', category: 'فروش محصول', amount: 12000000 },
  { id: 't2', date: '1405/06/03', type: 'expense', account: 'بانک ملت', category: 'اجاره محل', amount: 4000000 },
  { id: 't3', date: '1405/06/05', type: 'transfer', account: 'بانک ملت', destinationAccount: 'صندوق', amount: 1000000 },
  { id: 't4', date: '1405/06/07', type: 'expense', account: 'بانک ملت', category: 'علی رضایی', amount: 500000 },
  { id: 't5', date: '1405/06/09', type: 'income', account: 'صندوق', category: 'علی رضایی', amount: 200000 },
  { id: 't6', date: '1405/06/11', type: 'expense', account: 'بانک ملت', category: 'اجاره محل', amount: 100000, feeAmount: 5000, feeAccount: 'کارمزد بانکی' },
];

const LEAF_ACCOUNTS = ACCOUNTS.filter((account) => account.group !== 'asset');

function totals(transactions, accounts) {
  return transactions.reduce((sum, transaction) => {
    const row = reportTotals(transaction, accounts);
    return { income: sum.income + row.income, expense: sum.expense + row.expense, fee: sum.fee + row.fee };
  }, { income: 0, expense: 0, fee: 0 });
}

function ledgerSide(transactions, accounts) {
  let debits = 0;
  let credits = 0;
  for (const account of accounts) {
    const row = accountBalance(account, accounts, transactions);
    debits += row.totalDebits;
    credits += row.totalCredits;
  }
  return { debits, credits };
}

test('every document type produces a balanced trial balance', () => {
  const month = ledgerSide(MONTH, LEAF_ACCOUNTS);
  assert.equal(month.debits, 17805000, 'جمع بدهکار ماه');
  assert.equal(month.credits, 17805000, 'جمع بستانکار ماه');
  assert.equal(month.debits - month.credits, 0, 'تراز باید بسته باشد');

  for (const document of MONTH) {
    const single = ledgerSide([document], LEAF_ACCOUNTS);
    assert.equal(single.debits - single.credits, 0, `سند ${document.id} باید متوازن باشد`);
  }
});

test('account balances match the expected movement of the month', () => {
  const bank = accountBalance(ACCOUNTS[0], ACCOUNTS, MONTH);
  const cash = accountBalance(ACCOUNTS[1], ACCOUNTS, MONTH);
  const ali = ACCOUNTS[3];
  const aliBalance = accountBalance(ali, ACCOUNTS, MONTH);
  const rentBalance = accountBalance(ACCOUNTS[5], ACCOUNTS, MONTH);
  const feeBalance = accountBalance(ACCOUNTS[6], ACCOUNTS, MONTH);

  assert.equal(bank.balance, 11395000, 'بانک: ۵٬۰۰۰٬۰۰۰ + درآمد − هزینه‌ها − انتقال − کارمزد');
  assert.equal(cash.balance, 1400000, 'صندوق: موجودی اولیه + انتقال + دریافت از شخص');
  assert.equal(aliBalance.balance, 300000, 'شخص: پرداخت ۵۰۰٬۰۰۰ و دریافت ۲۰۰٬۰۰۰');
  assert.equal(rentBalance.balance, 4100000, 'هزینه باید مبلغ هر دو سند اجاره را جمع کند');
  assert.equal(feeBalance.balance, 5000, 'کارمزد بانکی باید در حساب هزینه‌ی کارمزد ثبت شود');
  assert.equal(bank.totalDebits, 12000000);
  assert.equal(bank.totalCredits, 5605000);
});

test('a refund receipt reverses expense classification without reducing the bank deposit', () => {
  const accounts = [
    { id: 'bank', name: 'Bank', group: 'bank', active: true },
    { id: 'rent', name: 'Rent', group: 'expense', active: true },
    { id: 'refund-income', name: 'Refund receipts', group: 'income', active: true },
  ];
  const transactions = [
    { id: 'expense-1', documentNumber: 10, type: 'expense', account: 'Bank', category: 'Rent', amount: 100 },
    {
      id: 'refund-1', documentNumber: 11, type: 'income', account: 'Bank', category: 'Refund receipts', amount: 40,
      isReversal: true, isRefundReceipt: true, reversalOfDocNumber: 10,
    },
  ];

  const refundTotals = reportTotals(transactions[1], accounts, transactions);
  assert.equal(refundTotals.income, 0, 'برگشت وجه نباید درآمد گزارش شود');
  assert.equal(refundTotals.expense, -40, 'برگشت وجه باید هزینه را کاهش دهد');

  const summary = reportSummary(transactions, accounts, [], []);
  assert.equal(summary.totalIncome, 0);
  assert.equal(summary.totalExpense, 60);
  assert.equal(summary.netSavings, -60);
  assert.equal(summary.totalLiquidAssets, -60, 'وجه برگشتی همچنان به موجودی بانک اضافه می‌شود');
});

test('profit and loss totals bridge to the real movement of assets', () => {
  const totalsOfMonth = totals(MONTH, ACCOUNTS);
  // توجه: کارمزد بانکی هم داخل «expense» شمرده می‌شود و هم در فیلد اطلاعی «fee» تکرار می‌شود؛
  // مصرف‌کننده نباید هر دو را کم کند. t6 = ۱۰۰٬۰۰۰ هزینه + ۵٬۰۰۰ کارمزد = ۱۰۵٬۰۰۰ هزینه.
  assert.deepEqual(totalsOfMonth, { income: 12000000, expense: 4105000, fee: 5000 });

  const liquid = ACCOUNTS.filter((account) => account.active && (account.group === 'bank' || account.group === 'cash'));
  const initialLiquid = liquid.reduce((sum, account) => sum + account.initialBalance, 0);
  const finalLiquid = liquid.reduce((sum, account) => sum + accountBalance(account, ACCOUNTS, MONTH).balance, 0);
  const personMovement = accountBalance(ACCOUNTS[3], ACCOUNTS, MONTH).balance;

  // حرکت واقعی دارایی‌ها + حرکت حساب‌های اشخاص = درآمد − هزینه (بدون کسر دوباره‌ی کارمزد)
  assert.equal(finalLiquid - initialLiquid + personMovement, totalsOfMonth.income - totalsOfMonth.expense);
  assert.equal(finalLiquid, 12795000);
  assert.equal(finalLiquid - initialLiquid + personMovement, 7895000);
});

test('report summary reconciles net worth, receivables, payables and installments', () => {
  const installments = [
    { id: 'i1', status: 'pending', amount: 2000000 },
    { id: 'i2', status: 'overdue', amount: 500000 },
    { id: 'i3', status: 'paid', amount: 9999999 },
  ];
  const summary = reportSummary(MONTH, ACCOUNTS, [], installments);

  assert.equal(summary.totalIncome, 12000000);
  assert.equal(summary.totalExpense, 4105000, 'هزینه شامل کارمزد بانکی است');
  assert.equal(summary.totalLiquidAssets, 12795000, 'حساب بانکی غیرفعال نباید در دارایی نقدی بیاید');
  assert.deepEqual(Object.keys(summary.liquidBalances).sort(), ['بانک ملت', 'صندوق'].sort());
  assert.equal(summary.totalReceivables, 300000, 'مانده بدهکار اشخاص طلب است');
  assert.equal(summary.totalPayables, 0);
  assert.equal(summary.totalRemainingInstallments, 2500000, 'فقط اقساط پرداخت‌نشده و معوق');
  assert.equal(summary.totalNetWorth, summary.totalLiquidAssets + summary.totalReceivables - summary.totalPayables - summary.totalRemainingInstallments);
  assert.equal(summary.totalNetWorth, 12795000 + 300000 - 2500000);

  // پس‌انداز خالص گزارش باید با حرکت واقعی دارایی‌ها و طلب‌ها بخواند (جدول تراز ⇄ صورت سود و زیان).
  const liquidMovement = summary.totalLiquidAssets - 5200000;
  assert.equal(summary.netSavings, 7895000);
  assert.equal(summary.netSavings, liquidMovement + summary.totalReceivables, 'پس‌انداز خالص = افزایش نقد + افزایش طلب');
});

test('person balances are classified as debtor, creditor or settled', () => {
  const accounts = [
    ...ACCOUNTS,
    { id: 'a-sara', name: 'سارا محمدی', group: 'person', active: true },
    { id: 'a-reza', name: 'رضا کریمی', group: 'person', active: true },
  ];
  const transactions = [
    ...MONTH,
    { id: 'p1', type: 'expense', account: 'بانک ملت', category: 'سارا محمدی', amount: 400000 },
    { id: 'p2', type: 'expense', account: 'بانک ملت', category: 'رضا کریمی', amount: 150000 },
    { id: 'p3', type: 'income', account: 'بانک ملت', category: 'رضا کریمی', amount: 150000 },
  ];
  const summary = reportSummary(transactions, accounts, [], []);

  assert.equal(summary.personBalances['علی رضایی'].status, 'debtor');
  assert.equal(summary.personBalances['علی رضایی'].balance, 300000);
  assert.equal(summary.personBalances['سارا محمدی'].status, 'debtor');
  assert.equal(summary.personBalances['سارا محمدی'].balance, 400000);
  assert.equal(summary.personBalances['رضا کریمی'].status, 'settled');
  assert.equal(summary.personBalances['رضا کریمی'].balance, 0);
  assert.equal(summary.totalReceivables, 300000 + 400000, 'اشخاص بدهکار در طلب‌ها جمع می‌شوند');
  assert.equal(summary.totalPayables, 0);
  assert.equal(summary.totalNetWorth, summary.totalLiquidAssets + summary.totalReceivables - summary.totalPayables);
});

test('income received from a person becomes a creditor balance and payable', () => {
  const accounts = [...ACCOUNTS, { id: 'a-sara', name: 'سارا محمدی', group: 'person', active: true }];
  const transactions = [
    { id: 'x1', type: 'income', account: 'بانک ملت', category: 'سارا محمدی', amount: 750000 },
  ];
  const summary = reportSummary(transactions, accounts, [], []);
  const sara = accountBalance(accounts[accounts.length - 1], accounts, transactions);

  assert.equal(sara.balance, -750000, 'دریافت از شخص، حساب شخص را بستانکار می‌کند');
  assert.equal(summary.personBalances['سارا محمدی'].status, 'creditor');
  assert.equal(summary.totalPayables, 750000);
  assert.equal(summary.totalReceivables, 0);
  assert.equal(summary.totalNetWorth, summary.totalLiquidAssets - summary.totalPayables);
});

test('an outstanding check is a payable and does not touch the bank balance yet', () => {
  const accounts = [
    { id: 'a-bank', name: 'بانک ملت', group: 'bank', active: true, initialBalance: 5000000 },
    { id: 'a-payable', name: 'اسناد پرداختنی', group: 'liability', active: true },
    { id: 'a-rent', name: 'اجاره محل', group: 'expense', active: true },
  ];
  const pending = [{
    id: 'ch1', date: '1405/06/12', type: 'expense', account: 'بانک ملت', category: 'اجاره محل',
    amount: 900000, method: 'check', check: { status: 'in_progress', linkedBank: 'بانک ملت' },
  }];
  const cleared = [{ ...pending[0], check: { status: 'cleared', linkedBank: 'بانک ملت' } }];

  const pendingSummary = reportSummary(pending, accounts, [], []);
  assert.equal(pendingSummary.totalLiquidAssets, 5000000, 'چک در جریان نباید موجودی بانک را کم کند');
  assert.equal(pendingSummary.totalPayables, 900000, 'چک در جریان بدهی است');
  assert.equal(pendingSummary.totalNetWorth, 4100000);

  const clearedSummary = reportSummary(cleared, accounts, [], []);
  assert.equal(clearedSummary.totalLiquidAssets, 4100000, 'پس از پاس شدن، مبلغ از بانک کم می‌شود');
  assert.equal(clearedSummary.totalPayables, 0, 'بدهی چک پس از پاس شدن صفر می‌شود');
  assert.equal(clearedSummary.totalNetWorth, pendingSummary.totalNetWorth, 'صدور و پاس شدن چک نباید ارزش خالص را عوض کند');

  const pendingTrial = ledgerSide(pending, accounts);
  const clearedTrial = ledgerSide(cleared, accounts);
  assert.equal(pendingTrial.debits, pendingTrial.credits, 'سند چک در جریان هم باید متوازن باشد');
  assert.equal(clearedTrial.debits, clearedTrial.credits, 'سند چک پاس‌شده هم باید متوازن باشد');
});

test('large Rial amounts stay exact during a full report pass', () => {
  const accounts = [
    { id: 'a-bank', name: 'بانک ملت', group: 'bank', active: true, initialBalance: 900719925474000 },
    { id: 'a-sales', name: 'فروش محصول', group: 'income', active: true },
  ];
  const transactions = [];
  for (let index = 0; index < 5000; index += 1) {
    transactions.push({
      id: `big-${index}`, date: '1405/06/15', type: 'income', account: 'بانک ملت',
      category: 'فروش محصول', amount: 1234567890000 + index,
    });
  }
  const expected = transactions.reduce((sum, transaction) => sum + BigInt(transaction.amount), 900719925474000n);
  const bank = accountBalance(accounts[0], accounts, transactions);
  const income = accountBalance(accounts[1], accounts, transactions);
  const summary = reportSummary(transactions, accounts, [], []);

  assert.equal(bank.balance, Number(expected), 'جمع ریالی بزرگ باید دقیق بماند');
  assert.equal(Number.isInteger(bank.balance), true);
  assert.equal(income.balance, Number(expected - 900719925474000n));
  assert.equal(summary.totalLiquidAssets, Number(expected));
  assert.equal(summary.netSavings, Number(expected - 900719925474000n));
});

test('report engine reuses the real account tree for descendant rollups', () => {
  const accounts = [
    { id: 'a-assets', name: 'دارایی‌های جاری', group: 'asset', parentId: null },
    { id: 'a-bank', name: 'بانک ملت', group: 'bank', parentId: 'a-assets', initialBalance: 3000000 },
    { id: 'a-cash', name: 'صندوق', group: 'cash', parentId: 'a-assets', initialBalance: 500000 },
  ];
  const transactions = [{ id: 'r1', type: 'expense', account: 'صندوق', category: 'اجاره محل', amount: 200000 }];
  const tree = accountTree(accounts);
  assert.ok(tree.descendantsById.get('a-assets').has('بانک ملت'), 'درخت واقعی باید فرزندان را بشناسد');

  const parent = accountBalance(accounts[0], accounts, transactions);
  assert.equal(parent.initialBalance, 3500000);
  assert.equal(parent.balance, 3300000, 'مانده سرگروه = جمع مانده فرزندان');
  assert.equal(parent.transactionCount, 1);

  const children = accounts.slice(1).reduce((sum, account) => sum + accountBalance(account, accounts, transactions).balance, 0);
  assert.equal(parent.balance, children);
});
