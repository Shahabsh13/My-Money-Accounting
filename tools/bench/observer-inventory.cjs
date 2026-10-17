#!/usr/bin/env node
/*
 * سیاهه‌ی MutationObserver — گام ۰ مرحله ۴ (صفر تغییر در کد برنامه)
 *
 * دو لایه اندازه‌گیری:
 *   ۱) ایستا: از متن ۱۳۵ اسکریپت، هر `new MutationObserver(...)` را با target و گزینه‌های
 *      `.observe(...)` (childList/subtree/attributes/characterData و attributeFilter) بیرون می‌کشد.
 *   ۲) پویا: پیش از بوت در jsdom، `window.MutationObserver` را با یک زیرکلاس شمارنده جایگزین می‌کند
 *      تا معلوم شود در عمل چند observer ساخته می‌شود، روی چه چیزی، چند بار شلیک می‌کند و
 *      چه مقدار از آن مربوط به «بوت» است و چه مقدار «بعد از بوت».
 *
 * خروجی: JSON روی stdout (برای diff قبل/بعد) + خلاصه روی stderr
 * کاربرد: node tools/bench/observer-inventory.cjs > docs/dom-observer-inventory.json
 */
const fs = require('node:fs');
const path = require('node:path');

const { serve } = require('./local-server.cjs');
const rootArg = (process.argv.find((value) => value.startsWith('--root=')) || '').split('=')[1];
const ROOT = rootArg ? path.resolve(rootArg) : (process.argv[2] && !process.argv[2].startsWith('--') ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..', '..'));
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const SCRIPTS = path.join(ASSETS, 'src/scripts');

/* ---------------- ۱) اسکن ایستا ---------------- */

/** متن داخل پرانتز متوازن که از index+1 شروع می‌شود */
function balanced(text, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < text.length; index += 1) {
    const ch = text[index];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex, index + 1);
    }
  }
  return text.slice(openIndex, Math.min(text.length, openIndex + 400));
}

