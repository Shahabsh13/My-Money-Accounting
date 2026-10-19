#!/usr/bin/env node
/*
 * کاوشگر «نوع مقدار» کلیدهای ذخیره‌سازی — مرحله ۶.۱
 *
 * رجیستری برای هر کلید `type: "json"` یا `"raw"` ثبت می‌کند. این کاوشگر برنامه‌ی واقعی را در
 * jsdom بوت می‌کند و مقادیر واقعیِ نوشته‌شده در localStorage را با آن ثبت مقایسه می‌کند؛
 * یعنی ادعای رجیستری با رفتار واقعی برنامه سنجیده می‌شود، نه با خواندن کد.
 *
 * چرا فرایند جدا؟ jsdom با pretendToBeVisual چرخه‌ی فریم زنده دارد؛ بستنش داخل فرایند آزمون
 * خطاهای «پس از پایان آزمون» می‌سازد. این ابزار خودش با process.exit(0) تمام می‌شود.
 *
 * کاربرد: node tools/bench/storage-types-probe.cjs [--root=/path/to/tree]
 * خروجی JSON: { root, values: [{key, value, parses, bytes}], unknown, skipped? }
 */
const path = require('node:path');
const { serve } = require('./local-server.cjs');

const rootArg = (process.argv.find((value) => value.startsWith('--root=')) || '').split('=')[1];
const ROOT = rootArg ? path.resolve(rootArg) : path.resolve(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');

(async () => {
  let JSDOM, VirtualConsole;
  try { ({ JSDOM, VirtualConsole } = require('jsdom')); }
  catch (error) {
    process.stdout.write(JSON.stringify({ root: ROOT, skipped: 'jsdom در دسترس نیست' }) + '\n');
    process.exit(0);
  }

  const server = await serve(ASSETS);
  const virtualConsole = new VirtualConsole();
  const dom = await JSDOM.fromFile(path.join(ASSETS, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    virtualConsole, url: server.url + '/index.html',
  });
  const window = dom.window;

  await new Promise((resolve) => {
    const timer = setInterval(() => {
      const container = window.document.getElementById('root');
      if (container && container.innerHTML.length > 2000) { clearInterval(timer); resolve(); }
    }, 25);
  });
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const values = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    const value = window.localStorage.getItem(key);
    let parses = true;
    try { JSON.parse(value); } catch (error) { parses = false; }
    values.push({ key, value: String(value).slice(0, 120), parses, bytes: String(value).length });
  }

  const sessions = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    sessions.push({ key, value: String(window.sessionStorage.getItem(key)).slice(0, 120) });
  }

  process.stdout.write(JSON.stringify({
    root: ROOT,
    hasUnknown: typeof window.HesabnoStorage === 'undefined',
    values,
    sessions,
  }, null, 2) + '\n');

  try { await server.close(); } catch (error) {}
  process.exit(0);
})();
