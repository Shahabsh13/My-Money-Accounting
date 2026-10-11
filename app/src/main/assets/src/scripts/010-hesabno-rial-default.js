(function () {
  var memory = window.__hesabnoMemoryStorage = window.__hesabnoMemoryStorage || {};
  var storage = null;
  try { storage = window.localStorage; } catch (error) {}
  var get = function (key) {
    try {
      var value = storage && storage.getItem(key);
      return value == null && Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : value;
    } catch (error) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; }
  };
  var set = function (key, value) {
    try { if (storage) { storage.setItem(key, value); return; } } catch (error) {}
    memory[key] = String(value);
  };
  var currency = get("hesabno:currency");
  if (currency !== "rial" && currency !== "toman") {
    set("hesabno:currency", "rial");
  }
})();
