const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const cssPath = path.join(root, 'app/src/main/assets/src/styles/060-reports-and-motion.css');
const css = fs.readFileSync(cssPath, 'utf8');
const index = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');

test('financial numbers use the app-bundled Vazirmatn font consistently on every device', () => {
  const block = css.match(/\.hesabno-unified-number-font,[\s\S]*?\{([^}]*)\}/);
  assert.ok(block, 'قاعدهٔ فونت یکپارچهٔ ارقام باید موجود باشد');
  assert.match(block[1], /font-family:\s*"Vazirmatn",\s*"IRANSans"/,
    'فونت محلی برنامه باید قبل از فونت‌های نصب‌شده روی دستگاه امتحان شود');
  assert.match(block[1], /font-variant-numeric:\s*tabular-nums/,
    'ارقام همچنان با عرض ثابت و چینش منظم بمانند');
});

test('the updated number-font stylesheet has a fresh cache version', () => {
  assert.match(index, /060-reports-and-motion\.css\?v=2/);
});
