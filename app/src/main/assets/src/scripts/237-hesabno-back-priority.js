/*
 * لایه ۲۳۷: اولویت دکمه‌ی «بک» گوشی.
 *
 * ترتیب درست:
 *   ۱) اگر کیبورد داخلی مبلغ باز است → فقط همان بسته شود.
 *   ۲) اگر تقویم تاریخ باز است → Back مصرف شود؛ تقویم فقط با تأیید یا × بسته شود.
 *   ۳) اگر انتخابگر/پنجره‌ی رویی (انتخاب حساب، دیالوگ، لایه‌ی تمام‌صفحه) باز است → فقط همان بسته شود.
 *   ۴) در غیر این صورت → همان ناوبری قبلی (بازگشت به لیست/تب یا خروج).
 *
 * پیش از این، __hesabnoNavigateBack بلافاصله دکمه‌ی «بازگشت» صفحه‌ی زیرین را می‌زد؛
 * پس در انتخاب حسابِ فرم وام، کاربر به‌جای بستن انتخابگر، از کل فرم بیرون می‌رفت
 * (به تب «بیشتر»). این لایه بدون تغییر کد اصلی، تابع موجود را می‌پیچد.
 */
(function () {
  "use strict";

  /* قفل برنامه یک modal واقعی است: کنترل‌های زیرین نباید با فوکوس/کیبورد/کلیک قابل دسترسی بمانند. */
  var lockRoot = null;
  var lockRootHadInert = false;
  var lockRootAriaHidden = null;
  function activeAppLock() {
    return document.querySelector('[data-hesabno-app-lock="true"]');
  }
  function firstLockControl(lock) {
    return lock && lock.querySelector('button:not([disabled]),[tabindex="0"]');
  }
  function focusLock(lock) {
    var control = firstLockControl(lock);
    if (control && typeof control.focus === "function") control.focus();
  }
  function syncAppLockBarrier() {
    var lock = activeAppLock();
    var root = document.getElementById("root");
    if (lock && root) {
      if (lockRoot !== root) {
        releaseAppLockBarrier();
        lockRoot = root;
        lockRootHadInert = root.hasAttribute("inert");
        lockRootAriaHidden = root.getAttribute("aria-hidden");
      }
      root.setAttribute("inert", "");
      root.setAttribute("aria-hidden", "true");
      lock.setAttribute("role", "dialog");
      lock.setAttribute("aria-modal", "true");
      lock.setAttribute("aria-label", "قفل امنیتی برنامه");
      if (!lock.contains(document.activeElement)) focusLock(lock);
      return;
    }
    releaseAppLockBarrier();
  }
  function releaseAppLockBarrier() {
    if (!lockRoot) return;
    if (lockRootHadInert) lockRoot.setAttribute("inert", "");
    else lockRoot.removeAttribute("inert");
    if (lockRootAriaHidden == null) lockRoot.removeAttribute("aria-hidden");
    else lockRoot.setAttribute("aria-hidden", lockRootAriaHidden);
    lockRoot = null;
    lockRootHadInert = false;
    lockRootAriaHidden = null;
  }
  function blockOutsideLock(event) {
    var lock = activeAppLock();
    if (!lock || lock.contains(event.target)) return;
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === "focusin") focusLock(lock);
  }
  ["click", "pointerdown", "touchstart", "submit", "contextmenu", "focusin"].forEach(function (type) {
    document.addEventListener(type, blockOutsideLock, true);
  });
  document.addEventListener("keydown", function (event) {
    var lock = activeAppLock();
    if (!lock) return;
    var target = event.target;
    if (!lock.contains(target) || event.key === "Escape" || event.key === "BrowserBack" || event.key === "GoBack" ||
        event.key === "Backspace" || event.altKey && event.key === "ArrowLeft") {
      if (event.cancelable) event.preventDefault();
      event.stopImmediatePropagation();
      if (!lock.contains(target)) focusLock(lock);
      return;
    }
    if (event.key === "Tab") {
      var controls = lock.querySelectorAll('button:not([disabled]),[tabindex="0"]');
      if (!controls.length) { event.preventDefault(); return; }
      var first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (target === first || !lock.contains(target))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (target === last || !lock.contains(target))) {
        event.preventDefault(); first.focus();
      }
    }
  }, true);
  if (document.body && window.__hesabnoDom && typeof window.__hesabnoDom.watch === "function") {
    window.__hesabnoDom.watch(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-hesabno-app-lock"],
    }, syncAppLockBarrier);
  }
  syncAppLockBarrier();

  var KEYPAD_ID = "hesabno-amount-keyboard";
  var KEYPAD_BACKDROP_ID = KEYPAD_ID + "-backdrop";
  var DATE_PICKER_SELECTOR = "#persian-datepicker-backdrop,[data-hesabno-settlement-datepicker],[data-hesabno-return-date-picker]";
  /* لایه‌ها به ترتیب اولویت؛ همه از تولید همین برنامه‌اند. */
  var LAYER_SELECTORS = [
    ".hesabno-fullscreen-selector-overlay",
    ".hesabno-account-picker-overlay",
    ".hesabno-fullscreen-picker-overlay",
    ".hesabno-account-statement-panel",
    '[role="dialog"][aria-modal="true"]',
    ".hesabno-fullpage-layer"
  ];
  var GHOST_CLASSES = ["hesabno-fullpage-ghost", "hesabno-overlay-ghost", "hesabno-toast-ghost"];
  var CLOSE_LABELS = ["بستن", "بازگشت", "انصراف"];

  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function isGhost(el) {
    for (var i = 0; i < GHOST_CLASSES.length; i += 1) {
      if (el.classList && el.classList.contains(GHOST_CLASSES[i])) return true;
    }
    return false;
  }

  function isKeypadPart(el) {
    if (!el || !el.id) return false;
    return el.id === KEYPAD_ID || el.id === KEYPAD_BACKDROP_ID || el.id.indexOf(KEYPAD_ID) === 0;
  }

  /* مرئی‌بودن را طوری می‌سنجیم که در jsdom (بدون layout) هم درست جواب بدهد. */
  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
    if (el.classList && el.classList.contains("hidden")) return false;
    var rects = el.getClientRects ? el.getClientRects() : null;
    if (rects && rects.length) return true;
    var style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    return true;
  }

  function closeButtonIn(layer) {
    if (!layer || !layer.querySelectorAll) return null;
    var i;
    /* اول دکمه‌های هدر با برچسب دسترس‌پذیری روشن */
    var header = layer.querySelector("header");
    var scopes = header ? [header, layer] : [layer];
    for (var s = 0; s < scopes.length; s += 1) {
      var scope = scopes[s];
      for (i = 0; i < CLOSE_LABELS.length; i += 1) {
        var byLabel = scope.querySelector('button[aria-label="' + CLOSE_LABELS[i] + '"]');
        if (byLabel && isVisible(byLabel)) return byLabel;
      }
      for (i = 0; i < CLOSE_LABELS.length; i += 1) {
        var byTitle = scope.querySelector('button[title="' + CLOSE_LABELS[i] + '"]');
        if (byTitle && isVisible(byTitle)) return byTitle;
      }
    }
    /* در آخر: دکمه‌ای که متنش دقیقاً یکی از برچسب‌های بستن است */
    var buttons = layer.querySelectorAll("button");
    for (i = buttons.length - 1; i >= 0; i -= 1) {
      if (!isVisible(buttons[i])) continue;
      if (CLOSE_LABELS.indexOf(clean(buttons[i].textContent)) !== -1) return buttons[i];
    }
    return null;
  }

  function closeDatePickerForBack() {
    var picker = document.querySelector(DATE_PICKER_SELECTOR);
    if (!picker) return false;
    var closeButton = picker.querySelector("#datepicker-close-button,[data-hesabno-settlement-close],[data-return-date-close]");
    if (closeButton) closeButton.click();
    return true;
  }

  function layerCandidates() {
    var seen = [];
    LAYER_SELECTORS.forEach(function (selector) {
      var nodes = document.querySelectorAll(selector);
      for (var i = 0; i < nodes.length; i += 1) {
        var el = nodes[i];
        if (seen.indexOf(el) !== -1) continue;
        seen.push(el);
      }
    });
    return seen;
  }

  /* بالاترین لایه‌ی باز و قابل بستن را می‌بندد. true = چیزی بسته شد. */
  function closeTopLayer() {
    var layers = layerCandidates().filter(function (el) {
      if (isGhost(el) || isKeypadPart(el)) return false;
      if (!isVisible(el)) return false;
      /* خود پرده‌ی کیبورد مبلغ جزو لایه‌ها نیست */
      if (el.id === KEYPAD_BACKDROP_ID) return false;
      return true;
    });
    if (!layers.length) return false;
    /* آخرین لایه در DOM، رویی‌ترین لایه‌ی رندر‌شده است. */
    for (var i = layers.length - 1; i >= 0; i -= 1) {
      var button = closeButtonIn(layers[i]);
      if (!button) continue;
      button.click();
      return true;
    }
    return false;
  }

  window.__hesabnoCloseTopLayer = closeTopLayer;

  var originalNavigateBack = window.__hesabnoNavigateBack;

  window.__hesabnoNavigateBack = function () {
    /* ۱) کیبورد داخلی مبلغ */
    if (typeof window.__hesabnoCloseAmountKeyboard === "function" && window.__hesabnoCloseAmountKeyboard()) {
      return true;
    }
    /* Back همان ضربدر تقویم را فعال می‌کند؛ تاریخ موقت بدون تأیید کنار گذاشته می‌شود. */
    if (closeDatePickerForBack()) return true;
    /* ۲) انتخابگر حساب / دیالوگ / لایه‌ی رویی */
    if (closeTopLayer()) return true;
    /* ۳) ناوبری معمول */
    if (typeof originalNavigateBack === "function") {
      try {
        return originalNavigateBack.apply(this, arguments);
      } catch (error) {
        return false;
      }
    }
    return false;
  };
})();