function optionsSummary(text) {
  const flags = ['childList', 'subtree', 'attributes', 'characterData', 'attributeOldValue', 'characterDataOldValue'];
  const summary = {};
  for (const flag of flags) {
    const match = new RegExp(`${flag}\\s*:\\s*(!0|true|!1|false)`).exec(text);
    if (match) summary[flag] = /!0|true/.test(match[1]);
  }
  const filter = /attributeFilter\s*:\s*(\[[^\]]*\])/.exec(text);
  if (filter) {
    summary.attributeFilter = [...filter[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
  }
  return summary;
}

const staticFindings = [];
const files = fs.readdirSync(SCRIPTS).filter((file) => file.endsWith('.js'));
for (const file of files) {
  const text = fs.readFileSync(path.join(SCRIPTS, file), 'utf8');
  const re = /new MutationObserver\s*\(/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const createIndex = match.index;
    const callback = balanced(text, match.index + match[0].length - 1);
    const tail = text.slice(createIndex + match[0].length + callback.length, createIndex + match[0].length + callback.length + 900);
    const observeIndex = tail.indexOf('.observe(');
    let target = null;
    let options = {};
    if (observeIndex > -1) {
      const args = balanced(tail, observeIndex + '.observe('.length - 1);
      const parts = args.slice(1, -1);
      const commaIndex = parts.lastIndexOf('}');
      if (commaIndex > -1) {
        target = parts.slice(0, parts.indexOf(',')).trim().slice(0, 120);
        options = optionsSummary(parts.slice(commaIndex));
      } else {
        target = parts.trim().slice(0, 120);
      }
    }
    staticFindings.push({
      file,
      callbackBytes: callback.length,
      target,
      options,
      disconnectCall: /\.disconnect\(\)/.test(text.slice(createIndex, createIndex + 3000)),
      setTimeoutInside: /setTimeout\s*\(/.test(callback),
      requestAnimationFrameInside: /requestAnimationFrame\s*\(/.test(callback),
    });
  }
}

const staticByFile = {};
for (const finding of staticFindings) staticByFile[finding.file] = (staticByFile[finding.file] || 0) + 1;

/* ---------------- ۲) اندازه‌گیری پویا ---------------- */

function describe(target) {
  if (!target || typeof target !== 'object') return String(target);
  if (target.nodeType === 9) return '#document';
  const id = target.id ? `#${target.id}` : '';
  const classes = target.classList && target.classList.length
    ? `.${[...target.classList].slice(0, 3).join('.')}`
    : '';
  return `${target.tagName || '?'}${id}${classes}`;
}

(async () => {
  const { JSDOM, VirtualConsole } = require('jsdom');
  const virtualConsole = new VirtualConsole();
  const errors = [];
  virtualConsole.on('jsdomError', (error) => {
    if (!/getContext/.test(String(error.message))) errors.push(String(error.message).slice(0, 140));
  });

  const records = [];
  let booted = false;
  let settleStart = 0;

  const server = await serve(ASSETS);
  const dom = await JSDOM.fromFile(path.join(ASSETS, 'index.html'), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    url: server.url + '/index.html',
    beforeParse(window) {
      const Real = window.MutationObserver;
      window.__observerInventory = records;
      class TrackingObserver extends Real {
        constructor(callback) {
          const stack = (new Error().stack || '').split('\n')
            .map((line) => line.trim())
            .find((line) => /src\/scripts\/\d|src\/scripts\/[a-z]/i.test(line)) || 'unknown';
          const entry = {
            id: records.length,
            createdFrom: (stack.match(/src\/scripts\/([^:?]+)/) || [])[1] || stack.slice(0, 80),
            target: null,
            options: null,
            calls: 0,
            bootCalls: 0,
            settleCalls: 0,
            records: 0,
            bootRecords: 0,
            settleRecords: 0,
          };
          super((list, observer) => {
            entry.calls += 1;
            entry.records += list.length;
            if (booted) { entry.settleCalls += 1; entry.settleRecords += list.length; }
            else { entry.bootCalls += 1; entry.bootRecords += list.length; }
            return callback(list, observer);
          });
          this.__entry = entry;
          records.push(entry);
        }
        observe(target, options) {
          this.__entry.target = describe(target);
          this.__entry.options = options ? { ...options } : {};
          return super.observe(target, options);
        }
      }
      window.MutationObserver = TrackingObserver;
    },
  });

  const window = dom.window;
  const document = window.document;
  const startedAt = Date.now();
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      const root = document.getElementById('root');
      if (root && root.innerHTML.length > 2000) { clearInterval(timer); resolve(); }
      if (Date.now() - startedAt > 45000) { clearInterval(timer); resolve(); }
    }, 25);
  });
  await new Promise((resolve) => setTimeout(resolve, 2000));
  booted = true;
  settleStart = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const runtime = records.map((entry) => ({
    createdFrom: entry.createdFrom,
    target: entry.target,
    options: entry.options,
    calls: entry.calls,
    bootCalls: entry.bootCalls,
    settleCalls: entry.settleCalls,
    records: entry.records,
  }));

  const duplicates = {};
  for (const entry of runtime) {
    const key = `${entry.target}::${JSON.stringify(entry.options || {})}`;
    duplicates[key] = (duplicates[key] || 0) + 1;
  }

  const result = {
    root: ROOT,
    at: new Date().toISOString(),
    static: {
      filesScanned: files.length,
      observers: staticFindings.length,
      byFile: Object.entries(staticByFile).sort((a, b) => b[1] - a[1]),
      findings: staticFindings,
    },
    runtime: {
      observersCreated: runtime.length,
      totalCalls: runtime.reduce((total, entry) => total + entry.calls, 0),
      bootCalls: runtime.reduce((total, entry) => total + entry.bootCalls, 0),
      settleCalls: runtime.reduce((total, entry) => total + entry.settleCalls, 0),
      totalRecords: runtime.reduce((total, entry) => total + entry.records, 0),
      settleMs: Date.now() - settleStart,
      errors,
      observers: runtime,
      duplicatedTargets: Object.entries(duplicates).filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]),
    },
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  const settleSeconds = (Date.now() - settleStart) / 1000;
  process.stderr.write(
    `ایستا: ${staticFindings.length} observer در ${Object.keys(staticByFile).length} فایل از ${files.length} فایل اسکریپت\n` +
    `پویا: ${runtime.length} observer ساخته شد · ${result.runtime.totalCalls} شلیک (بوت ${result.runtime.bootCalls} / بعد از بوت ${result.runtime.settleCalls})\n` +
    `رخدادها: ${result.runtime.totalRecords} · جهش/ثانیه بعد از بوت: ${(result.runtime.settleCalls / settleSeconds).toFixed(1)}\n` +
    `هدف‌های تکراری (قابل ادغام): ${result.runtime.duplicatedTargets.length}\n` +
    `خطاها: ${errors.length}\n`
  );
  process.exit(0);
})();
