(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var read = function (key) {
      try {
        var raw = window.__safeGet ? window.__safeGet(key) : localStorage.getItem(key);
        var value = JSON.parse(raw || "null");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var sync = function () {
      var items = read("hesabno:transactions");
      var accounts = read("hesabno:accounts_v5");
      var nonBank = accounts.filter(function (account) { return account && account.group !== "bank" && account.group !== "cash"; });
      document.querySelectorAll("article[id^='tx-card-']").forEach(function (article) {
        var id = article.id.slice("tx-card-".length);
        var transaction = items.find(function (item) { return String(item && item.id) === id; });
        var iconBox = article.querySelector("span.w-7.h-7") || article.querySelector("span.w-8.h-8") || article.querySelector("div.w-7.h-7") || article.querySelector("div.w-8.h-8");
        if (!transaction || !iconBox) return;
        if (transaction.isLoanTransaction || transaction.loanId != null || transaction.installmentId != null) return;
        var candidates = [transaction.category, transaction.title, transaction.destinationAccount, transaction.account].map(clean).filter(Boolean);
        var match = null;
        for (var i = 0; i < candidates.length && !match; i += 1) {
          match = nonBank.find(function (account) { return clean(account.name) === candidates[i]; }) || nonBank.find(function (account) {
            var name = clean(account.name);
            return name.length > 2 && (candidates[i].indexOf(name) !== -1 || name.indexOf(candidates[i]) !== -1);
          });
        }
        var icon = match && match.picture ? match.picture : transaction.type === "expense" ? "📉" : "📈";
        iconBox.classList.add("hesabno-counterparty-icon");
        iconBox.setAttribute("data-hesabno-counterparty-icon", icon);
        iconBox.style.pointerEvents = "none";
      });
    };
    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () { scheduled = false; sync(); });
    };
    sync();
    document.addEventListener("click", function (event) {
      var target = event.target && event.target.nodeType === 1 ? event.target : event.target && event.target.parentElement;
      if (target && target.closest && target.closest("article[id^='tx-card-']")) schedule();
    }, true);
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
  })();
