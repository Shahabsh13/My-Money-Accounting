const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readScript = (name) => fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts', name), 'utf8');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (error) { JSDOM = null; }

test('گزارش ساده در هر دور decorate تراکنش‌ها را فقط یک‌بار می‌خواند و fallback را حفظ می‌کند', { skip: !JSDOM }, () => {
  const html = `<!doctype html><body>
    <section class="hesabno-report-transaction-card"><h2>تراکنش‌های حقوق</h2>
      <div class="hesabno-report-transaction-row"><span class="hesabno-simple-report-bank" title="بانک ملت">بانک ملت</span><span class="hesabno-simple-report-amount">۱۲۳</span></div>
      <div class="hesabno-report-transaction-row"><span class="hesabno-simple-report-bank" title="بانک ملت">بانک ملت</span><span class="hesabno-simple-report-amount">۱۲۳</span></div>
    </section></body>`;
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://app.test/' });
  try {
    const { window } = dom;
    let transactionReads = 0;
    let accountReads = 0;
    const transactionData = [{ amount: '123', account: 'بانک ملت', title: 'حقوق', description: 'حقوق ماهانه' }];
    window.__HESABNO_OFFICIAL_BANK_LOGOS = {};
    window.__HESABNO_DEFAULT_ACCOUNTS = [];
    window.__safeGet = (key) => {
      if (key === 'hesabno:transactions') { transactionReads += 1; return JSON.stringify(transactionData); }
      if (key === 'hesabno:accounts_v5') { accountReads += 1; return '[]'; }
      return null;
    };
    window.__hesabnoDom = { watch() { return { disconnect() {} }; } };
    window.eval(readScript('139-hesabno-report-bank-logo-and-description.js'));
    assert.equal(transactionReads, 1, 'دور اولیهٔ decorate باید فقط یک‌بار JSON تراکنش‌ها را بخواند');
    assert.equal(accountReads, 1, 'حساب‌ها نیز باید در همان دور فقط یک‌بار خوانده شوند');
    assert.deepEqual([...window.document.querySelectorAll('.hesabno-simple-report-description')].map((node) => node.textContent), ['حقوق ماهانه', 'حقوق ماهانه']);
    window.__hesabnoDecorateSimpleReportRows();
    assert.equal(transactionReads, 1, 'وقتی توضیح‌های fallback حاضرند، اجرای دوباره نباید بی‌دلیل تراکنش‌ها را بخواند');
    assert.equal(accountReads, 2, 'حساب‌ها یک‌بار در هر دور تازه خوانده می‌شوند');
    assert.equal(window.document.querySelectorAll('.hesabno-simple-report-description').length, 2, 'اجرای دوباره نباید توضیح تکراری بسازد');
  } finally {
    dom.window.close();
  }
});

test('تب‌های خرید و اقساط رفتار پرداخت/تسویه را حفظ می‌کنند و sync تکراری بازنویسی DOM ندارد', { skip: !JSDOM }, async () => {
  const dom = new JSDOM(`<!doctype html><body><main>
    <h1>خرید و اقساط</h1>
    <div><button>لیست خریدها و صندوق‌ها</button><button>زمان‌بندی اقساط خرید</button></div>
    <div><button>همه موارد (۲)</button><button>تسویه شده (۱)</button></div>
    <div class="rounded-3xl p-4"><h3>خرید تسویه‌شده</h3><span>تاریخ ثبت: ۱۴۰۵/۰۱/۰۱</span><span>تسویه شده</span></div>
    <div class="rounded-3xl p-4"><h3>خرید فعال</h3><span>تاریخ ثبت: ۱۴۰۵/۰۱/۰۲</span><span>در حال پرداخت</span></div>
  </main></body>`, { runScripts: 'outside-only', url: 'https://app.test/' });
  try {
    const { window } = dom;
    const document = window.document;
    let schedule;
    let classOrStyleMutations = 0;
    const mutations = new window.MutationObserver((records) => {
      classOrStyleMutations += records.filter((record) => record.type === 'attributes' && ['class', 'style'].includes(record.attributeName)).length;
    });
    mutations.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
    window.__hesabnoDom = { watch(target, options, callback) { schedule = callback; return { disconnect() {} }; } };
    window.eval(readScript('195-hesabno-loan-purchase-status-tabs.js'));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const cards = [...document.querySelectorAll('main div.rounded-3xl.p-4')];
    assert.equal(cards.length, 2);
    assert.equal(cards[0].style.display, 'none', 'نمای فعال خرید تسویه‌شده را پنهان می‌کند');
    assert.equal(cards[1].style.display, '', 'نمای فعال خرید در حال پرداخت را نشان می‌دهد');
    classOrStyleMutations = 0;
    schedule([]);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(classOrStyleMutations, 0, 'sync بدون تغییر نباید class/style را دوباره بنویسد');
    const completedTab = document.querySelector('[data-hesabno-purchase-status="completed"]');
    completedTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(cards[0].style.display, '', 'تب تسویه‌شده باید خرید تسویه‌شده را نشان دهد');
    assert.equal(cards[1].style.display, '', 'تب تسویه‌شده همهٔ خریدها را نشان می‌دهد');
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    mutations.disconnect();
  } finally {
    dom.window.close();
  }
});

