#!/usr/bin/env node
/*
 * شاهد برابری DOM — ابزار تأیید مرحله ۴
 *
 * برای هر مهاجرت observer لازم است ثابت شود «نتیجه‌ی نهایی روی DOM» عوض نشده است.
 * چکیده فقط DOM رندرشده (زیر <body>) را می‌گیرد؛ تعداد اسکریپت/استایل‌های <head> جداگانه شمرده می‌شود
 * تا سیم‌کشی تازه در <head> چکیده را به‌دردسر نیندازد.
 * این ابزار برنامه را در jsdom بوت می‌کند، پس از آرام‌شدن، یک «چکیده‌ی متعارف» از کل DOM می‌سازد:
 *   ترتیب عناصر، تگ، id، فهرست کلاس‌ها، ویژگی‌های data-*، style درون‌خطی، طول متن هر عنصر
 * و سپس SHA-256 می‌گیرد. با --diff می‌توان دو اجرا را عنصر‌به‌عنصر مقایسه کرد.
 *
 * چرا این شاهد معتبر است؟ رفتار لایه‌های CSS/observer این برنامه با «کلاس‌ها و ویژگی‌های
 * data-* روی عناصر» تعریف می‌شود؛ اگر چکیده یکسان بماند، هیچ قاعده‌ی CSS نمی‌تواند نتیجه‌ی
 * متفاوتی بگیرد. چیزی که این ابزار پوشش نمی‌دهد (و صریح گزارش می‌شود): ترتیب زمانی اجرای
 * callbackها، و ظاهر واقعی روی دستگاه/مرورگر.
 *
 * کاربرد:
 *   node tools/bench/dom-equivalence.cjs --out /tmp/before.json
 *   node tools/bench/dom-equivalence.cjs --diff /tmp/before.json
 *
 * نکته‌ی «چکیده‌ی نرمال‌شده»: بعضی لایه‌های انیمیشن کلاس‌هایی می‌گذارند که هیچ قاعده‌ی CSS ندارند
 * (مثل hesabno-home-header-enter در لایه‌ی ۲۱۵) و بودن/نبودنشان به «تشخیص گذر صفحه در همان لحظه»
 * بستگی دارد؛ پس زمان‌بندی خالص است و اثری روی رندر ندارد. برای این‌گونه کلاس‌ها می‌توان با
 * --ignore-class=NAME (تکرارشدنی) آن‌ها را از چکیده بیرون گذاشت؛ فهرست نرمال‌شده در خروجی JSON و
 * در گزارش مقایسه ثبت می‌شود تا هیچ چیزی پنهان نماند.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { serve } = require('./local-server.cjs');
const rootArg = (process.argv.find((value) => value.startsWith('--root=')) || '').split('=')[1];
const ROOT = rootArg ? path.resolve(rootArg) : path.resolve(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const outIndex = process.argv.indexOf('--out');
const diffIndex = process.argv.indexOf('--diff');
const OUT = outIndex > -1 ? process.argv[outIndex + 1] : null;
const DIFF = diffIndex > -1 ? process.argv[diffIndex + 1] : null;
const IGNORED_CLASSES = new Set(process.argv
  .map((value, index) => (value.startsWith('--ignore-class=') ? value.slice('--ignore-class='.length)
    : (value === '--ignore-class' ? process.argv[index + 1] : null)))
  .filter(Boolean));
let strippedClasses = 0;
/* کلاس‌هایی که در هیچ فایل CSS تعریف نشده‌اند: بودن/نبودنشان رندر را تغییر نمی‌دهد */
const cssText = process.argv.map(() => '').join('');
function loadedCssText() {
  try {
    const stylesDir = path.join(ASSETS, 'src/styles');
    return fs.readdirSync(stylesDir).filter((file) => file.endsWith('.css'))
      .map((file) => fs.readFileSync(path.join(stylesDir, file), 'utf8')).join('\n');
  } catch (error) { return ''; }
}
function orphanClasses(classes) {
  const sheet = loadedCssText();
  return classes.filter((name) => name && !sheet.includes('.' + name));
}

/*
 * شورت‌هندهایی که اگر همراه با longhand خودشان در یک استایل درون‌خطی بیایند، «ترتیب»
 * اهمیت پیدا می‌کند (مثل background و background-color). اگر هیچ شورت‌هندی در مجموعه نباشد،
 * ترتیب اعلان‌ها روی نتیجه‌ی نهایی اثری ندارد و برای مقایسه مرتب می‌شود.
 */
