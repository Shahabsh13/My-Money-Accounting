(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var cleanLabel = function (value) { return clean(value).replace(/^[\$%٪*]+\s*/, ""); };
    var ignoredTypes = ["hidden", "button", "submit", "reset", "image"];
    var inferLabel = function (field) {
      for (var node = field; node && node !== document.body; node = node.parentElement) {
        if (node.tagName === "LABEL") {
          var wrapped = cleanLabel(node.innerText || node.textContent);
          if (wrapped) return wrapped;
        }
        var previous = node.previousElementSibling;
        if (previous && !previous.contains(field)) {
          var precedingText = cleanLabel(previous.innerText || previous.textContent);
          if (precedingText && precedingText.length <= 100) return precedingText;
        }
        var label = Array.from(node.children).find(function (candidate) {
          return !candidate.contains(field) && (candidate.tagName === "LABEL" || candidate.tagName === "LEGEND" || candidate.hasAttribute("data-field-label")) && clean(candidate.innerText || candidate.textContent);
        });
        if (label) return cleanLabel(label.innerText || label.textContent);
      }
      var placeholder = cleanLabel(field.getAttribute("placeholder"));
      if (placeholder && !/^[\d۰-۹٠-٩\s.,٬/:+-]+$/.test(placeholder)) return placeholder;
      return "";
    };
    var errorSequence = 0;
    var linkError = function (field) {
      var error = null;
      var depth = 0;
      for (var node = field.parentElement; node && depth < 4 && node.tagName !== "MAIN" && node.tagName !== "SECTION" && node.tagName !== "ARTICLE"; node = node.parentElement, depth += 1) {
        var otherControl = Array.from(node.querySelectorAll("input, textarea, select")).some(function (candidate) { return candidate !== field; });
        if (otherControl) break;
        error = Array.from(node.querySelectorAll('[role="alert"], [data-field-error], [class*="text-red-"], [class*="text-rose-"]'))
          .find(function (candidate) {
            if (candidate.contains(field) || candidate.hasAttribute("data-hesabno-money-rtl") || candidate.classList.contains("hesabno-transaction-day-total")) return false;
            return Boolean(clean(candidate.innerText || candidate.textContent));
          });
        if (error) break;
      }
      var previousId = field.dataset.hesabnoFieldErrorId;
      if (error) {
        if (!error.id) error.id = "hesabno-field-error-" + (++errorSequence);
        var descriptionIds = clean(field.getAttribute("aria-describedby")).split(/\s+/).filter(Boolean);
        if (descriptionIds.indexOf(error.id) === -1) {
          descriptionIds.push(error.id);
          field.setAttribute("aria-describedby", descriptionIds.join(" "));
        }
        if (field.dataset.hesabnoFieldErrorId !== error.id) field.dataset.hesabnoFieldErrorId = error.id;
        if (!field.hasAttribute("aria-invalid")) {
          field.setAttribute("aria-invalid", "true");
          if (field.dataset.hesabnoFieldInvalid !== "true") field.dataset.hesabnoFieldInvalid = "true";
        }
      } else if (previousId) {
        var remainingIds = clean(field.getAttribute("aria-describedby")).split(/\s+/).filter(function (id) { return id && id !== previousId; });
        if (remainingIds.length) field.setAttribute("aria-describedby", remainingIds.join(" "));
        else field.removeAttribute("aria-describedby");
        delete field.dataset.hesabnoFieldErrorId;
        if (field.dataset.hesabnoFieldInvalid === "true") {
          field.removeAttribute("aria-invalid");
          delete field.dataset.hesabnoFieldInvalid;
        }
      }
    };
    var update = function () {
      document.querySelectorAll("input, textarea, select").forEach(function (field) {
        if (ignoredTypes.indexOf(String(field.type || "").toLowerCase()) !== -1 || field.closest('[aria-hidden="true"]')) return;
        var previousLabel = field.dataset.hesabnoInferredLabel;
        var hasNativeLabel = Boolean(field.labels && field.labels.length) || Boolean(field.closest("label"));
        var hasExplicitName = field.hasAttribute("aria-labelledby") || field.hasAttribute("aria-label") && field.getAttribute("aria-label") !== previousLabel;
        if (!hasNativeLabel && !hasExplicitName) {
          var label = inferLabel(field);
          if (label) {
            if (field.getAttribute("aria-label") !== label) field.setAttribute("aria-label", label);
            if (field.dataset.hesabnoInferredLabel !== label) field.dataset.hesabnoInferredLabel = label;
          }
        }
        linkError(field);
      });
    };
    var numericAmount = function (value) {
      var digits = String(value || "").replace(/[۰-۹]/g, function (d) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)); }).replace(/[٠-٩]/g, function (d) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(d)); }).replace(/\D/g, "");
      return Number(digits) || 0;
    };
    var isFieldMandatoryEmpty = function (field) {
      if (!field || field.disabled || field.readOnly || field.type === "hidden" || field.type === "checkbox" || field.type === "radio") return false;
      var val = clean(field.value);
      var isMoneyOrNumeric = field.getAttribute("dir") === "ltr" || field.getAttribute("inputmode") === "numeric" || (field.className && field.className.indexOf("font-mono") !== -1);
      var lbl = inferLabel(field);
      var isMoneyLabel = lbl.indexOf("مبلغ") !== -1 || lbl.indexOf("سقف") !== -1 || lbl.indexOf("تعداد اقساط") !== -1 || lbl.indexOf("تعداد دوره") !== -1;
      if (isMoneyOrNumeric && isMoneyLabel) {
        return numericAmount(val) <= 0;
      }
      return !val;
    };
    var setSubmitInvalidVisual = function (field, invalid) {
      if (!field) return;
      if (invalid) {
        field.setAttribute("aria-invalid", "true");
        field.setAttribute("data-hesabno-invalid", "true");
        field.dataset.hesabnoSubmitInvalid = "true";
        field.classList.add("border-rose-500/80", "bg-rose-500/5", "ring-1", "ring-rose-500/30");
      } else if (field.dataset.hesabnoSubmitInvalid === "true" || field.hasAttribute("data-hesabno-invalid")) {
        field.removeAttribute("aria-invalid");
        field.removeAttribute("data-hesabno-invalid");
        delete field.dataset.hesabnoSubmitInvalid;
        field.classList.remove("border-rose-500/80", "bg-rose-500/5", "ring-1", "ring-rose-500/30");
      }
    };
    var highlightEmptyMandatoryInScope = function (scope) {
      if (!scope || !scope.querySelectorAll) return;
      scope.querySelectorAll("input, textarea, select").forEach(function (field) {
        if (ignoredTypes.indexOf(String(field.type || "").toLowerCase()) !== -1 || field.closest('[aria-hidden="true"]')) return;
        var lbl = inferLabel(field);
        var isRequired = field.required || field.hasAttribute("required") || field.getAttribute("aria-required") === "true" || ((lbl.indexOf("*") !== -1 || lbl.indexOf("الزامی") !== -1 || lbl.indexOf("اجباری") !== -1) && lbl.indexOf("اختیاری") === -1);
        if (!isRequired) return;
        setSubmitInvalidVisual(field, isFieldMandatoryEmpty(field));
      });
    };
    var handlePotentialSubmitClick = function (event) {
      var btn = event.target && event.target.closest ? event.target.closest("button") : null;
      if (!btn || btn.disabled) return;
      var txt = clean(btn.textContent);
      var isFooterSubmit = Boolean(btn.closest(".hesabno-sticky-form-footer")) && txt.indexOf("انصراف") === -1 && txt.indexOf("بستن") === -1 && txt.indexOf("حذف") === -1;
      var isFormSubmit = btn.type === "submit" || isFooterSubmit || /^(ثبت|ذخیره|ایجاد|تایید و صدور)/.test(txt);
      if (!isFormSubmit) return;
      if (/^(ثبت وام جدید|ثبت قسط جدید|ثبت میانبر جدید|ثبت چک جدید|ثبت تراکنش|ثبت مجدد سند|ارسال الگوی جدید)$/.test(txt)) return;
      var scope = btn.closest("form");
      if (!scope) {
        var footer = btn.closest(".hesabno-sticky-form-footer");
        if (footer && footer.previousElementSibling && footer.previousElementSibling.tagName === "FORM") {
          scope = footer.previousElementSibling;
        } else if (footer && footer.parentElement) {
          scope = footer.parentElement;
        } else {
          scope = btn.closest('.hesabno-bank-form-page, [role="dialog"], main');
        }
      }
      if (scope) {
        highlightEmptyMandatoryInScope(scope);
        window.setTimeout(function () { highlightEmptyMandatoryInScope(scope); }, 0);
      }
    };
    var handleFieldInputClear = function (event) {
      var field = event.target;
      if (!field || !field.matches || !field.matches("input, textarea, select")) return;
      if (!isFieldMandatoryEmpty(field)) {
        setSubmitInvalidVisual(field, false);
      }
    };
    var frame = 0;
    var schedule = function () {
      if (frame) return;
      frame = 1;
      Promise.resolve().then(function () { frame = 0; try { update(); } catch (error) {} });
    };
    window.__hesabnoUpdateAccessibleFields = update;
    window.__hesabnoHighlightEmptyMandatoryInScope = highlightEmptyMandatoryInScope;
    window.addEventListener("load", update, { once: true });
    window.addEventListener("click", schedule, true);
    window.addEventListener("focusin", schedule, true);
    document.addEventListener("click", handlePotentialSubmitClick, true);
    document.addEventListener("click", schedule, true);
    document.addEventListener("input", handleFieldInputClear, true);
    document.addEventListener("change", handleFieldInputClear, true);
    document.addEventListener("focusin", schedule, true);
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, characterData: true, subtree: true }, schedule);
    try { update(); } catch (error) {}
    window.setTimeout(function () { try { update(); } catch (error) {} }, 150);
  })();
