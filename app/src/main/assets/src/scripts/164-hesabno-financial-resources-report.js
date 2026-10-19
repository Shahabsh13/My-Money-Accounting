(function () {
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var readArray = function (key) {
      try {
        var raw = window.__safeGet ? window.__safeGet(key) : localStorage.getItem(key);
        var value = JSON.parse(raw || "null");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var setText = function (node, value) {
      if (!node || clean(node.textContent) === value) return;
      var textNodes = [];
      var visit = function (element) {
        Array.from(element.childNodes).forEach(function (child) {
          if (child.nodeType === 3) textNodes.push(child);
          else if (child.nodeType === 1) visit(child);
        });
      };
      visit(node);
      if (!textNodes.length) return;
      textNodes[0].nodeValue = value;
      textNodes.slice(1).forEach(function (textNode) { textNode.nodeValue = ""; });
    };
    var logoFor = function (bankName) {
      var logos = window.__HESABNO_OFFICIAL_BANK_LOGOS || {};
      var text = clean(bankName).replace(/^بانک\s+/, "");
      var key = Object.keys(logos).sort(function (a, b) { return b.length - a.length; }).find(function (name) {
        return text.indexOf(name) !== -1 || clean(bankName).indexOf(name) !== -1;
      });
      return key ? { key: key, src: logos[key] } : null;
    };
    var accountCards = function (root) {
      return Array.from(root.querySelectorAll("div")).filter(function (card) {
        return card.classList.contains("bg-stone-800/90") && card.classList.contains("rounded-2xl") &&
          card.firstElementChild && card.firstElementChild.classList.contains("border-b") && card.querySelector("h4");
      });
    };
    var decorateBankCard = function (card, account) {
      var header = card.firstElementChild;
      var left = header.firstElementChild;
      var icon = left && left.firstElementChild;
      var info = left && left.children[1];
      var heading = info && info.querySelector("h4");
      var numberLine = info && info.querySelector("p");
      var bankName = clean(account.bankName || account.name);
      var title = clean(account.customTitle);
      var accountNumber = clean(account.accountNumber);
      var logo = logoFor(bankName);
      card.dataset.hesabnoResourcesAccountId = String(account.id);
      if (heading) {
        heading.classList.add("hesabno-report-bank-heading");
        setText(heading, bankName + (title ? " • " + title : ""));
        heading.setAttribute("aria-label", bankName + (title ? "، " + title : ""));
      }
      if (numberLine) {
        numberLine.classList.add("hesabno-report-account-number");
        setText(numberLine, accountNumber ? "شماره حساب: " + accountNumber : "شماره حساب ثبت نشده");
      }
      if (icon && logo && logo.src) {
        icon.classList.add("hesabno-report-bank-logo");
        icon.style.backgroundImage = "url(\"" + String(logo.src).replace(/\"/g, "%22") + "\")";
        icon.title = bankName;
        icon.setAttribute("aria-label", bankName);
        if (icon.firstChild && icon.firstChild.nodeType === 3 && icon.firstChild.nodeValue) icon.firstChild.nodeValue = "";
      }
    };
    var render = function () {
      var root = Array.from(document.querySelectorAll("main")).find(function (main) {
        return Array.from(main.querySelectorAll("h1")).some(function (heading) { return clean(heading.textContent).indexOf("گزارش هزینه و درآمد") === 0; });
      });
      if (!root) return;
      var heading = Array.from(root.querySelectorAll("h1")).find(function (node) { return clean(node.textContent).indexOf("گزارش هزینه و درآمد") === 0; });
      var topHeader = heading && heading.closest("header");
      if (topHeader) {
        topHeader.dataset.hesabnoFinancialHeader = "true";
        heading.dataset.hesabnoFinancialTitle = "true";
        var badge = Array.from(heading.querySelectorAll("span")).find(function (node) { return clean(node.textContent) === "ماهانه"; });
        if (badge) badge.dataset.hesabnoPeriodBadge = "true";
        var subtitle = heading.parentElement && heading.parentElement.querySelector("p");
        if (subtitle) subtitle.dataset.hesabnoPeriodSubtitle = "true";
        var current = Array.from(topHeader.querySelectorAll("button")).find(function (button) { return clean(button.textContent) === "ماه جاری"; });
        if (current) current.dataset.hesabnoFinancialCurrent = "true";
      }
      var accounts = readArray("hesabno:accounts");
      if (!accounts.some(function (account) { return account && (account.group === "bank" || account.group === "cash"); })) accounts = readArray("hesabno:accounts_v5");
      var financialAccounts = accounts.filter(function (account) { return account && (account.group === "bank" || account.group === "cash"); });
      var cards = accountCards(root);
      cards.forEach(function (card) {
        var text = clean(card.textContent);
        var account = financialAccounts.find(function (item) {
          return card.dataset.hesabnoResourcesAccountId === String(item.id) ||
            clean(item.name) && text.indexOf(clean(item.name)) !== -1 ||
            clean(item.accountNumber) && text.indexOf(clean(item.accountNumber)) !== -1;
        });
        if (!account) return;
        if (account.group === "bank") decorateBankCard(card, account);
      });
      var summary = Array.from(root.querySelectorAll("div.grid.grid-cols-3")).find(function (grid) {
        return grid.children.length === 3 && Array.from(grid.querySelectorAll("span")).some(function (node) { return clean(node.textContent) === "مانده دوره"; });
      });
      if (!summary) return;
      summary.dataset.hesabnoResourcesSummary = "true";
      var balanceCard = Array.from(summary.children).find(function (card) {
        return Array.from(card.querySelectorAll("span")).some(function (node) { return clean(node.textContent) === "مانده دوره"; });
      });
      if (balanceCard) {
        balanceCard.dataset.hesabnoSummaryBalance = "true";
        var labelNode = Array.from(balanceCard.querySelectorAll("span")).find(function (node) { return clean(node.textContent) === "مانده دوره"; });
        if (labelNode) labelNode.dataset.hesabnoSummaryLabel = "true";
      }
      var caption = balanceCard && Array.from(balanceCard.querySelectorAll("span")).find(function (node) { return clean(node.textContent) === "تراز بانک‌ها" || clean(node.textContent) === "تراز صندوق‌ها"; });
      setText(caption, "خالص ورودی و خروجی دوره");
    };
    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(function () { scheduled = false; render(); });
    };
    render();
    var root = document.documentElement || document.body;
    if (root) window.__hesabnoDom.watch(root, { childList: true, characterData: true, subtree: true }, schedule);
    window.addEventListener("storage", function (event) {
      if (!event.key || event.key === "hesabno:transactions" || event.key === "hesabno:accounts" || event.key === "hesabno:accounts_v5" || event.key === "hesabno:currency") schedule();
    });
  })();
