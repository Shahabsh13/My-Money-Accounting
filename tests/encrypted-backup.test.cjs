/*
 * آزمون‌های نسخه‌ی پشتیبان رمزگذاری‌شده (مرحله ۲)
 *
 * کد تحت آزمون: app/src/main/assets/src/scripts/203-hesabno-accessibility-and-encrypted-backup.js
 * (همان مسیری که کاربر از دکمه‌ی «پشتیبان رمزگذاری‌شده» استفاده می‌کند)
 *
 * آزمون خودِ UI واقعی را کلیک می‌کند: خروجی AES-GCM/PBKDF2 با WebCrypto نود رمزگشایی
 * و با داده‌ی localStorage مقایسه می‌شود؛ و مسیر بازیابی هم از روی فایل واقعی اجرا می‌شود.
 *
 * محدودیت محیط: jsdom نه `crypto.subtle` دارد، نه `TextEncoder` و نه `Blob.text()`؛ این‌ها
 * از خود Node تزریق می‌شوند (همان الگوریتم‌ها، بدون تغییر کد برنامه).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { installSharedDomObserver } = require('./helpers/production-slices.cjs');
const { webcrypto } = require('node:crypto');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const backupScript = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/scripts/203-hesabno-accessibility-and-encrypted-backup.js'),
  'utf8'
);

const PASSPHRASE = 'passphrase-123456';
const DOWNLOAD_LABEL = 'دانلود فایل پشتیبان (JSON)';

function createHarness({ confirmResult = true } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html lang="fa" dir="rtl"><body><main><div class="overflow-y-auto">
       <button type="button">${DOWNLOAD_LABEL}</button>
     </div></main></body></html>`,
    { url: 'https://app.test/', pretendToBeVisual: true, runScripts: 'outside-only', virtualConsole: new VirtualConsole() }
  );
  const window = dom.window;

  // jsdom این‌ها را ندارد یا فقط-خواندنی است؛ با defineProperty تزریق می‌شوند.
  const inject = (name, value) => Object.defineProperty(window, name, { value, configurable: true, writable: true });
  inject('crypto', webcrypto);
  inject('TextEncoder', TextEncoder);
  inject('TextDecoder', TextDecoder);
  inject('Blob', Blob);
  inject('File', File);
  window.__hesabnoSoftReload = () => { window.__softReloads = (window.__softReloads || 0) + 1; };
  let capturedBlob = null;
  window.URL.createObjectURL = (blob) => {
    capturedBlob = blob;
    return 'blob:https://app.test/encrypted-backup';
  };
  window.URL.revokeObjectURL = () => {};
  window.confirm = () => confirmResult;

  installSharedDomObserver(window);
  window.eval(backupScript);
  return {
    window,
    document: window.document,
    getCapturedBlob: () => capturedBlob,
    resetCapturedBlob: () => { capturedBlob = null; },
  };
}

function seedData(window, data) {
  for (const [key, value] of Object.entries(data)) window.localStorage.setItem(key, value);
}

function appEntries(window) {
  const entries = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && key.indexOf('hesabno:') === 0) entries.push([key, window.localStorage.getItem(key)]);
  }
  return entries.sort((a, b) => a[0].localeCompare(b[0]));
}

function panel(window) {
  const box = window.document.getElementById('hesabno-encrypted-backup');
  assert.ok(box, 'پنل پشتیبان رمزگذاری‌شده باید روی صفحه‌ی تنظیمات ساخته شود');
  return box;
}

function statusOf(window) {
  return panel(window).querySelector('[data-hsb-status]').textContent.trim();
}

async function waitFor(predicate, message, timeoutMs = 20000) {
  const startedAt = Date.now();
  for (;;) {
    const value = predicate();
    if (value) return value;
    if (Date.now() - startedAt > timeoutMs) throw new Error(`مهلت تمام شد: ${message}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function exportBackup(harness) {
  const { window } = harness;
  panel(window).querySelector('#hsb-passphrase').value = PASSPHRASE;
  harness.resetCapturedBlob();
  panel(window).querySelector('[data-hsb-export]').click();
  const blob = await waitFor(() => harness.getCapturedBlob(), 'فایل رمزگذاری‌شده ساخته نشود');
  const text = await blob.text();
  return { envelope: JSON.parse(text), blobSize: text.length };
}

async function importBackup(harness, fileContent, passphrase = PASSPHRASE) {
  const { window } = harness;
  panel(window).querySelector('#hsb-passphrase').value = passphrase;
  const input = panel(window).querySelector('[data-hsb-file]');
  const file = new File([fileContent], 'encrypted-backup.json', { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true, writable: true });
  const previousStatus = statusOf(window);
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => statusOf(window) !== previousStatus || window.__softReloads, 'پاسخ بازیابی دریافت نشود');
  return statusOf(window);
}

function fromBase64(value) {
  return new Uint8Array(Buffer.from(value, 'base64'));
}

async function decryptEnvelope(envelope, passphrase) {
  const material = await webcrypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  const key = await webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromBase64(envelope.kdf.salt), iterations: envelope.kdf.iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const plaintext = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(envelope.cipher.iv) }, key, fromBase64(envelope.ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

test('encrypted export produces a valid envelope that decrypts to every stored key', async () => {
  const harness = createHarness();
  seedData(harness.window, {
    'hesabno:transactions': '[{"id":1,"amount":1450000},{"id":2,"amount":900000}]',
    'hesabno:accounts_v5': '[{"id":1,"name":"بانک ملت"}]',
    'hesabno:currency': 'toman',
    'other-app-key': 'ignored',
  });

  const { envelope } = await exportBackup(harness);

  assert.equal(envelope.format, 'hesabno-encrypted-backup');
  assert.equal(envelope.version, 1);
  assert.equal(envelope.kdf.name, 'PBKDF2');
  assert.equal(envelope.kdf.hash, 'SHA-256');
  assert.equal(envelope.kdf.iterations, 310000);
  assert.equal(envelope.cipher.name, 'AES-GCM');

  const snapshot = await decryptEnvelope(envelope, PASSPHRASE);
  assert.equal(snapshot.version, 1);
  assert.deepEqual(snapshot.entries.sort((a, b) => a[0].localeCompare(b[0])), appEntries(harness.window));
  assert.equal(snapshot.entries.some(([key]) => key === 'other-app-key'), false, 'کلید بیگانه نباید داخل پشتیبان برود');
  assert.match(statusOf(harness.window), /دانلود شد/);
});

test('each encrypted export uses a fresh salt and iv', async () => {
  const harness = createHarness();
  seedData(harness.window, { 'hesabno:transactions': '[]' });

  const first = (await exportBackup(harness)).envelope;
  await new Promise((resolve) => setTimeout(resolve, 20));
  const second = (await exportBackup(harness)).envelope;

  assert.notEqual(first.kdf.salt, second.kdf.salt, 'نمک باید در هر خروجی تازه باشد');
  assert.notEqual(first.cipher.iv, second.cipher.iv, 'بردار اولیه باید تازه باشد');
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test('export refuses to create an empty backup and tells the user', async () => {
  const harness = createHarness();
  await exportBackup(harness).then(
    () => { throw new Error('خروجی خالی نباید ساخته شود'); },
    (error) => assert.match(error.message, /مهلت تمام شد/)
  );
  assert.match(statusOf(harness.window), /داده‌ای برای پشتیبان‌گیری پیدا نشد/);
});

test('restoring an encrypted backup replaces application data with the file contents', async () => {
  const source = createHarness();
  seedData(source.window, {
    'hesabno:transactions': '[{"id":7,"amount":50000}]',
    'hesabno:loans': '[{"id":"loan-9","amount":100000}]',
    'hesabno:currency': 'toman',
  });
  const { envelope } = await exportBackup(source);
  const fileContent = JSON.stringify(envelope);

  const target = createHarness();
  seedData(target.window, {
    'hesabno:transactions': '[{"id":1,"amount":1}]',
    'hesabno:loans': '[]',
    'hesabno:currency': 'rial',
    'hesabno:theme': 'dark',
  });

  const message = await importBackup(target, fileContent);

  assert.match(message, /بازیابی کامل شد/);
  assert.deepEqual(appEntries(target.window), appEntriesWith(source.window));
  assert.equal(target.window.localStorage.getItem('hesabno:theme'), null, 'داده‌ی قبلی جایگزین می‌شود');
  await waitFor(() => target.window.__softReloads === 1, 'برنامه باید برای بارگذاری داده‌ها تازه‌سازی شود');
});

function appEntriesWith(window) {
  return appEntries(window).slice();
}

test('a wrong passphrase leaves all current data untouched', async () => {
  const source = createHarness();
  seedData(source.window, { 'hesabno:transactions': '[{"id":7}]' });
  const { envelope } = await exportBackup(source);

  const target = createHarness();
  seedData(target.window, { 'hesabno:transactions': '[{"id":1,"keep":true}]' });
  const before = appEntries(target.window);

  const message = await importBackup(target, JSON.stringify(envelope), 'another-passphrase-1');

  assert.match(message, /بازیابی ناموفق بود/);
  assert.deepEqual(appEntries(target.window), before, 'داده‌ها نباید تغییر کنند');
});

test('a tampered envelope is rejected before any write', async () => {
  const source = createHarness();
  seedData(source.window, { 'hesabno:transactions': '[{"id":7}]' });
  const { envelope } = await exportBackup(source);
  const tampered = { ...envelope, kdf: { ...envelope.kdf, iterations: 1000 } };

  const target = createHarness();
  seedData(target.window, { 'hesabno:transactions': '[{"id":1,"keep":true}]' });
  const before = appEntries(target.window);

  const message = await importBackup(target, JSON.stringify(tampered));

  assert.match(message, /بازیابی ناموفق بود/);
  assert.deepEqual(appEntries(target.window), before);
});

test('cancelling the restore confirmation keeps the current data', async () => {
  const source = createHarness();
  seedData(source.window, { 'hesabno:transactions': '[{"id":7}]' });
  const { envelope } = await exportBackup(source);

  const target = createHarness({ confirmResult: false });
  seedData(target.window, { 'hesabno:transactions': '[{"id":1,"keep":true}]' });
  const before = appEntries(target.window);

  const message = await importBackup(target, JSON.stringify(envelope));

  assert.match(message, /بازیابی لغو شد/);
  assert.deepEqual(appEntries(target.window), before);
  assert.equal(target.window.__softReloads, undefined, 'لغو نباید برنامه را تازه‌سازی کند');
});

test('an oversized backup file is refused without being read', async () => {
  const harness = createHarness();
  seedData(harness.window, { 'hesabno:transactions': '[{"id":1}]' });
  const before = appEntries(harness.window);

  let readAttempted = false;
  const input = panel(harness.window).querySelector('[data-hsb-file]');
  Object.defineProperty(input, 'files', {
    value: [{ size: 31 * 1024 * 1024, text: async () => { readAttempted = true; return '{}'; } }],
    configurable: true,
  });
  input.dispatchEvent(new harness.window.Event('change', { bubbles: true }));
  await waitFor(() => /۳۰ مگابایت/.test(statusOf(harness.window)), 'هشدار حجم فایل نمایش داده نشود');

  assert.equal(readAttempted, false, 'فایل بزرگ نباید خوانده شود');
  assert.deepEqual(appEntries(harness.window), before);
});
