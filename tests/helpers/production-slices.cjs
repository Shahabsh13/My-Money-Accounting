/*
 * ابزار مشترک: بارگذاری توابع واقعی تولید از باندل مینیفای‌شده.
 *
 * باندل `067-inline.js` بدون منبع (source) منتشر می‌شود، بنابراین تنها راه آزمون‌پذیر کردن
 * منطق حسابداری، «برش» دقیق یک تابع از همان فایل واقعی و اجرای آن در یک sandbox است.
 * این ماژول همان زنجیره‌ی شناسه‌های سطح بالا (gl → tl → k0 → ch → rN → Nr → Cs → gk) را
 * در اختیار آزمون‌ها می‌گذارد تا هر آزمون فقط داده و انتظار بنویسد.
 *
 * اگر ساختار باندل تغییر کند، همه‌ی برش‌ها با پیام روشن شکست می‌خورند (نه با خطای مبهم).
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const bundlePath = path.join(__dirname, '..', '..', 'app/src/main/assets/src/scripts/067-inline.js');
const bundle = fs.readFileSync(bundlePath, 'utf8');

function loadFromPrefix(prefix, endMarker, globals = {}) {
  const start = bundle.indexOf(prefix);
  assert.notEqual(start, -1, `پیشوند تولید «${prefix}» در باندل وجود دارد`);
  const assignmentOffset = prefix.indexOf('=');
  const end = bundle.indexOf(endMarker, start + prefix.length);
  assert.notEqual(end, -1, `نشانگر پایان «${endMarker}» برای «${prefix}» وجود دارد`);
  const expression = bundle.slice(start + assignmentOffset + 1, end);
  const context = { ...globals };
  vm.runInNewContext(`globalThis.__tested = (${expression});`, context);
  return context.__tested;
}

function loadFromName(name, endMarker, globals = {}) {
  const marker = `${name}=`;
  const start = bundle.indexOf(marker);
  assert.notEqual(start, -1, `تابع تولید «${name}» در باندل وجود دارد`);
  const end = bundle.indexOf(endMarker, start + marker.length);
  assert.notEqual(end, -1, `نشانگر پایان برای «${name}» وجود دارد`);
  const expression = bundle.slice(start + marker.length, end);
  const context = { ...globals };
  vm.runInNewContext(`globalThis.__tested = (${expression});`, context);
  return context.__tested;
}

/**
 * زنجیره‌ی واقعی محاسبات گزارش‌ها:
 *   gl  → ساخت درخت حساب‌ها و فهرست فرزندان
 *   tl  → یافتن حساب با نام
 *   k0  → گروه حساب با نام
 *   ch  → آیا نام، حساب است؟
 *   rN  → آیا حساب دوم فرزند حساب اول است؟
 *   Nr  → مانده/بدهکار/بستانکار یک حساب
 *   Cs  → تفکیک هر سند به درآمد/هزینه/کارمزد
 *   gk  → خلاصه‌ی گزارش‌ها (دارایی نقدی، طلب، بدهی، اقساط، ارزش خالص)
 */
function loadAccountingKernel() {
  const accountTree = loadFromPrefix('gl=t=>', ',tl=', { sN: new WeakMap() });
  const accountLookup = loadFromPrefix('tl=(t,s)=>', ',k0=', { gl: accountTree });
  const accountGroup = loadFromPrefix('k0=(t,s)=>', ',ch=', { tl: accountLookup });
  const isPersonAccount = loadFromPrefix('ch=(t,s)=>', ',nN=', { tl: accountLookup });
  const isDescendantAccount = loadFromPrefix('rN=(t,s,n)=>', ',Cs=', { gl: accountTree });
  const accountBalance = loadFromName('Nr', ',v9=', { gl: accountTree, rN: isDescendantAccount });
  const reportTotals = loadFromName('Cs', ',Nr=', { k0: accountGroup, ch: isPersonAccount });
  const reportSummary = loadFromName('gk', ',fc=', { Nr: accountBalance, Cs: reportTotals });
  return {
    accountTree,
    accountLookup,
    accountGroup,
    isPersonAccount,
    isDescendantAccount,
    accountBalance,
    reportTotals,
    reportSummary,
  };
}

module.exports = { bundle, bundlePath, loadFromPrefix, loadFromName, loadAccountingKernel };
