const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, closeApp, wait } = require('./helpers/app-boot.cjs');

const persianDigits = (value) => String(value).replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

function currentTehranPersianDate() {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}/${value('month')}/${value('day')}`;
}

test('legacy placeholder membership date is replaced once and shown in a separate RTL metadata row', { timeout: 180000 }, async (t) => {
  const legacyProfile = {
    firstName: 'مریم',
    lastName: 'شعبانی',
    fullName: 'مریم شعبانی',
    joinDate: '۱۴۰۲/۰۱/۱۵',
    userCode: 'HN-84920',
  };
  const dom = await bootApp({ storage: {
    'hesabno:first_run_profile_done': '1',
    'hesabno:user_profile': JSON.stringify(legacyProfile),
  } });
  t.after(() => closeApp(dom));

  const { window } = dom;
  const savedProfile = JSON.parse(window.localStorage.getItem('hesabno:user_profile'));
  const expectedDate = currentTehranPersianDate();
  assert.equal(savedProfile.joinDate, expectedDate, 'تاریخ آزمایشی قدیمی باید یک‌بار با تاریخ واقعی روز در تقویم شمسی ایران جایگزین شود');
  assert.equal(savedProfile.userCode, legacyProfile.userCode, 'مهاجرت نباید کد کاربری را تغییر دهد');

  const profileButton = window.document.querySelector('[title="مشاهده و ویرایش پروفایل کاربری"]');
  assert.ok(profileButton, 'دکمهٔ بازکردن پروفایل باید روی صفحهٔ خانه وجود داشته باشد');
  profileButton.click();
  await wait(200);

  const membershipDate = window.document.querySelector('[data-hesabno-membership-date="true"]');
  assert.ok(membershipDate, 'تاریخ عضویت باید در کارت پروفایل نمایش داده شود');
  assert.equal(membershipDate.textContent, persianDigits(expectedDate), 'تاریخ باید با رقم‌های فارسی و بدون تغییر ترتیب سال/ماه/روز نمایش داده شود');
  assert.equal(membershipDate.getAttribute('dir'), 'ltr', 'ترتیب اجزای تاریخ شمسی باید ثابت بماند');
  assert.match(membershipDate.parentElement.parentElement.className, /flex-col/, 'تاریخ عضویت باید در ردیف جدا و مرتب زیر کد کاربر قرار بگیرد');
});
