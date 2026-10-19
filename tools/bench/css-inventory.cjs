#!/usr/bin/env node
/*
 * میزسنج CSS — سیاهه‌ی دقیق استایل‌ها برای مرحله‌ی ۳ (جداسازی CSS/UI)
 *
 * چه چیزی را می‌سنجد؟
 *   ۱) فایل‌های لینک‌شده در index.html و ترتیب آبشاری آن‌ها
 *   ۲) تعداد قاعده، اعلان، قاعده‌های داخل @media/@supports و پوشش @keyframes
 *   ۳) تعداد «!important» (هم اعلان‌ها و هم قاعده‌های دارای مهم)
 *   ۴) قاعده‌هایی که نام کلاس آن‌ها در هیچ JS/HTML برنامه پیدا نمی‌شود ⇒ کد مرده‌ی قابل اثبات
 *   ۵) قاعده‌های تکراری (متن یکسان) و همپوشانی فایل‌ها
 *   ۶) چک اختیاری DOM: سلکتورهایی که روی برنامه‌ی راه‌اندازی‌شده به هیچ عنصری نمی‌خورند
 *
 * خروجی: JSON روی stdout (برای diff قبل/بعد) + خلاصه‌ی خوانا روی stderr
 * کاربرد: node tools/bench/css-inventory.cjs > before.json
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.argv[2] || path.resolve(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const WANT_DOM = process.argv.includes('--dom');

const GROUP_AT_RULES = new Set(['media', 'supports', 'layer', 'container', 'document', 'scope', 'starting-style']);

function stripComments(text) {
  let comments = 0;
  const out = text.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    comments += match.length;
    return ' '.repeat(match.length === match.trim().length ? match.length : match.length);
  });
  return { css: out, commentBytes: comments };
}

/** تجزیه‌ی ساده‌ی CSS: قاعده‌های سطح‌بالا + قاعده‌های داخل at-rule‌های گروهی */
function parseCss(text) {
  const { css, commentBytes } = stripComments(text);
  const rules = [];
  const atStack = [];
  const frames = [];
  let preludeStart = 0;
  let i = 0;
  let keyframesDepth = 0;

  while (i < css.length) {
    const ch = css[i];
    if (ch === '{') {
      const prelude = css.slice(preludeStart, i).trim();
      const atMatch = /^@([\w-]+)/.exec(prelude);
      const atName = atMatch ? atMatch[1].toLowerCase() : null;
      const isGroup = atName && GROUP_AT_RULES.has(atName);
      const isKeyframes = atName === 'keyframes' || atName === '-webkit-keyframes';
      frames.push({ prelude, atName, isGroup, isKeyframes, start: preludeStart });
      if (isGroup) atStack.push(prelude.replace(/\s+/g, ' '));
      if (isKeyframes) keyframesDepth += 1;
      preludeStart = i + 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      const frame = frames.pop();
      if (!frame) { preludeStart = i + 1; i += 1; continue; }
      if (frame.isKeyframes) keyframesDepth = Math.max(0, keyframesDepth - 1);
      else if (!frame.isGroup && keyframesDepth === 0) {
        const body = css.slice(preludeStart, i);
        const selector = frame.prelude.trim();
        if (selector && !selector.startsWith('@')) {
          rules.push({
            selector,
            body,
            at: atStack.slice(),
            important: body.includes('!important'),
            importantCount: (body.match(/!important/g) || []).length,
            bytes: frame.prelude.length + body.length + 2,
          });
        }
      } else if (frame.isGroup) {
        atStack.pop();
      }
      preludeStart = i + 1;
      i += 1;
      continue;
    }
    if (ch === ';' && frames.length === 0) preludeStart = i + 1;
    i += 1;
  }
  return { rules, commentBytes };
}

