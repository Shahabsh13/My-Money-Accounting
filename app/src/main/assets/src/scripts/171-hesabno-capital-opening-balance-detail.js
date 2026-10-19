(function () {
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var asciiDigits = function (value) {
      return String(value == null ? "" : value).replace(/[۰-۹٠-٩]/g, function (digit) {
        var index = "۰۱۲۳۴۵۶۷۸۹".indexOf(digit);
        return String(index < 0 ? "٠١٢٣٤٥٦٧٨٩".indexOf(digit) : index);
      });
    };
    var amount = function (value) { return Number(asciiDigits(value).replace(/[^0-9-]/g, "")) || 0; };
    var rowFor = function (node, main) {
      while (node && node !== main) {
        if (node.classList.contains("p-3.5") && node.classList.contains("select-none")) return node;
        node = node.parentElement;
      }
      return null;
    };
    var update = function () {
      var main = Array.from(document.querySelectorAll("main")).find(function (candidate) {
        return Array.from(candidate.querySelectorAll("h1")).some(function (heading) {
          return clean(heading.textContent).replace(/\s/g, "") === "گزارشماندهها›سرمایه";
        });
      });
      if (!main) return;
      var totalLabel = Array.from(main.querySelectorAll("span")).find(function (node) { return clean(node.textContent) === "مانده کل سرفصل:"; });
      var totalNode = totalLabel && totalLabel.parentElement.querySelector("p");
      var totalText = clean(totalNode && totalNode.textContent);
      if (!totalNode || amount(totalText) <= 0) return;
      var rows = Array.from(main.querySelectorAll("h4")).map(function (heading) { return rowFor(heading, main); }).filter(Boolean);
      if (!rows.length || !rows.every(function (row) { return amount(row.lastElementChild && row.lastElementChild.querySelector("p") && row.lastElementChild.querySelector("p").textContent) === 0; })) return;
      var target = rows.find(function (row) { return clean(row.querySelector("h4") && row.querySelector("h4").textContent) === "سرمایه اولیه"; });
      if (!target) {
        var code = Array.from(main.querySelectorAll("span")).find(function (span) { return asciiDigits(span.textContent) === "3002"; });
        target = code && rowFor(code, main);
      }
      var valueNode = target && target.lastElementChild && target.lastElementChild.querySelector("p");
      if (!valueNode || clean(valueNode.textContent) === totalText) return;
      valueNode.textContent = totalText;
      valueNode.classList.remove("text-stone-500", "text-sm", "font-sans");
      valueNode.classList.add("text-stone-100");
      valueNode.dataset.hesabnoCapitalOpeningBalance = "true";
      valueNode.title = totalText;
      valueNode.setAttribute("aria-label", "مانده سرمایه اولیه " + totalText);
    };
    var frame = 0;
    var schedule = function () {
      if (frame) return;
      frame = 1;
      Promise.resolve().then(function () { frame = 0; update(); });
    };
    update();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, characterData: true, subtree: true }, schedule);
  })();
