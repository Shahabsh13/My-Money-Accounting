/*
 * آزمون پایداری چیدمان هنگام جابه‌جایی بین تب‌ها.
 *
 * باگ گزارش‌شده: «موقع جابه‌جایی بین تب‌ها دکمه‌ها جابه‌جا می‌شوند؛ تاریخ بالای
 * داشبورد، تاریخ لیست تراکنش‌ها، و دکمه‌های داخل کشویی».
 *
 * ریشه: چند لایه‌ی «بهبوددهنده» متن/استایل را *بعد از* اولین نقاشی عوض می‌کردند و
 * مقایسه‌ی «آیا قبلاً همین مقدار را گذاشته‌ام؟» هم به‌خاطر نرمال‌سازی CSS هرگز
 * برابر نمی‌شد (‎#f2d18a‎ در برابر ‎rgb(242, 209, 138)‎)، پس همان نوشتن هر ۱۵۰ms
 * تکرار می‌شد. این آزمون سه قرارداد را قفل می‌کند:
 *   ۱) متن/استایل تاریخ داشبورد بعد از ظاهر شدن تغییر نکند.
 *   ۲) بعد از استقرار داشبورد، نوشتن استایل روی آن تقریباً صفر باشد (قبلاً ۵۷۶ نوشتن).
 *   ۳) کلاس انیمیشن دیالوگ روی خودِ دیالوگ بیفتد نه روی کارت داخلی.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { bootApp, closeApp, wait, normalize } = require('./helpers/app-boot.cjs');

let hasJsdom = true;
try {
  require('jsdom');
} catch (error) {
  hasJsdom = false;
}

function clickRendered(window, element) {
  if (!element) return;
  const propsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'));
  const handler = propsKey && element[propsKey].onClick;
  if (handler) handler({ target: element, currentTarget: element, preventDefault() {}, stopPropagation() {} });
  else element.click();
}

/* یک تراکنش امروز، تا مسیر واقعیِ لیست/متادیتا/ارقام هم اجرا شود (بدون داده، بخشی از
   لایه‌های بازنویسی اصلاً فعال نمی‌شوند و آزمون سبک‌تر از واقعیت می‌شود). */
const persianToday = (() => {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => (parts.find((part) => part.type === type) || {}).value;
  return `${get('year')}/${get('month')}/${get('day')}`;
})();

const seedTransactions = [
  { id: 1, type: 'expense', amount: 1000, date: persianToday, title: 'آزمون پایداری', account: 'بانک ملت', documentNumber: 1 },
  { id: 2, type: 'income', amount: 2500, date: persianToday, title: 'آزمون درآمد', account: 'بانک ملت', documentNumber: 2 },
];

const DATE_BUTTON = 'button[title="مشاهده تقویم و تاریخ امروز"]';
const WEEKDAY = /شنبه|یکشنبه|دوشنبه|سه‌شنبه|چهارشنبه|پنج‌شنبه|جمعه/;

/* jsdom چیدمان و ResizeObserver ندارد؛ تب تراکنش‌ها بدون این دو کرش می‌کند. */
const jsdomStubs = (window) => {
  window.ResizeObserver = class {
    constructor(callback) { this.callback = callback; }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.Element.prototype.getBoundingClientRect = function () {
    return { width: 300, height: 120, top: 0, left: 0, right: 300, bottom: 120, x: 0, y: 0 };
  };
};

const navButton = (document, text) =>
  [...document.querySelectorAll('nav.fixed button')].find((button) => normalize(button.textContent).includes(text));

function dateSpan(button) {
  /* از task-12 ظاهر در CSS است: دیگر هیچ span ای style درون‌خطی ندارد، پس با
     کلاس معنایی پیدا می‌شود و باید همان گره‌ی دارای روز هفته باشد. */
  const tagged = button.querySelector('.hesabno-dashboard-date-value');
  if (tagged) return tagged;
  const spans = [...button.querySelectorAll('span')];
  return spans.find((span) => WEEKDAY.test(normalize(span.textContent))) || spans[spans.length - 1];
}

async function goToTab(document, label, settle = 900) {
  const button = navButton(document, label);
  assert.ok(button, `تب «${label}» باید وجود داشته باشد`);
  button.click();
  await wait(settle);
}

async function waitForDateButton(document, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const button = document.querySelector(DATE_BUTTON);
    if (button) return button;
    await wait(50);
  }
  return null;
}

