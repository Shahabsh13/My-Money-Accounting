const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(
  path.join(root, 'app/src/main/assets/src/scripts/142-hesabno-check-settlement-date.js'),
  'utf8',
);
const wait = (ms = 25) => new Promise((resolve) => setTimeout(resolve, ms));

test('check settlement calendar commits only on confirmation and cancels with X', { timeout: 30000 }, async () => {
  const dom = new JSDOM('<!doctype html><html><body><div class="fixed inset-0" role="dialog"><div><p>تایید وصول چک به حساب</p><button>تایید و کسر از حساب</button></div></div></body></html>', {
    url: 'https://app.test/',
    runScripts: 'outside-only',
  });
  try {
    const { window } = dom;
    const { document } = window;
    window.localStorage.setItem('hesabno:simpleReports_currentDateStr', '1405/08/03');
    window.eval(script);
    await wait();

    const input = document.querySelector('[data-hesabno-settlement-date-input]');
    const control = document.querySelector('[data-hesabno-settlement-date-control]');
    assert.ok(input && control, 'فیلد تاریخ وصول باید به فرم اضافه شود');
    const original = input.value;
    control.click();

    let backdrop = document.querySelector('[data-hesabno-settlement-datepicker]');
    assert.ok(backdrop, 'تقویم تسویه باید باز شود');
    assert.equal(backdrop.style.zIndex, '2147483000', 'لایهٔ تقویم باید روی دکمه‌های فرم باشد');
    assert.equal(backdrop.style.position, 'fixed', 'لایهٔ تقویم باید در تمام‌صفحه ثابت باشد');
    assert.equal(backdrop.style.top, '0px');
    assert.equal(backdrop.style.bottom, '0px');
    assert.equal(backdrop.style.display, 'flex');
    assert.equal(backdrop.style.alignItems, 'flex-end', 'تقویم باید در پایین صفحه قرار بگیرد حتی اگر کلاس‌های CSS بارگذاری نشوند');
    assert.equal(backdrop.style.justifyContent, 'center');
    assert.equal(backdrop.querySelector('#persian-datepicker-sheet').style.borderTopLeftRadius, '24px');
    assert.ok(backdrop.querySelector('[data-hesabno-settlement-close]'), 'ضربدر بستن باید وجود داشته باشد');
    const confirmButton = backdrop.querySelector('[data-hesabno-settlement-confirm]');
    assert.ok(confirmButton, 'دکمهٔ تأیید باید پایین تقویم باشد');
    const confirmFooter = confirmButton.parentElement;
    const sheet = backdrop.querySelector('#persian-datepicker-sheet');
    assert.equal(sheet.style.display, 'flex', 'شیت باید نوار تأیید را از ناحیهٔ روزها جدا کند');
    assert.equal(sheet.style.flexDirection, 'column');
    assert.equal(sheet.style.overflow, 'hidden');
    const calendarBody = sheet.querySelector('[data-hesabno-settlement-datepicker-body]');
    assert.equal(calendarBody.style.overflowY, 'auto', 'روزها باید مستقل از نوار تأیید اسکرول شوند');
    assert.equal(calendarBody.style.display, 'flex');
    assert.equal(calendarBody.style.flexDirection, 'column');
    assert.equal(calendarBody.style.paddingBottom, '0px', 'پایین‌ترین ردیف تاریخ باید به لبهٔ داخلی کادر برسد');
    assert.equal(calendarBody.children[0].style.flex, '0 0 auto', 'نام روزهای هفته هم باید پایین بیایند');
    assert.equal(calendarBody.children[0].style.marginTop, 'auto', 'فضای خالی باید بالای کل تقویم بماند');
    assert.equal(calendarBody.children[1].style.flex, '0 0 auto', 'ردیف‌های تاریخ نباید جمع شوند');
    assert.equal(confirmFooter.style.flex, '0 0 auto', 'ردیف تأیید نباید با کوچک‌شدن پنل جمع شود');
    assert.equal(confirmFooter.style.marginTop, 'auto', 'ردیف تأیید باید در انتهای شیت قرار بگیرد');
    assert.match(confirmFooter.style.paddingBottom, /calc\(4px \+ env\(/, 'فاصلهٔ پایین تأیید باید مثل کیبورد و فقط به‌اندازهٔ safe-area باشد');
    assert.equal(sheet.style.paddingBottom, '0px', 'فاصلهٔ قبلیِ زیر شیت نباید دکمهٔ تأیید را از کف بلند کند');

    const firstDay = [...backdrop.querySelectorAll('[data-hesabno-settlement-day]')]
      .find((button) => !button.disabled && button.getAttribute('data-hesabno-settlement-day') !== String(Number(original.split('/')[2])));
    assert.ok(firstDay, 'روز دیگری برای انتخاب باید وجود داشته باشد');
    const firstValue = firstDay.getAttribute('data-hesabno-settlement-day');
    firstDay.click();
    await wait();
    assert.ok(document.querySelector('[data-hesabno-settlement-datepicker]'), 'انتخاب روز نباید تقویم را ببندد');
    assert.equal(input.value, original, 'انتخاب روز تا پیش از تأیید نباید مقدار فرم را تغییر دهد');

    backdrop.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.ok(document.querySelector('[data-hesabno-settlement-datepicker]'), 'لمس پس‌زمینه یا Escape نباید تقویم را ببندد');

    document.querySelector('[data-hesabno-settlement-confirm]').click();
    await wait();
    assert.equal(document.querySelector('[data-hesabno-settlement-datepicker]'), null, 'تأیید باید تقویم را ببندد');
    assert.notEqual(input.value, original, 'تأیید باید تاریخ انتخاب‌شده را ذخیره کند');
    assert.equal(Number(input.value.split('/')[2]), Number(firstValue));

    const committed = input.value;
    control.click();
    backdrop = document.querySelector('[data-hesabno-settlement-datepicker]');
    const secondDay = [...backdrop.querySelectorAll('[data-hesabno-settlement-day]')]
      .find((button) => !button.disabled && button.getAttribute('data-hesabno-settlement-day') !== String(Number(committed.split('/')[2])));
    assert.ok(secondDay, 'برای آزمون لغو روز دیگری باید موجود باشد');
    secondDay.click();
    backdrop.querySelector('[data-hesabno-settlement-close]').click();
    await wait();
    assert.equal(document.querySelector('[data-hesabno-settlement-datepicker]'), null, 'ضربدر باید تقویم را ببندد');
    assert.equal(input.value, committed, 'ضربدر باید انتخاب موقت را لغو کند');
    await wait(100);
  } finally {
    dom.window.close();
  }
});
