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

test('forms slide in horizontally and successful confirmation brings the next screen in from the opposite side', async (t) => {
  const dom = makeDom('<div id="root"><main><h1>خانه</h1></main></div>');
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const main = document.querySelector('main');

  main.innerHTML = '<h1>ثبت سند</h1><form><button type="submit">تأیید</button></form>';
  await wait(0);
  assert.ok(main.classList.contains('hesabno-form-transition-enter-forward'));

  const form = main.querySelector('form');
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  form.remove();
  main.innerHTML = '<h1>خانه</h1>';
  await wait(0);
  assert.ok(main.classList.contains('hesabno-form-transition-enter-confirm'));
});

test('form Back animates out before the previous screen returns, including the app close control', async (t) => {
  const dom = makeDom('<div id="root"><main><header><button type="button" aria-label="بستن">بستن</button></header><h1>ثبت سند</h1><form><input /></form></main></div>');
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const main = document.querySelector('main');
  const back = main.querySelector('button[aria-label="بستن"]');

  back.addEventListener('click', () => {
    main.innerHTML = '<h1>خانه</h1>';
  });
  back.click();
  assert.ok(main.classList.contains('hesabno-form-transition-exit-back'));
  await wait(450);
  assert.equal(main.querySelector('form'), null);
  assert.ok(main.classList.contains('hesabno-form-transition-enter-back'));
});

test('horizontal form transitions use reduced motion and compositor-friendly properties', () => {
  assert.match(motionCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(motionCss, /transform: translate3d\(/);
  assert.match(motionCss, /will-change: transform, opacity/);
  assert.doesNotMatch(motionCss, /height:\s*\d+px[^}]*transition/);
  assert.match(rootStabilityCss, /main:not\(\[class\*="hesabno-form-transition-"\]\)/);
});
