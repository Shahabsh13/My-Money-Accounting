(function () {
  // پیامبانک > الگوها: توضیح بالای صفحه و دو الگوی نمونه‌ی پیش‌فرض (بانک آینده، بانک رفاه کارگران) پنهان می‌شوند.
  // داده‌ها پاک نمی‌شوند؛ فقط در نمایش مخفی می‌شوند.
  var HIDE_TEXT = 'تعریف الگو و فرمت جدید';
  var SAMPLE_TITLES = []; // User-defined patterns must remain visible, for every bank.
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function hide(el) {
    if (el.dataset.hesabnoHidden === '1') return;
    el.style.display = 'none';
    el.dataset.hesabnoHidden = '1';
  }
  function run() {
    document.querySelectorAll('p').forEach(function (p) {
      if (clean(p.textContent).indexOf(HIDE_TEXT) === 0) hide(p);
    });
    document.querySelectorAll('span, div, p, h3, h4').forEach(function (node) {
      if (node.dataset.hesabnoHidden === '1') return;
      var own = Array.prototype.filter.call(node.childNodes, function (n) { return n.nodeType === 3; })
        .map(function (n) { return clean(n.nodeValue); }).join(' ');
      if (SAMPLE_TITLES.indexOf(own) === -1) return;
      var card = node;
      while (card.parentElement && card.parentElement.tagName !== 'MAIN' &&
             ((card.parentElement.textContent || '').match(/کلمه کلیدی بانک/g) || []).length <= 1) {
        card = card.parentElement;
      }
      if (card.dataset.hesabnoHidden !== '1' && (card.textContent || '').indexOf('کلمه کلیدی بانک') !== -1) hide(card);
    });
  }
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    Promise.resolve().then(function () { queued = false; run(); });
  }
  run();
  document.addEventListener('click', schedule, true);
  if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
})();
