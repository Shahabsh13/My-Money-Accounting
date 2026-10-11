(function () {
      var normalize = function (value) { return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase(); };
      var accounts = function () {
        try { return JSON.parse(localStorage.getItem("hesabno:accounts_v5") || "[]"); }
        catch (error) { return []; }
      };
      var pictureFor = function (label, group, list) {
        var key = normalize(label);
        var match = list.find(function (account) {
          return account && account.group === group && (
            normalize(account.name) === key || String(account.id) === key || String(account.code || "") === key
          );
        });
        return match && match.picture ? match.picture : "";
      };
      var hide = function (element) {
        if (!element) return;
        element.setAttribute("data-hesabno-today-hidden", "true");
        element.setAttribute("aria-hidden", "true");
      };
      var sync = function () {
        var list = accounts();
        document.querySelectorAll("section").forEach(function (section) {
          var heading = section.querySelector("h2");
          var label = heading && heading.textContent || "";
          var group = label.indexOf("هزینه‌های امروز") >= 0 ? "expense" : label.indexOf("درآمدهای امروز") >= 0 ? "income" : "";
          if (!group) return;
          var transactions = Array.from(section.children).find(function (child) {
            return child.classList.contains("bg-stone-900/60") && child.classList.contains("divide-y");
          });
          if (!transactions) return;
          Array.from(transactions.children).forEach(function (row) {
            if (row.children.length < 3) return;
            var icon = row.children[0];
            var details = row.children[1];
            var titleLine = details && details.children[0];
            var paymentLine = details && details.children[1];
            var parts = paymentLine ? Array.from(paymentLine.children).filter(function (part) { return part.tagName === "SPAN"; }) : [];
            if (parts.length < 3) return;
            var accountPart = group === "expense" ? parts[0] : parts[2];
            var categoryPart = group === "expense" ? parts[2] : parts[0];
            var arrowPart = parts[1];
            var picture = pictureFor(categoryPart.textContent, group, list);
            if (picture) icon.setAttribute("data-hesabno-today-category-icon", picture);
            else icon.removeAttribute("data-hesabno-today-category-icon");
            hide(titleLine && Array.from(titleLine.children).find(function (child) {
              return child.tagName === "SPAN" && child.textContent.trim().charAt(0) === "#";
            }));
            hide(categoryPart);
            hide(arrowPart);
            paymentLine.setAttribute("data-hesabno-today-payment", group);
            if (accountPart) accountPart.style.color = "#a8a29e";
            var amountLine = row.children[2];
            var lines = amountLine ? Array.from(amountLine.children).filter(function (child) { return child.tagName === "P"; }) : [];
            hide(lines[lines.length - 1]);
          });
        });
      };
      var queued = false;
      var schedule = function () {
        if (queued) return;
        queued = true;
        Promise.resolve().then(function () { queued = false; sync(); });
      };
      sync();
      if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
      window.addEventListener("storage", schedule);
    })();
