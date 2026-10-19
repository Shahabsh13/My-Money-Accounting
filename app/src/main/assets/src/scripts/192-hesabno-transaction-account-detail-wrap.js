(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var enhance = function () {
      document.querySelectorAll("div.overflow-x-auto.no-scrollbar").forEach(function (container) {
        var content = container.firstElementChild;
        if (!content || !content.classList.contains("whitespace-nowrap")) return;
        var labels = Array.from(content.querySelectorAll("span")).map(function (node) { return clean(node.textContent); });
        if (labels.indexOf("از:") === -1 || labels.indexOf("به:") === -1) return;
        container.style.overflowX = "hidden";
        container.style.minWidth = "0";
        container.style.maxWidth = "100%";
        content.classList.remove("whitespace-nowrap");
        content.classList.add("flex-wrap");
        content.style.whiteSpace = "normal";
        content.style.minWidth = "0";
        content.style.maxWidth = "100%";
        content.style.rowGap = "0.25rem";
        content.querySelectorAll("span.font-semibold").forEach(function (name) {
          name.style.minWidth = "0";
          name.style.maxWidth = "100%";
          name.style.whiteSpace = "normal";
          name.style.overflowWrap = "anywhere";
        });
        content.querySelectorAll("span").forEach(function (node) {
          if (!node.classList.contains("font-semibold")) node.style.flexShrink = "0";
        });
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
  })();
