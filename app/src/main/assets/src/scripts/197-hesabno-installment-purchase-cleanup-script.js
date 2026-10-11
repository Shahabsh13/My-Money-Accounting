(function () {
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var update = function () {
      var main = Array.from(document.querySelectorAll("main")).find(function (candidate) {
        var heading = clean(candidate.querySelector("h1") && candidate.querySelector("h1").textContent);
        return heading.indexOf("خرید و اقساط") === 0;
      });
      if (!main) return;
      Array.from(main.querySelectorAll("label")).forEach(function (label) {
        if (clean(label.textContent) !== "نام فروشگاه / ارائه‌دهنده / طرف حساب (اختیاری)") return;
        var field = label.parentElement;
        if (!field) return;
        field.dataset.hesabnoOptionalStoreProviderField = "true";
        field.setAttribute("aria-hidden", "true");
      });
      Array.from(main.querySelectorAll("div.rounded-3xl.p-4 p")).forEach(function (summary) {
        var text = clean(summary.textContent);
        if (text.indexOf("تاریخ ثبت:") !== 0) return;
        var parts = text.match(/^تاریخ ثبت:\s*([^•]+?)\s*•\s*([0-9۰-۹٠-٩٬,]+)\s*(قسط|سهم)/);
        if (!parts) return;
        var simpleText = "تاریخ ثبت: " + parts[1].trim() + " • " + parts[2] + " " + parts[3];
        if (summary.textContent !== simpleText) summary.textContent = simpleText;
        summary.dataset.hesabnoInstallmentSummaryDateCount = "true";
      });
    };
    var frame = 0;
    var schedule = function () {
      if (frame) return;
      frame = requestAnimationFrame(function () { frame = 0; update(); });
    };
    update();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, characterData: true, subtree: true });
  })();
