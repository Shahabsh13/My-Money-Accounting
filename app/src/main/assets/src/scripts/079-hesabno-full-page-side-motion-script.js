/* Keep the custom Back stack in sync without intercepting the page's real Back button. */
(function () {
  var root = document.getElementById("root");
  if (!root) return;

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (target && target.nodeType !== 1) target = target.parentElement;
    var button = target && target.closest ? target.closest('button[title="بازگشت"]') : null;
    if (!button || button.getAttribute("aria-label")) return;

    // Transaction composer Back is handled by its own React state and must not touch page history.
    var main = button.closest("main");
    if (main && main.querySelector("#field-amount-input")) return;

    // Let the original click reach React. Calling button.click() here would be ignored
    // when Android Back had already synthetically clicked this same button.
    if (typeof window.__hesabnoHoldBackNavigation === "function") {
      window.__hesabnoHoldBackNavigation();
    }
  }, true);
})();
