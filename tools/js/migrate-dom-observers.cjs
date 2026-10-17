#!/usr/bin/env node
/*
 * تبدیل observerهای مستقل به لایه‌ی مشترک (مرحله ۴)
 *
 * فقط دو الگوی کاملاً مشخص را تبدیل می‌کند و هر چیز دیگری را دست‌نخورده می‌گذارد:
 *
 *   الف) `new MutationObserver(FN).observe(TARGET, OPTIONS)`
 *        → `window.__hesabnoDom.watch(TARGET, OPTIONS, FN)`
 *
 *   ب) `var NAME = new MutationObserver(FN);  … NAME.observe(TARGET, OPTIONS);`
 *        → `var NAME = window.__hesabnoDom.watch(TARGET, OPTIONS, FN);`  (سطر observe حذف می‌شود)
 *        شرط: NAME در کل فایل دقیقاً دو بار آمده باشد (اعلان + observe)، تا اگر جایی
 *        disconnect/takeRecords روی آن انجام می‌شود، نتیجه‌ی watch همچنان آن را پشتیبانی کند.
 *
 * شرط‌های ایمنی (در غیر این صورت «رد می‌شود» و در گزارش می‌آید):
 *   • callback باید شناسه یا تابع درون‌خطی باشد (نه عضو شیء یا فراخوانی)
 *   • OPTIONS باید شیء ثابت باشد (بدون spread و بدون فراخوانی)
 *   • TARGET باید یکی از هدف‌های شناخته‌شده‌ی سند باشد (document/document.body/documentElement/head/#root)
 *   • فایل نباید قبلاً مهاجرت کرده باشد
 *
 * کاربرد:
 *   node tools/js/migrate-dom-observers.cjs                 → گزارش خشک (بدون تغییر)
 *   node tools/js/migrate-dom-observers.cjs --profile=all --apply
 *   profile ها: body-childlist | character-data | attributes | other | all
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(ROOT, 'app/src/main/assets/src/scripts');
const APPLY = process.argv.includes('--apply');
const profileArg = (process.argv.find((argument) => argument.startsWith('--profile=')) || '--profile=all').split('=')[1];

/*
 * فایل‌های ممنوعه — قید صریح مالک پروژه: «هیچ‌وقت کیبورد ۲۱۴/۲۲۵ یا منطق چک دست نخورد».
 * این فهرست عمداً «نام‌محور» است تا هر فایل چک/کیبورد که بعداً اضافه شود هم به‌طور پیش‌فرض
 * دست‌نخورده بماند. ۰۶۷ باندل اصلی برنامه است (تصمیم R5: بازنویسی نمی‌شود).
 */
const SKIP_FILES = new Set(['067-inline.js', '236-hesabno-shared-dom-observer.js']);
const SKIP_PATTERNS = [/check/i, /keypad/i, /numeric-keyboard/i, /^214-/, /^225-/];
/* هدف‌های پذیرفته‌شده: فرم‌های سند، جست‌وجوی #root، شناسه‌های ساده (مثل root که در همان فایل
 * با if (!root) return محافظت شده‌اند) و ترکیب «الف || ب» از همین‌ها.
 * توجه: اگر هدف نامعتبر باشد، watch() بی‌صدا هیچ ثبت نمی‌کند — که از خطای TypeError در حالت
 * قبلی امن‌تر است و در گزارش مرحله مستند شده است. */
const TARGET_ATOM = "document(?:\\.(?:body|documentElement|head))?|document\\.getElementById\\((['\"])root\\1\\)|[A-Za-z_$][\\w$]*";
const TARGET_PATTERN = new RegExp(`^(?:${TARGET_ATOM})(?:\\s*\\|\\|\\s*(?:${TARGET_ATOM}))*$`);

function balanced(text, openIndex, open = '(', close = ')') {
  let depth = 0;
  for (let index = openIndex; index < text.length; index += 1) {
    const ch = text[index];
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return { text: text.slice(openIndex, index + 1), end: index };
    }
  }
  return null;
}

function optionsProfile(options) {
  const has = (flag) => new RegExp(`${flag}\\s*:\\s*(!0|true)`).test(options);
  if (has('characterData')) return 'character-data';
  if (has('attributes') || /attributeFilter\s*:/.test(options)) return 'attributes';
  if (has('childList')) return 'body-childlist';
  return 'other';
}

const report = { files: [], skipped: [], migrated: [] };

