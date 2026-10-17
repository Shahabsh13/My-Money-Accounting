(function () {
  var svgNS = "http://www.w3.org/2000/svg";
  var clamp = function (value, min, max) { return Math.max(min, Math.min(max, value)); };
  var clampTooltips = function () {
    document.querySelectorAll("div.overflow-visible.justify-between").forEach(function (chart) {
      var wall = chart.getBoundingClientRect();
      chart.querySelectorAll('button > div.absolute > div.absolute.whitespace-nowrap[class*="translate-x-1"]').forEach(function (tooltip) {
        var shell = tooltip.parentElement;
        var button = tooltip.closest("button");
        if (!shell || !button) return;
        var width = tooltip.offsetWidth || tooltip.getBoundingClientRect().width;
        if (!width) return;
        var buttonRect = button.getBoundingClientRect();
        var shellRect = shell.getBoundingClientRect();
        var desired = buttonRect.left + buttonRect.width / 2 - width / 2;
        var left = clamp(desired, wall.left, wall.right - width) - shellRect.left;
        tooltip.style.setProperty("left", left + "px", "important");
        tooltip.style.setProperty("right", "auto", "important");
        tooltip.style.setProperty("transform", "none", "important");
      });
    });
  };
  var fix = function () {
    document.querySelectorAll('svg[viewBox="0 0 360 120"]').forEach(function (svg) {
      svg.style.setProperty("overflow", "visible", "important");
      var shell = svg.parentElement;
      for (var level = 0; shell && level < 3; level++, shell = shell.parentElement) shell.style.setProperty("overflow", "visible", "important");
      var groups = Array.from(svg.querySelectorAll("g.cursor-pointer"));
      groups.forEach(function (group) {
        var hit = group.querySelector("rect");
        if (!hit) return;
        var x = Number(hit.getAttribute("x")) || 0;
        var width = Number(hit.getAttribute("width")) || 0;
        var center = clamp(x + width / 2, 0, 360);
        hit.setAttribute("x", String(Math.max(0, x)));
        hit.setAttribute("width", String(Math.max(1, Math.min(width, 360 - Math.max(0, x)))));
        if (group.querySelector("circle")) return;
        var marker = document.createElementNS(svgNS, "circle");
        marker.setAttribute("cx", String(center));
        marker.setAttribute("cy", "98");
        marker.setAttribute("r", "2.5");
        marker.setAttribute("fill", "#a3a3a3");
        marker.setAttribute("stroke", "none");
        marker.setAttribute("data-hesabno-zero-point", "true");
        group.appendChild(marker);
      });
    });
    clampTooltips();
  };
  fix();
  if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, fix);
  window.addEventListener("resize", clampTooltips);
  document.addEventListener("click", function (event) {
    var button = event.target && event.target.closest ? event.target.closest("button") : null;
    if (!button || !button.parentElement) return;
    var classes = String(button.parentElement.className || "");
    if (classes.indexOf("overflow-visible") < 0 || classes.indexOf("justify-between") < 0) return;
    window.setTimeout(clampTooltips, 0);
    window.setTimeout(clampTooltips, 180);
  }, true);
})();
