(function () {
    return;
    var faDigits = "۰۱۲۳۴۵۶۷۸۹";
    var months = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
    var weekdays = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var fa = function (value) { return String(value).replace(/[0-9]/g, function (digit) { return faDigits[Number(digit)]; }); };
    var toNumber = function (value) { return Number(String(value || "").replace(/[۰-۹]/g, function (digit) { return String(faDigits.indexOf(digit)); })) || 0; };
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
    var today = function () {
      var parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date());
      var values = {};
      parts.forEach(function (part) { values[part.type] = toNumber(part.value) || part.value; });
      return { year: Number(values.year), month: Number(values.month), day: Number(values.day), weekday: values.weekday };
    };
    var monthLength = function (year, month) {
      if (month <= 6) return 31;
      if (month <= 11) return 30;
      return [1, 5, 9, 13, 17, 22, 26, 30].includes(year % 33) ? 30 : 29;
    };
    var style = function () {
      if (document.querySelector("style[data-hesabno-dashboard-calendar-picker-style]")) return;
      var node = document.createElement("style");
      node.setAttribute("data-hesabno-dashboard-calendar-picker-style", "true");
      node.textContent = ".hesabno-dashboard-calendar-picker{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.46);backdrop-filter:blur(12px)}.hesabno-dashboard-calendar-card{width:min(100%,360px);border:1px solid #bdccd5;border-radius:26px;padding:16px;background:linear-gradient(145deg,#f5f9fb,#e8eff3);color:#263746;box-shadow:0 20px 50px rgba(74,99,115,.25)}.hesabno-dashboard-calendar-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:12px;border-bottom:1px solid #cbd8e1}.hesabno-dashboard-calendar-header h2{margin:0;font-size:16px;font-weight:900}.hesabno-dashboard-calendar-back,.hesabno-dashboard-calendar-nav,.hesabno-dashboard-calendar-today{border:1px solid #bdccd5;border-radius:12px;background:#edf3f6;color:#526875;cursor:pointer;font-weight:800}.hesabno-dashboard-calendar-back{padding:8px 11px;font-size:12px}.hesabno-dashboard-calendar-summary{padding:14px 0 10px;text-align:center}.hesabno-dashboard-calendar-weekday{font-size:11px;color:#708690}.hesabno-dashboard-calendar-date{margin-top:4px;font-size:21px;font-weight:900;color:#8a5d0c}.hesabno-dashboard-calendar-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.hesabno-dashboard-calendar-toolbar strong{font-size:14px;color:#526875}.hesabno-dashboard-calendar-nav{width:36px;height:34px;font-size:21px;line-height:1}.hesabno-dashboard-calendar-weekdays,.hesabno-dashboard-calendar-days{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;text-align:center;direction:rtl}.hesabno-dashboard-calendar-weekdays span{padding:4px 0;color:#708690;font-size:10px;font-weight:900}.hesabno-dashboard-calendar-day{min-height:34px;border:1px solid transparent;border-radius:10px;background:transparent;color:#526875;font-weight:800;cursor:pointer}.hesabno-dashboard-calendar-day:hover{background:#dce9ee;border-color:#a9c1cb}.hesabno-dashboard-calendar-day.is-today{background:#f5e6c9;border-color:#d7b45b;color:#8a5d0c}.hesabno-dashboard-calendar-day.is-selected{box-shadow:inset 0 0 0 2px #2b8c73}.hesabno-dashboard-calendar-footer{display:flex;justify-content:flex-start;padding-top:13px}.hesabno-dashboard-calendar-today{padding:8px 14px;color:#19745d;background:#d6eee6;border-color:#9dcfbe}@media (prefers-color-scheme:dark){.hesabno-dashboard-calendar-card{background:linear-gradient(145deg,#14232b,#101a21);border-color:#405762;color:#e2edf1}.hesabno-dashboard-calendar-header{border-bottom-color:#405762}.hesabno-dashboard-calendar-back,.hesabno-dashboard-calendar-nav{background:#1a2a31;border-color:#405762;color:#c2d1d7}.hesabno-dashboard-calendar-toolbar strong,.hesabno-dashboard-calendar-weekday,.hesabno-dashboard-calendar-weekdays span{color:#9bb0b9}.hesabno-dashboard-calendar-date{color:#f5d17a}.hesabno-dashboard-calendar-day{color:#c2d1d7}.hesabno-dashboard-calendar-day:hover{background:#243941;border-color:#5b8794}.hesabno-dashboard-calendar-day.is-today{background:rgba(245,190,55,.16);border-color:#b47d14;color:#f5d17a}}\
      html[data-theme='dark'] .hesabno-dashboard-calendar-card{background:linear-gradient(145deg,#14232b,#101a21);border-color:#405762;color:#e2edf1}html[data-theme='dark'] .hesabno-dashboard-calendar-header{border-bottom-color:#405762}html[data-theme='dark'] .hesabno-dashboard-calendar-back,html[data-theme='dark'] .hesabno-dashboard-calendar-nav{background:#1a2a31;border-color:#405762;color:#c2d1d7}html[data-theme='dark'] .hesabno-dashboard-calendar-toolbar strong,html[data-theme='dark'] .hesabno-dashboard-calendar-weekday,html[data-theme='dark'] .hesabno-dashboard-calendar-weekdays span{color:#9bb0b9}html[data-theme='dark'] .hesabno-dashboard-calendar-date{color:#f5d17a}html[data-theme='dark'] .hesabno-dashboard-calendar-day{color:#c2d1d7}html[data-theme='dark'] .hesabno-dashboard-calendar-day:hover{background:#243941;border-color:#5b8794}html[data-theme='dark'] .hesabno-dashboard-calendar-day.is-today{background:rgba(245,190,55,.16);border-color:#b47d14;color:#f5d17a}";
      document.head.appendChild(node);
    };
    var close = function () { var modal = document.querySelector(".hesabno-dashboard-calendar-picker"); if (modal) modal.remove(); };
    var open = function () {
      close();
      style();
      var current = today(), selected = { year: current.year, month: current.month, day: current.day };
      var modal = document.createElement("div");
      modal.className = "hesabno-dashboard-calendar-picker";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("dir", "rtl");
      modal.innerHTML = '<div class="hesabno-dashboard-calendar-card"><header class="hesabno-dashboard-calendar-header"><h2>تقویم امروز</h2><button type="button" class="hesabno-dashboard-calendar-back">بازگشت</button></header><div class="hesabno-dashboard-calendar-summary"><div class="hesabno-dashboard-calendar-weekday"></div><div class="hesabno-dashboard-calendar-date"></div></div><div class="hesabno-dashboard-calendar-toolbar"><button type="button" class="hesabno-dashboard-calendar-nav" data-cal-nav="prev">‹</button><strong></strong><button type="button" class="hesabno-dashboard-calendar-nav" data-cal-nav="next">›</button></div><div class="hesabno-dashboard-calendar-weekdays"></div><div class="hesabno-dashboard-calendar-days"></div><footer class="hesabno-dashboard-calendar-footer"><button type="button" class="hesabno-dashboard-calendar-today">امروز</button></footer></div>';
      document.body.appendChild(modal);
      var closeButton = modal.querySelector(".hesabno-dashboard-calendar-back");
      closeButton.textContent = "×";
      closeButton.setAttribute("aria-label", "بستن تقویم");
      closeButton.setAttribute("title", "بستن");
      var weekdayNode = modal.querySelector(".hesabno-dashboard-calendar-weekday");
      var dateNode = modal.querySelector(".hesabno-dashboard-calendar-date");
      var titleNode = modal.querySelector(".hesabno-dashboard-calendar-toolbar strong");
      var daysNode = modal.querySelector(".hesabno-dashboard-calendar-days");
      weekdays.forEach(function (day) { var node = document.createElement("span"); node.textContent = day.slice(0, 1); modal.querySelector(".hesabno-dashboard-calendar-weekdays").appendChild(node); });
      var render = function () {
        var selectedDate = jalaliToGregorian(selected.year, selected.month, selected.day);
        var weekday = new Intl.DateTimeFormat("fa-IR", { weekday: "long" }).format(selectedDate);
        weekdayNode.textContent = weekday;
        dateNode.textContent = fa(selected.day + " " + months[selected.month - 1] + " " + selected.year);
        titleNode.textContent = months[selected.month - 1] + " " + fa(selected.year);
        daysNode.innerHTML = "";
        var first = jalaliToGregorian(selected.year, selected.month, 1);
        var offset = (first.getDay() + 1) % 7;
        for (var empty = 0; empty < offset; empty += 1) daysNode.appendChild(document.createElement("span"));
        var length = monthLength(selected.year, selected.month);
        for (var day = 1; day <= length; day += 1) {
          var button = document.createElement("button");
          button.type = "button";
          button.className = "hesabno-dashboard-calendar-day";
          button.textContent = fa(day);
          if (day === current.day && selected.month === current.month && selected.year === current.year) button.classList.add("is-today");
          if (day === selected.day) button.classList.add("is-selected");
          button.addEventListener("click", function (event) { selected.day = Number(String(event.currentTarget.textContent).replace(/[۰-۹]/g, function (digit) { return String(faDigits.indexOf(digit)); })); render(); });
          daysNode.appendChild(button);
        }
      };
      modal.querySelector(".hesabno-dashboard-calendar-back").addEventListener("click", close);
      modal.addEventListener("click", function (event) { if (event.target === modal) close(); });
      modal.querySelector('[data-cal-nav="prev"]').addEventListener("click", function () { selected.month -= 1; if (selected.month < 1) { selected.month = 12; selected.year -= 1; } selected.day = Math.min(selected.day, monthLength(selected.year, selected.month)); render(); });
      modal.querySelector('[data-cal-nav="next"]').addEventListener("click", function () { selected.month += 1; if (selected.month > 12) { selected.month = 1; selected.year += 1; } selected.day = Math.min(selected.day, monthLength(selected.year, selected.month)); render(); });
      modal.querySelector(".hesabno-dashboard-calendar-today").addEventListener("click", function () { selected = { year: current.year, month: current.month, day: current.day }; render(); });
      render();
    };
    document.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest('button[title="مشاهده تقویم و تاریخ امروز"]') : null;
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      open();
    }, true);
  })();
