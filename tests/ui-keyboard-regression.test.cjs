const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { installSharedDomObserver } = require('./helpers/production-slices.cjs');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const keypadSource = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/214-hesabno-numeric-keyboard.js'), 'utf8');
const geometrySource = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/220-hesabno-stable-tab-geometry.js'), 'utf8');

async function settleAndClose(dom) { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

function mount(options = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"><div><main><div id="dashboard" style="padding-top: 12px"></div><div class="grow flex flex-col" id="page-content" style="padding-top: 84px" data-hesabno-header-pad="84"><label for="amount">مبلغ تراکنش</label><input id="amount" placeholder="مبلغ" value="" /><input id="ordinary" placeholder="نام شخص" /></div></main></div></div></body></html>`, { url: 'https://app.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  if (!options.legacyTouch) dom.window.PointerEvent = dom.window.MouseEvent; // jsdom lacks PointerEvent by default; emulate modern Android WebView support.
  dom.window.requestAnimationFrame = callback => { callback(); return 1; };
  dom.window.setTimeout = callback => { callback(); return 1; };
  installSharedDomObserver(dom.window);
  dom.window.eval(keypadSource);
  dom.window.eval(geometrySource);
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded", { bubbles: true }));
  return dom;
}

test('amount pointerdown is canceled before native focus while the custom keypad opens', async () => {
  const dom = mount(); const { window } = dom; const input = window.document.getElementById('amount');
  const event = new window.Event('pointerdown', { bubbles: true, cancelable: true });
  input.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(window.document.getElementById('hesabno-amount-keyboard').hidden, false);
  assert.notEqual(window.document.activeElement, input);
  assert.equal(input.readOnly, true);
  assert.equal(input.getAttribute('inputmode'), 'none');
  await settleAndClose(dom);
});


test('legacy WebView touchstart fallback suppresses native focus and opens the custom keypad', async () => {
  const dom = mount({ legacyTouch: true }); const { window } = dom; const input = window.document.getElementById('amount');
  const event = new window.Event('touchstart', { bubbles: true, cancelable: true }); input.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(window.document.getElementById('hesabno-amount-keyboard').hidden, false);
  assert.equal(input.readOnly, true);
  await settleAndClose(dom);
});

test('custom keypad accepts digits and confirm writes the amount then closes the panel', async () => {
  const dom = mount(); const { window } = dom; const input = window.document.getElementById('amount');
  input.dispatchEvent(new window.Event('pointerdown', { bubbles: true, cancelable: true }));
  const panel = window.document.getElementById('hesabno-amount-keyboard');
  panel.querySelector('[data-value="7"]').click();
  panel.querySelector('[data-value="00"]').click();
  assert.equal(input.value, '700');
  let changes = 0; input.addEventListener('change', () => changes++);
  panel.querySelector('[data-hkap-action="confirm"]').click();
  assert.equal(input.value, '700');
  assert.equal(changes, 1);
  assert.equal(panel.hidden, true);
  await settleAndClose(dom);
});

test('ordinary text inputs keep normal pointer focus; keypad suppression is scoped', async () => {
  const dom = mount(); const { window } = dom; const input = window.document.getElementById('ordinary');
  const event = new window.Event('pointerdown', { bubbles: true, cancelable: true }); input.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(input.readOnly, false);
  await settleAndClose(dom);
});

test('non-dashboard content clears stale top padding after initial render and tab rerender, dashboard is untouched', async () => {
  const dom = mount(); const { window } = dom; const content = window.document.getElementById('page-content');
  assert.equal(content.style.paddingTop, '');
  assert.equal(content.hasAttribute('data-hesabno-header-pad'), false);
  const dashboard = window.document.getElementById('dashboard');
  assert.equal(dashboard.style.paddingTop, '12px');
  content.style.paddingTop = '72px'; content.setAttribute('data-hesabno-header-pad', '72');
  content.appendChild(window.document.createElement('section'));
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(content.style.paddingTop, '');
  assert.equal(content.hasAttribute('data-hesabno-header-pad'), false);
  assert.equal(dashboard.style.paddingTop, '12px');
  await settleAndClose(dom);
});

test('geometry script does not own keyboard events and does not add synthetic header padding', () => {
  assert.doesNotMatch(geometrySource, /addEventListener\(['"](?:pointerdown|touchstart|mousedown|focusin)['"]/);
  assert.doesNotMatch(geometrySource, /paddingTop\s*=\s*[^'"\s]/);
  assert.match(geometrySource, /content\.style\.paddingTop = ''/);
});
