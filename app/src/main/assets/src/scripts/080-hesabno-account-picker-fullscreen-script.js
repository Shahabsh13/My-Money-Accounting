(function () {
  var clean = function (value) { return String(value || '').replace(/\s+/g, ' ').trim(); };
  var motionClasses = ['hesabno-page-open-up', 'hesabno-page-enter', 'hesabno-content-swap', 'hesabno-tab-horizontal-in', 'hesabno-full-page-side-open'];
  var enhance = function () {
    document.querySelectorAll('div.fixed.inset-0').forEach(function (overlay) {
      var pickerTitles = ['دریافت از:', 'پرداخت به:', 'از حساب:', 'به حساب:', 'تایید وصول چک به حساب', 'انتخاب حساب یا سرفصل گزارش', 'حساب پرداخت‌کننده قسط:', 'حساب پرداخت‌کننده:', 'انتخاب حساب بانکی / صندوق'];
      var heading = Array.from(overlay.querySelectorAll('h1, h2, h3')).find(function (node) {
        return pickerTitles.includes(clean(node.textContent));
      });
      var overlayText = clean(overlay.innerText);
      var hasAccountSignals = overlayText.includes('سنجاق‌شده‌ها') || overlayText.includes('انتخاب حساب') || overlayText.includes('انتخاب حساب بانکی') || overlayText.includes('حساب یا سرفصل') || (overlayText.includes('بانک‌ها') && overlayText.includes('صندوق‌ها') && overlayText.includes('سرفصل'));
      if (!heading && !hasAccountSignals) return;
      if (!overlay.classList.contains('hesabno-account-picker-overlay')) overlay.classList.add('hesabno-account-picker-overlay');
      if (!overlay.classList.contains('hesabno-fullpage-layer')) overlay.classList.add('hesabno-fullpage-layer');
      if (overlay.firstElementChild && !overlay.firstElementChild.classList.contains('hesabno-account-picker-panel')) overlay.firstElementChild.classList.add('hesabno-account-picker-panel');
      var parent = overlay.parentElement;
      while (parent && parent !== document.body) {
        motionClasses.forEach(function (className) { if (parent.classList.contains(className)) parent.classList.remove(className); });
        parent = parent.parentElement;
      }
    });
  };
  var queued = false;
  var scheduleMicrotask = function () {
    if (queued) return;
    queued = true;
    Promise.resolve().then(function () { queued = false; enhance(); });
  };
  enhance();
  // MutationObserver handles inserted/updated pickers; avoid a synchronous document-wide scan on every click.
  if (document.body && window.__hesabnoDom && window.__hesabnoDom.watch) {
    window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, scheduleMicrotask);
  }
})();
