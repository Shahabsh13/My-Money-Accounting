(function () {
  var memory = window.__hesabnoMemoryStorage = window.__hesabnoMemoryStorage || {};
  var key = "hesabno:transactions";
  var raw = null;
  try { raw = window.localStorage.getItem(key); } catch (error) {}
  if (raw == null && Object.prototype.hasOwnProperty.call(memory, key)) raw = memory[key];
  var transactions = [];
  try { transactions = raw ? JSON.parse(raw) : []; } catch (error) {}
  if (!Array.isArray(transactions) || !transactions.length) return;
  var prefix = /^دریافت وجه\s+/;
  var changed = false;
  transactions.forEach(function (transaction) {
    if (!transaction || transaction.type !== "income" || !(transaction.isLoanTransaction || transaction.loanId != null)) return;
    var description = String(transaction.description || "");
    if (!prefix.test(description)) return;
    var updated = description.replace(prefix, "").trim() + " - وام دریافتی";
    transaction.description = updated;
    if (prefix.test(String(transaction.title || ""))) {
      transaction.title = String(transaction.title).replace(prefix, "").trim() + " - وام دریافتی";
    }
    changed = true;
  });
  if (!changed) return;
  var value = JSON.stringify(transactions);
  try { if (window.localStorage) { window.localStorage.setItem(key, value); return; } } catch (error) {}
  memory[key] = value;
})();
