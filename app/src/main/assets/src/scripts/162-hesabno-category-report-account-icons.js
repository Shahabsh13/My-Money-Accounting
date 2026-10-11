(function () {
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var readAccounts = function () {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:accounts_v5") : localStorage.getItem("hesabno:accounts_v5");
        var value = JSON.parse(raw || "null");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var accountFor = function (name, group, accounts) {
      var key = clean(name).toLowerCase();
      var matches = accounts.filter(function (account) {
        return account && account.group === group && clean(account.name).toLowerCase() === key;
      });
      return matches.find(function (account) { return account.parentId == null; }) || matches[0] || null;
    };
    var reportMode = function (root) {
      var buttons = Array.from(root.querySelectorAll("button"));
      var income = buttons.find(function (button) { return clean(button.textContent).indexOf("درآمدها") === 0; });
      if (income && String(income.className).indexOf("bg-emerald-500/20") !== -1) return "income";
      return "expense";
    };
    var addIcon = function (nameNode, account) {
      var picture = clean(account && account.picture);
      if (!picture || !nameNode || !nameNode.parentElement) return;
      var icon = Array.from(nameNode.parentElement.children).find(function (node) { return node.dataset.hesabnoCategoryReportIcon === "true"; });
      if (!icon) {
        icon = document.createElement("span");
        icon.className = "hesabno-category-report-account-icon";
        icon.dataset.hesabnoCategoryReportIcon = "true";
        icon.setAttribute("aria-label", "آیکون حساب " + clean(account.name));
        icon.title = clean(account.name);
      }
      if (icon.parentElement !== nameNode.parentElement || icon.nextElementSibling !== nameNode) nameNode.parentNode.insertBefore(icon, nameNode);
      if (icon.dataset.hesabnoPicture === picture) return;
      icon.dataset.hesabnoPicture = picture;
      icon.setAttribute("aria-label", "آیکون حساب " + clean(account.name));
      icon.title = clean(account.name);
      if (/^(https?:|data:image\/|blob:|\/|\.\.?\/)/i.test(picture) || /\.(png|jpe?g|svg|webp)(?:[?#]|$)/i.test(picture)) {
        var image = document.createElement("img");
        image.src = picture;
        image.alt = "";
        image.loading = "lazy";
        icon.replaceChildren(image);
      } else icon.textContent = picture;
    };
    var decorateRows = function (rows, group, accounts) {
      rows.forEach(function (row) {
        var nameNode = Array.from(row.querySelectorAll("span")).find(function (node) {
          return !!accountFor(clean(node.textContent), group, accounts);
        });
        if (nameNode) addIcon(nameNode, accountFor(clean(nameNode.textContent), group, accounts));
      });
    };
    var formatBottomPercent = function (rows) {
      rows.forEach(function (row) {
        var percent = Array.from(row.querySelectorAll("span")).find(function (node) { return clean(node.textContent).indexOf("٪") !== -1; });
        if (!percent) return;
        var value = clean(percent.textContent).replace(/^[\s(]+|[)\s]+$/g, "");
        var formatted = value ? "(" + value + ")" : "";
        if (clean(percent.textContent) !== formatted) percent.textContent = formatted;
        percent.classList.remove("text-[9px]");
        percent.classList.add("text-[10px]");
      });
    };
    var render = function () {
      var heading = Array.from(document.querySelectorAll("h3")).find(function (node) {
        var text = clean(node.textContent);
        return text === "سهم سرفصل‌ها از کل" || text.indexOf("سهم تفصیلی‌های ") === 0;
      });
      var sortedHeading = Array.from(document.querySelectorAll("h3")).find(function (node) {
        var text = clean(node.textContent);
        return text === "تفکیک کامل سرفصل‌ها به ترتیب بیشترین مبلغ" || text.indexOf("ریز اقلام تفصیلی سرفصل ") === 0;
      });
      if (!heading || !sortedHeading) return;
      var donutCard = heading.closest("div.rounded-xl");
      var sortedCard = sortedHeading.closest("div.rounded-xl");
      if (!donutCard || !sortedCard) return;
      var isDrillDown = clean(sortedHeading.textContent).indexOf("ریز اقلام تفصیلی سرفصل ") === 0;
      if (isDrillDown) sortedCard.setAttribute("data-hesabno-category-report-detail-items-duplicate", "true");
      else sortedCard.removeAttribute("data-hesabno-category-report-detail-items-duplicate");
      var accounts = readAccounts();
      var group = reportMode(heading.closest("main") || document);
      var legend = Array.from(donutCard.querySelectorAll("div.grid")).find(function (node) { return node.classList.contains("grid-cols-1"); });
      var legendRows = legend ? Array.from(legend.children) : [];
      var list = Array.from(sortedCard.children).find(function (node) { return node.classList.contains("space-y-1.5"); });
      var sortedRows = list ? Array.from(list.children) : [];
      decorateRows(legendRows, group, accounts);
      if (!isDrillDown) {
        decorateRows(sortedRows, group, accounts);
        formatBottomPercent(sortedRows);
      }
    };
    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () { scheduled = false; render(); });
    };
    render();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  })();
