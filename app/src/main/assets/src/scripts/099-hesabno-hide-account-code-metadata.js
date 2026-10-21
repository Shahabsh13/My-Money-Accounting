/*
 * لایه ۰۹۹: کد حساب هیچ‌جا به کاربر نشان داده نمی‌شود
 *
 * قاعده‌ی ثابت کاربر: حساب کد دارد، ولی این کد هیچ‌جا به کاربر نشان داده نمی‌شود؛
 * نه در فهرست‌ها و انتخابگرها، نه در فرم‌ها و گزارش‌ها و نه داخل صورت‌حساب حساب.
 * کد فقط شناسه‌ی داخلی داده است.
 *
 * این لایه هر برچسب متنی «کد …» / «کد ریشه …» / «کدینگ سرفصل: …» را پنهان می‌کند و
 * شمارش‌های «N حساب تفصیلی» را به «تفصیلی N» تبدیل می‌کند.
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
    return /^کد(?:ینگ)?(?:\s+(?:ریشه|سرفصل|تفصیلی))?\s*[:：]?\s*[\d۰-۹٠-٩A-Za-z_-]+(?:\s*\/\s*[\d۰-۹٠-٩]+)?(?:\s*[·•|]\s*[\d۰-۹٠-٩]+\s+(?:حساب تفصیلی|زیرمجموعه))?(?:\s*\(فاقد حساب تفصیلی\))?$/u.test(text);
  };
  var detailCount = function (text) {
    var match = text.match(/([0-9۰-۹٠-٩]+)\s+(?:حساب تفصیلی|زیرمجموعه)(?:\s|$)/u);
    if (!match || Number(asciiDigits(match[1])) < 1) return "";
    return "تفصیلی " + persianDigits(match[1]);
  };
  var hide = function () {
    document.querySelectorAll("p, span, div, li, small").forEach(function (node) {
      if (node.firstElementChild) return; /* فقط برگ‌ها؛ ظرف‌های دارای آیکون/زیرعنصر دست‌نخورده می‌مانند */
      var text = clean(node.textContent);
      if (!text) return;
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
