(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var read = function (key) {
      try {
        var raw = window.__safeGet ? window.__safeGet(key) : localStorage.getItem(key);
        var value = JSON.parse(raw || "null");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    /* قاعدهٔ پنهان‌سازی عنوان فرعی سند مرکب در بستهٔ ۲۳۵ (لایهٔ ظاهر) قرار دارد. */
    var titleFor = function (transaction) {
      if (!transaction || !transaction.isCompound) return "";
      var manual = transaction.hasManualDescription === true || clean(transaction.notes || transaction.description);
      if (manual) return "";
      var legs = transaction.type === "income" ? transaction.compoundSources : transaction.compoundDestinations;
      var names = Array.isArray(legs) ? legs.map(function (leg) { return clean(leg && leg.account); }).filter(Boolean) : [];
      if (!names.length) return "";
      return names.slice(0, 2).join(" + ") + (names.length > 2 ? " + ..." : "");
    };
    var sync = function () {
      var transactions = read("hesabno:transactions");
      document.querySelectorAll("article[id^='tx-card-']").forEach(function (article) {
        var id = article.id.slice("tx-card-".length);
        var transaction = transactions.find(function (item) { return String(item && item.id) === id; });
        var title = article.querySelector("div.grow p");
        if (!transaction || !title) return;
        var summary = titleFor(transaction);
        if (!summary) {
          if (title.getAttribute("data-hesabno-compound-title-summary") === "true") {
            title.textContent = title.getAttribute("data-hesabno-compound-title-original") || title.textContent;
            title.removeAttribute("data-hesabno-compound-title-summary");
            title.removeAttribute("data-hesabno-compound-title-original");
          }
          return;
        }
        if (title.getAttribute("data-hesabno-compound-title-summary") !== "true") {
          title.setAttribute("data-hesabno-compound-title-original", title.textContent);
          title.setAttribute("data-hesabno-compound-title-summary", "true");
        }
        if (title.textContent !== summary) title.textContent = summary;
      });
    };
    var queued = false;
    var schedule = function () {
      if (queued) return;
      queued = true;
      Promise.resolve().then(function () { queued = false; sync(); });
    };
    sync();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
  })();
