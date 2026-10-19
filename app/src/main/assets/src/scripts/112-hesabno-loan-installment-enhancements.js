(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var faDigits = "۰۱۲۳۴۵۶۷۸۹";
    var digits = function (value) {
      return String(value || "").replace(/[۰-۹]/g, function (digit) { return faDigits.indexOf(digit); }).replace(/[^0-9.\-]/g, "");
    };
    var number = function (value) {
      var parsed = Number(digits(value));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    var money = function (value) {
      var unit = "ریال";
      try { unit = (window.__safeGet ? window.__safeGet("hesabno:currency") : localStorage.getItem("hesabno:currency")) === "toman" ? "تومان" : "ریال"; }
      catch (error) {}
      return Math.round(Number(value) || 0).toLocaleString("fa-IR") + " " + unit;
    };
    var setText = function (node, value) {
      if (node && node.textContent !== value) node.textContent = value;
    };
    var get = function (key) {
      try { return window.__safeGet ? window.__safeGet(key) : localStorage.getItem(key); } catch (error) { return null; }
    };
    var set = function (key, value) {
      try { window.__safeSet ? window.__safeSet(key, value) : localStorage.setItem(key, value); } catch (error) {}
    };
    var reactSet = function (input, value) {
      if (!input) return;
      var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, String(Math.round(Number(value) || 0)));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    var reactSetRaw = function (input, value) {
      if (!input) return;
      var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, String(value == null ? "" : value));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    var state = { updating: false };
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
      if (!principal || !count || !installment) return null;
      return { principal: principal, count: count, installment: installment };
    };
      var findPercent = function (main) { return main && main.querySelector("input[data-hesabno-interest-percent]"); };
      var removePercentField = function (main) {
        if (!main) return;
        var percent = findPercent(main);
        var wrapper = percent && (percent.closest("[data-hesabno-interest-wrap]") || percent.closest(".space-y-1\\.5"));
        if (wrapper) wrapper.remove();
        main.querySelectorAll("[data-hesabno-interest-wrap]").forEach(function (node) { node.remove(); });
        var installment = main.querySelector('input[placeholder="مبلغ قسط"]');
        var installmentField = installment && installment.closest(".space-y-1\\.5");
        var section = main.querySelector("[data-hesabno-installment-section]") || (installmentField && installmentField.parentElement);
        if (section) {
          section.setAttribute("data-hesabno-loan-installment-section", "true");
          section.querySelectorAll("[data-hesabno-interest-wrap]").forEach(function (node) { node.remove(); });
        }
      };
    /* قواعد فرم وام و اقساط در بستهٔ ۲۳۵ (لایهٔ ظاهر) قرار دارد. */
    var ensureLoanFormStyles = function () {};
    var updatePrincipalConversion = function (main, principal) {
      var conversion = main && main.querySelector("[data-hesabno-principal-toman]");
      var relative = principal && principal.closest(".relative");
      var unit = relative && relative.querySelector("span");
      if (!conversion || !unit) return;
      var currentUnit = clean(unit.textContent);
      var oppositeUnit = currentUnit.includes("ریال") ? "تومان" : "ریال";
      var amount = number(principal.value) * (currentUnit.includes("ریال") ? 0.1 : 10);
      var value = principal.value ? Math.round(amount).toLocaleString("fa-IR") + " " + oppositeUnit : "";
      if (conversion.textContent !== value) conversion.textContent = value;
    };
     var ensurePrincipalRialField = function (main, principal) {
       if (!main || !principal) return;
      var relative = principal.closest(".relative");
      if (!relative) return;
     var wrapper = relative.parentElement;
     var originalSummary = Array.from(wrapper.querySelectorAll("span")).find(function (node) {
       return String(node.className || "").includes("font-mono");
     });
     if (originalSummary) originalSummary.style.display = "none";
     var conversion = wrapper.querySelector("[data-hesabno-principal-toman]");
      if (!conversion) {
        conversion = document.createElement("div");
        conversion.setAttribute("data-hesabno-principal-toman", "true");
        wrapper.insertBefore(conversion, relative);
      }
       updatePrincipalConversion(main, principal);
     };
     var enhanceAmountInput = function (input) {
       if (!input || input.dataset.hesabnoAmountInputEnhanced) return;
       input.dataset.hesabnoAmountInputEnhanced = "true";
       input.setAttribute("inputmode", "numeric");
       input.setAttribute("autocomplete", "off");
       input.setAttribute("autocorrect", "off");
       input.setAttribute("spellcheck", "false");
       input.setAttribute("enterkeyhint", "done");
       input.addEventListener("input", function () {
         window.setTimeout(function () {
           if (document.activeElement !== input) return;
           try { input.setSelectionRange(input.value.length, input.value.length); } catch (error) {}
         }, 0);
       });
     };
     var hideInputSummary = function (input) {
       var field = input && input.closest(".space-y-1\\.5");
       var summary = field && Array.from(field.querySelectorAll("span")).find(function (node) {
         return String(node.className || "").includes("font-mono");
       });
       if (summary) summary.style.display = "none";
     };
      var setRawInput = function (input, value) {
        if (!input) return;
        var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(input, String(value == null ? "" : value));
      };
      var countDigits = function (input) {
        return String(input && input.value || "").replace(/[۰-۹]/g, function (digit) { return String(faDigits.indexOf(digit)); }).replace(/[^0-9]/g, "");
      };
      var normalizeCountInput = function (input) {
        if (!input) return;
        var raw = countDigits(input).replace(/^0+/, "");
        var next = raw.replace(/[0-9]/g, function (digit) { return faDigits[Number(digit)]; });
        if (input.value !== next) setRawInput(input, next);
      };
      var clearDefaultInstallments = function (main, fields) {
        var input = fields && fields.count;
        if (!input || input.dataset.hesabnoCountGuard) return;
        input.dataset.hesabnoCountGuard = "true";
        var clearPristine = function () {
          var raw = countDigits(input);
          if (!input.dataset.hesabnoCountUser && (!raw || /^0+$/.test(raw) || raw === "1" || raw === "12")) setRawInput(input, "");
        };
        clearPristine();
        [0, 80, 240, 600, 1000].forEach(function (delay) { window.setTimeout(clearPristine, delay); });
        input.addEventListener("focus", clearPristine, true);
        input.addEventListener("beforeinput", function (event) {
          var raw = countDigits(input);
          if (event.isTrusted && (!raw || /^0+$/.test(raw) || (!input.dataset.hesabnoCountUser && raw === "1"))) setRawInput(input, "");
        }, true);
        input.addEventListener("input", function (event) {
          if (event.isTrusted) input.dataset.hesabnoCountUser = "true";
          normalizeCountInput(input);
          if (!countDigits(input)) input.dataset.hesabnoCountCleared = "true";
          else if (event.isTrusted) input.removeAttribute("data-hesabno-count-cleared");
          window.setTimeout(function () {
            if (input.dataset.hesabnoCountCleared === "true" && countDigits(input) === "1") setRawInput(input, "");
            normalizeCountInput(input);
          }, 0);
        }, true);
        input.addEventListener("blur", function () { normalizeCountInput(input); }, true);
      };
     var setPreview = function (main, principal, count, total) {
      if (!main || !count || !total) return;
      var repaymentRow = Array.from(main.querySelectorAll("div")).filter(function (node) {
        return node.children.length === 2 && clean(node.textContent).indexOf("کل بازپرداخت (") === 0;
      }).sort(function (a, b) { return a.textContent.length - b.textContent.length; })[0];
      if (repaymentRow && repaymentRow.children[1]) setText(repaymentRow.children[1], money(total));
      var difference = Math.round(total - principal);
      var differenceRow = Array.from(main.querySelectorAll("div")).filter(function (node) {
        return node.children.length === 2 && clean(node.textContent).includes("مابه‌التفاوت بازپرداخت");
      }).sort(function (a, b) { return a.textContent.length - b.textContent.length; })[0];
      if (differenceRow) {
        if (difference === 0) {
          differenceRow.style.display = "none";
        } else {
          differenceRow.style.display = "flex";
          if (differenceRow.children[0]) setText(differenceRow.children[0], "سود / کارمزد واقعی:");
           if (differenceRow.children[1]) setText(differenceRow.children[1], money(difference));
        }
      }
      main.setAttribute("data-hesabno-target-total", String(Math.round(total)));
       main.removeAttribute("data-hesabno-target-interest-percent");
    };
    var calculateFromPercent = function (main, fields, percentInput) {
      var principal = number(fields.principal.value), count = Math.max(1, Math.round(number(fields.count.value))), percent = Math.max(0, number(percentInput.value));
      if (!principal || !count) return;
      var total = Math.round(principal + principal * percent / 100);
      var installment = Math.round(total / count);
      state.updating = true;
      reactSet(fields.installment, installment);
      state.updating = false;
      setPreview(main, principal, count, total, percent);
    };
     var calculateFromInstallment = function (main, fields) {
       var principal = number(fields.principal.value), count = Math.floor(number(fields.count.value)), installment = number(fields.installment.value);
       if (!principal || !count || !installment) { clearDerivedPreview(main, fields); return; }
       var total = Math.round(installment * count);
       setPreview(main, principal, count, total);
      };
     var nativeSet = function (input, value) {
       if (!input) return;
       var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
       setter.call(input, String(value));
     };
     var clearDerivedPreview = function (main, fields) {
       var unitNode = fields.installment && fields.installment.closest(".relative");
       var unit = clean(unitNode && unitNode.querySelector("span") && unitNode.querySelector("span").textContent) || "ریال";
       var rows = Array.from(main.querySelectorAll("div"));
       rows.filter(function (node) {
         return node.children.length === 2 && clean(node.textContent).indexOf("مبلغ هر قسط:") === 0;
       }).forEach(function (node) { if (node.children[1]) setText(node.children[1], "۰ " + unit); });
       rows.filter(function (node) {
         return node.children.length === 2 && clean(node.textContent).indexOf("کل بازپرداخت (") === 0;
       }).forEach(function (node) { if (node.children[1]) setText(node.children[1], "۰ " + unit); });
       rows.filter(function (node) {
         return node.children.length === 2 && clean(node.textContent).includes("مابه‌التفاوت بازپرداخت");
       }).forEach(function (node) { node.style.display = "none"; });
     };
     var bindDerivedZeroState = function (main, fields, percentInput) {
       var inputs = [fields.count, fields.installment, percentInput];
       if (!main.dataset.hesabnoDerivedTracker) {
         main.dataset.hesabnoDerivedTracker = "true";
         main.addEventListener("input", function (event) {
           if (!event.isTrusted || !event.target || event.target.tagName !== "INPUT") return;
           var target = event.target;
           if (String(target.placeholder || "").includes("۱۲")) main.dataset.hesabnoDerivedCountUser = "true";
           else if (target.placeholder === "مبلغ قسط") main.dataset.hesabnoDerivedInstallmentUser = "true";
           else if (target.hasAttribute("data-hesabno-interest-percent")) main.dataset.hesabnoDerivedPercentUser = "true";
         }, true);
       }
       inputs.forEach(function (input) {
         if (!input || input.dataset.hesabnoDerivedZeroBound) return;
         input.dataset.hesabnoDerivedZeroBound = "true";
         input.addEventListener("focus", function () {
           if (!input.dataset.hesabnoDerivedUser && number(input.value) === 0) input.select();
         });
         input.addEventListener("input", function (event) {
           if (event.isTrusted) input.dataset.hesabnoDerivedUser = "true";
         });
       });
       var enforceTimer = 0;
       return function enforce() {
         window.clearTimeout(enforceTimer);
         enforceTimer = window.setTimeout(function () {
          var liveFields = findFields(main), livePercent = findPercent(main);
          if (!liveFields || !livePercent || !number(liveFields.principal.value)) return;
          var calculationEdited = main.dataset.hesabnoDerivedInstallmentUser || main.dataset.hesabnoDerivedPercentUser;
          if (calculationEdited) return;
          if (!main.dataset.hesabnoDerivedCountUser) nativeSet(liveFields.count, 0);
          if (!main.dataset.hesabnoDerivedInstallmentUser) nativeSet(liveFields.installment, 0);
          if (!main.dataset.hesabnoDerivedPercentUser) nativeSet(livePercent, 0);
          clearDerivedPreview(main, liveFields);
        }, 120);
       };
     };
     var addPercentField = function (main, fields) {
      var existing = findPercent(main);
      if (existing) return existing;
      var wrapper = document.createElement("div");
      wrapper.className = "space-y-1.5";
      wrapper.setAttribute("data-hesabno-interest-wrap", "true");
       wrapper.innerHTML = '<label class="text-xs text-stone-300 font-medium flex items-center gap-1.5"><span class="text-emerald-400 font-bold">%</span><span>درصد سود / کارمزد</span></label><div class="relative"><input type="text" inputmode="decimal" placeholder="۰" dir="ltr" data-hesabno-interest-percent class="w-full bg-stone-800/80 border border-stone-700/80 rounded-2xl pl-4 pr-12 py-2.5 text-sm text-stone-100 font-mono focus:outline-none focus:border-emerald-500 transition"><span class="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 text-xs">٪</span></div>';
       var principalField = fields.principal.closest(".space-y-1\\.5");
       var section = principalField && principalField.parentElement;
       if (section && principalField) {
         section.setAttribute("data-hesabno-loan-amount-section", "true");
         principalField.setAttribute("data-hesabno-principal-field", "true");
         section.appendChild(wrapper);
       }
       return findPercent(main);
    };
    var hideIconField = function (main) {
      var labelText = Array.from(main.querySelectorAll("span")).find(function (node) { return clean(node.textContent) === "آیکون نمایش:"; });
      var field = labelText && labelText.closest(".space-y-1\\.5");
      if (field) field.style.display = "none";
    };
     var snapshotForm = function (main) {
       var fields = findFields(main), nameInput = main && main.querySelector('input[placeholder*="وام مسکن"]');
       var principal = fields && number(fields.principal.value), count = fields && Math.floor(number(fields.count.value)), installment = fields && number(fields.installment.value);
       var total = Math.round(installment * count);
       return { principal: principal, count: count, percent: 0, total: total, name: nameInput ? clean(nameInput.value) : "" };
    };
     var saveExactSchedule = function (main, snapshot) {
       var fields = findFields(main), form = snapshot || snapshotForm(main), principal = form.principal || (fields && number(fields.principal.value)), count = Number(form.count) || (fields && Math.floor(number(fields.count.value))) || 0, percent = 0, total = Number(form.total) || 0;
      if (!total || !principal || !count) return;
      var loans, installments;
      try {
        loans = JSON.parse(get("hesabno:loans") || "[]");
        installments = JSON.parse(get("hesabno:installments") || "[]");
      } catch (error) { return; }
      if (!Array.isArray(loans) || !Array.isArray(installments)) return;
      var candidates = loans.filter(function (loan) { return Number(loan.amount) === principal && Number(loan.installmentsCount) === count && (!form.name || loan.name === form.name); });
      if (!candidates.length) candidates = loans.filter(function (loan) { return Number(loan.amount) === principal && Number(loan.installmentsCount) === count; });
      var loan = candidates[candidates.length - 1];
      if (!loan) return;
      var rows = installments.filter(function (row) { return row.loanId === loan.id; }).sort(function (a, b) { return Number(a.installmentNumber) - Number(b.installmentNumber); });
      if (!rows.length) return;
      var beforeLast = rows.slice(0, -1).reduce(function (sum, row) { return sum + (Number(row.amount) || 0); }, 0);
      rows[rows.length - 1].amount = Math.max(0, Math.round(total - beforeLast));
      loan.totalRepaymentAmount = Math.round(total);
      loan.installmentAmount = Math.round(total / count);
       loan.interestPercent = 0;
      set("hesabno:loans", JSON.stringify(loans));
      set("hesabno:installments", JSON.stringify(installments));
    };
     var bind = function (main, fields) {
       if (fields.installment.dataset.hesabnoBound) return;
        fields.installment.dataset.hesabnoBound = "true";
        fields.installment.addEventListener("change", function () { if (!state.updating) calculateFromInstallment(main, fields); });
        [fields.principal, fields.count].forEach(function (input) {
          input.addEventListener("change", function () {
            if (state.updating) return;
            calculateFromInstallment(main, fields);
         });
        });
       var submit = Array.from(main.querySelectorAll("button")).find(function (button) { return clean(button.textContent).includes("ثبت وام و زمان‌بندی اقساط"); });
      if (submit) submit.addEventListener("click", function () { var form = snapshotForm(main); window.setTimeout(function () { saveExactSchedule(main, form); }, 900); }, true);
    };
    if (!window.__hesabnoLoanExactSaveBound) {
      window.__hesabnoLoanExactSaveBound = true;
      document.addEventListener("click", function (event) {
        var button = event.target && event.target.closest ? event.target.closest("button") : null;
        if (!button || !clean(button.textContent).includes("ثبت وام و زمان‌بندی اقساط")) return;
        var main = findMain();
        if (main) { var form = snapshotForm(main); window.setTimeout(function () { saveExactSchedule(main, form); }, 1200); }
      }, true);
    }
     var sync = function () {
       var main = findMain(), fields = findFields(main);
       if (!main || !fields) return;
       removePercentField(main);
        ensureLoanFormStyles();
        hideInputSummary(fields.installment);
        clearDefaultInstallments(main, fields);
       hideIconField(main);
        bind(main, fields);
        var principal = number(fields.principal.value), count = Math.floor(number(fields.count.value)), installment = number(fields.installment.value);
        if (principal && count && installment) setPreview(main, principal, count, Math.round(installment * count));
        else clearDerivedPreview(main, fields);
      };
    var syncScheduled = false;
    var syncBurstStarted = 0;
    var syncBurstCount = 0;
    var scheduleSync = function () {
      if (syncScheduled) return;
      var now = Date.now();
      if (!syncBurstStarted || now - syncBurstStarted > 1200) {
        syncBurstStarted = now;
        syncBurstCount = 0;
      }
       if (syncBurstCount >= 8) return;
       syncBurstCount += 1;
      syncScheduled = true;
      window.setTimeout(function () {
        syncScheduled = false;
        sync();
      }, 60);
     };
     sync();
     if (document.body) {
       document.addEventListener("click", function () {
         syncBurstStarted = 0;
         syncBurstCount = 0;
         [60, 180, 360].forEach(function (delay) { window.setTimeout(scheduleSync, delay); });
       }, true);
     }
  })();
