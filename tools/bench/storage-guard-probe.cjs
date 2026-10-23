#!/usr/bin/env node
/*
 * کاوشگر نگهبان نوشتن (مرحله ۶.۲) — روی برنامه‌ی واقعی بوت‌شده در jsdom
 *
 * چه چیزی را ثابت می‌کند؟
 *   ۱) نگهبان پیش از ۰۰۰ نصب شده و همه‌ی نوشتن‌های بوت را شمرده است (پیش از این، وصله‌ی ۰۰۴
 *      بعد از سه نوشتن اول بوت نصب می‌شد).
 *   ۲) وصله‌های موجود ۱۴۵/۱۴۸ روی نگهبان سوار شده‌اند و از بین نرفته‌اند.
 *   ۳) با پر کردن واقعی حافظه تا سهمیه: خطا پرتاب می‌شود (رفتار قبلی حفظ)، مقدار قبلی همان
 *      کلید دست‌نخورده می‌ماند، رخداد با جزئیات می‌رسد، و هشدار فقط یک بار در بازه‌ی ۱۰ ثانیه.
 *
 * چرا فرایند جدا؟ jsdom چرخه‌ی فریم زنده دارد؛ بستنش داخل فرآیند آزمون خطای «پس از پایان آزمون»
 * می‌سازد. این ابزار خودش با process.exit(0) تمام می‌شود.
 *
 * کاربرد: node tools/bench/storage-guard-probe.cjs [--root=/path]
 */
const path = require('node:path');
const crypto = require('node:crypto');
const { serve } = require('./local-server.cjs');

