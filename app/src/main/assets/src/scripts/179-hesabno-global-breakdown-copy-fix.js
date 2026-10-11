(function () {
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var fix = function () {
      Array.from(document.querySelectorAll("span")).forEach(function (span) {
        var text = clean(span.textContent);
        if (text === "تفکیک به تفکیک سرفصل‌ها") {
          var emphasis = span.querySelector("strong");
          if (emphasis && span.firstChild && span.firstChild.nodeType === 3) span.firstChild.nodeValue = "تفکیک ";
          else span.textContent = "تفکیک سرفصل‌ها";
        } else if (text === "(با کلیک بر روی هر سرفصل، به ریز تفصیلی بروید)") {
          span.textContent = "برای دیدن ریز تفصیلی، سرفصل را انتخاب کنید";
          span.dataset.hesabnoGlobalBreakdownHint = "true";
        }
      });
    };
    var frame = 0;
    var schedule = function () {
      if (frame) return;
      frame = requestAnimationFrame(function () { frame = 0; fix(); });
    };
    fix();
    if (document.documentElement) new MutationObserver(schedule).observe(document.documentElement, { childList: true, characterData: true, subtree: true });
    window.addEventListener("DOMContentLoaded", schedule, { once: true });
    window.addEventListener("load", schedule, { once: true });
    [0, 100, 300, 800, 1600].forEach(function (delay) { window.setTimeout(schedule, delay); });
  })();
