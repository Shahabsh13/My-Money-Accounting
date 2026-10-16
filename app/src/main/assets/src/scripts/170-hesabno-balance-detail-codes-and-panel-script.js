(function () {
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var isCode = function (value) { return /^[0-9۰-۹٠-٩]{3,8}$/.test(clean(value)); };
    var update = function () {
      var main = Array.from(document.querySelectorAll("main")).find(function (candidate) {
        return Array.from(candidate.querySelectorAll("h1")).some(function (heading) {
          var text = clean(heading.textContent);
          return text.indexOf("گزارش مانده ها") === 0 && text.indexOf("›") !== -1;
        });
      });
      if (!main) return;
      Array.from(main.querySelectorAll("p")).forEach(function (paragraph) {
        if (clean(paragraph.textContent).indexOf("کدینگ سرفصل:") === 0) paragraph.dataset.hesabnoBalanceDetailCode = "true";
      });
      Array.from(main.querySelectorAll("span")).forEach(function (span) {
        if (span.classList.contains("font-mono") && span.className.indexOf("text-[9px]") !== -1 && isCode(span.textContent)) {
          span.dataset.hesabnoBalanceDetailCode = "true";
        }
      });
      Array.from(main.querySelectorAll("div.transition-colors")).forEach(function (entry) {
        var panel = Array.from(entry.children).find(function (child) {
          return child.classList.contains("mr-4") && child.classList.contains("my-1") && child.classList.contains("overflow-hidden");
        });
        if (panel) {
          entry.dataset.hesabnoBalanceDetailEntry = "true";
          panel.dataset.hesabnoBalanceDetailPanel = "true";
          entry.style.setProperty("background-color", "transparent", "important");
          panel.style.setProperty("background-color", "transparent", "important");
          panel.style.setProperty("border-right", "0", "important");
        } else {
          delete entry.dataset.hesabnoBalanceDetailEntry;
          entry.style.removeProperty("background-color");
        }
      });
    };
    var frame = 0;
    var schedule = function () {
      if (frame) return;
      frame = requestAnimationFrame(function () { frame = 0; update(); });
    };
    update();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, characterData: true, subtree: true }, schedule);
  })();