test('a body mutation does not re-style or re-text the dashboard date', { timeout: 90000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({ seed: seedTransactions, stubs: jsdomStubs });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;

  const button = await waitForDateButton(document);
  assert.ok(button, 'دکمه‌ی تاریخ باید رندر شود');
  await wait(1200); // استقرار کامل صفحه و لایه‌ها

  const span = dateSpan(button);
  const before = { text: normalize(span.textContent), style: span.getAttribute('style') };
  assert.match(before.text, WEEKDAY, 'تاریخ باید روز هفته را داشته باشد');
  assert.equal(span.getAttribute('style'), null, 'تاریخ نباید style درون‌خطی داشته باشد (ظاهر فقط در CSS)');

  /* هر تغییر تب در نهایت یک جهش childList روی body است. شبیه‌سازی همان:
     یک گره‌ی بی‌اثر اضافه و حذف می‌کنیم و می‌بینیم آیا لایه‌های بازنویسی بیدار می‌شوند. */
  let styleWrites = 0;
  let textWrites = 0;
  const observer = new window.MutationObserver((records) => {
    for (const record of records) {
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (!target || !target.closest || !target.closest(DATE_BUTTON)) continue;
      if (record.type === 'attributes' && record.attributeName === 'style') styleWrites += 1;
      if (record.type === 'characterData' || record.type === 'childList') textWrites += 1;
    }
  });
  observer.observe(document.getElementById('root'), {
    attributes: true, attributeOldValue: true, subtree: true, characterData: true, childList: true,
  });

  const noise = document.createElement('div');
  noise.setAttribute('data-test-noise', '1');
  document.body.appendChild(noise);
  await wait(50);
  noise.remove();
  await wait(700);
  observer.disconnect();

  assert.equal(styleWrites, 0, `جهش body نباید استایل تاریخ داشبورد را بازنویسی کند (${styleWrites} نوشتن)`);
  assert.equal(textWrites, 0, `جهش body نباید متن تاریخ داشبورد را بازنویسی کند (${textWrites} نوشتن)`);
  assert.equal(normalize(dateSpan(button).textContent), before.text, 'متن تاریخ نباید عوض شود');
  assert.equal(dateSpan(button).getAttribute('style'), before.style, 'استایل تاریخ نباید عوض شود');
});

test('no dashboard element is restyled more than a handful of times after a tab round-trip', { timeout: 90000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({ seed: seedTransactions, stubs: jsdomStubs });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document, performance } = window;

  await goToTab(document, 'تراکنش');
  await goToTab(document, 'خانه', 100);

  const perElement = new Map();
  let total = 0;
  const observer = new window.MutationObserver((records) => {
    for (const record of records) {
      if (record.type !== 'attributes' || record.attributeName !== 'style') continue;
      total += 1;
      perElement.set(record.target, (perElement.get(record.target) || 0) + 1);
    }
  });
  const root = document.getElementById('root');
  observer.observe(root, { attributes: true, subtree: true });
  const started = performance.now();
  await wait(2600);
  observer.disconnect();
  const elapsed = performance.now() - started;

  const worst = [...perElement.entries()].sort((a, b) => b[1] - a[1])[0];
  const worstCount = worst ? worst[1] : 0;
  assert.ok(
    worstCount <= 8,
    `هیچ عنصری در داشبورد نباید بیش از چند بار استایل بگیرد؛ بدترین عنصر ${worstCount} نوشتن داشت ` +
      `(کل ${total} نوشتن در ${Math.round(elapsed)}ms؛ قبل از اصلاح یک عنصر تنها ۲۵ نوشتن و کل صفحه ۵۷۶ نوشتن داشت)`,
  );
});

test('dialog motion class lands on the dialog itself, not on an inner card', { timeout: 90000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({ seed: seedTransactions, stubs: jsdomStubs });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;

  // jsdom چیدمان ندارد؛ اندازه‌ی تقریبی می‌دهیم تا مسیر «انتخاب دیالوگ» شبیه مرورگر شود.
  window.Element.prototype.getBoundingClientRect = function () {
    const sheet = this.id === 'persian-datepicker-sheet';
    return { width: sheet ? 360 : 300, height: sheet ? 520 : 120, top: 0, left: 0, right: 300, bottom: 120, x: 0, y: 0 };
  };

  const payButton = [...document.querySelectorAll('button')].find((button) => normalize(button.textContent) === 'پرداخت');
  assert.ok(payButton, 'دکمه‌ی پرداخت باید باشد');
  clickRendered(window, payButton);
  await wait(600);

  const field = document.querySelector('#tx-date-input-container');
  assert.ok(field, 'فیلد تاریخ باید باشد');
  clickRendered(window, field);
  await wait(300);

  const sheet = document.querySelector('#persian-datepicker-sheet');
  assert.ok(sheet, 'شیت تقویم باید باز شود');
  assert.equal(sheet.getAttribute('role'), 'dialog');

  const animatedInner = [...sheet.querySelectorAll('.hesabno-dialog-motion')].filter((node) => node !== sheet);
  assert.deepEqual(animatedInner, [], 'هیچ عنصر داخلی نباید کلاس انیمیشن دیالوگ بگیرد (وگرنه داخل شیت جابه‌جا می‌شود)');

  const overlay = document.querySelector('#persian-datepicker-backdrop');
  assert.ok(overlay, 'لایه‌ی تقویم باید باشد');
  assert.equal(overlay.firstElementChild, sheet, 'شیت باید فرزند مستقیم لایه باشد');
});

