(function () {
    var labels = ["مشاهده سررسیدها", "مشاهده وام‌ها", "مشاهده همه"];
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var style = function () {
      if (document.querySelector("style[data-hesabno-compact-widget-actions-style]")) return;
      var node = document.createElement("style");
      node.setAttribute("data-hesabno-compact-widget-actions-style", "true");
      node.textContent = ".hesabno-compact-widget-header{gap:6px!important;align-items:flex-start!important}.hesabno-compact-widget-header>div:first-child{min-width:0!important;flex:1 1 auto!important;align-items:flex-start!important}.hesabno-compact-widget-header>div:last-child{flex:0 0 auto!important;margin-left:0!important}.hesabno-compact-widget-header h2{min-width:0!important;max-width:100%!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;line-height:1.4!important}.hesabno-compact-widget-action{padding:3px 7px!important;gap:2px!important;font-size:10px!important;line-height:1.25!important;white-space:nowrap!important}.hesabno-compact-widget-action svg{width:11px!important;height:11px!important}@media (max-width:380px){.hesabno-compact-widget-action{padding:2px 5px!important;font-size:9px!important}.hesabno-compact-widget-header h2{font-size:12px!important}}";
      document.head.appendChild(node);
    };
    var enhance = function () {
      style();
      document.querySelectorAll("button").forEach(function (button) {
        if (labels.indexOf(clean(button.textContent)) === -1) return;
        button.classList.add("hesabno-compact-widget-action");
        var section = button.closest("section");
        if (!section) return;
        var header = Array.from(section.children).find(function (child) {
          return child.contains(button) && String(child.className || "").includes("justify-between");
        });
        if (header) header.classList.add("hesabno-compact-widget-header");
      });
    };
    enhance();
    if (document.body) new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
  })();
