(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var forms = [
      { title: "ثبت وام بانکی و تسهیلات", shortTitle: "وام بانکی" },
      { title: "ثبت خرید اقساطی کالا و خدمات", shortTitle: "خرید اقساطی" }
    ];
    var pageTitles = ["وام‌ها و تسهیلات", "خرید و اقساط"];
    /* قواعد عنوان و پاک‌سازی فرم وام/خرید اقساطی در بستهٔ ۲۳۵ (لایهٔ ظاهر) قرار دارد. */
    var sync = function () {
      Array.from(document.querySelectorAll("main")).forEach(function (main) {
        Array.from(main.querySelectorAll("h1")).forEach(function (heading) {
          var title = heading.firstElementChild;
          if (!title || pageTitles.indexOf(clean(title.textContent)) === -1) return;
          var count = Array.from(heading.children).find(function (node) { return node !== title; });
          if (count && count.getAttribute("data-hesabno-list-count-hidden") !== "true") {
            count.setAttribute("data-hesabno-list-count-hidden", "true");
            count.setAttribute("aria-hidden", "true");
          }
          var description = heading.nextElementSibling;
          if (description && description.tagName === "P" && description.getAttribute("data-hesabno-list-description-hidden") !== "true") {
            description.setAttribute("data-hesabno-list-description-hidden", "true");
          }
        });
        Array.from(main.querySelectorAll("h2")).forEach(function (heading) {
          var headingText = clean(heading.textContent);
          var config = forms.find(function (item) { return headingText === item.title; });
          if (!config && headingText.indexOf("ویرایش:") === 0) {
            var sectionTitle = clean(main.querySelector("h1") && main.querySelector("h1").textContent);
            config = sectionTitle.indexOf("وام‌ها و تسهیلات") === 0 ? forms[0]
              : sectionTitle.indexOf("خرید و اقساط") === 0 ? forms[1]
              : null;
          }
          if (!config) return;
          if (heading.getAttribute("data-hesabno-form-header-title") !== "true") heading.setAttribute("data-hesabno-form-header-title", "true");
          var description = heading.nextElementSibling;
          if (description && description.tagName === "P" && description.getAttribute("data-hesabno-form-short-title") !== config.shortTitle) {
            description.setAttribute("data-hesabno-form-short-title", config.shortTitle);
            description.setAttribute("aria-label", config.shortTitle);
          }
        });
        Array.from(main.querySelectorAll("form")).forEach(function (form) {
          var presetLabel = Array.from(form.querySelectorAll("span")).find(function (node) { return clean(node.textContent) === "الگوهای پرکاربرد سریع:"; });
          if (presetLabel && presetLabel.parentElement && presetLabel.parentElement.getAttribute("data-hesabno-form-presets-hidden") !== "true") {
            presetLabel.parentElement.setAttribute("data-hesabno-form-presets-hidden", "true");
          }
        });
      });
    };
    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(function () { scheduled = false; sync(); });
    };
    sync();
    document.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("button") : null;
      var text = clean(button && button.textContent);
      if (!text.includes("ثبت") && text !== "وام و تسهیلات" && text !== "خرید و اقساط") return;
      [80, 250, 500].forEach(function (delay) { window.setTimeout(sync, delay); });
    }, true);
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, attributes: true, attributeFilter: ["class", "style", "hidden"], subtree: true }, schedule);
  })();
