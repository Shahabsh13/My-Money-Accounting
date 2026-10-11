(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var faDigits = "۰۱۲۳۴۵۶۷۸۹";
    var months = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
    var normalizeDigits = function (value) {
      return String(value || "").replace(/[۰-۹]/g, function (digit) { return String(faDigits.indexOf(digit)); });
    };
    var toFa = function (value) {
      return String(value).replace(/[0-9]/g, function (digit) { return faDigits[Number(digit)]; });
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
    var withWeekday = function (value) {
      var raw = clean(value).replace(/^(امروز|دیروز|پریروز)،?\s*/, "");
      var normalized = normalizeDigits(raw).replace(/[،,]/g, " ").replace(/\s+/g, " ").trim();
      var slash = normalized.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
      var year = slash ? Number(slash[1]) : 0;
      var month = slash ? Number(slash[2]) : 0;
      var day = slash ? Number(slash[3]) : 0;
      if (!slash) {
        year = Number((normalized.match(/(?:^|\s)(1[34]\d{2})(?:\s|$)/) || [])[1] || 0);
        month = months.findIndex(function (name) { return raw.includes(name); }) + 1;
        var tokens = normalized.split(" ");
        day = Number(tokens.find(function (token) { var number = Number(token); return number >= 1 && number <= 31 && number !== year; }) || 0);
      }
      if (!year || month < 1 || month > 12 || day < 1 || day > 31) return raw;
      var weekday = new Intl.DateTimeFormat("fa-IR", { weekday: "long" }).format(jalaliToGregorian(year, month, day));
      return weekday + "، " + toFa(day) + " " + months[month - 1] + " " + toFa(year);
    };
    var dateLabel = function (row) {
      var node = row.querySelector("[data-hesabno-relative-date]");
      var value = clean(node && node.textContent).replace(/^(امروز|دیروز|پریروز)،?\s*/, "");
      return value ? withWeekday(value) : "بدون تاریخ";
    };
    var bankLabel = function (row) {
      var titled = Array.from(row.querySelectorAll("[title]")).find(function (node) { return clean(node.getAttribute("title")); });
      if (titled) return clean(titled.getAttribute("title"));
      var match = clean(row.textContent).match(/(?:پرداخت‌کننده|دریافت‌کننده):\s*(.+)/);
      return match ? clean(match[1]) : "بانک نامشخص";
    };
    var amountLabel = function (row) {
      var node = Array.from(row.querySelectorAll("span")).find(function (span) { return /(?:تومان|ریال)/.test(clean(span.textContent)); });
      return clean(node && node.textContent) || "";
    };
    var descriptionLabel = function (row) {
      var existing = row.querySelector(".hesabno-simple-report-description");
      if (existing) return clean(existing.textContent);
      var markers = ["توضیحات:", "توضیحات", "شرح:", "شرح", "شرح / بابت", "بابت:", "بابت"];
      var marker = Array.from(row.querySelectorAll("span, div")).find(function (span) { return markers.includes(clean(span.textContent)); });
      if (!marker || !marker.parentElement) return "";
      var value = Array.from(marker.parentElement.querySelectorAll("span, div")).find(function (span) { return span !== marker && clean(span.textContent) && !markers.includes(clean(span.textContent)); });
      return clean(value && value.textContent);
    };
    var style = function () {
      if (document.querySelector("style[data-hesabno-simple-report-detail-list-style]")) return;
      var node = document.createElement("style");
      node.setAttribute("data-hesabno-simple-report-detail-list-style", "true");
      node.textContent = ".hesabno-simple-report-detail-card{width:94%!important;max-width:480px!important;margin-inline:auto!important;padding:12px!important}.hesabno-simple-report-date-group{display:flex;align-items:center;gap:8px;padding:7px 4px 3px;color:#708690;font-size:11px;font-weight:900}.hesabno-simple-report-date-group:after{content:\"\";height:1px;flex:1;background:rgba(112,134,144,.26)}.hesabno-simple-report-date-rows{display:flex;flex-direction:column;gap:3px}.hesabno-simple-report-bank{min-width:0;font-size:12px;font-weight:900;color:#526875;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hesabno-simple-report-amount{flex-shrink:0;font-size:11px;font-weight:900;color:#263746;white-space:nowrap;font-family:Vazirmatn,system-ui,sans-serif}.hesabno-simple-report-description{width:100%;padding:0 4px;color:#83939c;font-size:10px;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}html[data-theme='dark'] .hesabno-simple-report-bank{color:#e2e8f0}html[data-theme='dark'] .hesabno-simple-report-amount{color:#f8fafc}html[data-theme='dark'] .hesabno-simple-report-date-group{color:#9bb0b9}html[data-theme='dark'] .hesabno-simple-report-description{color:#aebdc5}"
      document.head.appendChild(node);
    };
    var render = function () {
      var card = document.querySelector(".hesabno-report-transaction-card");
      if (!card) return;
      var rows = Array.from(card.querySelectorAll(".hesabno-report-transaction-row"));
      if (!rows.length) return;
      var heading = clean(card.querySelector("h2") && card.querySelector("h2").textContent);
      var signature = heading + "||" + rows.map(function (row) { return clean(row.textContent); }).join("|");
      if (card.dataset.hesabnoSimpleReportSignature === signature) return;
      style();
      card.classList.add("hesabno-simple-report-detail-card");
      var groups = [];
      var grouped = {};
      rows.forEach(function (row) {
        var date = dateLabel(row);
        if (!grouped[date]) { grouped[date] = []; groups.push({ date: date, rows: grouped[date] }); }
        grouped[date].push({ row: row, bank: bankLabel(row), amount: amountLabel(row), description: descriptionLabel(row) });
      });
      var list = rows[0].parentElement;
      list.className = "space-y-1.5";
      list.replaceChildren();
      groups.forEach(function (group) {
        var title = document.createElement("div");
        title.className = "hesabno-simple-report-date-group";
        title.textContent = group.date;
        list.appendChild(title);
        var groupRows = document.createElement("div");
        groupRows.className = "hesabno-simple-report-date-rows";
        group.rows.forEach(function (item) {
          var row = item.row;
          row.className = "hesabno-report-transaction-row flex flex-col gap-0.5 p-1.5 rounded-xl bg-stone-900/60 border border-stone-750/70 hover:border-stone-600 transition cursor-pointer group";
          row.replaceChildren();
          var top = document.createElement("div");
          top.className = "flex items-center justify-between gap-2 w-full";
          var bank = document.createElement("span");
          bank.className = "hesabno-simple-report-bank";
          bank.textContent = item.bank;
          bank.title = item.bank;
          var right = document.createElement("div");
          right.className = "flex items-center gap-1.5 shrink-0 text-left";
          var amount = document.createElement("span");
          amount.className = "hesabno-simple-report-amount";
          amount.textContent = item.amount;
          var arrow = document.createElement("span");
          arrow.className = "text-stone-400 text-sm";
          arrow.textContent = "‹";
          right.append(amount, arrow);
          top.append(bank, right);
          row.appendChild(top);
          if (item.description) {
            var description = document.createElement("div");
            description.className = "hesabno-simple-report-description";
            description.textContent = item.description;
            description.title = item.description;
            row.appendChild(description);
          }
          groupRows.appendChild(row);
        });
        list.appendChild(groupRows);
      });
      card.dataset.hesabnoSimpleReportSignature = heading + "||" + rows.map(function (row) { return clean(row.textContent); }).join("|");
    };
    var schedule = function () { window.setTimeout(render, 0); };
    render();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  })();
