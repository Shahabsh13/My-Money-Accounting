const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const activity = fs.readFileSync(path.join(root, 'app/src/main/java/com/maymoney/app/MainActivity.java'), 'utf8');

function methodBody(signature, nextSignature) {
  const start = activity.indexOf(signature);
  assert.notEqual(start, -1, `missing method: ${signature}`);
  const end = activity.indexOf(nextSignature, start + signature.length);
  assert.notEqual(end, -1, `missing method boundary after: ${signature}`);
  return activity.slice(start, end);
}

test('Android system Back runs overlay preflight before WebView history', () => {
  const callback = activity.slice(
    activity.indexOf('getOnBackPressedDispatcher().addCallback'),
    activity.indexOf('if (savedInstanceState != null)'),
  );
  assert.match(callback, /handleOnBackPressed\(\)\s*\{\s*requestAndroidBack\(\);/);

  const preflight = methodBody('private void requestAndroidBack()', 'private void completeAndroidBackPreflight');
  assert.match(preflight, /evaluateJavascript\(BACK_PREFLIGHT_JS, value -> completeAndroidBackPreflight/);
  assert.match(preflight, /if \(backPreflightPending \|\| backFallbackPending\) return;/);
  assert.match(preflight, /postDelayed\(backPreflightTimeout, 900\)/);
});

test('a consumed preflight stops; otherwise history precedes app navigation and exit', () => {
  const complete = methodBody('private void completeAndroidBackPreflight', 'private void dispatchBackToWebApp');
  const consumed = complete.indexOf('"true".equals(result)');
  const history = complete.indexOf('current.canGoBack()');
  const historyBack = complete.indexOf('current.goBack()');
  const appBack = complete.indexOf('dispatchBackToWebApp()');
  assert.ok(consumed >= 0 && consumed < history);
  assert.ok(history < historyBack && historyBack < appBack);
  assert.match(activity, /webView\.evaluateJavascript\(BACK_JS, null\)/);
});

test('preflight closes only transient layers in priority order and invalidates stale callbacks', () => {
  const start = activity.indexOf('private static final String BACK_PREFLIGHT_JS');
  const end = activity.indexOf('// اگر برنامه‌ی وب بتواند برگشت', start);
  const preflightScript = activity.slice(start, end);
  const lockGuard = preflightScript.indexOf('[data-hesabno-app-lock=true]');
  const priorities = [
    '__hesabnoDismissExitDialog',
    'hesabno-first-run',
    '__hesabnoCloseAmountKeyboard',
    '__hesabnoCloseTopLayer',
  ].map((marker) => preflightScript.indexOf(marker));
  assert.ok(lockGuard >= 0 && priorities.every((position) => position >= 0));
  assert.ok(priorities.every((position) => lockGuard < position),
    'قفل امنیتی باید پیش از بستن هر پنجره یا رفتن به تاریخچه بررسی شود');
  assert.deepEqual(priorities, [...priorities].sort((a, b) => a - b));

  assert.match(activity, /backPreflightRequestId\+\+/);
  assert.match(activity, /backFallbackRequestId\+\+/);
  assert.match(activity, /backFallbackPending\s*=\s*false/);
});
