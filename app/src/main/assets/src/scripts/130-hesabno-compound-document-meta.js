(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var findCompoundBadge = function (article) {
      var labelled = Array.from(article.querySelectorAll("span")).find(function (node) {
        return clean(node.textContent) === "سند مرکب" && node.querySelector("svg");
      });
      if (labelled) return labelled;
      var text = Array.from(article.querySelectorAll("span")).find(function (node) {
        return node.childElementCount === 0 && clean(node.textContent) === "سند مرکب";
      });
      return text && text.parentElement && text.parentElement.tagName === "SPAN" && clean(text.parentElement.textContent) === "سند مرکب" ? text.parentElement : text;
    };
    var ensureRow = function (article) {
      var anchor = article.querySelector(".hesabno-tx-project-chip, .hesabno-tx-family-chip, [data-hesabno-tx-status-badge]");
      var row = article.querySelector("[data-hesabno-metadata-canonical='true']") || anchor && anchor.parentElement || article.querySelector("[data-hesabno-tx-status-meta], [data-hesabno-tx-metadata-row]");
      if (row) return row;
      var shell = article.firstElementChild;
      if (!shell) return null;
      row = document.createElement("div");
      row.className = "flex items-center gap-1.5 mt-1.5 pt-1 border-t border-stone-700/30 w-full overflow-x-auto no-scrollbar py-0.5";
      row.setAttribute("data-hesabno-tx-metadata-row", "true");
      shell.appendChild(row);
      return row;
    };
    var sync = function () {
      document.querySelectorAll("article[id^='tx-card-']").forEach(function (article) {
        var badge = findCompoundBadge(article);
        if (!badge) return;
        var row = ensureRow(article);
        if (!row) return;
        badge.setAttribute("data-hesabno-compound-badge", "true");
        if (badge.parentElement !== row) row.appendChild(badge);
      });
    };
    sync();
     if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, sync);
  })();
