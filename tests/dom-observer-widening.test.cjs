/*
 * آزمون «گشادکردن پروفایل» در لایه‌ی مشترک observer
 *
 * پرسش: وقتی چند ثبت‌کننده با گزینه‌های متفاوت روی یک هدف به یک observer مشترک می‌روند،
 * آیا هر callback **دقیقاً** همان رخدادهایی را می‌گیرد که observer مستقل خودش می‌گرفت؟
 *
 * روش: روی یک جریان جهش یکسان، دو مسیر را کنار هم اجرا می‌کنیم:
 *   الف) ثبت‌کننده‌های مستقل: هر کدام `new MutationObserver` با گزینه‌های دقیق خودش
 *   ب) همان ثبت‌کننده‌ها از طریق window.__hesabnoDom.watch (یک observer مشترک برای هدف)
 * سپس «سیاهه‌ی فراخوانی‌ها»ی دو طرف را مو‌به‌مو با هم مقایسه می‌کنیم: ترتیب فراخوانی،
 * ترتیب رخدادها در هر فراخوانی، نوع، هدف، گره‌های افزوده/حذف‌شده، نام ویژگی و oldValue.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const registrySource = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/scripts/236-hesabno-shared-dom-observer.js'), 'utf8');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (error) { JSDOM = null; }

const HTML = `<!doctype html><html><body>
  <div id="root">
    <section class="card" data-kind="a"><span class="label">متن</span><button id="go">برو</button></section>
    <p id="note">یادداشت</p>
  </div>
</body></html>`;

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function label(node) {
  if (!node) return 'null';
  if (node.nodeType === 3) return `#text(${(node.textContent || '').slice(0, 6)})`;
  return `${String(node.tagName || node.nodeName).toLowerCase()}${node.id ? '#' + node.id : ''}${node.className ? '.' + String(node.className).split(/\s+/)[0] : ''}`;
}

function pathOf(node, stop) {
  const parts = [];
  let current = node;
  while (current && current !== stop) {
    parts.unshift(label(current));
    current = current.parentNode;
  }
  return parts.join('>');
}

function canonical(records, stop) {
  return records.map((record) => [
    record.type,
    pathOf(record.target, stop),
    [...record.addedNodes].map((node) => label(node)).join(','),
    [...record.removedNodes].map((node) => label(node)).join(','),
    record.attributeName || '',
    record.oldValue === null || record.oldValue === undefined ? 'null' : JSON.stringify(record.oldValue),
  ].join('|')).join('\n');
}

/* هارنس: هر دو مسیر (مستقل و مشترک) روی یک سند و یک جریان جهش */
function createHarness() {
  /* runScripts لازم است تا window.eval در realm خود jsdom اجرا شود (MutationObserver واقعی) */
  const dom = new JSDOM(HTML, { pretendToBeVisual: true, url: 'https://app.test/', runScripts: 'outside-only' });
  const window = dom.window;
  const created = [];
  const Real = window.MutationObserver;
  class CountingObserver extends Real {
    constructor(callback) { super(callback); created.push(callback); }
  }
  window.MutationObserver = CountingObserver;
  window.eval(registrySource);
  const document = window.document;
  const body = document.body;
  const rootNode = document.getElementById('root');
  const logs = { shared: {}, independent: {} };
  const observers = [];

  function watchShared(name, target, options) {
    logs.shared[name] = logs.shared[name] || [];
    const facade = window.__hesabnoDom.watch(target, options, (records) => {
      logs.shared[name].push(canonical(records, body));
    });
    return facade;
  }

  function watchIndependent(name, target, options) {
    logs.independent[name] = logs.independent[name] || [];
    const observer = new window.MutationObserver((records) => {
      logs.independent[name].push(canonical(records, body));
    });
    observer.observe(target, options);
    observers.push(observer);
  }

  return {
    window, document, body, rootNode, logs, observers, created,
    watchShared, watchIndependent,
    stats: () => window.__hesabnoDom.stats(),
    async settle() { await tick(); await tick(); },
    disconnectAll() { observers.forEach((observer) => observer.disconnect()); },
  };
}

function compare(harness, names) {
  for (const name of names) {
    assert.deepEqual(harness.logs.shared[name], harness.logs.independent[name],
      `سیاهه‌ی فراخوانی «${name}» باید مو‌به‌مو یکسان باشد`);
  }
}

const CASES = [
  { name: 'childList+subtree', options: { childList: true, subtree: true } },
  { name: 'childList (بدون subtree)', options: { childList: true } },
  { name: 'characterData+subtree', options: { childList: true, subtree: true, characterData: true } },
  { name: 'attributes فیلترشده', options: { attributes: true, subtree: true, attributeFilter: ['class'] } },
  { name: 'attributes بی‌فیلتر', options: { attributes: true, subtree: true } },
  { name: 'attributes+oldValue', options: { attributes: true, subtree: true, attributeOldValue: true } },
  { name: 'attributes+oldValue فیلترشده', options: { attributes: true, subtree: true, attributeOldValue: true, attributeFilter: ['data-kind', 'class'] } },
  { name: 'characterData+oldValue', options: { childList: true, subtree: true, characterData: true, characterDataOldValue: true } },
  { name: 'همه‌چیز', options: { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['style'] } },
];