for (const file of fs.readdirSync(SCRIPTS).sort()) {
  if (!file.endsWith('.js') || SKIP_FILES.has(file) || SKIP_PATTERNS.some((pattern) => pattern.test(file))) continue;
  let text = fs.readFileSync(path.join(SCRIPTS, file), 'utf8');
  /* توجه: در اینجا کل فایل رد نمی‌شود. یک فایل می‌تواند چند observer با پروفایل‌های مختلف
     داشته باشد (مثل ۱۰۱)؛ هر فراخوانی جداگانه بررسی می‌شود و آن‌هایی که قبلاً مهاجرت کرده‌اند
     دیگر «new MutationObserver» ندارند، پس دوباره دست‌کاری نمی‌شوند. */

  const edits = [];
  const skippedOccurrences = [];
  const re = /new MutationObserver\s*\(/g;
  let match;
  let searchFrom = 0;

  while ((match = re.exec(text)) !== null) {
    const createIndex = match.index;
    const args = balanced(text, match.index + match[0].length - 1);
    if (!args) { skippedOccurrences.push({ index: createIndex, reason: 'پرانتز متوازن پیدا نشد' }); continue; }
    const callback = args.text.slice(1, -1).trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(callback) && !/^(function\s*\(|\(?\s*(function)?\s*\()/.test(callback)) {
      skippedOccurrences.push({ index: createIndex, reason: 'callback ساده نیست' });
      continue;
    }

    const declarationMatch = /(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*$/.exec(text.slice(Math.max(0, createIndex - 60), createIndex));
    const between = text.slice(args.end + 1, args.end + 220);
    let observeStart = -1;
    let name = null;
    if (declarationMatch) {
      name = declarationMatch[1];
      const occurrences = text.split(new RegExp(`\\b${name}\\b`)).length - 1;
      if (occurrences !== 2) {
        skippedOccurrences.push({ index: createIndex, reason: `متغیر ${name} بیش از یک‌بار استفاده شده (${occurrences})` });
        continue;
      }
      const observeMatch = new RegExp(`^\\s*;?\\s*${name}\\.observe\\s*\\(`).exec(between);
      if (!observeMatch) {
        skippedOccurrences.push({ index: createIndex, reason: `${name}.observe بلافاصله پیدا نشد` });
        continue;
      }
      observeStart = args.end + 1 + observeMatch[0].length - 1;
    } else {
      const observeMatch = /^\.observe\s*\(/.exec(between);
      if (!observeMatch) {
        skippedOccurrences.push({ index: createIndex, reason: 'فراخوانی observe بلافاصله پیدا نشد' });
        continue;
      }
      observeStart = args.end + 1 + observeMatch[0].length - 1;
    }

    const observeArgs = balanced(text, observeStart);
    if (!observeArgs) { skippedOccurrences.push({ index: createIndex, reason: 'پرانتز observe متوازن پیدا نشد' }); continue; }
    const inner = observeArgs.text.slice(1, -1);
    const commaIndex = inner.indexOf(',');
    if (commaIndex === -1) { skippedOccurrences.push({ index: createIndex, reason: 'گزینه‌های observe پیدا نشد' }); continue; }
    const target = inner.slice(0, commaIndex).trim();
    const options = inner.slice(commaIndex + 1).trim();
    if (!TARGET_PATTERN.test(target)) { skippedOccurrences.push({ index: createIndex, reason: `هدف پشتیبانی‌نشده: ${target.slice(0, 40)}` }); continue; }
    if (!/^\{[\s\S]*\}$/.test(options) || /\.\.\.|\w\s*\(/.test(options)) {
      skippedOccurrences.push({ index: createIndex, reason: 'گزینه‌ها شیء ثابت ساده نیستند' });
      continue;
    }

    const profile = optionsProfile(options);
    if (profileArg !== 'all' && profile !== profileArg) {
      skippedOccurrences.push({ index: createIndex, reason: `خارج از پروفایل انتخاب‌شده (${profile})` });
      continue;
    }

    const replacement = `window.__hesabnoDom.watch(${target}, ${options}, ${callback})`;
    const tail = text.slice(observeArgs.end + 1, observeArgs.end + 6);
    const semicolonMatch = /^\s*;/.exec(tail);
    if (name) {
      /* اعلان متغیر: فراخوانی watch جای «new MutationObserver» می‌نشیند و سطر observe حذف می‌شود،
         ولی «;» پایانی همان سطر باقی می‌ماند تا ترمینیتور دستور حفظ شود. */
      edits.push({ start: createIndex, end: args.end + 1, text: semicolonMatch ? replacement : `${replacement};` });
      edits.push({ start: args.end + 1, end: observeArgs.end + 1, text: '' });
    } else {
      /* شکل عبارتی: کل «new MutationObserver(...).observe(...) ;» با یک دستور جایگزین می‌شود. */
      edits.push({
        start: createIndex,
        end: semicolonMatch ? observeArgs.end + 1 + semicolonMatch[0].length : observeArgs.end + 1,
        text: `${replacement};`,
      });
    }
    report.migrated.push({ file, profile, target, callback: callback.slice(0, 30), name });
    searchFrom = observeArgs.end;
  }

  for (const skip of skippedOccurrences) report.skipped.push({ file, ...skip });
  if (!edits.length) continue;

  if (APPLY) {
    const unique = edits
      .filter((edit, index, list) => list.findIndex((other) => other.start === edit.start && other.end === edit.end) === index)
      .sort((a, b) => b.start - a.start);
    const original = text;
    for (const edit of unique) text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
    /* اعتبارسنجی سینتکس پیش از نوشتن: اگر خراب شد، فایل دست‌نخورده می‌ماند */
    try {
      new vm.Script(text, { filename: file });
    } catch (error) {
      report.skipped.push({ file, index: 0, reason: `سینتکس پس از تبدیل خراب شد: ${error.message.slice(0, 60)}` });
      report.files = report.files.filter((name) => name !== file);
      report.migrated = report.migrated.filter((item) => item.file !== file);
      text = original;
      continue;
    }
    fs.writeFileSync(path.join(SCRIPTS, file), text);
  }
  report.files.push(file);
}

const byProfile = {};
for (const item of report.migrated) byProfile[item.profile] = (byProfile[item.profile] || 0) + 1;
process.stderr.write(
  `${APPLY ? 'اعمال شد' : 'حالت خشک (برای اعمال: --apply)'} · پروفایل: ${profileArg}\n` +
  `فایل‌های تغییر‌یافته: ${report.files.length} · observerهای مهاجرت‌کرده: ${report.migrated.length} ${JSON.stringify(byProfile)}\n` +
  `رد‌شده: ${report.skipped.length}\n`
);
const reasons = {};
for (const skip of report.skipped) reasons[skip.reason.replace(/:.*/, '')] = (reasons[skip.reason.replace(/:.*/, '')] || 0) + 1;
for (const [reason, count] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
  process.stderr.write(`   ${reason}: ${count}\n`);
}
if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
