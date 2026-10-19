/* Use the non-bank side of income/expense transactions for the card icon.
 * ظاهر .hesabno-counterparty-icon و .hesabno-tx-status-badge در بستهٔ ۲۳۵ (لایهٔ ظاهر) است. */
   (function () {
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
         /* اندازه و خط‌چین در بستهٔ ۲۳۵ تعریف شده‌اند؛ این‌جا فقط کلاس و دادهٔ معنایی. */
         iconBox.classList.add("hesabno-counterparty-icon");
         iconBox.dataset.hesabnoCounterpartyIcon = icon;
      });
    };
    var frame = 0;
    var schedule = function () {
      if (frame) return;
      frame = 1;
      Promise.resolve().then(function () { frame = 0; enhance(); });
    };
    enhance();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
  })();
