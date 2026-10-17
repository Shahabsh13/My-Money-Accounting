(function () {
  function updateValidationLinks() {
    document.querySelectorAll("form").forEach(function (form) {
      form.querySelectorAll("p").forEach(function (message, index) {
        var text = (message.textContent || "").trim();
        var invalid = /لطفاً|لطفا/.test(text);
        if (!invalid) {
          if (message.dataset.hesabnoValidationError === "true") {
            message.removeAttribute("data-hesabno-validation-error");
            message.removeAttribute("role");
            message.removeAttribute("aria-live");
            if (message.id) form.querySelectorAll("[aria-describedby]").forEach(function (control) {
              var ids = (control.getAttribute("aria-describedby") || "").split(/\s+/).filter(function (id) { return id && id !== message.id; });
              ids.length ? control.setAttribute("aria-describedby", ids.join(" ")) : control.removeAttribute("aria-describedby");
              control.removeAttribute("aria-invalid");
            });
          }
          return;
        }
        message.dataset.hesabnoValidationError = "true";
        if (!message.id) message.id = "hesabno-validation-error-" + index + "-" + Math.random().toString(36).slice(2, 8);
        message.setAttribute("role", "alert");
        message.setAttribute("aria-live", "polite");
        var lightTheme = document.documentElement.getAttribute("data-theme") === "light" || document.documentElement.classList.contains("theme-light");
        message.style.setProperty("color", lightTheme ? "#b42318" : "#fda4af", "important");
        var field = message.parentElement;
        var control = field && field.querySelector("input:not([type=hidden]), select, textarea, button");
        if (!control && message.previousElementSibling) {
          var previous = message.previousElementSibling;
          control = previous.matches("input:not([type=hidden]), select, textarea, button") ? previous : previous.querySelector("input:not([type=hidden]), select, textarea, button");
        }
        if (control) {
          control.setAttribute("aria-invalid", "true");
          var ids = (control.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
          if (ids.indexOf(message.id) === -1) ids.push(message.id);
          control.setAttribute("aria-describedby", ids.join(" "));
        }
      });
    });
  }

  var validationQueued = false;
  function sync() { updateValidationLinks(); }
  window.__hesabnoDom.watch(document.documentElement, { childList: true, characterData: true, subtree: true }, function (records) {
    var relevant = records.some(function (record) {
      var target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (target && target.closest("form")) return true;
      return Array.from(record.addedNodes).some(function (node) {
        return node.nodeType === 1 && (node.matches("form") || node.querySelector("form"));
      });
    });
    if (!relevant || validationQueued) return;
    validationQueued = true;
    queueMicrotask(function () { validationQueued = false; sync(); });
  });
  sync();
})();
