(function () {
  "use strict";
  var PANEL_ID = "hesabno-amount-keyboard";
  var STYLE_ID = PANEL_ID + "-theme-adaptive-style";

  function dismissNativeKeyboard() {
    try {
      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }
      var focused = document.querySelectorAll("input:focus, textarea:focus");
      for (var i = 0; i < focused.length; i++) {
        try { focused[i].blur(); } catch (err) {}
      }
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }
      if (window.navigator && window.navigator.virtualKeyboard && typeof window.navigator.virtualKeyboard.hide === "function") {
        window.navigator.virtualKeyboard.hide();
      }
    } catch (e) {}
  }

  function install() {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return false;

    // Remove hint text underneath keyboard if present in DOM
    var hint = panel.querySelector(".hkap-hint");
    if (hint && hint.parentNode) {
      hint.parentNode.removeChild(hint);
    }

    // Remove legacy colorful style tag if present
    var oldStyle = document.getElementById(PANEL_ID + "-colorful-style");
    if (oldStyle && oldStyle.parentNode) {
      oldStyle.parentNode.removeChild(oldStyle);
    }

    /* ظاهر صفحه‌کلید عددی (تاریک و روشن) و متغیرهای --hesabno-keypad-* به بستهٔ ۲۳۵ منتقل شد. */

    var grid = panel.querySelector(".hkap-key-grid");
    if (grid && grid.getAttribute("data-hkap-redesign") !== "true") {
      grid.innerHTML = `
        <button type="button" class="hkap-utility" data-hkap-action="backspace" aria-label="حذف یک رقم" title="حذف">⌫</button>
        <button type="button" data-hkap-action="digit" data-value="1" aria-label="۱">۱</button>
        <button type="button" data-hkap-action="digit" data-value="2" aria-label="۲">۲</button>
        <button type="button" data-hkap-action="digit" data-value="3" aria-label="۳">۳</button>
        <button type="button" class="hkap-utility" data-hkap-action="clear" aria-label="پاک‌کردن مبلغ" dir="ltr">C</button>
        <button type="button" data-hkap-action="digit" data-value="4" aria-label="۴">۴</button>
        <button type="button" data-hkap-action="digit" data-value="5" aria-label="۵">۵</button>
        <button type="button" data-hkap-action="digit" data-value="6" aria-label="۶">۶</button>
        <button type="button" class="hkap-utility" data-hkap-action="digit" data-value="000">۰۰۰</button>
        <button type="button" data-hkap-action="digit" data-value="7" aria-label="۷">۷</button>
        <button type="button" data-hkap-action="digit" data-value="8" aria-label="۸">۸</button>
        <button type="button" data-hkap-action="digit" data-value="9" aria-label="۹">۹</button>
        <button type="button" class="hkap-utility" data-hkap-action="digit" data-value="00">۰۰</button>
        <button type="button" data-hkap-action="digit" data-value="0" aria-label="۰">۰</button>
        <button type="button" class="hkap-confirm" data-hkap-action="confirm">تأیید</button>`;
      grid.setAttribute("data-hkap-redesign", "true");
    }

    var close = panel.querySelector(".hkap-close");
    if (close) {
      if (close.textContent !== "×") close.textContent = "×";
      if (close.getAttribute("aria-label") !== "بستن صفحه‌کلید") {
        close.setAttribute("aria-label", "بستن صفحه‌کلید");
      }
    }
    return true;
  }

  function start() {
    install();
    var queued = false;
    // در زمان اجرای install خودمان را قطع می‌کنیم تا تغییرات DOM ما observer را
    // دوباره صف نکند (لایه‌ی دوم محافظت بعد از یک‌باره‌کردن تزریق استایل).
    var observer = new MutationObserver(function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        observer.disconnect();
        try { install(); } finally {
          observer.observe(document.documentElement, { childList: true, subtree: true });
        }
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Global listener to dismiss native keyboard on any interaction with money inputs or keypad
    function onTouchOrPointer(e) {
      var target = e.target;
      if (!target) return;
      var panel = document.getElementById(PANEL_ID);
      if (panel && panel.contains(target)) {
        dismissNativeKeyboard();
        return;
      }
      var input = target.closest ? target.closest("input") : null;
      if (input) {
        var placeholder = input.getAttribute("placeholder") || "";
        var ariaLabel = input.getAttribute("aria-label") || "";
        var name = input.getAttribute("name") || "";
        var id = input.id || "";
        // فقط نشانه‌های خودِ فیلد یا علامت کیبورد مبلغ (اسکریپت ۲۱۴)؛ متن ظرفِ والد
        // باعث می‌شد هر فیلد داخل کارتی که کلمه‌ی «مبلغ» دارد قفل شود.
        var isMoney = input.getAttribute("data-hesabno-amount-keyboard-field") === "true" ||
                      /مانده|موجودی|مبلغ|قیمت|قسط|وام|افتتاحیه|تنخواه|تومان|ریال|amount|balance/i.test(placeholder + " " + ariaLabel + " " + name + " " + id);
        var isExcluded = /شماره.?کارت|شماره.?حساب|شبا|iban|نام.?حساب|کد.?ملی|تلفن/i.test(placeholder + " " + ariaLabel);
        if (isMoney && !isExcluded) {
          if (input.readOnly !== true) input.readOnly = true;
          if (input.getAttribute("readonly") !== "readonly") input.setAttribute("readonly", "readonly");
          if (input.getAttribute("inputmode") !== "none") input.setAttribute("inputmode", "none");
          try { input.blur(); } catch (err) {}
          dismissNativeKeyboard();
        }
      }
    }

    document.addEventListener("touchstart", onTouchOrPointer, { capture: true, passive: false });
    document.addEventListener("pointerdown", onTouchOrPointer, { capture: true });
    document.addEventListener("mousedown", onTouchOrPointer, { capture: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();