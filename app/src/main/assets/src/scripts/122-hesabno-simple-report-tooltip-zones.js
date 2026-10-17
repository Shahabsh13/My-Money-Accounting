(function () {
    var style = function () {
      if (document.querySelector("style[data-hesabno-simple-report-tooltip-zones-style]")) return;
      var node = document.createElement("style");
      node.setAttribute("data-hesabno-simple-report-tooltip-zones-style", "true");
      node.textContent = "[data-hesabno-daily-tooltip-position='left']{left:0!important;right:auto!important;transform:none!important;align-items:flex-start!important}[data-hesabno-daily-tooltip-position='center']{left:50%!important;right:auto!important;transform:translateX(-50%)!important;align-items:center!important}[data-hesabno-daily-tooltip-position='right']{left:auto!important;right:0!important;transform:none!important;align-items:flex-end!important}";
      document.head.appendChild(node);
    };
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
        tooltip.setAttribute("data-hesabno-daily-tooltip-position", position);
      });
    };
    sync();
     if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, function () { window.setTimeout(sync, 0); });
  })();
