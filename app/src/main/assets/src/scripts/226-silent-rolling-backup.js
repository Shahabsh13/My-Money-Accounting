/* One silent rolling snapshot per minute while the app is visible. Not a background service. */
(function () {
  'use strict';
  if (!window.HnBridge || typeof window.HnBridge.saveRollingBackup !== 'function') return;
  var timer = 0;
  function tick() {
    if (document.visibilityState === 'hidden') return;
    try {
      if (typeof window.__hesabnoFlushAutoBackup === 'function') window.__hesabnoFlushAutoBackup('rolling');
    } catch (ignored) { /* No modal, toast, notification or retry loop. Retry at the next normal tick. */ }
  }
  function stop() { if (timer) window.clearInterval(timer); timer = 0; }
  function update() {
    stop();
    if (document.visibilityState !== 'hidden') timer = window.setInterval(tick, 60000);
  }
  document.addEventListener('visibilitychange', update);
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', update);
  update();
})();
