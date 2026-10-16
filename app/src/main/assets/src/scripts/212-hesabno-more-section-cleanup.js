(function () {
  // بخش «بیشتر»: توضیح زیر عنوان صفحه‌ها حذف می‌شود و دکمه‌ی «افزودن بودجه» به «افزودن» تغییر می‌کند.
  var SUBTITLE_PREFIXES = [
    'کدگذاری استاندارد حسابداری',
    'پیگیری، وصول و تسویه اسناد صیادی',
    'تعیین سقف هزینه، هشدار مصرف',
    'مدیریت پیامک‌های دریافتی',
    'مدیریت اجاره، شارژ، حقوق',
    'تنظیمات پایه، تسهیلات بانکی',
    'جهت مشاهده جزئیات، بررسی حساب‌ها',
    'سریع داشبورد'
  ];
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function run() {
    document.querySelectorAll('main p, header p, h1 ~ p, div p').forEach(function (p) {
      if (p.dataset.hesabnoHidden === '1') return;
      // ترتیب شرط‌ها مهم است: خواندن offsetParent باعث محاسبه‌ی چیدمان می‌شود، پس آخر می‌آید
      if (p.children.length === 0 && !p.textContent && !p.offsetParent) return;
      var text = clean(p.textContent);
      for (var i = 0; i < SUBTITLE_PREFIXES.length; i += 1) {
        if (text.indexOf(SUBTITLE_PREFIXES[i]) !== -1 && text.length < 160) {
          p.style.display = 'none';
          p.dataset.hesabnoHidden = '1';
          return;
        }
      }
    });
    document.querySelectorAll('button').forEach(function (button) {
      if (clean(button.textContent) !== 'افزودن بودجه') return;
      var walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue.indexOf('افزودن بودجه') !== -1) node.nodeValue = node.nodeValue.replace('افزودن بودجه', 'افزودن');
      }
    });
  }
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; run(); });
  }
  run();
  document.addEventListener('click', function () { [0, 120, 400, 1000].forEach(function (d) { setTimeout(run, d); }); }, true);
  [300, 900, 2000].forEach(function (d) { setTimeout(run, d); });
  if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true, characterData: true }, schedule);
})();