const SHORTHAND_PARTS = {
  background: ['background-color', 'background-image', 'background-position', 'background-size', 'background-repeat', 'background-origin', 'background-clip', 'background-attachment'],
  border: ['border-width', 'border-style', 'border-color', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
  'border-top': [], 'border-right': [], 'border-bottom': [], 'border-left': [],
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  font: ['font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'line-height'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
  gap: ['row-gap', 'column-gap'],
  inset: ['top', 'right', 'bottom', 'left'],
  outline: ['outline-color', 'outline-style', 'outline-width'],
  overflow: ['overflow-x', 'overflow-y'],
  animation: ['animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-fill-mode', 'animation-play-state'],
  transition: ['transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay'],
  'text-decoration': ['text-decoration-line', 'text-decoration-style', 'text-decoration-color', 'text-decoration-thickness'],
  'list-style': ['list-style-type', 'list-style-position', 'list-style-image'],
  'grid-template': ['grid-template-rows', 'grid-template-columns', 'grid-template-areas'],
  'border-radius': ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'],
};

function parseInlineStyle(value) {
  return value.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const at = part.indexOf(':');
    return at === -1 ? null : { property: part.slice(0, at).trim().toLowerCase(), value: part.slice(at + 1).trim() };
  }).filter(Boolean);
}

/* ترتیب اعلان‌های استایل درون‌خطی: اگر شورت‌هندی در کار نباشد، ترتیب بی‌اثر است */
function canonicalizeInlineStyle(value) {
  const declarations = parseInlineStyle(value);
  if (!declarations.length) return { text: '', orderSensitive: false, sorted: false };
  const properties = new Set(declarations.map((item) => item.property));
  const risky = declarations.some((item) => SHORTHAND_PARTS[item.property] !== undefined
    && SHORTHAND_PARTS[item.property].some((longhand) => properties.has(longhand)));
  const text = declarations.map((item) => `${item.property}: ${item.value}`).join('; ');
  if (risky) return { text, orderSensitive: true, sorted: false };
  const sorted = [...declarations].sort((a, b) => a.property.localeCompare(b.property))
    .map((item) => `${item.property}: ${item.value}`).join('; ');
  return { text: sorted, orderSensitive: false, sorted: text !== sorted };
}

let normalizedStyleOrders = 0;

function canonicalizeAttribute(name, value) {
  if (name === 'style') {
    const canonical = canonicalizeInlineStyle(value);
    if (canonical.sorted) normalizedStyleOrders += 1;
    return canonical.text;
  }
  if (name === 'class') return value.replace(/\s+/g, ' ').trim();
  if (name === 'src' || name === 'href') {
    /*
     * شماره‌ی نسخه (?v=16) برای شکستن کش مرورگر است، نه تغییر ساختار DOM.
     * اگر داخل چکیده بماند، هر بامپ نسخه یک «تغییر DOM» جعلی می‌سازد و قفل
     * رگرسیون را بی‌اثر می‌کند. پس فقط پارامتر v حذف می‌شود.
     */
    return value.replace(/([?&])v=[^&]*/g, '$1v=').replace(/[?&]$/, '').replace(/\s+/g, ' ').trim();
  }
  return value.replace(/\s+/g, ' ').trim();
}

function digestElement(element) {
  let classes = element.getAttribute('class') || '';
  if (IGNORED_CLASSES.size) {
    classes = classes.split(/\s+/).filter((name) => {
      if (!IGNORED_CLASSES.has(name)) return true;
      strippedClasses += 1;
      return false;
    }).join(' ');
  }
  const attributes = [];
  for (const attribute of [...element.attributes].sort((a, b) => a.name.localeCompare(b.name))) {
    if (attribute.name === 'class') continue;
    if (['id', 'style', 'src', 'href', 'type', 'value', 'role', 'aria-hidden', 'aria-label', 'aria-expanded', 'aria-current', 'disabled', 'checked', 'hidden', 'tabindex', 'dir', 'lang'].includes(attribute.name)
      || attribute.name.startsWith('data-')) {
      attributes.push(`${attribute.name}=${canonicalizeAttribute(attribute.name, attribute.value)}`);
    }
  }
  const text = (element.childNodes.length && [...element.childNodes]
    .filter((node) => node.nodeType === 3)
    .map((node) => node.textContent.replace(/\s+/g, ' ').trim())
    .join(' ')
    .trim()) || '';
  return `${element.tagName.toLowerCase()}#${element.id || ''}.${classes.replace(/\s+/g, '.')}|${attributes.join(',')}|${text.slice(0, 120)}`;
}

