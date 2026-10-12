/* Keep bottom-tab navigation anchored at the top. The app shell is itself
   scrollable on desktop, while mobile WebView may scroll the document. */
(function () {
  var root = document.getElementById("root");
  if (!root) return;
  function resetScroll() {
    var outer = root.firstElementChild;
    var appShell = outer && outer.firstElementChild;
    [appShell, document.scrollingElement, document.documentElement, document.body].forEach(function (target) {
      if (!target) return;
      try { target.scrollTop = 0; target.scrollLeft = 0; } catch (_) {}
    });
  }
  function resetAfterNavigation() {
    resetScroll();
    window.requestAnimationFrame(function () { resetScroll(); window.requestAnimationFrame(resetScroll); });
    window.setTimeout(resetScroll, 60);
  }
  document.addEventListener("click", function (event) {
    var target = event.target;
    var button = target && target.closest ? target.closest("nav.fixed button") : null;
    if (button) resetAfterNavigation();
  }, true);
})();
