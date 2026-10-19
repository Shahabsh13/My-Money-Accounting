/*
 * آزمون قرارداد همگام‌سازی (مرحله ۹)
 *
 * چه چیزی را قفل می‌کند:
 *   ۱) رفت‌وبرگشت کامل: داده → سند → JSON → داده، بدون تغییر یک فیلد یا ترتیب.
 *   ۲) تعیّن: ترتیب کلیدهای شیء در ورودی، خروجی را عوض نمی‌کند (سند بایت‌به‌بایت یکسان).
 *   ۳) ادغام سه‌طرفه: تغییر یک‌طرفه، تغییر یکسان دو طرف، افزودن/حذف، و تعارض واقعی.
 *   ۴) هیچ ویرایشی بی‌صدا از بین نمی‌رود: سیاست پیش‌فرض تعارض را گزارش می‌کند و مقدار محلی را
 *      نگه می‌دارد؛ سیاست‌های صریح prefer-local/prefer-remote هم آزموده می‌شوند.
 *   ۵) پایداری: ادغام دوباره روی نتیجه، تغییر یا تعارض تازه نمی‌سازد (idempotent).
 *   ۶) صفر تغییر در قالب محلی و صفر کلید ذخیره‌سازی تازه؛ ماژول در بوت بارگذاری نمی‌شود.
 *   ۷) مقیاس: ۱۰ هزار سند بدون افت غیرمنطقی و با نتیجه‌ی دقیقاً درست.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sync = require('../app/src/main/assets/src/domain/sync.js');
const registry = require('../app/src/main/assets/src/storage/keys.js');
const { makeAccounts, makeTransactions, makeInstallments } = require('./helpers/reporting-corpus.cjs');

const root = path.resolve(__dirname, '..');

function model(overrides = {}) {
  return {
    accounts: [
      { id: 2, name: 'بانک ملت', group: 'bank', active: true, initialBalance: 5000000 },
      { id: 1, name: 'صندوق', group: 'cash', active: true, initialBalance: 200000 },
      { id: 3, name: 'علی رضایی', group: 'person', active: true },
    ],
    transactions: [
      { id: 't-1', date: '1405/06/01', type: 'income', account: 'بانک ملت', category: 'فروش', amount: 1200000 },
      { id: 't-2', date: '1405/06/02', type: 'expense', account: 'بانک ملت', category: 'اجاره', amount: 400000, check: { status: 'cleared' } },
    ],
    checks: [{ id: 'c-1', amount: 900000, dueDate: '1405/07/01', status: 'in_progress' }],
    loans: [{ id: 'l-1', title: 'وام خودرو', amount: 100000000 }],
    installments: [{ id: 'i-1', loanId: 'l-1', amount: 3000000, status: 'pending' }],
    budgets: [{ id: 'b-1', category: 'خرید روزانه', amount: 5000000 }],
    fiscalYears: [{ id: 'fy-1', title: '1405', startDate: '1405/01/01', endDate: '1405/12/29' }],
    shortcuts: [{ id: 's-1', label: 'ثبت سریع' }],
    projects: [{ id: 'p-1', name: 'پروژه الف' }],
    familyMembers: [{ id: 'f-1', name: 'مریم' }],
    ...overrides,
  };
}

function documentOf(input, options) {
  const built = sync.buildDocument(input, options);
  assert.equal(built.ok, true, JSON.stringify(built.errors));
  return built.document;
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

test('round-trip preserves every field and the array order', () => {
  const source = model();
  const document = documentOf(source);
  const serialized = JSON.stringify(document);

  /* از مسیر واقعی متن، همان چیزی که روی شبکه/دیسک می‌رود */
  const parsed = sync.parseDocument(serialized);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.errors));
  const restored = sync.toCollections(parsed.document);

  assert.deepEqual(restored.accounts, source.accounts);
  assert.deepEqual(restored.transactions, source.transactions);
  assert.deepEqual(restored.checks, source.checks);
  assert.deepEqual(restored.loans, source.loans);
  assert.deepEqual(restored.installments, source.installments);
  assert.deepEqual(restored.budgets, source.budgets);
  assert.deepEqual(restored.fiscalYears, source.fiscalYears);
  assert.deepEqual(restored.shortcuts, source.shortcuts);
  assert.deepEqual(restored.projects, source.projects);
  assert.deepEqual(restored.familyMembers, source.familyMembers);
  assert.equal(parsed.fingerprint, sync.fingerprint(document));
});

