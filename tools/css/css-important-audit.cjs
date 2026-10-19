#!/usr/bin/env node
/*
 * بازبینی «!important» — کدام پرچم‌ها را می‌توان بدون هیچ تغییری در ظاهر حذف کرد؟
 *
 * قاعده‌ی حذف (اثبات‌پذیر برای همه‌ی حالت‌ها، نه فقط DOM فعلی):
 *   پرچم `!important` روی اعلان D (ویژگی P با مقدار V) تنها وقتی حذف می‌شود که:
 *     ۱) هیچ اعلان دیگری در کل CSS با ویژگی هم‌خانواده‌ی P و «مقدار متفاوت» وجود نداشته باشد
 *        که وزن/ترتیب بالاتری از D داشته باشد؛ چون فقط چنین رقیبی می‌تواند پس از حذف پرچم برنده شود.
 *        (اعلان‌های با مقدار یکسان حتی اگر برنده شوند، ظاهر را عوض نمی‌کنند.)
 *     ۲) P در هیچ @keyframes تعریف نشده باشد (انیمیشن، اعلان‌های normal را می‌بَرد).
 *     ۳) P در فهرست ویژگی‌هایی که برنامه به‌صورت «استایل درون‌خطی» می‌نویسد نباشد
 *        (استایل درون‌خطی برنده‌ی اعلان‌های normal است، پس حذف پرچم می‌تواند ظاهر را عوض کند).
 *     ۴) قاعده در بلوک تودرتو/سلکتور نامطمئن نباشد (وزن قابل محاسبه‌ی مطمئن نداشته باشد).
 *
 * خروجی: JSON روی stdout · خلاصه روی stderr · با `--apply` حذف‌های اثبات‌پذیر اعمال می‌شود.
 */
