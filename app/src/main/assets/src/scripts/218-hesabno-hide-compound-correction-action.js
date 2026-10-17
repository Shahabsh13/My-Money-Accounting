(function () {
  "use strict";
  var clean = function (value) { return String(value || "").replace(/\\s+/g, " ").trim(); };
  var readTransactions = function () {
    try {
      var raw = window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions");
      var items = JSON.parse(raw || "[]");
      return Array.isArray(items) ? items : [];
    } catch (error) { return []; }
  };
  var sync = function () {
    var items = readTransactions();
    document.querySelectorAll('article[id^="tx-card-"]').forEach(function (article) {
      var id = article.id.slice("tx-card-".length);
      var transaction = items.find(function (item) { return String(item && item.id) === id; });
      if (!transaction || !transaction.isCompound) return;
      Array.from(article.querySelectorAll("button")).forEach(function (button) {
        var title = clean(button.title);
        var isCorrectionAction = title === "ثبت سند اصلاحی برای این سند" ||
          button.hasAttribute("data-hesabno-payment-refund-action") && button.getAttribute("data-hesabno-payment-refund-action") !== "injected";
        if (isCorrectionAction) button.remove();
      });
    });
  };
  var scheduled = false;
  var schedule = function () {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function () { scheduled = false; sync(); });
  };
  sync();
  if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
})();
