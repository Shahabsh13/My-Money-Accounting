/* Lightweight overlay annotations only. Full-page entry effects and broad DOM scans
   are intentionally avoided so route changes stay immediate on slower devices. */
(function () {
  var marked = new WeakSet();
  var FIXED_SELECTOR = '[class*="fixed"]';

  function addClass(node, name) {
    if (node && node.classList && !node.classList.contains(name)) node.classList.add(name);
  }

  function annotateLayer(element) {
    if (!element || element.tagName === 'NAV' || marked.has(element)) return;
    marked.add(element);
    var classes = typeof element.className === 'string' ? element.className : '';
    if (classes.indexOf('z-50') !== -1 && classes.indexOf('top-') !== -1) {
      addClass(element, 'hesabno-toast-motion');
      return;
    }
    if (classes.indexOf('inset-0') === -1 && classes.indexOf('z-40') === -1) return;
    addClass(element, 'hesabno-overlay-motion');
    var dialog = element.getAttribute('role') === 'dialog' ? element : element.firstElementChild;
    if (dialog && dialog.getAttribute('role') !== 'dialog' &&
        !(dialog.tagName === 'DIV' && typeof dialog.className === 'string' && dialog.className.indexOf('rounded') !== -1)) {
      dialog = null;
    }
    addClass(dialog, 'hesabno-dialog-motion');
  }

  function annotateAdded(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.matches && node.matches(FIXED_SELECTOR)) annotateLayer(node);
    // Inspect only a small, shallow addition; never walk a newly mounted page/form subtree.
    var queue = [], children = node.children || [];
    for (var i = 0; i < children.length && i < 8; i += 1) queue.push({ node: children[i], depth: 1 });
    var visited = 0;
    while (queue.length && visited < 24) {
      var item = queue.shift(), child = item.node;
      visited += 1;
      if (child.matches && child.matches(FIXED_SELECTOR)) annotateLayer(child);
      if (item.depth >= 2) continue;
      var nested = child.children || [];
      for (var j = 0; j < nested.length && j < 8 && visited + queue.length < 24; j += 1) {
        queue.push({ node: nested[j], depth: item.depth + 1 });
      }
    }
  }

  function process(records) {
    if (!records || typeof records.forEach !== 'function') return;
    records.forEach(function (record) {
      Array.prototype.forEach.call(record.addedNodes, annotateAdded);
    });
  }

  // A one-time pass handles any overlay already present at startup; subsequent work is incremental.
  document.querySelectorAll(FIXED_SELECTOR).forEach(annotateLayer);
  var root = document.getElementById('root');
  var nav = root && root.querySelector('nav.fixed');
  if (nav) nav.querySelectorAll('button').forEach(function (button) { addClass(button, 'hesabno-tab-motion'); });

  if (document.body) {
    window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, process);
  }
})();
