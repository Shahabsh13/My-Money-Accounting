/* Automatically fit rendered numeric runs to the width available in their layout box. */
(function () {
  "use strict";

  var SELECTOR = '[data-hesabno-unified-number-font="true"]';
  var CANDIDATE_SELECTOR = SELECTOR + ', .font-mono';
  var DIGIT_PATTERN = /[0-9۰-۹٠-٩]/;
  var MIN_FONT_SIZE = 7;
  var FIT_ATTRIBUTE = "data-hesabno-auto-fit-base-size";
  var originalStyles = new WeakMap();
  var pending = new Set();
  var frame = 0;

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    var current = element;
    while (current && current.nodeType === 1) {
      var style = window.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") return false;
      current = current.parentElement;
    }
    return true;
  }

  function availableWidth(element) {
    var parent = element.parentElement;
    while (parent && parent !== document.documentElement) {
      var width = parent.clientWidth;
      if (width > 0) {
        var display = window.getComputedStyle(parent).display;
        if ((display === "flex" || display === "inline-flex" || display === "grid" || display === "inline-grid") && element.parentElement === parent) {
          var siblingsWidth = 0;
          var visibleChildren = 0;
          Array.prototype.forEach.call(parent.children, function (sibling) {
            if (sibling === element || !isVisible(sibling)) return;
            var rect = sibling.getBoundingClientRect();
            var siblingStyle = window.getComputedStyle(sibling);
            siblingsWidth += rect.width + (parseFloat(siblingStyle.marginLeft) || 0) + (parseFloat(siblingStyle.marginRight) || 0);
            visibleChildren += 1;
          });
          var parentStyle = window.getComputedStyle(parent);
          var gap = parseFloat(parentStyle.columnGap || parentStyle.gap) || 0;
          var padding = (parseFloat(parentStyle.paddingLeft) || 0) + (parseFloat(parentStyle.paddingRight) || 0);
          width = Math.max(0, width - siblingsWidth - gap * visibleChildren - padding);
        }
        return Math.max(0, width);
      }
      parent = parent.parentElement;
    }
    return 0;
  }

  function measureTextWidth(element) {
    var width = element.scrollWidth || 0;
    if (document.createRange) {
      var range = document.createRange();
      range.selectNodeContents(element);
      if (typeof range.getBoundingClientRect === "function") {
        var rect = range.getBoundingClientRect();
        if (rect && rect.width > width) width = rect.width;
      }
    }
    return width;
  }

  function restore(element) {
    var original = originalStyles.get(element);
    if (!original) return;
    element.style.fontSize = original.fontSize;
    element.style.maxWidth = original.maxWidth;
    element.style.minWidth = original.minWidth;
    element.style.whiteSpace = original.whiteSpace;
    element.style.overflow = original.overflow;
    element.removeAttribute(FIT_ATTRIBUTE);
    originalStyles.delete(element);
  }

  function isCandidate(element) {
    if (!element || !element.matches) return false;
    if (element.matches(SELECTOR)) return true;
    return element.classList.contains("font-mono")
      && !element.querySelector(".font-mono")
      && DIGIT_PATTERN.test(element.textContent || "");
  }

  function fit(element) {
    if (!isCandidate(element)) return;
    if (!isVisible(element)) return;

    var available = availableWidth(element);
    if (!available) return;

    var baseSize = parseFloat(element.getAttribute(FIT_ATTRIBUTE));
    if (!baseSize) {
      baseSize = parseFloat(window.getComputedStyle(element).fontSize) || 14;
      originalStyles.set(element, {
        fontSize: element.style.fontSize,
        maxWidth: element.style.maxWidth,
        minWidth: element.style.minWidth,
        whiteSpace: element.style.whiteSpace,
        overflow: element.style.overflow,
      });
      element.setAttribute(FIT_ATTRIBUTE, String(baseSize));
    }

    element.style.maxWidth = available + "px";
    element.style.minWidth = "0";
    element.style.whiteSpace = "nowrap";
    element.style.overflow = "hidden";

    var size = baseSize;
    element.style.fontSize = size + "px";
    var width = measureTextWidth(element);
    if (width <= available + 0.5) {
      restore(element);
      return;
    }

    /* Scale in one step first, then correct for rounding/font metrics. */
    size = Math.max(MIN_FONT_SIZE, baseSize * available / Math.max(width, 1) * 0.97);
    element.style.fontSize = size + "px";
    for (var attempts = 0; attempts < 10 && size > MIN_FONT_SIZE && measureTextWidth(element) > available + 0.5; attempts += 1) {
      size = Math.max(MIN_FONT_SIZE, size - 0.5);
      element.style.fontSize = size + "px";
    }
  }

  function collect(root) {
    if (!root) return;
    if (root.nodeType === 1 && isCandidate(root)) pending.add(root);
    if (root.querySelectorAll) {
      root.querySelectorAll(CANDIDATE_SELECTOR).forEach(function (element) {
        if (isCandidate(element)) pending.add(element);
      });
    }
  }

  function flush() {
    frame = 0;
    var elements = Array.from(pending);
    pending.clear();
    elements.forEach(fit);
  }

  function schedule(root) {
    collect(root);
    if (frame || !pending.size) return;
    var requestFrame = window.requestAnimationFrame || function (callback) { return window.setTimeout(callback, 16); };
    frame = requestFrame(flush);
  }

  function scanAll() {
    schedule(document.body);
  }

  if (!document.body) return;
  scanAll();

  function onMutations(records) {
    records.forEach(function (record) {
      if (record.type === "characterData") {
        if (record.target.parentElement) schedule(record.target.parentElement);
      } else {
        record.addedNodes.forEach(schedule);
      }
    });
  }

  if (window.__hesabnoDom && typeof window.__hesabnoDom.watch === "function") {
    window.__hesabnoDom.watch(document.body, { childList: true, characterData: true, subtree: true }, onMutations);
  }

  window.addEventListener("resize", scanAll, { passive: true });
  window.addEventListener("orientationchange", scanAll, { passive: true });
  document.addEventListener("click", scanAll, true);
  if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
    document.fonts.ready.then(scanAll).catch(function () {});
  }
})();
