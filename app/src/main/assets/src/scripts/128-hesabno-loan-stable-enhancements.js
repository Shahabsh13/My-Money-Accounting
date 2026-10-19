(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var faDigits = "۰۱۲۳۴۵۶۷۸۹";
    var ascii = function (value) {
      return String(value || "").replace(/[۰-۹]/g, function (digit) { return String(faDigits.indexOf(digit)); });
    };
    var number = function (value) {
      var parsed = Number(ascii(value).replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    var state = { updating: false, timer: 0, scheduled: false };
    var findMain = function () {
      return Array.from(document.querySelectorAll("main")).find(function (main) {
        return clean(main.textContent).includes("ثبت وام بانکی و تسهیلات");
      });
    };
    var findFields = function (main) {
      if (!main) return null;
      var principal = main.querySelector('input[placeholder*="۵۰,۰۰۰,۰۰۰"]');
      var count = main.querySelector('input[placeholder*="۱۲"]');
      var installment = main.querySelector('input[placeholder="مبلغ قسط"]');
      return principal && count && installment ? { principal: principal, count: count, installment: installment } : null;
    };
    var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    var nativeSet = function (input, value) {
      if (input) setter.call(input, String(value == null ? "" : value));
    };
    var reactSet = function (input, value) {
      if (!input) return;
      nativeSet(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    /* قواعد پایدار فرم وام در بستهٔ ۲۳۵ (لایهٔ ظاهر) قرار دارد. */
    var ensureStyle = function () {};
    var hideSummary = function (input) {
      var field = input && input.closest(".space-y-1\\.5");
      var summary = field && Array.from(field.querySelectorAll("span")).find(function (node) {
        return String(node.className || "").includes("font-mono");
      });
      if (summary) summary.style.display = "none";
    };
    var ensureConversion = function (main, principal) {
      var field = principal && principal.closest(".space-y-1\\.5");
      var relative = principal && principal.closest(".relative");
      if (!field || !relative) return;
      var conversion = field.querySelector("[data-hesabno-principal-toman]");
      if (!conversion) {
        conversion = document.createElement("div");
        conversion.setAttribute("data-hesabno-principal-toman", "true");
        field.insertBefore(conversion, relative);
      }
      var unit = relative.querySelector("span");
      var unitText = clean(unit && unit.textContent);
      var opposite = unitText.includes("ریال") ? "تومان" : "ریال";
      var converted = number(principal.value) * (unitText.includes("ریال") ? 0.1 : 10);
      conversion.textContent = principal.value ? Math.round(converted).toLocaleString("fa-IR") + " " + opposite : "";
      principal.setAttribute("inputmode", "numeric");
      principal.setAttribute("autocomplete", "off");
    };
    var ensurePercent = function (main, fields) {
      var principalField = fields.principal.closest(".space-y-1\\.5");
      var principalSection = principalField && principalField.parentElement;
      var installmentField = fields.installment.closest(".space-y-1\\.5");
      var section = installmentField && installmentField.parentElement;
      var existing = main.querySelector('input[data-hesabno-interest-percent]');
      if (!section) return null;
      section.setAttribute("data-hesabno-loan-installment-section", "true");
      var countField = fields.count.closest(".space-y-1\\.5");
      if (countField) countField.setAttribute("data-hesabno-installment-count-field", "true");
      installmentField.setAttribute("data-hesabno-installment-field", "true");
      if (principalSection && principalSection !== section) principalSection.removeAttribute("data-hesabno-loan-amount-section");
      if (existing) {
        var existingWrapper = existing.closest("[data-hesabno-interest-wrap]");
        if (existingWrapper && existingWrapper.parentElement !== section) section.insertBefore(existingWrapper, installmentField.nextElementSibling);
        else if (existingWrapper && existingWrapper !== installmentField.nextElementSibling) section.insertBefore(existingWrapper, installmentField.nextElementSibling);
        return existing;
      }
      var wrapper = document.createElement("div");
      wrapper.className = "space-y-1.5";
      wrapper.setAttribute("data-hesabno-interest-wrap", "true");
      wrapper.innerHTML = '<label class="text-xs text-stone-300 font-medium flex items-center gap-1.5"><span class="text-emerald-400 font-bold">%</span><span>درصد سود / کارمزد</span></label><div class="relative"><input type="text" inputmode="decimal" placeholder="۰" dir="ltr" data-hesabno-interest-percent class="w-full bg-stone-800/80 border border-stone-700/80 rounded-2xl pl-4 pr-12 py-2.5 text-sm text-stone-100 font-mono focus:outline-none focus:border-emerald-500 transition"><span class="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 text-xs">٪</span></div>';
      section.insertBefore(wrapper, installmentField.nextElementSibling);
      return wrapper.querySelector('input[data-hesabno-interest-percent]');
    };
    var hideIconField = function (main) {
      var label = Array.from(main.querySelectorAll("span")).find(function (node) { return clean(node.textContent) === "آیکون نمایش:"; });
      var field = label && label.closest(".space-y-1\\.5");
      if (field) field.style.display = "none";
    };
    var bindUserFlag = function (main, input, key) {
      if (!input || input.dataset.hesabnoLoanUserBound) return;
      input.dataset.hesabnoLoanUserBound = "true";
      input.addEventListener("input", function (event) {
        if (event.isTrusted) main.dataset[key] = "true";
      });
    };
    var applyDerivedZeros = function (main) {
      window.clearTimeout(state.timer);
      state.timer = window.setTimeout(function () {
        var fields = findFields(main), percent = main.querySelector('input[data-hesabno-interest-percent]');
        if (!fields || !percent || !number(fields.principal.value)) return;
        var countUser = main.dataset.hesabnoLoanCountUser === "true";
        var installmentUser = main.dataset.hesabnoLoanInstallmentUser === "true";
        var percentUser = main.dataset.hesabnoLoanPercentUser === "true";
        state.updating = true;
        if (!countUser) reactSet(fields.count, "0");
        if (!installmentUser) reactSet(fields.installment, "0");
        state.updating = false;
        if (!percentUser) nativeSet(percent, "0");
      }, 0);
    };
    var bindLoan = function (main, fields, percent) {
      fields.count.setAttribute("inputmode", "numeric");
      fields.installment.setAttribute("inputmode", "numeric");
      percent.setAttribute("inputmode", "decimal");
      bindUserFlag(main, fields.count, "hesabnoLoanCountUser");
      bindUserFlag(main, fields.installment, "hesabnoLoanInstallmentUser");
      bindUserFlag(main, percent, "hesabnoLoanPercentUser");
      if (!fields.principal.dataset.hesabnoLoanPrincipalBound) {
        fields.principal.dataset.hesabnoLoanPrincipalBound = "true";
        fields.principal.addEventListener("input", function () { applyDerivedZeros(main); });
      }
      if (!percent.dataset.hesabnoLoanCalculationBound) {
        percent.dataset.hesabnoLoanCalculationBound = "true";
        percent.addEventListener("input", function () {
          if (state.updating) return;
          var liveFields = findFields(main), livePercent = main.querySelector('input[data-hesabno-interest-percent]');
          var principal = liveFields && number(liveFields.principal.value), count = liveFields && Math.round(number(liveFields.count.value)), rate = livePercent && Math.max(0, number(livePercent.value));
          if (!principal || !count || !rate) return;
          state.updating = true;
          reactSet(liveFields.installment, Math.round((principal + principal * rate / 100) / count));
          state.updating = false;
        });
      }
      if (!fields.installment.dataset.hesabnoLoanCalculationBound) {
        fields.installment.dataset.hesabnoLoanCalculationBound = "true";
        fields.installment.addEventListener("input", function () {
          if (state.updating) return;
          var liveFields = findFields(main), livePercent = main.querySelector('input[data-hesabno-interest-percent]');
          var principal = liveFields && number(liveFields.principal.value), count = liveFields && Math.round(number(liveFields.count.value)), installment = liveFields && number(liveFields.installment.value);
          if (!principal || !count || !installment || !livePercent) return;
          nativeSet(livePercent, Math.max(0, Math.round(((installment * count - principal) / principal) * 10000) / 100).toFixed(2));
        });
      }
    };
    var sync = function () {
      var main = findMain(), fields = findFields(main);
      if (!main || !fields) return;
      ensureStyle();
      hideSummary(fields.installment);
       hideIconField(main);
       fields.count.setAttribute("inputmode", "numeric");
       fields.installment.setAttribute("inputmode", "numeric");
       bindUserFlag(main, fields.count, "hesabnoLoanCountUser");
       bindUserFlag(main, fields.installment, "hesabnoLoanInstallmentUser");
    };
    var schedule = function () {
      if (state.scheduled) return;
      state.scheduled = true;
      window.setTimeout(function () { state.scheduled = false; sync(); }, 80);
    };
    sync();
    if (document.body) {
      document.addEventListener("click", function () {
        [80, 250, 700].forEach(function (delay) { window.setTimeout(schedule, delay); });
      }, true);
    }
    window.setTimeout(sync, 250);
    window.setTimeout(sync, 900);
  })();
