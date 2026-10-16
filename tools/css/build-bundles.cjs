#!/usr/bin/env node
/*
 * ادغام فایل‌های CSS به بسته‌های مرتب (مرحله ۳)
 *
 * چرا بی‌خطر است؟
 *   آبشار (cascade) به «ترتیب قاعده‌ها» حساس است، نه به «تعداد فایل». این ابزار فقط فایل‌های
 *   *پیوسته* در ترتیب لینک‌های index.html را در یک فایل جمع می‌کند و جای آن‌ها را هم عوض نمی‌کند،
 *   پس ترتیب قاعده‌ها بیت‌به‌بیت حفظ می‌شود. هیچ @import و @charset هم در پروژه وجود ندارد
 *   (این دو تنها مواردی بودند که ادغام می‌توانست معنای فایل را عوض کند).
 *
 * اثبات در همان اجرا:
 *   ۱) فهرست «امضای قاعده‌ها» (at-rule + سلکتور + بدنه) قبل و بعد ساخته می‌شود و باید
 *      عنصر‌به‌عنصر برابر باشند (SHA-256 هر دو در docs/css-bundle-verification.json ثبت می‌شود).
 *   ۲) بایت‌های حذف‌شده = بایت‌های افزوده‌شده منهای سرصفحه‌ی توضیحی هر بسته.
 *   ۳) دانستن اینکه فایلی که آزمون‌ها به آن ارجاع می‌دهند (043) و لایه‌ی پچ رابط (235)
 *      جدا نگه داشته می‌شوند.
 *
 * کاربرد:
 *   node tools/css/build-bundles.cjs --verify  → بررسی وضعیت فعلی با سند اثبات (بعد از ادغام)
 *   node tools/css/build-bundles.cjs --check   → فقط بررسی نقشه‌ی بسته‌ها (بدون نوشتن)
 *   node tools/css/build-bundles.cjs           → ساخت بسته‌ها، بازنویسی index.html و حذف فایل‌های اصلی
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseCss } = require('../bench/css-parser.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const STYLES = path.join(ASSETS, 'src/styles');
const INDEX = path.join(ASSETS, 'index.html');
const CHECK_ONLY = process.argv.includes('--check');
const VERIFY_ONLY = process.argv.includes('--verify');

/* فایل‌هایی که عمداً جدا می‌مانند:
 *   043 → آزمون performance-regression آن را با مسیر دقیق می‌خواند و نبودِ انیمیشن ورود را چک می‌کند
 *   235 → لایه‌ی پچ رابط (مرحله‌ی قبل)؛ جدا ماندنش بازبینی و بازگردانی آن را ساده می‌کند */
const STANDALONE = ['043-hesabno-page-open-close-motion.css', '235-hesabno-text-root-and-display-stability.css'];

