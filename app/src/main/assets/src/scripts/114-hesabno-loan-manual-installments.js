(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var amount = function (value) {
      var digits = String(value || "").replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); }).replace(/\D/g, "");
      return Number(digits) || 0;
    };
    var setRaw = function (input, value) {
      if (!input || input.value === value) return;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
    };
    var previewMoney = function (input, value) {
      var unitNode = input && input.closest(".relative");
      var unit = clean(unitNode && unitNode.querySelector("span") && unitNode.querySelector("span").textContent) || "ریال";
      return Math.round(Number(value) || 0).toLocaleString("fa-IR") + " " + unit;
    };
    var findMain = function () {
      return Array.from(document.querySelectorAll("main")).find(function (main) {
        var text = clean(main.textContent);
        return text.includes("ثبت وام بانکی و تسهیلات") || text.includes("ثبت خرید اقساطی کالا و خدمات");
      });
    };
    var findFields = function (main) {
      if (!main) return null;
      var purchase = clean(main.textContent).includes("ثبت خرید اقساطی کالا و خدمات");
      var name = purchase ? main.querySelector('input[placeholder*="قسط بیمه"]') : main.querySelector('input[placeholder*="وام مسکن"]');
      var count = main.querySelector('input[placeholder*="۱۲"]');
      var installment = main.querySelector('input[placeholder="مبلغ قسط"]');
      var submit = Array.from(main.querySelectorAll("button")).find(function (button) {
        return clean(button.textContent).includes(purchase ? "ثبت خرید اقساطی و ایجاد اقساط" : "ثبت وام و زمان‌بندی اقساط");
      });
      return (purchase || name) && count && installment && submit ? { name: name, count: count, installment: installment, submit: submit, purchase: purchase } : null;
    };
    var activeMain = null;
    var activeMode = null;
    var previewObserver = null;
    var resetSession = function (main) {
      if (!main) return;
      main.dataset.hesabnoManualCountEntered = "false";
      main.dataset.hesabnoManualInstallmentEntered = "false";
      var error = main.querySelector("[data-hesabno-loan-installments-error]");
      if (error) error.remove();
    };
    var clearUntouched = function (main) {
      if (!main || !main.isConnected || activeMain !== main || activeMode !== "create") return;
      var fields = findFields(main);
      if (!fields) return;
      if (main.dataset.hesabnoManualCountEntered !== "true") setRaw(fields.count, "");
      if (main.dataset.hesabnoManualInstallmentEntered !== "true") setRaw(fields.installment, "");
      var rows = Array.from(main.querySelectorAll("div")).filter(function (node) { return node.children.length === 2; });
      var installmentPreview = rows.find(function (node) { return node.children[0] && clean(node.children[0].textContent).startsWith("مبلغ هر قسط:"); });
      var countEntered = main.dataset.hesabnoManualCountEntered === "true";
      var installmentEntered = main.dataset.hesabnoManualInstallmentEntered === "true";
      if (fields.purchase && countEntered && installmentEntered && amount(fields.count.value) && amount(fields.installment.value)) {
        var count = Math.floor(amount(fields.count.value));
        var installment = amount(fields.installment.value);
        var installmentText = previewMoney(fields.installment, installment);
        if (installmentPreview && installmentPreview.children[1] && installmentPreview.children[1].textContent !== installmentText) installmentPreview.children[1].textContent = installmentText;
        var enteredTotalPreview = rows.find(function (node) { return node.children[0] && clean(node.children[0].textContent).startsWith("کل بازپرداخت"); });
        if (enteredTotalPreview) {
          var totalLabel = "کل بازپرداخت (" + count.toLocaleString("fa-IR") + " قسط):";
          var totalText = previewMoney(fields.installment, count * installment);
          if (enteredTotalPreview.children[0] && enteredTotalPreview.children[0].textContent !== totalLabel) enteredTotalPreview.children[0].textContent = totalLabel;
          if (enteredTotalPreview.children[1] && enteredTotalPreview.children[1].textContent !== totalText) enteredTotalPreview.children[1].textContent = totalText;
        }
        return;
      }
      if (installmentPreview && main.dataset.hesabnoManualInstallmentEntered !== "true" && installmentPreview.children[1]) {
        if (installmentPreview.children[1].textContent !== "—") installmentPreview.children[1].textContent = "—";
      }
      var totalPreview = rows.find(function (node) { return node.children[0] && clean(node.children[0].textContent).startsWith("کل بازپرداخت"); });
      if (totalPreview && (main.dataset.hesabnoManualCountEntered !== "true" || main.dataset.hesabnoManualInstallmentEntered !== "true")) {
        if (totalPreview.children[0] && totalPreview.children[0].textContent !== "کل بازپرداخت:") totalPreview.children[0].textContent = "کل بازپرداخت:";
        if (totalPreview.children[1] && totalPreview.children[1].textContent !== "—") totalPreview.children[1].textContent = "—";
      }
    };
    var scheduleClear = function (main) {
      [0, 80, 240, 600, 1000, 1600].forEach(function (delay) {
        window.setTimeout(function () { clearUntouched(main); }, delay);
      });
    };
    var showError = function (main, fields) {
      var missing = [];
      if (main.dataset.hesabnoManualCountEntered !== "true" || !amount(fields.count.value)) missing.push("تعداد اقساط");
      if (main.dataset.hesabnoManualInstallmentEntered !== "true" || !amount(fields.installment.value)) missing.push("مبلغ هر قسط");
      if (!missing.length) return false;
      var error = main.querySelector("[data-hesabno-loan-installments-error]");
      if (!error) {
        error = document.createElement("div");
        error.setAttribute("data-hesabno-loan-installments-error", "true");
        error.className = "rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300";
        fields.submit.parentElement.insertBefore(error, fields.submit);
      }
      error.textContent = "لطفاً " + missing.join(" و ") + " را وارد کنید.";
      return true;
    };
    var sync = function () {
      var main = findMain(), fields = findFields(main);
      if (!main) {
        if (previewObserver) { previewObserver.disconnect(); previewObserver = null; }
        resetSession(activeMain);
        activeMain = null;
        activeMode = null;
        return;
      }
      if (!fields) return;
      if (activeMain !== main) {
        if (previewObserver) { previewObserver.disconnect(); previewObserver = null; }
        resetSession(activeMain);
        activeMain = main;
        activeMode = fields.purchase ? "create" : clean(fields.name.value) ? "edit" : "create";
        resetSession(main);
        if (activeMode === "create") {
          previewObserver = new MutationObserver(function () { clearUntouched(main); });
          previewObserver.observe(main, { childList: true, subtree: true, characterData: true });
        }
      }
      if (activeMode !== "create") return;
      if (main.dataset.hesabnoManualInstallmentsBound !== "true") {
        main.dataset.hesabnoManualInstallmentsBound = "true";
        main.addEventListener("input", function (event) {
          var live = findFields(main);
          if (!live) return;
          if (event.isTrusted && event.target === live.count) main.dataset.hesabnoManualCountEntered = amount(live.count.value) ? "true" : "false";
          if (event.isTrusted && event.target === live.installment) main.dataset.hesabnoManualInstallmentEntered = amount(live.installment.value) ? "true" : "false";
          if (event.target.matches("input, select, textarea")) scheduleClear(main);
          if (main.dataset.hesabnoManualCountEntered === "true" && main.dataset.hesabnoManualInstallmentEntered === "true") {
            var error = main.querySelector("[data-hesabno-loan-installments-error]");
            if (error) error.remove();
          }
        }, true);
        main.addEventListener("change", function () { scheduleClear(main); }, true);
      }
      scheduleClear(main);
    };
    document.addEventListener("click", function (event) {
      sync();
      var main = findMain();
      if (main && main.contains(event.target) && activeMain === main && activeMode === "create") scheduleClear(main);
      var button = event.target && event.target.closest ? event.target.closest("button") : null;
      var fields = findFields(main);
      if (!button || !fields || button !== fields.submit || activeMain !== main || activeMode !== "create") return;
      if (showError(main, fields)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    }, true);
    sync();
    if (document.body) new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
  })();
