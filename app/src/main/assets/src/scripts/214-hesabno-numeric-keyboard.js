(function () {
  // A built-in amount keypad for money inputs; non-money numeric fields keep the system keypad.
  var PANEL_ID = "hesabno-amount-keyboard";
  var BACKDROP_ID = PANEL_ID + "-backdrop";
  var FIELD_MARK = "data-hesabno-amount-keyboard-field";
  var UI_MARK = "data-hesabno-amount-keyboard-ui";
  var MONEY_HINTS = /مبلغ|مانده|موجودی|قیمت|کارمزد|سود|قسط|وام|افتتاحیه|تنخواه|تومان|ریال|amount|balance|price|fee|installment|principal|opening.?balance|بودجه|سقف|طلب|بدهی|budget|debt|بازپرداخت|سرمایه|بدهکار|بستانکار|repayment|capital/i;
  var NUMERIC_HINTS = /مبلغ|شماره|کارت|شبا|iban|مانده|موجودی|تعداد|درصد|رقم|سقف|قیمت|کد|روز|ماه|سال|تاریخ|زمان|ساعت|عدد|نرخ|سود|کارمزد|تومان|ریال|amount|number|price|card|account/i;
  var EXCLUDE_NON_MONEY = /شماره.?کارت|شماره.?حساب|شبا|iban|کد.?ملی|تلفن|موبایل|رمز.?عبور|(?:^|\s)رمز(?:\s|$)|password|تاریخ|ساعت|زمان|search|جستجو|نام.?حساب|عنوان/i;
  var NON_AMOUNT_HINTS = /تعداد|درصد|نرخ|مدت|شماره|count|percent|rate|duration|loan.?name|loan.?title|installment.?number/i;
  /* فیلدهای متنی آزاد: هرگز نباید فقط به‌خاطر واژه‌ای مثل «شماره پیگیری» در placeholder
     یا «وام» در برچسب، کیبورد عددی یا کیبورد مبلغ بگیرند. */
  var FREE_TEXT_HINTS = /نام|عنوان|توضیح|یادداشت|شرح|آدرس|ایمیل|فروشگاه|ارائه.?دهنده|طرف.?حساب|ضامن|پیگیری|کالا|دسته|دلیل|بابت|note|memo|title|description|name/i;
  var INFERRED_INPUTMODE = "data-hesabno-numkb-inferred";
  var SKIP_TYPES = ["checkbox", "radio", "file", "range", "color", "hidden", "submit", "button", "reset", "password", "email", "search"];
  var activeInput = null;
  var panel = null;
  var backdrop = null;
  var draft = "";
  var draftTouched = false;
  var valueDisplay = null;
  var currencyDisplay = null;
  var applyQueued = false;
  var pendingOutsideClick = null;
  var MAX_DIGITS = 15;

  function clean(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function toAscii(value) { return String(value == null ? "" : value).replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); }).replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); }); }
  function toPersian(value) { return String(value).replace(/[0-9]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]; }); }

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

  function inputHints(input) {
    if (!input) return "";
    var parts = [
      input.getAttribute("placeholder") || "",
      input.getAttribute("aria-label") || "",
      input.getAttribute("data-hesabno-inferred-label") || "",
      input.getAttribute("name") || "",
      input.id || "",
      input.className || ""
    ];
    try {
      if (input.labels) {
        Array.prototype.forEach.call(input.labels, function (label) { parts.push(label.textContent || ""); });
      }
    } catch (error) {}
    var labelledBy = input.getAttribute("aria-labelledby");
    if (labelledBy) {
      labelledBy.split(/\s+/).forEach(function (id) {
        var label = document.getElementById(id);
        if (label) parts.push(label.textContent || "");
      });
    }
    // فقط نشانه‌های مربوط به خودِ همین فیلد خوانده می‌شود. متن خواهر/برادرها و
    // ظرفِ والد تنها وقتی استفاده می‌شود که فیلد دیگری داخلشان نباشد؛ وگرنه برچسب
    // فیلد همسایه به این فیلد نسبت داده می‌شد و فیلدهای عادی هم «مبلغ» می‌شدند.
    function hasOtherControl(el, self) {
      try {
        if (!el || !el.querySelectorAll) return true;
        var controls = el.querySelectorAll("input, textarea, select");
        for (var i = 0; i < controls.length; i += 1) {
          if (controls[i] !== self) return true; // فیلد دیگری هم داخلش هست → متنش مال این فیلد نیست
        }
        return false;
      } catch (e) { return true; }
    }
    var prev = input.previousElementSibling;
    if (prev && /LABEL|DIV|SPAN|P|STRONG/i.test(prev.tagName) && !hasOtherControl(prev, input)) parts.push(prev.textContent || "");
    var parent = input.parentElement;
    if (parent && parent !== document.body && !hasOtherControl(parent, input)) parts.push(parent.textContent || "");
    return parts.map(clean).join(" ");
  }

  function isMoneyInput(input) {
    if (!input || input.tagName !== "INPUT" || input.disabled) return false;
    if (input.closest && input.closest("[data-hesabno-amount-keyboard-ui='true']")) return false;
    // Explicit text fields (e.g. loan/installment names) must not match money hints.
    if (input.getAttribute(FIELD_MARK) === "false") return false;
    if (input.getAttribute(FIELD_MARK) === "true") return true;
    var type = (input.getAttribute("type") || "text").toLowerCase();
    if (SKIP_TYPES.indexOf(type) !== -1) return false;
    if (input.id === "field-amount-input") return true;

    var hints = inputHints(input);
    // Identity/date/count/rate fields never become money inputs just because a label mentions a loan.
    if (EXCLUDE_NON_MONEY.test(hints) || NON_AMOUNT_HINTS.test(hints)) return false;
    return MONEY_HINTS.test(hints);
  }

  /* قفل کهنه‌ای که ۲۲۵ یا نسخه‌های قبلی روی فیلد متنی گذاشته‌اند پاک می‌شود تا
     کیبورد متنی برگردد. فقط روی فیلدهایی که صریحاً «غیرمبلغ» علامت خورده‌اند اجرا می‌شود. */
  function repairExplicitTextField(input) {
    if (!input || input.getAttribute(FIELD_MARK) !== "false") return;
    if (input.readOnly === true) input.readOnly = false;
    if (input.hasAttribute("readonly")) input.removeAttribute("readonly");
    if (input.getAttribute("inputmode") === "none") input.removeAttribute("inputmode");
  }

  function markMoneyInput(input) {
    if (!input || input.disabled) return false;
    if (input.getAttribute(FIELD_MARK) !== "true") {
      if (!isMoneyInput(input)) return false;
      input.setAttribute(FIELD_MARK, "true");
    }
    if (input.readOnly !== true) input.readOnly = true;
    if (input.getAttribute("readonly") !== "readonly") input.setAttribute("readonly", "readonly");
    if (input.getAttribute("inputmode") !== "none") input.setAttribute("inputmode", "none");
    return true;
  }

  function readCurrency() {
    try {
      var value = window.__safeGet ? window.__safeGet("hesabno:currency") : window.localStorage.getItem("hesabno:currency");
      return value === "toman" ? "تومان" : "ریال";
    } catch (error) {
      return "ریال";
    }
  }

  function currentDigits(input) {
    if (!input) return "";
    return toAscii(input.value).replace(/[^0-9]/g, "").slice(0, MAX_DIGITS);
  }

  function formattedDigits(value) {
    if (!value) return "۰";
    return toPersian(String(value).replace(/\B(?=(\d{3})+(?!\d))/g, "٬"));
  }

  function refreshDisplay() {
    if (!panel || panel.hidden) return;
    if (!activeInput || !activeInput.isConnected) {
      hideKeyboard(false);
      return;
    }
    valueDisplay.value = formattedDigits(draft);
    currencyDisplay.textContent = readCurrency();
  }

  function injectStyles() {
    /* در اجرای واقعی برنامه، تمام قواعد کیبورد در بستهٔ ۲۳۵ بارگذاری شده‌اند؛
       این تابع فقط برای آزمون واحدی که ۲۱۴ را در DOM خام بدون <link> اجرا می‌کند باقی مانده است. */
    if (document.getElementById(PANEL_ID + "-style") || document.querySelector('link[rel="stylesheet"]')) return;
    var style = document.createElement("style");
    style.id = PANEL_ID + "-style";
    style.textContent = "\
      #" + PANEL_ID + "[hidden]{display:none!important}\
      #" + BACKDROP_ID + "[hidden]{display:none!important}\
      #" + BACKDROP_ID + "{position:fixed;inset:0;z-index:2147482999;background:rgba(2,6,23,.24);backdrop-filter:blur(2px) saturate(.96);-webkit-backdrop-filter:blur(2px) saturate(.96);animation:hesabno-amount-backdrop-in .16s ease-out both}\
      html[data-theme=\"light\"] #" + BACKDROP_ID + ",html.theme-light #" + BACKDROP_ID + "{background:rgba(248,250,252,.42)}\
      @keyframes hesabno-amount-backdrop-in{from{opacity:0}to{opacity:1}}\
      @media (prefers-reduced-motion:reduce){#" + BACKDROP_ID + "{animation:none}}\
      #" + PANEL_ID + "{position:fixed;z-index:2147483000;left:0;right:0;bottom:0;box-sizing:border-box;padding:6px 10px calc(4px + env(safe-area-inset-bottom,0px));background:rgba(17,24,39,.98);color:#f8fafc;border-top:1px solid rgba(148,163,184,.28);box-shadow:0 -10px 30px rgba(0,0,0,.3);font-family:inherit;direction:rtl;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}\
      #" + PANEL_ID + " .hkap-shell{width:100%;max-width:460px;margin:0 auto}\
      #" + PANEL_ID + " .hkap-top{display:flex;align-items:stretch;gap:8px}\
      #" + PANEL_ID + " .hkap-display{flex:1;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 12px;border:1px solid #334155;border-radius:14px;background:#0b1220;min-height:52px;box-sizing:border-box}\
      #" + PANEL_ID + " .hkap-label{display:none}\
      #" + PANEL_ID + " .hkap-value{display:block;box-sizing:border-box;width:100%;min-width:0;margin:0;padding:0;border:0;outline:0;background:transparent;color:#f8fafc;font-family:inherit;font-size:24px;font-weight:900;line-height:1.2;direction:ltr;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;caret-color:transparent}\
      #" + PANEL_ID + " .hkap-currency{flex:none;color:#a7f3d0;font-size:12px;font-weight:800;padding-inline-start:8px;border-inline-start:1px solid rgba(148,163,184,.25)}\
      #" + PANEL_ID + " .hkap-key-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:6px}\
      #" + PANEL_ID + " button{box-sizing:border-box;min-width:0;min-height:48px;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:#1f2937;color:#f8fafc;font-family:inherit;font-size:20px;font-weight:800;cursor:pointer;touch-action:manipulation}\
      #" + PANEL_ID + " button:active{transform:scale(.96);background:#334155}\
      #" + PANEL_ID + " button.hkap-pressed{transform:scale(.96);background:#334155;filter:brightness(1.12)}\
      #" + PANEL_ID + " .hkap-close{width:48px;min-height:52px;font-size:24px;color:#cbd5e1;background:#1f2937;border-radius:14px}\
      #" + PANEL_ID + " .hkap-utility{font-size:14px;color:#cbd5e1;background:#273449}\
      #" + PANEL_ID + " .hkap-confirm{grid-column:span 2;background:#059669;border-color:#10b981;color:white;font-size:16px}\
      #" + PANEL_ID + " .hkap-hint{display:none!important}\
      html[data-theme=\"light\"] #" + PANEL_ID + ",html.theme-light #" + PANEL_ID + "{background:rgba(248,250,252,.99);color:#0f172a;border-top-color:#cbd5e1;box-shadow:0 -10px 30px rgba(15,23,42,.12)}\
      html[data-theme=\"light\"] #" + PANEL_ID + " .hkap-display,html.theme-light #" + PANEL_ID + " .hkap-display{background:#fff;border-color:#cbd5e1}\
      html[data-theme=\"light\"] #" + PANEL_ID + " .hkap-value,html.theme-light #" + PANEL_ID + " .hkap-value{color:#0f172a}\
      html[data-theme=\"light\"] #" + PANEL_ID + " .hkap-currency,html.theme-light #" + PANEL_ID + " .hkap-currency{color:#047857}\
      html[data-theme=\"light\"] #" + PANEL_ID + " button,html.theme-light #" + PANEL_ID + " button{background:#ffffff;border-color:#cbd5e1;color:#0f172a}\
      html[data-theme=\"light\"] #" + PANEL_ID + " .hkap-utility,html.theme-light #" + PANEL_ID + " .hkap-utility{background:#f1f5f9;color:#334155}\
      html[data-theme=\"light\"] #" + PANEL_ID + " .hkap-close,html.theme-light #" + PANEL_ID + " .hkap-close{background:#fee2e2;color:#dc2626;border-color:#fca5a5}\
      html[data-theme=\"light\"] #" + PANEL_ID + " .hkap-confirm,html.theme-light #" + PANEL_ID + " .hkap-confirm{background:#059669;border-color:#10b981;color:white}\
      @media(max-height:680px){#" + PANEL_ID + "{padding-top:4px}#" + PANEL_ID + " .hkap-key-grid{gap:5px;margin-top:5px}#" + PANEL_ID + " button{min-height:40px;border-radius:11px;font-size:18px}#" + PANEL_ID + " .hkap-display,#" + PANEL_ID + " .hkap-close{min-height:46px}#" + PANEL_ID + " .hkap-value{font-size:20px}}\
    ";
    document.head.appendChild(style);
  }

  /*
   * پرده‌ی پشت کیبورد: صفحه‌ی زیر با backdrop-filter تار می‌شود. عمداً از filter روی
   * #root استفاده نمی‌کنیم؛ filter روی والد، containing block فرزندان fixed (نوار پایین،
   * مودال‌ها) را می‌شکند. این لایه فقط یک لایه‌ی رنگی+بلور روی محتواست.
   * فقط در اولین بازشدن ساخته می‌شود تا DOM بوت دست‌نخورده بماند.
   */
  function ensureBackdrop() {
    if (backdrop && backdrop.isConnected) return backdrop;
    backdrop = document.getElementById(BACKDROP_ID);
    if (backdrop) return backdrop;
    backdrop = document.createElement("div");
    backdrop.id = BACKDROP_ID;
    backdrop.setAttribute(UI_MARK, "true");
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function ensurePanel() {
    if (panel && panel.isConnected) return;
    injectStyles();
    panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.setAttribute(UI_MARK, "true");
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", "صفحه‌کلید مبلغ");
    panel.setAttribute("dir", "rtl");
    panel.hidden = true;
    panel.innerHTML = "\
      <div class=\"hkap-shell\">\
        <div class=\"hkap-top\">\
          <div class=\"hkap-display\" aria-live=\"polite\">\
            <div class=\"hkap-value-wrap\"><input type=\"text\" class=\"hkap-value\" data-hkap-value value=\"۰\" readonly inputmode=\"none\" tabindex=\"-1\" aria-label=\"مبلغ واردشده\" autocomplete=\"off\" /></div>\
            <span class=\"hkap-currency\" data-hkap-currency>ریال</span>\
          </div>\
          <button type=\"button\" class=\"hkap-close\" data-hkap-action=\"close\" aria-label=\"بستن صفحه‌کلید\" title=\"بستن\">×</button>\
        </div>\
        <div class=\"hkap-key-grid\">\
          <button type=\"button\" class=\"hkap-utility\" data-hkap-action=\"backspace\" aria-label=\"حذف یک رقم\">⌫</button>\
          <button type=\"button\" data-hkap-action=\"digit\" data-value=\"1\" aria-label=\"۱\">۱</button>\
          <button type=\"button\" data-hkap-action=\"digit\" data-value=\"2\" aria-label=\"۲\">۲</button>\
          <button type=\"button\" data-hkap-action=\"digit\" data-value=\"3\" aria-label=\"۳\">۳</button>\
          <button type=\"button\" class=\"hkap-utility\" data-hkap-action=\"clear\" aria-label=\"پاک‌کردن مبلغ\" dir=\"ltr\">C</button>\
          <button type=\"button\" data-hkap-action=\"digit\" data-value=\"4\" aria-label=\"۴\">۴</button>\
          <button type=\"button\" data-hkap-action=\"digit\" data-value=\"5\" aria-label=\"۵\">۵</button>\
          <button type=\"button\" data-hkap-action=\"digit\" data-value=\"6\" aria-label=\"۶\">۶</button>\
          <button type=\"button\" class=\"hkap-utility\" data-hkap-action=\"digit\" data-value=\"000\">۰۰۰</button>\
          <button type=\"button\" data-hkap-action=\"digit\" data-value=\"7\" aria-label=\"۷\">۷</button>\
          <button type=\"button\" data-hkap-action=\"digit\" data-value=\"8\" aria-label=\"۸\">۸</button>\
          <button type=\"button\" data-hkap-action=\"digit\" data-value=\"9\" aria-label=\"۹\">۹</button>\
          <button type=\"button\" class=\"hkap-utility\" data-hkap-action=\"digit\" data-value=\"00\">۰۰</button>\
          <button type=\"button\" data-hkap-action=\"digit\" data-value=\"0\" aria-label=\"۰\">۰</button>\
          <button type=\"button\" class=\"hkap-confirm\" data-hkap-action=\"confirm\">تأیید</button>\
        </div>\
      </div>\
    ";
    valueDisplay = panel.querySelector("[data-hkap-value]");
    currencyDisplay = panel.querySelector("[data-hkap-currency]");

    panel.addEventListener("pointerdown", function (event) {
      if (event.target && event.target.closest && event.target.closest("button, input[data-hkap-value]")) {
        event.preventDefault();
        dismissNativeKeyboard();
      }
    });
    panel.addEventListener("touchstart", function (event) {
      if (event.target && event.target.closest && event.target.closest("button, input[data-hkap-value]")) {
        event.preventDefault();
        dismissNativeKeyboard();
      }
    }, { passive: false });
    panel.addEventListener("mousedown", function (event) {
      if (event.target && event.target.closest && event.target.closest("button, input[data-hkap-value]")) {
        event.preventDefault();
        dismissNativeKeyboard();
      }
    });

    /*
     * چرا روی pointerdown/touchstart و نه فقط click؟
     * هندلرهای بالا روی همین دکمه‌ها preventDefault می‌زنند تا فوکوس/کیبورد بومی باز نشود.
     * در کرومِ لمسی و WebView اندروید، لغو touchstart رویداد مصنوعی click را تولید نمی‌کند؛
     * نتیجه این بود که روی گوشی هیچ رقمی ثبت نمی‌شد (در دسکتاپ با ماوس کار می‌کرد).
     * حالا خودِ «فشردن» کار را انجام می‌دهد و click فقط برای صفحه‌کلید/فناوری کمکی می‌ماند.
     */
    var lastPressButton = null;
    var lastPressAt = 0;

    function markPressed(button) {
      if (!button || !button.classList) return;
      button.classList.add("hkap-pressed");
      window.setTimeout(function () { button.classList.remove("hkap-pressed"); }, 130);
    }

    function runPanelAction(button) {
      if (!button || !activeInput) return;
      var action = button.getAttribute("data-hkap-action");
      if (action === "digit") appendDigits(button.getAttribute("data-value") || "");
      else if (action === "backspace") removeDigit();
      else if (action === "clear") setDraft("");
      else if (action === "confirm") confirmAmount();
      else if (action === "close") hideKeyboard(true);
    }

    function handlePanelPress(event) {
      var button = event.target && event.target.closest ? event.target.closest("[data-hkap-action]") : null;
      if (!button) return;
      if (event.cancelable) event.preventDefault();
      dismissNativeKeyboard();
      lastPressButton = button;
      lastPressAt = Date.now();
      markPressed(button);
      runPanelAction(button);
    }

    /* pointerdown همیشه؛ در مرورگرهای دارای PointerEvent فقط همین کافی است */
    panel.addEventListener("pointerdown", handlePanelPress, { passive: false });
    if (typeof window.PointerEvent !== "function") {
      /* WebViewهای قدیمی بدون PointerEvent: مousedown/touchstart جایگزین */
      panel.addEventListener("touchstart", handlePanelPress, { passive: false });
      panel.addEventListener("mousedown", handlePanelPress);
    }

    panel.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("[data-hkap-action]") : null;
      if (!button || !activeInput) return;
      /*
       * click مصنوعی که پس از همان فشردن می‌آید دوباره اعمال نشود؛ ولی کلیک صفحه‌کلید
       * (detail === 0) و کلیک فناوری کمکی همیشه کار کند.
       */
      if (event.detail > 0 && button === lastPressButton && Date.now() - lastPressAt < 800) return;
      runPanelAction(button);
    });

    document.body.appendChild(panel);
  }

  function normalizeDigits(value) {
    return toAscii(value).replace(/[^0-9]/g, "").slice(0, MAX_DIGITS);
  }

  /*
   * پیش‌نویس: هر رقم فقط در نمایشگر خود کیبورد می‌نشیند. تا «تأیید» زده نشود نه value
   * فیلد عوض می‌شود و نه رویداد input/change منتشر می‌شود؛ پس فرم و state برنامه
   * تا لحظه‌ی تأیید دست‌نخورده می‌مانند. بستن با × یا Esc پیش‌نویس را دور می‌ریزد.
   */
  function setDraft(value) {
    draftTouched = true;
    draft = normalizeDigits(value);
    refreshDisplay();
  }

  function syncUntouchedDraft() {
    if (!panel || panel.hidden || !activeInput || !activeInput.isConnected || draftTouched) return;
    var current = currentDigits(activeInput);
    if (current && current !== draft) {
      draft = current;
      refreshDisplay();
    }
  }

  function commitDraft() {
    if (!activeInput || !activeInput.isConnected) return false;
    var digits = normalizeDigits(draft);
    var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    if (setter && setter.set) setter.set.call(activeInput, digits);
    else activeInput.value = digits;
    activeInput.dispatchEvent(new Event("input", { bubbles: true }));
    activeInput.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function appendDigits(value) {
    if (!activeInput) return;
    var add = normalizeDigits(value);
    if (!add) return;
    var next = draft === "0" ? add : draft + add;
    next = next.replace(/^0+(?=\d)/, "");
    if (!next) next = "0";
    if (next.length > MAX_DIGITS) next = next.slice(0, MAX_DIGITS);
    setDraft(next);
  }

  function removeDigit() {
    if (!activeInput) return;
    setDraft(draft.slice(0, -1));
  }

  function activateInput(input, shouldScroll) {
    if (!input || !markMoneyInput(input)) return;
    ensurePanel();

    // Crucial: dismiss native soft keyboard so it does not conflict with amount keypad
    input.readOnly = true;
    input.setAttribute("readonly", "readonly");
    input.setAttribute("inputmode", "none");
    try { input.blur(); } catch (e) {}
    dismissNativeKeyboard();

    var changed = activeInput !== input || panel.hidden;
    activeInput = input;
    draftTouched = false;
    draft = currentDigits(input);
    panel.hidden = false;
    ensureBackdrop().hidden = false;
    refreshDisplay();
    if (!draft) {
      Promise.resolve().then(syncUntouchedDraft);
      window.setTimeout(syncUntouchedDraft, 0);
      window.setTimeout(syncUntouchedDraft, 32);
    }

    if (shouldScroll && changed) {
      window.setTimeout(function () {
        if (activeInput === input && input.isConnected && input.scrollIntoView) {
          try {
            input.scrollIntoView({ block: "center", behavior: "smooth" });
          } catch (error) {
            input.scrollIntoView(false);
          }
        }
      }, 60);
    }
  }

  function hideKeyboard(blurInput, preserveNativeKeyboard) {
    var oldInput = activeInput;
    activeInput = null;
    draftTouched = false;
    draft = "";
    if (panel) panel.hidden = true;
    if (backdrop) backdrop.hidden = true;
    if (blurInput && oldInput && oldInput.isConnected && document.activeElement === oldInput) {
      oldInput.blur();
    }
    if (!preserveNativeKeyboard) dismissNativeKeyboard();
  }

  /* قلاب عمومی برای دکمه‌ی بک گوشی: اگر کیبورد مبلغ باز است فقط همان بسته شود. */
  window.__hesabnoAmountKeyboardOpen = function () {
    return !!(panel && !panel.hidden);
  };
  window.__hesabnoCloseAmountKeyboard = function () {
    if (!panel || panel.hidden) return false;
    hideKeyboard(false);
    return true;
  };

  function confirmAmount() {
    if (!activeInput) return;
    /* یک‌بار نوشتن، یک‌بار رویداد؛ بعد بستن */
    commitDraft();
    hideKeyboard(true);
  }

  function handleKey(event) {
    if (!panel || panel.hidden || !activeInput || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target !== activeInput && !(panel.contains && panel.contains(event.target))) return;
    var key = toAscii(event.key || "");
    if (/^\d$/.test(key)) {
      event.preventDefault();
      appendDigits(key);
    } else if (key === "Backspace") {
      event.preventDefault();
      removeDigit();
    } else if (key === "Delete") {
      event.preventDefault();
      setDraft("");
    } else if (key === "Enter") {
      event.preventDefault();
      confirmAmount();
    } else if (key === "Escape") {
      event.preventDefault();
      hideKeyboard(true);
    }
  }

  function apply() {
    document.querySelectorAll("input").forEach(function (input) {
      if (input.closest && input.closest("[data-hesabno-amount-keyboard-ui='true']")) return;
      var type = (input.getAttribute("type") || "text").toLowerCase();
      if (SKIP_TYPES.indexOf(type) !== -1 || input.disabled) return;
      /* فیلدی که صریحاً «غیرمبلغ» علامت خورده (نام وام/قسط و مانند آن) نباید هیچ قفل یا
         inputmode ای از نسخه‌های قبلی با خود داشته باشد. */
      repairExplicitTextField(input);
      var money = input.getAttribute(FIELD_MARK) === "true" || isMoneyInput(input);
      if (money) {
        markMoneyInput(input);
        return;
      }
      var hints = inputHints(input);
      var explicitNumeric = type === "number" || type === "tel" || input.getAttribute("dir") === "ltr";
      if (!explicitNumeric && FREE_TEXT_HINTS.test(hints)) {
        /* اگر خودمان قبلاً روی این فیلد عددی گذاشته بودیم، پس بگیریم. */
        if (input.getAttribute(INFERRED_INPUTMODE) === "numeric" && input.getAttribute("inputmode") === "numeric") {
          input.removeAttribute("inputmode");
        }
        input.removeAttribute(INFERRED_INPUTMODE);
        return;
      }
      if (input.getAttribute("inputmode") === "numeric") return;
      var numeric = explicitNumeric || NUMERIC_HINTS.test(hints);
      if (!numeric || /جستجو|search/i.test(hints)) return;
      input.setAttribute("inputmode", "numeric");
      input.setAttribute(INFERRED_INPUTMODE, "numeric");
    });
    if (panel && !panel.hidden && (!activeInput || !activeInput.isConnected)) hideKeyboard(false);
    else syncUntouchedDraft();
  }

  function scheduleApply() {
    if (applyQueued) return;
    applyQueued = true;
    window.requestAnimationFrame(function () {
      applyQueued = false;
      apply();
    });
  }

  function handleFocusIn(event) {
    var target = event.target;
    if (panel && panel.contains(target)) return;
    if (target && target.tagName === "INPUT") repairExplicitTextField(target);
    if (target && target.tagName === "INPUT" && (target.getAttribute(FIELD_MARK) === "true" || isMoneyInput(target))) {
      if (target.readOnly !== true) target.readOnly = true;
      if (target.getAttribute("readonly") !== "readonly") target.setAttribute("readonly", "readonly");
      if (target.getAttribute("inputmode") !== "none") target.setAttribute("inputmode", "none");
      try { target.blur(); } catch (e) {}
      dismissNativeKeyboard();
      activateInput(target, true);
    } else if (panel && !panel.hidden) {
      /* فیلد متنی تازه فوکوس گرفته؛ کیبورد مبلغ بسته شود ولی فوکوس/کیبورد بومی حفظ شود. */
      hideKeyboard(false, true);
    }
  }

  function handleFocusOut(event) {
    if (!activeInput || event.target !== activeInput) return;
    var previous = activeInput;
    window.setTimeout(function () {
      if (activeInput !== previous) return;
      if (panel && panel.contains(document.activeElement)) return;
      if (document.activeElement && document.activeElement.tagName === "INPUT" && (document.activeElement.getAttribute(FIELD_MARK) === "true" || isMoneyInput(document.activeElement))) return;
      hideKeyboard(false);
    }, 0);
  }

  function targetsMatch(first, second) {
    if (!first || !second) return false;
    if (first === second) return true;
    try { return !!(first.contains && first.contains(second) || second.contains && second.contains(first)); }
    catch (error) { return false; }
  }

  function cancelOutsideActivation(event) {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
  }

  function handlePointerDown(event) {
    var target = event.target;
    var now = Date.now();
    if (pendingOutsideClick) {
      var elapsed = now - pendingOutsideClick.at;
      if (event.type === "click") {
        var pendingTarget = pendingOutsideClick.target;
        pendingOutsideClick = null;
        if (elapsed <= 750 && targetsMatch(pendingTarget, target)) {
          cancelOutsideActivation(event);
          return;
        }
      } else if (/^(pointerdown|touchstart|mousedown)$/.test(event.type) &&
                 (elapsed > 80 || !targetsMatch(pendingOutsideClick.target, target))) {
        /* شروع لمس تازه است، نه رویداد سازگارِ همان لمس که صفحه‌کلید را بست. */
        pendingOutsideClick = null;
      }
    }
    if (panel && panel.contains(target)) return;
    var input = target && target.closest ? target.closest("input") : null;
    if (input) repairExplicitTextField(input);
    if (input && (input.getAttribute(FIELD_MARK) === "true" || isMoneyInput(input))) {
      if (input.readOnly !== true) input.readOnly = true;
      if (input.getAttribute("readonly") !== "readonly") input.setAttribute("readonly", "readonly");
      if (input.getAttribute("inputmode") !== "none") input.setAttribute("inputmode", "none");
      try { input.blur(); } catch (e) {}
      dismissNativeKeyboard();
      if (event.cancelable) event.preventDefault();
      activateInput(input, true);
      return;
    }
    if (panel && !panel.hidden) {
      if (!input) {
        if (event.type === "click") {
          cancelOutsideActivation(event);
        } else {
          pendingOutsideClick = { target: target, at: now };
          cancelOutsideActivation(event);
        }
      }
      hideKeyboard(false);
    }
  }

  function start() {
    ensurePanel();
    apply();
    [200, 600, 1500].forEach(function (delay) { window.setTimeout(apply, delay); });

    document.addEventListener("touchstart", handlePointerDown, { capture: true, passive: false });
    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    document.addEventListener("mousedown", handlePointerDown, { capture: true });
    document.addEventListener("click", handlePointerDown, { capture: true });
    document.addEventListener("focusin", handleFocusIn, { capture: true });
    document.addEventListener("focusout", handleFocusOut, { capture: true });
    document.addEventListener("keydown", handleKey, true);
    document.addEventListener("input", function (event) {
      if (!activeInput || event.target !== activeInput) return;
      /* اگر تغییر از بیرون آمده باشد (نه از commit خودمان)، پیش‌نویس را با فیلد هم‌گام کن */
      if (normalizeDigits(activeInput.value) !== draft) {
        draft = currentDigits(activeInput);
        refreshDisplay();
      }
    }, true);
    window.addEventListener("storage", function (event) {
      if (!event.key || event.key === "hesabno:currency") refreshDisplay();
    });
    if (document.body) {
      new MutationObserver(scheduleApply).observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["placeholder", "aria-label", "aria-labelledby", "name", "id", "dir"]
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
