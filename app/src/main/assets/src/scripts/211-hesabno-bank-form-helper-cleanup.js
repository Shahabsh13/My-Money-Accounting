(function () {
  // Removes helper hints from the bank-account form (تعریف حساب بانکی جدید).
  var HINTS = ['داخل پرانتز بین نام بانک و شماره حساب', 'اجباری (۶ رقم آخر', 'اجباری (6 رقم آخر'];
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function cleanHints() {
    document.querySelectorAll('span, p, small, div').forEach(function (node) {
      if (node.children.length > 0) return;
      var text = clean(node.textContent);
      for (var i = 0; i < HINTS.length; i += 1) {
        if (text.indexOf(HINTS[i]) !== -1) { node.remove(); return; }
      }
    });
  }
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; run(); });
  }
  function markBankForm() {
    document.querySelectorAll('h3').forEach(function (h) {
      if (clean(h.textContent) !== 'تعریف حساب بانکی جدید') return;
      var panel = h.closest('[class*="max-h-"]');
      if (panel && !panel.classList.contains('hesabno-bank-form-page')) panel.classList.add('hesabno-bank-form-page');
    });
  }
  function run() { cleanHints(); markBankForm(); }
  run();
  if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
})();
