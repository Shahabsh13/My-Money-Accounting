#!/usr/bin/env node
/* میزسنج پایه برای پروژه‌ی My Money — خروجی JSON روی stdout
   کاربرد: node bench.cjs [مسیرریشه] > before.json  و بعد از تغییرات → after.json */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { serve } = require('./local-server.cjs');
const __rootArg = (process.argv.find((value) => value.startsWith('--root=')) || '').split('=')[1];

const ROOT = __rootArg ? path.resolve(__rootArg) : (process.argv[2] && !process.argv[2].startsWith('--') ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..', '..'));
const ASSETS = path.join(ROOT, 'app/src/main/assets');
/* jsdom از node_modules خود پروژه بارگذاری می‌شود؛ اگر نبود، میزسنج بدون بخش راه‌اندازی ادامه می‌دهد. */
let JSDOM = null;
let VirtualConsole = null;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); } catch (e) { /* jsdom اختیاری */ }

const out = { root: ROOT, at: new Date().toISOString() };

/* ---------- A) بودجه‌ی ثابت ---------- */
function dirSize(dir) {
  let n = 0; for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    n += f.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  } return n;
}
const html = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
const scriptTags = [...html.matchAll(/<script\b[^>]*>/gi)].map(m => m[0]);
const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map(m => m[0]);
out.static = {
  indexHtmlBytes: Buffer.byteLength(html),
  scriptTags: scriptTags.length,
  externalScripts: scriptTags.filter(t => /src=/i.test(t)).length,
  blockingScripts: scriptTags.filter(t => /src=/i.test(t) && !/\bdefer\b/i.test(t) && !/\basync\b/i.test(t)).length,
  asyncScripts: scriptTags.filter(t => /\basync\b/i.test(t)).length,
  styleLinks: linkTags.filter(t => /stylesheet/i.test(t)).length,
  preloads: linkTags.filter(t => /rel="preload"/i.test(t)).length,
  jsBytes: dirSize(path.join(ASSETS, 'src/scripts')),
  cssBytes: dirSize(path.join(ASSETS, 'src/styles')),
  assetBytes: dirSize(path.join(ASSETS, 'assets')),
  jsFiles: fs.readdirSync(path.join(ASSETS, 'src/scripts')).length,
  cssFiles: fs.readdirSync(path.join(ASSETS, 'src/styles')).length,
};

/* ---------- B) هزینه‌ی تفسیر (parse) همه‌ی اسکریپت‌ها ---------- */
{
  const dir = path.join(ASSETS, 'src/scripts');
  const files = fs.readdirSync(dir);
  const t0 = process.hrtime.bigint();
  let bytes = 0;
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    bytes += Buffer.byteLength(src);
    new vm.Script(src, { filename: f });          // فقط کامپایل، بدون اجرا
  }
  out.parse = { files: files.length, bytes, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
}

/* ---------- C) زمان راه‌اندازی در jsdom + آشوب پس از راه‌اندازی ---------- */
async function boot(runs = 3) {
  if (!JSDOM) return { skipped: 'jsdom نصب نیست' };
  const times = []; let stats = null;
  for (let i = 0; i < runs; i++) {
    const vc = new VirtualConsole(); const errs = [];
    vc.on('jsdomError', e => { if (!/getContext/.test(String(e.message))) errs.push(String(e.message).slice(0, 120)); });
    const t0 = Date.now();
    const server = await serve(ASSETS);
    const dom = await JSDOM.fromFile(path.join(ASSETS, 'index.html'), {
      runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
      url: server.url + '/index.html',
    });
    const w = dom.window;
    let rafAfterBoot = 0; let bootedAt = 0;
    const realRaf = w.requestAnimationFrame.bind(w);
    w.requestAnimationFrame = cb => { if (bootedAt) rafAfterBoot++; return realRaf(cb); };
    await new Promise((resolve) => {
      const iv = setInterval(() => {
        const root = w.document.getElementById('root');
        if (root && root.innerHTML.length > 2000) { bootedAt = Date.now(); clearInterval(iv); resolve(); }
        if (Date.now() - t0 > 60000) { clearInterval(iv); resolve(); }
      }, 25);
    });
    await new Promise(r => setTimeout(r, 2000));
    times.push(bootedAt - t0);
    stats = {
      bootMs: bootedAt - t0,
      rootHtmlBytes: (w.document.getElementById('root') || { innerHTML: '' }).innerHTML.length,
      domNodes: w.document.querySelectorAll('*').length,
      styleTags: w.document.querySelectorAll('style').length,
      rafPerSecondAfterBoot: rafAfterBoot / 2,
      errors: errs,
    };
    // پنجره بسته نمی‌شود؛ بستن با فریم‌های معلق rAF در jsdom خطا می‌دهد.
  }
  times.sort((a, b) => a - b);
  out.boot = { ...stats, bootMsMedian: times[Math.floor(times.length / 2)], runs: times };
}

/* ---------- D) مقیاس داده: هزینه‌ی JSON و سقف localStorage ---------- */
function scale() {
  const rec = i => ({
    id: 1700000000000 + i, documentNumber: i + 1,
    title: 'خرید اقلام مصرفی پروژه طراحی وب‌سایت شرکت',
    category: 'هزینه‌های جاری', amount: 1450000 + (i % 9000) * 1000,
    date: '1405/07/24', type: i % 7 === 0 ? 'income' : 'expense',
    account: 'حساب جاری بانک ملت', destinationAccount: undefined,
    project: i % 5 === 0 ? 'پروژه وب‌سایت' : undefined,
    familyMember: i % 11 === 0 ? 'خانواده' : undefined,
    notes: i % 3 === 0 ? 'یادداشت نمونه برای سنجش اندازه‌ی رکورد' : undefined,
  });
  const res = {};
  for (const n of [1000, 10000, 50000, 100000]) {
    const data = Array.from({ length: n }, (_, i) => rec(i));
    const t0 = process.hrtime.bigint();
    const json = JSON.stringify(data);
    const t1 = process.hrtime.bigint();
    JSON.parse(json);
    const t2 = process.hrtime.bigint();
    const bytes = Buffer.byteLength(json);
    res[n] = {
      jsonBytes: bytes, kb: +(bytes / 1024).toFixed(0), bytesPerRecord: +(bytes / n).toFixed(0),
      stringifyMs: +(Number(t1 - t0) / 1e6).toFixed(1), parseMs: +(Number(t2 - t1) / 1e6).toFixed(1),
      multipleOf5MB: +(bytes / (5 * 1024 * 1024)).toFixed(2),
    };
  }
  out.scale = res;
}

(async () => {
  scale();
  await boot();
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(0);
})();
