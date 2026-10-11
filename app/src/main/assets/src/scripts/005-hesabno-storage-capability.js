(function () {
  var memory = window.__hesabnoMemoryStorage = window.__hesabnoMemoryStorage || {};
  var nativeStorage = null;
  var persistent = false;
  var probe = "__hesabno_storage_probe_v1";
  var previousProbeValue = null;
  var probeRead = false;
  try {
    nativeStorage = window.localStorage;
    previousProbeValue = nativeStorage.getItem(probe);
    probeRead = true;
    nativeStorage.setItem(probe, "1");
    persistent = nativeStorage.getItem(probe) === "1";
    if (previousProbeValue === null) nativeStorage.removeItem(probe);
    else nativeStorage.setItem(probe, previousProbeValue);
  } catch (error) {
    try {
      if (nativeStorage) {
        if (probeRead && previousProbeValue !== null) nativeStorage.setItem(probe, previousProbeValue);
        else nativeStorage.removeItem(probe);
      }
    } catch (cleanupError) {}
  }
  if (!persistent) {
    var removed = Object.create(null);
    var keys = function () {
      var result = [];
      try { for (var i = 0; nativeStorage && i < nativeStorage.length; i += 1) { var key = nativeStorage.key(i); if (key != null && !removed[key]) result.push(key); } } catch (error) {}
      Object.keys(memory).forEach(function (key) { if (!removed[key] && result.indexOf(key) === -1) result.push(key); });
      return result;
    };
    var fallback = {
      getItem: function (key) {
        key = String(key);
        if (removed[key]) return null;
        if (Object.prototype.hasOwnProperty.call(memory, key)) return memory[key];
        try { return nativeStorage ? nativeStorage.getItem(key) : null; } catch (error) { return null; }
      },
      setItem: function (key, value) {
        key = String(key); value = String(value);
        try { if (nativeStorage) { nativeStorage.setItem(key, value); delete memory[key]; delete removed[key]; return; } } catch (error) {}
        memory[key] = value;
        delete removed[key];
      },
      removeItem: function (key) {
        key = String(key);
        delete memory[key];
        try { if (nativeStorage) { nativeStorage.removeItem(key); delete removed[key]; return; } } catch (error) {}
        if (nativeStorage) removed[key] = true;
      },
      clear: function () {
        var existing = keys();
        try {
          if (nativeStorage) {
            nativeStorage.clear();
            Object.keys(memory).forEach(function (key) { delete memory[key]; });
            Object.keys(removed).forEach(function (key) { delete removed[key]; });
            return;
          }
        } catch (error) {}
        existing.forEach(function (key) { delete memory[key]; if (nativeStorage) removed[key] = true; });
      },
      key: function (index) { return keys()[Number(index)] || null; }
    };
    Object.defineProperty(fallback, "length", { get: function () { return keys().length; } });
    try { Object.defineProperty(window, "localStorage", { configurable: true, enumerable: true, value: fallback }); } catch (error) {}
  }
  window.__hesabnoStoragePersistent = persistent;
  if (!persistent) {
    var showWarning = function () {
      if (!document.body || document.getElementById("hesabno-storage-warning")) return;
      var banner = document.createElement("div");
      banner.id = "hesabno-storage-warning";
      banner.setAttribute("role", "alert");
      banner.setAttribute("aria-live", "assertive");
      banner.style.cssText = "position:fixed;top:8px;left:8px;right:8px;z-index:2147483647;display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:1px solid #b45309;border-radius:14px;background:#fff7ed;color:#7c2d12;box-shadow:0 8px 28px rgba(15,23,42,.28);font:600 13px/1.7 system-ui,sans-serif;direction:rtl";
      var message = document.createElement("span");
      message.textContent = "ذخیره‌سازی ماندگار در این مرورگر در دسترس نیست. داده‌ها فقط تا زمان بسته‌شدن یا تازه‌سازی این صفحه می‌مانند؛ اطلاعات مالی واقعی وارد نکنید.";
      var close = document.createElement("button");
      close.type = "button";
      close.setAttribute("aria-label", "بستن هشدار ذخیره‌سازی موقت");
      close.textContent = "×";
      close.style.cssText = "flex:0 0 auto;border:0;background:transparent;color:inherit;font-size:22px;line-height:1;cursor:pointer";
      close.addEventListener("click", function () { banner.remove(); });
      banner.appendChild(message);
      banner.appendChild(close);
      document.body.appendChild(banner);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showWarning, { once: true });
    else showWarning();
  }
})();
