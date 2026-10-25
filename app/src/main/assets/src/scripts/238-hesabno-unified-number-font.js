(function () {
  "use strict";

  var digit = "0-9۰-۹٠-٩";
  var numberPattern = new RegExp("[+\\-−–]?[" + digit + "]+(?:[.,،٬٫/:\\-][" + digit + "]+)*", "g");
  var numericValuePattern = new RegExp("^\\s*[+\\-−–]?[" + digit + "]+(?:[.,،٬٫/:\\-][" + digit + "]+)*\\s*$");
  var excludedSelector = "script,style,svg,textarea,[contenteditable='true'],[data-hesabno-raw-text='true']";

  var insideMono = function (element) {
    return !!(element && element.closest && element.closest(".font-mono,[data-hesabno-unified-number-font='true']," + excludedSelector));
  };

  var wrapTextNode = function (node) {
    if (!node || node.nodeType !== 3 || !node.parentNode) return;
    var parent = node.parentElement;
    var value = node.nodeValue || "";
    if (!parent || !/[0-9۰-۹٠-٩]/.test(value) || insideMono(parent)) return;

    numberPattern.lastIndex = 0;
    var matches = Array.from(value.matchAll(numberPattern));
    if (!matches.length) return;

    var fragment = document.createDocumentFragment();
    var cursor = 0;
    matches.forEach(function (match) {
      if (match.index > cursor) fragment.appendChild(document.createTextNode(value.slice(cursor, match.index)));
      var number = document.createElement("span");
      number.className = "font-mono";
      number.setAttribute("dir", "ltr");
      number.setAttribute("data-hesabno-unified-number-font", "true");
      number.textContent = match[0];
      fragment.appendChild(number);
      cursor = match.index + match[0].length;
    });
    if (cursor < value.length) fragment.appendChild(document.createTextNode(value.slice(cursor)));
    parent.replaceChild(fragment, node);
  };

  var styleNumericInput = function (element) {
    if (!element || !element.matches || !element.matches("input,textarea")) return;
    if (element.matches("[type='password'],[type='hidden'],[type='checkbox'],[type='radio'],[type='range']")) return;
    var value = String(element.value || "");
    if (!value.trim()) value = String(element.getAttribute("placeholder") || "");
    if (numericValuePattern.test(value)) {
      if (!element.classList.contains("font-mono")) {
        element.classList.add("font-mono");
        element.setAttribute("data-hesabno-unified-input-font", "true");
      }
    } else if (element.getAttribute("data-hesabno-unified-input-font") === "true") {
      element.classList.remove("font-mono");
      element.removeAttribute("data-hesabno-unified-input-font");
    }
  };

  var scan = function (root) {
    if (!root) return;
    if (root.nodeType === 3) {
      wrapTextNode(root);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) {
      styleNumericInput(root);
      if (insideMono(root)) return;
    }

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var textNodes = [];
    var textNode;
    while ((textNode = walker.nextNode())) textNodes.push(textNode);
    textNodes.forEach(wrapTextNode);

    if (root.querySelectorAll) root.querySelectorAll("input,textarea").forEach(styleNumericInput);
  };

  var pendingNodes = new Set();
  var flushQueued = false;
  var flushPending = function () {
    flushQueued = false;
    var nodes = Array.from(pendingNodes);
    pendingNodes.clear();
    var nodeSet = new Set(nodes);
    var roots = nodes.filter(function (node) {
      var ancestor = node.parentNode;
      while (ancestor) {
        if (nodeSet.has(ancestor)) return false;
        ancestor = ancestor.parentNode;
      }
      return true;
    });
    roots.forEach(scan);
  };
  var syncRecords = function (records) {
    records.forEach(function (record) {
      if (record.type === "characterData") pendingNodes.add(record.target);
      else record.addedNodes.forEach(function (node) { pendingNodes.add(node); });
    });
    if (!flushQueued && pendingNodes.size) {
      flushQueued = true;
      if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(flushPending);
      else window.setTimeout(flushPending, 16);
    }
  };

  if (!document.body) return;
  scan(document.body);
  if (window.__hesabnoDom && typeof window.__hesabnoDom.watch === "function") {
    window.__hesabnoDom.watch(document.body, { childList: true, characterData: true, subtree: true }, syncRecords);
  } else {
    var observer = new MutationObserver(syncRecords);
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }
  document.addEventListener("input", function (event) { styleNumericInput(event.target); }, true);
  document.addEventListener("change", function (event) { styleNumericInput(event.target); }, true);
})();
