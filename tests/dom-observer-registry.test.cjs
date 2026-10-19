/*
 * آزمون‌های لایه‌ی مشترک MutationObserver (مرحله ۴)
 *
 * هدف: ثابت کنیم ادغام observerها «هم‌رفتار» است، یعنی:
 *   • برای ثبت‌کننده‌های با هدف/گزینه‌ی یکسان، فقط یک observer واقعی ساخته می‌شود
 *   • هر ثبت‌کننده دقیقاً همان رخدادهایی را می‌گیرد که observer مستقل خودش می‌گرفت
 *   • ترتیب اجرا = ترتیب ثبت (مثل ترتیب ساخت observerها در کد اصلی)
 *   • خطای یک callback بقیه را متوقف نمی‌کند
 *   • disconnect هر ثبت‌کننده فقط همان ثبت را برمی‌دارد و به بقیه کاری ندارد
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const registrySource = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/scripts/236-hesabno-shared-dom-observer.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (error) { JSDOM = null; }

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function createHarness(html = '<div id="root"><p class="target">متن</p></div>') {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const window = dom.window;
  const created = [];
  const Real = window.MutationObserver;
  class CountingObserver extends Real {
    constructor(callback) {
      super(callback);
      this.__record = { target: null, options: null };
      created.push(this.__record);
    }
    observe(target, options) {
      this.__record.target = target && (target.id || target.tagName);
      this.__record.options = options;
      return super.observe(target, options);
    }
  }
  window.MutationObserver = CountingObserver;
  window.eval(registrySource);
  return { dom, window, created, registry: window.__hesabnoDom };
}

function addNode(window, tag = 'span') {
  const node = window.document.createElement(tag);
  node.textContent = 'x';
  window.document.getElementById('root').appendChild(node);
}

test('identical target and options share a single real observer', async (t) => {
  if (!JSDOM) return t.skip('jsdom در دسترس نیست');
  const { window, created, registry } = createHarness();
  const calls = [];
  for (let index = 0; index < 25; index += 1) {
    registry.watch(window.document.body, { childList: true, subtree: true }, () => calls.push(index));
  }
  assert.equal(created.length, 1, '۲۵ ثبت با هدف/گزینه‌ی یکسان باید یک observer بسازد');
  assert.equal(registry.stats().handlers, 25);

  addNode(window);
  await tick();
  assert.deepEqual(calls, [...Array(25).keys()], 'همه‌ی ثبت‌کننده‌ها به ترتیب ثبت صدا زده می‌شوند');
});

test('one observer per target, regardless of how many option profiles register', async (t) => {
  if (!JSDOM) return t.skip('jsdom در دسترس نیست');
  const { window, created, registry } = createHarness();
  /* نسخه ۲: گزینه‌ها در یک observer مشترک گشاد می‌شوند و رخدادها برای هر ثبت فیلتر می‌شوند */
  registry.watch(window.document.body, { childList: true, subtree: true }, () => {});
  registry.watch(window.document.body, { subtree: true, childList: true }, () => {});
  registry.watch(window.document.body, { attributes: true, attributeFilter: ['class', 'data-x'] }, () => {});
  registry.watch(window.document.body, { attributes: true, attributeFilter: ['data-x', 'class'] }, () => {});
  assert.equal(created.length, 1, 'چهار پروفایل روی یک هدف = یک observer');
  assert.equal(registry.stats().handlers, 4);
  assert.ok(registry.stats().widened >= 1, 'گشادکردن گزینه‌ها باید ثبت شود');
  assert.equal(registry.stats().activeObservers, 1);
});

test('every matching handler receives the same batch content', async (t) => {
  if (!JSDOM) return t.skip('jsdom در دسترس نیست');
  const { window, registry } = createHarness();
  const received = [];
  registry.watch(window.document.body, { childList: true, subtree: true }, (records) => received.push(['a', records]));
  registry.watch(window.document.body, { childList: true, subtree: true }, (records) => received.push(['b', records]));
  addNode(window);
  await tick();
  assert.equal(received.length, 2);
  const summarize = (records) => records.map((record) => `${record.type}:${record.target === window.document.body ? 'body' : 'other'}`);
  assert.deepEqual(summarize(received[0][1]), summarize(received[1][1]), 'محتوای دسته‌ی تحویلی برای هر دو ثبت یکسان است');
  assert.ok(received[0][1].length >= 1);
  assert.equal(received[0][1][0].type, 'childList');
});

