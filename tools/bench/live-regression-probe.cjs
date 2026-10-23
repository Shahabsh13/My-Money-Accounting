#!/usr/bin/env node
/*
 * کاوشگر «آزمون زنده» مرحله ۴ — برنامه‌ی واقعی را در jsdom بوت می‌کند و شاهدهای رفتاری می‌دهد
 *
 * چرا جدا از اجراکننده‌ی آزمون؟ چون jsdom با pretendToBeVisual چرخه‌ی فریم زنده دارد و اگر داخل
 * فرآیند آزمون بسته شود، خطاهای «پس از پایان آزمون» تولید می‌کند. این ابزار خودش در پایان با
 * process.exit(0) تمام می‌شود و آزمون، خروجی JSON آن را بررسی می‌کند.
 *
 * خروجی JSON روی stdout:
 *   observers      → هر observer ساخته‌شده با «سازنده» (نام فایل اسکریپت) و هدف
 *   stats          → آمار لایه‌ی مشترک (ثبت‌ها، رخدادها، تحویل‌ها، خطاها)
 *   live           → نتیجه‌ی دو جهش آزمایشی: برگشت کلاس لایه‌ی ۰۹۰ و ادامه‌ی تحویل رخداد
 *   jsdomErrors    → خطاهای محیط (canvas) جدا شمرده می‌شوند
 *
 * کاربرد: node tools/bench/live-regression-probe.cjs [--root=/path/to/tree]
 */
const path = require('node:path');
const { serve } = require('./local-server.cjs');

const rootArg = (process.argv.find((value) => value.startsWith('--root=')) || '').split('=')[1];
const ROOT = rootArg ? path.resolve(rootArg) : path.resolve(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  let JSDOM, VirtualConsole;
  try { ({ JSDOM, VirtualConsole } = require('jsdom')); }
  catch (error) {
    process.stdout.write(JSON.stringify({ root: ROOT, skipped: 'jsdom در دسترس نیست' }) + '\n');
    process.exit(0);
  }

  const server = await serve(ASSETS);
  const virtualConsole = new VirtualConsole();
  const jsdomErrors = [];
  virtualConsole.on('jsdomError', (error) => jsdomErrors.push(String((error && error.message) || error)));

  const created = [];
  const dom = await JSDOM.fromFile(path.join(ASSETS, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole,
    url: server.url + '/index.html',
    beforeParse(window) {
      const Real = window.MutationObserver;
      window.MutationObserver = class extends Real {
        constructor(callback) {
          super(callback);
          let stack = '';
          try { throw new Error('observer'); } catch (error) { stack = String(error.stack || ''); }
          created.push({ stack, target: null, self: this });
        }
        observe(target, options) {
          for (let index = created.length - 1; index >= 0; index -= 1) {
            if (created[index].self === this) {
              created[index].target = target && (target.nodeType === 9 ? '#document'
                : String(target.tagName || '') + (target.id ? '#' + target.id : ''));
              break;
            }
          }
          return super.observe(target, options);
        }
      };
    },
  });

  const window = dom.window;
  const document = window.document;
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      const container = document.getElementById('root');
      if (container && container.innerHTML.length > 2000) { clearInterval(timer); resolve(); }
    }, 25);
  });
  await tick(1200);

  const creatorOf = (record) => {
    const match = /src\/scripts\/([^?:)]+)/.exec(record.stack);
    return match ? match[1] : 'ناشناس';
  };

  const live = {};
  const main = document.querySelector('main');
  live.hasMain = !!main;
  live.dashboardWidgets = document.querySelectorAll('#hesabno-fixed-dashboard-widgets').length;
  live.dashboardCards = document.querySelectorAll('.hesabno-fixed-dashboard-card').length;

  /* جهش ۱ (لایه‌ی ۰۹۰): کلاس را برمی‌داریم و جهش می‌دهیم؛ باید دوباره گذاشته شود */
  if (main) main.classList.remove('hesabno-dashboard-main');
  const probe = document.createElement('div');
  probe.id = 'live-probe-1';
  (main || document.getElementById('root')).appendChild(probe);
  await tick(900);
  live.dashboardClassRestored = !!(main && main.classList.contains('hesabno-dashboard-main'));

  /* جهش ۲: تحویل رخداد باید ادامه پیدا کند */
  const before = window.__hesabnoDom ? window.__hesabnoDom.stats().delivered : 0;
  document.body.appendChild(document.createElement('span'));
  await tick(400);
  const stats = window.__hesabnoDom ? window.__hesabnoDom.stats() : null;
  live.deliveredAfterMutation = stats ? stats.delivered - before : 0;

  process.stdout.write(JSON.stringify({
    root: ROOT,
    registryVersion: window.__hesabnoDom ? window.__hesabnoDom.version : null,
    observers: created.map((record) => ({ creator: creatorOf(record), target: record.target })),
    stats,
    live,
    jsdomErrors,
  }, null, 2) + '\n');

  try { await server.close(); } catch (error) {}
  process.exit(0);
})();
