/* Safe local storage bridge with a file-origin fallback. */
window.__hesabnoMemoryStorage = window.__hesabnoMemoryStorage || {};
window.__safeGet = function (key) {
  try {
    var value = window["localStorage"].getItem(key);
    return value === null && Object.prototype.hasOwnProperty.call(window.__hesabnoMemoryStorage, key) ? window.__hesabnoMemoryStorage[key] : value;
  } catch { return Object.prototype.hasOwnProperty.call(window.__hesabnoMemoryStorage, key) ? window.__hesabnoMemoryStorage[key] : null; }
};
window.__safeSet = function (key, value) {
  try {
    window.localStorage.setItem(key, value);
    if (window.__hesabnoStoragePersistent !== false) delete window.__hesabnoMemoryStorage[key];
    return window.__hesabnoStoragePersistent !== false;
  } catch (error) {
    window.__hesabnoMemoryStorage[key] = String(value);
    return false;
  }
};
window.__safeRemove = function (key) {
  try { window["localStorage"].removeItem(key); } catch {}
  delete window.__hesabnoMemoryStorage[key];
};
