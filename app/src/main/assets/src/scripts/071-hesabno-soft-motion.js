(function () {
  var lastMain = null;
  var lastSignature = '';
  var markedLayers = new WeakSet();
  var tabLabels = new Set(['ساده', 'پیشرفته', 'دریافت', 'پرداخت', 'انتقال', 'چک‌ها', 'اصلاحی', 'هزینه', 'درآمد', 'همه', 'مقایسه', 'روزانه', 'سرفصل‌های هزینه', 'سرفصل‌های درآمد', 'توزیع هزینه‌ها', 'توزیع درآمدها', 'بانک‌ها', 'صندوق‌ها']);

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function replay(element, className, duration) {
    if (!element || element.classList.contains(className)) return;
    element.classList.add(className);
    if (duration) setTimeout(function () { element.classList.remove(className); }, duration);
  }

  function isScrollableTabControl(element) {
    var parent = element && element.parentElement;
    if (!parent || element.tagName !== 'BUTTON' || String(parent.className).indexOf('overflow-x-auto') === -1) return false;
    return Array.from(parent.children).filter(function (child) { return child.tagName === 'BUTTON'; }).length > 1;
  }

  function isNavigationControl(element) {
    if (!element) return false;
    if (element.closest('nav.fixed')) return true;
    if (element.getAttribute('aria-label') === 'بازگشت') return true;
    var text = clean(element.textContent);
    if (tabLabels.has(text) || element.closest('[role="tab"], [role="tablist"]') || isScrollableTabControl(element)) return true;
    var parentClass = element.parentElement && String(element.parentElement.className);
    var segmentedTabs = parentClass && parentClass.indexOf('grid-cols-2') !== -1 && parentClass.indexOf('rounded-2xl') !== -1;
    var pageMenu = parentClass && parentClass.indexOf('divide-y') !== -1 && parentClass.indexOf('rounded-2xl') !== -1 && parentClass.indexOf('overflow-hidden') !== -1;
    return !!(segmentedTabs || pageMenu);
  }

  function isNoMotionInteraction(target) {
    if (!target || !target.closest) return false;
    var control = target.closest('input, select, textarea, label, [role="checkbox"], [role="switch"], [aria-checked], button, [class*="cursor-pointer"]');
    if (!control || isNavigationControl(control)) return false;
    return true;
  }

  function motionSuppressed() {
    return Date.now() < Number(window.__hesabnoSuppressMotionUntil || 0);
  }

  function removeMainMotion(main) {
    ['hesabno-page-enter', 'hesabno-page-open-up', 'hesabno-tab-horizontal-in', 'hesabno-content-swap'].forEach(function (className) {
      if (main.classList.contains(className)) main.classList.remove(className);
    });
  }

  function pickerOpen() {
    return !!document.querySelector('.hesabno-account-picker-overlay, .hesabno-fullscreen-selector-overlay');
  }

  function markTabs() {
    document.querySelectorAll('button').forEach(function (button) {
      if (isNavigationControl(button)) button.classList.add('hesabno-tab-motion');
    });
  }

  function markFeedbackAndLayers() {
    document.querySelectorAll('[class*="fixed"]').forEach(function (element) {
      var classes = typeof element.className === 'string' ? element.className : '';
      if (element.tagName === 'NAV' || markedLayers.has(element)) return;
      markedLayers.add(element);
      if (classes.indexOf('z-50') !== -1 && classes.indexOf('top-') !== -1) {
        element.classList.add('hesabno-toast-motion');
      } else if (classes.indexOf('inset-0') !== -1 || classes.indexOf('z-40') !== -1) {
        element.classList.add('hesabno-overlay-motion');
        var dialog = Array.from(element.querySelectorAll('div')).find(function (child) {
          var rect = child.getBoundingClientRect();
          return rect.width > 260 && rect.height > 120 && typeof child.className === 'string' && child.className.indexOf('rounded') !== -1;
        });
        if (dialog) dialog.classList.add('hesabno-dialog-motion');
      }
    });
  }

  function animateMain() {
    var main = document.querySelector('main');
    if (!main) return;
    var signature = clean(main.textContent).slice(0, 180);
    if (main.querySelector('button[aria-label="بازگشت"], button[title="بازگشت"]')) {
      lastMain = main;
      lastSignature = signature;
      return;
    }
    if (motionSuppressed() || pickerOpen()) {
      removeMainMotion(main);
      lastMain = main;
      lastSignature = signature;
      return;
    }
    if (main !== lastMain) {
      removeMainMotion(main);
      replay(main, 'hesabno-page-enter', 620);
      lastMain = main;
    } else if (signature !== lastSignature) {
      removeMainMotion(main);
      replay(main, 'hesabno-content-swap', 280);
    }
    lastSignature = signature;
  }

  function enhance() {
    markTabs();
    markFeedbackAndLayers();
    animateMain();
  }

  ['click', 'change', 'input'].forEach(function (eventName) {
    document.addEventListener(eventName, function (event) {
      if (!isNoMotionInteraction(event.target)) return;
      var control = event.target.closest('input, select, textarea, label, [role="checkbox"], [role="switch"], [aria-checked], button, [class*="cursor-pointer"]');
      if (control && !isNavigationControl(control)) control.classList.add('hesabno-control-no-motion');
      window.__hesabnoSuppressMotionUntil = Date.now() + 700;
    }, true);
  });
  enhance();
  var motionQueued = false;
  function scheduleMotion() {
    if (motionQueued) return;
    motionQueued = true;
    requestAnimationFrame(function () { motionQueued = false; enhance(); });
  }
  if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, scheduleMotion);
})();