test('the document is deterministic regardless of object key insertion order', () => {
  const first = documentOf(model());
  const shuffled = model({
    accounts: [
      { group: 'bank', initialBalance: 5000000, active: true, name: 'بانک ملت', id: 2 },
      { active: true, id: 1, name: 'صندوق', initialBalance: 200000, group: 'cash' },
      { name: 'علی رضایی', group: 'person', active: true, id: 3 },
    ],
  });
  const second = documentOf(shuffled);
  assert.equal(JSON.stringify(first), JSON.stringify(second), 'داده‌ی یکسان باید سند یکسان بدهد');
  assert.equal(sync.fingerprint(first), sync.fingerprint(second));
});

test('buildDocument rejects duplicate ids and non-object entities with clear errors', () => {
  const duplicate = sync.buildDocument({ accounts: [{ id: 1, name: 'الف' }, { id: '1', name: 'ب' }] });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.errors.some((error) => error.code === 'duplicate-id'), true,
    'شناسه‌ی عددی ۱ و رشته‌ای «1» نباید دو موجودیت شوند');

  const broken = sync.buildDocument({ accounts: [{ id: 1 }, 'not-an-object'] });
  assert.equal(broken.ok, false);
  assert.equal(broken.errors[0].code, 'entity-shape');

  const tombstoneConflict = sync.buildDocument({ accounts: [{ id: 1 }] }, { deletions: { accounts: [1] } });
  assert.equal(tombstoneConflict.ok, false, 'موجودیت نمی‌تواند هم حاضر و هم حذف‌شده باشد');
});

test('parseDocument rejects corrupt documents instead of trusting them', () => {
  assert.equal(sync.parseDocument('{').ok, false);
  assert.equal(sync.parseDocument({}).ok, false);
  assert.equal(sync.parseDocument({ format: 'other', version: 1, collections: {} }).ok, false);
  assert.equal(sync.parseDocument({ format: 'hesabno-sync', version: 2, collections: {} }).ok, false);

  const valid = documentOf(model());
  const unordered = clone(valid);
  delete unordered.collections.accounts.entities['1'];
  assert.equal(sync.parseDocument(unordered).ok, false, 'موجودیتِ ترتیب‌شده‌ی غایب باید رد شود');

  const orphan = clone(valid);
  orphan.collections.accounts.entities['99'] = { id: 99 };
  assert.equal(sync.parseDocument(orphan).ok, false, 'موجودیت بی‌ترتیب باید رد شود');
});

test('merge applies one-sided changes from either side', () => {
  const base = documentOf(model());

  const localModel = model();
  localModel.transactions[0].amount = 1500000;
  const local = documentOf(localModel);

  const remoteModel = model();
  remoteModel.checks[0].status = 'cleared';
  remoteModel.budgets.push({ id: 'b-2', category: 'حمل‌ونقل', amount: 900000 });
  const remote = documentOf(remoteModel);

  const result = sync.merge(base, local, remote);
  assert.equal(result.ok, true);
  assert.equal(result.conflicts.length, 0, 'تغییر یک‌طرفه تعارض نیست');

  const merged = sync.toCollections(result.document);
  assert.equal(merged.transactions[0].amount, 1500000, 'تغییر محلی');
  assert.equal(merged.checks[0].status, 'cleared', 'تغییر مقابل');
  assert.equal(merged.budgets.length, 2, 'افزوده‌ی مقابل');
  assert.equal(result.stats.updated >= 2, true);
  assert.equal(result.stats.unchanged > 0, true);
});

test('identical changes on both sides produce no conflict', () => {
  const base = documentOf(model());
  const changed = model();
  changed.transactions[1].amount = 450000;
  const local = documentOf(changed);
  const remote = documentOf(changed);

  const result = sync.merge(base, local, remote);
  assert.equal(result.conflicts.length, 0);
  const merged = sync.toCollections(result.document);
  assert.equal(merged.transactions[1].amount, 450000);
});

