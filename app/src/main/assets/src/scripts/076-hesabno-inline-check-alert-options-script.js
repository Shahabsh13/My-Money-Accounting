(function () {
  var root = document.getElementById("root");
  if (!root) return;
  var options = [
    { value: "1", label: "۱ روز قبل از سررسید" },
    { value: "2", label: "۲ روز قبل از سررسید" },
    { value: "3", label: "۳ روز قبل از سررسید (پیش‌فرض)" },
    { value: "5", label: "۵ روز قبل از سررسید" },
    { value: "7", label: "۱ هفته قبل از سررسید" }
  ];
  var findAlertDialog = function () {
    var heading = Array.from(document.querySelectorAll("h3")).find(function (item) { return item.textContent.trim() === "هشدار سررسید چک‌ها"; });
    return heading ? heading.closest('div[class*="max-w-sm"]') : null;
  };
  var setup = function () {
    var panel = document.querySelector(".hesabno-notification-check-panel");
    if (!panel || panel.dataset.hesabnoInlineCheckOptions === "ready") return;
    var notificationDialog = panel.closest('div[class*="max-w-sm"]');
    var originalButton = notificationDialog && Array.from(notificationDialog.querySelectorAll("button")).find(function (button) { return button.textContent.trim() === "تنظیم هشدار سررسید چک‌ها" && !button.closest(".hesabno-notification-check-panel"); });
    if (!originalButton) return;

    var existingProxy = panel.querySelector("button");
    if (existingProxy) existingProxy.remove();
    var rowText = (document.querySelector("#setting-row-notifications") || {}).textContent || "";
    var selected = rowText.indexOf("۱ روز") !== -1 ? "1" : rowText.indexOf("۲ روز") !== -1 ? "2" : rowText.indexOf("۵ روز") !== -1 ? "5" : rowText.indexOf("۱ هفته") !== -1 ? "7" : "3";
    var list = document.createElement("div");
    list.className = "hesabno-check-options";
    options.forEach(function (option) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "hesabno-check-option";
      button.textContent = option.label;
      button.dataset.value = option.value;
      button.addEventListener("click", function () {
        selected = option.value;
        Array.from(list.children).forEach(function (item) { item.dataset.active = String(item.dataset.value === selected); });
      });
      list.appendChild(button);
    });
    var confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition";
    confirm.textContent = "تأیید";
    confirm.addEventListener("click", function () {
      var alertDialog = findAlertDialog();
      if (!alertDialog) originalButton.click();
      window.setTimeout(function () {
        alertDialog = findAlertDialog();
        if (!alertDialog) return;
        alertDialog.style.visibility = "hidden";
        var realOption = Array.from(alertDialog.querySelectorAll("div.space-y-2 > div")).find(function (item) { return item.textContent.trim().indexOf(options.find(function (option) { return option.value === selected; }).label) === 0; });
        if (realOption) realOption.click();
        var realConfirm = Array.from(alertDialog.querySelectorAll("button")).find(function (button) { return button.textContent.trim() === "تأیید"; });
        if (realConfirm) realConfirm.click();
      }, 0);
    });
    panel.appendChild(list);
    panel.appendChild(confirm);
    Array.from(list.children).forEach(function (item) { item.dataset.active = String(item.dataset.value === selected); });
    panel.dataset.hesabnoInlineCheckOptions = "ready";
  };
  new MutationObserver(setup).observe(root, { childList: true, subtree: true });
  setup();
})();
