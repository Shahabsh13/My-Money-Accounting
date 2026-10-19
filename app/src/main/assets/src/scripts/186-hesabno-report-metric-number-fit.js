(function () {
    var labels = ["تراز خالص", "هزینه‌ها", "درآمدها"];
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var fitValue = function (node) {
      if (!node) return;
      var base = parseFloat(node.getAttribute("data-hesabno-fit-base-font-size"));
      if (!base) {
        base = parseFloat(getComputedStyle(node).fontSize) || 14;
        node.setAttribute("data-hesabno-fit-base-font-size", String(base));
      }
      node.style.whiteSpace = "nowrap";
      node.style.maxWidth = "100%";
      node.style.overflow = "hidden";
      node.style.textOverflow = "clip";
      var available = node.clientWidth;
      if (!available) return;
      var contentWidth = function () {
        var range = document.createRange();
        range.selectNodeContents(node);
        return Math.max(node.scrollWidth, range.getBoundingClientRect().width || 0);
      };
      var size = base;
      node.style.fontSize = size + "px";
      while (size > 7 && contentWidth() > available) {
        size = Math.max(7, size - 0.5);
        node.style.fontSize = size + "px";
      }
    };
    var sync = function () {
      var grid = Array.from(document.querySelectorAll("main div.grid.grid-cols-3")).find(function (node) {
        return node.children.length === 3 && labels.every(function (label) {
          return Array.from(node.querySelectorAll("span")).some(function (span) { return clean(span.textContent) === label; });
        });
      });
      if (!grid) return;
      Array.from(grid.children).forEach(function (card) {
        var label = Array.from(card.querySelectorAll("span")).map(function (span) { return clean(span.textContent); }).find(function (text) { return labels.indexOf(text) !== -1; });
        if (!label) return;
        fitValue(card.querySelector("p.truncate"));
      });
    };
    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(function () { scheduled = false; sync(); });
    };
    sync();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, characterData: true, subtree: true }, schedule);
    window.addEventListener("resize", schedule);
  })();
