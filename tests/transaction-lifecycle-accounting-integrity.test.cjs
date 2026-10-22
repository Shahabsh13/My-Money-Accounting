/*
 * آزمون یکپارچگی چرخهٔ حذف/Undo در برابر پیوند اقساط و سند اصلاحی.
 *
 * UI واقعی bundle 067 و listener واقعی Undo در bundle 078 در JSDOM بوت می‌شوند؛
 * برای مانده و گزارش از توابع تولیدیِ برش‌خورده از همان bundle استفاده می‌شود.
 * JSDOM جایگزین Android/WebView واقعی نیست و این تست end-to-end روی دستگاه نیست.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, closeApp, wait, normalize } = require('./helpers/app-boot.cjs');
const { loadAccountingKernel } = require('./helpers/production-slices.cjs');

const kernel = loadAccountingKernel();
const FIRST_RUN_DONE = {
  'hesabno:first_run_profile_done': '1',
  'hesabno:first_run_intro_done': '1',
};
// تولیدِ تراکنش‌ها نام حساب را ذخیره می‌کند، نه لزوماً شناسهٔ حساب؛ مهاجرت باید هر دو را تطبیق دهد.
const ACCOUNT = { id: 'bank-mellat-001', name: 'بانک ملت', group: 'bank', code: '12001', active: true, initialBalance: 5000 };
const EXPENSE_ACCOUNT = { id: 'acct-expense', name: 'هزینه قسط', group: 'expense', active: true };
const ACCOUNTS = [ACCOUNT, EXPENSE_ACCOUNT];
const PAYMENT_AMOUNT = 1000;

const loan = (overrides = {}) => ({
  id: 'loan-1', name: 'وام آزمایشی', type: 'personal', amount: PAYMENT_AMOUNT,
  status: 'completed', receiveDate: '1405/07/01', installmentAmount: PAYMENT_AMOUNT,
  ...overrides,
});
const paidInstallment = (overrides = {}) => ({
  id: 'inst-1', loanId: 'loan-1', loanName: 'وام آزمایشی', loanType: 'personal',
  installmentNumber: 1, totalInstallments: 1, amount: PAYMENT_AMOUNT,
  dueDate: '1405/07/01', status: 'paid', paidDate: '1405/07/01',
  paidFromAccount: ACCOUNT.name, transactionId: 'tx-installment-1',
  ...overrides,
});
const paymentTransaction = (overrides = {}) => ({
  id: 'tx-installment-1', documentNumber: 101, title: 'پرداخت قسط وام آزمایشی',
  category: 'هزینه قسط', amount: PAYMENT_AMOUNT, date: '1405/07/01', time: '10:00',
  type: 'expense', method: 'normal', account: ACCOUNT.name,
  destinationAccount: 'هزینه قسط', isLoanTransaction: true,
  loanId: 'loan-1', installmentId: 'inst-1',
  ...overrides,
});
const storageFor = ({ loans = [], installments = [] } = {}) => ({
  ...FIRST_RUN_DONE,
  'hesabno:accounts_v5': JSON.stringify(ACCOUNTS),
  'hesabno:loans': JSON.stringify(loans),
  'hesabno:installments': JSON.stringify(installments),
});
const stubs = (window) => {
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { width: 300, height: 120, top: 0, left: 0, right: 300, bottom: 120, x: 0, y: 0 };
  };
};
const click = (window, element) => {
  assert.ok(element, 'عنصر UI مورد انتظار باید وجود داشته باشد');
  if (element.type === 'submit') {
    const form = element.closest('form');
    const formProps = Object.keys(form || {}).find((key) => key.startsWith('__reactProps$'));
    const onSubmit = formProps && form[formProps].onSubmit;
    if (onSubmit) {
      onSubmit({ target: form, currentTarget: form, preventDefault() {}, stopPropagation() {} });
      return;
    }
  }
  const label = normalize(element.textContent);
  // The production guard is a native capture listener on list delete actions.
  if (element.closest("article[id^='tx-card-']") && label === 'حذف') {
    const event = new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window });
    element.dispatchEvent(event);
    if (event.defaultPrevented) return;
  }
  // Invoke React's rendered handler directly: jsdom does not consistently
  // deliver delegated events for this bundled application.
  const propsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'));
  const handler = propsKey && element[propsKey].onClick;
  if (handler) handler({ target: element, currentTarget: element, preventDefault() {}, stopPropagation() {} });
  else element.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
};
const readJson = (window, key) => JSON.parse(window.localStorage.getItem(key) || '[]');

function takeSnapshot(window) {
  const transactions = readJson(window, 'hesabno:transactions');
  const accounts = readJson(window, 'hesabno:accounts_v5');
  const loans = readJson(window, 'hesabno:loans');
  const installments = readJson(window, 'hesabno:installments');
  const bank = accounts.find((account) => account.name === ACCOUNT.name);
  assert.ok(bank, 'حساب بانک باید از localStorage بارگذاری شده باشد');
  const summary = kernel.reportSummary(transactions, accounts, [], installments);
  return {
    transactions,
    accounts,
    loans,
    installments,
    bankBalance: kernel.accountBalance(bank, accounts, transactions).balance,
    report: {
      totalExpense: summary.totalExpense,
      totalRemainingInstallments: summary.totalRemainingInstallments,
      totalLiquidAssets: summary.totalLiquidAssets,
      totalNetWorth: summary.totalNetWorth,
    },
  };
}

async function openEditForm(dom, transactionId) {
  const { window } = dom;
  const document = window.document;
  const existingForm = document.querySelector('main form');
  if (existingForm) {
    const closeForm = document.querySelector('main header button[title="بستن"]');
    if (closeForm) { click(window, closeForm); await wait(450); }
  }
  await wait(900);
  const skip = [...document.querySelectorAll('button')]
    .find((button) => normalize(button.textContent) === 'رد کردن');
  if (skip) {
    click(window, skip);
    await wait(300);
  }
  const transactionsTab = [...document.querySelectorAll('nav.fixed button')]
    .find((button) => normalize(button.textContent) === 'تراکنش‌ها');
  click(window, transactionsTab);
  await wait(1200);

  let card = document.querySelector(`#tx-card-${transactionId}`);
  assert.ok(card, `کارت تراکنش ${transactionId} باید در فهرست واقعی دیده شود`);
  let editButton = [...card.querySelectorAll('button')]
    .find((button) => normalize(button.textContent) === 'ویرایش');
  if (!editButton) {
    click(window, card.querySelector('div.cursor-pointer'));
    await wait(350);
    card = document.querySelector(`#tx-card-${transactionId}`);
    editButton = [...(card || document).querySelectorAll('button')]
      .find((button) => normalize(button.textContent) === 'ویرایش');
  }
  click(window, editButton);
  await wait(1200);
  assert.ok(document.querySelector('main form'), 'فرم ویرایش واقعی باید باز شده باشد');
}

async function deleteFromEditForm(dom) {
  const { window } = dom;
  const document = window.document;
  click(window, document.querySelector('main header [title="حذف کامل سند"]'));
  await wait(350);
  const overlay = document.querySelector('[data-hesabno-delete-confirm]');
  assert.ok(overlay, 'دیالوگ تأیید حذف واقعی باید باز شود');
  const confirm = [...overlay.querySelectorAll('button')]
    .find((button) => normalize(button.textContent) === 'بله، حذف شود');
  click(window, confirm);
  await wait(700);
}

async function undoFromToast(dom) {
  const { window } = dom;
  await wait(250);
  const undoButton = [...window.document.querySelectorAll('.hn-toast button')]
    .find((button) => normalize(button.textContent) === 'برگرداندن');
  assert.ok(undoButton, 'توست Undo واقعی باید پس از حذف ظاهر شود');
  click(window, undoButton);
  await wait(700);
}

function collectCheck(failures, label, callback) {
  try {
    callback();
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
  }
}

test('حذف مستقیم پرداخت قسط وضعیت قسط و گزارش را نیز با حذف تراکنش سازگار می‌کند', { timeout: 150000 }, async (t) => {
  const tx = paymentTransaction();
  const dom = await bootApp({
    seed: [tx],
    storage: storageFor({ loans: [loan()], installments: [paidInstallment()] }),
    stubs,
  });
  t.after(() => closeApp(dom));
  const { window } = dom;

  const before = takeSnapshot(window);
  assert.equal(before.transactions.length, 1);
  assert.equal(before.installments[0].status, 'paid');
  assert.equal(before.loans[0].status, 'completed');

  await openEditForm(dom, tx.id);
  await deleteFromEditForm(dom);
  const afterDelete = takeSnapshot(window);

  const cardPresentAfterDelete = !!window.document.querySelector(`#tx-card-${tx.id}`);
  // Undo از دکمهٔ توست واقعی اجرا می‌شود، نه با فراخوانی مستقیم callback.
  await undoFromToast(dom);
  const afterUndo = takeSnapshot(window);
  const cardPresentAfterUndo = !!window.document.querySelector(`#tx-card-${tx.id}`);

  // حذف مجدد پس از Undo باید همان تغییرهای مرتبط را تکرار کند.
  await openEditForm(dom, tx.id);
  await deleteFromEditForm(dom);
  const afterRedDelete = takeSnapshot(window);
  const cardPresentAfterRedDelete = !!window.document.querySelector(`#tx-card-${tx.id}`);


  const failures = [];
  collectCheck(failures, 'state رندرشدهٔ تراکنش در UI', () => {
    assert.equal(cardPresentAfterDelete, false, 'کارت باید پس از حذف از state رندرشده ناپدید شود');
    assert.equal(cardPresentAfterUndo, true, 'کارت باید پس از Undo در state رندرشده برگردد');
    assert.equal(cardPresentAfterRedDelete, false, 'حذف مجدد باید کارت را دوباره بردارد');
  });
  collectCheck(failures, 'حذف رکورد تراکنش', () => {
    assert.equal(afterDelete.transactions.some((item) => item.id === tx.id), false);
    assert.equal(afterRedDelete.transactions.some((item) => item.id === tx.id), false);
  });
  collectCheck(failures, 'ذخیره‌سازی حذف تراکنش', () => {
    assert.equal(afterDelete.transactions.some((item) => item.id === tx.id), false,
      'پس از حذف، تراکنش نباید در localStorage باقی بماند');
    assert.equal(afterUndo.transactions.some((item) => item.id === tx.id), true,
      'پس از Undo تراکنش باید دوباره در localStorage باشد');
  });
  collectCheck(failures, 'بازگشت اقساط به پرداخت‌نشده پس از حذف مستقیم', () => {
    assert.equal(afterDelete.installments[0].status, 'pending');
    assert.equal(afterDelete.installments[0].paidDate, undefined);
    assert.equal(afterDelete.installments[0].paidFromAccount, undefined);
    assert.equal(afterDelete.installments[0].transactionId, undefined);
    assert.deepEqual(afterRedDelete.installments, afterDelete.installments,
      'حذف مجدد پس از Undo باید همان state ذخیره‌شده را بسازد');
  });
  collectCheck(failures, 'بازگشت وام به وضعیت فعال پس از حذف مستقیم', () => {
    assert.equal(afterDelete.loans[0].status, 'active');
  });
  collectCheck(failures, 'ماندهٔ حساب بانکی پس از حذف', () => {
    assert.equal(afterDelete.bankBalance - before.bankBalance, PAYMENT_AMOUNT,
      'حذف هزینه باید مبلغ را به ماندهٔ بانک برگرداند');
  });
  collectCheck(failures, 'اقساط باقی‌ماندهٔ گزارش پس از حذف', () => {
    assert.equal(afterDelete.report.totalRemainingInstallments,
      before.report.totalRemainingInstallments + PAYMENT_AMOUNT,
      'قسطِ پرداخت‌نشده باید در بدهی اقساط گزارش شمرده شود');
  });
  collectCheck(failures, 'ارزش خالص پس از لغو پرداخت', () => {
    assert.equal(afterDelete.report.totalNetWorth, before.report.totalNetWorth,
      'بازگشت وجه به بانک و بازگشت بدهی قسط باید همدیگر را خنثی کنند');
  });
  collectCheck(failures, 'بازگشت تراکنش و اطلاعات وابسته پس از Undo', () => {
    assert.deepEqual(afterUndo.transactions, before.transactions);
    assert.deepEqual(afterUndo.installments, before.installments);
    assert.deepEqual(afterUndo.loans, before.loans);
    assert.equal(afterUndo.bankBalance, before.bankBalance);
    assert.deepEqual(afterUndo.report, before.report);
    assert.equal(afterUndo.installments[0].transactionId, tx.id);
    assert.equal(afterUndo.loans[0].status, 'completed');
  });

  t.diagnostic(`پیش از حذف: ${JSON.stringify(before)}`);
  t.diagnostic(`پس از حذف: ${JSON.stringify(afterDelete)}`);
  t.diagnostic(`پس از Undo: ${JSON.stringify(afterUndo)}`);
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('پرداخت‌های چندگانه و چندقسطی، تراکنش loan-only و تراکنش عادی فقط state وابستهٔ درست را تغییر می‌دهند', { timeout: 240000 }, async (t) => {
  const multiLoan = {
    id: 'loan-multi', name: 'وام چندقسطی', type: 'personal', amount: 2000,
    status: 'completed', receiveDate: '1405/07/01', installmentAmount: 1000,
  };
  const firstInstallment = paidInstallment({
    id: 'inst-a', loanId: multiLoan.id, loanName: multiLoan.name,
    installmentNumber: 1, totalInstallments: 2, transactionId: 'tx-a',
  });
  const secondInstallment = paidInstallment({
    id: 'inst-b', loanId: multiLoan.id, loanName: multiLoan.name,
    installmentNumber: 2, totalInstallments: 2, transactionId: 'tx-b',
  });
  const txA = paymentTransaction({ id: 'tx-a', documentNumber: 301, loanId: multiLoan.id, installmentId: firstInstallment.id });
  const txA2 = paymentTransaction({ id: 'tx-a2', documentNumber: 302, loanId: multiLoan.id, installmentId: firstInstallment.id });
  const txB = paymentTransaction({ id: 'tx-b', documentNumber: 303, loanId: multiLoan.id, installmentId: secondInstallment.id });
  const loanOnly = paymentTransaction({ id: 'tx-loan-only', documentNumber: 304, amount: 200, loanId: multiLoan.id, installmentId: undefined });
  const ordinary = paymentTransaction({ id: 'tx-ordinary', documentNumber: 305, amount: 300, loanId: undefined, installmentId: undefined, isLoanTransaction: undefined });
  const seed = [txA, txA2, txB, loanOnly, ordinary];
  const dom = await bootApp({
    seed,
    storage: storageFor({ loans: [multiLoan], installments: [firstInstallment, secondInstallment] }),
    stubs,
  });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const byId = (snapshot, id) => snapshot.installments.find((item) => item.id === id);
  const before = takeSnapshot(window);

  // حذف یکی از دو تراکنش هم‌پیوند نباید قسط را باز کند؛ سپس Undo باید snapshot را برگرداند.
  await openEditForm(dom, txA.id);
  await deleteFromEditForm(dom);
  const afterOneOfTwo = takeSnapshot(window);
  const cardGoneAfterOne = !window.document.querySelector(`#tx-card-${txA.id}`);
  assert.equal(afterOneOfTwo.transactions.some((item) => item.id === txA.id), false);
  assert.ok(afterOneOfTwo.transactions.some((item) => item.id === txA2.id));
  assert.equal(byId(afterOneOfTwo, firstInstallment.id).status, 'paid');
  assert.equal(afterOneOfTwo.loans[0].status, 'completed');
  assert.equal(cardGoneAfterOne, true, 'کارت تراکنش حذف‌شده باید از state رندرشده برود');
  assert.equal(afterOneOfTwo.bankBalance - before.bankBalance, txA.amount);
  assert.equal(afterOneOfTwo.report.totalExpense, before.report.totalExpense - txA.amount);
  assert.equal(afterOneOfTwo.report.totalRemainingInstallments, before.report.totalRemainingInstallments);
  await undoFromToast(dom);
  const afterUndoOne = takeSnapshot(window);
  assert.deepEqual(afterUndoOne.transactions, before.transactions);
  assert.deepEqual(afterUndoOne.installments, before.installments);
  assert.deepEqual(afterUndoOne.loans, before.loans);
  assert.deepEqual(afterUndoOne.report, before.report);

  // حذف مجدد همان رکورد تکرارپذیر است؛ سپس حذف آخرین تراکنش قسط اول، فقط همان قسط را باز می‌کند.
  await openEditForm(dom, txA.id);
  await deleteFromEditForm(dom);
  const repeatedDelete = takeSnapshot(window);
  assert.equal(byId(repeatedDelete, firstInstallment.id).status, 'paid');
  await openEditForm(dom, txA2.id);
  await deleteFromEditForm(dom);
  const afterLastPaymentA = takeSnapshot(window);
  assert.equal(afterLastPaymentA.transactions.some((item) => item.id === txA.id), false);
  assert.equal(afterLastPaymentA.transactions.some((item) => item.id === txA2.id), false);
  assert.equal(byId(afterLastPaymentA, firstInstallment.id).status, 'pending');
  assert.equal(byId(afterLastPaymentA, firstInstallment.id).paidDate, undefined);
  assert.equal(byId(afterLastPaymentA, firstInstallment.id).paidFromAccount, undefined);
  assert.equal(byId(afterLastPaymentA, firstInstallment.id).transactionId, undefined);
  assert.equal(byId(afterLastPaymentA, secondInstallment.id).status, 'paid');
  assert.equal(afterLastPaymentA.loans[0].status, 'active');
  assert.equal(afterLastPaymentA.bankBalance - repeatedDelete.bankBalance, txA2.amount);
  assert.equal(afterLastPaymentA.report.totalRemainingInstallments,
    repeatedDelete.report.totalRemainingInstallments + firstInstallment.amount);
  assert.equal(afterLastPaymentA.report.totalNetWorth, repeatedDelete.report.totalNetWorth,
    'افزایش نقد و بازگشت بدهی همان قسط باید یکدیگر را خنثی کنند');

  // Undo آخرین پرداخت، فقط قسط اول و وضعیت وام را به snapshot قبلی برمی‌گرداند.
  await undoFromToast(dom);
  const afterUndoLastA = takeSnapshot(window);
  assert.deepEqual(afterUndoLastA.installments, repeatedDelete.installments);
  assert.deepEqual(afterUndoLastA.loans, repeatedDelete.loans);
  assert.deepEqual(afterUndoLastA.transactions, repeatedDelete.transactions);
  assert.deepEqual(afterUndoLastA.report, repeatedDelete.report);

  // حذف دوبارهٔ آخرین پرداخت قسط اول را به pending می‌برد؛ این state هنگام حذف قسط دوم حفظ می‌شود.
  await openEditForm(dom, txA2.id);
  await deleteFromEditForm(dom);
  const afterRepeatedLastA = takeSnapshot(window);
  assert.equal(byId(afterRepeatedLastA, firstInstallment.id).status, 'pending');
  assert.equal(afterRepeatedLastA.loans[0].status, 'active');

  // حذف آخرین پرداخت قسط دوم نباید وضعیت قسط اول را تغییر دهد.
  await openEditForm(dom, txB.id);
  await deleteFromEditForm(dom);
  const afterLastPaymentB = takeSnapshot(window);
  assert.equal(byId(afterLastPaymentB, firstInstallment.id).status, 'pending');
  assert.equal(byId(afterLastPaymentB, secondInstallment.id).status, 'pending');
  assert.equal(afterLastPaymentB.loans[0].status, 'active');
  await undoFromToast(dom);
  const afterUndoB = takeSnapshot(window);
  assert.equal(byId(afterUndoB, firstInstallment.id).status, 'pending');
  assert.equal(byId(afterUndoB, secondInstallment.id).status, 'paid');
  assert.equal(afterUndoB.loans[0].status, 'active', 'Undo نباید وضعیت مرتبط با قسط اول را به completed برگرداند');

  // loanId بدون installmentId و تراکنش عادی نباید هیچ قسطی را تغییر دهند.
  const beforeLoanOnly = takeSnapshot(window);
  await openEditForm(dom, loanOnly.id);
  await deleteFromEditForm(dom);
  const afterLoanOnlyDelete = takeSnapshot(window);
  assert.deepEqual(afterLoanOnlyDelete.installments, beforeLoanOnly.installments);
  assert.deepEqual(afterLoanOnlyDelete.loans, beforeLoanOnly.loans);
  await undoFromToast(dom);
  const afterLoanOnlyUndo = takeSnapshot(window);
  assert.deepEqual(afterLoanOnlyUndo.installments, beforeLoanOnly.installments);
  assert.deepEqual(afterLoanOnlyUndo.loans, beforeLoanOnly.loans);

  const beforeOrdinary = takeSnapshot(window);
  await openEditForm(dom, ordinary.id);
  await deleteFromEditForm(dom);
  const afterOrdinaryDelete = takeSnapshot(window);
  assert.deepEqual(afterOrdinaryDelete.installments, beforeOrdinary.installments);
  assert.deepEqual(afterOrdinaryDelete.loans, beforeOrdinary.loans);
  await undoFromToast(dom);
  const afterOrdinaryUndo = takeSnapshot(window);
  assert.deepEqual(
    afterOrdinaryUndo.transactions.slice().sort((a, b) => a.id.localeCompare(b.id)),
    beforeOrdinary.transactions.slice().sort((a, b) => a.id.localeCompare(b.id)),
  );
  assert.deepEqual(afterOrdinaryUndo.installments, beforeOrdinary.installments);
  assert.deepEqual(afterOrdinaryUndo.loans, beforeOrdinary.loans);

  t.diagnostic(`حذف یکی از دو پرداخت: ${JSON.stringify(afterOneOfTwo)}`);
  t.diagnostic(`حذف آخرین پرداخت قسط اول: ${JSON.stringify(afterLastPaymentA)}`);
  t.diagnostic(`پس از حذف/Undo قسط دوم، loan-only و سند عادی: ${JSON.stringify(afterOrdinaryUndo)}`);
});

test('Undo سند اصلاحی، پیوند metadata آن را در رکورد اصلی بازمی‌گرداند', { timeout: 150000 }, async (t) => {
  const source = {
    id: 'tx-source', documentNumber: 201, title: 'هزینهٔ اصلی', category: 'هزینه قسط',
    amount: PAYMENT_AMOUNT, date: '1405/07/01', time: '09:00', type: 'expense',
    method: 'normal', account: ACCOUNT.name, destinationAccount: 'هزینه قسط',
    reversedByDocNumber: 202,
  };
  const correction = {
    id: 'tx-correction', documentNumber: 202, title: 'اصلاح هزینهٔ اصلی',
    category: 'هزینه قسط', amount: PAYMENT_AMOUNT, date: '1405/07/02', time: '09:00',
    type: 'income', method: 'normal', account: ACCOUNT.name,
    destinationAccount: 'هزینه قسط', isReversal: true, reversalOfDocNumber: 201,
  };
  const unrelated = JSON.parse(JSON.stringify(paymentTransaction({
    id: 'tx-unrelated', documentNumber: 203, title: 'سند عادی نامرتبط',
    loanId: undefined, installmentId: undefined,
  })));
  const dom = await bootApp({
    seed: [source, correction, unrelated],
    storage: storageFor(),
    stubs,
  });
  t.after(() => closeApp(dom));
  const { window } = dom;

  const before = readJson(window, 'hesabno:transactions');
  assert.equal(before.find((item) => item.id === source.id).reversedByDocNumber, correction.documentNumber);
  assert.equal(before.find((item) => item.id === correction.id).reversalOfDocNumber, source.documentNumber);

  await openEditForm(dom, correction.id);
  await deleteFromEditForm(dom);
  const afterDelete = readJson(window, 'hesabno:transactions');
  const sourceAfterDelete = afterDelete.find((item) => item.id === source.id);
  const correctionAfterDelete = afterDelete.find((item) => item.id === correction.id);

  await undoFromToast(dom);
  const afterUndo = readJson(window, 'hesabno:transactions');
  const sourceAfterUndo = afterUndo.find((item) => item.id === source.id);
  const correctionAfterUndo = afterUndo.find((item) => item.id === correction.id);
  const unrelatedAfterUndo = afterUndo.find((item) => item.id === unrelated.id);

  // حذف مجدد پس از Undo باید marker را دوباره پاک کند؛ Undo دوم نیز باید snapshot را بازیابی کند.
  await openEditForm(dom, correction.id);
  await deleteFromEditForm(dom);
  const afterRedDelete = readJson(window, 'hesabno:transactions');
  const sourceAfterRedDelete = afterRedDelete.find((item) => item.id === source.id);
  const correctionAfterRedDelete = afterRedDelete.find((item) => item.id === correction.id);
  await undoFromToast(dom);
  const afterSecondUndo = readJson(window, 'hesabno:transactions');
  const sourceAfterSecondUndo = afterSecondUndo.find((item) => item.id === source.id);
  const correctionAfterSecondUndo = afterSecondUndo.find((item) => item.id === correction.id);

  // عمداً دربارهٔ تغییر جمع‌های حسابداری assertions نداریم: این سناریو فقط پیوند metadata را می‌سنجد.
  t.diagnostic(`پس از حذف سند اصلاحی: ${JSON.stringify({ sourceAfterDelete, correctionAfterDelete })}`);
  t.diagnostic(`پس از Undo: ${JSON.stringify({ sourceAfterUndo, correctionAfterUndo })}`);
  assert.equal(correctionAfterDelete, undefined, 'سند اصلاحی باید از localStorage حذف شود');
  assert.equal(sourceAfterDelete.reversedByDocNumber, undefined,
    'با حذف سند اصلاحی، نشانگر برگشتیِ سند اصلی پاک می‌شود');
  assert.ok(correctionAfterUndo, 'Undo باید خود سند اصلاحی را در localStorage بازگرداند');
  assert.equal(correctionAfterUndo.reversalOfDocNumber, source.documentNumber,
    'ارجاع اصلاحیه به سند اصلی باید حفظ شود');
  assert.equal(sourceAfterUndo.reversedByDocNumber, correction.documentNumber,
    'Undo باید نشانگر سند اصلاحی را روی سند اصلی نیز بازسازی کند');
  assert.deepEqual(unrelatedAfterUndo, unrelated,
    'Undo نباید سند نامرتبط را تغییر دهد');
  assert.equal(correctionAfterRedDelete, undefined);
  assert.equal(sourceAfterRedDelete.reversedByDocNumber, undefined,
    'حذف مجدد باید همان marker را دوباره بردارد');
  assert.equal(sourceAfterSecondUndo.reversedByDocNumber, correction.documentNumber);
  assert.equal(correctionAfterSecondUndo.reversalOfDocNumber, source.documentNumber);
});

test('metadata در دادهٔ چنداصلاحیه‌ای بدون حدس‌زدن markerهای دیگر حفظ می‌شود', { timeout: 180000 }, async (t) => {
  const source = {
    id: 'tx-multi-source', documentNumber: 211, title: 'سند دارای چند اصلاحیه',
    category: 'هزینه قسط', amount: PAYMENT_AMOUNT, date: '1405/07/01', time: '09:00',
    type: 'expense', method: 'normal', account: ACCOUNT.name, destinationAccount: 'هزینه قسط',
    reversedByDocNumber: 213,
  };
  const correctionA = {
    id: 'tx-correction-a', documentNumber: 212, title: 'اصلاحیه A', category: 'هزینه قسط',
    amount: PAYMENT_AMOUNT, date: '1405/07/02', time: '09:00', type: 'income',
    method: 'normal', account: ACCOUNT.name, destinationAccount: 'هزینه قسط',
    isReversal: true, reversalOfDocNumber: 211,
  };
  const correctionB = {
    id: 'tx-correction-b', documentNumber: 213, title: 'اصلاحیه B', category: 'هزینه قسط',
    amount: PAYMENT_AMOUNT, date: '1405/07/03', time: '09:00', type: 'income',
    method: 'normal', account: ACCOUNT.name, destinationAccount: 'هزینه قسط',
    isReversal: true, reversalOfDocNumber: 211,
  };
  const dom = await bootApp({ seed: [source, correctionA, correctionB], storage: storageFor(), stubs });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const before = readJson(window, 'hesabno:transactions');
  assert.equal(before.find((item) => item.id === source.id).reversedByDocNumber, correctionB.documentNumber);
  assert.equal(before.filter((item) => item.isReversal && item.reversalOfDocNumber === source.documentNumber).length, 2);

  // مدل/رابط کاربری یک marker و یک «سند اصلاحی» نمایشی دارد؛ این seed شبیه دادهٔ قدیمی/واردشده است.
  await openEditForm(dom, correctionA.id);
  await deleteFromEditForm(dom);
  const afterDelete = readJson(window, 'hesabno:transactions');
  const sourceAfterDelete = afterDelete.find((item) => item.id === source.id);
  assert.equal(afterDelete.some((item) => item.id === correctionA.id), false);
  assert.ok(afterDelete.some((item) => item.id === correctionB.id), 'اصلاحیهٔ انتخاب‌نشده نباید حذف شود');
  assert.equal(sourceAfterDelete.reversedByDocNumber, correctionB.documentNumber,
    'marker متفاوتی که حذف تغییر نداده است نباید پاک یا جایگزین شود');

  await undoFromToast(dom);
  const afterUndoCorrection = readJson(window, 'hesabno:transactions');
  assert.ok(afterUndoCorrection.some((item) => item.id === correctionA.id));
  assert.ok(afterUndoCorrection.some((item) => item.id === correctionB.id));
  assert.equal(afterUndoCorrection.find((item) => item.id === source.id).reversedByDocNumber,
    correctionB.documentNumber, 'Undo نباید marker قبلیِ متفاوت را حدس‌زده با شمارهٔ اصلاحیهٔ حذف‌شده جایگزین کند');

  // دربارهٔ حذف منبعی که اصلاحیه‌های دیگری به آن اشاره می‌کنند، سیاستی در این patch تعریف نمی‌شود.
  t.diagnostic(`حذف اصلاحیهٔ A از دادهٔ چنداصلاحیه‌ای: ${JSON.stringify(afterDelete)}`);
  t.diagnostic(`Undo اصلاحیهٔ A: ${JSON.stringify(afterUndoCorrection)}`);
});

test('حذف سند اصلی با باقی‌ماندن چند اصلاحیه در مسیر UI مسدود می‌ماند', { timeout: 150000 }, async (t) => {
  const source = {
    id: 'tx-locked-source', documentNumber: 221, title: 'سند اصلی قفل‌شده',
    category: 'هزینه قسط', amount: PAYMENT_AMOUNT, date: '1405/07/01', time: '09:00',
    type: 'expense', method: 'normal', account: ACCOUNT.name, destinationAccount: 'هزینه قسط',
    reversedByDocNumber: 223,
  };
  const correctionA = {
    id: 'tx-locked-correction-a', documentNumber: 222, title: 'اصلاحیه اول',
    category: 'هزینه قسط', amount: PAYMENT_AMOUNT, date: '1405/07/02', time: '09:00',
    type: 'income', method: 'normal', account: ACCOUNT.name, destinationAccount: 'هزینه قسط',
    isReversal: true, reversalOfDocNumber: source.documentNumber,
  };
  const correctionB = {
    id: 'tx-locked-correction-b', documentNumber: 223, title: 'اصلاحیه دوم',
    category: 'هزینه قسط', amount: PAYMENT_AMOUNT, date: '1405/07/03', time: '09:00',
    type: 'income', method: 'normal', account: ACCOUNT.name, destinationAccount: 'هزینه قسط',
    isReversal: true, reversalOfDocNumber: source.documentNumber,
  };
  const dom = await bootApp({ seed: [source, correctionA, correctionB], storage: storageFor(), stubs });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const before = readJson(window, 'hesabno:transactions');

  const transactionsTab = [...window.document.querySelectorAll('nav.fixed button')]
    .find((button) => normalize(button.textContent) === 'تراکنش‌ها');
  click(window, transactionsTab);
  await wait(1200);
  let card = window.document.querySelector(`#tx-card-${source.id}`);
  assert.ok(card, 'سند اصلی باید در فهرست تراکنش‌های UI حاضر باشد');
  click(window, card.querySelector('div.cursor-pointer'));
  await wait(350);
  card = window.document.querySelector(`#tx-card-${source.id}`);
  const deleteAction = [...(card || window.document).querySelectorAll('button')]
    .find((button) => normalize(button.textContent) === 'حذف');
  assert.ok(deleteAction, 'اقدام حذف سند اصلی باید در کارت تراکنش وجود داشته باشد');
  click(window, deleteAction);
  await wait(350);
  const linkedNotice = window.document.querySelector('[data-hesabno-linked-document-notice]');
  const afterAttempt = readJson(window, 'hesabno:transactions');

  assert.ok(linkedNotice, 'قفل اسناد مرتبط باید به‌جای حذف منبع، پیام منع حذف نشان دهد');
  assert.deepEqual(afterAttempt, before, 'هیچ تراکنش یا metadata نباید با تلاش حذف منبع تغییر کند');
  assert.equal(afterAttempt.find((item) => item.id === source.id).reversedByDocNumber,
    correctionB.documentNumber);
  assert.equal(afterAttempt.filter((item) => item.isReversal && item.reversalOfDocNumber === source.documentNumber).length, 2);
  t.diagnostic(`وضعیت اسناد پس از تلاش برای حذف منبع: ${JSON.stringify(afterAttempt)}`);
});

test('Undo حذف اصلاحیه، ویرایش تازهٔ سند اصلی را بازنویسی نمی‌کند', { timeout: 150000 }, async (t) => {
  const source = {
    id: 'tx-newer-edit-source', documentNumber: 231, title: 'سند اصلی با ویرایش تازه',
    category: 'هزینه قسط', amount: PAYMENT_AMOUNT, date: '1405/07/01', time: '09:00',
    type: 'expense', method: 'normal', account: ACCOUNT.name, destinationAccount: 'هزینه قسط',
    notes: 'شرح اولیه', reversedByDocNumber: 232,
  };
  const correction = {
    id: 'tx-newer-edit-correction', documentNumber: 232, title: 'اصلاحیه برای آزمون Undo',
    category: 'هزینه قسط', amount: PAYMENT_AMOUNT, date: '1405/07/02', time: '09:00',
    type: 'income', method: 'normal', account: ACCOUNT.name, destinationAccount: 'هزینه قسط',
    isReversal: true, reversalOfDocNumber: source.documentNumber,
  };
  const dom = await bootApp({ seed: [source, correction], storage: storageFor(), stubs });
  t.after(() => closeApp(dom));
  const { window } = dom;

  await openEditForm(dom, correction.id);
  await deleteFromEditForm(dom);
  const undoDeletedCorrection = window.__hesabnoUndoTransaction;
  assert.equal(readJson(window, 'hesabno:transactions').find((item) => item.id === source.id).reversedByDocNumber,
    undefined, 'پس از حذف اصلاحیه باید marker آن از سند اصلی برداشته شده باشد');
  assert.equal(typeof undoDeletedCorrection, 'function', 'callback واقعی Undo باید پس از حذف موجود باشد');

  await openEditForm(dom, source.id);
  const description = window.document.querySelector('main form textarea[aria-label="شرح / توضیحات (اختیاری)"]');
  assert.ok(description, 'فیلد شرح سند اصلی باید در فرم ویرایش واقعی حاضر باشد');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(description, 'شرح جدید ثبت‌شده پس از حذف');
  description.dispatchEvent(new window.Event('input', { bubbles: true }));
  const descriptionProps = Object.keys(description).find((key) => key.startsWith('__reactProps$'));
  const onDescriptionChange = descriptionProps && description[descriptionProps].onChange;
  if (onDescriptionChange) onDescriptionChange({ target: description, currentTarget: description });
  await wait(100);
  const save = window.document.querySelector('main form button[type="submit"]');
  click(window, save);
  await wait(1000);
  const afterNewerEdit = readJson(window, 'hesabno:transactions');
  assert.equal(afterNewerEdit.find((item) => item.id === source.id).notes,
    'شرح جدید ثبت‌شده پس از حذف', 'ویرایش تازه باید پیش از Undo در storage ثبت شده باشد');

  // callback همان تابع production است که listener واقعی Undo نیز در تست‌های بالا فراخوانی می‌کند.
  undoDeletedCorrection();
  await wait(250);
  const afterUndo = readJson(window, 'hesabno:transactions');
  const restoredSource = afterUndo.find((item) => item.id === source.id);

  assert.equal(restoredSource.notes, 'شرح جدید ثبت‌شده پس از حذف',
    'Undo باید marker را روی رکورد فعلی merge کند، نه snapshot قدیمی را جایگزین سند کند');
  assert.equal(restoredSource.reversedByDocNumber, correction.documentNumber,
    'Undo باید marker حذف‌شده را بازیابی کند');
  assert.ok(afterUndo.some((item) => item.id === correction.id), 'Undo باید اصلاحیهٔ حذف‌شده را بازگرداند');
  t.diagnostic(`وضعیت سندها پس از ویرایش تازه و Undo: ${JSON.stringify(afterUndo)}`);
});
