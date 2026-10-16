(function () {
    var logos = window.__HESABNO_OFFICIAL_BANK_LOGOS || {};
    var keys = Object.keys(logos).sort(function (a, b) { return b.length - a.length; });
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var normalizeAccountName = function (value) {
      return clean(value).replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); })
        .replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[\u200c\u200f\u202a-\u202e]/g, "")
        .replace(/[‐‑‒–—−]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
    };
    var readAccounts = function () {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:accounts_v5") : localStorage.getItem("hesabno:accounts_v5");
        var value = JSON.parse(raw || "[]");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var selectedBankName = function (displayName) {
      var target = normalizeAccountName(displayName);
      var account = readAccounts().find(function (item) {
        return item && item.bankName && (normalizeAccountName(item.name) === target || normalizeAccountName(item.bankName) === target);
      });
      return clean(account && account.bankName);
    };
    var resolveBank = function (value) {
      var text = clean(value).replace(/^•\s*/, "").replace(/^از\s+/, "").replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
      if (text.indexOf("بانک ") === 0) text = text.slice(5).trim();
      for (var i = 0; i < keys.length; i += 1) {
        var key = clean(keys[i]).replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
        if (key.indexOf("بانک ") === 0) key = key.slice(5).trim();
        if (text === key || text.indexOf(key + " ") === 0 || text.indexOf(key + "-") === 0) return keys[i];
      }
      return "";
    };
    var makeMark = function (key, label) {
      var mark = document.createElement("span");
      mark.className = "hesabno-bank-mark hesabno-report-bank-logo";
      mark.setAttribute("data-hesabno-report-bank-logo", key);
      mark.title = label;
      var image = document.createElement("img");
      image.alt = label;
      image.loading = "lazy";
      image.src = logos[key];
      mark.appendChild(image);
      return mark;
    };
    var readTransactions = function () {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions");
        var value = JSON.parse(raw || "[]");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var digits = function (value) {
      return String(value || "").replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); }).replace(/[^0-9]/g, "");
    };
    var manualDescription = function (row, card) {
      var current = row.querySelector(".hesabno-simple-report-description");
      if (current) return clean(current.textContent);
      if (!card) return "";
      var title = clean(card.querySelector("h2") && card.querySelector("h2").textContent).replace(/^تراکنش‌های\s*[«\"]?/, "").replace(/[»\"]$/, "");
      var bank = clean((row.querySelector(".hesabno-simple-report-bank") || {}).textContent);
      var amountNode = row.querySelector(".hesabno-simple-report-amount");
      var amount = digits(amountNode && amountNode.textContent);
      var candidates = readTransactions().filter(function (item) {
        var account = clean(item && (item.account || item.bank || item.bankName || item.linkedBank));
        var itemAmount = digits(item && item.amount);
        var category = clean(item && (item.title || item.category));
        return amount && itemAmount === amount && (!bank || account.includes(bank) || bank.includes(account)) && (!title || category === title);
      });
      var item = candidates[0];
      var value = clean(item && (item.description || item.note || item.memo));
      if (!value || value === title || value === clean(item && (item.title || item.category))) return "";
      return value;
    };
    var ensureStyle = function () {
      if (document.querySelector("style[data-hesabno-report-bank-logo-and-description-style]")) return;
      var style = document.createElement("style");
      style.setAttribute("data-hesabno-report-bank-logo-and-description-style", "true");
      style.textContent = ".hesabno-report-transaction-row{margin-block:2px!important;padding:7px 8px!important;gap:2px!important}.hesabno-simple-report-date-rows{gap:2px!important}.hesabno-simple-report-bank-wrap{display:flex;align-items:center;gap:4px;min-width:0;flex:1}.hesabno-simple-report-bank-wrap .hesabno-bank-mark{margin-inline-end:0!important}.hesabno-simple-report-bank{font-size:11px!important}.hesabno-simple-report-amount{font-size:10px!important}.hesabno-simple-report-description{margin-top:1px!important;padding:0 4px!important;font-size:9px!important;line-height:1.35!important;color:#70818c!important}html[data-theme=\"dark\"] .hesabno-simple-report-description{color:#aebdc5!important}html[data-theme=\"dark\"] .hesabno-simple-report-bank-wrap .hesabno-bank-mark{background:#d9eef7!important}";
      document.head.appendChild(style);
    };
    var decorate = function () {
      ensureStyle();
      document.querySelectorAll(".hesabno-report-transaction-row").forEach(function (row) {
        var bank = row.querySelector(".hesabno-simple-report-bank");
        if (!bank) return;
        var displayName = bank.getAttribute("title") || bank.textContent;
        var key = resolveBank(selectedBankName(displayName) || displayName);
        if (key && !bank.closest("[data-hesabno-report-bank-wrap]")) {
          var wrap = document.createElement("div");
          wrap.className = "hesabno-simple-report-bank-wrap";
          wrap.setAttribute("data-hesabno-report-bank-wrap", "true");
          wrap.appendChild(makeMark(key, bank.getAttribute("title") || bank.textContent));
          bank.parentNode.insertBefore(wrap, bank);
          wrap.appendChild(bank);
        }
        var card = row.closest(".hesabno-report-transaction-card");
        var description = manualDescription(row, card);
        if (description && !row.querySelector(".hesabno-simple-report-description")) {
          var node = document.createElement("div");
          node.className = "hesabno-simple-report-description";
          node.setAttribute("data-hesabno-report-description-fallback", "true");
          node.textContent = description;
          node.title = description;
          row.appendChild(node);
        }
      });
    };
    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () { scheduled = false; decorate(); });
    };
    decorate();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
  })();
