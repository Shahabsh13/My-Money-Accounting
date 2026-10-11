(function () {
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var headerDescription = "تراز و مانده کل سرفصل‌های حسابداری بر اساس کدینگ";
    var cardDescriptions = new Set([
      "مجموع هزینه‌ها و مخارج ثبت شده در بازه",
      "مجموع درآمدهای وصول شده و ثبت شده در بازه",
      "موجودی کارت‌ها و حساب‌های جاری بانکی",
      "موجودی نقد، کیف پول و صندوق‌های فیزیکی",
      "طلب ما از اشخاص، دوستان، مشتریان و همکاران",
      "بدهی ما به اشخاص، همکاران، فروشندگان و بستگان",
      "طلا، سکه، مسکن، خودرو، اثاثیه و اسناد دریافتنی",
      "چک‌های پرداختنی، اقساط وام و تعهدات مالی",
      "سرمایه اولیه، اندوخته‌ها و سود انباشته"
    ]);
    var hideDescriptions = function () {
      var page = Array.from(document.querySelectorAll("main")).find(function (main) {
        return Array.from(main.querySelectorAll("h1")).some(function (heading) { return clean(heading.textContent) === "گزارش مانده ها"; });
      });
      if (!page) return;
      Array.from(page.querySelectorAll("p")).forEach(function (paragraph) {
        var text = clean(paragraph.textContent);
        if (text === headerDescription || cardDescriptions.has(text)) paragraph.dataset.hesabnoBalanceReportExtraDescription = "true";
      });
    };
    var frame = 0;
    var schedule = function () {
      if (frame) return;
      frame = requestAnimationFrame(function () { frame = 0; hideDescriptions(); });
    };
    hideDescriptions();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, characterData: true, subtree: true });
  })();
