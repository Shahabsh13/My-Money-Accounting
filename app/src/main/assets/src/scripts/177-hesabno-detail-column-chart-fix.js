(function () {
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var mark = function (node, key) { if (node) node.dataset[key] = "true"; };
    var fix = function () {
      Array.from(document.querySelectorAll("h3")).forEach(function (heading) {
        var title = clean(heading.textContent);
        if (title !== "مقایسه جزیی" && title !== "مقایسه جزئی") return;
        var card = heading.parentElement && heading.parentElement.parentElement;
        if (!card) return;
        var chart = Array.from(card.querySelectorAll("div")).find(function (node) {
          return node.classList.contains("h-64") && node.classList.contains("select-none") && node.children.length === 2;
        });
        if (!chart) return;
        var axis = chart.children[0];
        var plot = chart.children[1];
        var grid = plot && plot.children[0];
        var bars = plot && plot.children[1];
        if (!axis || !plot || !grid || !bars || !bars.classList.contains("min-w-max")) return;
        mark(chart, "hesabnoColumnChartRoot");
        mark(axis, "hesabnoColumnChartAxis");
        mark(plot, "hesabnoColumnChartPlot");
        mark(grid, "hesabnoColumnChartGrid");
        mark(bars, "hesabnoColumnChartBars");
        Array.from(bars.children).forEach(function (bar) {
          mark(bar, "hesabnoColumnChartBar");
          var slot = bar.children[1];
          var labelSlot = bar.children[2];
          mark(slot, "hesabnoColumnChartSlot");
          mark(slot && slot.firstElementChild, "hesabnoColumnChartFill");
          mark(labelSlot, "hesabnoColumnChartLabelSlot");
          mark(labelSlot && labelSlot.querySelector("span"), "hesabnoColumnChartLabel");
        });
      });
    };
    var frame = 0;
    var schedule = function () {
      if (frame) return;
      frame = requestAnimationFrame(function () { frame = 0; fix(); });
    };
    fix();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, characterData: true, subtree: true });
    window.addEventListener("resize", schedule, { passive: true });
  })();
