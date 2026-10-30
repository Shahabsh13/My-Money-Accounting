/*
 * آزمون نگهبان نوشتن ذخیره‌سازی (مرحله ۶.۲)
 *
 * چه چیزی را قفل می‌کند:
 *   ۱) دسته‌بندی درست خطای سهمیه در مرورگرهای مختلف (نام/کد/پیام).
 *   ۲) حفظ کامل رفتار قبلی: خطا دوباره پرتاب می‌شود و مقدار قبلی دست‌نخورده می‌ماند.
 *   ۳) هشدار فارسی قبلی، حداکثر یک بار در ۱۰ ثانیه (رفتار منتقل‌شده از ۰۰۴).
 *   ۴) رخداد «hesabno:storage-write-failed» با key/bytes/reason/storage.
 *   ۵) «مشترک نوشتن» جایگزین وصله‌های روی‌هم‌سوار ۱۴۵/۱۴۸/۱۵۴ شده و استثنای مشترک، نوشتن را نمی‌شکند.
 *   ۶) نصب دوباره بی‌اثر است (بدون شمارش مضاعف).
 *   ۷) هیچ کلید ذخیره‌سازی تازه‌ای ساخته نمی‌شود و هیچ کد کاربردی کلید را نمی‌نویسد.
 *   ۸) آزمون زنده روی بوت واقعی: نگهبان پیش از ۰۰۰ فعال، ۱۸ نوشتن بوت شمرده، و سهمیه‌ی واقعی
 *      (پر کردن حافظه تا شکست) درست گزارش می‌شود بدون آسیب به داده‌ی موجود.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const guardModule = require('../app/src/main/assets/src/storage/write-guard.js');
const registry = require('../app/src/main/assets/src/storage/keys.js');
const SCRIPTS = path.join(root, 'app/src/main/assets/src/scripts');

/* جانشین Storage.prototype با همان قرارداد: setItem اتمی است و روی خطا مقدار قبلی می‌ماند */
function makeProto(options) {
  const opts = options || {};
  const data = new Map();
  const proto = {
    calls: [],
    setItem(key, value) {
      proto.calls.push(key);
      if (opts.fail && opts.fail(key)) {
        if (opts.error) throw opts.error;
        const error = new Error(opts.failMessage || 'quota');
        error.name = opts.failName || 'QuotaExceededError';
        error.code = opts.failCode === undefined ? 22 : opts.failCode;
        throw error;
      }
      data.set(key, String(value));
    },
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    data,
  };
  return proto;
}

function makeWindow() {
  const listeners = [];
  function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; }
  return {
    localStorage: { name: 'localStorage' },
    sessionStorage: { name: 'sessionStorage' },
    CustomEvent,
    dispatchEvent(event) { listeners.push(event); return true; },
    setTimeout(callback) { callback(); return 0; },
    alert() {},
    listeners,
  };
}

test('classify detects quota across browsers', () => {
  const make = (name, code, message) => ({ name, code, message });
  assert.equal(guardModule.classify(make('QuotaExceededError', 22, '')), 'quota');
  assert.equal(guardModule.classify(make('NS_ERROR_DOM_QUOTA_REACHED', 1014, '')), 'quota');
  assert.equal(guardModule.classify(make('Error', 22, '')), 'quota');
  assert.equal(guardModule.classify(make('Error', 1014, '')), 'quota');
  assert.equal(guardModule.classify(make('Error', 0, 'The quota has been exceeded.')), 'quota');
  assert.equal(guardModule.classify(make('SecurityError', 18, 'denied')), 'security');
  assert.equal(guardModule.classify(make('Error', 0, 'boom')), 'unknown');
  assert.equal(guardModule.classify(null), 'unknown');
});

test('a failed write rethrows the same error and keeps the previous value', () => {
  /* خطای مشخص و از پیش تعیین‌شده — دقیقاً همان شیئی که باید پرتاب شود */
  const error = new Error('full');
  error.name = 'QuotaExceededError';
  error.code = 22;
  const proto = makeProto({ fail: () => true, error });
  proto.data.set('hesabno:transactions', '[1]'); /* مقدار قبلی */
  const win = makeWindow();
  const api = guardModule.install({ proto, win, alertFn() {} });

  assert.throws(() => proto.setItem('hesabno:transactions', '[2]'), (thrown) => thrown === error,
    'همان شیء خطا باید پرتاب شود');
  assert.equal(proto.getItem('hesabno:transactions'), '[1]', 'مقدار قبلی نباید عوض شود');
  assert.equal(api.stats().failures, 1);
  assert.equal(api.stats().lastFailure.key, 'hesabno:transactions');
  assert.equal(api.stats().lastFailure.reason, 'quota');
  assert.equal(api.stats().lastFailure.bytes, 3);
});

