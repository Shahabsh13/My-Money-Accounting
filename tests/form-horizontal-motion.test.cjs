const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const motionScript = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/scripts/074-hesabno-page-open-close-motion-script.js'),
  'utf8',
);
const sideMotionScript = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/scripts/079-hesabno-full-page-side-motion-script.js'),
  'utf8',
);
const softMotionScript = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/scripts/071-hesabno-soft-motion.js'),
  'utf8',
);
const motionCss = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/styles/043-hesabno-page-open-close-motion.css'),
  'utf8',
);
const rootStabilityCss = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/styles/235-hesabno-text-root-and-display-stability.css'),
  'utf8',
);

function makeDom(markup) {
  const dom = new JSDOM(markup, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false });
  window.__hesabnoDom = {
    watch(target, options, callback) {
      const observer = new window.MutationObserver(callback);
      observer.observe(target, options);
      return observer;
    },
  };
  window.eval(motionScript);
  return dom;
}

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

test('form pages enter and successful confirmation returns without animating the full main subtree', async (t) => {
  const dom = makeDom('<div id="root"><main><h1>خانه</h1></main></div>');
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const main = document.querySelector('main');

  main.innerHTML = '<h1>ثبت سند</h1><form><button type="submit">تأیید</button></form>';
  await wait(25);
  assert.doesNotMatch(main.className, /hesabno-form-transition-/,'page entry does not animate or promote the full form subtree');

  const form = main.querySelector('form');
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  form.remove();
  main.innerHTML = '<h1>خانه</h1>';
  await wait(25);
  assert.doesNotMatch(main.className, /hesabno-form-transition-/,'successful confirmation returns without a second full-page transition');
});

test('transaction composer opens and closes without animating or delaying its large main subtree', async (t) => {
  const dom = makeDom('<div id="root"><main><h1>خانه</h1></main></div>');
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const main = document.querySelector('main');
  main.innerHTML = '<header><button type="button" aria-label="بازگشت">بازگشت</button></header><h1>ثبت تراکنش</h1><form><input id="field-amount-input"></form>';
  await wait(25);
  assert.doesNotMatch(main.className, /hesabno-form-transition-/,
    'the large transaction composer should not be promoted and translated as one layer');

  let nativeBackCalls = 0;
  const back = main.querySelector('button[aria-label="بازگشت"]');
  back.addEventListener('click', () => {
    nativeBackCalls += 1;
    main.innerHTML = '<h1>خانه</h1>';
  });
  back.click();
  assert.equal(nativeBackCalls, 1, 'Back reaches the application handler on the initial tap');
  assert.doesNotMatch(main.className, /hesabno-form-transition-/,
    'closing the composer does not wait for a full-page exit animation');
  await wait(25);
  assert.doesNotMatch(main.className, /hesabno-form-transition-/,
    'the dashboard does not receive a second stacked transition after closing');
});

test('form Back reaches the app close handler immediately without a page exit delay', async (t) => {
  const dom = makeDom('<div id="root"><main><header><button type="button" aria-label="بستن">بستن</button></header><h1>ثبت سند</h1><form><input /></form></main></div>');
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const main = document.querySelector('main');
  const back = main.querySelector('button[aria-label="بستن"]');

  back.addEventListener('click', () => {
    main.innerHTML = '<h1>خانه</h1>';
  });
  back.click();
  assert.equal(main.querySelector('form'), null, 'the app close handler runs on the initial tap');
  assert.doesNotMatch(main.className, /hesabno-form-transition-/,'Back does not wait for a page-level exit animation');
});

test('detail Back navigation runs immediately and transaction Back reaches its native handler', () => {
  const dom = new JSDOM('<div id="root"><main><header><button id="detail-back" title="بازگشت">بازگشت</button></header></main></div>', {
    runScripts: 'outside-only',
  });
  try {
    const { window } = dom;
    let navigateCalls = 0;
    window.__hesabnoNavigateBack = () => { navigateCalls += 1; return true; };
    window.eval(sideMotionScript);
    const detailEvent = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    window.document.getElementById('detail-back').dispatchEvent(detailEvent);
    assert.equal(navigateCalls, 1, 'custom navigation history runs synchronously on Back');
    assert.equal(detailEvent.defaultPrevented, true);

    const main = window.document.querySelector('main');
    main.innerHTML = '<header><button id="transaction-back" title="بازگشت">بازگشت</button></header><form><input id="field-amount-input"></form>';
    let nativeCalls = 0;
    window.document.getElementById('transaction-back').addEventListener('click', () => { nativeCalls += 1; });
    window.document.getElementById('transaction-back').click();
    assert.equal(nativeCalls, 1, 'transaction Back is not intercepted by the generic page handler');
    assert.equal(navigateCalls, 1);
  } finally { dom.window.close(); }
});

test('page motion is disabled for large surfaces and retains reduced-motion support', () => {
  assert.match(motionCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(motionCss, /animation: none !important/);
  assert.match(rootStabilityCss, /#root main\.hesabno-form-transition-exit-back[\s\S]*?animation: none !important/);
  assert.doesNotMatch(motionCss, /height:\s*\d+px[^}]*transition/);
  assert.match(rootStabilityCss, /main:not\(\[class\*="hesabno-form-transition-"\]\)/);
});

test('transaction amount form bypasses legacy motion scans and duplicate page entry', async (t) => {
  const dom = new JSDOM('<div id="root"><main><h1>ثبت تراکنش</h1><form><input id="field-amount-input"><button type="button">انتخاب حساب</button></form></main></div>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  let observerCallback;
  let fullButtonScans = 0;
  let fixedLayerScans = 0;
  const originalQuerySelectorAll = window.document.querySelectorAll.bind(window.document);
  window.document.querySelectorAll = selector => {
    if (selector === 'button') fullButtonScans += 1;
    if (selector === '[class*="fixed"]') fixedLayerScans += 1;
    return originalQuerySelectorAll(selector);
  };
  window.__hesabnoDom = {
    watch(_target, _options, callback) { observerCallback = callback; return null; },
  };

  window.eval(softMotionScript);
  // Ignore the deliberate one-time startup pass; verify later route mutations are incremental.
  fixedLayerScans = 0;
  observerCallback([]);
  await Promise.resolve();
  const main = window.document.querySelector('main');
  assert.equal(fullButtonScans, 0, 'the legacy enhancer must not rescan every control in the large transaction form');
  assert.equal(fixedLayerScans, 0, 'the transaction fast path must skip the global fixed-overlay scan');
  assert.ok(!main.classList.contains('hesabno-page-enter'),
    'the transaction form uses its dedicated transition instead of stacking the old page entrance');
});
