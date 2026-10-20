/* Lock the page beneath overlays, including nested scroll containers and Android touch chaining. */
(function () {
  'use strict';
  var selector = '[role="dialog"], [aria-modal="true"], [data-hn-dialog], [data-hesabno-dashboard-hero-modal], #hesabno-first-run, div.fixed.inset-0';
  var active = null, locked = [], lastY = null;
  var lockProps = ['overflow', 'overflow-x', 'overflow-y', 'overscroll-behavior', 'overscroll-behavior-x', 'overscroll-behavior-y'];
  function visible(el) {
    for (var p = el; p && p.nodeType === 1; p = p.parentElement) {
      var style = getComputedStyle(p);
      if (p.hidden || style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return el.isConnected;
  }
  function modal() {
    var best = null, bestZ = -Infinity;
    document.querySelectorAll(selector).forEach(function (el) {
      if (!visible(el)) return;
      var z = 0;
      for (var p = el; p; p = p.parentElement) {
        var value = parseInt(getComputedStyle(p).zIndex, 10);
        if (Number.isFinite(value)) z = Math.max(z, value);
      }
      if (z >= bestZ) { best = el; bestZ = z; }
    });
    return best;
  }
  function unlock() {
    locked.forEach(function (item) {
      lockProps.forEach(function (name) { item.el.style.removeProperty(name); });
      lockProps.forEach(function (name, index) {
        if (item.values[index]) item.el.style.setProperty(name, item.values[index], item.priorities[index]);
      });
      item.el.scrollTop = item.top;
      item.el.scrollLeft = item.left;
    });
    locked = [];
  }
  function sync() {
    var next = modal();
    if (next === active) return;
    unlock(); active = next; lastY = null;
    if (!active) return;
    // Do not reposition body: overflow locks preserve the current document and nested scroll offsets.
    document.querySelectorAll('html, body, body *').forEach(function (el) {
      if (el === active || active.contains(el)) return;
      var style = getComputedStyle(el);
      if (el !== document.documentElement && el !== document.body &&
          !(/auto|scroll|overlay/.test(style.overflowY + style.overflowX + style.overflow) &&
            (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth))) return;
      locked.push({el: el, top: el.scrollTop, left: el.scrollLeft,
        values: lockProps.map(function (p) { return el.style.getPropertyValue(p); }),
        priorities: lockProps.map(function (p) { return el.style.getPropertyPriority(p); })});
      el.style.setProperty('overflow', 'hidden', 'important');
      el.style.setProperty('overscroll-behavior', 'none', 'important');
    });
  }
  function canScroll(target, delta) {
    if (!active || !active.contains(target)) return false;
    for (var el = target.nodeType === 1 ? target : target.parentElement; el; el = el.parentElement) {
      var style = getComputedStyle(el);
      if (/auto|scroll|overlay/.test(style.overflowY + style.overflow) && el.scrollHeight > el.clientHeight) {
        if (delta < 0 && el.scrollTop > 0) return true;
        if (delta > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
      }
      if (el === active) break;
    }
    return false;
  }
  function block(event, delta) {
    sync();
    if (active && !canScroll(event.target, delta) && event.cancelable) event.preventDefault();
  }
  document.addEventListener('touchstart', function (e) { lastY = e.touches.length === 1 ? e.touches[0].clientY : null; }, {capture: true, passive: true});
  document.addEventListener('touchmove', function (e) {
    if (e.touches.length !== 1 || lastY === null) return;
    var y = e.touches[0].clientY, delta = lastY - y; lastY = y;
    block(e, delta);
  }, {capture: true, passive: false});
  document.addEventListener('wheel', function (e) { block(e, e.deltaY); }, {capture: true, passive: false});
  document.addEventListener('keydown', function (e) {
    if (!active || !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]') && active.contains(e.target)) return;
    block(e, ['ArrowUp', 'PageUp', 'Home'].includes(e.key) || (e.key === ' ' && e.shiftKey) ? -1 : 1);
  }, true);
  if (window.__hesabnoDom && typeof window.__hesabnoDom.watch === 'function') {
    var queued = false;
    window.__hesabnoDom.watch(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'style', 'open', 'aria-hidden']}, function (records) {
      var relevant = records.some(function (record) {
        if (record.type === 'attributes') {
          var target = record.target;
          return target === active || target.matches(selector) ||
            (active && target.contains(active)) || !!target.querySelector(selector);
        }
        return Array.prototype.some.call(record.addedNodes, isOverlayNode) ||
          Array.prototype.some.call(record.removedNodes, isOverlayNode);
      });
      function isOverlayNode(node) {
        return node.nodeType === 1 && (node === active || node.matches(selector) || !!node.querySelector(selector));
      }
      if (!relevant || queued) return;
      queued = true;
      Promise.resolve().then(function () { queued = false; sync(); });
    });
  }
  window.__hesabnoSyncModalScrollLock = sync;
  sync();
})();
