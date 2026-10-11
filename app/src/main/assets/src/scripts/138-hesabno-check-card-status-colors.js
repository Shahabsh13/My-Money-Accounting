(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var ensureStyles = function () {
      if (document.querySelector("style[data-hesabno-check-card-status-colors-style]")) return;
      var style = document.createElement("style");
      style.setAttribute("data-hesabno-check-card-status-colors-style", "true");
      style.textContent = "article[data-hesabno-check-status-card]{transition:background-color .24s ease,border-color .24s ease,box-shadow .24s ease!important}html[data-theme=\"light\"] article[data-hesabno-check-status-card=\"in-progress\"]{background:#fff8e7!important;border-color:#e1c979!important;box-shadow:0 3px 12px rgba(171,132,35,.08)!important}html[data-theme=\"light\"] article[data-hesabno-check-status-card=\"passed\"]{background:#eef9f3!important;border-color:#a8d8be!important;box-shadow:0 3px 12px rgba(42,132,91,.08)!important}html[data-theme=\"light\"] article[data-hesabno-check-status-card=\"bounced\"]{background:#fff0f2!important;border-color:#e2a9b2!important;box-shadow:0 3px 12px rgba(180,45,65,.08)!important}html[data-theme=\"light\"] article[data-hesabno-check-status-card=\"refunded\"]{background:#eef4ff!important;border-color:#b6c9e8!important;box-shadow:0 3px 12px rgba(65,101,166,.08)!important}html[data-theme=\"light\"] article[data-hesabno-check-status-card=\"bank-hold\"]{background:#f2efff!important;border-color:#c4b8e8!important;box-shadow:0 3px 12px rgba(94,72,157,.08)!important}html[data-theme=\"dark\"] article[data-hesabno-check-status-card=\"in-progress\"]{background:#342f22!important;border-color:#826f3f!important}html[data-theme=\"dark\"] article[data-hesabno-check-status-card=\"passed\"]{background:#18362d!important;border-color:#3e846b!important}html[data-theme=\"dark\"] article[data-hesabno-check-status-card=\"bounced\"]{background:#3e252b!important;border-color:#8e4e5b!important}html[data-theme=\"dark\"] article[data-hesabno-check-status-card=\"refunded\"]{background:#25354a!important;border-color:#5e7fa8!important}html[data-theme=\"dark\"] article[data-hesabno-check-status-card=\"bank-hold\"]{background:#302a4b!important;border-color:#7669a9!important}";
      document.head.appendChild(style);
    };
    var statusKey = function (article) {
      var text = clean(article.textContent);
      var labels = Array.from(article.querySelectorAll("span")).map(function (node) { return clean(node.textContent); });
      if (labels.includes("برگشتی") || text.includes("چک برگشتی") || text.includes("برگشت خورده")) return "bounced";
      if (labels.includes("مسترد") || labels.includes("مسترد شده") || text.includes("چک مسترد")) return "refunded";
      if (labels.includes("خوابیده در بانک") || text.includes("خوابیده در بانک") || text.includes("چک در بانک است")) return "bank-hold";
      if (labels.includes("پاس‌شده") || labels.includes("پاس شده") || labels.includes("وصول‌شده") || labels.includes("وصول شده") || text.includes("پاس‌شده") || text.includes("وصول‌شده") || text.includes("پاس شد")) return "passed";
      if (labels.includes("در جریان") || text.includes("در جریان")) return "in-progress";
      return "";
    };
    var sync = function () {
      ensureStyles();
      document.querySelectorAll("article").forEach(function (article) {
        if (article.id && article.id.indexOf("tx-card-") === 0) {
          article.removeAttribute("data-hesabno-check-status-card");
          article.removeAttribute("data-hesabno-check-status-label");
          return;
        }
        var text = clean(article.textContent);
        var isCheck = text.includes("شماره چک:") || text.includes("تغییر وضعیت") || text.includes("چک در جریان") || text.includes("چک برگشتی") || text.includes("چک مسترد");
        if (!isCheck) return;
        var key = statusKey(article);
        if (key) {
          article.setAttribute("data-hesabno-check-status-card", key);
          article.setAttribute("data-hesabno-check-status-label", key);
        } else {
          article.removeAttribute("data-hesabno-check-status-card");
          article.removeAttribute("data-hesabno-check-status-label");
        }
      });
    };
    var pending = false;
    var schedule = function () {
      if (pending) return;
      pending = true;
      window.setTimeout(function () { pending = false; sync(); }, 0);
    };
    sync();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  })();
