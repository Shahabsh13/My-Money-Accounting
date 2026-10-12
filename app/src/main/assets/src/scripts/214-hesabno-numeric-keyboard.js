(function () {
  // A built-in amount keypad for money inputs; non-money numeric fields keep the system keypad.
  var PANEL_ID = "hesabno-amount-keyboard";
  var FIELD_MARK = "data-hesabno-amount-keyboard-field";
  var UI_MARK = "data-hesabno-amount-keyboard-ui";
  var MONEY_HINTS = /مبلغ|مانده|موجودی|قیمت|کارمزد|سود|قسط|amount|balance|price|fee|installment|principal|opening.?balance/i;
  var NUMERIC_HINTS = /مبلغ|شماره|کارت|شبا|iban|مانده|موجودی|تعداد|درصد|رقم|سقف|قیمت|کد|روز|ماه|سال|تاریخ|زمان|ساعت|عدد|نرخ|سود|کارمزد|تومان|ریال|amount|number|price|card|account/i;
  var SKIP_TYPES = ["checkbox", "radio", "file", "range", "color", "hidden", "submit", "button", "reset", "password", "email", "search"];
  var activeInput = null;
  var panel = null;
  var valueDisplay = null;
  var currencyDisplay = null;
  var applyQueued = false;
  var MAX_DIGITS = 15;
  function clean(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function toAscii(value) { return String(value == null ? "" : value).replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); }).replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); }); }
  function toPersian(value) { return String(value).replace(/[0-9]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]; }); }
  function inputHints(input) {
    var parts = [input.getAttribute("placeholder"), input.getAttribute("aria-label"), input.getAttribute("data-hesabno-inferred-label"), input.getAttribute("name"), input.id, input.className];
    try { if (input.labels) Array.prototype.forEach.call(input.labels, function (label) { parts.push(label.textContent); }); } catch (error) {}
    var labelledBy = input.getAttribute("aria-labelledby");
    if (labelledBy) labelledBy.split(/\s+/).forEach(function (id) { var label = document.getElementById(id); if (label) parts.push(label.textContent); });
    var node = input;
    for (var depth = 0; node && depth < 3; depth += 1, node = node.parentElement) { var previous = node.previousElementSibling; if (previous && previous.tagName === "LABEL") parts.push(previous.textContent); }
    var wrappingLabel = input.closest && input.closest("label"); if (wrappingLabel) parts.push(wrappingLabel.textContent);
    return parts.map(clean).join(" ");
  }
  function isMoneyInput(input) {
    if (!input || input.tagName !== "INPUT" || input.disabled) return false;
    if (input.closest && input.closest("[data-hesabno-amount-keyboard-ui='true']")) return false;
    if (input.getAttribute(FIELD_MARK) === "true") return true;
    var type = (input.getAttribute("type") || "text").toLowerCase();
    if (SKIP_TYPES.indexOf(type) !== -1 || input.readOnly) return false;
    return input.id === "field-amount-input" || MONEY_HINTS.test(inputHints(input));
  }
  function markMoneyInput(input) {
    if (!input || input.disabled) return false;
    if (input.getAttribute(FIELD_MARK) !== "true") { if (!isMoneyInput(input)) return false; input.setAttribute(FIELD_MARK, "true"); }
    if (!input.readOnly) input.readOnly = true;
    if (input.getAttribute("inputmode") !== "none") input.setAttribute("inputmode", "none");
    return true;
  }
  function readCurrency() { try { var value = window.__safeGet ? window.__safeGet("hesabno:currency") : window.localStorage.getItem("hesabno:currency"); return value === "toman" ? "تومان" : "ریال"; } catch (error) { return "ریال"; } }
  function currentDigits(input) { if (!input) return ""; return toAscii(input.value).replace(/[^0-9]/g, "").slice(0, MAX_DIGITS); }
  function formattedDigits(value) { if (!value) return "۰"; return toPersian(String(value).replace(/\B(?=(\d{3})+(?!\d))/g, "٬")); }
  function refreshDisplay() { if (!panel || panel.hidden) return; if (!activeInput || !activeInput.isConnected) { hideKeyboard(false); return; } valueDisplay.value = formattedDigits(currentDigits(activeInput)); currencyDisplay.textContent = readCurrency(); }
  function injectStyles() {
    if (document.getElementById(PANEL_ID + "-style")) return;
    var style = document.createElement("style"); style.id = PANEL_ID + "-style";
    style.textContent = "\
      #" + PANEL_ID + "[hidden]{display:none!important}\
      #" + PANEL_ID + "{position:fixed;z-index:2147483000;left:0;right:0;bottom:0;box-sizing:border-box;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));background:rgba(17,24,39,.98);color:#f8fafc;border-top:1px solid rgba(148,163,184,.32);box-shadow:0 -12px 34px rgba(0,0,0,.24);font-family:inherit;direction:rtl;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}\
      #" + PANEL_ID + " .hkap-shell{width:100%;max-width:460px;margin:0 auto}\
      #" + PANEL_ID + " .hkap-top{display:flex;align-items:stretch;gap:8px}\
      #" + PANEL_ID + " .hkap-display{flex:1;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;border:1px solid #334155;border-radius:14px;background:#0b1220}\
      #" + PANEL_ID + " .hkap-label{display:block;color:#94a3b8;font-size:10px;font-weight:700;line-height:1.3}\
      #" + PANEL_ID + " .hkap-value{display:block;box-sizing:border-box;width:100%;min-width:0;margin-top:2px;padding:0;border:0;outline:0;background:transparent;color:#f8fafc;font-family:inherit;font-size:22px;font-weight:900;line-height:1.25;direction:ltr;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;caret-color:transparent}\
      #" + PANEL_ID + " .hkap-currency{flex:none;color:#a7f3d0;font-size:11px;font-weight:800}\
      #" + PANEL_ID + " .hkap-key-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:8px}\
      #" + PANEL_ID + " button{box-sizing:border-box;min-width:0;min-height:48px;border:1px solid rgba(148,163,184,.22);border-radius:13px;background:#1f2937;color:#f8fafc;font-family:inherit;font-size:19px;font-weight:800;cursor:pointer;touch-action:manipulation}\
      #" + PANEL_ID + " button:active{transform:scale(.97);background:#334155}\
      #" + PANEL_ID + " .hkap-close{width:48px;min-height:unset;font-size:24px;color:#cbd5e1;background:#1f2937}\
      #" + PANEL_ID + " .hkap-utility{font-size:13px;color:#cbd5e1;background:#273449}\
      #" + PANEL_ID + " .hkap-confirm{grid-column:span 2;background:#059669;border-color:#10b981;color:white;font-size:15px}\
      #" + PANEL_ID + " .hkap-hint{margin-top:6px;color:#94a3b8;font-size:9px;text-align:center}\
      html[data-theme=\"light\"] #" + PANEL_ID + ",html.theme-light #" + PANEL_ID + "{background:rgba(248,250,252,.99);color:#0f172a;border-top-color:#cbd5e1;box-shadow:0 -12px 34px rgba(15,23,42,.14)}\
      html[data-theme=\"light\"] #" + PANEL_ID + " .hkap-display,html.theme-light #" + PANEL_ID + " .hkap-display{background:#fff;border-color:#cbd5e1}\
      html[data-theme=\"light\"] #" + PANEL_ID + " .hkap-label,html.theme-light #" + PANEL_ID + " .hkap-label{color:#64748b}\
      html[data-theme=\"light\"] #" + PANEL_ID + " .hkap-value,html.theme-light #" + PANEL_ID + " .hkap-value{color:#0f172a}\
      html[data-theme=\"light\"] #" + PANEL_ID + " .hkap-currency,html.theme-light #" + PANEL_ID + " .hkap-currency{color:#047857}\
      html[data-theme=\"light\"] #" + PANEL_ID + " button,html.theme-light #" + PANEL_ID + " button{background:#e2e8f0;border-color:#cbd5e1;color:#0f172a}\
      html[data-theme=\"light\"] #" + PANEL_ID + " .hkap-utility,html.theme-light #" + PANEL_ID + " .hkap-utility{background:#e8eef5;color:#334155}\
      html[data-theme=\"light\"] #" + PANEL_ID + " .hkap-close,html.theme-light #" + PANEL_ID + " .hkap-close{background:#e2e8f0;color:#334155}\
      html[data-theme=\"light\"] #" + PANEL_ID + " .hkap-confirm,html.theme-light #" + PANEL_ID + " .hkap-confirm{background:#059669;border-color:#10b981;color:white}\
      html[data-theme=\"light\"] #" + PANEL_ID + " .hkap-hint,html.theme-light #" + PANEL_ID + " .hkap-hint{color:#64748b}\
      @media(max-height:680px){#" + PANEL_ID + "{padding-top:7px}#" + PANEL_ID + " .hkap-key-grid{gap:5px;margin-top:6px}#" + PANEL_ID + " button{min-height:42px;border-radius:11px}#" + PANEL_ID + " .hkap-value{font-size:19px}}\
    "; document.head.appendChild(style);
  }
  function ensurePanel() {
    if (panel && panel.isConnected) return; injectStyles(); panel = document.createElement("section"); panel.id = PANEL_ID; panel.setAttribute(UI_MARK, "true"); panel.setAttribute("role", "group"); panel.setAttribute("aria-label", "صفحه‌کلید مبلغ"); panel.setAttribute("dir", "rtl"); panel.hidden = true;
    panel.innerHTML = "\
      <div class=\"hkap-shell\">\
        <div class=\"hkap-top\">\
          <div class=\"hkap-display\" aria-live=\"polite\">\
            <div style=\"min-width:0\"><span class=\"hkap-label\">مبلغ</span><input type=\"text\" class=\"hkap-value\" data-hkap-value value=\"۰\" readonly inputmode=\"none\" tabindex=\"-1\" aria-label=\"مبلغ واردشده\" autocomplete=\"off\" /></div>\
            <span class=\"hkap-currency\" data-hkap-currency>ریال</span>\
          </div>\
          <button type=\"button\" class=\"hkap-close\" data-hkap-action=\"close\" aria-label=\"بستن صفحه‌کلید\" title=\"بستن\">×</button>\
        </div>\
        <div class=\"hkap-key-grid\">\
          <button type=\"button\" data-hkap-action=\"digit\" data-value=\"7\" aria-label=\"۷\">۷</button><button type=\"button\" data-hkap-action=\"digit\" data-value=\"8\" aria-label=\"۸\">۸</button><button type=\"button\" data-hkap-action=\"digit\" data-value=\"9\" aria-label=\"۹\">۹</button><button type=\"button\" class=\"hkap-utility\" data-hkap-action=\"backspace\" aria-label=\"حذف یک رقم\">⌫</button>\
          <button type=\"button\" data-hkap-action=\"digit\" data-value=\"4\" aria-label=\"۴\">۴</button><button type=\"button\" data-hkap-action=\"digit\" data-value=\"5\" aria-label=\"۵\">۵</button><button type=\"button\" data-hkap-action=\"digit\" data-value=\"6\" aria-label=\"۶\">۶</button><button type=\"button\" class=\"hkap-utility\" data-hkap-action=\"clear\" aria-label=\"پاک‌کردن مبلغ\" dir=\"ltr\">C</button>\
          <button type=\"button\" data-hkap-action=\"digit\" data-value=\"1\" aria-label=\"۱\">۱</button><button type=\"button\" data-hkap-action=\"digit\" data-value=\"2\" aria-label=\"۲\">۲</button><button type=\"button\" data-hkap-action=\"digit\" data-value=\"3\" aria-label=\"۳\">۳</button><button type=\"button\" class=\"hkap-utility\" data-hkap-action=\"digit\" data-value=\"00\">۰۰</button>\
          <button type=\"button\" class=\"hkap-utility\" data-hkap-action=\"digit\" data-value=\"000\">۰۰۰</button><button type=\"button\" data-hkap-action=\"digit\" data-value=\"0\" aria-label=\"۰\">۰</button><button type=\"button\" class=\"hkap-confirm\" data-hkap-action=\"confirm\">تأیید</button>\
        </div><div class=\"hkap-hint\">برای وارد کردن مبلغ، رقم‌ها را انتخاب کن</div>\
      </div>\
    ";
    valueDisplay = panel.querySelector("[data-hkap-value]"); currencyDisplay = panel.querySelector("[data-hkap-currency]");
    panel.addEventListener("pointerdown", function (event) { if (event.target && event.target.closest && event.target.closest("button, input[data-hkap-value]")) event.preventDefault(); });
    panel.addEventListener("mousedown", function (event) { if (event.target && event.target.closest && event.target.closest("button, input[data-hkap-value]")) event.preventDefault(); });
    panel.addEventListener("click", function (event) { var button = event.target && event.target.closest ? event.target.closest("[data-hkap-action]") : null; if (!button || !activeInput) return; var action = button.getAttribute("data-hkap-action"); if (action === "digit") appendDigits(button.getAttribute("data-value") || ""); else if (action === "backspace") removeDigit(); else if (action === "clear") setAmount(""); else if (action === "confirm") confirmAmount(); else if (action === "close") hideKeyboard(true); });
    document.body.appendChild(panel);
  }
  function setAmount(value, dispatchChange) {
    if (!activeInput || !activeInput.isConnected) return; var digits = toAscii(value).replace(/[^0-9]/g, "").slice(0, MAX_DIGITS); var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value"); if (setter && setter.set) setter.set.call(activeInput, digits); else activeInput.value = digits;
    activeInput.dispatchEvent(new Event("input", { bubbles: true })); if (dispatchChange) activeInput.dispatchEvent(new Event("change", { bubbles: true })); refreshDisplay();
  }
  function appendDigits(value) { if (!activeInput) return; var current = currentDigits(activeInput); var add = toAscii(value).replace(/[^0-9]/g, ""); if (!add) return; var next = current === "0" ? add : current + add; next = next.replace(/^0+(?=\d)/, ""); if (!next) next = "0"; if (next.length > MAX_DIGITS) next = next.slice(0, MAX_DIGITS); setAmount(next); }
  function removeDigit() { if (!activeInput) return; setAmount(currentDigits(activeInput).slice(0, -1)); }
  function activateInput(input, shouldScroll) { if (!input || !markMoneyInput(input)) return; ensurePanel(); var changed = activeInput !== input || panel.hidden; activeInput = input; panel.hidden = false; refreshDisplay(); if (shouldScroll && changed) window.setTimeout(function () { if (activeInput === input && input.isConnected && input.scrollIntoView) { try { input.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (error) { input.scrollIntoView(false); } } }, 60); }
  function hideKeyboard(blurInput) { var oldInput = activeInput; activeInput = null; if (panel) panel.hidden = true; if (blurInput && oldInput && oldInput.isConnected && document.activeElement === oldInput) oldInput.blur(); }
  function confirmAmount() { if (!activeInput) return; var input = activeInput; var digits = currentDigits(input); setAmount(digits, true); hideKeyboard(true); }
  function handleKey(event) { if (!panel || panel.hidden || !activeInput || event.ctrlKey || event.metaKey || event.altKey) return; if (event.target !== activeInput && !(panel.contains && panel.contains(event.target))) return; var key = toAscii(event.key || ""); if (/^\d$/.test(key)) { event.preventDefault(); appendDigits(key); } else if (key === "Backspace") { event.preventDefault(); removeDigit(); } else if (key === "Delete") { event.preventDefault(); setAmount(""); } else if (key === "Enter") { event.preventDefault(); confirmAmount(); } else if (key === "Escape") { event.preventDefault(); hideKeyboard(true); } }
  function apply() {
    document.querySelectorAll("input").forEach(function (input) { if (input.closest && input.closest("[data-hesabno-amount-keyboard-ui='true']")) return; var type = (input.getAttribute("type") || "text").toLowerCase(); if (SKIP_TYPES.indexOf(type) !== -1 || input.disabled) return; var money = input.getAttribute(FIELD_MARK) === "true" || isMoneyInput(input); if (money) { markMoneyInput(input); return; } if (input.getAttribute("inputmode") === "numeric") return; var numeric = type === "number" || type === "tel" || input.getAttribute("dir") === "ltr" || NUMERIC_HINTS.test(inputHints(input)); if (!numeric || /جستجو|search/i.test(inputHints(input))) return; input.setAttribute("inputmode", "numeric"); });
    if (panel && !panel.hidden && (!activeInput || !activeInput.isConnected)) hideKeyboard(false);
  }
  function scheduleApply() { if (applyQueued) return; applyQueued = true; window.requestAnimationFrame(function () { applyQueued = false; apply(); }); }
  function handleFocusIn(event) { var target = event.target; if (panel && panel.contains(target)) return; if (target && target.tagName === "INPUT" && (target.getAttribute(FIELD_MARK) === "true" || isMoneyInput(target))) activateInput(target, true); else if (panel && !panel.hidden) hideKeyboard(false); }
  function handleFocusOut(event) { if (!activeInput || event.target !== activeInput) return; var previous = activeInput; window.setTimeout(function () { if (activeInput !== previous) return; if (panel && panel.contains(document.activeElement)) return; if (document.activeElement && document.activeElement.tagName === "INPUT" && (document.activeElement.getAttribute(FIELD_MARK) === "true" || isMoneyInput(document.activeElement))) return; hideKeyboard(false); }, 0); }
  function handlePointerDown(event) { var target = event.target; if (panel && panel.contains(target)) return; var input = target && target.closest ? target.closest("input") : null; if (input && (input.getAttribute(FIELD_MARK) === "true" || isMoneyInput(input))) { if (event.cancelable) event.preventDefault(); activateInput(input, true); return; } if (panel && !panel.hidden) hideKeyboard(false); }
  function start() {
    ensurePanel(); apply(); [300, 1000].forEach(function (delay) { window.setTimeout(apply, delay); });
    document.addEventListener("focusin", handleFocusIn, true); document.addEventListener("focusout", handleFocusOut, true); document.addEventListener("pointerdown", handlePointerDown, true); if (!window.PointerEvent) document.addEventListener("touchstart", handlePointerDown, { capture: true, passive: false }); document.addEventListener("mousedown", handlePointerDown, true); document.addEventListener("keydown", handleKey, true);
    document.addEventListener("input", function (event) { if (event.target === activeInput) refreshDisplay(); }, true);
    window.addEventListener("storage", function (event) { if (!event.key || event.key === "hesabno:currency") refreshDisplay(); });
    if (document.body) new MutationObserver(scheduleApply).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "aria-labelledby", "name", "id", "dir", "inputmode", "readonly"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
