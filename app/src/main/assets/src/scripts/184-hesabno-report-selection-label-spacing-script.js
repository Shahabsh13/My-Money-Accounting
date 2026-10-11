(function () {
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var accounts = function () {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:accounts_v5") : localStorage.getItem("hesabno:accounts_v5");
        var value = JSON.parse(raw || "null");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var fixTitle = function () {
      var heading = Array.from(document.querySelectorAll("h1, h2, h3, h4, [role='heading']")).find(function (node) {
        var text = clean(node.textContent).replace(/\s+/g, "");
        return text.indexOf("خلاصهگزارشات") === 0 && text.indexOf("تحلیل") !== -1;
      });
      if (!heading) return;
      heading.dataset.hesabnoReportAnalysisTitle = "true";
      var walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
      var nodes = [], current;
      while ((current = walker.nextNode())) nodes.push(current);
      nodes.forEach(function (node) {
        var value = node.nodeValue;
        if (/گزارشاتتحلیل/u.test(value)) node.nodeValue = value.replace(/گزارشات(?=تحلیل)/u, "گزارشات ");
      });
      nodes.forEach(function (node, index) {
        if (!clean(node.nodeValue).endsWith("گزارشات") || /\s$/.test(node.nodeValue)) return;
        var next = nodes.slice(index + 1).find(function (item) { return clean(item.nodeValue); });
        if (next && clean(next.nodeValue).startsWith("تحلیل") && !/^\s/.test(next.nodeValue)) node.nodeValue += " ";
      });
    };
    var hideMoeinBadges = function () {
      var list = accounts();
      var names = list.filter(function (account) {
        return account && account.parentId == null && list.some(function (child) { return child && String(child.parentId) === String(account.id); });
      }).map(function (account) { return clean(account.name); }).filter(Boolean);
      if (!names.length) return;
      Array.from(document.querySelectorAll('[data-hesabno-report-moein-badge="true"]')).forEach(function (node) {
        delete node.dataset.hesabnoReportMoeinBadge;
      });
      Array.from(document.querySelectorAll("span, small, label, div")).forEach(function (node) {
        if (clean(node.textContent) !== "معین") return;
        var parent = node.parentElement;
        for (var depth = 0; parent && depth < 5; depth += 1, parent = parent.parentElement) {
          var text = clean(parent.textContent);
          if (text.length <= 220 && /تفصیلی\s*[0-9۰-۹٠-٩]+/u.test(text) && names.some(function (name) { return text.indexOf(name) !== -1; })) {
            node.dataset.hesabnoReportMoeinBadge = "true";
            break;
          }
        }
      });
    };
    var update = function () {
      fixTitle();
      hideMoeinBadges();
    };
    var frame = 0;
    var schedule = function () {
      if (frame) return;
      frame = requestAnimationFrame(function () { frame = 0; update(); });
    };
    update();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, characterData: true, subtree: true });
    window.addEventListener("storage", function (event) {
      if (!event.key || event.key === "hesabno:accounts" || event.key === "hesabno:accounts_v5") schedule();
    });
  })();
