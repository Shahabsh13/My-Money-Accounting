/*
 * لایه ۲۳۷: اولویت دکمه‌ی «بک» گوشی.
 *
 * ترتیب درست:
 *   ۱) اگر کیبورد داخلی مبلغ باز است → فقط همان بسته شود.
 *   ۲) اگر انتخابگر/پنجره‌ی رویی (انتخاب حساب، دیالوگ، لایه‌ی تمام‌صفحه) باز است → فقط همان بسته شود.
 *   ۳) در غیر این صورت → همان ناوبری قبلی (بازگشت به لیست/تب یا خروج).
 *
 * پیش از این، __hesabnoNavigateBack بلافاصله دکمه‌ی «بازگشت» صفحه‌ی زیرین را می‌زد؛
 * پس در انتخاب حسابِ فرم وام، کاربر به‌جای بستن انتخابگر، از کل فرم بیرون می‌رفت
 * (به تب «بیشتر»). این لایه بدون تغییر کد اصلی، تابع موجود را می‌پیچد.
 */
(function () {
  "use strict";

  var KEYPAD_ID = "hesabno-amount-keyboard";
  var KEYPAD_BACKDROP_ID = KEYPAD_ID + "-backdrop";
  /* لایه‌ها به ترتیب اولویت؛ همه از تولید همین برنامه‌اند. */
  var LAYER_SELECTORS = [
    ".hesabno-fullscreen-selector-overlay",
    ".hesabno-account-picker-overlay",
    ".hesabno-fullscreen-picker-overlay",
    ".hesabno-account-statement-panel",
    '[role="dialog"][aria-modal="true"]',
    ".hesabno-fullpage-layer",
    '[data-hesabno-settlement-datepicker="true"]',
    '[data-hesabno-return-date-picker="true"]',
    '[data-hesabno-transaction-datepicker="true"]'
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

  function isTargetDatePicker(el) {
    return el && (
      el.hasAttribute("data-hesabno-settlement-datepicker") ||
      el.hasAttribute("data-hesabno-return-date-picker") ||
      el.hasAttribute("data-hesabno-transaction-datepicker")
    );
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
    /* هر سه تقویم دکمهٔ بستن اختصاصی دارند؛ فقط دکمهٔ متعلق به همین لایه را بزن. */
    var datePickerClose = layer.querySelector(
      "[data-hesabno-date-picker-close=\"true\"], [data-hesabno-settlement-datepicker-close], [data-return-date-close]"
    );
    if (datePickerClose && isVisible(datePickerClose)) return datePickerClose;
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
    /* فقط وقتی یکی از تقویم‌های هدف باز است، نامزدها را به ترتیب واقعی DOM مرتب کن. */
    if (layers.some(isTargetDatePicker)) {
      layers.sort(function (left, right) {
        if (typeof left.compareDocumentPosition !== "function") return 0;
        var position = left.compareDocumentPosition(right);
        if (position & 4) return -1;
        if (position & 2) return 1;
        return 0;
      });
    }
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
