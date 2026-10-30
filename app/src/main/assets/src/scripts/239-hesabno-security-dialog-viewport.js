/* Keep the security-settings dialog tied to Android's visible viewport while the keyboard opens/closes. */
(function () {
  "use strict";

  var DIALOG_SELECTOR = '[data-hesabno-security-settings="true"]';
  var CARD_SELECTOR = '[data-hesabno-security-card="true"]';
  var pendingFrame = 0;

  function readViewport() {
    var viewport = window.visualViewport;
    var height = viewport && Number.isFinite(viewport.height)
      ? viewport.height
      : window.innerHeight || document.documentElement.clientHeight || 1;
    var top = viewport && Number.isFinite(viewport.offsetTop) ? viewport.offsetTop : 0;
    return { height: Math.max(1, Math.round(height)), top: Math.round(top) };
  }

  function syncDialogViewport() {
    pendingFrame = 0;
    var dialog = document.querySelector(DIALOG_SELECTOR);
    if (!dialog) return;

    var viewport = readViewport();
    dialog.style.setProperty("--hesabno-security-viewport-top", viewport.top + "px");
    dialog.style.setProperty("--hesabno-security-viewport-height", viewport.height + "px");

    var card = dialog.querySelector(CARD_SELECTOR);
    if (card) {
      card.style.setProperty(
        "--hesabno-security-card-max-height",
        Math.max(1, Math.min(600, Math.round(viewport.height * 0.8))) + "px"
      );
    }
  }

  function scheduleSync() {
    if (pendingFrame) return;
    var requestFrame = window.requestAnimationFrame || function (callback) {
      return window.setTimeout(callback, 16);
    };
    pendingFrame = requestFrame(syncDialogViewport);
  }

  function scheduleSettledSyncs() {
    scheduleSync();
    window.setTimeout(scheduleSync, 80);
    window.setTimeout(scheduleSync, 280);
  }

  window.addEventListener("resize", scheduleSync, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleSync, { passive: true });
    window.visualViewport.addEventListener("scroll", scheduleSync, { passive: true });
  }

  document.addEventListener("focusin", function (event) {
    if (event.target && event.target.id === "hesabno-security-pin-input") scheduleSettledSyncs();
  }, true);
  document.addEventListener("focusout", function (event) {
    if (event.target && event.target.id === "hesabno-security-pin-input") scheduleSettledSyncs();
  }, true);

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (target && target.closest && (target.closest("#setting-row-security") || target.closest(DIALOG_SELECTOR))) {
      scheduleSettledSyncs();
    }
  }, true);

  scheduleSync();
})();
