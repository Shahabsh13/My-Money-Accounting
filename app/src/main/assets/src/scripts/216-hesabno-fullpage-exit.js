/* لایه ۲۱۶: انیمیشن خروج برای صفحه‌های تمام‌صفحه و پاپ‌آپ‌های کوچک.
   وقتی یک overlay از DOM حذف می‌شود، یک کپی بی‌اثر (فقط برای نمایش) روی صفحه می‌ماند،
   محو می‌شود و بعد پاک می‌شود. کپی هیچ رویدادی ندارد و کلاس‌های انیمیشن ورود را هم ندارد
   تا دوباره اجرا نشوند. منطق برنامه تغییر نمی‌کند.
   - تمام‌صفحه: کلاس .hesabno-fullpage-layer (از لایه‌ی ۲۱۰)
   - پاپ‌آپ کوچک: هر overlay «fixed inset-0» که لایه‌ی ۰۷۱ آن را .hesabno-overlay-motion کرده */
(function () {
  var FULL = '.hesabno-fullpage-layer, .hesabno-account-picker-overlay, .hesabno-fullscreen-picker-overlay, .hesabno-fullscreen-selector-overlay, .hesabno-account-statement-panel:not([data-hesabno-report-account-detail="true"]), div.fixed.inset-0.bg-stone-900';
  var GHOST_FULL = 'hesabno-fullpage-ghost';
  var GHOST_SMALL = 'hesabno-overlay-ghost';
  var GHOST_TOAST = 'hesabno-toast-ghost';
  var DURATION = 150;
  var TOAST_DURATION = 120;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // کلاس‌هایی که انیمیشن ورود را اجرا می‌کنند؛ از کپی حذف می‌شوند
  var MOTION_TOKEN = /motion|animate-in|fade-in|slide-in|zoom-in|animate-/;

  function isGhost(node) {
    return !!(node.classList && (node.classList.contains(GHOST_FULL) || node.classList.contains(GHOST_SMALL) || node.classList.contains(GHOST_TOAST)));
  }

  // اعلان کوتاه بالای صفحه (toast): همان کلاس‌های تولید در صفحه گزارش‌ها
  function isToast(node) {
    return !!(node.classList && node.classList.contains('fixed') && node.classList.contains('top-4') &&
      node.classList.contains('left-1/2') && node.classList.contains('z-50') && node.classList.contains('animate-in') &&
      !node.classList.contains('hesabno-toast-ghost'));
  }

  function isSmallOverlay(node) {
    return !!(node.classList && node.classList.contains('fixed') && node.classList.contains('inset-0') &&
      node.classList.contains('hesabno-overlay-motion') && !node.classList.contains('hesabno-fullpage-layer'));
  }

  function collect(node) {
    var out = [];
    if (node.nodeType !== 1 || isGhost(node)) return out;
    if (isToast(node)) return [{ el: node, kind: 'toast' }];
    // React portals remove overlays as their own nodes. Do not search every removed
    // subtree: a transaction form can contain hundreds of controls and report rows.
    if (node.matches && node.matches(FULL)) out.push({ el: node, kind: 'full' });
    else if (isSmallOverlay(node)) out.push({ el: node, kind: 'small' });
    return out;
  }

  function stripMotion(root) {
    var all = [root].concat(Array.prototype.slice.call(root.querySelectorAll('*')));
    all.forEach(function (el) {
      if (!el.classList) return;
      Array.prototype.slice.call(el.classList).forEach(function (cls) {
        if (MOTION_TOKEN.test(cls)) el.classList.remove(cls);
      });
    });
  }

  function exitItem(item) {
    if (reduced || !document.body) return;
    // Keep only the painted overlay shell; cloning a report/table subtree on close
    // can create a large synchronous DOM and paint cost on mid-range devices.
    var ghost = item.el.cloneNode(false);
    if (item.kind === 'toast') ghost.classList.remove('animate-in', 'fade-in');
    else ghost.classList.remove('hesabno-fullpage-layer', 'fixed', 'inset-0');
    ghost.classList.add(item.kind === 'full' ? GHOST_FULL : item.kind === 'toast' ? GHOST_TOAST : GHOST_SMALL);
    ghost.setAttribute('aria-hidden', 'true');
    ghost.removeAttribute('id');
    stripMotion(ghost);
    document.body.appendChild(ghost);
    window.setTimeout(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, (item.kind === 'toast' ? TOAST_DURATION : DURATION) + 30);
  }

  window.__hesabnoDom.watch(document.body || document.documentElement, { childList: true, subtree: true }, function (records) {
    records.forEach(function (record) {
      Array.prototype.forEach.call(record.removedNodes, function (node) {
        if (node.isConnected) return; // فقط حذف واقعی، نه جابه‌جایی
        collect(node).forEach(exitItem);
      });
    });
  });
})();
