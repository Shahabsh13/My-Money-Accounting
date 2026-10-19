/*
 * آزمون رجیستری کلیدهای ذخیره‌سازی (مرحله ۶.۱)
 *
 * چه چیزی را قفل می‌کند:
 *   ۱) هر رشته‌ی «hesabno:» در کد، مدخل متناظر در رجیستری دارد (هیچ کلید ناشناخته‌ای اضافه نمی‌شود).
 *   ۲) هیچ مدخل مرده‌ای در رجیستری نیست (کلیدی که دیگر استفاده نمی‌شود).
 *   ۳) نوع دسترسی (local/session/event) در رجیستری با کد یکی است — از جمله کلیدهای مشتق‌شده مثل
 *      «lastTabIdx» که با `KEY + 'Idx'` ساخته می‌شوند و پیش از این مرحله هیچ‌جا ثبت نشده بودند.
 *   ۴) نوع داده (json/raw) با رفتار واقعی برنامه در بوت هم‌خوان است (آزمون پویا روی Storage واقعی).
 *   ۵) پوشش پشتیبان‌گیری: هر کلید «داده‌ی کاربر» که در فهرست پشتیبان ریست (۱۰۸) نیست، باید در
 *      فهرست استثناهای مستند باشد؛ کلید داده‌ی تازه بدون پشتیبان ⇒ شکست آزمون.
 *   ۶) فهرست پشتیبان ۱۰۸ دقیقاً همان چیزی است که رجیستری می‌گوید (نه کمتر، نه بیشتر).
 *   ۷) رجیستری خالص است و در index.html بارگذاری نمی‌شود (صفر بایت بوت).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const registry = require('../app/src/main/assets/src/storage/keys.js');
const SCRIPTS = path.join(root, 'app/src/main/assets/src/scripts');

function runInventory() {
  const output = execFileSync(process.execPath, [path.join(root, 'tools/storage/key-inventory.cjs')], {
    encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024,
  });
  return JSON.parse(output.slice(output.indexOf('{')));
}

let inventory = null;
function data() { if (!inventory) inventory = runInventory(); return inventory; }

/*
 * کلیدهای «داده‌ی کاربر» که عمداً در پشتیبان ریست کامل نیستند — هر مورد با دلیل.
 * اگر کلید داده‌ی تازه‌ای بدون پشتیبان اضافه شود، آزمون شکست می‌خورد تا تصمیم آگاهانه گرفته شود.
 */
const BACKUP_EXCEPTIONS = {
  /*
   * مرحله ۸: «check_settlement_dates» از این فهرست خارج شد — حالا در پشتیبان ریست هست
   * (با سازگاری عقب‌رو برای فایل‌های ۲۳ کلیدی نسخه‌های قبل).
   */
};

test('every hesabno: literal in the code is registered', () => {
  const unknown = data().keys.filter((item) => !registry.isKnown(item.key));
  assert.deepEqual(unknown.map((item) => `${item.key} (${item.backend})`), [],
    'کلید/رویداد ناشناخته پیدا شد؛ ابتدا آن را در src/storage/keys.js ثبت کنید');
});

test('the registry has no dead entries', () => {
  const scanned = new Set(data().keys.map((item) => item.key));
  const stale = registry.all.filter((entry) => !scanned.has(entry.key)).map((entry) => entry.key);
  assert.deepEqual(stale, [], 'مدخل رجیستری وجود دارد که در کد استفاده نمی‌شود');
});

test('backend type in the registry matches the code (local / session / event)', () => {
  for (const item of data().keys) {
    assert.equal(registry.backendOf(item.key), item.backend, `نوع دسترسی ${item.key}`);
  }
  assert.equal(data().byBackend.event, registry.eventNames().length, 'تعداد رویدادها');
  assert.equal(data().byBackend.session, registry.keysForBackend('session').length, 'تعداد کلیدهای session');
  assert.equal(data().byBackend.local, registry.keysForBackend('local').length, 'تعداد کلیدهای localStorage');
});

test('derived keys are registered too (KEY + suffix construction)', () => {
  const derived = data().derivedKeys;
  assert.ok(derived.length >= 1, 'دست‌کم یک کلید مشتق‌شده انتظار می‌رود (lastTabIdx)');
  for (const item of derived) {
    assert.ok(registry.isKnown(item.key), `کلید مشتق‌شده‌ی ${item.key} در رجیستری نیست`);
    assert.equal(registry.backendOf(item.key), 'session', `${item.key} باید session باشد`);
  }
});

