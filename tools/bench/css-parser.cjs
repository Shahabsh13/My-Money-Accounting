/*
 * تجزیه‌گر مشترک CSS برای ابزارهای مرحله‌ی ۳.
 *
 * چرا دست‌ساز؟ پروژه هیچ وابستگی CSS ندارد و نمی‌خواهیم برای یک کار داخلی، زنجیره‌ی npm اضافه کنیم.
 * این تجزیه‌گر برای کار ما کافی است: قاعده‌ها، اعلان‌ها، `!important`، at-rule‌های گروهی،
 * و مکان دقیق هر اعلان در فایل (برای جراحی بی‌خطر روی متن).
 *
 * محدودیت‌های شناخته‌شده (به‌صورت محافظه‌کارانه علامت‌گذاری می‌شوند، نه نادیده):
 *   • سلکتورهای تودرتو (nesting با &) و :has()/:nth-child(… of …) → «قابل ارزیابی نیست»
 *   • شبه‌کلاس‌های وابسته به حالت (:hover, :focus, …) و شبه‌عنصرها → «پویا»
 */
const DYNAMIC_PSEUDO = /:(hover|focus|focus-visible|focus-within|active|checked|disabled|enabled|target|invalid|user-invalid|valid|placeholder-shown|open|popover-open|autofill|default|indeterminate|read-only|read-write|required|optional|in-range|out-of-range|blank)\b/;
const GROUP_AT_RULES = new Set(['media', 'supports', 'layer', 'container', 'document', 'scope', 'starting-style']);
const UNSAFE_PATTERN = /&|:has\(|:nth-child\([^)]*\bof\b|:nth-last-child\([^)]*\bof\b|\|\|/;

function stripComments(text) {
  let commentBytes = 0;
  const css = text.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    commentBytes += match.length;
    return ' '.repeat(match.length);
  });
  return { css, commentBytes };
}

/** رشته‌های داخل CSS (content:"…") را با فاصله جایگزین می‌کند تا پارس اعلان‌ها خراب نشود */
function maskStrings(text) {
  return text.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (match) => ' '.repeat(match.length) === match ? match : '\u0000'.repeat(match.length));
}

function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === separator && depth === 0) { parts.push(current); current = ''; continue; }
    current += ch;
  }
  parts.push(current);
  return parts;
}

/** اعلان‌های یک بلوک با مکان دقیق نسبت به ابتدای بلوک */
function parseDeclarations(body, bodyOffset) {
  const masked = maskStrings(body);
  const declarations = [];
  let cursor = 0;
  for (const chunk of splitTopLevel(masked, ';')) {
    const raw = body.slice(cursor, cursor + chunk.length);
    const localIndex = raw.indexOf(':');
    if (localIndex > -1) {
      const property = raw.slice(0, localIndex).trim().toLowerCase();
      let value = raw.slice(localIndex + 1);
      if (property && !property.startsWith('@')) {
        const importantMatch = /!\s*important\s*$/i.exec(value);
        const important = !!importantMatch;
        declarations.push({
          property,
          value: value.trim(),
          important,
          start: bodyOffset + cursor,
          end: bodyOffset + cursor + raw.length,
          importantStart: important ? bodyOffset + cursor + localIndex + 1 + (value.length - importantMatch[0].length) : -1,
          importantLength: important ? importantMatch[0].length : 0,
        });
      }
    }
    cursor += chunk.length + 1;
  }
  return declarations;
}

