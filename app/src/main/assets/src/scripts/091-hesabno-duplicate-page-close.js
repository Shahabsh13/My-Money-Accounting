(function () {
  var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
  var layerSelector = 'main, [role="dialog"], [class*="fixed"][class*="inset-0"]';
  var isBack = function (button) {
    return button.getAttribute("aria-label") === "بازگشت" || button.getAttribute("title") === "بازگشت" || clean(button.textContent) === "بازگشت";
  };
  var isDuplicateClose = function (button) {
    var text = clean(button.textContent);
    return text === "بستن" || text === "بستن و بازگشت";
  };
  var enhance = function () {
    document.querySelectorAll("button").forEach(function (backButton) {
      if (!isBack(backButton)) return;
      var layer = backButton.closest(layerSelector);
      if (!layer) return;
      layer.querySelectorAll("button").forEach(function (button) {
        if (button === backButton || button.closest(layerSelector) !== layer) return;
        if (isDuplicateClose(button)) button.remove();
      });
    });
  };
  enhance();
  if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, enhance);
})();
