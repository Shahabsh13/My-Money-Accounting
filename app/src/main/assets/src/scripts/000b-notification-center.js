/* Persistent in-app inbox. Opening the panel never marks messages read. */
(function () {
  'use strict';
  var KEY = 'hesabno:notification-center:v1';
  function list() { try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
  function save(a) { localStorage.setItem(KEY, JSON.stringify(a)); window.dispatchEvent(new Event('hn-notification-center-updated')); }
  function add(info) {
    if (!info || !info.title) return;
    var a = list(), at = info.createdAt || Date.now();
    var key = info.key || [info.title, info.body || '', info.target || 'home', new Date(at).toISOString().slice(0, 10)].join('|');
    var old = a.find(function (n) { return n.key === key; });
    if (old) { if(info.id && old.nativeId !== info.id) {old.nativeId=info.id;save(a);} return old; }
    var n = { nativeId:info.id || null, id: info.id || key, key: key, title: info.title, body: info.body || '', target: info.target || 'home', createdAt: at, read: false };
    a.unshift(n); save(a); return n;
  }
  function read(id) { save(list().map(function (n) { return n.id === id ? Object.assign({}, n, {read:true}) : n; })); }
  function sync() {
    try { if (window.HnBridge && window.HnBridge.getNotificationHistoryJson) JSON.parse(window.HnBridge.getNotificationHistoryJson()).forEach(add); } catch (_) {}
  }
  function open(n) {
    var target = n.target || 'home', fn, ok;
    if (target.indexOf('sms:') === 0) { fn = window.__hesabnoOpenSmsFromNotification; if (!fn) return false; ok = fn(target.slice(4)); }
    else { fn = target === 'checks' ? window.__hesabnoOpenChecksFromNotification : target === 'loans' ? window.__hesabnoOpenLoansFromNotification : window.__hesabnoOpenDashboardFromNotification; if (!fn) return false; ok = fn(); }
    if (ok === false) return false;
    read(n.id); return true;
  }
  window.HnNotificationCenter = {list:list, add:add, read:read, sync:sync, open:open, readNative:function(id){var n=list().find(function(n){return n.nativeId===id;});if(n)read(n.id);}, readAll:function () {save(list().map(function (n) {return Object.assign({}, n, {read:true});}));}};
  window.addEventListener('focus', sync);
  document.addEventListener('visibilitychange', function () {if (!document.hidden) sync();});
})();
