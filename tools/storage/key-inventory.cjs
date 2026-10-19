#!/usr/bin/env node
/*
 * سیاهه‌ی کلیدهای ذخیره‌سازی — پویش ایستای کد (مرحله ۶.۱)
 *
 * همه‌ی رشته‌های «hesabno:…» را از اسکریپت‌ها استخراج می‌کند و تصمیم می‌گیرد هر کدام
 * کلید localStorage است، کلید sessionStorage، یا فقط نام یک رویداد پنجره.
 *
 * نکات دقت:
 *   • توضیحات (// و /* … *\/) پیش از پویش حذف می‌شوند تا اشاره‌ی داخل کامنت با استفاده‌ی واقعی
 *     اشتباه گرفته نشود (قبلاً «hesabno:fontFamily» فقط در یک توضیح بود).
 *   • رویدادها با الگوی `new CustomEvent("…")`، `new Event("…")`، `addEventListener("…")` و
 *     `removeEventListener("…")` تشخیص داده می‌شوند.
 *   • sessionStorage با `sessionStorage.getItem/setItem/removeItem("…")` تشخیص داده می‌شود.
 *   • هر کلید که با متغیر ساخته شود («hesabno:» + x) گزارش می‌شود، چون پویش ایستا را بی‌اعتبار می‌کند.
 *
 * کاربرد:
 *   node tools/storage/key-inventory.cjs                → JSON روی stdout
 *   node tools/storage/key-inventory.cjs --check        → مقایسه با رجیستری؛ کد ۱ در صورت ناسازگاری
 *   node tools/storage/key-inventory.cjs --root=/path   → پویش درخت دیگر
 */
const fs = require('node:fs');
const path = require('node:path');

const rootArg = (process.argv.find((value) => value.startsWith('--root=')) || '').split('=')[1];
const ROOT = rootArg ? path.resolve(rootArg) : path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(ROOT, 'app/src/main/assets/src/scripts');
const CHECK = process.argv.includes('--check');

/* حذف توضیحات بدون تغییر ساختار رشته‌ها و بدون بلعیدن «//» داخل رشته‌ها */
function stripComments(source) {
  let out = '';
  let index = 0;
  let inLine = false;
  let inBlock = false;
  let quote = null;
  while (index < source.length) {
    const ch = source[index];
    const next = source[index + 1];
    if (inLine) {
      if (ch === '\n') { inLine = false; out += ch; } else out += ' ';
      index += 1; continue;
    }
    if (inBlock) {
      if (ch === '*' && next === '/') { inBlock = false; out += '  '; index += 2; continue; }
      out += ch === '\n' ? ch : ' ';
      index += 1; continue;
    }
    if (quote) {
      out += ch;
      if (ch === '\\') { out += source[index + 1] || ''; index += 2; continue; }
      if (ch === quote) quote = null;
      index += 1; continue;
    }
    if (ch === '/' && next === '/') { inLine = true; out += '  '; index += 2; continue; }
    if (ch === '/' && next === '*') { inBlock = true; out += '  '; index += 2; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; out += ch; index += 1; continue; }
    out += ch; index += 1;
  }
  return out;
}

/*
 * دامنه‌ی پویش: اسکریپت‌ها + ماژول‌های storage (به‌جز خود رجیستری). ماژول ۶.۲ نام رویداد خود را
 * یا در src/storage/write-guard.js تعریف می‌کند؛ اگر آن پوشه پویش نشود، رجیستری «مدخل مرده»
 * به‌نظر می‌رسد.
 */
const STORAGE = path.join(ROOT, 'app/src/main/assets/src/storage');
const sources = [
  ...fs.readdirSync(SCRIPTS).filter((file) => file.endsWith('.js')).map((file) => ({ file, full: path.join(SCRIPTS, file) })),
  ...(fs.existsSync(STORAGE)
    ? fs.readdirSync(STORAGE).filter((file) => file.endsWith('.js') && file !== 'keys.js')
      .map((file) => ({ file, full: path.join(STORAGE, file) }))
    : []),
].sort((a, b) => a.file.localeCompare(b.file));
const files = sources.map((item) => item.file);
const findings = new Map();
const dynamicKeys = [];
const derivedKeys = [];

