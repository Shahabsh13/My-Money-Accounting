/* One-time correction: only remove the default cash pin, preserving user accounts and other pins. */
(function () {
  'use strict';
  var flag = 'hesabno:default_cash_unpinned_v1';
  try {
    if (localStorage.getItem(flag) === '1') return;
    ['hesabno:accounts_v5', 'hesabno:accounts'].forEach(function (key) {
      var raw = localStorage.getItem(key);
      if (!raw) return;
      var accounts = JSON.parse(raw);
      if (!Array.isArray(accounts)) throw new Error('Invalid account list');
      var changed = false;
      accounts.forEach(function (account) {
        if (account && account.group === 'cash' && String(account.code) === '11001' && account.pinned === true) {
          account.pinned = false;
          changed = true;
        }
      });
      if (changed) localStorage.setItem(key, JSON.stringify(accounts));
    });
    localStorage.setItem(flag, '1');
  } catch (ignored) { /* Retry after a failed storage write. */ }
})();