const BUNDLES = [
  {
    name: '010-core-base.css',
    note: 'پایه: متغیرهای ریشه، فونت محلی و بسته‌ی اصلی inline',
    files: ['002-inline.css', '011-hesabno-local-font.css', '012-inline.css'],
  },
  {
    name: '020-core-fixes.css',
    note: 'لایه‌های اصلاحی هسته (چیدمان، موبایل، پیش‌فرض‌ها)',
    files: ['013-inline.css', '014-inline.css', '015-inline.css', '016-inline.css', '017-inline.css', '018-inline.css',
      '019-inline.css', '020-inline.css', '021-inline.css', '022-inline.css', '023-inline.css', '026-inline.css',
      '027-inline.css', '028-inline.css', '030-inline.css', '031-inline.css', '032-inline.css', '033-inline.css',
      '034-inline.css', '035-inline.css', '036-inline.css', '037-inline.css', '038-inline.css', '039-inline.css',
      '040-inline.css', '041-hesabno-light-balance.css', '042-hesabno-tab-motion.css'],
  },
  {
    name: '030-light-settings-fixes.css',
    note: 'اصلاحات حالت روشن و تنظیمات (044 و 045؛ 043 عمداً جدا است)',
    files: ['044-hesabno-light-settings-accounts.css', '045-hesabno-light-settings-divider-lines.css'],
  },
  {
    name: '040-settings-and-validation.css',
    note: 'تنظیمات، هشدارهای اعتبارسنجی، فریم‌های اعلان و پانویس‌ها',
    files: ['046-hesabno-settings-cards-notification-tabs.css', '047-hesabno-inline-check-alert-options.css',
      '048-hesabno-toast-and-notification-badge-fix.css', '049-hesabno-mobile-typography.css',
      '050-hesabno-project-family-management.css', '051-hesabno-final-polish.css',
      '052-hesabno-full-page-side-motion.css', '053-hesabno-account-picker-fullscreen.css',
      '054-hesabno-inline-validation-warnings.css', '055-hesabno-inline-validation-warnings-v2.css',
      '056-hesabno-inline-validation-warnings-v3.css', '057-hesabno-account-header-light-mode.css',
      '058-hesabno-fullscreen-selection-modals.css', '060-hesabno-accessibility-fixes.css',
      '062-hesabno-stable-page-geometry.css', '063-hesabno-modal-on-top.css', '064-hesabno-semantic-footnotes.css'],
  },
  {
    name: '050-late-legacy-overrides.css',
    note: 'بازنویسی‌های پایانی دوره‌ی قدیم (۹۰۰–۹۷۰) که پیش از لایه‌ی ۲۳۵ لینک شده‌اند',
    files: ['900-light-theme-contrast.css', '950-amount-box-height.css', '960-sticky-submit.css',
      '965-bank-form-sticky-footer.css', '970-note-textarea.css'],
  },
  {
    name: '060-reports-and-motion.css',
    note: 'گزارش‌ها، نمودارها و لایه‌های حرکت/پایداری حرکت',
    files: ['081-hesabno-reversal-and-light-meta.css', '082-hesabno-report-light-header.css',
      '083-hesabno-chart-edge-tooltip.css', '084-hesabno-chart-tooltip-default.css',
      '085-hesabno-trial-balance-layout.css', '086-hesabno-document-catalog-picker.css',
      '088-hesabno-report-chart-colors.css', '089-hesabno-fixed-dashboard-styles.css',
      '097-hesabno-account-statement-styles.css', '100-hesabno-transaction-day-header-styles.css',
      '103-hesabno-blur-override.css', '123-hesabno-slower-motion.css', '124-hesabno-motion-stability.css',
      '125-hesabno-motion-performance.css', '126-hesabno-compact-widget-actions-style.css',
      '141-hesabno-restore-transaction-check-status.css', '149-hesabno-today-transactions-style.css',
      '151-hesabno-period-transaction-presentation-style.css'],
  },
  {
    name: '070-report-layouts.css',
    note: 'چیدمان گزارش‌ها، صورتحساب و جداول تفصیلی',
    files: ['153-hesabno-signed-money-direction.css', '155-hesabno-account-statement-transaction-styles.css',
      '157-hesabno-dashboard-category-account-icons.css', '158-hesabno-dashboard-category-widget-compact.css',
      '161-hesabno-category-report-account-icons-style.css', '163-hesabno-financial-resources-report-style.css',
      '165-hesabno-daily-report-presentation-style.css', '167-hesabno-balance-report-remove-extra-descriptions.css',
      '169-hesabno-balance-detail-codes-and-panel.css', '172-hesabno-statement-picker-remove-helper-copy.css',
      '174-hesabno-report-account-picker-copy-styles.css', '176-hesabno-detail-column-chart-layout.css',
      '178-hesabno-global-breakdown-copy-layout.css', '180-hesabno-advanced-reports-no-search.css',
      '181-hesabno-hide-subsidiary-account-codes-global.css', '183-hesabno-report-selection-label-spacing.css',
      '185-hesabno-account-statement-frame-and-column-alignme.css'],
  },
  {
    name: '080-report-cleanups.css',
    note: 'پاک‌سازی‌ها و اصلاحات پایانی گزارش‌ها و دسترسی‌پذیری',
    files: ['187-hesabno-summary-account-statement-cleanup-styles.css',
      '196-hesabno-installment-purchase-cleanup.css', '199-hesabno-menu-accessibility-styles.css',
      '206-hesabno-day-line-style.css', '209-hesabno-hide-user-and-fast-tabs.css',
      '210-hesabno-motion.css', '222-hesabno-report-account-detail-layout.css',
      '224-hesabno-date-action-contrast.css'],
  },
];

