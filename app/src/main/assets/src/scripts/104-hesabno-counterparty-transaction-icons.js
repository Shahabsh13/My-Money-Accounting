/* Use the non-bank side of income/expense transactions for the card icon. */
   (function () {
     if (!document.querySelector("style[data-hesabno-counterparty-icon-style]")) {
       var style = document.createElement("style");
       style.setAttribute("data-hesabno-counterparty-icon-style", "true");
       style.textContent = ".hesabno-counterparty-icon{font-size:0!important;line-height:1!important}.hesabno-counterparty-icon>*,.hesabno-counterparty-icon img{display:none!important}.hesabno-counterparty-icon::after{content:attr(data-hesabno-counterparty-icon);display:inline-block;font-size:1rem;line-height:1}";
       document.head.appendChild(style);
     }
     if (!document.querySelector("style[data-hesabno-tx-status-badge-style]")) {
       var badgeStyle = document.createElement("style");
       badgeStyle.setAttribute("data-hesabno-tx-status-badge-style", "true");
       badgeStyle.textContent = ".hesabno-tx-status-badge{display:inline-flex;align-items:center;gap:4px;flex:0 0 auto;white-space:nowrap;padding:2px 6px;border-radius:5px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.35);color:#087f68;font-size:9px;font-weight:800}[data-hesabno-tx-status-meta][data-hesabno-tx-status]::after{content:none!important;display:none!important}";
       document.head.appendChild(badgeStyle);
     }
     var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var read = function (key) {
      try {
        var raw = window.__safeGet ? window.__safeGet(key) : localStorage.getItem(key);
        var value = JSON.parse(raw || "null");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var findCounterparty = function (transaction, accounts) {
      if (!transaction || (transaction.type !== "income" && transaction.type !== "expense")) return null;
      var candidates = [transaction.category, transaction.title, transaction.destinationAccount, transaction.account]
        .map(clean).filter(Boolean);
      var nonBankAccounts = accounts.filter(function (account) {
        return account && account.group !== "bank" && account.group !== "cash";
      });
      for (var i = 0; i < candidates.length; i += 1) {
        var candidate = candidates[i];
        var exact = nonBankAccounts.find(function (account) { return clean(account.name) === candidate; });
        if (exact) return exact;
        var partial = nonBankAccounts.find(function (account) {
          var name = clean(account.name);
          return name.length > 2 && (candidate.indexOf(name) !== -1 || name.indexOf(candidate) !== -1);
        });
        if (partial) return partial;
      }
      return null;
    };
    var enhance = function () {
      var transactions = read("hesabno:transactions");
      var accounts = read("hesabno:accounts_v5");
      document.querySelectorAll('article[id^="tx-card-"]').forEach(function (card) {
        var id = card.id.slice("tx-card-".length);
        var transaction = transactions.find(function (item) { return String(item && item.id) === id; });
        if (!transaction) return;
        if (transaction.isLoanTransaction || transaction.loanId != null || transaction.installmentId != null) return;
        var iconBox = card.querySelector("span.w-7.h-7") || card.querySelector("span.w-8.h-8") || card.querySelector("div.w-7.h-7") || card.querySelector("div.w-8.h-8");
        if (!iconBox) return;
        var account = findCounterparty(transaction, accounts);
        var icon = account && account.picture ? account.picture : transaction.type === "expense" ? "📉" : "📈";
        if (iconBox.dataset.hesabnoCounterpartyIcon === icon) return;
         iconBox.classList.add("hesabno-counterparty-icon");
         iconBox.dataset.hesabnoCounterpartyIcon = icon;
         iconBox.style.fontSize = "1rem";
        iconBox.style.lineHeight = "1";
      });
    };
    var frame = 0;
    var schedule = function () {
      if (frame) return;
      frame = requestAnimationFrame(function () { frame = 0; enhance(); });
    };
    enhance();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  })();
