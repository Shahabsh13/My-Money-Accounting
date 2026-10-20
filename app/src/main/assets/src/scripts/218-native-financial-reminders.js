/* Persist eligible financial reminders for Android delivery without a running WebView. */
(function () {
  'use strict';
  var bridge = window.HnBridge;
  if (!bridge || typeof bridge.saveFinancialReminderPlan !== 'function') return;
  var last = '';
  function sync() {
    try {
      var keys = ['hesabno:transactions', 'hesabno:loans', 'hesabno:installments', 'hesabno:checkAlertDays', 'hesabno:reminderTime', 'hesabno:permissions'];
      var values = keys.map(function (key) { return localStorage.getItem(key); });
      var signature = JSON.stringify(values);
      if (signature === last) return;
      var txs = JSON.parse(values[0] || '[]'), loans = JSON.parse(values[1] || '[]'), installments = JSON.parse(values[2] || '[]');
      if (!Array.isArray(txs) || !Array.isArray(loans) || !Array.isArray(installments)) return;
      var perms = JSON.parse(values[5] || '{}') || {}, days = Number(values[3]) || 3;
      var entries = [], loanMap = new Map(loans.map(function (loan) { return [String(loan.id), loan]; }));
      function add(item, parent, target) {
        if (!item) return;
        var due = target === 'checks' ? ((item.check || {}).dueDate || item.date) : (item.dueDate || item.date);
        var info = target === 'checks' ? window.__hesabnoBuildCheckNotification(item, due, days) : window.__hesabnoBuildInstallmentNotification(item, parent, due, days);
        if (!info) return; // Paid/completed/cancelled items never enter the native plan.
        var day = window.__hesabnoReminderDueDay(due);
        if (!Number.isFinite(day)) return;
        entries.push({id: target + ':' + String(info.checkId || info.installmentId), target: target, dueDay: day,
          days: days, title: target === 'checks' ? 'یادآوری سررسید چک' : 'یادآوری سررسید قسط', body: info.body});
      }
      txs.forEach(function (item) { add(item, null, 'checks'); });
      installments.forEach(function (item) {
        var parent = item && loanMap.get(String(item.loanId));
        if (parent && parent.reminder === false) return;
        add(item, parent, 'loans');
      });
      if (bridge.saveFinancialReminderPlan(JSON.stringify({entries: entries, time: values[4] || '21:00', enabled: perms.notifications !== false}))) last = signature;
    } catch (error) { /* Preserve the last valid native plan on a transient malformed read. */ }
  }
  window.__hesabnoSyncNativeFinancialReminders = sync;
  if (window.__hesabnoStorageGuard && typeof window.__hesabnoStorageGuard.onWrite === 'function') window.__hesabnoStorageGuard.onWrite(sync);
  // removeItem/clear are not reported by every version of the write guard.
  ['removeItem', 'clear'].forEach(function (name) {
    var original = Storage.prototype[name];
    Storage.prototype[name] = function () {
      var result = original.apply(this, arguments);
      if (this === window.localStorage) sync();
      return result;
    };
  });
  window.addEventListener('storage', sync);
  window.addEventListener('pagehide', sync);
  document.addEventListener('visibilitychange', sync);
  // Backup restoration, deletion and settings mutations may bypass the write observer.
  var timer = window.setInterval(sync, 1000);
  if (timer && typeof timer.unref === 'function') timer.unref();
  sync();
})();
