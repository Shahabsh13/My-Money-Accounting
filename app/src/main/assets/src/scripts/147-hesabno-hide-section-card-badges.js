(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var badgeStyle = document.createElement("style");
    badgeStyle.textContent = '[data-hesabno-section-card-badge-hidden="true"]{display:none!important}';
    document.head.appendChild(badgeStyle);
    var hasBadgeShape = function (node, radiusClass, fontSizeClass) {
      var classes = String(node.className || "");
      return node.tagName === "SPAN" && classes.indexOf("px-2") !== -1 && classes.indexOf("py-0.5") !== -1 &&
        classes.indexOf(radiusClass) !== -1 && classes.indexOf(fontSizeClass) !== -1 &&
        classes.indexOf("font-bold") !== -1 && classes.indexOf("border") !== -1;
    };
    var sync = function () {
      var main = document.querySelector("main");
      if (!main) return;
      var heading = main.querySelector("h1");
      var isMore = clean(heading && heading.textContent) === "بیشتر و امکانات";
      var modeTabs = main.querySelector(".hesabno-report-mode-tabs");
      var isAdvanced = !!modeTabs && Array.from(modeTabs.querySelectorAll("button")).some(function (button) {
        return clean(button.textContent) === "پیشرفته" && String(button.className).indexOf("bg-amber-400") !== -1;
      });
      main.querySelectorAll("button span").forEach(function (node) {
        var hide = isMore && hasBadgeShape(node, "rounded-full", "text-[9px]") ||
          isAdvanced && hasBadgeShape(node, "rounded-md", "text-[10px]");
        if (hide) node.setAttribute("data-hesabno-section-card-badge-hidden", "true");
        else node.removeAttribute("data-hesabno-section-card-badge-hidden");
      });
    };
    sync();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, sync);
  })();
