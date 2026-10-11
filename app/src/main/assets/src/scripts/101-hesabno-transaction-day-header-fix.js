(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var readTransactions = function () {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions");
        var transactions = JSON.parse(raw || "[]");
        return Array.isArray(transactions) ? transactions : [];
      }
      catch (error) { return []; }
    };
    var amountValue = function (value) {
      return Number(String(value || "").replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); })
        .replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); }).replace(/[−–]/g, "-").replace(/[^0-9.-]/g, "")) || 0;
    };
    var syncCanceledCheckTotal = function (header, transactions) {
      var total = header.querySelector(".hesabno-transaction-day-total");
      var group = header.parentElement;
      if (!total || !group) return;
      var currentText = clean(total.textContent);
      var priorText = total.getAttribute("data-hesabno-corrected-total");
      var priorCorrection = Number(total.getAttribute("data-hesabno-total-correction")) || 0;
      var base = amountValue(currentText) - (priorText === currentText ? priorCorrection : 0);
      var correction = 0;
      group.querySelectorAll('article[id^="tx-card-"]').forEach(function (article) {
        var id = article.id.slice("tx-card-".length);
        var transaction = transactions.find(function (item) { return String(item && item.id) === id; });
        var check = transaction && transaction.check;
        if (!check) return;
        var status = String(check.status || "").trim().toLowerCase();
        var excluded = check.debtCanceled === true || ["bounced", "refunded", "returned", "returned_check", "dishonored"].includes(status) || /برگشت|مسترد|returned|refund|bounc|dishonor/i.test(status);
        if (!excluded) return;
        var amount = Number(transaction.amount) || 0;
        if (transaction.type === "expense") correction += amount;
        else if (transaction.type === "income") correction -= amount;
      });
      var adjusted = base + correction;
      var currency = (currentText.match(/(?:ریال|تومان)$/) || [""])[0];
      var rendered = (adjusted < 0 ? "−" : "") + Math.abs(adjusted).toLocaleString("fa-IR") + (currency ? " " + currency : "");
      if (rendered !== currentText) total.textContent = rendered;
      if (correction) {
        total.setAttribute("data-hesabno-corrected-total", rendered);
        total.setAttribute("data-hesabno-total-correction", String(correction));
      } else {
        total.removeAttribute("data-hesabno-corrected-total");
        total.removeAttribute("data-hesabno-total-correction");
      }
    };
    var enhance = function () {
      document.querySelectorAll("main").forEach(function (main) {
        var title = main.querySelector("h1");
        if (!title || clean(title.textContent).indexOf("دفتر تراکنش‌ها و اسناد") !== 0) return;
        var transactions = readTransactions();
        main.querySelectorAll("div.sticky").forEach(function (header) {
         var count = Array.from(header.querySelectorAll("span")).find(function (node) { return /سند$/.test(clean(node.textContent)); });
         if (!count) return;
         header.classList.add("hesabno-transaction-day-header");
         var light = document.documentElement.getAttribute("data-theme") === "light";
         header.style.setProperty("border", "0", "important");
         header.style.setProperty("background", light ? "#cde3de" : "rgba(255,255,255,.055)", "important");
         header.style.setProperty("box-shadow", "none", "important");
         count.classList.add("hesabno-transaction-day-count");
         if (count.previousElementSibling) count.previousElementSibling.classList.add("hesabno-transaction-day-date");
          var total = header.querySelector('span[class*="font-bold"][class*="bg-"]');
          if (total) total.classList.add("hesabno-transaction-day-total");
          syncCanceledCheckTotal(header, transactions);
        });
     });
   };
   enhance();
   if (document.body) new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
   if (document.documentElement) new MutationObserver(enhance).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
 })();
