const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/scripts/000-default-accounts.js'),
  'utf8',
);

function runMigration({ accounts, records = {}, migrationFlag }) {
  const values = new Map([
    ['hesabno:accounts_v5', JSON.stringify(accounts)],
    ...Object.entries(records).map(([key, value]) => [key, JSON.stringify(value)]),
  ]);
  if (migrationFlag !== undefined) values.set('hesabno:default_accounts_v2', String(migrationFlag));
  const writes = [];
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      writes.push([key, String(value)]);
      values.set(key, String(value));
    },
  };
  const window = {};
  vm.runInNewContext(source, { window, localStorage, console });
  return {
    accounts: JSON.parse(values.get('hesabno:accounts_v5')),
    migrationFlag: values.get('hesabno:default_accounts_v2') ?? null,
    writes,
  };
}

function migrate(options) {
  return runMigration(options).accounts;
}

test('migration preserves a used bank account when transactions store its name rather than its id', () => {
  const bank = {
    id: 'bank-7f3a', name: 'بانک ملت', bankName: 'ملت', group: 'bank',
    code: '12001', active: true, system: true,
  };
  const accounts = migrate({
    accounts: [bank],
    records: {
      'hesabno:transactions': [{ id: 'tx-1', account: bank.name }],
    },
  });

  assert.deepEqual(accounts, [bank], 'حساب بانکیِ استفاده‌شده نباید به‌علت تفاوت id و نام حذف شود');
});

test('migration preserves a used bank referenced by bankName', () => {
  const bank = { id: 'bank-name-ref', name: 'بانک تجارت', bankName: 'تجارت', group: 'bank', active: true };
  const accounts = migrate({
    accounts: [bank],
    records: { 'hesabno:transactions': [{ id: 'tx-bank-name', bankName: bank.bankName }] },
  });

  assert.deepEqual(accounts, [bank]);
});

test('migration preserves a used bank referenced by account code', () => {
  const bank = { id: 'bank-code-ref', name: 'بانک سامان', group: 'bank', code: 'BANK-77', active: true };
  const accounts = migrate({
    accounts: [bank],
    records: { 'hesabno:installments': [{ id: 'inst-code', paidFromAccount: bank.code }] },
  });

  assert.deepEqual(accounts, [bank]);
});

test('legacy cleanup removes a bank that has no account references', () => {
  const unusedBank = { id: 'bank-unused', name: 'بانک بدون تراکنش', group: 'bank', active: true };
  const accounts = migrate({ accounts: [unusedBank] });

  assert.equal(accounts.some((account) => account.id === unusedBank.id), false,
    'حساب بانکیِ واقعاً بلااستفاده باید حذف شود');
});

test('migration preserves the locked default cash account', () => {
  const defaultCash = { id: 201, name: 'صندوق اصلی', group: 'cash', code: '11001', active: true };
  const accounts = migrate({ accounts: [defaultCash] });

  assert.ok(accounts.some((account) => account.id === defaultCash.id),
    'صندوق پیش‌فرض باید پس از پاک‌سازی باقی بماند');
  assert.equal(accounts.find((account) => account.id === defaultCash.id).locked, true,
    'صندوق پیش‌فرض باید همچنان قفل‌شده باشد');
});

test('migration continues to recognize references stored by account id', () => {
  const bank = { id: 'bank-id', name: 'بانک صادرات', group: 'bank', active: true };
  const accounts = migrate({
    accounts: [bank],
    records: {
      'hesabno:checks': [{ id: 'check-1', bankAccountId: bank.id }],
    },
  });

  assert.deepEqual(accounts, [bank]);
});

test('migration preserves accounts referenced inside nested objects and arrays', () => {
  const nestedBank = { id: 'bank-nested', name: 'بانک ملی', group: 'bank', active: true };
  const arrayBank = { id: 'bank-array', name: 'بانک پاسارگاد', bankName: 'پاسارگاد', group: 'bank', active: true };
  const accounts = migrate({
    accounts: [nestedBank, arrayBank],
    records: {
      'hesabno:transactions': [{ envelope: { details: { account: { id: nestedBank.id } } } }],
      'hesabno:checks': [{ paymentSources: [{ bankName: arrayBank.bankName }] }],
    },
  });

  assert.deepEqual(accounts, [nestedBank, arrayBank],
    'ارجاع در شیء تودرتو یا آرایه نباید باعث حذف حساب شود');
});

