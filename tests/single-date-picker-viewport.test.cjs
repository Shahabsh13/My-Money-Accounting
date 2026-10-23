const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/scripts/238-hesabno-single-date-picker-viewport.js'),
  'utf8',
);
const motionCss = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/styles/020-core-fixes.css'),
  'utf8',
);

class EventHub {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) {
    if (this.listeners.has(type)) this.listeners.get(type).delete(callback);
  }
  dispatch(type) {
    for (const callback of this.listeners.get(type) || []) callback({ type });
  }
  listenerCount(type) { return (this.listeners.get(type) || new Set()).size; }
}

class FakeMutationObserver {
  constructor(callback) { this.callback = callback; FakeMutationObserver.instance = this; }
  observe() {}
  emit(addedNodes = [], removedNodes = []) {
    this.callback([{ addedNodes, removedNodes }]);
  }
}

function element(attributes = {}, children = []) {
  const classes = new Set();
  const node = {
    nodeType: 1,
    attributes,
    children,
    style: {},
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    isConnected: false,
    matches(selector) {
      return selector.split(',').some((part) => {
        const match = part.trim().match(/^\[(data-[\w-]+)="true"\]$/);
        return match && this.attributes[match[1]] === 'true';
      });
    },
    querySelector(selector) {
      const all = this.querySelectorAll(selector);
      return all[0] || null;
    },
    querySelectorAll(selector) {
      const result = [];
      const visit = (parent) => parent.children.forEach((child) => {
        if (selector.includes('#persian-datepicker-sheet') && child.id === 'persian-datepicker-sheet') result.push(child);
        if (selector.includes('#hesabno-return-datepicker-sheet') && child.id === 'hesabno-return-datepicker-sheet') result.push(child);
        visit(child);
      });
      visit(this);
      return result;
    },
  };
  children.forEach((child) => { child.parentElement = node; });
  return node;
}

function runHelper() {
  const body = {
    nodeType: 1,
    children: [],
    querySelectorAll(selector) {
      const found = [];
      const visit = (parent) => parent.children.forEach((child) => {
        if (child.matches && child.matches(selector)) found.push(child);
        found.push(...child.querySelectorAll(selector));
      });
      visit(this);
      return found;
    },
  };
  const viewport = new EventHub();
  viewport.height = 600;
  viewport.offsetTop = 18;
  const window = new EventHub();
  window.innerHeight = 800;
  window.visualViewport = viewport;
  const document = { body, documentElement: { clientHeight: 800 } };
  vm.runInNewContext(script, { window, document, MutationObserver: FakeMutationObserver, WeakMap });
  return { body, viewport, window, observer: FakeMutationObserver.instance };
}

test('single-date sheets follow the visual viewport while range and keyboard layers remain untouched', () => {
  assert.match(motionCss, /@keyframes hesabno-single-date-sheet-enter\s*\{\s*from\s*\{\s*opacity:\s*0;\s*transform:\s*translate3d\(0,\s*100%,\s*0\)/);
  assert.match(motionCss, /\.hesabno-single-date-sheet\s*\{[^}]*animation:\s*hesabno-single-date-sheet-enter\s+280ms/s);
  const { body, viewport, window, observer } = runHelper();
  const cases = [
    ['data-hesabno-transaction-datepicker', 'persian-datepicker-sheet'],
    ['data-hesabno-settlement-datepicker', 'persian-datepicker-sheet'],
    ['data-hesabno-return-date-picker', 'hesabno-return-datepicker-sheet'],
  ];
  const overlays = cases.map(([marker, id]) => {
    const sheet = element();
    sheet.id = id;
    sheet.classList.add('hesabno-dialog-motion');
    sheet.isConnected = false;
    const overlay = element({ [marker]: 'true' }, [sheet]);
    return { overlay, sheet };
  });

  overlays.forEach(({ overlay, sheet }) => {
    overlay.isConnected = true;
    sheet.isConnected = true;
    body.children.push(overlay);
    observer.emit([overlay]);
    assert.equal(overlay.style.position, 'fixed');
    assert.equal(overlay.style.top, '18px');
    assert.equal(overlay.style.bottom, 'auto');
    assert.equal(overlay.style.height, '600px');
    assert.equal(overlay.style.alignItems, 'flex-end');
    assert.equal(sheet.style.maxHeight, '516px');
    assert.equal(sheet.style.overflowY, 'auto');
    assert.equal(sheet.classList.contains('hesabno-dialog-motion'), false);
    assert.equal(sheet.classList.contains('hesabno-single-date-sheet'), true);
  });

  /* IME یا تغییر اندازه‌ی WebView، visualViewport را کوچک‌تر می‌کند. */
  viewport.height = 350;
  viewport.offsetTop = 42;
  viewport.dispatch('resize');
  overlays.forEach(({ overlay, sheet }) => {
    assert.equal(overlay.style.top, '42px');
    assert.equal(overlay.style.height, '350px');
    assert.equal(sheet.style.maxHeight, '301px');
  });

  const range = element({ 'data-hesabno-date-range-picker': 'true' });
  range.style.position = 'relative';
  range.style.height = 'auto';
  const keyboard = element({ 'data-hesabno-amount-keyboard': 'true' });
  keyboard.style.position = 'fixed';
  keyboard.style.height = '123px';
  body.children.push(range, keyboard);
  observer.emit([range, keyboard]);
  viewport.height = 280;
  viewport.dispatch('resize');
  assert.deepEqual(range.style, { position: 'relative', height: 'auto' });
  assert.deepEqual(keyboard.style, { position: 'fixed', height: '123px' });

  const first = overlays[0];
  first.overlay.isConnected = false;
  first.sheet.isConnected = false;
  body.children = body.children.filter((node) => node !== first.overlay);
  observer.emit([], [first.overlay]);
  assert.equal(viewport.listenerCount('resize'), 2, 'پس از بسته‌شدن یک شیت، listenerهای همان شیت باید پاک شوند');
  assert.equal(window.listenerCount('resize'), 2);
});
