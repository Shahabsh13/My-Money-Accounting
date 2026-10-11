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
        if (dateSpan) { dateSpan.style.fontSize = "11px"; dateSpan.style.fontWeight = "900"; dateSpan.style.whiteSpace = "nowrap"; }
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
          if (heading) heading.textContent = dateInfo.weekday;
          if (dateText) dateText.textContent = dateInfo.day + " " + dateInfo.month + " " + dateInfo.year;
          if (dateDetails) dateDetails.textContent = dateInfo.iso + " هجری خورشیدی";
        }
        var detailRows = card ? Array.from(card.querySelectorAll(".flex.justify-between.items-center")) : [];
        if (dateInfo && detailRows[0] && detailRows[0].lastElementChild) detailRows[0].lastElementChild.textContent = dateInfo.weekday;
        if (dateInfo && detailRows[1] && detailRows[1].lastElementChild) detailRows[1].lastElementChild.textContent = dateInfo.monthYear;
        if (dateInfo && detailRows[2] && detailRows[2].lastElementChild) detailRows[2].lastElementChild.textContent = dateInfo.gregorian;
        if (card && !card.querySelector("[data-hesabno-calendar-close]")) {
          card.style.position = "relative";
          var closeButton = document.createElement("button");
          closeButton.type = "button";
          closeButton.textContent = "×";
          closeButton.setAttribute("data-hesabno-calendar-close", "true");
          closeButton.setAttribute("aria-label", "بستن تقویم");
          closeButton.setAttribute("title", "بستن");
          closeButton.style.cssText = "position:absolute;top:12px;left:12px;width:32px;height:32px;border:1px solid rgba(71,85,105,.25);border-radius:999px;background:rgba(255,255,255,.45);color:#475569;font-size:24px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer";
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
      window.setTimeout(function () { pending = false; sync(); }, 0);
    };
    sync();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  })();