test('successful writes pass through and are counted', () => {
  const proto = makeProto({});
  const win = makeWindow();
  const api = guardModule.install({ proto, win, alertFn() {} });
  proto.setItem('hesabno:theme', 'dark');
  proto.setItem('hesabno:currency', 'rial');
  assert.equal(proto.getItem('hesabno:theme'), 'dark');
  assert.equal(api.stats().writes, 2);
  assert.equal(api.stats().failures, 0);
});

test('skipUnchanged is off by default (backward compatible)', () => {
  const proto = makeProto({});
  const win = makeWindow();
  const api = guardModule.install({ proto, win, alertFn() {} });
  proto.setItem('hesabno:theme', 'dark');
  proto.setItem('hesabno:theme', 'dark');
  assert.equal(api.stats().writes, 2);
  assert.equal(api.stats().skipped, 0, 'پیش‌فرض باید نوشتن دوم را انجام دهد');
  assert.equal(proto.calls.length, 2);
  api.uninstall();
});

test('skipUnchanged removes identical writes but still notifies subscribers', () => {
  const proto = makeProto({});
  const win = makeWindow();
  const api = guardModule.install({ proto, win, alertFn() {}, skipUnchanged: true });
  const changes = [];
  api.onWrite((change) => changes.push({ key: change.key, skipped: change.skipped }));

  proto.setItem('hesabno:accounts_v5', '["A"]');
  proto.setItem('hesabno:accounts_v5', '["A"]'); /* تکراری: نباید بنویسد */
  proto.setItem('hesabno:accounts_v5', '["B"]'); /* متفاوت: باید بنویسد */

  assert.equal(api.stats().writes, 3, 'همه‌ی فراخوانی‌ها شمرده می‌شوند');
  assert.equal(api.stats().skipped, 1);
  assert.equal(api.stats().skippedBytes, 5, 'طول مقدار تکراری');
  assert.equal(proto.calls.length, 2, 'تابع اصلی فقط دو بار صدا زده می‌شود');
  assert.equal(proto.getItem('hesabno:accounts_v5'), '["B"]', 'مقدار نهایی باید آخرین مقدار باشد');
  /* رفتار مشترک‌ها تغییر نکرده: برای هر سه فراخوانی اعلان می‌گیرند */
  assert.deepEqual(changes, [
    { key: 'hesabno:accounts_v5', skipped: false },
    { key: 'hesabno:accounts_v5', skipped: true },
    { key: 'hesabno:accounts_v5', skipped: false },
  ]);
  api.uninstall();
});

test('skipUnchanged never hides a real write after a failed read', () => {
  const proto = makeProto({});
  proto.getItem = function () { throw new Error('read blocked'); };
  const win = makeWindow();
  const api = guardModule.install({ proto, win, alertFn() {}, skipUnchanged: true });
  proto.setItem('hesabno:theme', 'dark');
  assert.equal(api.stats().skipped, 0, 'اگر خواندن ممکن نباشد، نوشتن باید انجام شود');
  assert.equal(proto.data.get('hesabno:theme'), 'dark');
  api.uninstall();
});

test('the alert fires once per 10 seconds (same text as 004)', () => {
  const proto = makeProto({ fail: () => true });
  const win = makeWindow();
  let clock = 1000000;
  const alerts = [];
  const api = guardModule.install({
    proto, win, alertFn: (message) => alerts.push(message),
    now: () => clock, rateLimitMs: 10000,
  });
  assert.throws(() => proto.setItem('a', 'v'));
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0], guardModule.alertText);
  assert.match(alerts[0], /فضای ذخیره‌سازی پر شده/);

  clock += 5000;
  assert.throws(() => proto.setItem('b', 'v'));
  assert.equal(alerts.length, 1, 'در بازه‌ی ۱۰ ثانیه هشدار دوم نباید بیاید');

  clock += 5001;
  assert.throws(() => proto.setItem('c', 'v'));
  assert.equal(alerts.length, 2, 'پس از ۱۰ ثانیه هشدار دوباره مجاز است');
  assert.equal(api.stats().failures, 3);
  assert.equal(api.stats().alerts, 2);
});

test('failure event carries key, bytes, reason and storage name', () => {
  const proto = makeProto({ fail: () => true });
  const win = makeWindow();
  guardModule.install({ proto, win, alertFn() {} });
  /* localStorage و sessionStorage در این جانشین، شیء ساده‌اند؛ نام «unknown» پذیرفتنی است */
  assert.throws(() => proto.setItem('hesabno:budgets', '[1,2,3]'));
  assert.equal(win.listeners.length, 1);
  const event = win.listeners[0];
  assert.equal(event.type, 'hesabno:storage-write-failed');
  assert.equal(event.detail.key, 'hesabno:budgets');
  assert.equal(event.detail.bytes, 7);
  assert.equal(event.detail.reason, 'quota');
  assert.ok(['local', 'session', 'unknown'].includes(event.detail.storage));
});

