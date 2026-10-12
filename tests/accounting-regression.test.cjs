const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const bundle = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/067-inline.js'), 'utf8');

function loadProductionFunction(name, endMarker, globals = {}) {
  const marker = `${name}=`;
  const start = bundle.indexOf(marker);
  assert.notEqual(start, -1, `production function ${name} exists`);
  const end = bundle.indexOf(endMarker, start + marker.length);
  assert.notEqual(end, -1, `end marker for ${name} exists`);
  const expression = bundle.slice(start + marker.length, end);
  const context = {
    gl: () => ({ descendantsById: new Map(), descendantsByNameLower: new Map() }),
    k0: (name, accounts) => {
      const found = (accounts || []).find(a => String(a.name || '').trim().toLowerCase() === String(name || '').trim().toLowerCase());
      return found && found.group;
    },
    ch: (name, accounts) => (accounts || []).some(a => String(a.name || '').trim().toLowerCase() === String(name || '').trim().toLowerCase()),
    ...globals,
  };
  vm.runInNewContext(`globalThis.__tested = (${expression});`, context);
  return context.__tested;
}

const accountBalance = loadProductionFunction('Nr', ',v9=');
const reportTotals = loadProductionFunction('Cs', ',Nr=');

function equalFields(actual, expected) {
  for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, key);
}

test('bank balance reconciles opening balance, income, expense and transfer', () => {
  const bank = { id: 'bank', name: 'Main Bank', group: 'bank', initialBalance: 1000 };
  const cash = { id: 'cash', name: 'Cash', group: 'cash', initialBalance: 200 };
  const accounts = [bank, cash];
  const transactions = [
    { id: 'i1', type: 'income', account: 'Main Bank', amount: 500 },
    { id: 'e1', type: 'expense', account: 'Main Bank', amount: 120 },
    { id: 't1', type: 'transfer', account: 'Main Bank', destinationAccount: 'Cash', amount: 50 },
  ];
  const bankResult = accountBalance(bank, accounts, transactions);
  const cashResult = accountBalance(cash, accounts, transactions);
  equalFields(bankResult, { balance: 1330, initialBalance: 1000, totalDebits: 500, totalCredits: 170, transactionCount: 3, entriesCount: 3 });
  equalFields(cashResult, { balance: 250, initialBalance: 200, totalDebits: 50, totalCredits: 0, transactionCount: 1, entriesCount: 1 });
  assert.equal(bankResult.balance + cashResult.balance, 1580, 'transfers conserve total liquid funds');
});

test('balanced compound document moves value between accounts without changing combined balance', () => {
  const bank = { id: 'bank', name: 'Main Bank', group: 'bank', initialBalance: 1000 };
  const cash = { id: 'cash', name: 'Cash', group: 'cash', initialBalance: 200 };
  const tx = { id: 'c1', isCompound: true, compoundSources: [{ account: 'Main Bank', amount: 275 }], compoundDestinations: [{ account: 'Cash', amount: 275 }] };
  const a = accountBalance(bank, [bank, cash], [tx]);
  const b = accountBalance(cash, [bank, cash], [tx]);
  assert.equal(a.balance, 725);
  assert.equal(b.balance, 475);
  assert.equal(a.balance + b.balance, 1200);
  assert.equal(a.totalCredits, b.totalDebits);
});

test('integer Rial amounts retain exact precision for large values', () => {
  const bank = { id: 'bank', name: 'Main Bank', group: 'bank', initialBalance: 900719925474000 };
  const result = accountBalance(bank, [bank], [
    { id: 'i1', type: 'income', account: 'Main Bank', amount: 123456789 },
    { id: 'e1', type: 'expense', account: 'Main Bank', amount: 12345678 },
  ]);
  assert.equal(result.balance, 900720036585111);
  assert.equal(Number.isInteger(result.balance), true);
});

test('profit/loss report totals classify ordinary income and expense', () => {
  const accounts = [
    { id: 'sales', name: 'Sales', group: 'income' },
    { id: 'office', name: 'Office costs', group: 'expense' },
  ];
  const income = reportTotals({ type: 'income', category: 'Sales', amount: 12000 }, accounts);
  const expense = reportTotals({ type: 'expense', category: 'Office costs', amount: 4500 }, accounts);
  equalFields(income, { income: 12000, expense: 0, fee: 0 });
  equalFields(expense, { income: 0, expense: 4500, fee: 0 });
});

test('compound expense report uses expense destination legs only', () => {
  const accounts = [
    { id: 'bank', name: 'Main Bank', group: 'bank' },
    { id: 'office', name: 'Office costs', group: 'expense' },
  ];
  const totals = reportTotals({
    id: 'compound-expense', type: 'expense', isCompound: true,
    compoundSources: [{ account: 'Main Bank', amount: 3000 }],
    compoundDestinations: [{ account: 'Office costs', amount: 3000 }],
  }, accounts);
  equalFields(totals, { income: 0, expense: 3000, fee: 0 });
});

test('production transaction form rejects zero and negative transaction amounts', () => {
  assert.match(bundle, /ft<=0&&Ve\.push/);
  assert.match(bundle, /compoundSourceAmountZero/);
  assert.match(bundle, /compoundDestAmountZero/);
});
