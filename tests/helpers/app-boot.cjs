/*
 * ابزار مشترک آزمون‌های سرتاسری jsdom.
 *
 * کل اپلیکیشن از همان `index.html` واقعی بوت می‌شود، اما منابع از دیسک خوانده می‌شوند
 * (به‌جای شبکه) تا آزمون به سرور محلی وابسته نباشد. localStorage هم در دسترس است
 * چون مبدأ سند https://app.test/ است.
 */
const fs = require('node:fs');
const path = require('node:path');

let JSDOM;
let ResourceLoader;
try {
  ({ JSDOM, ResourceLoader } = require('jsdom'));
} catch (error) {
  JSDOM = null;
}

const root = path.resolve(__dirname, '..', '..');
const assetsDir = path.join(root, 'app/src/main/assets');
const indexHtml = path.join(assetsDir, 'index.html');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();

const LoaderBase = ResourceLoader || class {};
class LocalAssetLoader extends LoaderBase {
  fetch(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (parsed.origin !== 'https://app.test') return null;
    // The production light-theme contrast helper uses Canvas only to parse CSS colors.
    // jsdom has no Canvas implementation; keep all other app scripts real in integration tests.
    if (parsed.pathname === '/src/scripts/901-light-theme-contrast.js') {
      return Promise.resolve(Buffer.from('/* Canvas-only contrast helper is not executed in jsdom tests. */'));
    }
    const relative = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
    const file = path.join(assetsDir, relative);
    if (!file.startsWith(assetsDir) || !fs.existsSync(file)) return null;
    return Promise.resolve(fs.readFileSync(file));
  }
}

/** در jsdom، MutationObserverهای اپ باید پیش از close قطع شوند تا callbackهای معلق خطا ندهند. */
function trackObservers(window) {
  const NativeObserver = window.MutationObserver;
  const instances = new Set();
  const nativeObserve = NativeObserver.prototype.observe;
  const nativeDisconnect = NativeObserver.prototype.disconnect;
  NativeObserver.prototype.observe = function observe(...args) {
    instances.add(this);
    return nativeObserve.apply(this, args);
  };
  NativeObserver.prototype.disconnect = function disconnect() {
    instances.delete(this);
    return nativeDisconnect.call(this);
  };
  Object.defineProperty(window, '__trackedObservers', { value: instances, configurable: true });
}

/**
 * @param {{seed?: object, storage?: Record<string,string>, stubs?: (window: Window) => void}} options
 *   seed برای hesabno:transactions؛ storage برای کلیدهای دیگر مثل hesabno:theme.
 *   stubs برای پرکردن شکاف‌های jsdom (مثل ResizeObserver) پیش از اجرای اسکریپت‌های اپ.
 */
async function bootApp(options = {}) {
  if (!JSDOM) throw new Error('jsdom در دسترس نیست');
  const { seed, storage = {}, stubs } = options;
  const dom = new JSDOM(fs.readFileSync(indexHtml, 'utf8'), {
    url: 'https://app.test/',
    runScripts: 'dangerously',
    resources: new LocalAssetLoader(),
    pretendToBeVisual: true,
    beforeParse(window) {
      if (seed !== undefined) window.localStorage.setItem('hesabno:transactions', JSON.stringify(seed));
      Object.keys(storage).forEach((key) => window.localStorage.setItem(key, storage[key]));
      if (typeof stubs === 'function') stubs(window);
      trackObservers(window);
    },
  });
  const { window } = dom;
  const rootElement = window.document.getElementById('root');
  for (let i = 0; i < 300 && rootElement.innerHTML.length < 2000; i += 1) await wait(100);
  await wait(1200);
  return dom;
}

function closeApp(dom) {
  if (!dom) return;
  const { window } = dom;
  try {
    for (const observer of window.__trackedObservers || []) {
      try { observer.disconnect(); } catch (error) { /* نادیده */ }
    }
    if (window.__trackedObservers) window.__trackedObservers.clear();
    window.close();
  } catch (error) {
    /* پنجره ممکن است قبلاً بسته شده باشد */
  }
}

function buttonByText(document, text, { startsWith = false } = {}) {
  return [...document.querySelectorAll('button')].find((button) => {
    const label = normalize(button.textContent);
    return startsWith ? label.startsWith(text) : label === text;
  });
}

module.exports = { bootApp, closeApp, buttonByText, wait, normalize, assetsDir };
