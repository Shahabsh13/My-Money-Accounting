/* لایه ۲۲۰: جلوگیری از پرش عمودی محتوا هنگام تعویض تب (Layout Shift).
   تب «خانه» یک <header> ثابت (~63px) دارد؛ بقیه‌ی تب‌ها آن را ندارند و در نتیجه وقتی بین تب‌ها جابه‌جا
   می‌شویم کل محتوا و دکمه‌ها ۶۳ پیکسل بالا/پایین می‌پرند و چند میلی‌ثانیه بعد درست می‌شوند.
   این اسکریپت وقتی header وجود ندارد، همان ارتفاع را به‌عنوان padding-top روی کانتینر محتوا اعمال
   می‌کند تا نقطه‌ی شروع محتوا در همه‌ی تب‌ها یکسان بماند.
   نکته: تغییر هم‌زمان داخل میکروتسک observer انجام می‌شود تا قبل از اولین paint اعمال شود و
   پرش معکوس (اعمال دیرهنگام پدینگ) هم رخ ندهد. */
(function () {
  var HEADER_TAG = 'HEADER';
  var measuredHeaderHeight = 0;

  function getShell() {
    var root = document.getElementById('root');
    if (!root || !root.firstElementChild) return null;
    var outer = root.firstElementChild;
    return outer && outer.firstElementChild;
  }

  function isContentDiv(el) {
    if (!el || el.tagName !== 'DIV') return false;
    var cls = typeof el.className === 'string' ? el.className : '';
    return cls.indexOf('grow') !== -1 && cls.indexOf('flex-col') !== -1;
  }

  function getChildren(shell) {
    var header = null;
    var content = null;
    for (var i = 0; i < shell.children.length; i++) {
      var child = shell.children[i];
      if (child.tagName === HEADER_TAG) header = child;
      else if (!content && isContentDiv(child)) content = child;
    }
    return { header: header, content: content };
  }

  function apply() {
    var shell = getShell();
    if (!shell || !shell.children) return;
    var pair = getChildren(shell);
    var content = pair.content;
    if (!content) return;

    if (pair.header) {
      try {
        var h = pair.header.getBoundingClientRect().height;
        if (h > 0) measuredHeaderHeight = h;
      } catch (error) {}
      if (content.style.paddingTop) content.style.paddingTop = '';
      content.removeAttribute('data-hesabno-header-pad');
      return;
    }

    var pad = measuredHeaderHeight || 63;
    content.style.paddingTop = pad + 'px';
    content.setAttribute('data-hesabno-header-pad', String(Math.round(pad)));
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    // میکروتسک: قبل از paint اجرا می‌شود تا هیچ فریمی با هندسه‌ی ناپایدار دیده نشود.
    Promise.resolve().then(function () { queued = false; apply(); });
  }

  if (document.body) {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  apply();
})();