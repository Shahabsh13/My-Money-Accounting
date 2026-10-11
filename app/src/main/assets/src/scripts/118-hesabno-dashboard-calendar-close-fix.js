(function () {
    return;
    var style = function () {
      if (document.querySelector("style[data-hesabno-dashboard-calendar-close-fix-style]")) return;
      var node = document.createElement("style");
      node.setAttribute("data-hesabno-dashboard-calendar-close-fix-style", "true");
      node.textContent = ".hesabno-dashboard-calendar-back{width:34px;height:34px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:23px;line-height:1;border-radius:50%} .hesabno-dashboard-calendar-back:hover{background:#dce9ee}";
      document.head.appendChild(node);
    };
    var sync = function () {
      var button = document.querySelector(".hesabno-dashboard-calendar-picker .hesabno-dashboard-calendar-back");
      if (!button) return;
      style();
      if (button.textContent !== "×") button.textContent = "×";
      button.setAttribute("aria-label", "بستن تقویم");
      button.setAttribute("title", "بستن");
    };
    sync();
    if (document.body) new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
  })();
