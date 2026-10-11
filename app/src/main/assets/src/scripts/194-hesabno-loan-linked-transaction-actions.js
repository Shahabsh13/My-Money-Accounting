(function () {
  var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
  var readArray = function (key) {
    try {
      var raw = window.__safeGet ? window.__safeGet(key) : window.localStorage.getItem(key);
      var value = JSON.parse(raw || "null");
      return Array.isArray(value) ? value : [];
    } catch (error) { return []; }
  };
  var hasLinkedTransactions = function (loan) {
    if (!loan || loan.id == null) return false;
    var loanId = String(loan.id);
    var installments = readArray("hesabno:installments").filter(function (item) {
      return item && String(item.loanId) === loanId;
    });
    var transactions = readArray("hesabno:transactions");
    return transactions.some(function (transaction) {
      if (!transaction) return false;
      if (transaction.loanId != null && String(transaction.loanId) === loanId) return true;
      return installments.some(function (installment) {
        return transaction.installmentId != null && String(transaction.installmentId) === String(installment.id) ||
          installment.transactionId != null && String(installment.transactionId) === String(transaction.id);
      });
    });
  };
  var findLoanForDeleteButton = function (button) {
    var loans = readArray("hesabno:loans");
    var node = button.parentElement;
    for (var depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      var text = clean(node.innerText || node.textContent);
      var matches = loans.filter(function (loan) {
        return loan && loan.name && text.includes(clean(loan.name));
      });
      if (matches.length === 1) return matches[0];
    }
    return null;
  };
  document.addEventListener("click", function (event) {
    var button = event.target && event.target.closest ? event.target.closest("button") : null;
    if (!button) return;
    var label = clean(button.title || button.getAttribute("aria-label") || button.textContent);
    if (label !== "حذف وام") return;
    var loan = findLoanForDeleteButton(button);
    if (!loan || !hasLinkedTransactions(loan)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.alert("این وام یا خرید اقساطی تراکنش ثبت‌شده دارد و قابل حذف نیست. ابتدا تراکنش‌های مرتبط را از بخش تراکنش‌ها حذف کنید.");
  }, true);
})();