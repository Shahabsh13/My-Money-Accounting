/* Keep the empty inbox explicit so the built-in demo SMS fallback is never shown. */
(function () {
  var memory = window.__hesabnoMemoryStorage = window.__hesabnoMemoryStorage || {};
  var storage = null;
  try { storage = window.localStorage; } catch (error) {}
  var key = "hesabno:payambank:inbox";
  var read = function () {
    try {
      var value = storage && storage.getItem(key);
      return value == null && Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : value;
    } catch (error) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; }
  };
  var write = function (value) {
    try { if (storage) { storage.setItem(key, value); return; } } catch (error) {}
    memory[key] = String(value);
  };
  try {
    var raw = read();
    if (!raw) {
      write("[]");
      return;
    }
    var messages = JSON.parse(raw);
    if (!Array.isArray(messages)) {
      write("[]");
      return;
    }
    var cleaned = messages.filter(function (message) {
      return message && !String(message.id || "").startsWith("sms-sample-");
    });
    if (cleaned.length !== messages.length) write(JSON.stringify(cleaned));
  } catch (error) {
    write("[]");
  }
})();
