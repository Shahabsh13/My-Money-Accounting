const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { bootApp, closeApp, wait } = require('./helpers/app-boot.cjs');

function extractBackScript() {
  const java = fs.readFileSync('app/src/main/java/com/maymoney/app/MainActivity.java', 'utf8');
  const start = java.indexOf('private static final String BACK_JS =');
  const end = java.indexOf('\n\n    private WebView', start);
  assert.ok(start >= 0 && end > start, 'کد JavaScript دکمهٔ Back بومی باید وجود داشته باشد');
  return [...java.slice(start, end).matchAll(/"(?:\\.|[^"\\])*"/g)]
    .map((match) => JSON.parse(match[0]))
    .join('');
}

async function openApp(t) {
  const dom = await bootApp({
    storage: {
      'hesabno:first_run_intro_done': '1',
      'hesabno:first_run_profile_done': '1',
    },
    stubs(window) {
      window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    },
  });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;
  // jsdom has no layout engine; treat non-hidden controls as visible for the app's visibility guards.
  window.Element.prototype.getClientRects = function getClientRects() {
    return this.closest('.hidden') ? [] : [{}];
  };
  let backHandled = 0;
  let exitRequests = 0;
  window.HnBridge = {
    backHandled: () => { backHandled += 1; },
    exitApp: () => { exitRequests += 1; },
  };
  return {
    dom, window, document, backScript: extractBackScript(),
    backCount: () => backHandled,
    exitCount: () => exitRequests,
  };
}

async function clickButton(buttons, label) {
  const button = [...buttons].find((item) => (item.textContent || '').includes(label));
  assert.ok(button, `دکمهٔ «${label}» باید در صفحه پیدا شود`);
  button.click();
  await wait(140);
}

async function pressBack(app) {
  app.window.eval(app.backScript);
  await wait(140);
}

test('Android Back from every More entry returns one level without exiting', { timeout: 180000 }, async (t) => {
  const app = await openApp(t);
  const { document } = app;
  const sections = [
    { menu: 'سرفصل حساب‌ها', heading: 'سرفصل حساب‌ها' },
    { menu: 'چک‌ها و اسناد صیادی', heading: 'مدیریت چک‌ها' },
    { menu: 'وام و خریدهای اقساطی', heading: 'وام‌ها و تسهیلات', switchTab: 'خرید و اقساط' },
    { menu: 'بودجه‌بندی هوشمند', heading: 'بودجه‌بندی هوشمند', iconOnlyHeaderBack: true },
    { menu: 'پیامبانک', heading: 'پیامبانک هوشمند', switchTab: 'پردازش و تست پیامک' },
    { menu: 'دوره‌ای و میانبرهای سریع', heading: 'تراکنش‌های دوره‌ای', switchTab: 'میانبرهای سریع' },
    { menu: 'تنظیمات پایه', heading: 'تنظیمات پایه', titleOnlyBack: true },
    { menu: 'مدیریت دسترسی‌ها', overlay: true },
    { menu: 'سال مالی و دوره‌های مالی', heading: 'دوره‌های مالی' },
    { menu: 'فایل‌های خروجی و گزارش‌ها' },
    { menu: 'پشتیبان‌گیری و بازیابی داده‌ها', overlay: true },
  ];

  for (const [index, section] of sections.entries()) {
    await clickButton(document.querySelectorAll('nav.fixed button'), 'بیشتر');
    await clickButton(document.querySelectorAll('#root main button'), section.menu);
    if (section.heading) {
      assert.equal(document.querySelector('#root h1')?.textContent.trim(), section.heading,
        `گزینهٔ «${section.menu}» باید صفحهٔ مربوط را باز کند`);
    }
    if (section.iconOnlyHeaderBack) {
      assert.equal(document.querySelector('nav.fixed'), null,
        'صفحهٔ بودجه‌بندی نوار تب‌های اصلی را نمایش نمی‌دهد');
      assert.ok(document.querySelector('#root main header button[aria-label="بازگشت از صفحه بودجه‌بندی هوشمند"]'),
        'فلش آیکونی بودجه‌بندی برچسب دسترس‌پذیر توصیفی دارد');
    }
    if (section.titleOnlyBack) {
      assert.ok(document.querySelector('#base-settings-back-btn[title="بازگشت"]'),
        'تنظیمات پایه دکمهٔ بازگشتِ title-only دارد؛ کلیک مصنوعی نباید توسط wrapper خنثی شود');
    }
    if (section.overlay) {
      assert.ok([...document.querySelectorAll('.hesabno-fullpage-layer,[role="dialog"][aria-modal="true"]')]
        .some((layer) => layer.getClientRects().length),
      `بخش «${section.menu}» باید لایهٔ رویی قابل‌بستن داشته باشد`);
    }
    if (section.switchTab) {
      await clickButton(document.querySelectorAll('#root main button'), section.switchTab);
      assert.ok(document.querySelector('#root h1'),
        `تب داخلی «${section.switchTab}» باید در صفحهٔ همان بخش باقی بماند`);
    }

    await pressBack(app);
    assert.equal(app.backCount(), index + 1, `Back از «${section.menu}» باید به Native اعلام شود`);
    assert.equal(app.exitCount(), 0, `Back از «${section.menu}» نباید درخواست خروج کند`);
    assert.equal(document.querySelector('#root main h1')?.textContent.trim(), 'بیشتر و امکانات',
      `Back از «${section.menu}» باید دقیقاً به منوی «بیشتر» برگردد`);
    assert.ok(document.querySelector('nav.fixed'),
      'ناوبری اصلی پس از برگشت به منوی «بیشتر» باید حاضر باشد');
    assert.equal(document.querySelectorAll('.hesabno-fullpage-layer,[role="dialog"][aria-modal="true"]')
      .length, 0, `لایهٔ «${section.menu}» باید بسته شده باشد`);
  }

  // این بخش یک صفحهٔ مستقل بیرون از React root دارد و در خودش دو تب و یک فرم modal دارد.
  await clickButton(document.querySelectorAll('nav.fixed button'), 'بیشتر');
  await clickButton(document.querySelectorAll('#root main button'), 'پروژه‌ها و اعضای خانواده');
  const projectPage = document.getElementById('hesabno-project-family-page');
  assert.ok(projectPage, 'مدیریت پروژه/خانواده بیرون از #root باز می‌شود');
  await clickButton(projectPage.querySelectorAll('button'), 'اعضای خانواده');
  await clickButton(projectPage.querySelectorAll('button'), 'افزودن عضو خانواده');
  assert.ok(projectPage.querySelector('[role="dialog"][aria-modal="true"]'), 'فرم افزودن باید modal باشد');

  await pressBack(app);
  assert.equal(app.backCount(), sections.length + 1, 'Back اول فقط modal را می‌بندد');
  assert.ok(document.getElementById('hesabno-project-family-page'), 'صفحهٔ پروژه/خانواده پس از بستن modal باز می‌ماند');
  assert.equal(projectPage.querySelector('[role="dialog"][aria-modal="true"]'), null, 'modal بسته می‌شود');
  assert.equal(projectPage.querySelector('.hpf-tab[data-active="true"]')?.textContent.trim(), 'اعضای خانواده',
    'بستن modal نباید تب قبلی پروژه/خانواده را عوض کند');
  assert.equal(document.querySelector('#root main h1')?.textContent.trim(), 'بیشتر و امکانات');
  assert.equal(app.exitCount(), 0);

  await pressBack(app);
  assert.equal(app.backCount(), sections.length + 2, 'Back بعدی صفحهٔ پروژه/خانواده را می‌بندد');
  assert.equal(document.getElementById('hesabno-project-family-page'), null);
  assert.equal(document.querySelector('#root main h1')?.textContent.trim(), 'بیشتر و امکانات');
  assert.equal(app.exitCount(), 0);
});