const fs = require('node:fs');
const path = require('node:path');
const { parseCss, specificity, propertiesInteract } = require('../bench/css-parser.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const STYLES = path.join(ASSETS, 'src/styles');
const APPLY = process.argv.includes('--apply');

function linkedStyles() {
  const html = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
  return [...html.matchAll(/rel="stylesheet"[^>]*href="([^"]+)"/g)]
    .map((match) => match[1].replace(/\?.*$/, '').replace(/^src\/styles\//, ''));
}

/** ویژگی‌هایی که داخل @keyframes تعریف شده‌اند */
function animatedProperties(text) {
  const properties = new Set();
  const re = /@(?:-webkit-)?keyframes\b/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const open = text.indexOf('{', match.index);
    if (open === -1) continue;
    let depth = 0;
    let end = open;
    for (let index = open; index < text.length; index += 1) {
      if (text[index] === '{') depth += 1;
      else if (text[index] === '}') { depth -= 1; if (depth === 0) { end = index; break; } }
    }
    const block = text.slice(open + 1, end);
    for (const declaration of block.matchAll(/([\w-]+)\s*:/g)) properties.add(declaration[1].toLowerCase());
    re.lastIndex = end;
  }
  return properties;
}

/** ویژگی‌هایی که خود برنامه به‌صورت inline (style={{…}} یا style.x) می‌نویسد */
function inlineStyleProperties() {
  const properties = new Set();
  const scripts = path.join(ASSETS, 'src/scripts');
  const html = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
  for (const file of fs.readdirSync(scripts)) {
    if (!file.endsWith('.js')) continue;
    const text = fs.readFileSync(path.join(scripts, file), 'utf8');
    for (const block of text.matchAll(/style\s*[:=]\s*\{\{([\s\S]{0,600}?)\}\}/g)) {
      for (const key of block[1].matchAll(/([a-zA-Z][A-Za-z0-9]*)\s*:/g)) {
        properties.add(key[1].replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase());
      }
    }
    for (const assignment of text.matchAll(/\.style\.([a-zA-Z][A-Za-z0-9]*)\s*=/g)) {
      properties.add(assignment[1].replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase());
    }
    for (const call of text.matchAll(/setProperty\(\s*["']([\w-]+)["']/g)) properties.add(call[1].toLowerCase());
  }
  for (const attribute of html.matchAll(/style="([^"]*)"/g)) {
    for (const key of attribute[1].matchAll(/([\w-]+)\s*:/g)) properties.add(key[1].toLowerCase());
  }
  return properties;
}

const normalizeValue = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase();

const files = linkedStyles();
const records = [];
const animated = new Set();
const inlineProperties = inlineStyleProperties();
let order = 0;
let sequence = 0;
let importantDeclarations = 0;
let importantRules = 0;

for (const file of files) {
  const text = fs.readFileSync(path.join(STYLES, file), 'utf8');
  for (const property of animatedProperties(text)) animated.add(property);
  const parsed = parseCss(text);
  for (const rule of parsed.rules) {
    order += 1;
    if (rule.important) importantRules += 1;
    const spec = rule.unsafe ? null : specificity(rule.selector);
    for (const declaration of rule.declarations) {
      if (declaration.important) importantDeclarations += 1;
      sequence += 1;
      records.push({
        file, order, sequence, selector: rule.selector, at: rule.at, unsafe: rule.unsafe, spec,
        property: declaration.property,
        value: normalizeValue(declaration.value.replace(/!\s*important\s*$/i, '')),
        important: declaration.important,
        importantStart: declaration.importantStart,
        importantLength: declaration.importantLength,
      });
    }
  }
}

/** آیا a از b در حالت normal برنده می‌شود؟ (وزن، سپس ترتیب) */
function beatsAsNormal(a, b) {
  if (!a.spec || !b.spec) return true; // نامطمئن → محافظه‌کارانه «برنده» فرض می‌شود
  for (let index = 0; index < 3; index += 1) {
    if (a.spec[index] !== b.spec[index]) return a.spec[index] > b.spec[index];
  }
  return a.sequence > b.sequence;
}

const byProperty = new Map();
for (const record of records) {
  if (!byProperty.has(record.property)) byProperty.set(record.property, []);
  byProperty.get(record.property).push(record);
}

const candidates = [];
const skipped = { nested: 0, animated: 0, inlineStyle: 0, strongerCompetitor: 0 };
const blockedBy = new Map();

for (const record of records) {
  if (!record.important) continue;
  if (record.unsafe) { skipped.nested += 1; continue; }
  if (animated.has(record.property)) { skipped.animated += 1; continue; }
  if (inlineProperties.has(record.property)) { skipped.inlineStyle += 1; continue; }

  let blocker = null;
  for (const [property, list] of byProperty) {
    if (!propertiesInteract(property, record.property)) continue;
    for (const other of list) {
      if (other === record || other.important) continue;
      if (other.value === record.value) continue; // مقدار یکسان → ظاهر عوض نمی‌شود
      if (beatsAsNormal(other, record)) { blocker = other; break; }
    }
    if (blocker) break;
  }
  if (blocker) {
    skipped.strongerCompetitor += 1;
    const key = `${blocker.property} در ${blocker.file}`;
    blockedBy.set(key, (blockedBy.get(key) || 0) + 1);
    continue;
  }
  candidates.push(record);
}

const report = {
  root: ROOT,
  at: new Date().toISOString(),
  totals: {
    files: files.length,
    declarations: records.length,
    importantDeclarations,
    importantRules,
    removable: candidates.length,
  },
  skipped,
  animatedProperties: [...animated].sort(),
  inlineStyleProperties: [...inlineProperties].sort(),
  candidates: candidates.map((record) => ({
    file: record.file,
    selector: record.selector.slice(0, 140),
    property: record.property,
    value: record.value.slice(0, 60),
  })),
};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');

if (APPLY) {
  const byFile = new Map();
  for (const candidate of candidates) {
    if (!byFile.has(candidate.file)) byFile.set(candidate.file, []);
    byFile.get(candidate.file).push(candidate);
  }
  let removed = 0;
  for (const [file, list] of byFile) {
    const full = path.join(STYLES, file);
    let text = fs.readFileSync(full, 'utf8');
    for (const item of [...list].sort((a, b) => b.importantStart - a.importantStart)) {
      if (item.importantStart < 0) continue;
      text = text.slice(0, item.importantStart)
        + ' '.repeat(item.importantLength)
        + text.slice(item.importantStart + item.importantLength);
      removed += 1;
    }
    fs.writeFileSync(full, text);
  }
  process.stderr.write(`حذف‌شده: ${removed} پرچم در ${byFile.size} فایل\n`);
}

process.stderr.write(
  `اعلان‌ها: ${records.length} · اعلان مهم: ${importantDeclarations} در ${importantRules} قاعده\n` +
  `قابل حذف با اثبات: ${candidates.length}\n` +
  `دست‌نخورده: نامطمئن=${skipped.nested} · انیمیشن=${skipped.animated} · استایل درون‌خطی=${skipped.inlineStyle} · رقیب قوی‌تر با مقدار متفاوت=${skipped.strongerCompetitor}\n` +
  `بیشترین دلایل نگه‌داشتن: ${[...blockedBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key, count]) => `${key} (${count})`).join(' · ')}\n`
);
