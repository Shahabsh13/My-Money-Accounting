const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const unifiedNumbers = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/scripts/238-hesabno-unified-number-font.js'),
  'utf8',
);
const autoFit = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/scripts/240-hesabno-numeric-text-auto-fit.js'),
  'utf8',
);
const wait = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));

test('long rendered numbers shrink to their box and grow back when space returns', { timeout: 30000 }, async () => {
  const dom = new JSDOM(`<!doctype html><body>
    <p id="box" style="font-size:14px">مبلغ: ۱۲۳۴۵۶۷۸۹۰ ریال</p>
    <div id="legacy-box"><p id="legacy" class="font-mono" style="font-size:14px">۹۸۷۶۵۴۳۲۱۰</p></div>
  </body>`, { url: 'https://app.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const { document } = window;
  let availableWidth = 60;

  for (const id of ['box', 'legacy-box']) {
    Object.defineProperty(document.getElementById(id), 'clientWidth', {
      configurable: true,
      get: () => availableWidth,
    });
  }
  Object.defineProperty(window.HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() {
      if (!this.matches || (!this.matches('[data-hesabno-unified-number-font="true"]') && !this.classList.contains('font-mono'))) return 0;
      const fontSize = parseFloat(window.getComputedStyle(this).fontSize) || 14;
      return this.textContent.length * fontSize * 0.7;
    },
  });
  window.__hesabnoDom = {
    watch(target, options, callback) {
      const observer = new window.MutationObserver(callback);
      observer.observe(target, options);
      return observer;
    },
  };

  window.eval(unifiedNumbers);
  window.eval(autoFit);
  await wait();

  const number = document.querySelector('[data-hesabno-unified-number-font="true"]');
  assert.ok(number, 'the shared number wrapper should be available to the fit layer');
  assert.ok(parseFloat(number.style.fontSize) < 14, 'a long value should be rendered in a smaller font');
  assert.ok(number.style.maxWidth.endsWith('px'), 'the number should have a measurable invisible width bound');
  assert.ok(number.style.overflow === 'hidden', 'overflow is clipped as a final guard for unusually large values');
  const legacyNumber = document.getElementById('legacy');
  assert.ok(parseFloat(legacyNumber.style.fontSize) < 14,
    'numbers already marked with font-mono should also be fitted, not only newly wrapped numbers');

  availableWidth = 300;
  window.dispatchEvent(new window.Event('resize'));
  await wait();
  assert.equal(number.style.fontSize, '', 'font size should return to its CSS value when the box becomes wide enough');
  assert.equal(number.hasAttribute('data-hesabno-auto-fit-base-size'), false,
    'temporary auto-fit metadata should be removed after restoring the original layout');
  assert.equal(legacyNumber.style.fontSize, '14px', 'pre-existing monospace number styles should also be restored');

  window.close();
});

test('auto-fit layer is wired into the Android asset entry point and uses the shared observer', () => {
  const index = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
  assert.ok(index.includes('src/scripts/240-hesabno-numeric-text-auto-fit.js?v=2'));
  assert.ok(autoFit.includes('window.__hesabnoDom.watch'));
  assert.ok(autoFit.includes('window.addEventListener("resize"'));
  assert.ok(autoFit.includes('record.addedNodes.forEach(schedule)'),
    'newly rendered numeric content should be fitted through the shared DOM observer');
  assert.equal(autoFit.includes('document.addEventListener("click", scanAll, true)'), false,
    'clicks must not trigger an expensive full-document fit scan');
});
