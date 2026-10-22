const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const bundle = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/067-inline.js'), 'utf8');

test('dashboard greeting heart is a stable vector icon, not a font-dependent text glyph', () => {
  const greetingStart = bundle.indexOf('امیدوارم امروز روز خوبی داشته باشی');
  assert.notEqual(greetingStart, -1, 'متن خوشامد داشبورد پیدا شود');
  const paragraphStart = bundle.lastIndexOf('e.jsxs("p",{', greetingStart);
  assert.notEqual(paragraphStart, -1, 'پاراگراف متن خوشامد پیدا شود');
  const snippet = bundle.slice(paragraphStart, greetingStart + 700);
  assert.match(snippet, /e\.jsxs\("p",\{className:"text-\[10\.5px\] sm:text-\[11px\] text-stone-400 font-medium"/,
    'پاراگراف نباید flex باشد؛ تا متن و قلب با هم و در امتداد شکست سطر جابه‌جا شوند');
  assert.match(snippet, /e\.jsx\("svg",\{className:"inline-block align-middle shrink-0",width:12,height:12/,
    'قلب باید اندازه و شکل برداری ثابت داشته باشد');
  assert.match(snippet, /stroke:"currentColor"[^}]*"aria-hidden":!0/, 
    'آیکون تزئینی باید از فناوری کمکی مخفی باشد');
  assert.doesNotMatch(snippet, /children:"♡"|children:"♥"/,
    'از نویسهٔ قلب وابسته به فونت استفاده نشود');
});