const rootArg = (process.argv.find((value) => value.startsWith('--root=')) || '').split('=')[1];
const ROOT = rootArg ? path.resolve(rootArg) : path.resolve(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');

(async () => {
  let JSDOM, VirtualConsole, ResourceLoader;
  try { ({ JSDOM, VirtualConsole, ResourceLoader } = require('jsdom')); }
  catch (error) {
    process.stdout.write(JSON.stringify({ root: ROOT, skipped: 'jsdom در دسترس نیست' }) + '\n');
    process.exit(0);
  }

  const server = await serve(ASSETS);
  class ProbeResourceLoader extends ResourceLoader {
    fetch(url, options) {
      let pathname = '';
      try { pathname = new URL(url).pathname; } catch (error) { /* fall through */ }
      if (pathname === '/src/scripts/901-light-theme-contrast.js') {
        return Promise.resolve(Buffer.from('/* Canvas-only contrast helper is not executed in jsdom tests. */'));
      }
      return super.fetch(url, options);
    }
  }
  const dom = await JSDOM.fromFile(path.join(ASSETS, 'index.html'), {
    runScripts: 'dangerously', resources: new ProbeResourceLoader(), pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(), url: server.url + '/index.html',
  });
  const window = dom.window;

  await new Promise((resolve) => {
    const timer = setInterval(() => {
      const container = window.document.getElementById('root');
      if (container && container.innerHTML.length > 2000) { clearInterval(timer); resolve(); }
    }, 25);
  });
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const guard = window.__hesabnoStorageGuard;
  const bootStats = guard ? guard.stats() : null;

  /* عکس نهایی ذخیره‌سازی: معیار «داده بایت‌به‌بایت عوض نشده است» */
  const snapshotEntries = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    const value = String(window.localStorage.getItem(key));
    snapshotEntries.push([key, crypto.createHash('sha256').update(value).digest('hex').slice(0, 16), value.length]);
  }
  snapshotEntries.sort();
  const snapshot = {
    count: snapshotEntries.length,
    bytes: snapshotEntries.reduce((sum, item) => sum + item[2], 0),
    digest: crypto.createHash('sha256').update(JSON.stringify(snapshotEntries)).digest('hex'),
    accountsHash: (snapshotEntries.find((item) => item[0] === 'hesabno:accounts_v5') || [])[1] || null,
  };

  const result = {
    root: ROOT,
    guardVersion: guard ? guard.version : null,
    eventName: guard ? guard.eventName : null,
    /*
     * «نصب زودهنگام» را رفتاری می‌سنجیم: یک نوشتن آزمایشی باید شمارنده را بالا ببرد.
     * (نشانه روی تابع قابل اعتماد نیست، چون ۰۰۴ بعداً تابع را با alias-mapper عوض می‌کند.)
     */
    installedEarly: (function () {
      if (!guard) return false;
      var before = guard.stats().writes;
      try { window.localStorage.setItem('probe-installed', '1'); } catch (error) { return false; }
      var after = guard.stats().writes;
      try { window.localStorage.removeItem('probe-installed'); } catch (error) {}
      return after === before + 1;
    })(),
    /* سه اسکریپت ۱۴۵/۱۴۸/۱۵۴ باید مشترک شده باشند، نه اینکه خودشان setItem را بپیچند */
    writeSubscribers: guard ? guard.subscriberCount().write : 0,
    setsItemOwnWrappers: (function () {
      var count = 0;
      try { if (window.Storage.prototype.setItem.__hesabnoCanonicalTransactionMetadata) count += 1; } catch (error) {}
      try { if (window.Storage.prototype.setItem.__hesabnoOpeningBalanceUnit) count += 1; } catch (error) {}
      try { if (window.Storage.prototype.setItem.__hesabnoCurrencySync) count += 1; } catch (error) {}
      return count;
    })(),
    bootStats,
    snapshot,
    quota: null,
  };

  /* ---------- پر کردن واقعی حافظه تا سهمیه ---------- */
  const alerts = [];
  window.alert = function (message) { alerts.push(String(message)); };
  const events = [];
  window.addEventListener('hesabno:storage-write-failed', function (event) { events.push(event.detail); });

  const existingKey = 'hesabno:theme';
  const existingValue = window.localStorage.getItem(existingKey);
  const blockedKey = 'probe-quota-blocked';
  /* مقدار قبلی را زیر همان کلید آزمایشی می‌گذاریم تا «دست‌نخورده ماندن» سنجیده شود */
  window.localStorage.setItem(blockedKey, 'old-value');
  const previousValue = window.localStorage.getItem(blockedKey);

  const beforeFailures = guard ? guard.stats().failures : 0;
  let thrown = null;
  let fillKey = null;
  let fillIndex = 0;
  for (; fillIndex < 400; fillIndex += 1) {
    /* هر ۱۰۰۰ کاراکتر یک کلید؛ حجم کل را تا سهمیه بالا می‌بریم */
    const key = 'probe-fill-' + fillIndex;
    try { window.localStorage.setItem(key, 'x'.repeat(256 * 1024)); }
    catch (error) { thrown = error; fillKey = key; break; }
  }

  /* alert در setTimeout(0) صدا زده می‌شود؛ بدون این انتظار، شمارش صفر می‌ماند */
  await new Promise((resolve) => setTimeout(resolve, 60));

  if (thrown) {
    const stats = guard ? guard.stats() : null;
    result.quota = {
      thrown: String(thrown.name || thrown.message || thrown),
      reason: guard ? guard.classify(thrown) : null,
      fillIndex,
      failuresDelta: stats ? stats.failures - beforeFailures : null,
      alerts: alerts.length,
      alertText: alerts[0] || null,
      events: events.length,
      eventKeyMatches: events.length ? events[events.length - 1].key === fillKey : null,
      eventReason: events.length ? events[events.length - 1].reason : null,
      eventStorage: events.length ? events[events.length - 1].storage : null,
      valuePreserved: window.localStorage.getItem(blockedKey) === previousValue,
      blockedKeyPresent: window.localStorage.getItem(blockedKey) === 'old-value',
      quotaKeyAbsent: window.localStorage.getItem(fillKey) === null,
      themeUntouched: window.localStorage.getItem(existingKey) === existingValue,
    };
  }

  /* مشترک‌های ۱۴۵/۱۴۸/۱۵۴ باید با یک نوشتن موفق صدا زده شوند */
  result.subscribersFired = null;
  if (guard && guard.subscriberCount().write >= 3) {
    let hits = 0;
    const off = guard.onWrite(function () { hits += 1; });
    try { window.localStorage.setItem('hesabno:currency', 'toman'); } catch (error) {}
    try { window.localStorage.setItem('hesabno:currency', 'rial'); } catch (error) {}
    off();
    result.subscribersFired = hits;
  }

  /* پاک‌سازی کلیدهای آزمایشی (فقط داخل همین jsdom) */
  for (let index = 0; index < fillIndex; index += 1) {
    try { window.localStorage.removeItem('probe-fill-' + index); } catch (error) {}
  }
  try { window.localStorage.removeItem(blockedKey); } catch (error) {}

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  try { await server.close(); } catch (error) {}
  process.exit(0);
})();
