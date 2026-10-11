(function () {
  var root = document.getElementById("root");
  if (!root) return;
  var active = null;
  var replaying = false;
  var target = function () {
    var back = root.querySelector('button[title="بازگشت"]');
    if (!back || back.getAttribute("aria-label")) return null;
    return back.closest('[class*="min-h-screen"]') || back.closest("div");
  };
  var markOpen = function () {
    var next = target();
    if (!next) { active = null; return; }
    if (active === next && next.classList.contains("hesabno-full-page-side-open")) return;
    active = next;
    next.classList.remove("hesabno-full-page-side-exit", "hesabno-full-page-side-open");
    void next.offsetWidth;
    next.classList.add("hesabno-full-page-side-open");
  };
  var observer = new MutationObserver(function () { requestAnimationFrame(markOpen); });
  observer.observe(root, { childList: true, subtree: true });
  document.addEventListener("click", function (event) {
    var button = event.target && event.target.closest ? event.target.closest('button[title="بازگشت"]') : null;
    if (!button || button.getAttribute("aria-label") || replaying) return;
    var page = button.closest('[class*="min-h-screen"]') || button.closest("div");
    if (!page) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    page.classList.remove("hesabno-full-page-side-open");
    page.classList.add("hesabno-full-page-side-exit");
     window.setTimeout(function () {
       replaying = true;
       var handled = typeof window.__hesabnoNavigateBack === "function" && window.__hesabnoNavigateBack();
       if (!handled) {
         if (typeof window.__hesabnoHoldBackNavigation === "function") window.__hesabnoHoldBackNavigation();
         button.click();
       }
       replaying = false;
     }, 420);
  }, true);
  markOpen();
})();
