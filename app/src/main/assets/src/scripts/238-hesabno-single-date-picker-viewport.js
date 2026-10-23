/*
 * هم‌ترازی انتخابگرهای تک‌تاریخی با بخش قابل‌مشاهده‌ی WebView.
 * فقط پنل‌های تاریخ تراکنش/قسط، تسویه‌ی چک و بازپرداخت چک هدف‌اند؛
 * تقویم‌های بازه‌ای و صفحه‌کلید مبلغ عمداً خارج از محدوده‌اند.
 */
(function () {
  "use strict";

  var PICKER_SELECTOR = [
    '[data-hesabno-transaction-datepicker="true"]',
    '[data-hesabno-settlement-datepicker="true"]',
    '[data-hesabno-return-date-picker="true"]'
  ].join(",");
  var attached = new WeakMap();

  function isElement(node) {
    return !!node && node.nodeType === 1;
  }

  function visit(node, callback) {
    if (!isElement(node)) return;
    if (node.matches && node.matches(PICKER_SELECTOR)) callback(node);
    if (!node.querySelectorAll) return;
    var matches = node.querySelectorAll(PICKER_SELECTOR);
    for (var index = 0; index < matches.length; index += 1) callback(matches[index]);
  }

  function sheetFor(overlay) {
    return overlay.querySelector("#persian-datepicker-sheet, #hesabno-return-datepicker-sheet");
  }

  function viewportSize() {
    var viewport = window.visualViewport;
    var height = viewport && Number(viewport.height) > 0
      ? Number(viewport.height)
      : Number(window.innerHeight) || Number(document.documentElement.clientHeight);
    var top = viewport ? Number(viewport.offsetTop) || 0 : 0;
    return { height: Math.max(0, Math.round(height)), top: Math.max(0, Math.round(top)) };
  }

  function attach(overlay) {
    if (attached.has(overlay)) return;

    var viewport = window.visualViewport;
    var sheet = sheetFor(overlay);
    if (sheet && sheet.classList) {
      /* یک انیمیشن ورود واحد و مختص این Bottom Sheetها؛ حذف انیمیشن عمومیِ ۱۲px. */
      sheet.classList.remove("hesabno-dialog-motion");
      sheet.classList.add("hesabno-single-date-sheet");
    }
    function sync() {
      if (!overlay.isConnected) return;
      var size = viewportSize();
      if (!size.height) return;

      /* fixed + محدوده‌ی visualViewport باعث می‌شود شیت در زمان نمایش IME/تغییر اندازه
         به پایینِ بخش قابل‌دیدن بچسبد، نه پایینِ layout viewport قدیمی. */
      overlay.style.position = "fixed";
      overlay.style.top = size.top + "px";
      overlay.style.right = "0";
      overlay.style.bottom = "auto";
      overlay.style.left = "0";
      overlay.style.height = size.height + "px";
      overlay.style.alignItems = "flex-end";
      if (sheet && sheet.isConnected) {
        sheet.style.maxHeight = Math.max(1, Math.floor(size.height * 0.86)) + "px";
        sheet.style.overflowY = "auto";
      }
    }

    function onViewportChange() { sync(); }
    if (viewport && typeof viewport.addEventListener === "function") {
      viewport.addEventListener("resize", onViewportChange);
      viewport.addEventListener("scroll", onViewportChange);
    }
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("orientationchange", onViewportChange);
    attached.set(overlay, {
      sync: sync,
      detach: function () {
        if (viewport && typeof viewport.removeEventListener === "function") {
          viewport.removeEventListener("resize", onViewportChange);
          viewport.removeEventListener("scroll", onViewportChange);
        }
        window.removeEventListener("resize", onViewportChange);
        window.removeEventListener("orientationchange", onViewportChange);
        attached.delete(overlay);
      }
    });
    sync();
  }

  function detach(overlay) {
    var registration = attached.get(overlay);
    if (registration) registration.detach();
  }

  function handleMutations(records) {
    records.forEach(function (record) {
      for (var index = 0; index < record.addedNodes.length; index += 1) {
        visit(record.addedNodes[index], attach);
      }
      for (var removedIndex = 0; removedIndex < record.removedNodes.length; removedIndex += 1) {
        visit(record.removedNodes[removedIndex], detach);
      }
    });
  }

  /* این فایل پس از shared DOM observer بارگذاری می‌شود؛ observer بومی فقط پشتیبان تست/نسخه‌های قدیمی است. */
  if (window.__hesabnoDom && typeof window.__hesabnoDom.watch === "function") {
    window.__hesabnoDom.watch(document.body, { childList: true }, handleMutations);
  } else if (typeof MutationObserver === "function") {
    var observer = new MutationObserver(handleMutations);
    observer.observe(document.body, { childList: true });
  }

  visit(document.body, attach);
})();