test('registry metadata is internally consistent', () => {
  const seen = new Set();
  const backends = new Set(['local', 'session', 'event']);
  const scopes = new Set(['data', 'settings', 'resume', 'internal', 'event']);
  for (const entry of registry.all) {
    assert.match(entry.key, /^hesabno:[A-Za-z0-9_:.\-]+$/, `قالب نام ${entry.key}`);
    assert.equal(seen.has(entry.key), false, `کلید تکراری ${entry.key}`);
    seen.add(entry.key);
    assert.ok(backends.has(entry.backend), `backend نامعتبر برای ${entry.key}`);
    assert.ok(scopes.has(entry.scope), `scope نامعتبر برای ${entry.key}`);
    assert.equal(typeof entry.backup, 'boolean', `backup برای ${entry.key}`);
    if (entry.backend === 'event') {
      assert.equal(entry.type, null, `رویداد ${entry.key} نباید type داشته باشد`);
      assert.equal(entry.scope, 'event');
      assert.equal(entry.backup, false, 'رویداد پشتیبان‌گیری نمی‌شود');
    } else {
      assert.ok(entry.type === 'json' || entry.type === 'raw', `type نامعتبر برای ${entry.key}`);
      assert.notEqual(entry.scope, 'event', `${entry.key} کلید است ولی scope=event دارد`);
      assert.match(entry.owner, /^\d{3}[a-z]?$/, `owner برای ${entry.key}`);
      assert.match(String(entry.default === undefined ? 'null' : entry.default), /^.*$/, 'default');
    }
  }
});

test('json/raw classification matches how the app actually stores values at boot', async (t) => {
  /*
   * کاوشگر در فرایند جدا اجرا می‌شود؛ jsdom با pretendToBeVisual چرخه‌ی فریم زنده دارد و بستنش
   * داخل فرآیند آزمون، خطاهای «پس از پایان آزمون» تولید می‌کند (همان الگوی مرحله ۴).
   */
  const probe = path.join(root, 'tools/bench/storage-types-probe.cjs');
  let raw;
  try {
    raw = execFileSync(process.execPath, [probe], { encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024 });
  } catch (error) {
    if (String(error.stdout || '').includes('jsdom')) return t.skip('jsdom در دسترس نیست');
    throw error;
  }
  const result = JSON.parse(raw.slice(raw.indexOf('{')));
  if (result.skipped) return t.skip(result.skipped);

  const checked = [];
  const unknown = [];
  for (const item of result.values) {
    const entry = registry.byKey(item.key);
    if (!entry) { unknown.push(item.key); continue; }
    assert.equal(entry.backend, 'local', `${item.key} در بوت از localStorage استفاده شد`);
    if (entry.type === 'json') {
      assert.equal(item.parses, true,
        `${item.key} در رجیستری json است ولی مقدار ذخیره‌شده JSON معتبر نیست: ${item.value}`);
    } else {
      assert.equal(item.parses, false,
        `${item.key} در رجیستری raw است ولی مقدارش JSON قابل‌تجزیه است: ${item.value}`);
    }
    checked.push(item.key);
  }
  assert.deepEqual(unknown, [], 'کلید بوت‌شده‌ای هست که در رجیستری نیست');
  assert.ok(checked.length >= 10, `تعداد کلیدهای بررسی‌شده در بوت (${checked.length}) کمتر از انتظار است`);
});

test('the reset backup list in 108 matches the registry exactly', () => {
  const source = fs.readFileSync(path.join(SCRIPTS, '108-hesabno-complete-reset-flow.js'), 'utf8');
  const start = source.indexOf('var backupKeys = [');
  const end = source.indexOf('];', start);
  assert.ok(start > -1 && end > start, 'فهرست backupKeys در ۱۰۸ پیدا نشد');
  const literal = source.slice(start, end);
  const listed = [...literal.matchAll(/"(hesabno:[^"]+)"/g)].map((match) => match[1]).sort();

  const fromRegistry = registry.backupKeys().filter((entry) => entry.backend === 'local').map((entry) => entry.key).sort();
  assert.deepEqual(listed, fromRegistry,
    'فهرست پشتیبان ۱۰۸ و رجیستری باید یکی باشند؛ اختلاف یعنی یکی از دو طرف به‌روز نشده');
});

