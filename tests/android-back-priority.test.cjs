const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const java = fs.readFileSync(path.join(root, 'app/src/main/java/com/maymoney/app/MainActivity.java'), 'utf8');

function javaStringConstant(name, nextMarker) {
  const start = java.indexOf(`private static final String ${name} =`);
  assert.notEqual(start, -1, `${name} باید در MainActivity تعریف شده باشد`);
  const end = java.indexOf(nextMarker, start);
  assert.notEqual(end, -1, `مرز ثابت ${name} پیدا نشد`);
  return [...java.slice(start, end).matchAll(/"(?:\\.|[^"\\])*"/g)]
    .map((match) => JSON.parse(match[0]))
    .join('');
}

const preflight = javaStringConstant('BACK_PREFLIGHT_JS', '\n\n    private static final String BACK_JS');
const backJs = javaStringConstant('BACK_JS', '\n\n    private WebView');

test('Android preflight فقط کیبورد مبلغ یا لایه‌ی رویی را می‌بندد و نتیجه‌ی Boolean می‌دهد', () => {
  const cases = [
    { keypad: true, layer: true, result: true, closed: ['keypad'] },
    { keypad: false, layer: true, result: true, closed: ['layer'] },
    { keypad: false, layer: false, result: false, closed: [] },
  ];

  for (const scenario of cases) {
    const closed = [];
    const window = {
      __hesabnoCloseAmountKeyboard: () => {
        if (scenario.keypad) closed.push('keypad');
        return scenario.keypad;
      },
      __hesabnoCloseTopLayer: () => {
        if (scenario.layer) closed.push('layer');
        return scenario.layer;
      },
    };
    const result = vm.runInNewContext(preflight, { window });
    assert.equal(result, scenario.result);
    assert.deepEqual(closed, scenario.closed, 'یک اجرای preflight نباید بیش از یک لایه ببندد');
  }

  let layerCalls = 0;
  const failedProbe = vm.runInNewContext(preflight, {
    window: {
      __hesabnoCloseAmountKeyboard: () => { throw new Error('probe failed'); },
      __hesabnoCloseTopLayer: () => { layerCalls += 1; return true; },
    },
  });
  assert.equal(failedProbe, null, 'خطای preflight باید نامشخص بماند تا ناوبری اشتباهی رخ ندهد');
  assert.equal(layerCalls, 0, 'پس از خطای تابع keypad سراغ بستن لایه‌ی دیگری نرو');
});

test('MainActivity ابتدا preflight را کامل می‌کند، بعد history و فقط در نبود آن BACK_JS را اجرا می‌کند', () => {
  const start = java.indexOf('getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true)');
  const end = java.indexOf('\n\n        if (savedInstanceState != null)', start);
  assert.ok(start >= 0 && end > start, 'callback دکمه‌ی Back باید پیدا شود');
  const callback = java.slice(start, end);

  const probe = callback.indexOf('BACK_PREFLIGHT_JS.replace(');
  const consumedCheck = callback.indexOf('"true".equals(value)', probe);
  const historyCheck = callback.indexOf('target.canGoBack()', consumedCheck);
  const historyAction = callback.indexOf('target.goBack()', historyCheck);
  const fallback = callback.indexOf('runBackJs(requestId, target, documentGeneration)', historyAction);
  assert.ok(probe >= 0 && probe < consumedCheck, 'ابتدا باید نتیجه‌ی preflight دریافت شود');
  assert.ok(consumedCheck < historyCheck && historyCheck < historyAction, 'مصرف‌شدن لایه باید پیش از بررسی history باشد');
  assert.match(callback.slice(consumedCheck, historyCheck), /!\"false\"\.equals\(value\)/,
    'نتیجه‌ی نامشخص preflight نباید به تاریخچه یا BACK_JS سقوط کند');
  assert.ok(historyAction < fallback, 'BACK_JS فقط پس از نبود history اجرا شود');
  assert.match(callback.slice(consumedCheck, historyCheck), /completeBackRequest[\s\S]*?return;/,
    'اگر preflight لایه‌ای بست، همان Back باید همان‌جا تمام شود');

  const runBackJs = java.slice(java.indexOf('private void runBackJs('), java.indexOf('private android.view.View createStartupSplash('));
  assert.ok(runBackJs.includes('BACK_JS.replace(') && runBackJs.includes('evaluateJavascript(requestScript'),
    'مسیر fallback باید همچنان BACK_JS کامل را با شناسه‌ی همان درخواست اجرا کند');
  assert.ok(java.includes('window.__hesabnoConfirmExit'), 'منطق فعلی خروج باید حفظ شده باشد');
});

