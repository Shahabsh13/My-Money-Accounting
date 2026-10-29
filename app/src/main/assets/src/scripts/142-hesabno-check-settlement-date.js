(function () {
    if (window.__hesabnoSettlementDateFeature) return;
    window.__hesabnoSettlementDateFeature = true;
    var transactionKey = "hesabno:transactions";
    var settlementMapKey = "hesabno:check_settlement_dates";
    var dateSettingKey = "hesabno:simpleReports_currentDateStr";
    var faDigits = "۰۱۲۳۴۵۶۷۸۹";
    var hasOwn = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var latinDigits = function (value) {
      return String(value == null ? "" : value).replace(/[۰-۹]/g, function (digit) { return String(faDigits.indexOf(digit)); });
    };
    var persianDigits = function (value) {
      return String(value == null ? "" : value).replace(/[0-9]/g, function (digit) { return faDigits[Number(digit)]; });
    };
    var get = function (key) {
      try { return window.__safeGet ? window.__safeGet(key) : localStorage.getItem(key); } catch (error) { return null; }
    };
    var originalSet = window.__safeSet || function (key, value) {
      try { localStorage.setItem(key, value); } catch (error) {}
    };
    var readTransactions = function () {
      try {
        var value = JSON.parse(get(transactionKey) || "[]");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var dateMap = {};
    try {
      var storedMap = JSON.parse(get(settlementMapKey) || "{}");
      if (storedMap && typeof storedMap === "object" && !Array.isArray(storedMap)) dateMap = storedMap;
    } catch (error) {}
    var writeMap = function () { originalSet(settlementMapKey, JSON.stringify(dateMap)); };
    var normalizeDate = function (value) {
      var raw = latinDigits(value).replace(/[.-]/g, "/").replace(/\s+/g, "");
      var match = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (!match) return "";
      var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
      if (year < 1200 || year > 1700 || month < 1 || month > 12 || day < 1 || day > monthLength(year, month)) return "";
      return year + "/" + String(month).padStart(2, "0") + "/" + String(day).padStart(2, "0");
    };
    var appDate = function () {
      var configured = normalizeDate(get(dateSettingKey));
      if (configured) return configured;
      try {
        var parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
        var values = {};
        parts.forEach(function (part) { values[part.type] = part.value; });
        return normalizeDate(values.year + "/" + values.month + "/" + values.day);
      } catch (error) { return ""; }
    };
    var displayDate = function (value) {
      var normalized = normalizeDate(value);
      return normalized ? persianDigits(normalized) : "—";
    };
    var jalaliBreaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
    var div = function (a, b) { return a < 0 ? Math.ceil(a / b) : Math.floor(a / b); };
    var mod = function (a, b) { return a - div(a, b) * b; };
    var jalaliCal = function (jy, withoutLeap) {
      var gy = jy + 621, leapJ = -14, jp = jalaliBreaks[0], jm = 0, jump = 0, leap, leapG, march, n;
      for (var i = 1; i < jalaliBreaks.length; i += 1) {
        jm = jalaliBreaks[i];
        jump = jm - jp;
        if (jy < jm) break;
        leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
        jp = jm;
      }
      n = jy - jp;
      leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
      if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
      leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
      march = 20 + leapJ - leapG;
      if (withoutLeap) return { gy: gy, march: march };
      leap = mod(mod(n + 1, 33) - 1, 4);
      if (leap === -1) leap = 4;
      return { leap: leap, gy: gy, march: march };
    };
    var gregorianToDay = function (gy, gm, gd) {
      var day = div((gy + div(gm - 8, 6) + 100100) * 1461, 4);
      day += div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
      day = day - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
      return day;
    };
    var dayToGregorian = function (jdn) {
      var j = 4 * jdn + 139361631;
      j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
      var i = div(mod(j, 1461), 4) * 5 + 308;
      var gd = div(mod(i, 153), 5) + 1;
      var gm = mod(div(i, 153), 12) + 1;
      var gy = div(j, 1461) - 100100 + div(8 - gm, 6);
      return { gy: gy, gm: gm, gd: gd };
    };
    var jalaliToGregorian = function (jy, jm, jd) {
      var result = jalaliCal(jy, true);
      var day = gregorianToDay(result.gy, 3, result.march);
      day += (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
      return dayToGregorian(day);
    };
    var gregorianToJalali = function (gy, gm, gd) {
      var daysInMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
      var jy = gy <= 1600 ? 0 : 979;
      gy -= gy <= 1600 ? 621 : 1600;
      var gy2 = gm > 2 ? gy + 1 : gy;
      var day = 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) - 80 + gd + daysInMonth[gm - 1];
      jy += 33 * div(day, 12053);
      day %= 12053;
      jy += 4 * div(day, 1461);
      day %= 1461;
      if (day > 365) {
        jy += div(day - 1, 365);
        day = mod(day - 1, 365);
      }
      var jm = day < 186 ? 1 + div(day, 31) : 7 + div(day - 186, 30);
      var jd = 1 + (day < 186 ? mod(day, 31) : mod(day - 186, 30));
      return { year: jy, month: jm, day: jd };
    };
    var parseDate = function (value) {
      var normalized = normalizeDate(value), match = normalized.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
      return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
    };
    var formatDate = function (parts) {
      return parts.year + "/" + String(parts.month).padStart(2, "0") + "/" + String(parts.day).padStart(2, "0");
    };
    var monthLength = function (year, month) {
      if (month <= 6) return 31;
      if (month <= 11) return 30;
      return jalaliCal(year).leap === 0 ? 30 : 29;
    };
    window.__hesabnoJalaliMonthLength = monthLength;
    var addDays = function (value, amount) {
      var parts = parseDate(value), gregorian;
      if (!parts) return normalizeDate(value);
      gregorian = jalaliToGregorian(parts.year, parts.month, parts.day);
      var date = new Date(Date.UTC(gregorian.gy, gregorian.gm - 1, gregorian.gd + amount));
      return formatDate(gregorianToJalali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()));
    };
    var addMonths = function (value, amount) {
      var parts = parseDate(value);
      if (!parts) return normalizeDate(value);
      var total = parts.year * 12 + parts.month - 1 + amount;
      var year = Math.floor(total / 12), month = total % 12 + 1;
      return formatDate({ year: year, month: month, day: Math.min(parts.day, monthLength(year, month)) });
    };
    var weekdayName = function (value) {
      var parts = parseDate(value), gregorian;
      if (!parts) return "";
      gregorian = jalaliToGregorian(parts.year, parts.month, parts.day);
      return ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"][new Date(Date.UTC(gregorian.gy, gregorian.gm - 1, gregorian.gd)).getUTCDay()];
    };
    var friendlyDate = function (value) {
      var normalized = normalizeDate(value), parts = parseDate(normalized), today = appDate(), prefix = "";
      if (!parts) return "";
      var diff = (function () {
        var current = parseDate(today), a = current && jalaliToGregorian(current.year, current.month, current.day), b = jalaliToGregorian(parts.year, parts.month, parts.day);
        return a && b ? (Date.UTC(b.gy, b.gm - 1, b.gd) - Date.UTC(a.gy, a.gm - 1, a.gd)) / 86400000 : 0;
      })();
      if (diff === 0) prefix = "(امروز) ";
      else if (diff === -1) prefix = "(دیروز) ";
      else if (diff === 1) prefix = "(فردا) ";
      return prefix + weekdayName(normalized) + " " + persianDigits(String(parts.day)) + " " + monthNames[parts.month - 1] + " " + persianDigits(String(parts.year));
    };
    var monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
    var itemKeys = function (item) {
      var keys = [];
      if (item && item.id != null) keys.push("id:" + String(item.id));
      if (item && item.check && item.check.number) keys.push("number:" + latinDigits(item.check.number).replace(/\D/g, ""));
      return keys;
    };
    var settlementFor = function (item) {
      if (!item || !item.check || item.check.status !== "cleared") return "";
      var keys = itemKeys(item);
      for (var i = 0; i < keys.length; i += 1) {
        if (hasOwn(dateMap, keys[i])) return normalizeDate(dateMap[keys[i]]) || "";
      }
      return normalizeDate(item && item.check && item.check.settlementDate) || "";
    };
    var mergeStoredSettlements = function (value) {
      var items;
      try { items = JSON.parse(value || "[]"); } catch (error) { return value; }
      if (!Array.isArray(items)) return value;
      var changed = false;
      var next = items.map(function (item) {
        if (!item || !item.check) return item;
        var existing = normalizeDate(item.check.settlementDate);
        var keys = itemKeys(item);
        var explicit = keys.some(function (key) { return hasOwn(dateMap, key); });
        if (item.check.status !== "cleared") {
          if (!existing) return item;
          changed = true;
          var openCheck = Object.assign({}, item.check);
          delete openCheck.settlementDate;
          return Object.assign({}, item, { check: openCheck });
        }
        var settlement = settlementFor(item);
        if (settlement) {
          if (existing === settlement) return item;
          changed = true;
          return Object.assign({}, item, { check: Object.assign({}, item.check, { settlementDate: settlement }) });
        }
        if (existing) {
          itemKeys(item).forEach(function (key) { if (!hasOwn(dateMap, key)) dateMap[key] = existing; });
          return item;
        }
        if (explicit) {
          changed = true;
          var check = Object.assign({}, item.check);
          delete check.settlementDate;
          return Object.assign({}, item, { check: check });
        }
        return item;
      });
      if (changed) return JSON.stringify(next);
      return value;
    };
    window.__safeSet = function (key, value) {
      if (key === transactionKey) value = mergeStoredSettlements(value);
      return originalSet(key, value);
    };
    var seed = readTransactions();
    seed.forEach(function (item) {
      var settlement = normalizeDate(item && item.check && item.check.settlementDate);
      if (settlement) itemKeys(item).forEach(function (key) { if (!hasOwn(dateMap, key)) dateMap[key] = settlement; });
    });
    if (Object.keys(dateMap).length) writeMap();
    var itemByCandidate = function (candidate) {
      var items = readTransactions();
      if (!candidate) return null;
      return items.find(function (item) {
        if (candidate.id != null && String(item && item.id) === String(candidate.id)) return true;
        var itemNumber = item && item.check && latinDigits(item.check.number).replace(/\D/g, "");
        return candidate.number && itemNumber && itemNumber === candidate.number;
      }) || null;
    };
    var remember = function (candidate, value) {
      var settlement = normalizeDate(value) || appDate();
      if (!settlement) return;
      var item = itemByCandidate(candidate);
      if (item) candidate = { id: item.id, number: item.check && item.check.number };
      itemKeys({ id: candidate && candidate.id, check: { number: candidate && candidate.number } }).forEach(function (key) { dateMap[key] = settlement; });
      writeMap();
      var items = readTransactions();
      var changed = false;
      var next = items.map(function (entry) {
        var matches = candidate && ((candidate.id != null && String(entry.id) === String(candidate.id)) || (candidate.number && latinDigits(entry.check && entry.check.number).replace(/\D/g, "") === candidate.number));
        if (!matches || !entry.check) return entry;
        changed = true;
        return Object.assign({}, entry, { check: Object.assign({}, entry.check, { settlementDate: settlement }) });
      });
      if (changed) originalSet(transactionKey, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("hesabno:settlement-date-updated"));
    };
    var forget = function (candidate) {
      var item = itemByCandidate(candidate);
      if (item) candidate = { id: item.id, number: item.check && item.check.number };
      itemKeys({ id: candidate && candidate.id, check: { number: candidate && candidate.number } }).forEach(function (key) { dateMap[key] = null; });
      writeMap();
      var items = readTransactions();
      var changed = false;
      var next = items.map(function (entry) {
        var matches = candidate && ((candidate.id != null && String(entry.id) === String(candidate.id)) || (candidate.number && latinDigits(entry.check && entry.check.number).replace(/\D/g, "") === candidate.number));
        if (!matches || !entry.check || !entry.check.settlementDate) return entry;
        changed = true;
        var check = Object.assign({}, entry.check);
        delete check.settlementDate;
        return Object.assign({}, entry, { check: check });
      });
      if (changed) originalSet(transactionKey, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("hesabno:settlement-date-updated"));
    };
    var candidateFromArticle = function (article) {
      if (!article) return null;
      var number = article.getAttribute("data-hesabno-check-number") || "";
      var match = clean(article.textContent).match(/شماره چک:\s*([0-9۰-۹]+)/u);
      number = latinDigits(number || (match && match[1]) || "").replace(/\D/g, "");
      if (!number) return null;
      var item = itemByCandidate({ number: number });
      return item ? { id: item.id, number: number } : { number: number };
    };
    var candidateFromModal = function (modal) {
      var match = clean(modal && modal.textContent).match(/(?:شماره چک|وضعیت چک)\s*:?\s*([0-9۰-۹]+)/u);
      var number = latinDigits(match && match[1]).replace(/\D/g, "");
      return number ? { number: number } : null;
    };
    var isClearAction = function (text) {
      return text.includes("پاس‌شدن چک و کسر از حساب") || text.includes("وصول چک به حساب");
    };
    var findModal = function () {
      if (!document || !document.querySelectorAll) return null;
      var candidates = Array.from(document.querySelectorAll("[class*='fixed'][class*='inset-0'], [role='dialog']"));
      return candidates.find(function (node) {
        var text = clean(node.textContent);
        return text.includes("تایید پاس‌شدن چک و کسر از حساب") || text.includes("تایید وصول چک به حساب");
      }) || null;
    };
    var findStatusModal = function () {
      return Array.from(document.querySelectorAll("[class*='fixed'][class*='inset-0']")).find(function (node) {
        return clean(node.textContent).includes("وضعیت چک");
      }) || null;
    };
    var modalDateInput = function (modal) {
      return modal && modal.querySelector("[data-hesabno-settlement-date-input]");
    };
    var settlementMinimumDate = function () {
      var item = itemByCandidate(currentCandidate);
      return normalizeDate(item && item.check && item.check.dueDate) || "";
    };
    var clampSettlementDate = function (value, minimum) {
      var normalized = normalizeDate(value) || appDate();
      return minimum && normalized < minimum ? minimum : normalized;
    };
    var closeSettlementPicker = function (state) {
      if (state && state.backdrop) state.backdrop.remove();
      if (state) state.backdrop = null;
    };
    var renderSettlementPicker = function (state) {
      if (!state || !state.sheet) return;
      var input = state.input, current = parseDate(state.pendingDate) || parseDate(input.value) || parseDate(appDate()), yearButton = state.sheet.querySelector("#datepicker-year-button");
      if (!current) return;
      if (!state.viewYear) state.viewYear = current.year;
      if (!state.viewMonth) state.viewMonth = current.month;
      if (yearButton) yearButton.innerHTML = "<span>" + persianDigits(String(state.viewYear)) + "</span>";
      var monthLabel = state.sheet.querySelector("[data-hesabno-settlement-datepicker-month]");
      if (monthLabel) monthLabel.textContent = monthNames[state.viewMonth - 1];
      var body = state.sheet.querySelector("[data-hesabno-settlement-datepicker-body]");
      if (!body) return;
      body.innerHTML = "";
      if (state.yearMode) {
        body.innerHTML = "<div class=\"text-xs font-bold text-stone-400 mb-3 text-center\">انتخاب سال شمسی</div><div class=\"grid grid-cols-3 gap-2.5 max-h-[240px] overflow-y-auto no-scrollbar py-1\" data-hesabno-settlement-datepicker-years></div>";
        var years = body.querySelector("[data-hesabno-settlement-datepicker-years]");
        for (var year = state.viewYear + 2; year >= state.viewYear - 12; year -= 1) {
          var yearButton = document.createElement("button");
          yearButton.type = "button";
          yearButton.className = "py-2.5 rounded-xl font-bold text-sm transition " + (year === state.viewYear ? "bg-blue-600 text-white shadow-md" : "bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700/60");
          yearButton.textContent = persianDigits(String(year));
          yearButton.setAttribute("data-hesabno-settlement-year", String(year));
          years.appendChild(yearButton);
        }
        return;
      }
      body.innerHTML = "<div class=\"grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-stone-400\"><span class=\"py-1\">ش</span><span class=\"py-1\">ی</span><span class=\"py-1\">د</span><span class=\"py-1\">س</span><span class=\"py-1\">چ</span><span class=\"py-1\">پ</span><span class=\"py-1 text-rose-400/80\">ج</span></div><div class=\"grid grid-cols-7 gap-y-2 gap-x-1\" data-hesabno-settlement-datepicker-days></div>";
      var weekdays = body.firstElementChild, days = body.querySelector("[data-hesabno-settlement-datepicker-days]"), first = jalaliToGregorian(state.viewYear, state.viewMonth, 1), leading = (new Date(Date.UTC(first.gy, first.gm - 1, first.gd)).getUTCDay() + 1) % 7;
      if (weekdays) { weekdays.style.flex = "0 0 auto"; weekdays.style.marginTop = "auto"; }
      if (days) days.style.flex = "0 0 auto";
      for (var blank = 0; blank < leading; blank += 1) days.appendChild(document.createElement("div")).className = "w-9 h-9 sm:w-10 sm:h-10";
      var minimum = normalizeDate(state.field.getAttribute("data-hesabno-settlement-min-date"));
      for (var day = 1; day <= monthLength(state.viewYear, state.viewMonth); day += 1) {
        var dayButton = document.createElement("button"), value = formatDate({ year: state.viewYear, month: state.viewMonth, day: day }), selected = current.year === state.viewYear && current.month === state.viewMonth && current.day === day, disabled = minimum && value < minimum;
        dayButton.type = "button";
        dayButton.disabled = !!disabled;
        dayButton.className = "w-9 h-9 sm:w-10 sm:h-10 mx-auto flex items-center justify-center rounded-xl text-xs sm:text-sm font-bold transition-all " + (disabled ? "text-stone-400/40 cursor-not-allowed" : selected ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105 font-black" : "text-stone-200 hover:bg-stone-750 hover:text-white");
        dayButton.textContent = persianDigits(String(day));
        dayButton.setAttribute("data-hesabno-settlement-day", String(day));
        if (disabled) dayButton.setAttribute("aria-disabled", "true");
        days.appendChild(dayButton);
      }
    };
    var syncSettlementDateField = function (field) {
      var input = field && field.querySelector("[data-hesabno-settlement-date-input]"), minimum = normalizeDate(field && field.getAttribute("data-hesabno-settlement-min-date")), value = clampSettlementDate(input && input.value, minimum);
      if (!input) return;
      input.value = value;
      input.setAttribute("aria-invalid", "false");
      var display = field.querySelector("[data-hesabno-settlement-date-value]"), badge = field.querySelector("[data-hesabno-settlement-date-badge]");
      if (display) display.textContent = friendlyDate(value);
      if (badge) badge.textContent = "وصول: " + displayDate(value);
      var previousDay = field.querySelector("[data-hesabno-settlement-prev-day]");
      if (previousDay) {
        previousDay.disabled = !!minimum && value <= minimum;
        previousDay.style.opacity = previousDay.disabled ? ".35" : "";
        previousDay.style.cursor = previousDay.disabled ? "not-allowed" : "";
      }
      if (field.__hesabnoSettlementPicker && field.__hesabnoSettlementPicker.backdrop) renderSettlementPicker(field.__hesabnoSettlementPicker);
    };
    var openSettlementPicker = function (field) {
      var state = field.__hesabnoSettlementPicker;
      if (!state) return;
      if (state.backdrop) return;
      var current = parseDate(state.input.value) || parseDate(appDate());
      state.pendingDate = formatDate(current);
      state.viewYear = current.year;
      state.viewMonth = current.month;
      state.yearMode = false;
      var backdrop = document.createElement("div");
      backdrop.id = "persian-datepicker-backdrop";
      backdrop.setAttribute("data-hesabno-settlement-datepicker", "true");
      backdrop.className = "fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 hesabno-overlay-motion";
      backdrop.style.position = "fixed";
      backdrop.style.top = "0px";
      backdrop.style.right = "0px";
      backdrop.style.bottom = "0px";
      backdrop.style.left = "0px";
      backdrop.style.display = "flex";
      backdrop.style.alignItems = "flex-end";
      backdrop.style.justifyContent = "center";
      backdrop.style.padding = "0px";
      backdrop.style.zIndex = "2147483000";
      backdrop.style.background = "rgba(2, 6, 23, 0.36)";
      backdrop.style.backdropFilter = "blur(16px) saturate(120%)";
      backdrop.style.webkitBackdropFilter = "blur(16px) saturate(120%)";
      backdrop.style.touchAction = "none";
      backdrop.innerHTML = "<div id=\"persian-datepicker-sheet\" dir=\"rtl\" class=\"w-full max-w-sm bg-[#161a23] text-stone-100 rounded-t-3xl sm:rounded-3xl border-t sm:border border-stone-700/60 p-4 sm:p-5 shadow-2xl transition-all select-none animate-in slide-in-from-bottom-6 duration-200 hesabno-dialog-motion\"><div class=\"flex items-center justify-between gap-2.5 mb-4\"><button id=\"datepicker-year-button\" type=\"button\" class=\"px-4 py-2 rounded-xl text-sm font-bold border transition flex items-center gap-1.5 bg-stone-800 hover:bg-stone-750 text-stone-100 border-stone-700/80\"></button><div class=\"flex items-center justify-between bg-stone-800 border border-stone-700/80 rounded-xl px-2 py-1.5 min-w-[175px]\"><button type=\"button\" class=\"p-1 rounded-lg transition text-stone-200 hover:text-white hover:bg-stone-700\" title=\"ماه قبل\" data-hesabno-settlement-prev-month><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m9 18 6-6-6-6\"></path></svg></button><span class=\"font-bold text-sm text-stone-100 px-3\" data-hesabno-settlement-datepicker-month></span><button type=\"button\" class=\"p-1 rounded-lg transition text-stone-200 hover:text-white hover:bg-stone-700\" title=\"ماه بعد\" data-hesabno-settlement-next-month><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m15 18-6-6 6 6\"></path></svg></button></div><button type=\"button\" data-hesabno-settlement-close aria-label=\"بستن تقویم\" title=\"بستن تقویم\" class=\"w-9 h-9 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 text-2xl leading-none\">×</button></div><div class=\"bg-stone-850/90 border border-stone-700/50 rounded-2xl p-3.5 shadow-inner\" data-hesabno-settlement-datepicker-body></div><div class=\"flex items-center justify-between gap-3 mt-4 pt-2 border-t border-stone-800\"><button id=\"datepicker-today-button\" type=\"button\" class=\"flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-750 border border-stone-700 text-xs font-bold text-stone-200 transition\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 2v4\"></path><path d=\"M16 2v4\"></path><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"></rect><path d=\"M3 10h18\"></path></svg><span>امروز</span></button><button type=\"button\" data-hesabno-settlement-confirm class=\"flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition\">تأیید تاریخ</button></div></div>";
      state.backdrop = backdrop;
      state.sheet = backdrop.querySelector("#persian-datepicker-sheet");
      // Anchor the sheet itself to the viewport instead of relying only on the
      // backdrop's flex alignment.
      state.sheet.style.position = "fixed";
      state.sheet.style.left = "0px";
      state.sheet.style.right = "0px";
      state.sheet.style.bottom = "0px";
      state.sheet.style.marginLeft = "auto";
      state.sheet.style.marginRight = "auto";
      state.sheet.style.width = "100%";
      state.sheet.style.maxWidth = "24rem";
      state.sheet.style.maxHeight = "86vh";
      state.sheet.style.height = "86vh";
      state.sheet.style.display = "flex";
      state.sheet.style.flexDirection = "column";
      state.sheet.style.overflow = "hidden";
      var handle = state.sheet.firstElementChild, header = handle && handle.nextElementSibling;
      if (handle) { handle.style.flex = "0 0 auto"; handle.style.marginTop = "auto"; }
      if (header) header.style.flex = "0 0 auto";
      var calendarBody = state.sheet.querySelector("[data-hesabno-settlement-datepicker-body]");
      calendarBody.style.flex = "0 1 auto";
      calendarBody.style.minHeight = "0";
      calendarBody.style.overflowY = "auto";
      calendarBody.style.display = "flex";
      calendarBody.style.flexDirection = "column";
      calendarBody.style.paddingBottom = "0px";
      state.sheet.style.boxSizing = "border-box";
      state.sheet.style.borderTopLeftRadius = "24px";
      state.sheet.style.borderTopRightRadius = "24px";
      state.sheet.style.borderBottomLeftRadius = "0px";
      state.sheet.style.borderBottomRightRadius = "0px";
      state.sheet.style.paddingBottom = "0px";
      var footer = state.sheet.querySelector("[data-hesabno-settlement-confirm]").parentElement;
      footer.style.flex = "0 0 auto";
      footer.style.backgroundColor = "inherit";
      footer.style.paddingBottom = "calc(4px + env(safe-area-inset-bottom, 0px))";
      var previousMonthPath = state.sheet.querySelector("[data-hesabno-settlement-prev-month] path");
      var nextMonthPath = state.sheet.querySelector("[data-hesabno-settlement-next-month] path");
      if (previousMonthPath) previousMonthPath.setAttribute("d", "m9 18 6-6-6-6");
      if (nextMonthPath) nextMonthPath.setAttribute("d", "m15 18-6-6 6-6");
      if (document.documentElement.getAttribute("data-theme") === "light") {
        state.sheet.classList.remove("bg-[#161a23]");
        state.sheet.classList.add("bg-stone-900");
        state.sheet.querySelectorAll("[data-hesabno-settlement-prev-month], [data-hesabno-settlement-next-month]").forEach(function (button) {
          button.classList.remove("text-stone-200", "hover:text-white", "hover:bg-stone-700");
          button.classList.add("text-stone-700", "hover:text-stone-950", "hover:bg-stone-200");
          button.style.minWidth = "34px";
          button.style.minHeight = "34px";
          button.style.display = "flex";
          button.style.alignItems = "center";
          button.style.justifyContent = "center";
          var icon = button.querySelector("svg");
          if (icon) {
            icon.style.color = "#374650";
            icon.style.strokeWidth = "2.5";
            icon.style.overflow = "visible";
          }
        });
      }
      document.body.appendChild(backdrop);
      renderSettlementPicker(state);
      backdrop.addEventListener("click", function (event) {
        if (event.target === backdrop) {
          event.stopPropagation();
          return;
        }
        var button = event.target.closest && event.target.closest("button");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        if (button.hasAttribute("data-hesabno-settlement-close")) {
          closeSettlementPicker(state);
        } else if (button.hasAttribute("data-hesabno-settlement-confirm")) {
          state.setDate(state.pendingDate, true);
        } else if (button.id === "datepicker-year-button") {
          state.yearMode = !state.yearMode;
          renderSettlementPicker(state);
        } else if (button.hasAttribute("data-hesabno-settlement-prev-month") || button.hasAttribute("data-hesabno-settlement-next-month")) {
          state.viewMonth += button.hasAttribute("data-hesabno-settlement-prev-month") ? -1 : 1;
          if (state.viewMonth < 1) { state.viewMonth = 12; state.viewYear -= 1; }
          if (state.viewMonth > 12) { state.viewMonth = 1; state.viewYear += 1; }
          renderSettlementPicker(state);
        } else if (button.hasAttribute("data-hesabno-settlement-year")) {
          state.viewYear = Number(button.getAttribute("data-hesabno-settlement-year"));
          state.yearMode = false;
          renderSettlementPicker(state);
        } else if (button.hasAttribute("data-hesabno-settlement-day")) {
          state.pendingDate = formatDate({ year: state.viewYear, month: state.viewMonth, day: Number(button.getAttribute("data-hesabno-settlement-day")) });
          renderSettlementPicker(state);
        } else if (button.id === "datepicker-today-button") {
          state.pendingDate = clampSettlementDate(appDate(), field.getAttribute("data-hesabno-settlement-min-date"));
          var todayParts = parseDate(state.pendingDate);
          if (todayParts) { state.viewYear = todayParts.year; state.viewMonth = todayParts.month; }
          renderSettlementPicker(state);
        }
      });
    };
    var wireSettlementDateField = function (field) {
      var input = modalDateInput(field), control = field.querySelector("[data-hesabno-settlement-date-control]"), quick = field.querySelector("[data-hesabno-settlement-date-quick]");
      if (!input || !control || field.__hesabnoSettlementPicker) return;
      var state = { field: field, input: input, backdrop: null, sheet: null, viewYear: 0, viewMonth: 0, yearMode: false, pendingDate: "" };
      var previousDayPath = control.querySelector("[data-hesabno-settlement-prev-day] path");
      var nextDayPath = control.querySelector("[data-hesabno-settlement-next-day] path");
      if (previousDayPath) previousDayPath.setAttribute("d", "m9 18 6-6-6-6");
      if (nextDayPath) nextDayPath.setAttribute("d", "m15 18-6-6 6-6");
      state.setDate = function (value, close) {
        input.value = clampSettlementDate(value, field.getAttribute("data-hesabno-settlement-min-date"));
        syncSettlementDateField(field);
        if (close) closeSettlementPicker(state);
      };
      field.__hesabnoSettlementPicker = state;
      control.addEventListener("click", function (event) {
        var button = event.target.closest && event.target.closest("button");
        if (!button) {
          event.preventDefault();
          openSettlementPicker(field);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (button.hasAttribute("data-hesabno-settlement-prev-day")) state.setDate(addDays(input.value, -1), false);
        if (button.hasAttribute("data-hesabno-settlement-next-day")) state.setDate(addDays(input.value, 1), false);
      });
      if (quick) quick.addEventListener("click", function (event) {
        var button = event.target.closest && event.target.closest("button"), months;
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        months = Number(button.getAttribute("data-hesabno-settlement-add-months"));
        if (months) state.setDate(addMonths(input.value, months), false);
      });
      syncSettlementDateField(field);
    };
    var readModalDate = function (modal) {
      var input = modalDateInput(modal), minimum = normalizeDate(input && input.closest("[data-hesabno-settlement-date-field]")?.getAttribute("data-hesabno-settlement-min-date")), date = clampSettlementDate(input && input.value, minimum);
      if (input) {
        input.setAttribute("aria-invalid", "false");
        input.value = date;
        syncSettlementDateField(input.closest("[data-hesabno-settlement-date-field]"));
      }
      return date;
    };
    var ensureField = function (modal) {
      if (!modal || modal.querySelector("[data-hesabno-settlement-date-field]")) return;
      var field = document.createElement("div");
      field.setAttribute("data-hesabno-settlement-date-field", "true");
      field.innerHTML = "<div class=\"flex items-center justify-between\"><label class=\"flex items-center gap-1.5 text-xs font-black text-emerald-300\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"text-emerald-400\"><path d=\"M8 2v4\"></path><path d=\"M16 2v4\"></path><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"></rect><path d=\"M3 10h18\"></path><path d=\"M8 14h.01\"></path><path d=\"M12 14h.01\"></path><path d=\"M16 14h.01\"></path></svg><span>تاریخ واقعی وصول / پاس‌شدن</span></label><span class=\"text-[10px] text-emerald-200/80 font-mono font-bold\" data-hesabno-settlement-date-badge></span></div><div data-hesabno-settlement-date-control dir=\"rtl\" class=\"w-full bg-stone-900 hover:bg-stone-850 border border-stone-700/80 hover:border-stone-600 rounded-2xl p-3 flex items-center justify-between transition cursor-pointer group shadow-xs\"><div class=\"flex items-center gap-3 grow min-w-0 pr-1\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"text-stone-400 group-hover:text-blue-400 flex-shrink-0 transition-colors\"><path d=\"M8 2v4\"></path><path d=\"M16 2v4\"></path><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"></rect><path d=\"M3 10h18\"></path></svg><span class=\"font-bold text-xs sm:text-[13px] text-stone-100 truncate\" data-hesabno-settlement-date-value></span></div><div class=\"flex items-center gap-1 flex-shrink-0 pl-1\"><button type=\"button\" class=\"p-1.5 rounded-lg transition text-stone-300 hover:text-white hover:bg-stone-800 active:scale-95 hesabno-control-no-motion\" title=\"روز قبل (دیروز)\" data-hesabno-settlement-prev-day><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m9 18 6-6-6-6\"></path></svg></button><button type=\"button\" class=\"p-1.5 rounded-lg transition text-stone-300 hover:text-white hover:bg-stone-800 active:scale-95 hesabno-control-no-motion\" title=\"روز بعد (فردا)\" data-hesabno-settlement-next-day><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m15 18-6-6 6 6\"></path></svg></button></div></div><div class=\"flex gap-1.5 pt-0.5\" data-hesabno-settlement-date-quick><button type=\"button\" class=\"flex-1 py-1.5 rounded-lg bg-stone-800 hover:bg-amber-500/20 hover:border-amber-500/50 text-[11px] font-bold text-stone-300 hover:text-amber-200 border border-stone-700/70 transition cursor-pointer\" data-hesabno-settlement-add-months=\"1\">+۱ ماه</button><button type=\"button\" class=\"flex-1 py-1.5 rounded-lg bg-stone-800 hover:bg-amber-500/20 hover:border-amber-500/50 text-[11px] font-bold text-stone-300 hover:text-amber-200 border border-stone-700/70 transition cursor-pointer\" data-hesabno-settlement-add-months=\"2\">+۲ ماه</button><button type=\"button\" class=\"flex-1 py-1.5 rounded-lg bg-stone-800 hover:bg-amber-500/20 hover:border-amber-500/50 text-[11px] font-bold text-stone-300 hover:text-amber-200 border border-stone-700/70 transition cursor-pointer\" data-hesabno-settlement-add-months=\"3\">+۳ ماه</button><button type=\"button\" class=\"flex-1 py-1.5 rounded-lg bg-stone-800 hover:bg-amber-500/20 hover:border-amber-500/50 text-[11px] font-bold text-stone-300 hover:text-amber-200 border border-stone-700/70 transition cursor-pointer\" data-hesabno-settlement-add-months=\"6\">+۶ ماه</button></div><input type=\"text\" inputmode=\"numeric\" maxlength=\"10\" dir=\"ltr\" data-hesabno-settlement-date-input aria-hidden=\"true\" style=\"display:none\">";
      var minimum = settlementMinimumDate();
      if (minimum) field.setAttribute("data-hesabno-settlement-min-date", minimum);
      var quickMonths = field.querySelector("[data-hesabno-settlement-date-quick]");
      if (quickMonths) quickMonths.remove();
      var input = field.querySelector("[data-hesabno-settlement-date-input]");
      input.value = clampSettlementDate(appDate(), minimum);
      wireSettlementDateField(field);
      var confirm = Array.from(modal.querySelectorAll("button")).find(function (button) { return clean(button.textContent).includes("تایید و کسر از حساب"); });
      var anchor = confirm && confirm.parentElement;
      if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(field, anchor);
      else {
        var action = Array.from(modal.querySelectorAll("button")).find(function (button) { return clean(button.textContent) && !clean(button.textContent).includes("انصراف"); });
        var actionRow = action && action.parentElement;
        if (actionRow && actionRow.parentElement) actionRow.parentElement.insertBefore(field, actionRow);
        else modal.appendChild(field);
      }
    };
    var currentCandidate = null;
    document.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("button") : null;
      if (!button) return;
      var text = clean(button.textContent);
      var article = button.closest("article");
      if (article && isClearAction(text)) {
        currentCandidate = candidateFromArticle(article);
        window.setTimeout(function () { ensureField(findModal()); }, 0);
        return;
      }
      if (article && ["در جریان", "خوابیده در بانک", "مسترد شده", "برگشت خورده"].indexOf(text) !== -1) {
        forget(candidateFromArticle(article));
      }
      var statusModal = findStatusModal();
      if (statusModal && ["در جریان", "خوابیده در بانک", "مسترد شده", "برگشت خورده"].indexOf(text) !== -1) {
        forget(candidateFromModal(statusModal));
        return;
      }
      var modal = findModal();
      if (!modal) return;
      var modalText = clean(modal.textContent);
      if (modalText.includes("تایید پاس‌شدن چک و کسر از حساب") && text.includes("تایید و کسر از حساب")) {
        remember(candidateFromModal(modal) || currentCandidate, readModalDate(modal));
        return;
      }
      if (modalText.includes("تایید وصول چک به حساب") && text && !/انصراف|لغو|بستن/u.test(text)) {
        remember(currentCandidate || candidateFromModal(modal), readModalDate(modal));
      }
    }, true);
    window.__hesabnoGetSettlementDate = function () {
      return readModalDate(findModal());
    };
    /* قواعد ظاهری تاریخ تسویه/وصول چک در بستهٔ ۲۳۵ قرار دارد. */
    var ensureDisplayStyle = function () {};
    var articleItem = function (article) {
      var articleId = article && article.id && article.id.indexOf("tx-card-") === 0 ? article.id.slice("tx-card-".length) : "";
      if (articleId) {
        var byId = itemByCandidate({ id: articleId });
        if (byId) return byId;
      }
      var number = article.getAttribute("data-hesabno-check-number") || "";
      var match = clean(article.textContent).match(/شماره چک:\s*([0-9۰-۹]+)/u);
      number = latinDigits(number || (match && match[1]) || "").replace(/\D/g, "");
      return number ? itemByCandidate({ number: number }) : null;
    };
    var syncArticle = function (article) {
      var grid = article.querySelector("[data-hesabno-check-info-grid]") || Array.from(article.querySelectorAll("div.grid")).find(function (node) { return clean(node.textContent).includes("تاریخ سررسید"); });
      if (!grid) return;
      var item = articleItem(article);
      if (!item || !item.check) return;
      var txSettlementDisplay = article.querySelector("[data-hesabno-tx-settlement-display]");
      if (txSettlementDisplay) txSettlementDisplay.remove();
      var due = grid.querySelector("[data-hesabno-check-info-due]") || Array.from(grid.children).find(function (node) { return clean(node.textContent).includes("تاریخ سررسید"); });
      if (!due) return;
      var dueLabel = Array.from(due.querySelectorAll("span")).find(function (node) {
        return clean(node.textContent).replace(/[：:]$/u, "") === "تاریخ سررسید";
      });
      var settlement = settlementFor(item);
      var dueValue = dueLabel && dueLabel.nextElementSibling;
      var numericDueDate = displayDate(item.check.dueDate);
      if (dueValue) {
        if (!dueValue.hasAttribute("data-hesabno-check-due-value")) dueValue.setAttribute("data-hesabno-check-due-value", "true");
        if (numericDueDate !== "—" && clean(dueValue.textContent) !== numericDueDate) dueValue.textContent = numericDueDate;
      }
      var node = due.querySelector("[data-hesabno-check-settlement-display]");
      if (!node) {
        node = document.createElement("div");
        node.setAttribute("data-hesabno-check-settlement-display", "true");
        node.innerHTML = "<span data-hesabno-check-settlement-label>تاریخ وصول / پاس‌شدن</span><span data-hesabno-check-settlement-value></span>";
        due.appendChild(node);
      }
      node.style.display = settlement ? "" : "none";
      var value = node.querySelector("[data-hesabno-check-settlement-value]");
      var settlementText = displayDate(settlement);
      if (value && value.textContent !== settlementText) value.textContent = settlementText;
    };
    var syncDashboard = function () {
      document.querySelectorAll(".hesabno-dashboard-check-item").forEach(function (button) {
        var match = clean(button.textContent).match(/چک\s+([0-9۰-۹]+)/u);
        var item = match ? itemByCandidate({ number: latinDigits(match[1]).replace(/\D/g, "") }) : null;
        var bottom = button.querySelector(".hesabno-dashboard-check-item-bottom");
        if (!item || !bottom) return;
        var row = bottom.querySelector("[data-hesabno-dashboard-settlement-row]");
        if (!row) { row = document.createElement("span"); row.setAttribute("data-hesabno-dashboard-settlement-row", "true"); bottom.appendChild(row); }
        var settlement = settlementFor(item);
        var rowText = settlement ? "وصول: " + displayDate(settlement) : "";
        if (row.textContent !== rowText) row.textContent = rowText;
        row.style.display = settlement ? "" : "none";
      });
      document.querySelectorAll(".hesabno-dashboard-panel-detail").forEach(function (detail) {
        var match = clean(detail.textContent).match(/شماره چک\s*([0-9۰-۹]+)/u);
        var item = match ? itemByCandidate({ number: latinDigits(match[1]).replace(/\D/g, "") }) : null;
        if (!item) return;
        var row = detail.querySelector("[data-hesabno-dashboard-settlement-row]");
        if (!row) { row = document.createElement("div"); row.setAttribute("data-hesabno-dashboard-settlement-row", "true"); detail.appendChild(row); }
        var settlement = settlementFor(item);
        var rowText = settlement ? "تاریخ وصول / پاس‌شدن: " + displayDate(settlement) : "";
        if (row.textContent !== rowText) row.textContent = rowText;
        row.style.display = settlement ? "" : "none";
      });
    };
    var sync = function () {
      if (!document || !document.querySelectorAll) return;
      ensureDisplayStyle();
      var modal = findModal();
      if (modal) ensureField(modal);
      document.querySelectorAll("article").forEach(syncArticle);
      syncDashboard();
    };
    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(function () { scheduled = false; sync(); });
    };
    sync();
    window.addEventListener("hesabno:settlement-date-updated", schedule);
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-hesabno-check-number", "data-hesabno-check-card-layout"] });
  })();