test('write subscribers run after success only; their exceptions are contained', () => {
  const proto = makeProto({ fail: (key) => key === 'boom' });
  const win = makeWindow();
  const api = guardModule.install({ proto, win, alertFn() {} });

  const seen = [];
  const off = api.onWrite((change) => { seen.push(change.key); throw new Error('subscriber bug'); });
  const failures = [];
  api.onWriteFail((failure) => failures.push(failure.key));

  proto.setItem('hesabno:currency', 'toman');
  assert.deepEqual(seen, ['hesabno:currency'], 'مشترک باید بعد از نوشتن موفق صدا زده شود');
  assert.deepEqual(failures, []);

  assert.throws(() => proto.setItem('boom', 'x'));
  assert.deepEqual(seen, ['hesabno:currency'], 'پس از شکست نباید مشترک موفقیت صدا زده شود');
  assert.deepEqual(failures, ['boom']);

  off();
  proto.setItem('hesabno:theme', 'light');
  assert.deepEqual(seen, ['hesabno:currency'], 'پس از لغو اشتراک نباید صدا زده شود');
  assert.equal(api.subscriberCount().write, 0);
  assert.equal(api.subscriberCount().failure, 1);
});

test('installing twice is idempotent', () => {
  const proto = makeProto({});
  const win = makeWindow();
  const first = guardModule.install({ proto, win, alertFn() {} });
  const second = guardModule.install({ proto, win, alertFn() {} });
  assert.equal(first, second, 'نصب دوم باید همان API را برگرداند');
  proto.setItem('hesabno:theme', 'dark');
  assert.equal(first.stats().writes, 1, 'نباید نوشتن مضاعف شمرده شود');
  assert.equal(proto.calls.length, 1, 'تابع اصلی نباید دو بار صدا زده شود');
  first.uninstall();
});

test('the in-memory failure buffer is bounded', () => {
  const proto = makeProto({ fail: () => true });
  const win = makeWindow();
  const api = guardModule.install({ proto, win, alertFn() {}, maxFailures: 50 });
  for (let index = 0; index < 70; index += 1) {
    assert.throws(() => proto.setItem('k' + index, 'v'));
  }
  assert.equal(api.stats().failures, 70);
  assert.equal(api.failures().length, 50, 'بافر حداکثر ۵۰ مورد نگه می‌دارد');
  assert.equal(api.failures()[49].key, 'k69', 'آخرین شکست باید آخرین مورد باشد');
});

