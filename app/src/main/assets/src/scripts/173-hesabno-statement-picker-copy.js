(function () {
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var update = function () {
      var main = Array.from(document.querySelectorAll("main")).find(function (candidate) {
        return Array.from(candidate.querySelectorAll("h1")).some(function (heading) { return clean(heading.textContent) === "گزارش صورتحساب"; });
      });
      if (!main) return;
      Array.from(main.querySelectorAll("p")).forEach(function (paragraph) {
        if (clean(paragraph.textContent) === "گردش اسناد و مانده لحظه‌ای") paragraph.dataset.hesabnoStatementExtraDescription = "true";
      });
      Array.from(main.querySelectorAll("span")).forEach(function (span) {
        var text = clean(span.textContent);
        if (text === "انتخاب حساب یا گروه جهت مشاهده صورت‌حساب" || text === "انتخاب حساب یا گروه") span.textContent = "انتخاب حساب";
        else if (text === "جهت مشاهده صورت‌حساب، حساب یا گروه مورد نظر را انتخاب نمایید") {
          span.dataset.hesabnoStatementExtraDescription = "true";
        }
      });
    };
    var frame = 0;
    var schedule = function () {
      if (frame) return;
      frame = requestAnimationFrame(function () { frame = 0; update(); });
    };
    update();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, characterData: true, subtree: true });
  })();
