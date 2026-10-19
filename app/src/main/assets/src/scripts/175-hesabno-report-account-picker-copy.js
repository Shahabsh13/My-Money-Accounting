(function () {
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var categoryLabels = new Set(["هزینه‌ها", "درآمدها", "بانک‌ها", "صندوق‌ها", "اشخاص", "دارایی‌ها", "بدهی‌ها", "سرمایه"]);
    var reportName = function (main, pickerHeading) {
      var reportHeading = Array.from(main.querySelectorAll("h1, h2, h3")).find(function (heading) {
        var text = clean(heading.textContent);
        return heading !== pickerHeading && /^(?:گزارش|ترازنامه|خلاصه گزارش|سود و زیان|صورت‌حساب)/u.test(text);
      });
      if (!reportHeading) return "";
      return clean(reportHeading.textContent).split("›")[0].replace(/\s*ماهانه.*$/u, "").trim();
    };
    var update = function () {
      Array.from(document.querySelectorAll("main")).forEach(function (main) {
        var headings = Array.from(main.querySelectorAll("h1, h2, h3"));
        var pickerHeading = headings.find(function (heading) { return /^انتخاب حساب(?:\s|$)/u.test(clean(heading.textContent)); });
        var activeCategory = Array.from(main.querySelectorAll("button")).find(function (button) {
          return categoryLabels.has(clean(button.textContent)) && /\bbg-emerald-(?:500|600)\b/u.test(String(button.className));
        });
        var activeGroup = activeCategory ? clean(activeCategory.textContent) : "";
        if (pickerHeading) {
          var title = reportName(main, pickerHeading);
          if (title) {
            if (clean(pickerHeading.textContent) !== title) pickerHeading.textContent = title;
            var pickerHeader = pickerHeading.closest("header");
            if (pickerHeader) pickerHeader.querySelectorAll("p").forEach(function (paragraph) {
              if (paragraph.dataset.hesabnoReportPickerDescription !== "true") paragraph.dataset.hesabnoReportPickerDescription = "true";
            });
          }
        }
        Array.from(main.querySelectorAll("p")).forEach(function (paragraph) {
          var text = clean(paragraph.textContent);
          var prefix = "گردش تجمیعی کل سرفصل‌های ";
          var originalGroup = paragraph.dataset.hesabnoReportAggregateGroup || "";
          if (!originalGroup && text.indexOf(prefix) !== 0) return;
          if (!originalGroup && text.indexOf(prefix) === 0) {
            originalGroup = text.slice(prefix.length).replace(/^«|»$/gu, "").trim();
            if (originalGroup && paragraph.dataset.hesabnoReportAggregateGroup !== originalGroup) paragraph.dataset.hesabnoReportAggregateGroup = originalGroup;
          }
          var groupName = activeGroup || originalGroup;
          if (!groupName) return;
          var shortTitle = /^کل\s/u.test(groupName) ? groupName : "کل " + groupName;
          if (text !== shortTitle) paragraph.textContent = shortTitle;
          if (paragraph.parentElement) paragraph.parentElement.querySelectorAll("p").forEach(function (description) {
            if (description !== paragraph && description.dataset.hesabnoReportAggregateDescription !== "true") description.dataset.hesabnoReportAggregateDescription = "true";
          });
        });
      });
    };
    var frame = 0;
    var schedule = function () {
      if (frame) return;
      frame = 1;
      Promise.resolve().then(function () { frame = 0; update(); });
    };
    update();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, characterData: true, attributes: true, attributeFilter: ["class"], subtree: true }, schedule);
  })();
