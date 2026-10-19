(function () {
    var faDigits = "۰۱۲۳۴۵۶۷۸۹";
    var months = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var normalizeDigits = function (value) {
      return String(value || "").replace(/[۰-۹]/g, function (digit) { return String(faDigits.indexOf(digit)); });
    };
    var toFa = function (value) {
      return String(value).replace(/[0-9]/g, function (digit) { return faDigits[Number(digit)]; });
    };
    var currentJalaliKey = function (date) {
      try {
        var parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
        var values = {};
        parts.forEach(function (part) { values[part.type] = normalizeDigits(part.value); });
        return [values.year, String(values.month).padStart(2, "0"), String(values.day).padStart(2, "0")].join("/");
      } catch (error) { return ""; }
    };
    var jalaliToGregorian = function (jy, jm, jd) {
      jy += 1595;
      var days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 1) * 30 + 6);
      var gy = 400 * Math.floor(days / 146097);
      days %= 146097;
      if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days += 1; }
      gy += 4 * Math.floor(days / 1461);
      days %= 1461;
      if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
      var gd = days + 1;
      var monthDays = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      var gm = 0;
      while (gd > monthDays[gm]) { gd -= monthDays[gm]; gm += 1; }
      return new Date(gy, gm - 1, gd);
    };
    var formatDate = function (raw) {
      var match = normalizeDigits(raw).replace(/-/g, "/").match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (!match) return "";
      var year = Number(match[1]);
      var month = Number(match[2]);
      var day = Number(match[3]);
      if (!year || month < 1 || month > 12 || day < 1 || day > 31) return "";
      var key = [String(year), String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("/");
      var now = new Date();
      var todayKey = currentJalaliKey(now);
      var yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      var yesterdayKey = currentJalaliKey(yesterday);
      var fullDate = toFa(day) + " " + months[month - 1] + " " + toFa(year);
      if (key === todayKey) return "امروز، " + fullDate;
      if (key === yesterdayKey) return "دیروز، " + fullDate;
      var prefix = new Intl.DateTimeFormat("fa-IR", { weekday: "long" }).format(jalaliToGregorian(year, month, day));
      return prefix + "، " + fullDate;
    };
    var enhance = function () {
      document.querySelectorAll("main span, main p, main div, .hesabno-account-statement-panel span, .hesabno-account-statement-panel p").forEach(function (node) {
        if (node.childNodes.length !== 1 || !node.firstChild || node.firstChild.nodeType !== 3) return;
        var raw = clean(node.textContent);
        if (!/^\s*[۰-۹0-9]{4}[\/-][۰-۹0-9]{1,2}[\/-][۰-۹0-9]{1,2}\s*$/.test(raw)) return;
        // The expenses/income modal owns this date and intentionally keeps it numeric.
        // Avoid racing its formatter (152), which otherwise makes the date flicker.
        if (node.hasAttribute && (node.hasAttribute("data-hesabno-period-date") || node.hasAttribute("data-hesabno-check-settlement-value") || node.hasAttribute("data-hesabno-check-due-value"))) return;
        if (node.previousElementSibling && clean(node.previousElementSibling.textContent).replace(/[：:]$/u, "") === "تاریخ سررسید") return;
        if (node.closest && node.closest(".hesabno-statement-date-cell")) return;
        if (node.closest && node.closest("[data-hesabno-simple-report-native]")) return;
        var modal = node.closest && node.closest("div.max-w-md");
        var heading = modal && modal.querySelector("header h2");
        if (heading && clean(heading.textContent).indexOf("هزینه‌ها و درآمدها") !== -1) return;
        var label = formatDate(raw);
        if (!label) return;
        node.textContent = label;
        node.dataset.hesabnoRelativeDate = "true";
      });
    };
    window.__hesabnoDateLabel = function (raw) {
      var text = clean(raw);
      return formatDate(text) || toFa(text);
    };
    enhance();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true, characterData: true }, enhance);
  })();
