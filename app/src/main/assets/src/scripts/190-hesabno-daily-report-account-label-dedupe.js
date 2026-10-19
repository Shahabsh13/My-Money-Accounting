(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var normalize = function (value) {
      return clean(value).replace(/[۰-۹٠-٩]/g, function (digit) {
        var digits = "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩";
        var index = digits.indexOf(digit);
        return String(index < 10 ? index : index - 10);
      }).replace(/[يى]/g, "ی").replace(/ك/g, "ک")
        .replace(/[\u200c\u200f\u202a-\u202e]/g, "").replace(/[‐‑‒–—−]/g, "-")
        .replace(/\s+/g, " ").toLowerCase();
    };
    var readArray = function (key) {
      try {
        var raw = window.__safeGet ? window.__safeGet(key) : window.localStorage.getItem(key);
        var value = JSON.parse(raw || "null");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var bankNames = function () {
      var names = Object.keys(window.__HESABNO_OFFICIAL_BANK_LOGOS || {});
      ["hesabno:accounts_v5", "hesabno:accounts"].forEach(function (key) {
        readArray(key).forEach(function (account) {
          if (account && account.group === "bank") names.push(account.bankName || account.name);
        });
      });
      return Array.from(new Set(names.map(function (name) { return normalize(name).replace(/^بانک\s*/, ""); }).filter(Boolean)))
        .sort(function (left, right) { return right.length - left.length; });
    };
    var bankKey = function (value, names) {
      var text = normalize(value).replace(/^(?:از|به)\s*[:：]?\s*/, "").replace(/بانک\s*/g, "");
      for (var i = 0; i < names.length; i += 1) {
        var name = names[i];
        var index = text.indexOf(name);
        if (index < 0) continue;
        var before = text.slice(0, index);
        var after = text.slice(index + name.length);
        if ((!before || /[\s-]$/.test(before)) && (!after || /^[\s-]/.test(after))) return name;
      }
      return "";
    };
    var dedupeLine = function (node, names) {
      var original = clean(node.textContent);
      var parts = original.split(/\s*[•·]\s*/).map(clean).filter(Boolean);
      if (parts.length < 2) return;
      var changed = false;
      for (var i = 0; i < parts.length - 1; i += 1) {
        var leftBank = bankKey(parts[i], names);
        var rightBank = bankKey(parts[i + 1], names);
        if (!leftBank || leftBank !== rightBank) continue;
        var fromPrefix = (parts[i].match(/^از\s*[:：]?\s*/) || parts[i + 1].match(/^از\s*[:：]?\s*/) || [""])[0];
        var accountLabel = parts[i].length >= parts[i + 1].length ? parts[i] : parts[i + 1];
        accountLabel = accountLabel.replace(/^از\s*[:：]?\s*/, "");
        parts.splice(i, 2, fromPrefix ? fromPrefix + accountLabel : accountLabel);
        changed = true;
        i -= 1;
      }
      var updated = parts.join(" • ");
      if (changed && updated !== original) node.textContent = updated;
    };
    var enhance = function () {
      var heading = Array.from(document.querySelectorAll("h3")).find(function (node) {
        return clean(node.textContent).indexOf("تراکنش‌ها به تفکیک روز") === 0;
      });
      if (!heading) return;
      var card = heading.closest("div.bg-stone-850");
      if (!card) return;
      var names = bankNames();
      card.querySelectorAll('div.p-2.rounded-md p[class*="text-[10px]"]').forEach(function (node) {
        dedupeLine(node, names);
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