test('every user-data key is covered by the reset backup unless explicitly excused', () => {
  const backup = new Set(registry.backupKeys().map((entry) => entry.key));
  const uncovered = registry.storageKeys()
    .filter((entry) => entry.scope === 'data' && !backup.has(entry.key))
    .map((entry) => entry.key)
    .sort();
  assert.deepEqual(uncovered, Object.keys(BACKUP_EXCEPTIONS).sort(),
    'کلید داده‌ی کاربر بدون پوشش پشتیبان پیدا شد؛ یا به ۱۰۸ اضافه شود (با تأیید) یا با دلیل در BACKUP_EXCEPTIONS ثبت شود');
});

test('the two backup paths agree on their contract', () => {
  /* ۱۰۸ فهرست ثابت دارد؛ ۲۰۳ (پشتیبان رمزنگاری‌شده) همه‌ی کلیدهای hesabno: را برمی‌دارد */
  const encryptedSource = fs.readFileSync(path.join(SCRIPTS, '203-hesabno-accessibility-and-encrypted-backup.js'), 'utf8');
  assert.match(encryptedSource, /indexOf\("hesabno:"\)\s*===\s*0/, '۲۰۳ باید همه‌ی کلیدهای hesabno: را پوشش دهد');

  const resetKeys = new Set(registry.backupKeys().map((entry) => entry.key));
  const encryptedCovers = registry.storageKeys().filter((entry) => entry.backend === 'local').map((entry) => entry.key);
  const missing = encryptedCovers.filter((key) => !resetKeys.has(key));
  /* این‌ها فقط از مسیر رمزنگاری‌شده پشتیبان می‌شوند؛ فهرستشان باید آگاهانه باشد */
  const expectedOnlyEncrypted = registry.storageKeys()
    .filter((entry) => entry.backend === 'local' && !entry.backup)
    .map((entry) => entry.key)
    .sort();
  assert.deepEqual(missing.sort(), expectedOnlyEncrypted,
    'اختلاف بین دو مسیر پشتیبان باید فقط همان کلیدهای backup:false باشد');
});

test('the registry is pure and is not loaded by index.html', () => {
  const source = fs.readFileSync(path.join(root, 'app/src/main/assets/src/storage/keys.js'), 'utf8');
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['document.', 'window.', 'localStorage', 'sessionStorage', 'fetch(']) {
    assert.equal(stripped.includes(forbidden), false, `رجیستری نباید به ${forbidden} وابسته باشد`);
  }
  const indexHtml = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
  assert.equal(/src\/storage\/keys\.js/.test(indexHtml), false, 'رجیستری نباید در index.html بارگذاری شود (صفر بایت بوت)');
  /*
   * تنها ماژول storage که در بوت بارگذاری می‌شود نگهبان نوشتن است (مرحله ۶.۲) — و آن هم نه
   * برای خواندن رجیستری، بلکه برای محافظت از نوشتن. اگر ماژول دیگری اضافه شد، این آزمون
   * باید آگاهانه به‌روزرسانی شود.
   */
  const storageModules = [...indexHtml.matchAll(/src="src\/storage\/([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(storageModules.map((name) => name.split('?')[0]), ['write-guard.js'],
    'فقط نگهبان نوشتن مجاز است در بوت بارگذاری شود');
});

test('the registry module loads in a bare sandbox (browser-safe UMD)', () => {
  const source = fs.readFileSync(path.join(root, 'app/src/main/assets/src/storage/keys.js'), 'utf8');
  const context = { globalThis: {} };
  vm.runInNewContext(source, context);
  const api = context.globalThis.HesabnoStorage.keys;
  assert.equal(api.version, 1);
  assert.equal(api.all.length, registry.all.length);
  assert.equal(api.isKnown('hesabno:transactions'), true);
  assert.equal(api.isKnown('hesabno:ناموجود'), false);
  assert.equal(api.backendOf('hesabno:softReload'), 'session');
  assert.equal(api.eventNames().length, 6);
});