(async () => {
  const { JSDOM, VirtualConsole } = require('jsdom');
  const virtualConsole = new VirtualConsole();
  const errors = [];
  virtualConsole.on('jsdomError', (error) => {
    if (!/getContext/.test(String(error.message))) errors.push(String(error.message).slice(0, 140));
  });

  /* سرور موقت با ریشه‌ی همین درخت: سنجش هرگز از سرور پیش‌نمایش بیرونی تغذیه نمی‌شود */
  const server = await serve(ASSETS);
  const dom = await JSDOM.fromFile(path.join(ASSETS, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole,
    url: server.url + '/index.html',
  });
  const document = dom.window.document;
  const startedAt = Date.now();
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      const root = document.getElementById('root');
      if (root && root.innerHTML.length > 2000) { clearInterval(timer); resolve(); }
      if (Date.now() - startedAt > 45000) { clearInterval(timer); resolve(); }
    }, 25);
  });
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const elements = [document.body, ...document.body.querySelectorAll('*')];
  const digests = elements.filter(Boolean).map(digestElement);
  const hash = crypto.createHash('sha256').update(digests.join('\n')).digest('hex');
  const result = {
    root: ROOT,
    at: new Date().toISOString(),
    hash,
    counts: {
      elements: elements.filter(Boolean).length,
      headScripts: document.head.querySelectorAll('script').length,
      headStylesheets: document.head.querySelectorAll('link[rel="stylesheet"]').length,
      classes: elements.reduce((total, element) => total + (element.getAttribute('class') || '').split(/\s+/).filter(Boolean).length, 0),
      dataAttributes: elements.reduce((total, element) => total + [...element.attributes].filter((attribute) => attribute.name.startsWith('data-')).length, 0),
      inlineStyles: elements.filter((element) => (element.getAttribute('style') || '').trim()).length,
      rootHtmlBytes: (document.getElementById('root') || { innerHTML: '' }).innerHTML.length,
      textHash: crypto.createHash('sha256').update((document.body.textContent || '').replace(/\s+/g, ' ').trim()).digest('hex'),
    },
    errors,
    digests,
    ignoredClasses: [...IGNORED_CLASSES].sort(),
    strippedClasses,
    normalizedStyleOrders,
  };

  if (OUT) fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
  process.stderr.write(
    `چکیده DOM: ${hash.slice(0, 16)} · عناصر ${result.counts.elements} · کلاس‌ها ${result.counts.classes} · data-* ${result.counts.dataAttributes} · inline ${result.counts.inlineStyles} · HTML ریشه ${result.counts.rootHtmlBytes}\n` +
    `متن: ${result.counts.textHash.slice(0, 16)} · خطاها: ${errors.length}` +
    (IGNORED_CLASSES.size ? ` · کلاس‌های نرمال‌شده: ${[...IGNORED_CLASSES].sort().join(', ')} (${strippedClasses} مورد حذف شد)` : '') +
    ` · ترتیب استایل درون‌خطی نرمال‌شده: ${normalizedStyleOrders}\n`
  );
  if (IGNORED_CLASSES.size) {
    for (const name of IGNORED_CLASSES) {
      const orphan = orphanClasses([name]).length > 0;
      process.stderr.write(`   ${name}: ${orphan ? 'هیچ قاعده‌ی CSS ندارد (بی‌اثر روی رندر) ✓' : 'قاعده‌ی CSS دارد — نرمال‌سازی آن توجیه‌نشده است ✗'}\n`);
    }
  }

  if (DIFF) {
    const other = JSON.parse(fs.readFileSync(DIFF, 'utf8'));
    const first = other.digests || [];
    const second = digests;
    const length = Math.max(first.length, second.length);
    const differences = [];
    for (let index = 0; index < length; index += 1) {
      if (first[index] !== second[index]) {
        differences.push({ index, before: (first[index] || '(ندارد)').slice(0, 200), after: (second[index] || '(ندارد)').slice(0, 200) });
        if (differences.length >= 25) break;
      }
    }
    process.stderr.write(
      `مقایسه با ${path.basename(DIFF)}: ${differences.length === 0 && first.length === second.length ? 'کاملاً یکسان ✓' : `${differences.length} تفاوت`}\n`
    );
    for (const difference of differences) {
      process.stderr.write(`  #${difference.index}\n    قبل: ${difference.before}\n    بعد: ${difference.after}\n`);
    }
    if (first.length !== second.length) {
      process.stderr.write(`  تعداد عناصر: قبل ${first.length} · بعد ${second.length}\n`);
    }
    process.exit(differences.length === 0 && first.length === second.length ? 0 : 1);
  }
  process.exit(0);
})();
