(function () {
    var fixedKeys = ["payamBank", "checksCard", "quickAccess"];
    var hiddenLabels = ["ویجت پیامبانک و پیامک بانکی", "کارت یادآوری چک‌های صیادی", "ویجت دسترسی سریع"];
   var sanitize = function () {
     var config = {};
     try { config = JSON.parse(localStorage.getItem("hesabno:homeWidgets") || "{}"); } catch (error) {}
     var changed = false;
     fixedKeys.forEach(function (key) {
       if (config[key] !== false) { config[key] = false; changed = true; }
     });
     if (Array.isArray(config.order)) {
       var order = config.order.filter(function (key) { return fixedKeys.indexOf(key) === -1; });
       if (order.length !== config.order.length) { config.order = order; changed = true; }
     }
     if (!changed) return;
     try {
       localStorage.setItem("hesabno:homeWidgets", JSON.stringify(config));
       // This script runs before the app mounts, so the sanitized settings are read on first render.
       // Avoid a soft-reload loop when storage is volatile (for example, inside a sandboxed preview).
     } catch (error) {}
   };
   var hideOptions = function () {
     document.querySelectorAll("span").forEach(function (label) {
       if (hiddenLabels.indexOf(String(label.textContent || "").trim()) === -1) return;
       var row = label.closest("div.flex.items-center.justify-between");
       if (row) row.style.display = "none";
     });
   };
   sanitize();
   hideOptions();
   if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, hideOptions);
 })();
