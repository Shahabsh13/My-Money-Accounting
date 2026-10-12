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
    // Lock the parent only while an actual transaction record exists.
    // A stale paid status, paidDate, or transactionId must not keep the parent
    // locked after the linked transaction has been independently deleted.
    return transactions.some(function (transaction) {
      if (!transaction) return false;
      if (transaction.loanId != null && String(transaction.loanId) === loanId) return true;
      return installments.some(function (installment) {
        return (transaction.installmentId != null && String(transaction.installmentId) === String(installment.id)) ||
          (installment.transactionId != null && String(installment.transactionId) === String(transaction.id));
      });
    });
  };
  var findLoanForActionButton = function (button) {
    var loans = readArray("hesabno:loans");
    var node = button.parentElement;
    for (var depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
      var text = clean(node.innerText || node.textContent);
      var matches = loans.filter(function (loan) {
        return loan && loan.name && text.includes(clean(loan.name));
      });
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) {
        var digits = function (value) {
          return String(value == null ? "" : value)
            .replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); })
            .replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); })
            .replace(/[^0-9]/g, "");
        };
        var textDigits = digits(text);
        var amountMatches = matches.filter(function (loan) {
          var amountDigits = digits(loan.amount);
          return amountDigits.length >= 4 && textDigits.indexOf(amountDigits) !== -1;
        });
        if (amountMatches.length === 1) return amountMatches[0];
      }
    }
    return null;
  };
  var isLoanOrPurchasePage = function (button) {
    var main = button.closest("main");
    var heading = clean(main && main.querySelector("h1") && main.querySelector("h1").textContent);
    return heading.indexOf("وام‌ها و تسهیلات") === 0 || heading.indexOf("خرید و اقساط") === 0;
  };
  var getActionType = function (button) {
    var label = clean(button.title || button.getAttribute("aria-label") || button.textContent);
    if (label.indexOf("ویرایش") !== -1 || label.indexOf("اصلاح") !== -1) return "edit";
    if (/(^|\s)حذف(\s|$)/.test(label) || label.indexOf("حذف وام") !== -1 ||
        label.indexOf("حذف خرید") !== -1 || label.indexOf("حذف مورد") !== -1) return "delete";
    return "";
  };
  document.addEventListener("click", function (event) {
    var button = event.target && event.target.closest ? event.target.closest("button") : null;
    if (!button || !isLoanOrPurchasePage(button)) return;
    var actionType = getActionType(button);
    if (!actionType) return;
    var loan = findLoanForActionButton(button);
    if (!loan || !hasLinkedTransactions(loan)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (actionType === "edit") {
      window.alert("این وام یا خرید اقساطی تراکنش ثبت‌شده دارد و تا زمانی که تراکنش‌های مرتبط وجود دارند، قابل ویرایش نیست. ابتدا تراکنش‌های مرتبط را از بخش تراکنش‌ها حذف کنید.");
    } else {
      window.alert("این وام یا خرید اقساطی تراکنش ثبت‌شده دارد و قابل حذف نیست. ابتدا تراکنش‌های مرتبط را از بخش تراکنش‌ها حذف کنید.");
    }
  }, true);
})();