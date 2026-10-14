(function () {
  "use strict";
  var marker = "hesabno:report-account-detail-origin";
  var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
  var isReportScreen = function () {
    var main = document.querySelector("#root main");
    if (!main) return false;
    return !!main.querySelector(".hesabno-report-transaction-card, .hesabno-report-transaction-row, [data-hesabno-report-transaction-card], [data-hesabno-report-account-picker]") ||
      Array.from(main.querySelectorAll("h1,h2,h3")).some(function (node) { return /گزارش|صورت سود و زیان|ترازنامه/u.test(clean(node.textContent)); });
  };
  document.addEventListener("click", function () {
    if (!isReportScreen()) return;
    try { sessionStorage.setItem(marker, String(Date.now())); } catch (error) {}
  }, true);
  var update = function () {
    var main = document.querySelector("#root main");
    var panel = main && main.querySelector(".hesabno-account-statement-panel");
    if (!panel) return;
    var clickedAt = 0;
    try { clickedAt = Number(sessionStorage.getItem(marker) || 0); } catch (error) {}
    if (!clickedAt || Date.now() - clickedAt > 20000) return;
    panel.dataset.hesabnoReportAccountDetail = "true";
    if (!main.querySelector("[data-hesabno-report-account-detail-title]")) {
      var title = document.createElement("div");
      title.dataset.hesabnoReportAccountDetailTitle = "true";
      title.textContent = "گزارش‌ها";
      title.setAttribute("role", "heading");
      title.setAttribute("aria-level", "1");
      main.insertBefore(title, main.firstElementChild);
    }
    try { sessionStorage.removeItem(marker); } catch (error) {}
  };
  var queued = false;
  var schedule = function () {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(function () { queued = false; update(); });
  };
  update();
  if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
})();