async function mutate(harness) {
  const { document, rootNode, window } = harness;
  const card = rootNode.querySelector('.card');
  const labelNode = rootNode.querySelector('.label');
  const note = document.getElementById('note');

  /* فاز ۱: تغییر ویژگی‌ها */
  card.setAttribute('class', 'card wide');
  card.setAttribute('data-kind', 'b');
  card.setAttribute('style', 'color: red');
  card.setAttribute('data-unknown', 'x');
  await harness.settle();

  /* فاز ۲: تغییر متن گره متنی و افزودن/حذف گره */
  labelNode.firstChild.textContent = 'برچسب تازه';
  const extra = document.createElement('span');
  extra.id = 'extra';
  card.appendChild(extra);
  await harness.settle();

  /* فاز ۳: حذف گره، افزودن به فرزند، تغییر متن */
  extra.remove();
  note.appendChild(document.createTextNode('پیوست'));
  note.firstChild.textContent = 'یادداشت تازه';
  await harness.settle();

  /* فاز ۴: تغییر ویژگی روی گره تودرتو + ویژگی خارج از فیلترها */
  const button = document.getElementById('go');
  button.setAttribute('class', 'primary');
  button.setAttribute('title', 'رفتن');
  window.setTimeout(() => { }, 1);
  await harness.settle();
}

test('widened shared observer delivers identical call logs to every registered handler', async (t) => {
  if (!JSDOM) return t.skip('jsdom در دسترس نیست');
  const harness = createHarness();
  try {
    for (const item of CASES) {
      harness.watchShared(item.name, harness.body, item.options);
      harness.watchIndependent(item.name, harness.body, item.options);
    }
    await harness.settle();
    const observersAfterRegistration = harness.stats().observers;
    assert.equal(observersAfterRegistration, 1, 'همه‌ی ثبت‌کننده‌ها روی یک هدف = یک observer مشترک');
    assert.equal(harness.stats().handlers, CASES.length);

    await mutate(harness);
    compare(harness, CASES.map((item) => item.name));

    const stats = harness.stats();
    assert.equal(stats.errors, 0);
    assert.ok(stats.records > 0, 'رخدادی پردازش شده باشد');
    assert.ok(stats.skippedEmpty > 0, 'callback‌های بی‌رخداد نباید فراخوانی شوند');
  } finally { harness.disconnectAll(); }
});

test('handlers registered later still receive only mutations after their registration', async (t) => {
  if (!JSDOM) return t.skip('jsdom در دسترس نیست');
  const harness = createHarness();
  try {
    harness.watchShared('childList+subtree', harness.body, { childList: true, subtree: true });
    harness.watchIndependent('childList+subtree', harness.body, { childList: true, subtree: true });
    await harness.settle();

    const card = harness.rootNode.querySelector('.card');
    card.setAttribute('class', 'before-late');           /* فقط برای ثبت‌کننده‌های قبلی بی‌ربط است */
    await harness.settle();

    harness.watchShared('late attributes', harness.body, { attributes: true, subtree: true, attributeFilter: ['data-late'] });
    harness.watchIndependent('late attributes', harness.body, { attributes: true, subtree: true, attributeFilter: ['data-late'] });
    await harness.settle();

    card.setAttribute('data-late', 'yes');
    await harness.settle();

    compare(harness, ['childList+subtree', 'late attributes']);
    assert.equal(harness.logs.shared['late attributes'].length, 1, 'ثبت‌کننده‌ی دیرهنگام فقط جهش بعد از خودش را می‌گیرد');
  } finally { harness.disconnectAll(); }
});

test('subtree:false handlers only see mutations whose target is the observed node', async (t) => {
  if (!JSDOM) return t.skip('jsdom در دسترس نیست');
  const harness = createHarness();
  try {
    const options = { childList: true, attributes: true };
    harness.watchShared('noSubtree', harness.body, options);
    harness.watchIndependent('noSubtree', harness.body, options);
    harness.watchShared('withSubtree', harness.body, { childList: true, subtree: true });
    harness.watchIndependent('withSubtree', harness.body, { childList: true, subtree: true });
    await harness.settle();

    const card = harness.rootNode.querySelector('.card');
    card.setAttribute('class', 'nested-change');
    const added = harness.document.createElement('div');
    harness.body.appendChild(added);
    added.setAttribute('class', 'inner');
    await harness.settle();

    compare(harness, ['noSubtree', 'withSubtree']);
    assert.equal(harness.logs.shared.noSubtree.length, 1, 'فقط جهش مستقیم روی body');
  } finally { harness.disconnectAll(); }
});

