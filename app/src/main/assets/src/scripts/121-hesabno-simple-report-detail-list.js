(function () {
  "use strict";
  var faDigits = "۰۱۲۳۴۵۶۷۸۹";
  var months = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
  var clean = function (v) { return String(v || "").replace(/\s+/g, " ").trim(); };
  var normalizeDigits = function (v) { return String(v || "").replace(/[۰-۹]/g, function (d) { return String(faDigits.indexOf(d)); }); };
  var toFa = function (v) { return String(v).replace(/[0-9]/g, function (d) { return faDigits[Number(d)]; }); };
  var jalaliToGregorian = function (jy, jm, jd) {
    jy += 1595; var days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 1) * 30 + 6);
    var gy = 400 * Math.floor(days / 146097); days %= 146097;
    if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days += 1; }
    gy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    var gd = days + 1, md = [0,31,(gy%4===0&&gy%100!==0)||gy%400===0?29:28,31,30,31,30,31,31,30,31,30,31], gm = 0;
    while (gm < 12 && gd > md[gm]) { gd -= md[gm]; gm += 1; }
    return new Date(gy, gm - 1, gd);
  };
  var dateLabel = function (row) {
    var node = row.querySelector("[data-hesabno-relative-date]");
    var raw = clean(node && node.textContent).replace(/^(امروز|دیروز|پریروز)،?\s*/, "");
    if (!raw) {
      var candidates = Array.from(row.querySelectorAll("span,time,p,div"));
      var dateNode = candidates.find(function (n) { return /(?:^|\s)[۰-۹0-9]{4}[\/-][۰-۹0-9]{1,2}[\/-][۰-۹0-9]{1,2}(?:\s|$)/.test(clean(n.textContent)); });
      raw = clean(dateNode && dateNode.textContent).replace(/^(امروز|دیروز|پریروز)،?\s*/, "");
    }
    var norm = normalizeDigits(raw).replace(/[،,]/g, " ").replace(/\s+/g, " ").trim();
    var m = norm.match(/(?:^|\s)(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:\s|$)/);
    var year = m ? +m[1] : 0, month = m ? +m[2] : 0, day = m ? +m[3] : 0;
    if (!m) { year = +(norm.match(/(?:^|\s)(1[34]\d{2})(?:\s|$)/)||[])[1]||0; month = months.findIndex(function(n){return raw.indexOf(n)!==-1;})+1; day = +(norm.split(" ").find(function(t){var n=+t;return n>=1&&n<=31&&n!==year;})||0); }
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return raw || "بدون تاریخ";
    return new Intl.DateTimeFormat("fa-IR",{weekday:"long"}).format(jalaliToGregorian(year,month,day))+"، "+toFa(day)+" "+months[month-1]+" "+toFa(year);
  };
  var addStyle = function () {
    if (document.querySelector("style[data-hesabno-simple-report-safe-style]")) return;
    var s = document.createElement("style"); s.setAttribute("data-hesabno-simple-report-safe-style","true");
    s.textContent = ".hesabno-report-transaction-row.hesabno-simple-report-date-row[data-hesabno-simple-report-date-heading]::before{content:attr(data-hesabno-simple-report-date-heading);display:block;box-sizing:border-box;width:100%;padding:7px 4px 5px;margin:0 0 5px;color:#708690;font-size:11px;font-weight:900;white-space:nowrap;border-bottom:1px solid rgba(112,134,144,.22)}html[data-theme='dark'] .hesabno-report-transaction-row.hesabno-simple-report-date-row[data-hesabno-simple-report-date-heading]::before{color:#9bb0b9}";
    document.head.appendChild(s);
  };
  var render = function () {
    var card = document.querySelector(".hesabno-report-transaction-card"); if (!card) return;
    var rows = Array.from(card.querySelectorAll(".hesabno-report-transaction-row")); if (!rows.length) return;
    addStyle(); var previous = null;
    rows.forEach(function (row) {
      var label = dateLabel(row); row.classList.add("hesabno-simple-report-date-row");
      if (label !== previous) row.setAttribute("data-hesabno-simple-report-date-heading", label);
      else row.removeAttribute("data-hesabno-simple-report-date-heading");
      previous = label;
    });
  };
  var queued = false;
  var schedule = function () { if (queued) return; queued = true; window.setTimeout(function(){queued=false;render();},0); };
  render(); if (document.body) window.__hesabnoDom.watch(document.body, {childList:true,subtree:true}, schedule);
})();
