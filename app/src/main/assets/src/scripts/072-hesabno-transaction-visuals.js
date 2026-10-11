(function () {
  function dismiss(toast) {
    if (!toast || toast.dataset.hesabnoDismissed) return;
    toast.dataset.hesabnoDismissed = 'true';
    toast.classList.add('hesabno-toast-dismissing');
    setTimeout(function () { toast.style.display = 'none'; }, 180);
  }
  function bindToasts() {
    document.querySelectorAll('.hesabno-toast-motion').forEach(function (toast) {
      if (toast.dataset.hesabnoDismissBound) return;
      toast.dataset.hesabnoDismissBound = 'true';
      var startY = 0;
      toast.addEventListener('pointerdown', function (event) { startY = event.clientY; }, { passive: true });
      toast.addEventListener('pointerup', function (event) {
        if (event.pointerType === 'mouse' || startY - event.clientY > 12) dismiss(toast);
      }, { passive: true });
    });
  }
  bindToasts();
  if (document.body) new MutationObserver(bindToasts).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
})();