test('similar but unequal names and codes are not exact account references', () => {
  const nameBank = { id: 'name-near-id', name: 'بانک نمونه', bankName: 'نمونه', code: 'NAME-REF', group: 'bank' };
  const codeBank = { id: 'code-near-id', name: 'بانک کد', bankName: 'کد نمونه', code: 'C-123', group: 'bank' };
  const accounts = migrate({
    accounts: [nameBank, codeBank],
    records: {
      'hesabno:transactions': [{ account: 'بانک نمونه جدید', bankAccountCode: 'C-1234' }],
    },
  });

  assert.deepEqual(accounts, [], 'تطبیق باید دقیق باشد؛ پیشوند مشترک یا نام نزدیک کافی نیست');
});

test('characterizes retention when one bank id equals another bank name or code', () => {
  const idEqualsName = { id: 'COLLIDE-NAME', name: 'بانک جانبی نام', group: 'bank' };
  const referencedByName = { id: 'target-name', name: 'COLLIDE-NAME', group: 'bank' };
  const idEqualsCode = { id: 'COLLIDE-CODE', name: 'بانک جانبی کد', group: 'bank' };
  const referencedByCode = { id: 'target-code', name: 'بانک هدف کد', code: 'COLLIDE-CODE', group: 'bank' };
  const accounts = migrate({
    accounts: [idEqualsName, referencedByName, idEqualsCode, referencedByCode],
    records: {
      'hesabno:transactions': [{ account: referencedByName.name }],
      'hesabno:installments': [{ paidFromAccount: referencedByCode.code }],
    },
  });

  assert.deepEqual(accounts, [idEqualsName, referencedByName, idEqualsCode, referencedByCode],
    'تطبیق فعلی همهٔ شناسه‌ها را با همهٔ مقادیر ارجاع مقایسه می‌کند و حساب برخوردی را نیز نگه می‌دارد');
});

test('recognizes nested name, bankName and code references', () => {
  const nameBank = { id: 'nested-name-id', name: 'بانک شرح', group: 'bank' };
  const bankNameBank = { id: 'nested-bankname-id', bankName: 'بانک مقصد', name: 'حساب مقصد', group: 'bank' };
  const codeBank = { id: 'nested-code-id', code: 'NESTED-55', name: 'بانک کد تودرتو', group: 'bank' };
  const accounts = migrate({
    accounts: [nameBank, bankNameBank, codeBank],
    records: {
      'hesabno:transactions': [{ envelope: { details: { account: { name: nameBank.name } } } }],
      'hesabno:checks': [{ attachments: [{ bank: { bankName: bankNameBank.bankName } }] }],
      'hesabno:budgets': [{ entries: [{ details: { bankAccountCode: codeBank.code } }] }],
    },
  });

  assert.deepEqual(accounts, [nameBank, bankNameBank, codeBank]);
});

test('recognizes real references in loans, recurring rules and budgets', () => {
  const loanBank = { id: 'loan-bank-id', name: 'بانک وام', group: 'bank' };
  const recurringBank = { id: 'recurring-bank-id', name: 'بانک تکرارشونده', group: 'bank' };
  const budgetBank = { id: 'budget-bank-id', name: 'بانک بودجه', code: 'BUDGET-90', group: 'bank' };
  const accounts = migrate({
    accounts: [loanBank, recurringBank, budgetBank],
    records: {
      'hesabno:loans': [{ payoutAccountId: loanBank.id }],
      'hesabno:recurring_rules': [{ account: recurringBank.name }],
      'hesabno:budgets': [{ bankAccountCode: budgetBank.code }],
    },
  });

  assert.deepEqual(accounts, [loanBank, recurringBank, budgetBank]);
});

test('an existing migration flag of 1 skips cleanup and remains unchanged', () => {
  const unusedBank = { id: 'flagged-unused-bank', name: 'بانک قدیمی', group: 'bank' };
  const result = runMigration({ accounts: [unusedBank], migrationFlag: '1' });

  assert.deepEqual(result.accounts, [unusedBank],
    'با flag فعال، مهاجرت فعلی اجرا نمی‌شود و بانکِ بی‌ارجاع حذف نمی‌شود');
  assert.equal(result.migrationFlag, '1', 'تست نباید flag موجود را پاک یا تغییر دهد');
  assert.deepEqual(result.writes, [], 'مهاجرت نباید در حالت flag=1 چیزی را بازنویسی کند');
});
