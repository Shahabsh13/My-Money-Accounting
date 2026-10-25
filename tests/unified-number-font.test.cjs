const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/scripts/238-hesabno-unified-number-font.js'),
  'utf8',
);
const wait = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

test('visible digits use the same monospace font without changing surrounding Persian text', { timeout: 30000 }, async () => {
  const dom = new JSDOM(`<!doctype html><body>
    <p id="date">پنجشنبه ۳ آبان ۱۴۰۵</p>
    <p id="amount">موجودی: ۷۰،۹۹۰،۰۰۰ ریال</p>
    <p id="split-date"></p>
    <span id="already-mono" class="font-mono">۱۴۰۵</span>
    <input id="amount-input" value="۴،۱۶۶،۶۶۷">
    <textarea id="numeric-textarea">۱۴۰۵/۰۸/۰۳</textarea>
    <input id="placeholder-input" placeholder="۱۴۰۵/۰۸/۰۳">
    <input id="dynamic-input" value="">
  </body>`, { url: 'https://app.test/', runScripts: 'outside-only' });
  const { window } = dom;
  const { document } = window;
  window.__hesabnoDom = {
    watch(target, options, callback) {
      const observer = new window.MutationObserver(callback);
      observer.observe(target, options);
      return observer;
    },
  };
  const splitDate = document.getElementById('split-date');
  splitDate.appendChild(document.createTextNode('دوشنبه '));
  splitDate.appendChild(document.createTextNode('۷'));
  splitDate.appendChild(document.createTextNode(' آبان'));
  window.eval(script);

  const date = document.getElementById('date');
  const dateNumbers = date.querySelectorAll('[data-hesabno-unified-number-font="true"]');
  assert.equal(dateNumbers.length, 2, 'روز و سال باید فونت عددی یکسان بگیرند');
  assert.deepEqual([...dateNumbers].map((node) => node.textContent), ['۳', '۱۴۰۵']);
  assert.ok([...date.childNodes].some((node) => node.nodeType === 3 && node.textContent.includes('پنجشنبه')),
    'متن فارسی کنار اعداد نباید در فونت عددی قرار بگیرد');
  for (const number of dateNumbers) {
    assert.ok(number.classList.contains('font-mono'));
    assert.equal(number.getAttribute('dir'), 'ltr');
  }
  const splitNumber = splitDate.querySelector('[data-hesabno-unified-number-font="true"]');
  assert.equal(splitNumber?.textContent, '۷', 'عدد مستقل در مجموعهٔ متن‌ها نیز باید monospace شود');
  assert.ok([...splitDate.childNodes].some((node) => node.nodeType === 3 && node.textContent.includes('دوشنبه')),
    'پیچاندن عدد نباید متن فارسی مجاور را بگیرد');

  const amount = document.getElementById('amount');
  assert.equal(amount.querySelector('[data-hesabno-unified-number-font="true"]')?.textContent, '۷۰،۹۹۰،۰۰۰');
  assert.ok([...amount.childNodes].some((node) => node.nodeType === 3 && node.textContent.includes('ریال')),
    'واحد پول باید با فونت متن اصلی باقی بماند');
  assert.equal(document.querySelectorAll('#already-mono [data-hesabno-unified-number-font]').length, 0,
    'عددهای از قبل monospace نباید دوباره پیچیده شوند');

  const amountInput = document.getElementById('amount-input');
  assert.ok(amountInput.classList.contains('font-mono'), 'فیلد عددی موجود باید همان فونت بگیرد');
  assert.equal(amountInput.getAttribute('data-hesabno-unified-input-font'), 'true');
  assert.ok(document.getElementById('numeric-textarea').classList.contains('font-mono'),
    'textareaهای دارای تاریخ یا عدد نیز باید همان فونت را بگیرند');
  assert.ok(document.getElementById('placeholder-input').classList.contains('font-mono'),
    'placeholderهای صرفاً عددی هم باید monospace باشند');

  const dynamicInput = document.getElementById('dynamic-input');
  dynamicInput.value = '۱۲۳۴';
  dynamicInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.ok(dynamicInput.classList.contains('font-mono'), 'فیلدی که بعداً مقدار عددی می‌گیرد باید به‌روز شود');
  dynamicInput.value = 'قسط ۱۲۳۴';
  dynamicInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(dynamicInput.classList.contains('font-mono'), false,
    'فونت فارسیِ فیلد متنی مختلط نباید تغییر کند');

  const lateText = document.createElement('span');
  lateText.textContent = 'شماره سند ۹۸۷۶';
  document.body.appendChild(lateText);
  await wait();
  assert.equal(lateText.querySelector('[data-hesabno-unified-number-font="true"]')?.textContent, '۹۸۷۶',
    'اعدادی که بعداً به DOM افزوده می‌شوند نیز باید یکدست شوند');

  await wait();
  assert.equal(date.querySelectorAll('[data-hesabno-unified-number-font="true"]').length, 2,
    'پایش DOM نباید روی عددها لایهٔ تکراری بسازد');
  window.close();
});
