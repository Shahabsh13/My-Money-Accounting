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
    listeners: new Map(),
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      if (this.listeners.has(type)) this.listeners.get(type).delete(callback);
    },
    dispatch(type, event = {}) {
      for (const callback of this.listeners.get(type) || []) callback({ target: this, ...event });
    },
    offsetHeight: 520,
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
  let timerId = 0;
  const timers = new Map();
  const frames = [];
  window.setTimeout = (callback) => { const id = ++timerId; timers.set(id, callback); return id; };
  window.clearTimeout = (id) => timers.delete(id);
  window.requestAnimationFrame = (callback) => frames.push(callback);
  window.getComputedStyle = () => ({ transform: 'matrix(1, 0, 0, 1, 0, -14)', opacity: '0.9' });
  const document = {
    body,
    documentElement: { clientHeight: 800 },
    getElementById(id) {
      const visit = (node) => {
        for (const child of node.children || []) {
          if (child.id === id && child.isConnected) return child;
          const found = visit(child);
          if (found) return found;
        }
        return null;
      };
      return visit(body);
    },
  };
  vm.runInNewContext(script, { window, document, MutationObserver: FakeMutationObserver, WeakMap, WeakSet });
  return { body, viewport, window, document, observer: FakeMutationObserver.instance, timers, frames };
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
    sheet.style.overflowY = 'auto';
    sheet.classList.add('hesabno-dialog-motion');
    sheet.isConnected = false;
    const overlay = element({ [marker]: 'true' }, [sheet]);
    Object.assign(overlay.style, {
      position: 'fixed', top: '0px', right: '0px', bottom: '0px', left: '0px',
    });
    return { overlay, sheet };
  });

  overlays.forEach(({ overlay, sheet }) => {
    overlay.isConnected = true;
    sheet.isConnected = true;
    body.children.push(overlay);
    observer.emit([overlay]);
    assert.equal(overlay.style.position, 'fixed');
    assert.equal(overlay.style.top, '0px');
    assert.equal(overlay.style.right, '0px');
    assert.equal(overlay.style.bottom, '0px');
    assert.equal(overlay.style.left, '0px');
    assert.equal(Object.hasOwn(overlay.style, 'height'), false, 'اندازه و جای overlay باید فقط از inset:0 بیاید');
    assert.equal(overlay.style.alignItems, undefined, 'اسکریپت viewport نباید دوباره چیدمان overlay را تعیین کند');
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
    assert.equal(overlay.style.top, '0px', 'offsetTop نباید به مختصات fixed دوباره اضافه شود');
    assert.equal(overlay.style.bottom, '0px', 'لبهٔ پایین fixed inset باید مرجع واحد بماند');
    assert.equal(Object.hasOwn(overlay.style, 'height'), false, 'ارتفاع صریح نباید با inset:0 رقابت کند');
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

test('single-date close animates from the live transform, freezes geometry, and closes once', () => {
  const { body, viewport, window, document, observer, frames, timers } = runHelper();
  const sheet = element();
  sheet.id = 'persian-datepicker-sheet';
  sheet.isConnected = true;
  const overlay = element({ 'data-hesabno-transaction-datepicker': 'true' }, [sheet]);
  Object.assign(overlay.style, {
    position: 'fixed', top: '0px', right: '0px', bottom: '0px', left: '0px',
  });
  overlay.id = 'persian-datepicker-backdrop';
  overlay.isConnected = true;
  body.children.push(overlay);
  observer.emit([overlay]);

  let closeCalls = 0;
  const wrappedClose = window.__hesabnoWrapSingleDatePickerClose(() => {
    closeCalls += 1;
    overlay.isConnected = false;
    sheet.isConnected = false;
    observer.emit([], [overlay]);
  });
  wrappedClose();
  assert.equal(sheet.style.transform, 'matrix(1, 0, 0, 1, 0, -14)', 'خروج باید از transform زنده شروع شود');
  assert.equal(sheet.classList.contains('hesabno-single-date-sheet-closing'), true);
  assert.equal(closeCalls, 0, 'حذف React باید تا پایان حرکت به تعویق بیفتد');

  const originalMaxHeight = sheet.style.maxHeight;
  viewport.height = 350;
  viewport.dispatch('resize');
  assert.equal(sheet.style.maxHeight, originalMaxHeight, 'تغییر viewport در میانهٔ خروج نباید پنل را بپراند');
  assert.equal(overlay.style.top, '0px');
  assert.equal(overlay.style.bottom, '0px');

  window.__hesabnoWrapSingleDatePickerClose(() => { closeCalls += 1; })();
  assert.equal(frames.length, 1, 'درخواست دوم نباید انیمیشن یا callback دیگری بسازد');
  while (frames.length) frames.shift()();
  assert.equal(sheet.style.transform, 'translate3d(0, 100%, 0)');
  assert.equal(sheet.style.opacity, '0');

  sheet.dispatch('transitionend', { propertyName: 'transform' });
  assert.equal(closeCalls, 1, 'تمام مسیرهای خروج باید فقط یک بار close را صدا بزنند');
  assert.equal(timers.size, 0, 'timer پشتیبان پس از transitionend باید پاک شود');
  assert.equal(viewport.listenerCount('resize'), 0, 'پس از حذف شیت listenerهای viewport باید پاک شوند');
});