test('Back from the other primary tabs returns to the dashboard without prompting exit', { timeout: 60000 }, async (t) => {
  const app = await openApp(t);
  const { document } = app;
  for (const [index, tab] of ['تراکنش‌ها', 'گزارش‌ها'].entries()) {
    await clickButton(document.querySelectorAll('nav.fixed button'), tab);
    assert.equal(document.querySelector('#root h1')?.textContent.trim(),
      tab === 'تراکنش‌ها' ? 'دفتر تراکنش‌ها و اسناد' : 'گزارش‌ها',
      `تب «${tab}» باید فعال شده باشد`);
    await pressBack(app);
    const active = [...document.querySelectorAll('nav.fixed button')]
      .find((button) => String(button.className).includes('text-emerald-400'));
    assert.equal(active?.textContent.trim(), 'خانه', `Back از «${tab}» باید به داشبورد برگردد`);
    assert.equal(app.backCount(), index + 1);
    assert.equal(app.exitCount(), 0, `Back از «${tab}» نباید پیغام خروج نشان دهد`);
  }
});

test('Back on the idle dashboard opens the exit prompt; the next Back only dismisses it', { timeout: 60000 }, async (t) => {
  const app = await openApp(t);
  const { document } = app;
  assert.equal(document.querySelector('nav.fixed button.text-emerald-400')?.textContent.trim(), 'خانه',
    'آزمون باید از داشبورد شروع شود');
  assert.equal(document.querySelector('[data-hn-exit-dialog]'), null, 'پیش از Back نباید دیالوگ خروجی باز باشد');

  await pressBack(app);
  assert.ok(document.querySelector('[data-hn-exit-dialog]'), 'Back روی داشبورد باید پیغام خروج را باز کند');
  assert.equal(app.exitCount(), 0, 'نمایش پیغام خروج به‌تنهایی نباید برنامه را ببندد');

  await pressBack(app);
  assert.equal(document.querySelector('[data-hn-exit-dialog]'), null, 'Back بعدی فقط پیغام را می‌بندد');
  assert.equal(app.exitCount(), 0, 'بستن پیغام با Back نباید خروج را تأیید کند');
});

test('native Back fallback searches the app root and recognizes descriptive Persian Back labels', () => {
  const java = fs.readFileSync('app/src/main/java/com/maymoney/app/MainActivity.java', 'utf8');
  assert.ok(java.includes("var b=findBackButton(document.querySelector('#root')||document);"),
    'جستجوی دکمهٔ بازگشت نباید فقط به main محدود شود');
  assert.ok(java.includes("label.indexOf('بازگشت')===0||label.indexOf('برگشت')===0"),
    'عنوان‌هایی مثل «بازگشت به منوی بیشتر» نیز باید دکمهٔ بازگشت شناخته شوند');
});
