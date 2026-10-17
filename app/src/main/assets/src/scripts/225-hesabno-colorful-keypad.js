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

    // تزریق یک‌باره: اگر استایل از قبل هست، دوباره ساخته نمی‌شود. پیش‌تر هر اجرا
    // یک <style> تازه به <head> اضافه می‌کرد؛ همین تغییرِ DOM، observer را دوباره
    // بیدار می‌کرد و یک حلقه‌ی هر-فریمی می‌ساخت (مصرف CPU و هنگ‌کردن تست‌ها).
    var existingStyle = document.getElementById(STYLE_ID);
    var style = existingStyle || null;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
      /* ========================================================= */
      /* حساب‌نو: صفحه‌کلید عددی فشرده متناسب با حالت شب و روز       */
      /* ========================================================= */
      #${PANEL_ID} {
        padding: 6px 10px calc(4px + env(safe-area-inset-bottom, 0px)) !important;
        transition: background-color .22s ease, border-color .22s ease, box-shadow .22s ease;
      }
      #${PANEL_ID} .hkap-shell {
        max-width: 440px !important;
        margin: 0 auto;
      }
      #${PANEL_ID} .hkap-top {
        gap: 8px;
        align-items: stretch;
      }
      #${PANEL_ID} .hkap-display {
        min-height: 52px;
        border-radius: 14px;
        padding: 6px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        box-sizing: border-box;
        transition: background-color .22s ease, border-color .22s ease;
      }
      #${PANEL_ID} .hkap-label {
        display: none !important;
      }
      #${PANEL_ID} .hkap-value {
        margin: 0;
        font-size: 24px;
        font-weight: 800;
        letter-spacing: -0.5px;
        direction: ltr;
        text-align: right;
        line-height: 1.2;
      }
      #${PANEL_ID} .hkap-currency {
        font-size: 12px;
        font-weight: 700;
        padding-inline-start: 10px;
        border-inline-start: 1px solid rgba(148, 163, 184, 0.25);
        white-space: nowrap;
      }
      #${PANEL_ID} .hkap-close {
        flex: 0 0 48px;
        width: 48px;
        min-height: 52px;
        border-radius: 14px;
        font-size: 24px;
        font-weight: 500;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform .12s ease, background-color .15s ease;
      }
      #${PANEL_ID} .hkap-close:active {
        transform: scale(0.94);
      }

      #${PANEL_ID} .hkap-key-grid {
        direction: ltr;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
        margin-top: 6px;
      }
      #${PANEL_ID} .hkap-key-grid button {
        min-height: 48px;
        border-radius: 13px;
        font-size: 21px;
        font-weight: 700;
        border: 1px solid transparent;
        transition: transform .1s ease, filter .1s ease, background-color .15s ease;
        cursor: pointer;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #${PANEL_ID} .hkap-key-grid button:active {
        transform: scale(0.95);
      }
      #${PANEL_ID} .hkap-hint {
        display: none !important;
      }

      /* --------------------------------------------------------- */
      /* حالت شب (Dark Mode)                                       */
      /* --------------------------------------------------------- */
      #${PANEL_ID} {
        background: rgba(15, 23, 42, 0.96) !important;
        backdrop-filter: blur(24px) !important;
        -webkit-backdrop-filter: blur(24px) !important;
        border-top: 1px solid rgba(148, 163, 184, 0.18) !important;
        box-shadow: 0 -10px 32px rgba(0, 0, 0, 0.45) !important;
        color: #f8fafc !important;
      }
      #${PANEL_ID} .hkap-display {
        background: #090e17 !important;
        border: 1px solid rgba(148, 163, 184, 0.22) !important;
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3) !important;
      }
      #${PANEL_ID} .hkap-value {
        color: #f8fafc !important;
      }
      #${PANEL_ID} .hkap-currency {
        color: #34d399 !important;
        border-inline-start-color: rgba(52, 211, 153, 0.3) !important;
      }
      #${PANEL_ID} .hkap-close {
        background: rgba(244, 63, 94, 0.14) !important;
        border: 1px solid rgba(244, 63, 94, 0.28) !important;
        color: #fb7185 !important;
      }
      #${PANEL_ID} .hkap-close:active {
        background: rgba(244, 63, 94, 0.25) !important;
      }

      /* ارقام 0 تا 9 در شب */
      #${PANEL_ID} .hkap-key-grid [data-hkap-action="digit"]:not([data-value="00"]):not([data-value="000"]) {
        background: #1e293b !important;
        border-color: rgba(148, 163, 184, 0.18) !important;
        color: #f8fafc !important;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.25) !important;
      }
      #${PANEL_ID} .hkap-key-grid [data-hkap-action="digit"]:not([data-value="00"]):not([data-value="000"]):active {
        background: #2d3d54 !important;
      }

      /* صفرهای سریع در شب */
      #${PANEL_ID} .hkap-key-grid [data-value="00"],
      #${PANEL_ID} .hkap-key-grid [data-value="000"] {
        background: #182232 !important;
        border-color: rgba(148, 163, 184, 0.14) !important;
        color: #cbd5e1 !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
        font-size: 19px !important;
      }
      #${PANEL_ID} .hkap-key-grid [data-value="00"]:active,
      #${PANEL_ID} .hkap-key-grid [data-value="000"]:active {
        background: #223046 !important;
      }

      /* پاک کردن در شب */
      #${PANEL_ID} .hkap-key-grid [data-hkap-action="clear"] {
        background: rgba(245, 158, 11, 0.14) !important;
        border-color: rgba(245, 158, 11, 0.3) !important;
        color: #fbbf24 !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
      }
      #${PANEL_ID} .hkap-key-grid [data-hkap-action="clear"]:active {
        background: rgba(245, 158, 11, 0.26) !important;
      }

      /* بک‌اسپیس در شب */
      #${PANEL_ID} .hkap-key-grid [data-hkap-action="backspace"] {
        background: rgba(244, 63, 94, 0.14) !important;
        border-color: rgba(244, 63, 94, 0.3) !important;
        color: #fb7185 !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
      }
      #${PANEL_ID} .hkap-key-grid [data-hkap-action="backspace"]:active {
        background: rgba(244, 63, 94, 0.26) !important;
      }

      /* تایید در شب */
      #${PANEL_ID} .hkap-confirm {
        grid-column: span 2;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
        border-color: #34d399 !important;
        color: #ffffff !important;
        font-size: 16px !important;
        font-weight: 800 !important;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.32) !important;
      }
      #${PANEL_ID} .hkap-confirm:active {
        filter: brightness(0.92);
      }

      /* --------------------------------------------------------- */
      /* حالت روز (Light Mode)                                     */
      /* --------------------------------------------------------- */
      html[data-theme="light"] #${PANEL_ID},
      html.theme-light #${PANEL_ID},
      [data-theme="light"] #${PANEL_ID},
      body.theme-light #${PANEL_ID} {
        background: rgba(248, 250, 252, 0.98) !important;
        backdrop-filter: blur(24px) !important;
        -webkit-backdrop-filter: blur(24px) !important;
        border-top: 1px solid #cbd5e1 !important;
        box-shadow: 0 -10px 30px rgba(15, 23, 42, 0.08) !important;
        color: #0f172a !important;
      }

      html[data-theme="light"] #${PANEL_ID} .hkap-display,
      html.theme-light #${PANEL_ID} .hkap-display,
      [data-theme="light"] #${PANEL_ID} .hkap-display {
        background: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
        box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.04) !important;
      }

      html[data-theme="light"] #${PANEL_ID} .hkap-value,
      html.theme-light #${PANEL_ID} .hkap-value,
      [data-theme="light"] #${PANEL_ID} .hkap-value {
        color: #0f172a !important;
      }

      html[data-theme="light"] #${PANEL_ID} .hkap-currency,
      html.theme-light #${PANEL_ID} .hkap-currency,
      [data-theme="light"] #${PANEL_ID} .hkap-currency {
        color: #059669 !important;
        border-inline-start-color: rgba(5, 150, 105, 0.3) !important;
      }

      html[data-theme="light"] #${PANEL_ID} .hkap-close,
      html.theme-light #${PANEL_ID} .hkap-close,
      [data-theme="light"] #${PANEL_ID} .hkap-close {
        background: #fee2e2 !important;
        border: 1px solid #fca5a5 !important;
        color: #dc2626 !important;
      }
      html[data-theme="light"] #${PANEL_ID} .hkap-close:active,
      html.theme-light #${PANEL_ID} .hkap-close:active {
        background: #fecaca !important;
      }

      html[data-theme="light"] #${PANEL_ID} .hkap-key-grid [data-hkap-action="digit"]:not([data-value="00"]):not([data-value="000"]),
      html.theme-light #${PANEL_ID} .hkap-key-grid [data-hkap-action="digit"]:not([data-value="00"]):not([data-value="000"]),
      [data-theme="light"] #${PANEL_ID} .hkap-key-grid [data-hkap-action="digit"]:not([data-value="00"]):not([data-value="000"]) {
        background: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
        color: #0f172a !important;
        box-shadow: 0 2px 4px rgba(15, 23, 42, 0.05) !important;
      }
      html[data-theme="light"] #${PANEL_ID} .hkap-key-grid [data-hkap-action="digit"]:not([data-value="00"]):not([data-value="000"]):active,
      html.theme-light #${PANEL_ID} .hkap-key-grid [data-hkap-action="digit"]:not([data-value="00"]):not([data-value="000"]):active {
        background: #f1f5f9 !important;
        border-color: #94a3b8 !important;
      }

      html[data-theme="light"] #${PANEL_ID} .hkap-key-grid [data-value="00"],
      html[data-theme="light"] #${PANEL_ID} .hkap-key-grid [data-value="000"],
      html.theme-light #${PANEL_ID} .hkap-key-grid [data-value="00"],
      html.theme-light #${PANEL_ID} .hkap-key-grid [data-value="000"],
      [data-theme="light"] #${PANEL_ID} .hkap-key-grid [data-value="00"],
      [data-theme="light"] #${PANEL_ID} .hkap-key-grid [data-value="000"] {
        background: #f1f5f9 !important;
        border: 1px solid #cbd5e1 !important;
        color: #334155 !important;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04) !important;
      }
      html[data-theme="light"] #${PANEL_ID} .hkap-key-grid [data-value="00"]:active,
      html[data-theme="light"] #${PANEL_ID} .hkap-key-grid [data-value="000"]:active,
      html.theme-light #${PANEL_ID} .hkap-key-grid [data-value="00"]:active,
      html.theme-light #${PANEL_ID} .hkap-key-grid [data-value="000"]:active {
        background: #e2e8f0 !important;
      }

      html[data-theme="light"] #${PANEL_ID} .hkap-key-grid [data-hkap-action="clear"],
      html.theme-light #${PANEL_ID} .hkap-key-grid [data-hkap-action="clear"],
      [data-theme="light"] #${PANEL_ID} .hkap-key-grid [data-hkap-action="clear"] {
        background: #fef3c7 !important;
        border: 1px solid #fde68a !important;
        color: #b45309 !important;
        box-shadow: 0 1px 3px rgba(245, 158, 11, 0.1) !important;
      }
      html[data-theme="light"] #${PANEL_ID} .hkap-key-grid [data-hkap-action="clear"]:active,
      html.theme-light #${PANEL_ID} .hkap-key-grid [data-hkap-action="clear"]:active {
        background: #fde68a !important;
      }

      html[data-theme="light"] #${PANEL_ID} .hkap-key-grid [data-hkap-action="backspace"],
      html.theme-light #${PANEL_ID} .hkap-key-grid [data-hkap-action="backspace"],
      [data-theme="light"] #${PANEL_ID} .hkap-key-grid [data-hkap-action="backspace"] {
        background: #ffe4e6 !important;
        border: 1px solid #fecdd3 !important;
        color: #e11d48 !important;
        box-shadow: 0 1px 3px rgba(225, 29, 72, 0.1) !important;
      }
      html[data-theme="light"] #${PANEL_ID} .hkap-key-grid [data-hkap-action="backspace"]:active,
      html.theme-light #${PANEL_ID} .hkap-key-grid [data-hkap-action="backspace"]:active {
        background: #fecdd3 !important;
      }

      html[data-theme="light"] #${PANEL_ID} .hkap-confirm,
      html.theme-light #${PANEL_ID} .hkap-confirm,
      [data-theme="light"] #${PANEL_ID} .hkap-confirm {
        background: linear-gradient(135deg, #10b981 0%, #047857 100%) !important;
        border: 1px solid #059669 !important;
        color: #ffffff !important;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.28) !important;
      }

      @media (max-height: 680px) {
        #${PANEL_ID} .hkap-key-grid {
          gap: 5px;
          margin-top: 5px;
        }
        #${PANEL_ID} .hkap-key-grid button {
          min-height: 40px;
          border-radius: 11px;
          font-size: 18px;
        }
        #${PANEL_ID} .hkap-display,
        #${PANEL_ID} .hkap-close {
          min-height: 46px;
        }
        #${PANEL_ID} .hkap-value {
          font-size: 20px;
        }
      }
    `;
      document.head.appendChild(style);
    }

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