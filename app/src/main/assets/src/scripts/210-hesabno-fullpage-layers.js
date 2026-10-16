(function () {
  // Turns large selection/form overlays into full-page layers.
  // Small confirmation dialogs (short panels) keep their centred look.
  function isLarge(overlay) {
    var panel = overlay.firstElementChild;
    if (!panel) return false;
    var rect = panel.getBoundingClientRect();
    if (rect.height >= window.innerHeight * 0.55) return true;
    // Inspect only the inner panel. The overlay itself may already be a full-screen
    // page (for example, the account statement has h-full and a header as its first child).
    // Including overlay.className here incorrectly promotes that page to a panel overlay.
    var cls = String(panel.className || '');
    return /h-\[9[0-9]vh\]|h-\[8[0-9]vh\]|h-full|h-screen|min-h-screen/.test(cls);
  }
  function apply() {
    document.querySelectorAll('div.fixed.inset-0').forEach(function (overlay) {
      if (overlay.classList.contains('hesabno-fullpage-layer')) return;
      if (overlay.closest('nav')) return;
      if (isLarge(overlay)) overlay.classList.add('hesabno-fullpage-layer');
    });
  }
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; apply(); });
  }
  apply();
  [120, 400, 900].forEach(function (d) { setTimeout(apply, d); });
  if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
  document.addEventListener('click', function () { setTimeout(apply, 60); setTimeout(apply, 300); }, true);
})();
