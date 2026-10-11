(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var number = function (value) {
      return Number(String(value || "").replace(/[۰-۹]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(digit); }).replace(/[^0-9]/g, "")) || 0;
    };
    var read = function () {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions");
        var value = JSON.parse(raw || "[]");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var write = function (items) {
      var raw = JSON.stringify(items);
      if (window.__safeSet) window.__safeSet("hesabno:transactions", raw);
      else localStorage.setItem("hesabno:transactions", raw);
    };
    var currentDate = function () {
      try {
        var parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
        var values = {};
        parts.forEach(function (part) { values[part.type] = part.value; });
        return values.year + "/" + values.month + "/" + values.day;
      } catch (error) { return ""; }
    };
    var latinDate = function (value) { return String(value || "").replace(/[۰-۹]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(digit); }).replace(/[٠-٩]/g, function (digit) { return "٠١٢٣٤٥٦٧٨٩".indexOf(digit); }); };
    var dateParts = function (value) {
      var match = latinDate(value).match(/(\d{4})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})/);
      if (!match) return null;
      var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
      var maxDay = month <= 6 ? 31 : month <= 11 ? 30 : window.__hesabnoJalaliMonthLength ? window.__hesabnoJalaliMonthLength(year, month) : 29;
      if (month < 1 || month > 12 || day < 1 || day > maxDay) return null;
      return { year: year, month: month, day: day };
    };
    var dateKey = function (value) {
      var parts = dateParts(value);
      return parts ? parts.year * 10000 + parts.month * 100 + parts.day : 0;
    };
    var normalizedDate = function (value) {
      var parts = dateParts(value);
      if (!parts) return "";
      return (("0000" + parts.year).slice(-4) + "/" + ("0" + parts.month).slice(-2) + "/" + ("0" + parts.day).slice(-2))
        .replace(/[0-9]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]; });
    };
    var currentTime = function () {
      try { return new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()).replace(/\u200e/g, ""); } catch (error) { return ""; }
    };
    var nextDocumentNumber = function (items) {
      return items.reduce(function (max, item) {
        var id = number(item && item.id), documentNumber = number(item && item.documentNumber);
        if (id > 1e12 && documentNumber === id) id = 0;
        return Math.max(max, documentNumber || id);
      }, 0) + 1;
    };
    var replacementPayments = function (items, original) {
      var doc = original.documentNumber || original.id;
      return items.filter(function (item) {
        return item && item.isCheckReplacementPayment === true &&
          (String(item.relatedCheckDocNumber) === String(doc) || String(item.relatedCheckId) === String(original.id));
      });
    };
    var amountValue = function (value) {
      return Number(String(value || "").replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); }).replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); }).replace(/[^0-9]/g, "")) || 0;
    };
    var resolve = function (id, action, accountName, actionDate, actionAmount, cancellationDescription, replacementDetails) {
      var items = read();
      var index = items.findIndex(function (item) { return String(item && item.id) === String(id); });
      if (index < 0 || !items[index].check) return false;
      var original = items[index];
      var originalDocumentNumber = original.documentNumber || original.id;
      var paidToDate = replacementPayments(items, original).reduce(function (sum, item) { return sum + (Number(item.amount) || 0); }, 0);
      var remainingToPay = Math.max(0, Math.abs(Number(original.amount) || 0) - paidToDate);
      if (original.check.returnedWithCorrection || original.reversedByDocNumber) return false;
      if (action === "cancelDebt") {
        var canceledDate = normalizedDate(actionDate);
        if (!canceledDate || original.check.debtCanceled === true || original.type !== "expense" || remainingToPay <= 0) return false;
        original.check = Object.assign({}, original.check, {
          status: "bounced", debtCanceled: true, debtCanceledDate: canceledDate,
          debtCanceledDescription: clean(cancellationDescription)
        });
      } else if (action === "account" && clean(accountName)) {
        var paymentDate = normalizedDate(actionDate);
        var paymentAmount = amountValue(actionAmount);
        if (!paymentDate || (dateKey(original.date) && dateKey(paymentDate) < dateKey(original.date)) || (dateKey(currentDate()) && dateKey(paymentDate) > dateKey(currentDate()))) return false;
        if (original.type !== "expense" || original.check.debtCanceled === true || original.check.resolutionAccount) return false;
        if (paymentAmount <= 0 || paymentAmount > remainingToPay) return false;
        var paymentDocNumber = nextDocumentNumber(items);
        var originalTitle = clean(original.title || original.description || original.category || "هزینه");
        var paymentTitle = "هزینه جایگزین سند #" + originalDocumentNumber + ": " + originalTitle;
        var paymentDescription = "پرداخت از حساب «" + clean(accountName) + "» بابت چک برگشتی #" + originalDocumentNumber + " · " + originalTitle;
        replacementDetails = replacementDetails || {};
        var paymentNotes = String(replacementDetails.notes || "").trim();
        var paymentAttachment = String(replacementDetails.attachment || "");
        items.push({
          id: Date.now() + Math.floor(Math.random() * 1000), documentNumber: paymentDocNumber,
          date: latinDate(paymentDate), time: currentTime(), type: "expense", amount: paymentAmount,
          feeAmount: 0, category: original.category || "سایر هزینه‌ها", account: clean(accountName), method: "normal",
          title: paymentTitle, description: paymentDescription, notes: paymentNotes || void 0, hasManualDescription: !!paymentNotes,
          attachment: paymentAttachment || void 0, attachmentName: replacementDetails.attachmentName || void 0,
          project: original.project || void 0, familyMember: original.familyMember || void 0,
          relatedCheckDocNumber: originalDocumentNumber, relatedCheckId: original.id, isCheckReplacementPayment: true
        });
        original.check = Object.assign({}, original.check, { status: "bounced" });
      } else return false;
      write(items);
      try { sessionStorage.setItem("hesabno:check-resolution-resume", "checks"); } catch (error) {}
      window.__hesabnoSoftReload();
      return true;
    };
    window.__hesabnoResolveReturnedCheck = resolve;
    var resume = "";
    try { resume = sessionStorage.getItem("hesabno:check-resolution-resume") || ""; if (resume) sessionStorage.removeItem("hesabno:check-resolution-resume"); } catch (error) {}
    if (resume === "checks") {
      window.setTimeout(function () {
        var button = Array.from(document.querySelectorAll("button")).find(function (item) { return clean(item.textContent) === "چک‌ها"; });
        if (button) button.click();
      }, 900);
    }
  })();