test('bank logo decoration lands by the next task, not the next animation frame', { timeout: 90000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({ seed: seedTransactions, stubs: jsdomStubs });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;

  // خارج از #root می‌سازیم تا با reconcile ری‌اکت تداخل نکند. عمق را ۳ لایه می‌کنیم تا
  // بررسی «لوگوی موجود در سه والد» به body نرسد (در body لوگوی بانک دیگری هست).
  const host = document.createElement('div');
  document.body.appendChild(host);
  const section = document.createElement('section');
  host.appendChild(section);
  const row = document.createElement('div');
  section.appendChild(row);
  const name = document.createElement('span');
  name.textContent = 'بانک ملت';
  row.appendChild(name);

  await new Promise((resolve) => window.setTimeout(resolve, 0));
  const mark = name.querySelector('.hesabno-bank-mark');
  assert.ok(mark, 'لوگوی بانک باید تا تسک بعدی (و پیش از نقاشی) تزریق شده باشد، نه فریم بعد');
  assert.ok(name.firstElementChild, 'لوگو باید اولین فرزند نام بانک باشد');

  host.remove();
});

/* ---- جاروب بخش‌ها: هر بخش باید بعد از «آرامش» کاملاً ثابت بماند ---- */
/*
 * معیار «جهش چیدمان»: نوشتن inline style، تغییر متن، و افزودن/حذف گره.
 * تغییر کلاس/aria/data فقط وقتی مهم است که با style یا گره همراه باشد؛ کلاس‌های
 * انیمیشن (مثل hesabno-tab-motion) چیدمان را جابه‌جا نمی‌کنند و شمردنشان آزمون را
 * نسبت به نویز حساس و بی‌دلیل شکننده می‌کند.
 */
function countLayoutMutations(window, root) {
  const state = { layout: 0, style: 0, text: 0, nodes: 0, records: 0, noop: 0 };
  const observer = new window.MutationObserver((records) => {
    for (const record of records) {
      state.records += 1;
      if (record.type === 'attributes') {
        /*
         * نوشتنِ همان مقدارِ قبلی (aria-label، role، tabindex، class) هیچ اثری روی
         * چیدمان ندارد. تب «بیشتر» تا پیش از این اصلاح، همین را ۵۰ بار در ثانیه
         * تکرار می‌کرد و آزمونِ «آرامش» را با نویزِ بی‌اثر می‌شکست.
         */
        if (record.attributeName === 'style') {
          /* هر نوشتنِ style — حتی با مقدار یکسان — بازمحاسبهٔ استایل است و باید صفر بماند. */
          state.style += 1;
          state.layout += 1;
          continue;
        }
        const value = record.target.getAttribute(record.attributeName);
        if (record.oldValue === value) { state.noop += 1; continue; }
      } else if (record.type === 'characterData') {
        state.text += 1;
        state.layout += 1;
      } else if (record.type === 'childList') {
        /*
         * جایگزینی یک متن با متنِ کاملاً یکسان (کاری که ری‌اکت هنگام رندر دوباره می‌کند)
         * هیچ اثری روی چیدمان ندارد؛ شمردنش آزمون را به نویزِ عملکردی حساس می‌کند.
         * جهش واقعی = گره‌ی عنصری، یا متنی که عوض شده است.
         */
        const added = [...record.addedNodes];
        const removed = [...record.removedNodes];
        const elements = added.some((n) => n.nodeType === 1) || removed.some((n) => n.nodeType === 1);
        const sameText = !elements &&
          added.map((n) => n.textContent).join('') === removed.map((n) => n.textContent).join('');
        if (sameText) continue;
        state.nodes += 1;
        state.layout += 1;
      }
    }
  });
  observer.observe(root, { attributes: true, childList: true, characterData: true, subtree: true, attributeOldValue: true });
  return { state, stop: () => observer.disconnect() };
}

