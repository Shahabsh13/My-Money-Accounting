(function () {
    var labels = ["مشاهده سررسیدها", "مشاهده وام‌ها", "مشاهده همه"];
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    /* ظاهر .hesabno-compact-widget-header و .hesabno-compact-widget-action از قبل در بستهٔ ۰۶۰
     * (از منبع 126-hesabno-compact-widget-actions-style.css) قرار دارد؛ این‌جا فقط کلاس معنایی می‌گذاریم. */
    var enhance = function () {
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
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, enhance);
  })();
