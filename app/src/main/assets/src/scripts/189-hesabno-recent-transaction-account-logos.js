(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var normalize = function (value) {
      return clean(value).replace(/[۰-۹٠-٩]/g, function (digit) {
        var digits = "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩";
        var index = digits.indexOf(digit);
        return String(index < 10 ? index : index - 10);
      }).toLowerCase();
    };
    var read = function (key) {
      try {
        var raw = window.__safeGet ? window.__safeGet(key) : window.localStorage.getItem(key);
        var value = JSON.parse(raw || "null");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var label = function (value) {
      if (value && typeof value === "object") return clean(value.name || value.bankName || value.account);
      return clean(value);
    };
    var accountNames = function (account) {
      return [account && account.name, account && account.bankName, account && account.alias]
        .map(normalize).filter(Boolean);
    };
    var findAccount = function (value, accounts) {
      var target = normalize(label(value));
      if (!target) return null;
      var exact = accounts.find(function (account) { return accountNames(account).indexOf(target) !== -1; });
      if (exact) return exact;
      return accounts.filter(function (account) {
        return accountNames(account).some(function (name) {
          return name.length >= 4 && (target.indexOf(name) !== -1 || target.length >= 4 && name.indexOf(target) !== -1);
        });
      }).sort(function (left, right) {
        return Math.max.apply(null, accountNames(right).map(function (name) { return name.length; })) -
          Math.max.apply(null, accountNames(left).map(function (name) { return name.length; }));
      })[0] || null;
    };
    var findTransaction = function (title, accountName, transactions, used) {
      var matches = transactions.filter(function (transaction) {
        return [transaction && transaction.title, transaction && transaction.description, transaction && transaction.category]
          .some(function (value) { return clean(value) === title; });
      });
      var match = matches.find(function (transaction) {
        return !used.has(transaction) && normalize(label(transaction.account) || "حساب مبدأ") === normalize(accountName);
      }) || matches.find(function (transaction) { return !used.has(transaction); });
      if (match) used.add(match);
      return match || null;
    };
    var getTransactionIcon = function (transaction, accounts) {
      if (transaction.isCompound) return clean(transaction.picture || transaction.icon) || "📑";
      if ((transaction.isLoanTransaction || transaction.loanId != null || transaction.installmentId != null) && window.__HESABNO_LOAN_LOGO) return window.__HESABNO_LOAN_LOGO;
      var account = findAccount(transaction.category, accounts) || findAccount(transaction.title, accounts);
      if (!account) account = findAccount(transaction.account, accounts) || findAccount(transaction.destinationAccount, accounts);
      var picture = clean(account && (account.picture || account.logo || account.icon));
      if (!picture && account) picture = account.group === "bank" ? "🏦" : account.group === "cash" ? "💵" : "📄";
      return picture || "📄";
    };
    var enhance = function () {
      var transactions = read("hesabno:transactions");
      var accounts = read("hesabno:accounts_v5");
      var styleId = "hesabno-recent-account-logo-style";
      if (!document.getElementById(styleId)) {
        var style = document.createElement("style");
        style.id = styleId;
        style.textContent = ".hesabno-recent-account-logo{overflow:hidden;background:rgba(148,163,184,.12)!important;border-color:rgba(148,163,184,.32)!important}.hesabno-recent-account-logo img{width:34px;height:34px;object-fit:contain}.hesabno-recent-account-logo span{font-size:22px;line-height:1}html[data-theme=light] .hesabno-recent-account-logo,html.theme-light .hesabno-recent-account-logo{background:#fff!important;border-color:#cad8de!important}";
        document.head.appendChild(style);
      }
      document.querySelectorAll("h2").forEach(function (heading) {
        if (clean(heading.textContent) !== "آخرین تراکنش‌ها") return;
        var card = heading.closest("section") || heading.closest("div.rounded-3xl");
        var list = card && card.querySelector("div.divide-y");
        if (!list) return;
        var used = new Set();
        Array.from(list.children).forEach(function (row) {
          var titleNode = row.querySelector('p[class*="font-bold"][class*="text-xs"]');
          var accountNode = row.querySelector("p.hesabno-recent-bank-name");
          var iconBox = row.querySelector("span.w-11.h-11");
          if (!titleNode || !accountNode || !iconBox) return;
          var originalTitle = titleNode.dataset.hesabnoRecentOriginalTitle || clean(titleNode.textContent);
          titleNode.dataset.hesabnoRecentOriginalTitle = originalTitle;
          var transaction = findTransaction(originalTitle, clean(accountNode.textContent), transactions, used);
          if (!transaction) return;
          if (transaction.isCompound && clean(titleNode.textContent) !== "سند مرکب") titleNode.textContent = "سند مرکب";
          var picture = getTransactionIcon(transaction, accounts);
          if (iconBox.dataset.hesabnoRecentAccountLogo === picture) return;
          iconBox.replaceChildren();
          if (/^(?:https?:|data:image\/|blob:|\/|\.\.?\/)/i.test(picture) || /\.(png|jpe?g|svg|webp)(?:[?#]|$)/i.test(picture)) {
            var image = document.createElement("img");
            image.src = picture;
            image.alt = "";
            iconBox.appendChild(image);
          } else {
            var icon = document.createElement("span");
            icon.textContent = picture;
            iconBox.appendChild(icon);
          }
          iconBox.classList.add("hesabno-recent-account-logo");
          iconBox.dataset.hesabnoRecentAccountLogo = picture;
        });
      });
    };
    var queued = false;
    var schedule = function () {
      if (queued) return;
      queued = true;
      Promise.resolve().then(function () { queued = false; enhance(); });
    };
    enhance();
    window.__hesabnoDom.watch(document, { childList: true, characterData: true, subtree: true }, schedule);
    window.addEventListener("storage", schedule);
  })();
