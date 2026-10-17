(function () {
  var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
  var layerSelector = '[role="dialog"], [class*="fixed"][class*="inset-0"], .hesabno-dashboard-panel';
  var isTextClose = function (button) {
    return clean(button.textContent) === "بستن" || clean(button.textContent) === "بستن و بازگشت";
  };
  var enhance = function () {
    document.querySelectorAll(layerSelector).forEach(function (layer) {
      var buttons = Array.from(layer.querySelectorAll("button")).filter(function (button) {
        return button.closest(layerSelector) === layer;
      });
      buttons.filter(isTextClose).forEach(function (button) { button.remove(); });
    });
  };
  enhance();
  if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, enhance);
})();