/** تجزیه‌ی کل فایل: قاعده‌های سطح‌بالا و داخل at-rule‌های گروهی */
function parseCss(text) {
  const { css, commentBytes } = stripComments(text);
  const rules = [];
  const atStack = [];
  const frames = [];
  let preludeStart = 0;
  let keyframesDepth = 0;
  let index = 0;

  while (index < css.length) {
    const ch = css[index];
    if (ch === '{') {
      const prelude = css.slice(preludeStart, index).trim();
      const atMatch = /^@([\w-]+)/.exec(prelude);
      const atName = atMatch ? atMatch[1].toLowerCase() : null;
      const isGroup = !!atName && GROUP_AT_RULES.has(atName);
      const isKeyframes = atName === 'keyframes' || atName === '-webkit-keyframes';
      frames.push({ prelude, atName, isGroup, isKeyframes });
      if (isGroup) atStack.push(prelude.replace(/\s+/g, ' '));
      if (isKeyframes) keyframesDepth += 1;
      preludeStart = index + 1;
      index += 1;
      continue;
    }
    if (ch === '}') {
      const frame = frames.pop();
      if (frame) {
        if (frame.isKeyframes) keyframesDepth = Math.max(0, keyframesDepth - 1);
        else if (frame.isGroup) atStack.pop();
        else if (keyframesDepth === 0) {
          const body = css.slice(preludeStart, index);
          const selector = frame.prelude.trim();
          if (selector && !selector.startsWith('@')) {
            rules.push({
              selector,
              body,
              at: atStack.slice(),
              important: body.includes('!important'),
              importantCount: (body.match(/!important/gi) || []).length,
              bytes: frame.prelude.length + body.length + 2,
              bodyStart: preludeStart,
              declarations: parseDeclarations(body, preludeStart),
              dynamic: DYNAMIC_PSEUDO.test(selector),
              unsafe: UNSAFE_PATTERN.test(selector),
            });
          }
        }
      }
      preludeStart = index + 1;
      index += 1;
      continue;
    }
    if (ch === ';' && frames.length === 0) preludeStart = index + 1;
    index += 1;
  }
  return { rules, commentBytes };
}

/** نام کلاس‌های یک سلکتور با برداشتن escape‌ها (md\:flex → md:flex) */
function classTokens(selector) {
  const tokens = new Set();
  const re = /\.((?:\\.|[^\s.#:>+~,[\]()*])+)/g;
  let match;
  while ((match = re.exec(selector)) !== null) {
    const value = match[1].replace(/\\(.)/g, '$1');
    if (value) tokens.add(value);
  }
  return tokens;
}

/** وزن اختصاصی بودن یک سلکتور (a,b,c). در موارد نامطمئن null برمی‌گرداند. */
function specificity(selector) {
  if (UNSAFE_PATTERN.test(selector)) return null;
  let a = 0; let b = 0; let c = 0;
  for (const part of splitTopLevel(selector, ',')) {
    const single = part.trim();
    if (!single) continue;
    let text = single.replace(/:where\([^)]*\)/g, '');
    const ids = (text.match(/#[\w-]+/g) || []).length;
    const classes = (text.match(/\.[\w-]+/g) || []).length + (text.match(/\[[^\]]*\]/g) || []).length;
    const pseudoClasses = (text.match(/(?<!:):(?!:)[\w-]+(\([^)]*\))?/g) || []).length;
    const elements = (text.match(/(^|[\s>+~])([a-zA-Z][\w-]*)/g) || []).length + (text.match(/::[\w-]+/g) || []).length;
    a += ids;
    b += classes + pseudoClasses;
    c += elements;
  }
  return [a, b, c];
}

/** دو ویژگی که می‌توانند روی هم اثر بگذارند (شامل shorthand/longhand) */
const PROPERTY_FAMILIES = [
  ['margin'], ['padding'], ['border'], ['border-radius'], ['inset', 'top', 'right', 'bottom', 'left'],
  ['flex'], ['grid'], ['gap', 'row-gap', 'column-gap'], ['font'], ['background'], ['overflow'],
  ['transition'], ['animation'], ['transform'], ['text-decoration'], ['outline'], ['box-shadow', 'box-sizing'],
  ['scroll', 'scroll-behavior', 'scroll-margin', 'scroll-padding'], ['size', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height'],
];
function propertiesInteract(first, second) {
  if (first === second) return true;
  const a = first.toLowerCase();
  const b = second.toLowerCase();
  if (a.startsWith(`${b}-`) || b.startsWith(`${a}-`)) return true;
  const rootOf = (property) => property.split('-')[0];
  if (rootOf(a) === rootOf(b)) return true;
  return PROPERTY_FAMILIES.some((family) => family.some((name) => a === name || a.startsWith(`${name}-`)) &&
    family.some((name) => b === name || b.startsWith(`${name}-`)));
}

module.exports = {
  parseCss,
  classTokens,
  specificity,
  propertiesInteract,
  splitTopLevel,
  stripComments,
  DYNAMIC_PSEUDO,
  UNSAFE_PATTERN,
  GROUP_AT_RULES,
};
