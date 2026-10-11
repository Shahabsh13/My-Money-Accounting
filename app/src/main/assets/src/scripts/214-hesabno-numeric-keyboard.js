(function () {
  // فیلدهای عددی (مبلغ، شماره حساب، کارت، شبا، مانده، تعداد، درصد و...) کیبورد عددی باز می‌کنند.
  var NUMERIC_HINTS = /مبلغ|شماره|کارت|شبا|iban|مانده|موجودی|تعداد|درصد|رقم|سقف|قیمت|کد|روز|ماه|سال|تاریخ|زمان|ساعت|عدد|نرخ|سود|کارمزد|تومان|ریال|amount|number|price|card|account/i;
  var SKIP_TYPES = ['checkbox', 'radio', 'file', 'range', 'color', 'hidden', 'submit', 'button', 'reset', 'password', 'email', 'search'];
  function hintText(input) {
    return [input.getAttribute('placeholder'), input.getAttribute('aria-label'),
      input.getAttribute('data-hesabno-inferred-label'), input.getAttribute('name'), input.id].join(' ');
  }
  function apply() {
    document.querySelectorAll('input').forEach(function (input) {
      var type = (input.getAttribute('type') || 'text').toLowerCase();
      if (SKIP_TYPES.indexOf(type) !== -1) return;
      if (input.getAttribute('inputmode') === 'numeric') return;
      var numeric = type === 'number' || type === 'tel' || input.getAttribute('dir') === 'ltr' || NUMERIC_HINTS.test(hintText(input));
      if (!numeric) return;
      if (/جستجو|search/i.test(hintText(input))) return;
      input.setAttribute('inputmode', 'numeric');
    });
  }
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; apply(); });
  }
  apply();
  [300, 1000].forEach(function (d) { setTimeout(apply, d); });
  document.addEventListener('focusin', apply, true);
  document.addEventListener('click', function () { setTimeout(apply, 80); }, true);
  if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'dir'] });
})();