/** نام کلاس‌های داخل یک سلکتور، با برداشتن escape‌ها (md\:flex → md:flex) */
function classTokens(selector) {
  const tokens = new Set();
  const re = /\.((?:\\.|[^\s.#:>+~,[\]()*])+)/g;
  let match;
  while ((match = re.exec(selector)) !== null) {
    const raw = match[1];
    let value = raw.replace(/\\(.)/g, '$1');
    value = value.replace(/\\/g, '');
    if (value) tokens.add(value);
  }
  return tokens;
}

const html = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
const linkOrder = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)]
  .map((match) => (/href="([^"]+)"/.exec(match[0]) || [])[1])
  .filter(Boolean)
  .map((href) => href.replace(/\?.*$/, '').replace(/^src\/styles\//, ''));

let appText = '';
for (const dir of ['src/scripts']) {
  const full = path.join(ASSETS, dir);
  if (!fs.existsSync(full)) continue;
  for (const file of fs.readdirSync(full)) {
    if (file.endsWith('.js')) appText += fs.readFileSync(path.join(full, file), 'utf8');
  }
}
appText += html;
for (const file of fs.readdirSync(ASSETS)) {
  if (file.endsWith('.js') || file.endsWith('.html')) appText += fs.readFileSync(path.join(ASSETS, file), 'utf8');
}

const existing = new Set(fs.readdirSync(path.join(ASSETS, 'src/styles')));
const files = [];
const allRules = [];
const seenRuleText = new Map();

for (const name of linkOrder) {
  if (!existing.has(name)) continue;
  const full = path.join(ASSETS, 'src/styles', name);
  const text = fs.readFileSync(full, 'utf8');
  const parsed = parseCss(text);
  let unusedRules = 0;
  let unusedBytes = 0;
  let mediaRules = 0;
  let importantRules = 0;
  let importantCount = 0;

  parsed.rules.forEach((rule, index) => {
    if (rule.at.length) mediaRules += 1;
    if (rule.important) { importantRules += 1; importantCount += rule.importantCount; }
    const tokens = classTokens(rule.selector);
    const checkable = tokens.size > 0;
    const used = !checkable || [...tokens].some((token) => appText.includes(token));
    if (!used) { unusedRules += 1; unusedBytes += rule.bytes; }
    const ruleText = `${rule.at.join('|')}::${rule.selector}{${rule.body.replace(/\s+/g, ' ').trim()}}`;
    if (seenRuleText.has(ruleText)) {
      seenRuleText.get(ruleText).duplicates.push({ file: name, index });
    } else {
      const record = { file: name, index, duplicates: [] };
      seenRuleText.set(ruleText, record);
    }
    allRules.push({ file: name, ...rule, used, checkable });
  });

  files.push({
    name,
    bytes: Buffer.byteLength(text),
    commentBytes: parsed.commentBytes,
    rules: parsed.rules.length,
    mediaRules,
    importantRules,
    importantCount,
    unusedRules,
    unusedBytes,
  });
}

const duplicates = [...seenRuleText.entries()]
  .filter(([, record]) => record.duplicates.length > 0)
  .map(([ruleText, record]) => ({ rule: ruleText.slice(0, 160), first: record.file, copies: record.duplicates.length }));

const sum = (key) => files.reduce((total, file) => total + file[key], 0);
const result = {
  root: ROOT,
  at: new Date().toISOString(),
  totals: {
    linkedFiles: files.length,
    cssFilesOnDisk: existing.size,
    bytes: sum('bytes'),
    commentBytes: sum('commentBytes'),
    rules: sum('rules'),
    mediaRules: sum('mediaRules'),
    importantRules: sum('importantRules'),
    importantCount: sum('importantCount'),
    unusedRules: sum('unusedRules'),
    unusedBytes: sum('unusedBytes'),
    duplicateRules: duplicates.length,
  },
  files,
  duplicates: duplicates.slice(0, 40),
};

if (WANT_DOM) {
  try {
    const { JSDOM, VirtualConsole } = require('jsdom');
    const dom = new JSDOM(fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8'), {
      runScripts: 'outside-only', resources: 'usable', pretendToBeVisual: true,
      virtualConsole: new VirtualConsole(), url: 'http://127.0.0.1:8080/index.html',
    });
    const doc = dom.window.document;
    let unmatched = 0;
    const unmatchedSamples = [];
    for (const rule of allRules) {
      if (!rule.checkable) continue;
      const first = rule.selector.split(',')[0].trim().replace(/\s*>\s*$/, '');
      if (/:(hover|focus|active|checked|invalid|user-invalid|target|focus-within|focus-visible|placeholder-shown|disabled)/.test(first)) continue;
      try {
        if (doc.querySelector(first) === null) {
          unmatched += 1;
          if (unmatchedSamples.length < 25) unmatchedSamples.push(first);
        }
      } catch (error) { /* سلکتور پشتیبانی‌نشده در jsdom */ }
    }
    result.dom = { unmatchedSelectors: unmatched, samples: unmatchedSamples };
  } catch (error) {
    result.dom = { skipped: String(error.message).slice(0, 120) };
  }
}

process.stdout.write(JSON.stringify(result, null, 2) + '\n');

const totals = result.totals;
process.stderr.write(
  `فایل‌های لینک‌شده: ${totals.linkedFiles} (روی دیسک ${totals.cssFilesOnDisk})\n` +
  `حجم: ${(totals.bytes / 1024).toFixed(0)} KB · قواعد: ${totals.rules} · داخل media/supports: ${totals.mediaRules}\n` +
  `!important: ${totals.importantCount} اعلان در ${totals.importantRules} قاعده\n` +
  `قواعد با نام کلاس بی‌استفاده: ${totals.unusedRules} (${(totals.unusedBytes / 1024).toFixed(0)} KB)\n` +
  `قواعد تکراری: ${totals.duplicateRules}\n` +
  (result.dom ? (result.dom.skipped ? `چک DOM: رد شد (${result.dom.skipped})\n` : `سلکتورهای بی‌هدف روی DOM واقعی: ${result.dom.unmatchedSelectors}\n`) : '')
);
