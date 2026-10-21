/*
 * لایه ۰۹۹: «کد» فقط داخل خودِ حساب
 *
 * قاعده‌ی ثابت کاربر: کد ریشه/کد حساب نباید در فهرست‌ها، انتخابگرها، سرصفحه‌ها،
 * فرم‌ها و ردیف‌های گزارش دیده شود؛ فقط وقتی خودِ حساب باز می‌شود (صورت‌حساب /
 * جزئیات حساب در گزارش‌ها) مجاز است.
 *
 * این لایه هر برچسب متنی «کد …» / «کد ریشه …» را پنهان می‌کند، شمارش‌های
 * «N حساب تفصیلی» را به «تفصیلی N» تبدیل می‌کند و داخل پنل صورت‌حساب دست نمی‌زند.
 */
(function () {
  var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
  var asciiDigits = function (value) {
    return String(value || "").replace(/[۰-۹٠-٩]/g, function (digit) {
      var index = "۰۱۲۳۴۵۶۷۸۹".indexOf(digit);
      return String(index < 0 ? "٠١٢٣٤٥٦٧٨٩".indexOf(digit) : index);
    });
  };
  var persianDigits = function (value) {
    return asciiDigits(value).replace(/[0-9]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]; });
  };
  var isCode = function (text) {
    return /^کد(?:\s+ریشه)?\s*[:：]?\s*[\d۰-۹٠-٩A-Za-z_-]+(?:\s*\/\s*[\d۰-۹٠-٩]+)?(?:\s*[·•|]\s*[\d۰-۹٠-٩]+\s+(?:حساب تفصیلی|زیرمجموعه))?(?:\s*\(فاقد حساب تفصیلی\))?$/u.test(text);
  };
  var detailCount = function (text) {
    var match = text.match(/([0-9۰-۹٠-٩]+)\s+(?:حساب تفصیلی|زیرمجموعه)(?:\s|$)/u);
    if (!match || Number(asciiDigits(match[1])) < 1) return "";
    return "تفصیلی " + persianDigits(match[1]);
  };
  /* داخل خودِ حساب (صورت‌حساب/جزئیات) کد مجاز است */
  var insideAccount = function (node) {
    return !!(node.closest && node.closest('.hesabno-account-statement-panel, [data-hesabno-report-account-detail], [data-hesabno-statement-account], [data-hesabno-account-detail]'));
  };
  var hide = function () {
    document.querySelectorAll("p, span, div, li, small").forEach(function (node) {
      if (node.firstElementChild) return; /* فقط برگ‌ها؛ ظرف‌های دارای آیکون/زیرعنصر دست‌نخورده می‌مانند */
      var text = clean(node.textContent);
      if (!text) return;
      if (insideAccount(node)) {
        if (node.dataset.hesabnoHiddenCode === "true") {
          node.style.removeProperty("display");
          delete node.dataset.hesabnoHiddenCode;
        }
        return;
      }
      var count = detailCount(text);
      if (count) {
        if (text !== count) node.textContent = count;
        node.style.removeProperty("display");
        node.dataset.hesabnoDetailAccountCount = "true";
        delete node.dataset.hesabnoHiddenCode;
        return;
      }
      if (isCode(text)) {
        node.style.display = "none";
        node.dataset.hesabnoHiddenCode = "true";
        delete node.dataset.hesabnoDetailAccountCount;
        return;
      }
      /* گره‌ای که قبلاً کد بود و حالا متن دیگری دارد (بازاستفاده‌ی DOM) باید برگردد */
      if (node.dataset.hesabnoHiddenCode === "true") {
        node.style.removeProperty("display");
        delete node.dataset.hesabnoHiddenCode;
      }
    });
  };
  hide();
  if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, characterData: true, subtree: true }, hide);
})();