/*
 * «آرامش» = هم ۴۰۰ms سکوت، هم گذشتن ۲ ثانیه از کلیک. شرط دوم لازم است چون چند لایه
 * (تزئین لوگو، تایمرهای قبلی) عمداً با تأخیر اجرا می‌شدند و بین دو موج، فاصله‌ی
 * کوتاهِ بی‌رخداد دیده می‌شود؛ آرامش واقعی از ~۱.۲ ثانیه شروع می‌شود.
 */
async function waitForQuiet(window, root, quietMs = 400, minMs = 2000, maxMs = 6000) {
  const started = Date.now();
  let last = -1;
  let quietSince = Date.now();
  while (Date.now() - started < maxMs) {
    const probe = countLayoutMutations(window, root);
    await wait(80);
    probe.stop();
    /* فقط تغییرِ مؤثر (استایل/متن/گره) معیار آرامش است، نه بازنویسیِ مقدار یکسان. */
    const meaningful = probe.state.records - probe.state.noop;
    if (meaningful !== last) { last = meaningful; quietSince = Date.now(); }
    else if (Date.now() - quietSince >= quietMs && Date.now() - started >= minMs) return true;
  }
  return false;
}

test('every main tab stays still after it has settled', { timeout: 120000 }, async (t) => {
  if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
  const dom = await bootApp({ seed: seedTransactions, stubs: jsdomStubs });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;
  const root = document.getElementById('root');

  const report = [];
  for (const tab of ['خانه', 'تراکنش', 'گزارش', 'بیشتر']) {
    const button = [...document.querySelectorAll('nav.fixed button')].find((node) => normalize(node.textContent).includes(tab));
    assert.ok(button, `تب «${tab}» باید وجود داشته باشد`);
    button.click();
    const quiet = await waitForQuiet(window, root);
    assert.ok(quiet, `تب «${tab}» باید در کمتر از ۵ ثانیه آرام شود (قبلاً بازنویسی‌ها ادامه داشت)`);

    const probe = countLayoutMutations(window, root);
    await wait(900);
    probe.stop();
    report.push({ tab, layout: probe.state.layout, style: probe.state.style, text: probe.state.text, nodes: probe.state.nodes });
  }

  const noisy = report.filter((row) => row.style > 0 || row.layout > 20);
  assert.deepEqual(noisy, [], `این تب‌ها بعد از آرام‌شدن هنوز بازنویسی می‌کنند: ${JSON.stringify(noisy)}`);
});

/* ---- پنل‌های کشویی داشبورد (چک‌ها / پیام‌بانک) ---- */
/*
 * هر پنل در یک بوت تازه باز می‌شود. علتش این است که بستن پنل اول در jsdom (که
 * ترنزیشن/چیدمان ندارد) همیشه به پایان نمی‌رسد و آزمون به‌جای سنجش پایداری،
 * درباره‌ی «پنل دوم باز شد یا نه» شکست می‌خورد.
 */
for (const [label, selector, expected] of [
  ['چک‌ها', '.hesabno-fixed-check-card', 'مدیریت چک‌ها'],
  ['پیام‌بانک', '.hesabno-fixed-sms-card', 'پیام‌بانک'],
]) {
  test(`dashboard side panel «${label}» does not keep rewriting itself after opening`, { timeout: 120000 }, async (t) => {
    if (!hasJsdom) return t.skip('jsdom در دسترس نیست');
    const dom = await bootApp({
      seed: seedTransactions,
      stubs: jsdomStubs,
      storage: { 'hesabno:first_run_intro_done': '1' },
    });
    t.after(() => closeApp(dom));
    const { window } = dom;
    const { document } = window;
    const root = document.getElementById('root');

    const card = document.querySelector(selector);
    assert.ok(card, `کارت «${label}» باید در داشبورد باشد`);

    card.click();
    const quiet = await waitForQuiet(window, root);
    assert.ok(quiet, `پنل «${label}» باید در کمتر از ۶ ثانیه آرام شود`);

    /* نیم‌فاصله در متن رندرشده ممکن است حذف/جابه‌جا شود؛ برای تشخیص پنل نادیده گرفته می‌شود. */
    const loose = (value) => String(value || '').replace(/\u200c/g, '');
    const panel = [...document.querySelectorAll('[role="dialog"]')].find((node) => loose(normalize(node.textContent)).includes(loose(expected)));
    assert.ok(panel, `پنل «${label}» باید باز شده باشد`);

    const probe = countLayoutMutations(window, root);
    await wait(900);
    probe.stop();
    assert.ok(
      probe.state.layout <= 3,
      `دکمه‌های داخل پنل «${label}» نباید بعد از باز شدن جابه‌جا شوند؛ ${probe.state.layout} جهش چیدمان ` +
        `(style=${probe.state.style}, text=${probe.state.text}, nodes=${probe.state.nodes})`,
    );
  });
}
