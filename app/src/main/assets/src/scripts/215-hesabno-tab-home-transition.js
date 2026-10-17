/* لایه ۲۱۵: تشخیص ورود به «خانه» و خروج از آن، و اعمال کلاس‌های انیمیشن در لایه‌ی CSS همین شماره.
   فقط تغییر وضعیت «خانه ↔ سایر تب‌ها» را مدیریت می‌کند؛ صفحه‌های جزئیات (دکمه‌ی بازگشت) را تغییر نمی‌دهد. */
(function () {
  var HOME_CLASS = 'hesabno-dashboard-main';
  var lastHome = null;
  var timer = 0;

  function isTabPage(main) {
    return !!main && !!document.querySelector('nav.fixed') &&
      !main.querySelector('button[aria-label="بازگشت"], button[title="بازگشت"]');
  }

  function replay(element, className) {
    element.classList.remove('hesabno-tab-enter-home', 'hesabno-tab-leave-home');
    void element.offsetWidth; // ری‌استارت انیمیشن
    element.classList.add(className);
  }

  function check() {
    var main = document.querySelector('main');
    if (!main) return;
    var tabPage = isTabPage(main);
    if (!tabPage) { lastHome = null; return; }
    var nowHome = main.classList.contains(HOME_CLASS);
    if (lastHome === null) { lastHome = nowHome; return; }
    if (nowHome === lastHome) return;
    lastHome = nowHome;

    if (nowHome) {
      replay(main, 'hesabno-tab-enter-home');
      var header = document.querySelector('header');
      if (header) {
        header.classList.remove('hesabno-home-header-enter');
        void header.offsetWidth;
        header.classList.add('hesabno-home-header-enter');
      }
    } else {
      replay(main, 'hesabno-tab-leave-home');
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(function () {
      main.classList.remove('hesabno-tab-enter-home', 'hesabno-tab-leave-home');
    }, 320);
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    // MutationObserver در همان تسک قبل از رسم اجرا می‌شود؛ پس فریم بدون جبران دیده نمی‌شود.
    Promise.resolve().then(function () { queued = false; check(); });
  }

  if (document.body) {
    window.__hesabnoDom.watch(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }, schedule);
  }
  check();
})();