test('deletion propagates when only one side deletes', () => {
  const base = documentOf(model());

  const localModel = model({ checks: [] });
  const local = documentOf(localModel, { deletions: { checks: ['c-1'] } });
  const remote = documentOf(model());

  const result = sync.merge(base, local, remote);
  assert.equal(result.conflicts.length, 0);
  assert.deepEqual(sync.toCollections(result.document).checks, []);
  assert.equal(result.stats.removed, 1);
});

test('a real conflict is reported, kept in local form, and never silently lost', () => {
  const base = documentOf(model());

  const localModel = model();
  localModel.transactions[0].amount = 1111111;
  const local = documentOf(localModel);

  const remoteModel = model();
  remoteModel.transactions[0].amount = 2222222;
  const remote = documentOf(remoteModel);

  const result = sync.merge(base, local, remote);
  assert.equal(result.conflicts.length, 1);
  const conflict = result.conflicts[0];
  assert.equal(conflict.collection, 'transactions');
  assert.equal(conflict.id, 't-1');
  assert.equal(conflict.kind, 'edit-edit');
  assert.equal(conflict.base.amount, 1200000);
  assert.equal(conflict.local.amount, 1111111);
  assert.equal(conflict.remote.amount, 2222222);
  assert.equal(sync.toCollections(result.document).transactions[0].amount, 1111111,
    'سیاست پیش‌فرض باید داده‌ی محلی را نگه دارد تا بازیابی ممکن باشد');
  assert.equal(result.stats.conflicts, 1);

  /* سیاست صریح سمت مقابل */
  const remoteWins = sync.merge(base, local, remote, { conflictPolicy: 'prefer-remote' });
  assert.equal(remoteWins.conflicts.length, 1, 'تعارض باید حتی با سیاست صریح هم گزارش شود');
  assert.equal(sync.toCollections(remoteWins.document).transactions[0].amount, 2222222);

  const localWins = sync.merge(base, local, remote, { conflictPolicy: 'prefer-local' });
  assert.equal(sync.toCollections(localWins.document).transactions[0].amount, 1111111);
});

test('delete-versus-edit is a conflict, not a silent disappearance', () => {
  const base = documentOf(model());

  const local = documentOf(model({ loans: [] }), { deletions: { loans: ['l-1'] } });

  const remoteModel = model();
  remoteModel.loans[0].amount = 120000000;
  const remote = documentOf(remoteModel);

  const result = sync.merge(base, local, remote);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].kind, 'delete-edit');
  /* پیش‌فرض: حذف محلی اجرا می‌شود اما تعارض گزارش شده است (کاربر تصمیم می‌گیرد) */
  assert.deepEqual(sync.toCollections(result.document).loans, []);

  const remoteWins = sync.merge(base, local, remote, { conflictPolicy: 'prefer-remote' });
  assert.equal(sync.toCollections(remoteWins.document).loans[0].amount, 120000000,
    'سیاست صریح باید بتواند ویرایش را نجات دهد');
});

test('merging is idempotent and does not mutate its inputs', () => {
  const baseModel = model();
  const localModel = model();
  localModel.budgets.push({ id: 'b-2', amount: 1 });
  const remoteModel = model();
  remoteModel.checks[0].status = 'cleared';

  const base = documentOf(baseModel);
  const local = documentOf(localModel);
  const remote = documentOf(remoteModel);
  const snapshot = [JSON.stringify(base), JSON.stringify(local), JSON.stringify(remote)];

  const first = sync.merge(base, local, remote);
  const second = sync.merge(base, first.document, remote);
  assert.equal(JSON.stringify(first.document), JSON.stringify(second.document), 'ادغام دوباره نباید چیزی عوض کند');
  assert.equal(second.conflicts.length, 0);
  assert.deepEqual([JSON.stringify(base), JSON.stringify(local), JSON.stringify(remote)], snapshot,
    'ورودی‌های ادغام نباید تغییر کنند');
});

