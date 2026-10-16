(function () {
  var root = document.getElementById("root");
  if (!root) return;
  var skipNextOpen = false;
  var replaying = false;
  var normalize = function (value) { return (value || "").replace(/\s+/g, " ").trim(); };
  var markPageOpen = function () {
    var main = root.querySelector("main");
    if (!main || !main.querySelector('button[aria-label="بازگشت"]')) return;
  if (Date.now() < Number(window.__hesabnoSuppressMotionUntil || 0)) {
    main.classList.remove("hesabno-page-enter", "hesabno-page-open-up", "hesabno-tab-horizontal-in", "hesabno-content-swap");
    main.dataset.hesabnoPageMotion = "open";
    return;
  }
    if (skipNextOpen) {
      skipNextOpen = false;
      main.dataset.hesabnoPageMotion = "open";
      main.classList.remove("hesabno-page-enter", "hesabno-page-open-up", "hesabno-content-swap");
      main.classList.add("hesabno-tab-horizontal-in");
      return;
    }
    if (main.dataset.hesabnoPageMotion === "open") return;
    main.dataset.hesabnoPageMotion = "open";
    main.classList.remove("hesabno-page-enter", "hesabno-content-swap");
    main.classList.add("hesabno-page-open-up");
  };
  var observer = window.__hesabnoDom.watch(root, { childList: true, subtree: true }, markPageOpen);
  document.addEventListener("click", function (event) {
    var button = event.target && event.target.closest ? event.target.closest("button") : null;
    if (!button || replaying) return;
    if (button.getAttribute("aria-label") === "بازگشت") {
      if (button.closest(".hesabno-account-picker-overlay")) return;
      var main = button.closest("main");
      if (!main || main.dataset.hesabnoPageMotion !== "open") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      main.classList.remove("hesabno-page-open-up", "hesabno-tab-horizontal-in");
      main.classList.add("hesabno-page-exit-down");
       window.setTimeout(function () {
         replaying = true;
         var handled = typeof window.__hesabnoNavigateBack === "function" && window.__hesabnoNavigateBack();
         if (!handled) {
           if (typeof window.__hesabnoHoldBackNavigation === "function") window.__hesabnoHoldBackNavigation();
           button.click();
         }
         replaying = false;
       }, 420);
      return;
    }
    var parentClass = button.parentElement && String(button.parentElement.className);
    var segmentedTabs = parentClass && parentClass.indexOf("grid-cols-2") !== -1 && parentClass.indexOf("rounded-2xl") !== -1;
    var scrollableTabs = parentClass && parentClass.indexOf("overflow-x-auto") !== -1 && Array.from(button.parentElement.children).filter(function (child) { return child.tagName === "BUTTON"; }).length > 1;
    if (segmentedTabs || scrollableTabs) {
      var tabMain = button.closest("main");
      if (tabMain && (tabMain.classList.contains("hesabno-tab-shell") || scrollableTabs)) {
        tabMain.classList.remove("hesabno-tab-horizontal-in");
        void tabMain.offsetWidth;
        tabMain.classList.add("hesabno-tab-horizontal-in");
      }
      skipNextOpen = true;
      window.setTimeout(function () { skipNextOpen = false; }, 500);
    }
  }, true);
  markPageOpen();
})();