test('a throwing handler does not stop the others and is counted', async (t) => {
  if (!JSDOM) return t.skip('jsdom در دسترس نیست');
  const { window, registry } = createHarness();
  const order = [];
  registry.watch(window.document.body, { childList: true, subtree: true }, () => { order.push('first'); throw new Error('boom'); });
  registry.watch(window.document.body, { childList: true, subtree: true }, () => order.push('second'));
  addNode(window);
  await tick();
  assert.deepEqual(order, ['first', 'second'], 'خطای ثبت‌کننده‌ی اول نباید بقیه را بشکند');
  assert.equal(registry.stats().errors, 1);
});

test('disconnect removes only that registration and frees the observer when the last one leaves', async (t) => {
  if (!JSDOM) return t.skip('jsdom در دسترس نیست');
  const { window, registry, created } = createHarness();
  const seen = [];
  const first = registry.watch(window.document.body, { childList: true, subtree: true }, () => seen.push('first'));
  const second = registry.watch(window.document.body, { childList: true, subtree: true }, () => seen.push('second'));
  assert.equal(registry.stats().activeObservers, 1, 'دو ثبت هم‌پروفایل = یک observer');

  first.disconnect();
  addNode(window);
  await tick();
  assert.deepEqual(seen, ['second'], 'ثبت حذف‌شده نباید اجرا شود');
  assert.equal(registry.stats().activeObservers, 1, 'تا وقتی یک ثبت‌کننده مانده، observer مشترک زنده است');
  assert.equal(registry.stats().handlers, 1);

  second.disconnect();
  assert.equal(registry.stats().activeObservers, 0, 'با رفتن آخرین ثبت‌کننده، observer مشترک آزاد می‌شود');

  const third = registry.watch(window.document.body, { childList: true, subtree: true }, () => seen.push('third'));
  assert.equal(registry.stats().activeObservers, 1, 'ثبت تازه، observer را از نو می‌سازد');
  addNode(window);
  await tick();
  assert.deepEqual(seen, ['second', 'third']);
  assert.equal(created.length, 2, 'observer دوم پس از آزادسازی ساخته می‌شود');
  third.disconnect();
});

test('invalid registrations are ignored safely', (t) => {
  if (!JSDOM) return t.skip('jsdom در دسترس نیست');
  const { window, registry, created } = createHarness();
  const noop = registry.watch(null, { childList: true }, () => {});
  assert.equal(typeof noop.disconnect, 'function');
  registry.watch(window.document.body, { childList: true }, 'not-a-function');
  assert.equal(created.length, 0, 'ثبت نامعتبر نباید observer بسازد');
  assert.equal(registry.watch(window.document.body, { childList: true }, () => {}).active, true);
  assert.equal(created.length, 1);
});

test('loading the registry twice keeps the first instance and its registrations', async (t) => {
  if (!JSDOM) return t.skip('jsdom در دسترس نیست');
  const { window, registry, created } = createHarness();
  const before = registry;
  let calls = 0;
  registry.watch(window.document.body, { childList: true, subtree: true }, () => { calls += 1; });
  window.eval(registrySource);
  assert.equal(window.__hesabnoDom, before, 'بار دوم نباید رجیستری را عوض کند');
  assert.equal(window.__hesabnoDom.stats().handlers, 1);
  addNode(window);
  await tick();
  assert.equal(calls, 1);
  assert.equal(created.length, 1);
});

test('the registry script is wired before every consumer script in index.html', () => {
  const positions = new Map();
  [...indexHtml.matchAll(/<script[^>]*src="src\/scripts\/([^"?]+)[^"]*"[^>]*>/g)].forEach((match, order) => {
    positions.set(match[1], order);
  });
  const registryPosition = positions.get('236-hesabno-shared-dom-observer.js');
  assert.equal(typeof registryPosition, 'number', 'اسکریپت لایه‌ی مشترک باید در index.html لینک شده باشد');

  const scriptsDir = path.join(root, 'app/src/main/assets/src/scripts');
  const consumers = fs.readdirSync(scriptsDir)
    .filter((file) => file.endsWith('.js'))
    .filter((file) => file !== '236-hesabno-shared-dom-observer.js')
    .filter((file) => fs.readFileSync(path.join(scriptsDir, file), 'utf8').includes('__hesabnoDom.watch'));
  for (const consumer of consumers) {
    const position = positions.get(consumer);
    if (typeof position !== 'number') continue;
    assert.ok(position > registryPosition, `${consumer} باید بعد از لایه‌ی مشترک بارگذاری شود`);
  }
});
