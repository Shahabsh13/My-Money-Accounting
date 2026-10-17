(function () {
      var currencyKey = "hesabno:currency";
      var readUnit = function () {
        try {
          var value = window.__safeGet ? window.__safeGet(currencyKey) : localStorage.getItem(currencyKey);
          return value === "toman" ? "تومان" : "ریال";
        } catch (error) { return "ریال"; }
      };
      var clean = function (value) { return String(value || "").replace(/[\u061c\u200e\u200f\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim(); };
      var unitOnly = /^(?:ریال|تومان)$/u;
      var amountWithUnit = /^\s*[+\-−–]?\s*[0-9۰-۹٠-٩][0-9۰-۹٠-٩.,،٬٫\s\u00a0\u202f]*(?:ریال|تومان)?\s*$/u;
      var signedAmount = /^\s*[+\-−–]\s*[0-9۰-۹٠-٩][0-9۰-۹٠-٩.,،٬٫\s\u00a0\u202f]*(?:ریال|تومان)?\s*$/u;
      var trailingSign = /^\s*([0-9۰-۹٠-٩][0-9۰-۹٠-٩.,،٬٫\s\u00a0\u202f]*(?:ریال|تومان)?)\s*([+\-−–])\s*$/u;
      var rawSelector = 'input,textarea,select,option,script,style,[contenteditable="true"],[data-hesabno-raw-text="true"],[class~="whitespace-pre-wrap"][class~="select-all"][class~="font-mono"]';
      var isRaw = function (node) {
        if (!node || !node.closest) return false;
        if (node.closest(rawSelector)) return true;
        var overlay = node.closest("div.fixed.inset-0");
        var heading = overlay && overlay.querySelector("h2");
        return !!heading && clean(heading.textContent) === "واحد پول و جداسازی ارقام";
      };
      var isCurrencyChoice = function (node, value) {
        var text = clean(value);
        if (/^(?:ریال|تومان)\s*\((?:IRR|IRT)\)$/i.test(text)) return true;
        var button = node && node.closest && node.closest('button,[role="button"]');
        if (!button) return false;
        var parent = button.parentElement;
        if (!parent) return false;
        var options = Array.from(parent.querySelectorAll('button,[role="button"]')).map(function (item) { return clean(item.textContent); });
        return options.indexOf("ریال") >= 0 && options.indexOf("تومان") >= 0;
      };
      var normalizeCurrencyText = function (value, node, unit) {
        var text = clean(value);
        if (!text || isRaw(node) || isCurrencyChoice(node, text)) return value;
        if (/ریال/u.test(text) && /تومان/u.test(text)) return value;
        var hasUnit = /(?:ریال|تومان)/u.test(text);
        if (unitOnly.test(text) || amountWithUnit.test(text) && hasUnit) {
          return String(value).replace(/(?:ریال|تومان)/gu, unit);
        }
        return value;
      };
      var sync = function () {
        if (!document.body) return;
        var unit = readUnit();
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        var textNode;
        while ((textNode = walker.nextNode())) {
          var updated = normalizeCurrencyText(textNode.nodeValue, textNode.parentElement, unit);
          if (updated !== textNode.nodeValue) textNode.nodeValue = updated;
        }
        document.querySelectorAll("[title],[aria-label],[placeholder]").forEach(function (node) {
          if (isRaw(node) || isCurrencyChoice(node, node.getAttribute("aria-label") || node.textContent)) return;
          ["title", "aria-label", "placeholder"].forEach(function (name) {
            var value = node.getAttribute(name);
            if (value === null) return;
            var updated = normalizeCurrencyText(value, node, unit);
            if (updated !== value) node.setAttribute(name, updated);
          });
        });
        document.querySelectorAll("span,p,strong,b,small,div,button,li,td,th,label").forEach(function (node) {
          if (isRaw(node) || isCurrencyChoice(node, node.textContent)) return;
          // هر دو عبارت منظم علامت (+ − – یا -) لازم دارند؛ اگر متن علامت ندارد، خواندن innerText (که باعث چیدمان می‌شود) لازم نیست
          if (!/[+\-−–]/.test(node.textContent)) return;
          var text = clean(node.innerText || node.textContent);
          if (!signedAmount.test(text) && !trailingSign.test(text)) return;
          var match = text.match(trailingSign);
          if (match && Array.from(node.childNodes).every(function (child) { return child.nodeType === Node.TEXT_NODE; })) {
            var reordered = match[2] + " " + match[1].trim();
            if (node.textContent.trim() !== reordered) node.textContent = reordered;
            text = reordered;
          }
          if (signedAmount.test(text)) {
            node.removeAttribute("data-hesabno-money-ltr");
            node.setAttribute("data-hesabno-money-rtl", "true");
            node.setAttribute("dir", "rtl");
          }
        });
      };
      var queued = false;
      var schedule = function () {
        if (queued) return;
        queued = true;
        window.queueMicrotask(function () { queued = false; sync(); });
      };
      sync();
      if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true, characterData: true }, schedule);
      window.addEventListener("storage", function (event) { if (!event.key || event.key === currencyKey) schedule(); });
      try {
        var originalSetItem = Storage.prototype.setItem;
        if (!originalSetItem.__hesabnoCurrencySync) {
          var wrappedSetItem = function (key, value) {
            var result = originalSetItem.call(this, key, value);
            if (key === currencyKey) schedule();
            return result;
          };
          wrappedSetItem.__hesabnoCurrencySync = true;
          Storage.prototype.setItem = wrappedSetItem;
        }
      } catch (error) {}
    })();
