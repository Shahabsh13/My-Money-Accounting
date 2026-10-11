(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var readUnit = function () {
      var value = null;
      try { value = window.localStorage.getItem("hesabno:currency"); } catch (error) {}
      if (value == null && window.__hesabnoMemoryStorage) value = window.__hesabnoMemoryStorage["hesabno:currency"];
      return value === "toman" ? "تومان" : "ریال";
    };
    var style = document.createElement("style");
    style.textContent = '[data-hesabno-opening-balance-preview="true"]{display:none!important}';
    document.head.appendChild(style);
    var sync = function () {
      var label = Array.from(document.querySelectorAll("label")).find(function (node) {
        var text = clean(node.textContent);
        return text.indexOf("موجودی اولیه به تومان") !== -1 || text.indexOf("موجودی اولیه به ریال") !== -1;
      });
      if (!label) return;
      var spans = Array.from(label.querySelectorAll("span"));
      if (!spans.length) return;
      var unit = readUnit();
      var title = "مانده اولیه (موجودی اولیه به " + unit + ")";
      if (clean(spans[0].textContent) !== title) spans[0].textContent = title;
      spans.slice(1).forEach(function (node) { node.setAttribute("data-hesabno-opening-balance-preview", "true"); });
      var field = label.nextElementSibling;
      var suffix = field && Array.from(field.querySelectorAll("span")).find(function (node) {
        return /^(?:تومان|ریال)$/.test(clean(node.textContent));
      });
      if (suffix && clean(suffix.textContent) !== unit) suffix.textContent = unit;
    };
    var queued = false;
    var schedule = function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () { queued = false; sync(); });
    };
    sync();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("storage", function (event) { if (event.key === "hesabno:currency") schedule(); });
    var nativeSetItem = Storage.prototype.setItem;
    if (!nativeSetItem.__hesabnoOpeningBalanceUnit) {
      var wrappedSetItem = function (key, value) {
        var result = nativeSetItem.call(this, key, value);
        if (key === "hesabno:currency") schedule();
        return result;
      };
      wrappedSetItem.__hesabnoOpeningBalanceUnit = true;
      Storage.prototype.setItem = wrappedSetItem;
    }
  })();
