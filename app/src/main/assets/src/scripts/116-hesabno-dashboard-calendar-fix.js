(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var currentDate = function () {
      try {
        var now = new Date();
        var longParts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", weekday: "long", day: "numeric", month: "long", year: "numeric" }).formatToParts(now);
        var numericParts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
        var longDate = {}, numericDate = {};
        longParts.forEach(function (part) { longDate[part.type] = part.value; });
        numericParts.forEach(function (part) { numericDate[part.type] = part.value; });
        return {
          weekday: longDate.weekday,
          day: longDate.day,
          month: longDate.month,
          year: longDate.year,
          full: longDate.weekday + " " + longDate.day + " " + longDate.month + " " + longDate.year,
          iso: numericDate.year + "/" + numericDate.month + "/" + numericDate.day,
          monthYear: longDate.month + " " + longDate.year,
          gregorian: new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", month: "short", day: "numeric", year: "numeric" }).format(now)
        };
      } catch (error) { return ""; }
    };
    var sync = function () {
      var dateButton = document.querySelector('button[title="مشاهده تقویم و تاریخ امروز"]');
      if (dateButton) {
        var box = dateButton.querySelector("div.text-left") || dateButton.querySelector("div");
        var rows = box ? Array.from(box.children).filter(function (node) { return node.tagName === "DIV"; }) : [];
        var dateInfo = currentDate();
        var fullDate = dateInfo && dateInfo.full;
        var dateSpans = rows[0] ? rows[0].querySelectorAll("span") : [];
        var dateSpan = dateSpans.length ? dateSpans[dateSpans.length - 1] : null;
        if (dateSpan && fullDate && dateSpan.textContent !== fullDate) dateSpan.textContent = fullDate;
        /* ظاهر این اسپن در بستهٔ ۲۳۵ (لایهٔ ظاهر) است؛ این‌جا فقط کلاس معنایی می‌گذاریم. */
        if (dateSpan && !dateSpan.classList.contains("hesabno-dashboard-date-value")) {
          dateSpan.classList.add("hesabno-dashboard-date-value");
        }
        var currentLabel = rows[1] && rows[1].querySelector("span");
        if (currentLabel && currentLabel.textContent !== "امروز") currentLabel.textContent = "امروز";
      }
      var calendar = Array.from(document.querySelectorAll(".fixed")).find(function (node) {
        var text = clean(node.textContent);
        return text.includes("هجری خورشیدی") && text.includes("روز هفته:");
      });
      if (calendar) {
        var dateInfo = currentDate();
        var card = calendar.firstElementChild;
        var heading = card && card.querySelector("h3");
        var dateText = card && card.querySelector("p.text-sm.font-bold");
        var dateDetails = card && card.querySelector("p.text-\\[11px\\]");
        if (dateInfo) {
          if (heading && heading.textContent !== dateInfo.weekday) heading.textContent = dateInfo.weekday;
          var dateLabel = dateInfo.day + " " + dateInfo.month + " " + dateInfo.year;
          if (dateText && dateText.textContent !== dateLabel) dateText.textContent = dateLabel;
          var isoLabel = dateInfo.iso + " هجری خورشیدی";
          if (dateDetails && dateDetails.textContent !== isoLabel) dateDetails.textContent = isoLabel;
        }
        var detailRows = card ? Array.from(card.querySelectorAll(".flex.justify-between.items-center")) : [];
        var setRow = function (row, value) {
          var cell = row && row.lastElementChild;
          if (cell && value && cell.textContent !== value) cell.textContent = value;
        };
        if (dateInfo) {
          setRow(detailRows[0], dateInfo.weekday);
          setRow(detailRows[1], dateInfo.monthYear);
          setRow(detailRows[2], dateInfo.gregorian);
        }
        if (card) card.classList.add("hesabno-calendar-card");
        if (card && !card.querySelector("[data-hesabno-calendar-close]")) {
          var closeButton = document.createElement("button");
          closeButton.type = "button";
          closeButton.textContent = "×";
          closeButton.setAttribute("data-hesabno-calendar-close", "true");
          closeButton.setAttribute("aria-label", "بستن تقویم");
          closeButton.setAttribute("title", "بستن");
          /* ظاهر دکمه در بستهٔ ۲۳۵ (لایهٔ ظاهر) است؛ این‌جا فقط کلاس معنایی. */
          closeButton.className = "hesabno-calendar-close";
          closeButton.addEventListener("click", function (event) { event.preventDefault(); event.stopPropagation(); window.setTimeout(function () { calendar.remove(); }, 0); });
          card.insertBefore(closeButton, card.firstChild);
        }
        var back = Array.from(calendar.querySelectorAll("button")).find(function (button) { return clean(button.textContent) === "بستن"; });
        if (back) { back.textContent = "×"; back.setAttribute("aria-label", "بستن تقویم"); back.setAttribute("title", "بستن"); }
      }
    };
    var pending = false;
    var schedule = function () {
      if (pending) return;
      pending = true;
      /* microtask: رفع ناهماهنگی قبل از نقاشی همان فریم، نه ~۴ms بعد از آن */
      Promise.resolve().then(function () { pending = false; sync(); });
    };
    sync();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
  })();
