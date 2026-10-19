/* Shared tab geometry fix.
   The previous implementation copied the dashboard header's measured height into
   non-dashboard content as padding-top. On pages where the global header is not
   rendered, that produced a large empty band above the page title.
   Each non-dashboard page already renders its own heading and top spacing, so do
   not synthesize a missing header with a fixed/dynamic spacer. Keep this observer
   only to remove any stale padding left by an earlier render/tab switch. */
(function () {
  function getShell() {
    var root = document.getElementById('root');
    if (!root || !root.firstElementChild) return null;
    var outer = root.firstElementChild;
    return outer && outer.firstElementChild;
  }

  function isContentDiv(el) {
    if (!el || el.tagName !== 'DIV') return false;
    var cls = typeof el.className === 'string' ? el.className : '';
    return cls.indexOf('grow') !== -1 && cls.indexOf('flex-col') !== -1;
  }

  function getContent(shell) {
    if (!shell || !shell.children) return null;
    for (var i = 0; i < shell.children.length; i++) {
      if (isContentDiv(shell.children[i])) return shell.children[i];
    }
    return null;
  }

  function apply() {
    var shell = getShell();
    var content = getContent(shell);
    if (!content) return;
    if (content.style.paddingTop) content.style.paddingTop = '';
    content.removeAttribute('data-hesabno-header-pad');
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    Promise.resolve().then(function () {
      queued = false;
      apply();
    });
  }

  if (document.body) {
    window.__hesabnoDom.watch(document.body, {
      childList: true,
      subtree: true
    }, schedule);
  }
  apply();

})();
