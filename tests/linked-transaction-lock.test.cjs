const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const lockScript = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/194-hesabno-loan-linked-transaction-actions.js'), 'utf8');
const linkedDocumentScript = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/201-hesabno-linked-document-lock.js'), 'utf8');
const correctionScript = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/218-hesabno-hide-compound-correction-action.js'), 'utf8');

function setupLock({ loans, installments = [], transactions = [], heading = 'وام‌ها و تسهیلات', cardText = 'وام خودرو 100000', action = 'ویرایش' }) {
  const alerts = [];
  const data = {
    'hesabno:loans': loans,
    'hesabno:installments': installments,
    'hesabno:transactions': transactions,
  };
  const clickHandlers = [];
  const main = { querySelector: () => ({ textContent: heading }) };
  const card = { innerText: cardText, textContent: cardText, parentElement: main };
  const button = {
    title: action, textContent: action, parentElement: card,
    getAttribute: name => name === 'aria-label' ? null : null,
    closest: selector => selector === 'main' ? main : selector === 'button' ? button : null,
  };
  const document = { body: null, querySelectorAll: () => [], querySelector: () => null, addEventListener: (name, fn) => { if (name === 'click') clickHandlers.push(fn); } };
  const window = {
    __safeGet: key => Object.prototype.hasOwnProperty.call(data, key) ? JSON.stringify(data[key]) : null,
    alert: message => alerts.push(message),
    addEventListener() {}, setTimeout() {},
  };
  const localStorage = { getItem: key => window.__safeGet(key), setItem() {} };
  const sessionStorage = { getItem: () => null, removeItem() {} };
  class MutationObserver { observe() {} }
  vm.runInNewContext(linkedDocumentScript, { window, document, localStorage, sessionStorage, MutationObserver });
  vm.runInNewContext(lockScript, { window, document, localStorage });
  const event = {
    target: { closest: selector => selector === 'button' ? button : null },
    defaultPrevented: false, stopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.stopped = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };
  for (const handler of clickHandlers) handler(event);
  return { event, alerts, button };
}

test('existing direct loan transaction locks editing of parent loan', () => {
  const result = setupLock({ loans: [{ id: 'loan-1', name: 'وام خودرو', amount: 100000 }], transactions: [{ id: 'tx-1', loanId: 'loan-1', amount: 1000 }] });
  assert.equal(result.event.defaultPrevented, true);
  assert.equal(result.alerts.length, 1);
});

test('existing direct transaction locks deletion of parent loan', () => {
  const result = setupLock({ loans: [{ id: 'loan-1', name: 'وام خودرو', amount: 100000 }], transactions: [{ id: 'tx-1', loanId: 'loan-1', amount: 1000 }], action: 'حذف' });
  assert.equal(result.event.defaultPrevented, true);
  assert.equal(result.alerts.length, 1);
});

test('existing installment-linked transaction locks parent loan', () => {
  const result = setupLock({
    loans: [{ id: 'loan-1', name: 'وام خودرو', amount: 100000 }],
    installments: [{ id: 'inst-1', loanId: 'loan-1', transactionId: 'tx-1', status: 'paid' }],
    transactions: [{ id: 'tx-1', installmentId: 'inst-1', amount: 1000 }],
  });
  assert.equal(result.event.defaultPrevented, true);
});

test('linked purchase transaction locks editing on the purchase-installments page', () => {
  const result = setupLock({
    loans: [{ id: 'purchase-1', name: 'خرید لپ‌تاپ', amount: 500000 }],
    transactions: [{ id: 'tx-purchase', loanId: 'purchase-1', amount: 500000 }],
    heading: 'خرید و اقساط',
    cardText: 'خرید لپ‌تاپ 500000',
  });
  assert.equal(result.event.defaultPrevented, true);
  assert.equal(result.alerts.length, 1);
});

test('stale paid status and transactionId do not lock parent after transaction is deleted', () => {
  const result = setupLock({
    loans: [{ id: 'loan-1', name: 'وام خودرو', amount: 100000 }],
    installments: [{ id: 'inst-1', loanId: 'loan-1', transactionId: 'deleted-tx', status: 'paid', paidDate: '1405/07/01' }],
    transactions: [],
  });
  assert.equal(result.event.defaultPrevented, false);
  assert.equal(result.alerts.length, 0);
});

test('parent loan can be deleted after its transaction is removed', () => {
  const result = setupLock({ loans: [{ id: 'loan-1', name: 'وام خودرو', amount: 100000 }], transactions: [], action: 'حذف' });
  assert.equal(result.event.defaultPrevented, false);
});

test('pending loan with no transaction remains editable', () => {
  const result = setupLock({ loans: [{ id: 'loan-1', name: 'وام خودرو', amount: 100000 }], installments: [{ id: 'inst-1', loanId: 'loan-1', status: 'pending' }], transactions: [] });
  assert.equal(result.event.defaultPrevented, false);
});

test('transaction actions on the transactions page are not blocked by the parent-lock guard', () => {
  const result = setupLock({ loans: [{ id: 'loan-1', name: 'وام خودرو', amount: 100000 }], transactions: [{ id: 'tx-1', loanId: 'loan-1', amount: 1000 }], heading: 'تراکنش‌ها' });
  assert.equal(result.event.defaultPrevented, false);
});

test('compound correction action is removed from a compound transaction card', () => {
  const button = {
    title: 'ثبت سند اصلاحی برای این سند',
    hasAttribute: () => false,
    remove() { this.removed = true; },
    getAttribute: () => null,
  };
  const article = { id: 'tx-card-tx-1', querySelectorAll: () => [button] };
  const data = { 'hesabno:transactions': [{ id: 'tx-1', isCompound: true }] };
  const document = { body: {}, querySelectorAll: selector => selector === 'article[id^="tx-card-"]' ? [article] : [] };
  const window = { __safeGet: key => JSON.stringify(data[key] || []), requestAnimationFrame: fn => fn() };
  class MutationObserver { observe() {} }
  vm.runInNewContext(correctionScript, { window, document, localStorage: { getItem: key => window.__safeGet(key) }, MutationObserver });
  assert.equal(button.removed, true);
});