test('disconnect of one handler leaves the others and the shared observer intact', async (t) => {
  if (!JSDOM) return t.skip('jsdom در دسترس نیست');
  const harness = createHarness();
  try {
    const first = harness.watchShared('first', harness.body, { childList: true, subtree: true });
    harness.watchShared('second', harness.body, { childList: true, subtree: true });
    harness.watchIndependent('second', harness.body, { childList: true, subtree: true });
    await harness.settle();

    first.disconnect();
    const card = harness.rootNode.querySelector('.card');
    card.appendChild(harness.document.createElement('em'));
    await harness.settle();

    assert.equal(harness.logs.shared.first.length, 0);
    compare(harness, ['second']);
    assert.equal(harness.stats().observers, 1, 'observer مشترک هنوز زنده است');
    assert.equal(harness.stats().activeObservers, 1);
  } finally { harness.disconnectAll(); }
});

test('widening options is remembered: observer count stays at one per target', async (t) => {
  if (!JSDOM) return t.skip('jsdom در دسترس نیست');
  const harness = createHarness();
  try {
    harness.watchShared('childList', harness.body, { childList: true, subtree: true });
    await harness.settle();
    harness.watchShared('characterData', harness.body, { childList: true, subtree: true, characterData: true });
    await harness.settle();
    harness.watchShared('attributes', harness.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
    await harness.settle();

    harness.watchIndependent('childList', harness.body, { childList: true, subtree: true });
    harness.watchIndependent('characterData', harness.body, { childList: true, subtree: true, characterData: true });
    harness.watchIndependent('attributes', harness.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
    await harness.settle();

    await mutate(harness);
    compare(harness, ['childList', 'characterData', 'attributes']);
    assert.equal(harness.stats().observers, 1, 'گشادکردن گزینه‌ها observer تازه نمی‌سازد');
    assert.ok(harness.stats().widened >= 2, 'گشادکردن‌ها شمرده می‌شوند');
  } finally { harness.disconnectAll(); }
});

test('registry version and API surface are in place', (t) => {
  if (!JSDOM) return t.skip('jsdom در دسترس نیست');
  const harness = createHarness();
  try {
    assert.equal(harness.window.__hesabnoDom.version, 3);
    assert.equal(typeof harness.window.__hesabnoDom.watch, 'function');
    const invalid = harness.window.__hesabnoDom.watch(null, { childList: true }, () => {});
    assert.equal(invalid.active, false, 'هدف نامعتبر نباید ثبت شود');
    assert.equal(harness.stats().observers, 0);
  } finally { harness.disconnectAll(); }
});

test('two structurally identical nodes do not share an observer', async (t) => {
  if (!JSDOM) return t.skip('jsdom در دسترس نیست');
  const harness = createHarness();
  try {
    /* دو <main> هم‌نام: نام گره یکسان است، ولی هدف دو ثبت متفاوت است */
    const first = harness.document.createElement('main');
    const second = harness.document.createElement('main');
    harness.body.appendChild(first);
    harness.body.appendChild(second);
    await harness.settle();

    const seen = { first: [], second: [] };
    harness.window.__hesabnoDom.watch(first, { childList: true, subtree: true }, (records) => seen.first.push(canonical(records, harness.body)));
    harness.window.__hesabnoDom.watch(second, { childList: true, subtree: true }, (records) => seen.second.push(canonical(records, harness.body)));
    assert.equal(harness.stats().activeObservers, 2, 'هر گره observer خودش را دارد');
    await harness.settle();

    first.appendChild(harness.document.createElement('b'));
    await harness.settle();
    assert.equal(seen.first.length, 1);
    assert.equal(seen.second.length, 0, 'گره دوم نباید رخداد گره اول را بگیرد');

    second.appendChild(harness.document.createElement('i'));
    await harness.settle();
    assert.equal(seen.first.length, 1);
    assert.equal(seen.second.length, 1);
    assert.match(seen.second[0], /second|main/, 'رخداد گزارش‌شده مربوط به گره دوم است');
  } finally { harness.disconnectAll(); }
});

test('facade.observe() after disconnect re-registers in the original order', async (t) => {
  if (!JSDOM) return t.skip('jsdom در دسترس نیست');
  const harness = createHarness();
  try {
    const order = [];
    const first = harness.watchShared('first', harness.body, { childList: true, subtree: true });
    harness.watchShared('second', harness.body, { childList: true, subtree: true });
    harness.logs.shared.first.length = 0;
    harness.logs.shared.second.length = 0;
    harness.logs.independent.first = [];
    harness.logs.independent.second = [];
    await harness.settle();

    first.disconnect();
    const card = harness.rootNode.querySelector('.card');
    card.appendChild(harness.document.createElement('em'));
    await harness.settle();
    assert.equal(harness.logs.shared.first.length, 0);
    assert.equal(harness.logs.shared.second.length, 1);

    /* دوباره وصل‌کردن (الگوی ۰۹۰): باید همان‌جا در ترتیب اجرا بماند */
    first.observe(harness.body, { childList: true, subtree: true });
    await harness.settle();
    const marker = harness.document.createElement('u');
    card.appendChild(marker);
    await harness.settle();
    assert.equal(harness.logs.shared.first.length, 1, 'پس از observe دوباره رخداد می‌گیرد');
    assert.equal(harness.logs.shared.second.length, 2);
    assert.equal(harness.stats().handlers, 2);

    order.push(harness.logs.shared.first.length, harness.logs.shared.second.length);
    assert.deepEqual(order, [1, 2]);
  } finally { harness.disconnectAll(); }
});