test('ورود به زمان‌بندی اقساط باعث حلقهٔ MutationObserver نمی‌شود', { skip: !JSDOM }, async () => {
  const dom = new JSDOM(`<!doctype html><body><main>
    <h1>وام‌ها و تسهیلات</h1>
    <div class="border-b"><div>
      <button>لیست وام‌ها (۱)</button><button class="text-white">زمان‌بندی اقساط وام (۳)</button>
    </div></div>
    <div><button>همه وام‌ها (۱)</button><button class="bg-sky-500/20">در حال بازپرداخت (۱)</button><button>تسویه شده (۰)</button></div>
  </main></body>`, { runScripts: 'outside-only', url: 'https://app.test/' });
  try {
    const { window } = dom;
    const main = window.document.querySelector('main');
    let observerHandler;
    let mutationCount = 0;
    const observer = new window.MutationObserver((records) => { mutationCount += records.length; });
    observer.observe(main, { attributes: true, childList: true, characterData: true, subtree: true });
    window.__hesabnoDom = { watch(target, options, callback) { observerHandler = callback; return { disconnect() {} }; } };
    window.eval(readScript('195-hesabno-loan-purchase-status-tabs.js'));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.ok(main.querySelector('[data-hesabno-schedule-back]'), 'در تب زمان‌بندی دکمهٔ بازگشت باید ساخته شود');
    mutationCount = 0;
    observerHandler([]);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(mutationCount, 0, 'sync تکراری نباید متن/کلاس/ویژگی دکمهٔ بازگشت را بی‌وقفه بازنویسی کند');
    observer.disconnect();
  } finally {
    dom.window.close();
  }
});

test('فیلتر چک‌های لغوشدهٔ داشبورد تراکنش‌ها را برای هر ردیف دوباره از storage نمی‌خواند', { skip: !JSDOM }, () => {
  const dom = new JSDOM(`<!doctype html><body><main><section>
    <h2>هزینه‌های امروز</h2>
    <div class="bg-stone-900/60 divide-y">
      <div class="row"><p class="font-bold">چک برگشتی</p></div>
      <div class="row"><p class="font-bold">خرید روزانه</p></div>
      <div class="row"><p class="font-bold">هزینهٔ دیگر</p></div>
    </div>
  </section></main></body>`, { runScripts: 'outside-only', url: 'https://app.test/' });
  try {
    const { window } = dom;
    let transactionReads = 0;
    window.__safeGet = (key) => {
      if (key !== 'hesabno:transactions') return null;
      transactionReads += 1;
      return JSON.stringify([{ id: '7', title: 'چک برگشتی', type: 'expense', check: { status: 'bounced' } }]);
    };
    window.__hesabnoDom = { watch() { return { disconnect() {} }; } };
    window.eval(readScript('208-hesabno-home-canceled-check-filter.js'));
    assert.equal(transactionReads, 1, 'هر sync باید دادهٔ تراکنش را فقط یک‌بار parse کند');
    const rows = [...window.document.querySelectorAll('.row')];
    assert.equal(rows[0].getAttribute('aria-hidden'), 'true', 'چک برگشتیِ بدون شمارهٔ نمایان باید با عنوان پیدا و پنهان شود');
    assert.equal(rows[1].hasAttribute('aria-hidden'), false, 'تراکنش عادی باید باقی بماند');
    assert.equal(rows[2].hasAttribute('aria-hidden'), false, 'سایر ردیف‌ها باید باقی بمانند');
  } finally {
    dom.window.close();
  }
});

test('به‌روزرسانی تب‌های اقساط فقط style/class/attribute را هنگام تغییر می‌نویسد و کارت‌ها را محدودتر انتخاب می‌کند', () => {
  const script = readScript('195-hesabno-loan-purchase-status-tabs.js');
  assert.match(script, /querySelectorAll\("div\.rounded-3xl\.p-4"\)/, 'کارت‌ها نباید با پیمایش همهٔ divهای main پیدا شوند');
  assert.match(script, /card\.style\.display !== display\) card\.style\.display = display/);
  assert.match(script, /button\.style\.getPropertyValue\("--hesabno-status-tab-height"\) !== value/);
  assert.match(script, /bar\.className !== purchaseBarClass/);
  assert.match(script, /activeTab\.className !== activeClass/);
  assert.match(script, /completedTab\.className !== completedClass/);
  assert.match(script, /backButton\.className !== backButtonClass/);
  assert.match(script, /backButton\.textContent !== backButtonText/);
});

test('ناظر پاک‌سازی فرم‌ها دیگر با هر تغییر class/style از اسکریپت‌های دیگر صفحه را دوباره اسکن نمی‌کند', () => {
  const script = readScript('193-hesabno-loan-installment-form-cleanup.js');
  assert.match(script, /watch\(document\.body, \{ childList: true, characterData: true, subtree: true \}, schedule\)/);
  assert.doesNotMatch(script, /attributeFilter:\s*\["class", "style", "hidden"\]/);
});
