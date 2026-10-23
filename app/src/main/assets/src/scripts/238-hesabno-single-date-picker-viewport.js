/*
 * هم‌ترازی و بستن انتخابگرهای تک‌تاریخی.
 * فقط تقویم‌های تک‌تاریخیِ دارای marker هدف‌اند؛ Date Range Picker و صفحه‌کلید مبلغ خارج از محدوده‌اند.
 */
(function () {
  "use strict";

  var PICKER_SELECTOR = [
    '[data-hesabno-transaction-datepicker="true"]',
    '[data-hesabno-settlement-datepicker="true"]',
    '[data-hesabno-return-date-picker="true"]'
  ].join(",");
  var attached = new WeakMap();
  var closing = new WeakSet();
  var CLOSE_DURATION = 260;

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

  function viewportHeight() {
    var viewport = window.visualViewport;
    var height = viewport && Number(viewport.height) > 0
      ? Number(viewport.height)
      : Number(window.innerHeight) || Number(document.documentElement.clientHeight);
    return Math.max(0, Math.round(height));
  }

  function attach(overlay) {
    if (attached.has(overlay)) return;

    var viewport = window.visualViewport;
    var sheet = sheetFor(overlay);
    if (sheet && sheet.classList) {
      /* فقط یک انیمیشن ورود؛ انیمیشن عمومی ۱۲px نباید با آن هم‌زمان شود. */
      sheet.classList.remove("hesabno-dialog-motion");
      sheet.classList.add("hesabno-single-date-sheet");
    }

    var registration = { closing: false, detach: null };
    function sync() {
      if (!overlay.isConnected || registration.closing) return;

      /*
       * فقط overlayهای دارای marker تک‌تاریخ را مثل صفحه‌کلید داخلی به پایین می‌چسبانیم.
       * important تضمین می‌کند قوانین عمومی dialog/fixed در WebView جای شیت را عوض نکنند.
       * offsetTop را به مختصات fixed اضافه نمی‌کنیم؛ inset:0 مرجع موقعیت است.
       */
      if (overlay.style && typeof overlay.style.setProperty === "function") {
        overlay.style.setProperty("position", "fixed", "important");
        overlay.style.setProperty("top", "0px", "important");
        overlay.style.setProperty("right", "0px", "important");
        overlay.style.setProperty("bottom", "0px", "important");
        overlay.style.setProperty("left", "0px", "important");
        overlay.style.setProperty("display", "flex", "important");
        overlay.style.setProperty("align-items", "flex-end", "important");
        overlay.style.setProperty("justify-content", "center", "important");
        overlay.style.setProperty("padding", "0px", "important");
        overlay.style.setProperty("backdrop-filter", "blur(16px) saturate(120%)", "important");
        overlay.style.setProperty("-webkit-backdrop-filter", "blur(16px) saturate(120%)", "important");
      }

      var height = viewportHeight();
      if (!height || !sheet || !sheet.isConnected) return;

      /* visualViewport فقط حدّ ارتفاع محتوای شیت را به‌روز می‌کند. */
      var maxHeight = Math.max(1, Math.floor(height * 0.86)) + "px";
      if (sheet.style.maxHeight !== maxHeight) sheet.style.maxHeight = maxHeight;
    }

    function onViewportResize() { sync(); }
    if (viewport && typeof viewport.addEventListener === "function") {
      viewport.addEventListener("resize", onViewportResize);
    }
    window.addEventListener("resize", onViewportResize);
    window.addEventListener("orientationchange", onViewportResize);
    registration.detach = function () {
      if (viewport && typeof viewport.removeEventListener === "function") {
        viewport.removeEventListener("resize", onViewportResize);
      }
      window.removeEventListener("resize", onViewportResize);
      window.removeEventListener("orientationchange", onViewportResize);
      attached.delete(overlay);
    };
    attached.set(overlay, registration);
    sync();
  }

  function detach(overlay) {
    var registration = attached.get(overlay);
    if (registration && registration.detach) registration.detach();
  }

  function requestFrame(callback) {
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(callback);
    else window.setTimeout(callback, 16);
  }

  /* Nk (تقویم مشترک تراکنش/وام/قسط) همه‌ی مسیرهای بستن را از onClose عبور می‌دهد. */
  window.__hesabnoWrapSingleDatePickerClose = function (onClose) {
    if (typeof onClose !== "function") return onClose;
    return function () {
      var overlay = document.getElementById("persian-datepicker-backdrop");
      var sheet = overlay && overlay.querySelector("#persian-datepicker-sheet");
      if (!overlay || !sheet || !overlay.isConnected || !sheet.isConnected) {
        return onClose.apply(this, arguments);
      }
      if (closing.has(overlay)) return;

      closing.add(overlay);
      var registration = attached.get(overlay);
      if (registration) registration.closing = true;

      var computed = typeof window.getComputedStyle === "function" ? window.getComputedStyle(sheet) : null;
      var currentTransform = computed && computed.transform && computed.transform !== "none"
        ? computed.transform
        : "translate3d(0, 0, 0)";
      var currentOpacity = computed && computed.opacity ? computed.opacity : "1";
      sheet.style.animation = "none";
      sheet.style.transition = "none";
      sheet.style.transform = currentTransform;
      sheet.style.opacity = currentOpacity;
      /* تثبیت فریم فعلی پیش از transition؛ ابعاد و مختصات overlay در حین خروج ثابت می‌مانند. */
      void sheet.offsetHeight;
      sheet.classList.add("hesabno-single-date-sheet-closing");

      var finished = false;
      var timer = null;
      function finish() {
        if (finished) return;
        finished = true;
        if (timer !== null) window.clearTimeout(timer);
        sheet.removeEventListener("transitionend", onTransitionEnd);
        if (overlay.isConnected) onClose.apply(this, arguments);
      }
      function onTransitionEnd(event) {
        if (event.target === sheet && event.propertyName === "transform") finish.call(this);
      }
      sheet.addEventListener("transitionend", onTransitionEnd);
      timer = window.setTimeout(finish, CLOSE_DURATION + 80);

      requestFrame(function () {
        if (!overlay.isConnected) return finish();
        sheet.style.transition = "transform " + CLOSE_DURATION + "ms cubic-bezier(0.4, 0, 0.2, 1), opacity " + CLOSE_DURATION + "ms ease-out";
        void sheet.offsetHeight;
        requestFrame(function () {
          if (!overlay.isConnected) return finish();
          sheet.style.transform = "translate3d(0, 100%, 0)";
          sheet.style.opacity = "0";
        });
      });
    };
  };

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

  /* این فایل پس از shared DOM observer بارگذاری می‌شود؛ observer بومی فقط پشتیبان نسخه‌های قدیمی است. */
  if (window.__hesabnoDom && typeof window.__hesabnoDom.watch === "function") {
    window.__hesabnoDom.watch(document.body, { childList: true }, handleMutations);
  } else if (typeof MutationObserver === "function") {
    var observer = new MutationObserver(handleMutations);
    observer.observe(document.body, { childList: true });
  }

  visit(document.body, attach);
})();
