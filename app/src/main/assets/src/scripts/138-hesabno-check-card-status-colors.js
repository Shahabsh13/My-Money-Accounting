(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    /* رنگ‌بندی وضعیت کارت‌های چک در بستهٔ ۲۳۵ (لایهٔ ظاهر) قرار دارد. */
    var ensureStyles = function () {};
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
          if (article.hasAttribute("data-hesabno-check-status-card")) article.removeAttribute("data-hesabno-check-status-card");
          if (article.hasAttribute("data-hesabno-check-status-label")) article.removeAttribute("data-hesabno-check-status-label");
          return;
        }
        var text = clean(article.textContent);
        var isCheck = text.includes("شماره چک:") || text.includes("تغییر وضعیت") || text.includes("چک در جریان") || text.includes("چک برگشتی") || text.includes("چک مسترد");
        if (!isCheck) return;
        var key = statusKey(article);
        if (key) {
          if (article.getAttribute("data-hesabno-check-status-card") !== key) article.setAttribute("data-hesabno-check-status-card", key);
          if (article.getAttribute("data-hesabno-check-status-label") !== key) article.setAttribute("data-hesabno-check-status-label", key);
        } else {
          if (article.hasAttribute("data-hesabno-check-status-card")) article.removeAttribute("data-hesabno-check-status-card");
          if (article.hasAttribute("data-hesabno-check-status-label")) article.removeAttribute("data-hesabno-check-status-label");
        }
      });
    };
    var pending = false;
    var schedule = function () {
      if (pending) return;
      pending = true;
      Promise.resolve().then(function () { pending = false; sync(); });
    };
    sync();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  })();
