(function () {
  var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
  var enhance = function () {
    var manager = document.getElementById("hesabno-project-family-page");
    if (manager) {
      var activeTab = manager.querySelector('.hpf-tab[data-active="true"]');
      var emptyManager = manager.querySelector(".hpf-empty");
      var managerMessage = activeTab && activeTab.getAttribute("data-hpf-type") === "members" ? "هنوز عضو خانواده‌ای تعریف نشده است." : "هنوز پروژه‌ای تعریف نشده است.";
      if (emptyManager && emptyManager.textContent !== managerMessage) emptyManager.textContent = managerMessage;
    }
    document.querySelectorAll("p, span").forEach(function (node) {
      if (clean(node.textContent) === "هیچ حساب بانکی تعریف نشده است.") node.textContent = "هنوز حساب بانکی تعریف نشده است؛ از بخش حساب‌ها بانک خود را اضافه کنید.";
    });
    document.querySelectorAll(".fixed.inset-0").forEach(function (overlay) {
      var text = clean(overlay.innerText);
      var isProject = text.indexOf("انتخاب پروژه") !== -1;
      var isFamily = text.indexOf("انتخاب عضو خانواده") !== -1;
      if (!isProject && !isFamily) return;
      overlay.classList.add("hesabno-catalog-picker-overlay");
      overlay.querySelectorAll('[data-hpf-action="open-add"]').forEach(function (button) { button.remove(); });
      var list = overlay.querySelector('[class*="max-h-56"]');
      if (!list || list.querySelector(".hesabno-catalog-empty")) return;
      var defaultLabel = isProject ? "بدون پروژه" : "بدون انتساب (مشترک)";
      var hasItems = Array.from(list.querySelectorAll("button")).some(function (button) {
        return clean(button.textContent) !== defaultLabel;
      });
      if (hasItems) return;
      var empty = document.createElement("div");
      empty.className = "hesabno-catalog-empty";
      empty.textContent = isProject ? "هنوز پروژه‌ای تعریف نشده است." : "هنوز عضو خانواده‌ای تعریف نشده است.";
      list.appendChild(empty);
    });
  };
  enhance();
  if (document.body) new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
})();