function linkedFiles(html) {
  return [...html.matchAll(/rel="stylesheet"[^>]*href="([^"]+)"/g)]
    .map((match) => match[1].replace(/\?.*$/, '').replace(/^src\/styles\//, ''));
}

/** امضای قاعده‌ها در ترتیب آبشار، برای اثبات برابری قبل/بعد */
function ruleSignatures(html, readFile) {
  const signatures = [];
  for (const file of linkedFiles(html)) {
    const { rules } = parseCss(readFile(file));
    for (const rule of rules) {
      signatures.push(`${rule.at.join('>')}|${rule.selector}|${rule.body}`);
    }
  }
  return signatures;
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const indexHtml = fs.readFileSync(INDEX, 'utf8');
const order = linkedFiles(indexHtml);

/* ---------- حالت --verify: وضعیت فعلی باید با سند اثبات بخواند ---------- */
if (VERIFY_ONLY) {
  const artifactPath = path.join(ROOT, 'docs/css-bundle-verification.json');
  if (!fs.existsSync(artifactPath)) {
    process.stderr.write('سند اثبات docs/css-bundle-verification.json پیدا نشد؛ ابتدا ادغام را اجرا کنید.\n');
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const current = ruleSignatures(indexHtml, (file) => {
    const full = path.join(STYLES, file);
    if (!fs.existsSync(full)) throw new Error(`فایل لینک‌شده وجود ندارد: ${file}`);
    return fs.readFileSync(full, 'utf8');
  });
  const currentHash = sha256(current.join('\n'));
  const ok = currentHash === artifact.cascadeEquality.hashAfter
    && current.length === artifact.cascadeEquality.rulesAfter
    && order.length === artifact.files.after;
  process.stderr.write(
    `حالت فعلی: ${order.length} فایل، ${current.length} قاعده، SHA-256 ${currentHash.slice(0, 16)}\n` +
    `سند اثبات: ${artifact.files.after} فایل، ${artifact.cascadeEquality.rulesAfter} قاعده، SHA-256 ${artifact.cascadeEquality.hashAfter.slice(0, 16)}\n` +
    `نتیجه: ${ok ? 'مطابق است ✓' : 'ناهمخوان — استایل‌ها پس از ادغام تغییر کرده‌اند؛ سند اثبات باید به‌روزرسانی شود'}\n`
  );
  process.exit(ok ? 0 : 1);
}

const onDisk = new Set(fs.readdirSync(STYLES));
const readStyle = (file) => fs.readFileSync(path.join(STYLES, file), 'utf8');

/* ---------- اعتبارسنجی نقشه‌ی بسته‌ها ---------- */
const mapped = [];
for (const bundle of BUNDLES) {
  for (const file of bundle.files) {
    if (!onDisk.has(file)) throw new Error(`فایل اعلام‌شده در بسته وجود ندارد: ${file}`);
    if (STANDALONE.includes(file)) throw new Error(`فایل باید مستقل بماند ولی در بسته آمده است: ${file}`);
    mapped.push(file);
  }
}
if (new Set(mapped).size !== mapped.length) throw new Error('یک فایل در بیش از یک بسته آمده است');
const uncovered = order.filter((file) => !mapped.includes(file) && !STANDALONE.includes(file));
if (uncovered.length) throw new Error(`فایل‌های پوشش‌داده‌نشده در ترتیب لینک: ${uncovered.join(', ')}`);

/* ترتیب بسته‌ها باید با ترتیب لینک سازگار باشد و هیچ بسته‌ای فایل‌های پراکنده نداشته باشد */
for (const bundle of BUNDLES) {
  const positions = bundle.files.map((file) => order.indexOf(file));
  if (positions.some((position) => position === -1)) throw new Error(`فایل بیرون از ترتیب لینک: ${bundle.name}`);
  const sorted = [...positions].sort((a, b) => a - b);
  if (positions.join() !== sorted.join()) throw new Error(`فایل‌های بسته‌ی ${bundle.name} پیوسته نیستند`);
  const gaps = sorted.slice(1).filter((position, index) => position !== sorted[index] + 1);
  if (gaps.length) throw new Error(`فایل‌های بسته‌ی ${bundle.name} پشت‌سرهم نیستند (فقط ترتیب مهم است ولی برای بازبینی ساده، پیوستگی می‌خواهیم)`);
}

const before = ruleSignatures(indexHtml, readStyle);
const beforeHash = sha256(before.join('\n'));
const beforeBytes = order.reduce((total, file) => total + Buffer.byteLength(readStyle(file)), 0);

/* ---------- ساخت بسته‌ها ---------- */
const bundleOutput = [];
let addedComments = 0;
for (const bundle of BUNDLES) {
  const header = `/* بسته‌ی ${bundle.name} | ${bundle.note}\n` +
    `   ادغام ${bundle.files.length} فایل با همان ترتیب آبشار: ${bundle.files.join(' ')} */\n`;
  let content = header;
  addedComments += Buffer.byteLength(header);
  for (const file of bundle.files) {
    const marker = `/* = ${file} = */\n`;
    content += marker;
    addedComments += Buffer.byteLength(marker);
    content += readStyle(file).replace(/\s*$/, '\n');
  }
  bundleOutput.push({ ...bundle, content });
}

const sourceBytesByBundle = BUNDLES.map((bundle) => bundle.files.reduce((total, file) => total + Buffer.byteLength(readStyle(file)), 0));

/* ---------- index.html جدید ---------- */
const tagForBundle = new Map(BUNDLES.map((bundle) => [bundle.files[0], bundle]));
let newIndex = indexHtml;
const replacedTags = [];
for (const match of [...indexHtml.matchAll(/[ \t]*<link\b[^>]*rel="stylesheet"[^>]*>[ \t]*\r?\n?/g)]) {
  const href = (/href="([^"]+)"/.exec(match[0]) || [])[1];
  if (!href) continue;
  const file = href.replace(/\?.*$/, '').replace(/^src\/styles\//, '');
  const bundle = tagForBundle.get(file);
  if (bundle) {
    replacedTags.push({ tag: match[0], replacement: match[0].replace(href, `src/styles/${bundle.name}?v=1`) });
  } else if (STANDALONE.includes(file)) {
    /* دست‌نخورده */
  } else {
    replacedTags.push({ tag: match[0], replacement: '' });
  }
}
for (const item of replacedTags) newIndex = newIndex.replace(item.tag, item.replacement);
newIndex = newIndex.replace(/\n{3,}/g, '\n\n');

/* ---------- اثبات پس از ادغام ---------- */
const newFiles = new Map(BUNDLES.map((bundle, index) => [bundle.name, bundleOutput[index].content]));
const fakeRead = (file) => {
  if (newFiles.has(file)) return newFiles.get(file);
  if (!onDisk.has(file)) throw new Error(`فایل ناشناخته در index.html جدید: ${file}`);
  return readStyle(file);
};
const after = ruleSignatures(newIndex, fakeRead);
const afterHash = sha256(after.join('\n'));

let mismatch = -1;
for (let index = 0; index < Math.max(before.length, after.length); index += 1) {
  if (before[index] !== after[index]) { mismatch = index; break; }
}
const equal = mismatch === -1 && before.length === after.length;

const afterBytes = [...newFiles.values()].reduce((total, content) => total + Buffer.byteLength(content), 0)
  + STANDALONE.reduce((total, file) => total + Buffer.byteLength(readStyle(file)), 0);

const verification = {
  root: ROOT,
  at: new Date().toISOString(),
  cascadeEquality: {
    equal,
    firstMismatch: mismatch,
    rulesBefore: before.length,
    rulesAfter: after.length,
    hashBefore: beforeHash,
    hashAfter: afterHash,
  },
  files: {
    before: order.length,
    after: BUNDLES.length + STANDALONE.length,
    standalones: STANDALONE,
    bundles: BUNDLES.map((bundle, index) => ({
      name: bundle.name, note: bundle.note, sources: bundle.files,
      sourceBytes: sourceBytesByBundle[index], bundleBytes: Buffer.byteLength(bundleOutput[index].content),
    })),
  },
  bytes: { before: beforeBytes, after: afterBytes, addedComments },
};

fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/css-bundle-verification.json'), JSON.stringify(verification, null, 2) + '\n');

process.stderr.write(
  `قاعده‌ها: ${before.length} → ${after.length} · برابری ترتیب آبشار: ${equal ? 'تأیید شد ✓' : `نقض شد (نخستین اختلاف: ${mismatch})`}\n` +
  `SHA-256 امضاها: ${beforeHash.slice(0, 16)} → ${afterHash.slice(0, 16)}\n` +
  `فایل‌ها: ${order.length} → ${BUNDLES.length + STANDALONE.length} · بایت‌ها: ${beforeBytes.toLocaleString('en-US')} → ${afterBytes.toLocaleString('en-US')} (+${addedComments} سرصفحه)\n`
);
if (!equal) {
  process.stderr.write('ادغام متوقف شد: ترتیب قاعده‌ها تغییر کرده است.\n');
  process.exit(1);
}
if (CHECK_ONLY) {
  process.stderr.write('حالت --check: چیزی نوشته نشد.\n');
  process.exit(0);
}

for (const [name, content] of newFiles) fs.writeFileSync(path.join(STYLES, name), content);
fs.writeFileSync(INDEX, newIndex);
let deleted = 0;
for (const bundle of BUNDLES) {
  for (const file of bundle.files) {
    fs.unlinkSync(path.join(STYLES, file));
    deleted += 1;
  }
}
process.stderr.write(`نوشته‌شده: ${BUNDLES.length} بسته · حذف‌شده: ${deleted} فایل · index.html به‌روزرسانی شد\n`);
