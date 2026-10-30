const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const index = fs.readFileSync('app/src/main/assets/index.html', 'utf8');
const bundle = fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js', 'utf8');
const viewportScript = fs.readFileSync(
  'app/src/main/assets/src/scripts/239-hesabno-security-dialog-viewport.js',
  'utf8',
);
const styles = fs.readFileSync(
  'app/src/main/assets/src/styles/235-hesabno-text-root-and-display-stability.css',
  'utf8',
);

function wait(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class FakeStyle {
  constructor() { this.values = new Map(); }
  setProperty(name, value) { this.values.set(name, String(value)); }
  getPropertyValue(name) { return this.values.get(name) || ''; }
}

function setupViewportHarness() {
  const window = new EventTarget();
  window.innerHeight = 740;
  window.setTimeout = setTimeout;
  window.requestAnimationFrame = (callback) => setTimeout(callback, 0);

  const viewport = new EventTarget();
  viewport.height = 740;
  viewport.offsetTop = 0;
  window.visualViewport = viewport;

  const card = { style: new FakeStyle() };
  const dialog = {
    style: new FakeStyle(),
    querySelector(selector) {
      return selector === '[data-hesabno-security-card="true"]' ? card : null;
    },
  };
  const document = new EventTarget();
  document.body = {};
  document.documentElement = { clientHeight: 740 };
  document.querySelector = function querySelector(selector) {
    return selector === '[data-hesabno-security-settings="true"]' ? dialog : null;
  };
  class FakeMutationObserver { observe() {} }

  vm.runInNewContext(viewportScript, { window, document, MutationObserver: FakeMutationObserver });
  return { window, viewport, dialog, card };
}

test('security settings dialog follows Android visible viewport and restores its centered-height limit after keyboard closes', async () => {
  const { viewport, dialog, card } = setupViewportHarness();
  await wait();

  assert.equal(dialog.style.getPropertyValue('--hesabno-security-viewport-height'), '740px');
  assert.equal(card.style.getPropertyValue('--hesabno-security-card-max-height'), '592px');
  assert.ok(592 < 740, 'the settings card must remain windowed with visible space around it');

  viewport.height = 350;
  viewport.offsetTop = 16;
  viewport.dispatchEvent(new Event('resize'));
  viewport.dispatchEvent(new Event('scroll'));
  await wait();
  assert.equal(dialog.style.getPropertyValue('--hesabno-security-viewport-top'), '16px');
  assert.equal(dialog.style.getPropertyValue('--hesabno-security-viewport-height'), '350px');
  assert.equal(card.style.getPropertyValue('--hesabno-security-card-max-height'), '280px',
    'the settings card must become internally scrollable instead of expanding beyond the keyboard-visible area');

  viewport.height = 740;
  viewport.offsetTop = 0;
  viewport.dispatchEvent(new Event('resize'));
  await wait();
  assert.equal(dialog.style.getPropertyValue('--hesabno-security-viewport-height'), '740px');
  assert.equal(card.style.getPropertyValue('--hesabno-security-card-max-height'), '592px',
    'the dialog must recover its normal centered, windowed layout after the keyboard closes');
});

test('security settings dialog is explicitly marked and bounded to the live viewport', () => {
  assert.ok(index.includes('src/scripts/239-hesabno-security-dialog-viewport.js?v=2'));
  assert.ok(bundle.includes('data-hesabno-security-settings'));
  assert.ok(bundle.includes('data-hesabno-security-card'));
  assert.match(styles, /\[data-hesabno-security-settings="true"\][\s\S]*?height:\s*var\(--hesabno-security-viewport-height/);
  assert.match(styles, /\[data-hesabno-security-card="true"\][\s\S]*?max-height:\s*var\(--hesabno-security-card-max-height/);
  assert.match(styles, /overflow-y:\s*auto !important/);
});
