(function () {
    /* قواعد جایگاه حباب نمودار روزانه در بستهٔ ۲۳۵ قرار دارد. */
    var style = function () {};
    var sync = function () {
      var columns = Array.from(document.querySelectorAll("button")).filter(function (button) {
        var className = String(button.className || "");
        return className.includes("flex-1") && className.includes("h-full") && className.includes("flex-col") && className.includes("items-center") && className.includes("justify-end") && className.includes("relative") && className.includes("min-w-[");
      });
      if (!columns.length) return;
      style();
      columns.forEach(function (button, index) {
        var tooltip = button.querySelector("div.whitespace-nowrap");
        if (!tooltip) return;
        var position = index < columns.length / 3 ? "left" : index >= columns.length * 2 / 3 ? "right" : "center";
        if (tooltip.getAttribute("data-hesabno-daily-tooltip-position") !== position) tooltip.setAttribute("data-hesabno-daily-tooltip-position", position);
      });
    };
    var queued = false;
    var schedule = function () {
      if (queued) return;
      queued = true;
      Promise.resolve().then(function () { queued = false; sync(); });
    };
    sync();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
  })();
