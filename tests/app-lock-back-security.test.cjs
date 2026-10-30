const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { bootApp, closeApp, wait } = require('./helpers/app-boot.cjs');

const java = fs.readFileSync('app/src/main/java/com/maymoney/app/MainActivity.java', 'utf8');

function extractJavaString(startMarker, endMarker) {
  const start = java.indexOf(startMarker);
  const end = java.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `کد Native مربوط به ${startMarker} باید موجود باشد`);
  return [...java.slice(start, end).matchAll(/"(?:\\.|[^"\\])*"/g)]
    .map((match) => JSON.parse(match[0]))
    .join('');
}

test('Android Back and forged biometric callbacks cannot get around the app lock', { timeout: 180000 }, async (t) => {
  const dom = await bootApp({
    storage: {
      'hesabno:first_run_intro_done': '1',
      'hesabno:first_run_profile_done': '1',
      'hesabno:lock': 'true',
      'hesabno:pin': '2580',
      'hesabno:biometric': 'true',
    },
    stubs(window) {
      window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    },
  });
  t.after(() => closeApp(dom));
  const { window } = dom;
  const { document } = window;
  window.Element.prototype.getClientRects = function getClientRects() {
    return this.closest('.hidden') ? [] : [{}];
  };

  const lock = document.getElementById('hesabno-app-lock-overlay');
  assert.ok(lock, 'فعال بودن قفل باید برنامه را مستقیماً در صفحهٔ ورود باز کند');
  assert.equal(lock.parentElement, document.body, 'قفل تمام صفحه بیرون از اسکرولر برنامه قرار می‌گیرد');
  assert.ok(lock.classList.contains('z-[999]'), 'لایهٔ قفل باید روی همهٔ کنترل‌های برنامه باشد');
  const appRoot = document.getElementById('root');
  assert.ok(appRoot.hasAttribute('inert'), 'محتوای پشت قفل باید inert باشد');
  assert.equal(appRoot.getAttribute('aria-hidden'), 'true', 'محتوای پشت قفل نباید از راه دسترس‌پذیری باز باشد');

  let handled = 0;
  let exits = 0;
  let nativeBiometricProof = false;
  window.HnBridge = {
    backHandled: () => { handled += 1; },
    exitApp: () => { exits += 1; },
    authenticateBiometric: () => window.__hesabnoOnBiometricAuthResult(true),
    consumeBiometricUnlockProof: () => {
      const valid = nativeBiometricProof;
      nativeBiometricProof = false;
      return valid;
    },
  };

  const preflight = extractJavaString(
    'private static final String BACK_PREFLIGHT_JS =',
    '// اگر برنامه‌ی وب بتواند برگشت',
  );
  const backScript = extractJavaString(
    'private static final String BACK_JS =',
    '\n\n    private WebView',
  );

  assert.equal(window.eval(preflight), true, 'Native باید Back را روی صفحهٔ قفل مصرف کند');
  await wait(40);
  assert.ok(document.getElementById('hesabno-app-lock-overlay'), 'preflight نباید قفل را ببندد');

  window.eval(backScript);
  await wait(40);
  assert.equal(handled, 1, 'Native باید بداند Back روی صفحهٔ قفل عمداً مصرف شده است');
  assert.equal(exits, 0, 'Back روی قفل نباید برنامه یا پیغام خروج را باز کند');
  assert.equal(document.querySelector('[data-hn-exit-dialog]'), null);
  assert.ok(document.getElementById('hesabno-app-lock-overlay'), 'مسیر fallback هم نباید از قفل عبور کند');

  // شبیه‌سازی Back تکراری، Escape و لمس پس‌زمینه: هیچ‌کدام مجوز ورود نیستند.
  window.eval(backScript);
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  lock.click();
  await wait(40);
  assert.equal(exits, 0);
  assert.ok(document.getElementById('hesabno-app-lock-overlay'),
    'Back تکراری، Escape و لمس لایه نباید قفل را باز کنند');
  const activeBeforeBlockedClick = [...document.querySelectorAll('nav.fixed button')]
    .find((button) => String(button.className).includes('text-emerald-400'))?.textContent.trim();
  const hiddenMoreButton = [...document.querySelectorAll('nav.fixed button')]
    .find((button) => button.textContent.includes('بیشتر'));
  hiddenMoreButton?.click();
  await wait(30);
  const activeAfterBlockedClick = [...document.querySelectorAll('nav.fixed button')]
    .find((button) => String(button.className).includes('text-emerald-400'))?.textContent.trim();
  assert.equal(activeAfterBlockedClick, activeBeforeBlockedClick,
    'کلیک مصنوعی روی ناوبریِ پشت قفل نباید صفحهٔ زیرین را عوض کند');
  hiddenMoreButton?.focus();
  await wait(20);
  assert.ok(document.getElementById('hesabno-app-lock-overlay')?.contains(document.activeElement),
    'فوکوس صفحه‌کلید باید داخل لایهٔ قفل باقی بماند');

  // فراخوانی قابل‌جعل callback موفق، بدون مدرک یک‌بارمصرف Native، رد می‌شود.
  window.__hesabnoOnBiometricAuthResult(true);
  await wait(30);
  assert.ok(document.getElementById('hesabno-app-lock-overlay'),
    'ارسال true جعلی به callback نباید قفل را باز کند');
  document.getElementById('hesabno-biometric-unlock-btn').click();
  await wait(30);
  assert.ok(document.getElementById('hesabno-app-lock-overlay'),
    'کلیک روی اثر انگشت با پاسخ جعلی Bridge هم نباید قفل را باز کند');

  // فقط proofای که Native پس از موفقیت BiometricPrompt صادر می‌کند پذیرفته می‌شود.
  nativeBiometricProof = true;
  window.__hesabnoOnBiometricAuthResult(true);
  await wait(50);
  assert.equal(document.getElementById('hesabno-app-lock-overlay'), null,
    'مدرک Native یک‌بارمصرف باید اجازهٔ ورود بدهد');
  await wait(30);
  assert.equal(appRoot.hasAttribute('inert'), false, 'پس از احراز هویت معتبر، دسترسی به برنامه باید برگردد');
  assert.notEqual(appRoot.getAttribute('aria-hidden'), 'true');
  nativeBiometricProof = false;
  window.__hesabnoLockApp();
  await wait(40);
  window.__hesabnoOnBiometricAuthResult(true);
  await wait(30);
  assert.ok(document.getElementById('hesabno-app-lock-overlay'),
    'مدرک مصرف‌شده نباید قابل بازپخش باشد');
});

