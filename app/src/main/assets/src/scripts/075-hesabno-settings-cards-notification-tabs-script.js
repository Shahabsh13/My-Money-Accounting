(function () {
  var root = document.getElementById("root");
  if (!root) return;
  var setup = function () {
    var headings = Array.from(root.querySelectorAll("h3"));
    headings.forEach(function (heading) {
      if ((heading.textContent || "").trim() !== "اعلان‌ها") return;
      var panel = heading.closest('div[class*="max-w-sm"]');
      if (!panel || panel.dataset.hesabnoNotificationTabs === "ready") return;
      var header = heading.parentElement && heading.parentElement.parentElement;
      var daily = panel.children[1];
      var saveButton = Array.from(panel.querySelectorAll("button")).find(function (button) { return button.textContent.trim() === "ذخیره اعلان‌ها"; });
      var checkButton = Array.from(panel.querySelectorAll("button")).find(function (button) { return button.textContent.trim() === "تنظیم هشدار سررسید چک‌ها"; });
      if (!header || !daily || !saveButton || !checkButton) return;

      var tabs = document.createElement("div");
      tabs.className = "hesabno-notification-tabs";
      tabs.setAttribute("data-hesabno-notification-tabs", "true");
      var dailyTab = document.createElement("button");
      dailyTab.type = "button";
      dailyTab.className = "hesabno-notification-tab";
      dailyTab.textContent = "یادآوری ثبت";
      var checksTab = document.createElement("button");
      checksTab.type = "button";
      checksTab.className = "hesabno-notification-tab";
      checksTab.textContent = "چک‌ها";
      tabs.append(dailyTab, checksTab);

      var checkPanel = document.createElement("div");
      checkPanel.className = "hesabno-notification-check-panel";
      checkPanel.innerHTML = "<strong>هشدار سررسید چک‌ها</strong><p>برای دریافت یادآوری چک‌های نزدیک به سررسید، هشدارهای چک را جداگانه تنظیم کنید.</p>";
      var checkProxy = document.createElement("button");
      checkProxy.type = "button";
      checkProxy.className = checkButton.className;
      checkProxy.textContent = "تنظیم هشدار سررسید چک‌ها";
      checkProxy.addEventListener("click", function () { checkButton.click(); });
      checkPanel.appendChild(checkProxy);

      header.insertAdjacentElement("afterend", tabs);
      panel.insertBefore(checkPanel, saveButton);
      checkButton.hidden = true;

      var setTab = function (tab) {
        var isDaily = tab === "daily";
        daily.hidden = !isDaily;
        saveButton.hidden = !isDaily;
        checkPanel.hidden = isDaily;
        dailyTab.dataset.active = String(isDaily);
        checksTab.dataset.active = String(!isDaily);
      };
      dailyTab.addEventListener("click", function () { setTab("daily"); });
      checksTab.addEventListener("click", function () { setTab("checks"); });
      panel.dataset.hesabnoNotificationTabs = "ready";
      setTab("daily");
    });
  };
  window.__hesabnoDom.watch(root, { childList: true, subtree: true }, setup);
  setup();
})();
