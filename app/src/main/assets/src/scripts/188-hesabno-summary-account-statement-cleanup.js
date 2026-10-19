(function () {
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var readAccounts = function () {
      try {
        var value = JSON.parse(localStorage.getItem("hesabno:accounts_v5") || "[]");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var update = function () {
      var main = document.querySelector("#root main");
      if (!main) return;
      var heading = Array.from(main.querySelectorAll("h1")).find(function (node) {
        return clean(node.textContent).indexOf("خلاصه گزارشات") === 0;
      });
      if (heading) {
        var titleBlock = heading.parentElement;
        var header = titleBlock && titleBlock.parentElement;
        if (header && header.dataset.hesabnoSummaryHeader !== "true") header.dataset.hesabnoSummaryHeader = "true";
        Array.from(heading.querySelectorAll("span")).forEach(function (node) {
          if (clean(node.textContent) === "تحلیل جامع") node.remove();
        });
        if (titleBlock) Array.from(titleBlock.querySelectorAll("p")).forEach(function (node) {
          if (clean(node.textContent) === "گردش حساب، مقایسه با گذشته و میانگین مصرف") node.remove();
        });
        var changeAccount = main.querySelector('[title="ریست انتخاب حساب"]');
        if (changeAccount) {
          if (changeAccount.dataset.hesabnoSummaryChangeAccount !== "true") changeAccount.dataset.hesabnoSummaryChangeAccount = "true";
          if (changeAccount.style.whiteSpace !== "nowrap") changeAccount.style.whiteSpace = "nowrap";
          if (changeAccount.style.flexWrap !== "nowrap") changeAccount.style.flexWrap = "nowrap";
          var label = changeAccount.querySelector("span");
          if (label && label.style.whiteSpace !== "nowrap") label.style.whiteSpace = "nowrap";
        }
      }
      var statement = Array.from(main.querySelectorAll("h3")).find(function (node) {
        return clean(node.textContent) === "صورتحساب";
      });
      var card = statement && statement.parentElement && statement.parentElement.parentElement;
      if (!card) return;
      var accounts = readAccounts();
      var rows = Array.from(card.querySelectorAll("div")).find(function (node) {
        return node.classList.contains("divide-y") && node.classList.contains("divide-stone-800/60");
      });
      if (rows && rows.dataset.hesabnoSummaryStatementRows !== "true") rows.dataset.hesabnoSummaryStatementRows = "true";
      Array.from(card.querySelectorAll("p")).forEach(function (node) {
        var raw = clean(node.textContent);
        if (!node.classList.contains("truncate") || node.dataset.hesabnoSummaryAccountIcon) return;
        var separator = raw.indexOf("•");
        var compoundName = separator > -1 ? clean(raw.slice(0, separator)) : "";
        var account = compoundName && accounts.find(function (item) {
          return item && clean(item.name).toLowerCase() === compoundName.toLowerCase();
        });
        var candidates = raw.split(/\s*[•·]\s*|\s+[-–—]\s+/u).map(clean).filter(Boolean).reverse();
        candidates.push(raw);
        if (!account) account = candidates.map(function (name) {
          return accounts.find(function (item) { return item && clean(item.name).toLowerCase() === name.toLowerCase(); });
        }).find(Boolean);
        if (!account) account = accounts.filter(function (item) {
          var name = clean(item && item.name);
          return name.length > 2 && raw.toLowerCase().indexOf(name.toLowerCase()) !== -1;
        }).sort(function (left, right) { return clean(right.name).length - clean(left.name).length; })[0] || null;
        var name = clean(account && account.name) || compoundName;
        var display = account && compoundName && name.toLowerCase() === compoundName.toLowerCase() ? name : raw;
        node.textContent = "";
        node.dataset.hesabnoSummaryAccountIcon = "true";
        if (name) node.dataset.hesabnoSummaryAccountName = name;
        node.title = display;
        node.setAttribute("dir", "rtl");
        node.style.display = "flex";
        node.style.alignItems = "center";
        node.style.direction = "rtl";
        node.style.gap = "4px";
        node.style.minWidth = "0";
        var picture = clean(account && (account.picture || account.icon));
        if (!picture) picture = account && account.group === "bank" ? "🏦" : account && account.group === "cash" ? "💵" : account && account.group === "income" ? "💰" : account ? "🧾" : "📄";
        var icon;
        if (/^(?:https?:|data:image\/)/i.test(picture)) {
          icon = document.createElement("img");
          icon.src = picture;
          icon.alt = "";
          icon.width = 14;
          icon.height = 14;
          icon.className = "hesabno-summary-account-icon";
          icon.style.objectFit = "contain";
        } else {
          icon = document.createElement("span");
          icon.className = "hesabno-summary-account-icon";
          icon.textContent = picture;
        }
        var label = document.createElement("span");
        label.className = "hesabno-summary-account-name";
        label.textContent = display;
        node.append(icon, label);
      });
      Array.from(card.querySelectorAll("span")).forEach(function (node) {
        if (/^\s*[•·]?\s*سند\s*#\s*[0-9۰-۹٠-٩]+\s*$/.test(clean(node.textContent))) node.remove();
      });
    };
    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(function () {
        scheduled = false;
        update();
      });
    };
    update();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, characterData: true, subtree: true }, schedule);
  })();
