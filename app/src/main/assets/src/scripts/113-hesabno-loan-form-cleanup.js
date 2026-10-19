(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var setRaw = function (input, value) {
      if (!input) return;
      var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, String(value == null ? "" : value));
    };
    var removePercent = function (main) {
      if (!main) return;
      main.setAttribute("data-hesabno-loan-no-percent", "true");
      main.querySelectorAll("[data-hesabno-interest-wrap]").forEach(function (node) { node.remove(); });
      main.querySelectorAll("[data-hesabno-principal-toman]").forEach(function (node) { node.remove(); });
      Array.from(main.querySelectorAll("label")).filter(function (label) {
        return clean(label.textContent).includes("درصد سود / کارمزد");
      }).forEach(function (label) {
        var field = label.closest(".space-y-1\\.5");
        if (field) field.remove();
      });
      var count = main.querySelector('input[placeholder*="۱۲"]');
      var countField = count && count.closest(".space-y-1\\.5");
      var section = countField && countField.parentElement;
      if (section) section.setAttribute("data-hesabno-loan-installment-section", "true");
    };
    var sync = function () {
      var main = Array.from(document.querySelectorAll("main")).find(function (node) {
        return clean(node.textContent).includes("ثبت وام بانکی و تسهیلات");
      });
      if (!main) return;
      removePercent(main);
      var count = main.querySelector('input[placeholder*="۱۲"]');
      if (!count || count.dataset.hesabnoCountCleanupBound) return;
      count.dataset.hesabnoCountCleanupBound = "true";
      var faDigits = "۰۱۲۳۴۵۶۷۸۹";
      var rawDigits = function () { return String(count.value || "").replace(/[۰-۹]/g, function (digit) { return String(faDigits.indexOf(digit)); }).replace(/[^0-9]/g, ""); };
      var normalize = function () {
        var raw = rawDigits().replace(/^0+/, "");
        setRaw(count, raw.replace(/[0-9]/g, function (digit) { return faDigits[Number(digit)]; }));
      };
      var clearPristine = function () {
        var raw = rawDigits();
        if (!count.dataset.hesabnoCountUser && (!raw || /^0+$/.test(raw) || raw === "1" || raw === "12")) setRaw(count, "");
      };
      clearPristine();
      [0, 80, 240, 600, 1000].forEach(function (delay) { window.setTimeout(clearPristine, delay); });
      count.addEventListener("focus", clearPristine, true);
      count.addEventListener("beforeinput", function (event) {
        var raw = rawDigits();
        if (event.isTrusted && (!raw || /^0+$/.test(raw) || (!count.dataset.hesabnoCountUser && (raw === "1" || raw === "12")))) setRaw(count, "");
      }, true);
      count.addEventListener("input", function (event) {
        if (event.isTrusted) count.dataset.hesabnoCountUser = "true";
        normalize();
        if (!rawDigits()) count.dataset.hesabnoCountCleared = "true";
        else if (event.isTrusted) count.removeAttribute("data-hesabno-count-cleared");
        window.setTimeout(function () {
          if (count.dataset.hesabnoCountCleared === "true" && rawDigits() === "1") setRaw(count, "");
          normalize();
        }, 0);
      }, true);
      count.addEventListener("blur", normalize, true);
    };
    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(function () { scheduled = false; sync(); });
    };
    sync();
    document.addEventListener("click", schedule, true);
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
  })();