test('اسکریپت‌های مانده از درخواست نامعتبر پیش از بستن لایه یا خروج متوقف می‌شوند (VM mock)', () => {
  const staleRequestId = '41';
  let touched = 0;
  const window = {
    HnBridge: {
      isBackRequestCurrent: (id) => id !== staleRequestId,
      backHandled: () => { touched += 1; },
      exitAppForBack: () => { touched += 1; },
    },
    __hesabnoCloseAmountKeyboard: () => { touched += 1; return true; },
    __hesabnoCloseTopLayer: () => { touched += 1; return true; },
  };
  const staleProbe = preflight.replace('__HN_BACK_REQUEST_ID__', staleRequestId);
  assert.equal(vm.runInNewContext(staleProbe, { window }), null);
  const staleBack = backJs.replaceAll('__HN_BACK_REQUEST_ID__', staleRequestId);
  vm.runInNewContext(staleBack, { window });
  assert.equal(touched, 0, 'اسکریپت قدیمی نباید کیبورد، لایه، handled یا خروج را دست بزند');
});

test('BACK_JS مسیر تأیید خروج mock را با همان شناسه‌ی فعال حفظ می‌کند', () => {
  const events = [];
  const requestId = '42';
  const window = {
    HnBridge: {
      isBackRequestCurrent: (id) => id === requestId,
      backHandled: (id) => events.push(['handled', id]),
      exitAppForBack: (id) => events.push(['exit', id]),
    },
    confirm: () => true,
  };
  const document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
  };
  const activeBack = backJs.replaceAll('__HN_BACK_REQUEST_ID__', requestId);
  vm.runInNewContext(activeBack, { window, document });
  assert.deepEqual(events, [['handled', requestId], ['exit', requestId]]);
});

test('درخواست‌های ناهم‌زمان Back سریال‌اند و callback/timeout قدیمی بی‌اثر می‌ماند', () => {
  const start = java.indexOf('getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true)');
  const end = java.indexOf('\n\n        if (savedInstanceState != null)', start);
  const callback = java.slice(start, end);
  assert.ok(callback.indexOf('if (backRequestInFlight) return;') < callback.indexOf('BACK_PREFLIGHT_JS.replace('),
    'فشارهای سریع در زمان پردازش نباید یک Back را دوبار اجرا کنند');
  assert.match(callback, /final long requestId = \+\+backRequestId/);
  assert.match(callback, /isCurrentBackRequest\(requestId, target, documentGeneration\)/,
    'نتیجه‌ی callback باید شناسه‌ی درخواست، WebView و نسل سند را اعتبارسنجی کند');
  assert.match(java, /backRequestId\+\+/,
    'timeout باید callback دیررس را نامعتبر کند');
  assert.match(java, /private boolean isCurrentBackRequest\(long requestId, WebView target, long documentGeneration\)/);
  assert.match(java, /handler\.postDelayed\(backResolutionTimeout, 2000\)/,
    'در صورت نرسیدن callback، قفل Back باید با timeout آزاد شود');
  assert.match(java, /backRequestId != requestId \|\| webView != target/,
    'تایمر خروج قدیمی نباید روی درخواست یا WebView جدید اثر بگذارد');
});

