(function () {
  var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
  var read = function (key) {
    try {
      var value = JSON.parse(localStorage.getItem(key) || "null");
      return Array.isArray(value) ? value : [];
    } catch (error) { return []; }
  };
  var enhance = function () {
    var transactions = read("hesabno:transactions");
    var accounts = read("hesabno:accounts_v5");
    document.querySelectorAll("h2").forEach(function (heading) {
      if (clean(heading.textContent).indexOf("تراکنش‌های «") !== 0) return;
      var section = heading.closest("div.rounded-3xl");
      var list = section && section.querySelector("div.divide-y");
      if (!list) return;
      Array.from(list.children).forEach(function (row) {
        var titleNode = row.querySelector('span[class*="font-semibold"]');
        var iconBox = row.querySelector("div.w-6.h-6") || row.querySelector("div.w-5.h-5");
        if (!titleNode || !iconBox) return;
        var title = clean(titleNode.textContent);
        var tx = transactions.find(function (item) {
          var labels = [item && item.title, item && item.description, item && item.name, item && item.category].map(clean).filter(Boolean);
          return labels.some(function (label) { return label === title || title.indexOf(label) >= 0 || label.indexOf(title) >= 0; });
        });
        if (!tx || tx.type !== "income" && tx.type !== "expense") return;
        var category = clean(tx.category) || title;
        var account = accounts.find(function (item) {
          var name = clean(item && item.name);
          return name && (name === category || title.indexOf(name) >= 0 || category.indexOf(name) >= 0) && (item.group === "income" || item.group === "expense");
        });
        if (!account || !account.picture || iconBox.dataset.hesabnoIcon === account.picture) return;
        iconBox.textContent = account.picture;
        iconBox.dataset.hesabnoIcon = account.picture;
        iconBox.style.fontSize = "1rem";
        iconBox.style.lineHeight = "1";
      });
    });
  };
  enhance();
  if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, enhance);
})();
