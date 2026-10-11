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
      return /^کد(?:\s+ریشه)?\s*[:：]?\s*[\d۰-۹٠-٩A-Za-z_-]+(?:\s*[·•|]\s*[\d۰-۹٠-٩]+\s+(?:حساب تفصیلی|زیرمجموعه))?(?:\s*\(فاقد حساب تفصیلی\))?$/u.test(text);
    };
    var isCount = function (text) {
      return /^[\d۰-۹٠-٩]+\s+(?:سرفصل\/حساب|حساب تفصیلی|زیرمجموعه)$/u.test(text);
    };
    var detailCount = function (text) {
      var match = text.match(/([0-9۰-۹٠-٩]+)\s+(?:حساب تفصیلی|زیرمجموعه)(?:\s|$)/u);
      if (!match || Number(asciiDigits(match[1])) < 1) return "";
      return "تفصیلی " + persianDigits(match[1]);
    };
    var hide = function () {
      document.querySelectorAll("p, span").forEach(function (node) {
        if (node.closest("[data-hesabno-return-account-picker]")) return;
        var text = clean(node.textContent);
        var count = detailCount(text);
        if (count) {
          if (text !== count) node.textContent = count;
          node.style.removeProperty("display");
          node.dataset.hesabnoDetailAccountCount = "true";
        } else if (isCode(text) || isCount(text)) {
          node.style.display = "none";
          delete node.dataset.hesabnoDetailAccountCount;
        }
      });
    };
   hide();
   if (document.body) new MutationObserver(hide).observe(document.body, { childList: true, subtree: true });
 })();
