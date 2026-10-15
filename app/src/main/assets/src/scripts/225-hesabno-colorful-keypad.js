(function () {
  "use strict";
  var PANEL_ID = "hesabno-amount-keyboard";
  var STYLE_ID = PANEL_ID + "-colorful-style";
  function install() {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return false;
    if (!document.getElementById(STYLE_ID)) {
      var style = document.createElement("style"); style.id = STYLE_ID;
      style.textContent = `
        #${PANEL_ID} .hkap-top { gap: 8px; }
        #${PANEL_ID} .hkap-display { min-height: 66px; border-radius: 18px; padding: 10px 14px; }
        #${PANEL_ID} .hkap-label { display:none; }
        #${PANEL_ID} .hkap-value { margin:0; font-size:27px; }
        #${PANEL_ID} .hkap-currency { font-size:14px; padding-inline-start:10px; border-inline-start:1px solid currentColor; }
        #${PANEL_ID} .hkap-close { flex:0 0 48px; width:48px; min-height:66px; border-radius:17px; background:#ef4444!important; border-color:#dc2626!important; color:#fff!important; font-size:30px; line-height:1; }
        #${PANEL_ID} .hkap-key-grid { grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-top:10px; }
        #${PANEL_ID} .hkap-key-grid button { min-height:56px; border-radius:16px; font-size:23px; border:1px solid transparent; transition:transform .12s ease,filter .12s ease; }
        #${PANEL_ID} .hkap-key-grid button:active { transform:scale(.95); filter:brightness(.92); }
        #${PANEL_ID} .hkap-key-grid [data-value="1"], #${PANEL_ID} .hkap-key-grid [data-value="8"] { background:#3b82f6!important; border-color:#60a5fa!important; color:#fff!important; }
        #${PANEL_ID} .hkap-key-grid [data-value="2"], #${PANEL_ID} .hkap-key-grid [data-value="9"] { background:#10b981!important; border-color:#34d399!important; color:#fff!important; }
        #${PANEL_ID} .hkap-key-grid [data-value="3"], #${PANEL_ID} .hkap-key-grid [data-value="7"] { background:#8b5cf6!important; border-color:#a78bfa!important; color:#fff!important; }
        #${PANEL_ID} .hkap-key-grid [data-value="4"] { background:#f59e0b!important; border-color:#fbbf24!important; color:#fff!important; }
        #${PANEL_ID} .hkap-key-grid [data-value="5"] { background:#ec4899!important; border-color:#f472b6!important; color:#fff!important; }
        #${PANEL_ID} .hkap-key-grid [data-value="6"] { background:#06b6d4!important; border-color:#22d3ee!important; color:#fff!important; }
        #${PANEL_ID} .hkap-key-grid [data-value="0"] { background:#2563eb!important; border-color:#60a5fa!important; color:#fff!important; }
        #${PANEL_ID} .hkap-key-grid [data-hkap-action="backspace"] { background:#ef4444!important; border-color:#f87171!important; color:#fff!important; }
        #${PANEL_ID} .hkap-key-grid [data-hkap-action="clear"] { background:#f59e0b!important; border-color:#fbbf24!important; color:#fff!important; }
        #${PANEL_ID} .hkap-key-grid [data-value="00"] { background:#8b5cf6!important; border-color:#a78bfa!important; color:#fff!important; }
        #${PANEL_ID} .hkap-key-grid [data-value="000"] { background:#3b82f6!important; border-color:#60a5fa!important; color:#fff!important; }
        #${PANEL_ID} .hkap-confirm { background:#10b981!important; border-color:#34d399!important; color:#fff!important; font-size:18px!important; }
        html[data-theme="light"] #${PANEL_ID} .hkap-display, html.theme-light #${PANEL_ID} .hkap-display { background:#fff; border-color:#dbe3ee; }
        html[data-theme="light"] #${PANEL_ID} .hkap-value, html.theme-light #${PANEL_ID} .hkap-value { color:#172033; }
        html[data-theme="light"] #${PANEL_ID} .hkap-currency, html.theme-light #${PANEL_ID} .hkap-currency { color:#475569; }
        html[data-theme="light"] #${PANEL_ID} .hkap-key-grid button:not([data-hkap-action="backspace"]):not([data-hkap-action="clear"]):not([data-hkap-action="confirm"]):not([data-value="0"]):not([data-value="00"]):not([data-value="000"]) { box-shadow:0 5px 12px rgba(30,41,59,.12); }
        @media(max-height:680px){#${PANEL_ID} .hkap-key-grid{gap:5px;margin-top:7px}#${PANEL_ID} .hkap-key-grid button{min-height:44px;border-radius:12px}#${PANEL_ID} .hkap-display,#${PANEL_ID} .hkap-close{min-height:54px}#${PANEL_ID} .hkap-value{font-size:22px}}
      `;
      document.head.appendChild(style);
    }
    var grid = panel.querySelector(".hkap-key-grid");
    if (grid && grid.getAttribute("data-hkap-redesign") !== "true") {
      grid.innerHTML = `
        <button type="button" class="hkap-utility" data-hkap-action="backspace" aria-label="حذف یک رقم">⌫</button>
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
    if (close) { close.textContent = "×"; close.setAttribute("aria-label", "بستن صفحه‌کلید"); }
    return true;
  }
  function start() {
    install();
    new MutationObserver(function () { install(); }).observe(document.documentElement, { childList:true, subtree:true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true}); else start();
})();
