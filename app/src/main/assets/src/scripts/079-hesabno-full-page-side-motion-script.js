/* Preserve the app's custom Back-stack behavior without delaying navigation for motion. */
(function () {
  var root = document.getElementById("root");
  if (!root) return;
  var replaying = false;

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (target && target.nodeType !== 1) target = target.parentElement;
    var button = target && target.closest ? target.closest('button[title="بازگشت"]') : null;
    if (!button || button.getAttribute("aria-label") || replaying) return;

    // The native React handler owns transaction Back; do not intercept or delay it.
    var main = button.closest("main");
    if (main && main.querySelector("#field-amount-input")) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    replaying = true;
    var handled = typeof window.__hesabnoNavigateBack === "function" && window.__hesabnoNavigateBack();
    if (!handled) {
      if (typeof window.__hesabnoHoldBackNavigation === "function") window.__hesabnoHoldBackNavigation();
      button.click();
    }
    replaying = false;
  }, true);
})();
