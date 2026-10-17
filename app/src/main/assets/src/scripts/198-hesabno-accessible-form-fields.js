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
      for (var node = field.parentElement; node; node = node.parentElement) {
        var otherControl = Array.from(node.querySelectorAll("input, textarea, select")).some(function (candidate) { return candidate !== field; });
        if (otherControl) break;
        error = Array.from(node.querySelectorAll('[role="alert"], [data-field-error], [class*="text-red-"], [class*="text-rose-"]'))
          .find(function (candidate) { return !candidate.contains(field) && clean(candidate.innerText || candidate.textContent); });
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
        field.dataset.hesabnoFieldErrorId = error.id;
        if (!field.hasAttribute("aria-invalid")) {
          field.setAttribute("aria-invalid", "true");
          field.dataset.hesabnoFieldInvalid = "true";
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
            field.setAttribute("aria-label", label);
            field.dataset.hesabnoInferredLabel = label;
          }
        }
        linkError(field);
      });
    };
    var frame = 0;
    var schedule = function () {
      if (frame) return;
      frame = window.setTimeout(function () { frame = 0; try { update(); } catch (error) {} }, 60);
    };
    window.__hesabnoUpdateAccessibleFields = update;
    window.addEventListener("load", update, { once: true });
    window.addEventListener("click", schedule, true);
    window.addEventListener("focusin", schedule, true);
    document.addEventListener("click", schedule, true);
    document.addEventListener("focusin", schedule, true);
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, characterData: true, subtree: true }, schedule);
    try { update(); } catch (error) {}
    window.setTimeout(function () { try { update(); } catch (error) {} }, 150);
  })();
