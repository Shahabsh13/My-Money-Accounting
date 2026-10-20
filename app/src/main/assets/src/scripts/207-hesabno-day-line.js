(function () {
  // This is DAILY NET ACTIVITY, not an account closing balance. The transaction
  // component already computes fees and the day-header enhancer corrects cancelled checks.
  // Mirror that single result; never add opening balances or recompute a second ledger here.
  var busy = false;
  function run() {
    if (busy) return;
    busy = true;
    try {
      document.querySelectorAll('main div.sticky.hesabno-transaction-day-header').forEach(function (header) {
        var total = header.querySelector('.hesabno-transaction-day-total');
        if (!total) return;
        var text = String(total.textContent || '').trim();
        if (!header.classList.contains('hesabno-day-line')) header.classList.add('hesabno-day-line');
        var rule = header.querySelector('.hesabno-day-rule');
        var balance = header.querySelector('.hesabno-day-balance');
        if (!rule) { rule = document.createElement('span'); rule.className = 'hesabno-day-rule'; header.appendChild(rule); }
        if (!balance) {
          balance = document.createElement('span'); balance.className = 'hesabno-day-balance';
          balance.setAttribute('dir', 'rtl'); balance.setAttribute('data-hesabno-money-rtl', 'true');
          balance.title = 'خالص گردش همین روز، بدون موجودی اول دوره';
          header.appendChild(balance);
        }
        if (balance.textContent !== text) balance.textContent = text;
        var negative = /^[\s\u200e\u200f\u061c]*[-−–]/.test(text);
        if (balance.classList.contains('neg') !== negative) balance.classList.toggle('neg', negative);
      });
    } finally { busy = false; }
  }
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    Promise.resolve().then(function () { queued = false; run(); });
  }
  function start() {
    run();
    window.__hesabnoDom.watch(document.body, {childList: true, subtree: true, characterData: true}, schedule);
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