test('Native checks the app-lock guard before exit, layer dismissal, or WebView history', () => {
  const preflightStart = java.indexOf('private static final String BACK_PREFLIGHT_JS =');
  const preflightEnd = java.indexOf('// اگر برنامه‌ی وب بتواند برگشت', preflightStart);
  const preflight = java.slice(preflightStart, preflightEnd);
  const lockCheck = preflight.indexOf('[data-hesabno-app-lock=true]');
  assert.ok(lockCheck >= 0 && lockCheck < preflight.indexOf('__hesabnoDismissExitDialog'),
    'قفل باید پیش از هر تلاش برای بستن پنجره یا ناوبری مصرف‌کنندهٔ Back شود');

  const completeStart = java.indexOf('private void completeAndroidBackPreflight');
  const completeEnd = java.indexOf('private void dispatchBackToWebApp', completeStart);
  const complete = java.slice(completeStart, completeEnd);
  assert.ok(complete.indexOf('"true".equals(result)') < complete.indexOf('current.canGoBack()'),
    'preflight قفل باید پیش از برگشت در تاریخچهٔ WebView متوقف شود');

  assert.ok(java.includes('consumeBiometricUnlockProof()'),
    'بازکردن با بیومتریک باید به تأیید یک‌بارمصرف Native نیاز داشته باشد');
  assert.ok(java.includes('biometricUnlockProof.compareAndSet(true, false)'),
    'مدرک بیومتریک باید یک‌بارمصرف باشد');
});
