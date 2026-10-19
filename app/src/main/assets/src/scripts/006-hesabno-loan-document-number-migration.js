(function () {
  var memory = window.__hesabnoMemoryStorage = window.__hesabnoMemoryStorage || {};
  var storage = null;
  var key = "hesabno:transactions";
  try { storage = window.localStorage; } catch (error) {}
  var raw = null;
  try { raw = storage && storage.getItem(key); } catch (error) {}
  if (raw == null && Object.prototype.hasOwnProperty.call(memory, key)) raw = memory[key];
  var transactions = [];
  try { transactions = raw ? JSON.parse(raw) : []; } catch (error) {}
  if (!Array.isArray(transactions) || transactions.length === 0) return;
  var maxDocumentNumber = transactions.reduce(function (max, transaction) {
    var value = Number(transaction && transaction.documentNumber);
    var id = Number(transaction && transaction.id);
    if (Number.isFinite(id) && id > 1e12 && value === id) return max;
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  var changed = false;
  transactions.forEach(function (transaction) {
    if (!transaction || !(transaction.isLoanTransaction || transaction.loanId != null || transaction.installmentId != null)) return;
    if (!transaction.title && transaction.description) {
      transaction.title = transaction.description;
      changed = true;
    }
    var id = Number(transaction.id);
    var isTimestampFallback = Number.isFinite(id) && id > 1e12 && Number(transaction.documentNumber) === id;
    if (transaction.documentNumber != null && String(transaction.documentNumber).trim() !== "" && !isTimestampFallback) return;
    if (transaction.isReversal || transaction.reversalOfDocNumber != null || transaction.reversedByDocNumber != null) return;
    transaction.documentNumber = ++maxDocumentNumber;
    changed = true;
  });
  if (!changed) return;
  var value = JSON.stringify(transactions);
  /* نگهبان مهاجرت (۶.۰): نوشتن + تأیید خواندن دوباره + بازگردانی خودکار در صورت شکست */
  if (window.__hesabnoMigration) {
    window.__hesabnoMigration.run("006-loan-document-number", [key], function (db) { db.set(key, value); });
    return;
  }
  try {
    if (storage) { storage.setItem(key, value); return; }
  } catch (error) {}
  memory[key] = value;
})();