test('no storage key is written by the guard itself (zero new persistent keys)', () => {
  const source = fs.readFileSync(path.join(root, 'app/src/main/assets/src/storage/write-guard.js'), 'utf8');
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  /* نگهبان فقط setItem را می‌پیچد؛ حق ندارد خودش کلید بنویسد */
  assert.equal(/\.setItem\s*\(\s*["']/.test(stripped), false,
    'نگهبان نباید هیچ کلید ثابتی بنویسد');
  assert.equal(/\.removeItem\s*\(\s*["']/.test(stripped), false);
  /* و هیچ کلید ذخیره‌سازی تازه‌ای در رجیستری اضافه نشده است */
  assert.equal(registry.storageKeys().some((entry) => /storage-guard|write-guard/.test(entry.key)), false);
});

test('the guard is the single setItem patcher; 145/148/154 subscribe instead', () => {
  for (const file of ['004-hesabno-apk-fixes.js', '145-hesabno-canonical-transaction-metadata.js',
    '148-hesabno-bank-opening-balance-unit.js', '154-hesabno-global-currency-and-signed-money.js']) {
    const source = fs.readFileSync(path.join(SCRIPTS, file), 'utf8');
    assert.equal(/Storage\.prototype\.setItem\s*=/.test(source), false,
      `${file} نباید Storage.prototype.setItem را جایگزین کند`);
  }
  const guardScript = fs.readFileSync(path.join(SCRIPTS, '000a-hesabno-storage-write-guard.js'), 'utf8');
  assert.match(guardScript, /guard\.install\(/);
  /* هشدار سهمیه باید از ۰۰۴ به نگهبان منتقل شده باشد، نه تکرار شود */
  const legacy = fs.readFileSync(path.join(SCRIPTS, '004-hesabno-apk-fixes.js'), 'utf8');
  assert.equal(/QuotaExceededError/.test(legacy), false, 'وصله‌ی سهمیه‌ی ۰۰۴ باید حذف شده باشد');
});

test('index.html loads the guard module and installer before every app script', () => {
  const html = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
  const moduleAt = html.indexOf('src/storage/write-guard.js');
  const installerAt = html.indexOf('000a-hesabno-storage-write-guard.js');
  const firstAppAt = html.indexOf('000-default-accounts.js');
  const legacyAt = html.indexOf('004-hesabno-apk-fixes.js');
  assert.ok(moduleAt > -1, 'ماژول نگهبان باید در index.html باشد');
  assert.ok(installerAt > -1, 'نصب‌کننده باید در index.html باشد');
  assert.ok(moduleAt < installerAt, 'ماژول باید پیش از نصب‌کننده بارگذاری شود');
  assert.ok(installerAt < firstAppAt, 'نصب‌کننده باید پیش از ۰۰۰ باشد (اولین نوشتن بوت)');
  assert.ok(installerAt < legacyAt);
});

test('live boot: guard installed before first write, 19 boot writes including onboarding progress, real quota handled', async (t) => {
  const probe = path.join(root, 'tools/bench/storage-guard-probe.cjs');
  let raw;
  try {
    raw = execFileSync(process.execPath, [probe], { encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
  } catch (error) {
    if (String(error.stdout || '').includes('jsdom')) return t.skip('jsdom در دسترس نیست');
    throw error;
  }
  const result = JSON.parse(raw.slice(raw.indexOf('{')));
  if (result.skipped) return t.skip(result.skipped);

  assert.equal(result.guardVersion, 1);
  assert.equal(result.eventName, 'hesabno:storage-write-failed');
  assert.equal(result.installedEarly, true, 'یک نوشتن آزمایشی باید شمارنده را بالا ببرد');
  assert.equal(result.writeSubscribers, 3, '۱۴۵/۱۴۸/۱۵۴ باید مشترک شده باشند');
  assert.equal(result.setsItemOwnWrappers, 0, 'هیچ وصله‌ی قدیمی روی setItem نباید بماند');

  /* نوشتن‌های موجود بوت + نشانگر ماندگار onboarding؛ خود نگهبان نوشتنی اضافه نمی‌کند.
     (نوشتن ۰۰۸ که پرچم پنهان‌سازی ویجت نمودار روند را می‌نوشت، با حذف آن اسکریپت کم شد.) */
  assert.equal(result.bootStats.writes, 19);
  assert.equal(result.bootStats.failures, 0);

  /*
   * ۶.۳: دو نوشتن بی‌تغییر حذف می‌شود (۳۱٬۱۱۸ بایتی accounts_v5 از هسته ۰۶۷ + یک ۴ بایتی)،
   * عکس نهایی شامل pinned=false صندوق، نشانگر مهاجرت و نشانگر پایدار onboarding است.
   */
  assert.equal(result.bootStats.skipped, 2);
  assert.equal(result.bootStats.skippedBytes, 31122);
  assert.equal(result.snapshot.count, 15);
  assert.equal(result.snapshot.bytes, 31214);
  assert.equal(result.snapshot.digest, '7ec30e6dd3097702b8432aa0eb46ac1ae64b4fdd0e0ce491c62919fe175c48c1',
    'عکس بوت باید شامل اصلاح سنجاق صندوق، نشانگر مهاجرت و نشانگر onboarding باشد');
  assert.equal(result.snapshot.accountsHash, 'ff97075cf3e9c63a');
  assert.equal(result.subscribersFired, 2, 'دو نوشتن آزمایشی باید دو بار مشترک را صدا بزنند');

  const quota = result.quota;
  assert.ok(quota, 'پر کردن حافظه باید به سهمیه برسد');
  assert.equal(quota.thrown, 'QuotaExceededError');
  assert.equal(quota.reason, 'quota');
  assert.equal(quota.failuresDelta, 1);
  assert.equal(quota.alerts, 1, 'هشدار باید یک بار بیاید');
  assert.equal(quota.alertText, guardModule.alertText, 'متن هشدار باید عیناً همان متن ۰۰۴ باشد');
  assert.equal(quota.events, 1);
  assert.equal(quota.eventKeyMatches, true);
  assert.equal(quota.eventReason, 'quota');
  assert.equal(quota.eventStorage, 'local');
  assert.equal(quota.valuePreserved, true, 'مقدار قبلی کلید آزمایشی باید دست‌نخورده بماند');
  assert.equal(quota.quotaKeyAbsent, true, 'نوشتن ناموفق نباید نیمه‌کاره بنشیند');
  assert.equal(quota.themeUntouched, true, 'داده‌ی واقعی برنامه نباید آسیب ببیند');
});

