(function () {
  var key = "hesabno:fiscal_years";
  var activeKey = "hesabno:active_fiscal_year_id";
  var memory = window.__hesabnoMemoryStorage = window.__hesabnoMemoryStorage || {};
  var storage = null;
  try { storage = window.localStorage; } catch (error) {}
  function get(name) {
    try {
      var value = storage && storage.getItem(name);
      return value == null && Object.prototype.hasOwnProperty.call(memory, name) ? memory[name] : value;
    } catch (error) {
      return Object.prototype.hasOwnProperty.call(memory, name) ? memory[name] : null;
    }
  }
  function set(name, value) {
    try { if (storage) { storage.setItem(name, value); return; } } catch (error) {}
    memory[name] = String(value);
  }
  function remove(name) {
    try { if (storage) storage.removeItem(name); } catch (error) {}
    delete memory[name];
  }
  function isSample(year) {
    var summary = year && year.summary;
    var transactions = year && year.archivedTransactions;
    return !!year && year.id === "fy-1404" && year.title === "سال مالی 1404" &&
      year.startDate === "1404/01/01" && year.endDate === "1404/12/29" &&
      year.closedBy === "auto" && year.closingDocNumber === 142 && summary &&
      summary.totalIncome === 185000000 && summary.totalExpense === 112000000 &&
      summary.netProfitLoss === 73000000 && Array.isArray(transactions) &&
      transactions.length === 3 && transactions[0].id === 991 &&
      transactions[1].id === 992 && transactions[2].id === 993;
  }
  var raw = get(key);
  if (!raw) return;
  try {
    var years = JSON.parse(raw);
    if (!Array.isArray(years)) return;
    var cleaned = years.filter(function (year) { return !isSample(year); });
    if (cleaned.length === years.length) return;
    set(key, JSON.stringify(cleaned));
    if (get(activeKey) === "fy-1404") {
      var next = cleaned.find(function (year) { return year && !year.isClosed; }) || cleaned[0];
      next ? set(activeKey, next.id) : remove(activeKey);
    }
  } catch (error) {}
})();