test('conflicts are ordered deterministically', () => {
  const baseModel = model();
  const localModel = model();
  localModel.accounts[0].name = 'محلی';
  localModel.transactions[0].amount = 1;
  const remoteModel = model();
  remoteModel.accounts[0].name = 'دور';
  remoteModel.transactions[0].amount = 2;

  const base = documentOf(baseModel);
  const local = documentOf(localModel);
  const remote = documentOf(remoteModel);

  const first = sync.merge(base, local, remote);
  const second = sync.merge(base, remote, local);
  assert.deepEqual(
    first.conflicts.map((conflict) => `${conflict.collection}/${conflict.id}`),
    ['accounts/2', 'transactions/t-1'],
    'ترتیب تعارض‌ها باید الفبایی و پایدار باشد'
  );
  assert.deepEqual(
    second.conflicts.map((conflict) => `${conflict.collection}/${conflict.id}`),
    first.conflicts.map((conflict) => `${conflict.collection}/${conflict.id}`)
  );
});

test('records without ids get a stable content-derived id and stay unchanged', () => {
  const source = { accounts: [{ name: 'بدون شناسه', group: 'cash' }] };
  const first = documentOf(source);
  const second = documentOf(source);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  const id = first.collections.accounts.order[0];
  assert.equal(id.startsWith('~'), true, 'شناسه‌ی مشتق‌شده باید نشانه داشته باشد');
  assert.deepEqual(sync.toCollections(first).accounts, source.accounts,
    'شناسه‌ی مشتق‌شده نباید وارد داده شود');
});

test('merge scales to 10k transactions with exact results', () => {
  const accounts = makeAccounts();
  const transactions = makeTransactions(10000, 55);
  const installments = makeInstallments(3);
  const baseModel = { accounts, transactions, installments };
  const localModel = clone(baseModel);
  /* ۵۰ ویرایش محلی روی اسناد ۰..۴۹ */
  for (let index = 0; index < 50; index += 1) localModel.transactions[index].amount += 1;
  const remoteModel = clone(baseModel);
  /* ۵۰ ویرایش مقابل روی اسناد ۵۰۰۰..۵۰۴۹ (بدون هم‌پوشانی) + ۲۰ افزوده */
  for (let index = 0; index < 50; index += 1) remoteModel.transactions[5000 + index].amount += 2;
  for (let index = 0; index < 20; index += 1) {
    remoteModel.transactions.push({ id: 'new-' + index, date: '1405/09/01', type: 'expense', amount: 1000 + index });
  }

  const started = process.hrtime.bigint();
  const base = documentOf(baseModel);
  const local = documentOf(localModel);
  const remote = documentOf(remoteModel);
  const result = sync.merge(base, local, remote);
  const elapsed = Number(process.hrtime.bigint() - started) / 1e6;

  assert.equal(result.ok, true);
  assert.equal(result.conflicts.length, 0, 'مجموعه‌های ویرایش عمداً جدا انتخاب شده‌اند');
  const merged = sync.toCollections(result.document);
  assert.equal(merged.transactions.length, 10000 + 20);
  assert.equal(merged.transactions[0].amount, localModel.transactions[0].amount);
  assert.equal(merged.transactions[5000].amount, remoteModel.transactions[5000].amount);
  assert.equal(merged.transactions[100].amount, baseModel.transactions[100].amount, 'سند دست‌نخورده');
  assert.ok(elapsed < 20000, `ادغام ۱۰k سند بیش از حد کند است: ${elapsed.toFixed(0)}ms`);
});

test('sync readiness adds no storage keys and is not loaded at boot', () => {
  const indexHtml = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
  assert.equal(/src\/domain\/sync\.js/.test(indexHtml), false, 'ماژول همگام‌سازی نباید در بوت بارگذاری شود');
  const source = fs.readFileSync(path.join(root, 'app/src/main/assets/src/domain/sync.js'), 'utf8');
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['localStorage', 'sessionStorage', 'fetch(', 'XMLHttpRequest', 'window.', 'globalThis.document']) {
    assert.equal(stripped.includes(forbidden), false, `ماژول نباید به ${forbidden} وابسته باشد`);
  }
  /* دسترسی به DOM: فقط فراخوانی واقعی ممنوع است؛ «document» این‌جا نام متغیر محلی سند است */
  for (const domCall of ['document.createElement', 'document.querySelector', 'document.getElementById']) {
    assert.equal(stripped.includes(domCall), false, `ماژول نباید DOM را صدا بزند: ${domCall}`);
  }
  assert.equal(registry.storageKeys().some((entry) => /sync/i.test(entry.key)), false,
    'هیچ کلید ذخیره‌سازی برای همگام‌سازی ساخته نشده است');
});