test('callback سند قدیمی پس از شروع بارگذاری سند جدید منقضی می‌شود، بدون مقایسه‌ی URL', () => {
  const pageStartedStart = java.indexOf('public void onPageStarted(');
  const pageStartedEnd = java.indexOf('\n            @Override', pageStartedStart);
  const pageStarted = java.slice(pageStartedStart, pageStartedEnd);
  assert.match(pageStarted, /webDocumentGeneration\+\+/);
  assert.match(pageStarted, /invalidateBackRequestForNewDocument\(\)/);
  assert.match(pageStarted, /if \(view == webView\)/);

  assert.match(java, /final long documentGeneration = webDocumentGeneration/);
  assert.match(java, /isCurrentBackRequest\(requestId, target, documentGeneration\)/,
    'callback پیش از history و اجرای BACK_JS باید نسل سند را اعتبارسنجی کند');
  assert.match(java, /webDocumentGeneration == documentGeneration/);
  assert.doesNotMatch(java.slice(java.indexOf('private boolean isCurrentBackRequest'), java.indexOf('private void cancelBackResolutionTimeout')),
    /getUrl\(|url\s*\.equals/,
    'اعتبارسنجی نسل نباید تغییرهای URL درون همان سند را به‌اشتباه منقضی کند');

  const invalidationStart = java.indexOf('private void invalidateBackRequestForNewDocument(');
  const invalidationEnd = java.indexOf('private void scheduleBackResolutionTimeout(', invalidationStart);
  const invalidation = java.slice(invalidationStart, invalidationEnd);
  assert.match(invalidation, /backRequestId\+\+/);
  assert.match(invalidation, /backRequestInFlight = false/);
  assert.match(invalidation, /cancelBackResolutionTimeout\(\)/);
  assert.match(invalidation, /cancelBackFallback\(\)/);
});

test('timeout مستقل BACK_JS قفل را آزاد می‌کند، درخواست را منقضی می‌کند و خودش خروج یا retry نمی‌کند', () => {
  const runStart = java.indexOf('private void runBackJs(');
  const runEnd = java.indexOf('private android.view.View createStartupSplash(', runStart);
  const runBackJs = java.slice(runStart, runEnd);
  assert.ok(runBackJs.indexOf('scheduleBackResolutionTimeout(requestId, target, documentGeneration)')
    < runBackJs.indexOf('target.evaluateJavascript(requestScript'),
  'مرحله‌ی BACK_JS باید timeout خودش را پیش از اجرا ثبت کند');

  const timeoutStart = java.indexOf('private void scheduleBackResolutionTimeout(');
  const timeoutEnd = java.indexOf('private void completeBackRequest(', timeoutStart);
  const timeout = java.slice(timeoutStart, timeoutEnd);
  assert.match(timeout, /handler\.postDelayed\(backResolutionTimeout, 2000\)/);
  assert.match(timeout, /backRequestInFlight = false/);
  assert.match(timeout, /backRequestId\+\+/);
  assert.doesNotMatch(timeout, /finish\(|evaluateJavascript\(|runBackJs\(/,
    'timeout فقط درخواست را آزاد/منقضی می‌کند؛ نباید خروج یا اجرای مجدد ایجاد کند');
});

test('backHandled به شناسه‌ی همان درخواست متصل است و callback دیررس وضعیت درخواست بعدی را عوض نمی‌کند', () => {
  assert.ok(backJs.includes("backHandled('__HN_BACK_REQUEST_ID__')"),
    'BACK_JS باید شناسه‌ی درخواست خودش را به پل بومی بدهد');
  assert.match(java, /BACK_JS\.replace\("__HN_BACK_REQUEST_ID__", Long\.toString\(requestId\)\)/,
    'شناسه‌ی فعلی باید در اسکریپت همان درخواست جایگزین شود');
  assert.match(java, /BACK_PREFLIGHT_JS\.replace\("__HN_BACK_REQUEST_ID__", Long\.toString\(requestId\)\)/,
    'preflight معوق نیز باید پیش از هر اثر جانبی شناسه را اعتبارسنجی کند');
  assert.match(java, /public boolean isBackRequestCurrent\(String requestIdValue\)/);
  assert.match(java, /public void backHandled\(String requestIdValue\)/);
  assert.match(java, /return backRequestInFlight && isCurrentBackRequestToken\(requestId\)/,
    'پل بومی فقط درخواست فعال و هم‌شناسه را معتبر می‌داند');
  assert.match(java, /if \(isBackRequestCurrent\(requestIdValue\)\) backHandledRequestId = requestId/,
    'backHandled فقط وضعیت درخواست فعال را عوض می‌کند');
  assert.match(java, /backHandledRequestId == requestId/,
    'fallback خروج باید فقط handled همان درخواست را بپذیرد');
});

test('native confirm مسیر Back را handled می‌کند، پاسخ‌ها را به همان dialog وصل می‌کند و پس از پاسخ timeout می‌دهد', () => {
  const confirmStart = java.indexOf('public boolean onJsConfirm(');
  const confirmEnd = java.indexOf('\n            @Override\n            public boolean onJsPrompt', confirmStart);
  const confirm = java.slice(confirmStart, confirmEnd);
  assert.match(confirm, /backJsRequestId == confirmRequestId/);
  assert.match(confirm, /backExitConfirmPendingRequestId = confirmRequestId/);
  assert.match(confirm, /backExitConfirmResult = result/);
  assert.match(confirm, /backHandledRequestId = confirmRequestId/);
  assert.match(confirm, /cancelBackResolutionTimeout\(\)/);
  assert.ok(confirm.indexOf('cancelBackResolutionTimeout()') < confirm.indexOf('.show();'),
    'fallback 700ms باید پیش از نمایش confirm برای همان درخواست مهار شود');
  assert.match(confirm, /dialog\.show\(\)[\s\S]*?scheduleBackExitConfirmTimeout\(/,
    'timeout محدود دیالوگ پس از نمایش موفق ثبت شود');
  assert.match(confirm, /catch \(RuntimeException ignored\)[\s\S]*?invalidateBackRequest\(\)/,
    'خطای ساخت/نمایش باید درخواست جاری را invalidate کند، نه خروج را اجرا کند');

  const resolverStart = java.indexOf('private void finishBackExitConfirm(');
  const resolverEnd = java.indexOf('private void runBackJs(', resolverStart);
  const resolver = java.slice(resolverStart, resolverEnd);
  assert.match(resolver, /isPendingBackExitConfirm\(requestId, target, documentGeneration, dialog, result\)/,
    'callback باید شناسه، سند، dialog و JsResult همان confirm را اعتبارسنجی کند');
  assert.match(resolver, /if \(confirmed\)[\s\S]*?result\.confirm\(\)[\s\S]*?else \{[\s\S]*?safelyCancelJsResult\(result\)/);
  assert.match(resolver, /scheduleBackResolutionTimeout\(requestId, target, documentGeneration\)/,
    'پس از پاسخ مثبت/منفی/لغو، timeout محدود برای callback برقرار شود');
  assert.equal((confirm.match(/finishBackExitConfirm\(confirmRequestId, view, confirmDocumentGeneration,/g) || []).length, 3,
    'تأیید، رد و لغو باید از resolver محصور به همان دیالوگ عبور کنند');
});

test('timeout native confirm فقط درخواست هنوز معتبر را invalidate می‌کند، dialog را می‌بندد و JsResult را لغو می‌کند', () => {
  assert.match(java, /BACK_EXIT_CONFIRM_TIMEOUT_MS = 30_000L/);
  const timeoutStart = java.indexOf('private void scheduleBackExitConfirmTimeout(');
  const timeoutEnd = java.indexOf('private void finishBackExitConfirm(', timeoutStart);
  const timeout = java.slice(timeoutStart, timeoutEnd);
  assert.match(timeout, /isPendingBackExitConfirm\(requestId, target, documentGeneration, dialog, result\)/);
  assert.match(timeout, /handler\.postDelayed\(backExitConfirmTimeout, BACK_EXIT_CONFIRM_TIMEOUT_MS\)/);
  assert.match(timeout, /invalidateBackRequest\(\)/);
  assert.doesNotMatch(timeout, /finish\(|exitApp|evaluateJavascript|runBackJs/,
    'timeout هرگز خروج مستقیم یا retry نمی‌کند');

  const invalidateStart = java.indexOf('private void invalidateBackRequest()');
  const invalidateEnd = java.indexOf('private void scheduleBackResolutionTimeout(', invalidateStart);
  const invalidation = java.slice(invalidateStart, invalidateEnd);
  assert.match(invalidation, /backRequestId\+\+/);
  assert.match(invalidation, /backRequestInFlight = false/);
  assert.match(invalidation, /backExitConfirmDialog = null/);
  assert.match(invalidation, /backExitConfirmResult = null/);
  assert.match(invalidation, /safelyDismissBackExitConfirmDialog\(pendingDialog\)/);
  assert.match(invalidation, /safelyCancelJsResult\(pendingResult\)/);
});

test('callback confirm دیررس پس از timeout یا تغییر سند نمی‌تواند request جدید را تغییر دهد', () => {
  const predicateStart = java.indexOf('private boolean isPendingBackExitConfirm(');
  const predicateEnd = java.indexOf('private void safelyDismissBackExitConfirmDialog(', predicateStart);
  const predicate = java.slice(predicateStart, predicateEnd);
  assert.match(predicate, /backExitConfirmPendingRequestId == requestId/);
  assert.match(predicate, /backExitConfirmDocumentGeneration == documentGeneration/);
  assert.match(predicate, /backExitConfirmDialog == dialog/);
  assert.match(predicate, /backExitConfirmResult == result/);
  assert.match(predicate, /isCurrentBackRequest\(requestId, target, documentGeneration\)/);
  const resolverStart = java.indexOf('private void finishBackExitConfirm(');
  const resolverEnd = java.indexOf('private void runBackJs(', resolverStart);
  assert.match(java.slice(resolverStart, resolverEnd), /if \(!isPendingBackExitConfirm\([\s\S]*?\)\) return;/,
    'callback stale باید پیش از confirm/cancel و دست‌کاری state متوقف شود');
});

test('onDestroy پیش از destroy کردن WebView درخواست Back و هر دو runnable را باطل می‌کند', () => {
  const destroyStart = java.indexOf('protected void onDestroy()');
  const destroyEnd = java.indexOf('\n    }', destroyStart);
  const onDestroy = java.slice(destroyStart, destroyEnd);
  assert.ok(onDestroy.indexOf('invalidateBackRequest()') < onDestroy.indexOf('webView.destroy()'));

  const invalidationStart = java.indexOf('private void invalidateBackRequest()');
  const invalidationEnd = java.indexOf('private void scheduleBackResolutionTimeout(', invalidationStart);
  const invalidation = java.slice(invalidationStart, invalidationEnd);
  assert.match(invalidation, /backRequestId\+\+/);
  assert.match(invalidation, /backRequestInFlight = false/);
  assert.match(invalidation, /backExitConfirmPendingRequestId = -1L/);
  assert.match(invalidation, /cancelBackResolutionTimeout\(\)/);
  assert.match(invalidation, /cancelBackFallback\(\)/);
});

test('دروازه‌ی in-flight از اجرای دوباره‌ی همان Back جلوگیری می‌کند و BACK_JS و خروج عادی حفظ شده‌اند', () => {
  assert.match(java, /if \(backRequestInFlight\) return;/);
  const runStart = java.indexOf('private void runBackJs(');
  const runEnd = java.indexOf('private android.view.View createStartupSplash(', runStart);
  const runBackJs = java.slice(runStart, runEnd);
  assert.equal((runBackJs.match(/target\.evaluateJavascript\(/g) || []).length, 1,
    'مسیر اجرای BACK_JS باید در هر درخواست تنها یک بار evaluate شود');
  assert.ok(backJs.includes('__hesabnoDismissExitDialog'));
  assert.ok(backJs.includes('hesabno-first-run'));
  assert.ok(backJs.includes('__hesabnoCloseAmountKeyboard'));
  assert.ok(backJs.includes('__hesabnoCloseTopLayer'));
  assert.ok(backJs.includes('__hesabnoNavigateBack'));
  assert.ok(backJs.includes('__hesabnoConfirmExit'));
  assert.ok(backJs.includes('HnBridge.exitAppForBack'));
  assert.match(java, /public void exitApp\(\)/, 'دکمه‌ی تأیید دیالوگ خروج باید مسیر فعلی خود را داشته باشد');
  const exitDialogSource = fs.readFileSync(path.join(root, 'app/src/main/assets/src/scripts/004-hesabno-apk-fixes.js'), 'utf8');
  assert.ok(exitDialogSource.includes('window.HnBridge.exitApp()'), 'تأیید صریح دیالوگ نباید به token درخواست Back وابسته شود');
  assert.match(java, /public void exitAppForBack\(String requestIdValue\)/);
  assert.match(java, /if \(isCurrentBackRequestToken\(requestId\)\) finish\(\)/,
    'درخواست خروج قدیمی نباید پس از سند جدید/Back جدید برنامه را ببندد');
});