for (const { file, full } of sources) {
  const source = stripComments(fs.readFileSync(full, 'utf8'));

  /* کلیدهای ساخته‌شده با متغیر: پویش ایستا دیگر قابل اعتماد نیست */
  if (/["'`]hesabno:["'`]\s*\+/.test(source) || /["'`]hesabno:[^"'`]*["'`]\s*\+/.test(source)) {
    dynamicKeys.push({ file, pattern: 'hesabno: + متغیر' });
  }
  if (/`hesabno:[^`]*\$\{/.test(source)) dynamicKeys.push({ file, pattern: 'hesabno:${…}' });

  /*
   * حل سبک متغیرها: کد واقعی گاهی «sessionStorage» را به یک نام کوتاه نشان می‌دهد
   * (`var SS = window.sessionStorage`) یا کلید را در متغیر می‌گذارد (`var marker = "hesabno:…"`).
   * بدون این مرحله، پویش ایستا این کلیدها را به‌اشتباه localStorage حساب می‌کرد.
   */
  const sessionAliases = new Set(['sessionStorage']);
  const localAliases = new Set(['localStorage']);
  for (const alias of source.matchAll(/([A-Za-z_$][\w$]*)\s*=\s*(?:window\.)?sessionStorage\b/g)) sessionAliases.add(alias[1]);
  for (const alias of source.matchAll(/([A-Za-z_$][\w$]*)\s*=\s*(?:window\.)?localStorage\b/g)) localAliases.add(alias[1]);

  /* متغیر → کلید و متغیر → بک‍‌اند، از روی تعریف‌های ساده‌ی همان فایل */
  const keyVariables = new Map();
  for (const declaration of source.matchAll(/([A-Za-z_$][\w$]*)\s*=\s*["'](hesabno:[A-Za-z0-9_:.\-]+)["']/g)) {
    keyVariables.set(declaration[1], declaration[2].replace(/[.\-:]+$/, ''));
  }
  /* هر فراخوانی ذخیره‌سازی با متغیر کلید: بک‌اند را به همان کلید نسبت می‌دهیم */
  /*
   * نام رویدادهایی که در متغیر نگه داشته می‌شوند (`var EVENT = "hesabno:..."` و بعد
   * `new CustomEvent(EVENT, ...)`) — مثل ماژول ۶.۲. بدون این مرحله رویداد به‌اشتباه کلید شمرده می‌شد.
   */
  const eventVariables = new Set();
  for (const assignment of source.matchAll(/([A-Za-z_$][\w$]*)\s*=\s*["'](hesabno:[A-Za-z0-9_:.\-]+)["']/g)) {
    const variable = assignment[1];
    const usage = new RegExp(
      "(?:new\\s+(?:[A-Za-z_$][\\w$]*\\.)*CustomEvent\\s*\\(\\s*|" +
      "addEventListener\\s*\\(\\s*)" + variable + "\\b"
    );
    if (usage.test(source)) eventVariables.add(assignment[2].replace(/[.\-:]+$/, ''));
  }

  const variableBackends = new Map();
  for (const call of source.matchAll(/([A-Za-z_$][\w$]*)\.(?:getItem|setItem|removeItem)\s*\(\s*([A-Za-z_$][\w$]*)/g)) {
    const storageName = call[1];
    const keyName = call[2];
    const key = keyVariables.get(keyName);
    if (!key) continue;
    if (sessionAliases.has(storageName)) variableBackends.set(key, 'session');
    else if (localAliases.has(storageName)) variableBackends.set(key, 'local');
  }

  /*
   * کلید مشتق‌شده: `KEYVAR + 'Idx'`. اگر پوشش داده نشود، یک کلید واقعی از سیاهه جا می‌ماند
   * (نمونه‌ی واقعی: `hesabno:lastTabIdx` در ۰۰۳). این‌ها جداگانه با منشأشان گزارش می‌شوند.
   */
  for (const composition of source.matchAll(/([A-Za-z_$][\w$]*)\s*\+\s*["']([A-Za-z0-9_:.\-]+)["']/g)) {
    const base = keyVariables.get(composition[1]);
    if (!base) continue;
    const derived = { key: base + composition[2], derivedFrom: base, suffix: composition[2] };
    derivedKeys.push({ ...derived, file });
    if (!findings.has(derived.key)) findings.set(derived.key, { key: derived.key, local: new Set(), session: new Set(), event: new Set(), derivedFrom: base });
    const storageName = sessionAliases.has('sessionStorage') ? null : null;
    const record = findings.get(derived.key);
    /* بک‌اند را از متغیر ذخیره‌سازی همان فایل می‌گیریم (اگر در همان بلوک بود) */
    if (variableBackends.get(base) === 'session') record.session.add(file);
    else record.local.add(file);
  }

  for (const match of source.matchAll(/hesabno:[A-Za-z0-9_:.\-]+/g)) {
    const key = match[0].replace(/[.\-:]+$/, '');
    if (!findings.has(key)) findings.set(key, { key, local: new Set(), session: new Set(), event: new Set() });
    const record = findings.get(key);
    const prefix = source.slice(Math.max(0, match.index - 180), match.index);
    if (/(dispatchEvent\s*\(\s*new\s+CustomEvent\s*\(\s*["']?|dispatchEvent\s*\(\s*new\s+Event\s*\(\s*["']?|addEventListener\s*\(\s*["']?|removeEventListener\s*\(\s*["']?)$/.test(prefix)) {
      record.event.add(file);
    } else if (eventVariables.has(key)) {
      record.event.add(file);
    } else if (/sessionStorage\.(getItem|setItem|removeItem)\s*\(\s*["']?$/.test(prefix)) {
      record.session.add(file);
    } else if (variableBackends.get(key) === 'session') {
      record.session.add(file);
    } else {
      record.local.add(file);
    }
  }
}

function backendOf(record) {
  const hasLocal = record.local.size > 0;
  const hasSession = record.session.size > 0;
  const hasEvent = record.event.size > 0;
  if (hasEvent && !hasLocal && !hasSession) return 'event';
  if (hasSession && !hasLocal && !hasEvent) return 'session';
  if (hasLocal) return 'local';
  return 'session';
}

const inventory = [...findings.values()]
  .map((record) => ({
    key: record.key,
    backend: backendOf(record),
    files: [...new Set([...record.local, ...record.session, ...record.event])].sort(),
  }))
  .sort((a, b) => a.key.localeCompare(b.key));

let registry = null;
try { registry = require(path.join(ROOT, 'app/src/main/assets/src/storage/keys.js')); } catch (error) { registry = null; }

if (!CHECK) {
  process.stdout.write(JSON.stringify({
    root: ROOT,
    scanned: files.length,
    total: inventory.length,
    byBackend: {
      local: inventory.filter((item) => item.backend === 'local').length,
      session: inventory.filter((item) => item.backend === 'session').length,
      event: inventory.filter((item) => item.backend === 'event').length,
    },
    dynamicKeys,
    derivedKeys: derivedKeys.filter((item, index, list) => list.findIndex((other) => other.key === item.key && other.file === item.file) === index),
    keys: inventory,
  }, null, 2) + '\n');
  process.exit(0);
}

/* ---------- حالت --check ---------- */
const problems = [];
const warnings = [];
if (!registry) problems.push('رجیستری src/storage/keys.js خوانده نشد');

const unknown = inventory.filter((item) => registry && !registry.isKnown(item.key));
for (const item of unknown) problems.push(`کلید بدون ثبت در رجیستری: ${item.key} (${item.backend}، ${item.files.join(', ')})`);

const stale = registry ? registry.all.filter((entry) => !findings.has(entry.key)).map((entry) => entry.key) : [];
for (const key of stale) problems.push(`مدخل رجیستری که در کد استفاده نشده: ${key}`);

for (const item of inventory) {
  if (!registry || !registry.isKnown(item.key)) continue;
  const expected = registry.backendOf(item.key);
  if (expected !== item.backend) {
    problems.push(`نوع دسترسی ناهماهنگ برای ${item.key}: رجیستری «${expected}» ولی کد «${item.backend}»`);
  }
}

for (const item of dynamicKeys) problems.push(`کلید پویا (پویش ایستا را بی‌اعتبار می‌کند): ${item.file} — ${item.pattern}`);

/* فایل مالک هر مدخل باید وجود داشته باشد */
if (registry) {
  const owners = new Set(files.map((file) => file.split('-')[0]));
  for (const entry of registry.all) {
    if (!owners.has(entry.owner)) problems.push(`فایل مالک «${entry.owner}» برای ${entry.key} وجود ندارد`);
  }
}

if (problems.length) {
  process.stderr.write(`✗ ${problems.length} ناسازگاری\n`);
  for (const problem of problems) process.stderr.write(`   ${problem}\n`);
  process.exit(1);
}

process.stderr.write(
  `✓ سیاهه با رجیستری سازگار است · ${inventory.length} رشته در ${files.length} فایل` +
  ` (local ${inventory.filter((item) => item.backend === 'local').length}` +
  ` · session ${inventory.filter((item) => item.backend === 'session').length}` +
  ` · event ${inventory.filter((item) => item.backend === 'event').length})\n`
);
for (const warning of warnings) process.stderr.write(`   ⚠ ${warning}\n`);
process.exit(0);
