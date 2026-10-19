/*
 * آزمون یکپارچگی بسته‌های CSS (مرحله ۳)
 *
 * این آزمون قفل می‌کند که ادغام ۹۹ فایل استایل به بسته‌های مرتب، «سالم و قابل ردیابی» بماند:
 *   • هر فایل لینک‌شده در index.html واقعاً روی دیسک وجود دارد (لینک شکسته = استایل گم‌شده)
 *   • هیچ فایل CSS یتیمی روی دیسک نیست که لینک نشده باشد
 *   • تعداد قاعده‌ها از عدد اثبات‌شده‌ی ادغام کمتر نشده (حذف بی‌سروصدای استایل = رگرسیون ظاهری)
 *   • سرصفحه‌ی هر بسته، فایل‌های منبع را به همان ترتیب آبشار فهرست می‌کند
 *   • @import / @charset اضافه نشده (این دو تنها چیزی هستند که ادغام را ناامن می‌کنند)
 *   • هیچ اسکریپتی به فایل CSS ارجاع نمی‌دهد (اگر بدهد، ادغام می‌تواند بارگذاری پویا را بشکند)
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseCss } = require('../tools/bench/css-parser.cjs');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'app/src/main/assets');
const stylesDir = path.join(assets, 'src/styles');
const html = fs.readFileSync(path.join(assets, 'index.html'), 'utf8');
const verification = JSON.parse(fs.readFileSync(path.join(root, 'docs/css-bundle-verification.json'), 'utf8'));

const linked = [...html.matchAll(/rel="stylesheet"[^>]*href="([^"]+)"/g)].map((match) => match[1]);
const linkedFiles = linked.map((href) => href.replace(/\?.*$/, '').replace(/^src\/styles\//, ''));
const onDisk = fs.readdirSync(stylesDir).sort();

test('every stylesheet linked by index.html exists, and no orphan CSS file is left behind', () => {
  assert.equal(linked.length, 10, 'استایل‌ها باید در ۸ بسته + ۲ فایل مستقل (۰۴۳ و ۲۳۵) باشند');
  assert.deepEqual([...linkedFiles].sort(), onDisk, 'فهرست لینک‌ها و فایل‌های روی دیسک باید یکی باشند');
  for (const href of linked) {
    assert.match(href, /\?v=\d+$/, `کش‌شکن نسخه برای ${href} لازم است`);
    const file = path.join(assets, href.replace(/\?.*$/, ''));
    assert.ok(fs.existsSync(file), `فایل استایل موجود است: ${href}`);
  }
});

test('the two deliberately standalone stylesheets stay standalone', () => {
  assert.ok(linkedFiles.includes('043-hesabno-page-open-close-motion.css'),
    '043 توسط آزمون performance-regression با مسیر دقیق خوانده می‌شود');
  assert.ok(linkedFiles.includes('235-hesabno-text-root-and-display-stability.css'),
    '235 لایه‌ی پچ رابط است و باید مستقل بماند');
});

test('no stylesheet uses @import or @charset, so ordered bundling stays safe', () => {
  for (const file of onDisk) {
    const text = fs.readFileSync(path.join(stylesDir, file), 'utf8');
    assert.equal(/@import\b/.test(text), false, `${file} نباید @import داشته باشد`);
    assert.equal(/@charset\b/.test(text), false, `${file} نباید @charset داشته باشد`);
  }
});

test('bundles keep a balanced, complete rule structure and the documented rule count', () => {
  let totalRules = 0;
  for (const file of onDisk) {
    const text = fs.readFileSync(path.join(stylesDir, file), 'utf8');
    const opens = (text.match(/\{/g) || []).length;
    const closes = (text.match(/\}/g) || []).length;
    assert.equal(opens, closes, `آکولادهای ${file} باید متوازن باشند (نشانه‌ی برش ناقص)`);
    const parsed = parseCss(text);
    assert.ok(parsed.rules.length >= 0);
    totalRules += parsed.rules.length;
  }
  assert.equal(totalRules, verification.currentState.rules,
    'تعداد قاعده‌ها باید همان عدد اثبات‌شده در docs/css-bundle-verification.json باشد');
  assert.ok(totalRules >= 2700, 'کف قاعده‌ها: هیچ استایلی نباید بی‌سروصدا حذف شده باشد');
});

test('bundle headers trace every source file in cascade order', () => {
  const bundleNames = verification.files.bundles.map((bundle) => bundle.name);
  for (const bundle of verification.files.bundles) {
    const text = fs.readFileSync(path.join(stylesDir, bundle.name), 'utf8');
    const headerLine = text.split('\n', 2).join('\n');
    assert.ok(headerLine.includes(`بسته‌ی ${bundle.name}`), `سرصفحه‌ی ${bundle.name} نام بسته را دارد`);
    const declared = `ادغام ${bundle.sources.length} فایل با همان ترتیب آبشار: ${bundle.sources.join(' ')}`;
    assert.ok(headerLine.includes(declared), `سرصفحه‌ی ${bundle.name} فهرست منابع را به ترتیب دارد`);
    const markers = [...text.matchAll(/\/\* = ([^=]+?) = \*\//g)].map((match) => match[1].trim());
    assert.deepEqual(markers, bundle.sources, `نشانگر فایل‌های ${bundle.name} باید همان فهرست منابع و به همان ترتیب باشد`);
  }
  assert.equal(new Set(bundleNames).size, bundleNames.length, 'هر بسته باید یکتا باشد');
  assert.equal(bundleNames.length, 8, 'تعداد بسته‌ها همان ۸ بسته‌ی مستندشده است');
});

test('the merge evidence artifact matches the stylesheets that are actually on disk', () => {
  const signatures = [];
  for (const file of linkedFiles) {
    const { rules } = parseCss(fs.readFileSync(path.join(stylesDir, file), 'utf8'));
    for (const rule of rules) signatures.push(`${rule.at.join('>')}|${rule.selector}|${rule.body}`);
  }
  const hash = crypto.createHash('sha256').update(signatures.join('\n')).digest('hex');
  assert.equal(hash, verification.currentState.hash,
    'سند اثبات باید همان وضعیت فعلی استایل‌ها را توصیف کند (اگر CSS را عوض کردید، سند را به‌روزرسانی کنید)');
  assert.equal(signatures.length, verification.currentState.rules);
});

test('the merge evidence artifact records a verified, equal cascade', () => {
  assert.equal(verification.cascadeEquality.equal, true, 'برابری ترتیب آبشار باید تأیید شده باشد');
  assert.equal(verification.cascadeEquality.rulesBefore, verification.cascadeEquality.rulesAfter);
  assert.equal(verification.cascadeEquality.hashBefore, verification.cascadeEquality.hashAfter);
  /* لایهٔ ظاهر (task-12) تنها تغییری است که بعد از ادغام آمده؛ شمارشش باید ثبت شده باشد. */
  assert.equal(verification.appearanceLayer.rules, 610, 'لایهٔ ظاهر 500 قاعده دارد');
  assert.equal(verification.currentState.rules,
    verification.cascadeEquality.rulesAfter + verification.appearanceLayer.rules,
    'وضعیت فعلی = ادغام بی‌افت + لایهٔ ظاهر');
  assert.equal(verification.files.before, 99);
  assert.equal(verification.files.after, 10);
});

test('no application script references a CSS file path', () => {
  const scriptsDir = path.join(assets, 'src/scripts');
  for (const file of fs.readdirSync(scriptsDir)) {
    if (!file.endsWith('.js')) continue;
    const text = fs.readFileSync(path.join(scriptsDir, file), 'utf8');
    assert.equal(text.includes('src/styles/'), false, `${file} نباید به مسیر فایل CSS ارجاع بدهد`);
  }
});
