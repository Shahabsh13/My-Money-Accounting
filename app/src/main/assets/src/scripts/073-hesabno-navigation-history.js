(function () {
  var root = document.getElementById("root");
  if (!root) return;
  var stack = window.__hesabnoBackStack = window.__hesabnoBackStack || [];
  var last = "";
  var pending = "";
  var pendingTimer = 0;
  var navigatingBack = false;
  var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
  var labels = { home: "خانه", transactions: "تراکنش‌ها", reports: "گزارش‌ها", more: "بیشتر" };
  var current = function () {
    var nav = root.querySelector("nav.fixed");
    if (nav) {
      var active = Array.from(nav.querySelectorAll("button")).find(function (button) {
        return String(button.className || "").includes("text-emerald-400");
      });
      var activeLabel = clean(active && active.textContent);
      for (var key in labels) if (labels[key] === activeLabel) return key;
    }
    var main = root.querySelector("main");
    var back = main && main.querySelector('button[aria-label="بازگشت"], button[title="بازگشت"]');
    if (back) {
      var heading = main.querySelector("h1, h2");
      return "detail:" + clean(heading && heading.textContent);
    }
    return "home";
  };
  var sync = function () {
    var next = current();
    if (!next) return;
    if (navigatingBack) return;
    if (pending) {
      if (pending === next) {
        pending = "";
        window.clearTimeout(pendingTimer);
        var targetIndex = stack.lastIndexOf(next);
        if (targetIndex >= 0) stack.length = targetIndex;
        last = next;
      }
      return;
    }
    if (last && last !== next) {
      stack.push(last);
      if (stack.length > 20) stack.shift();
    }
    last = next;
  };
  var finishBackNavigation = function (fallback) {
    navigatingBack = false;
    pending = "";
    var actual = current() || fallback;
    var targetIndex = stack.lastIndexOf(actual);
    if (targetIndex >= 0) stack.length = targetIndex;
    last = actual || last;
  };
  var holdBackNavigation = function (fallback) {
    navigatingBack = true;
    pending = fallback || "";
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(function () { finishBackNavigation(fallback); }, 1200);
  };
  window.__hesabnoHoldBackNavigation = function () {
    holdBackNavigation("");
    return true;
  };
  window.__hesabnoNavigateBack = function () {
    var target = stack[stack.length - 1];
    var label = labels[target];
    if (!target || !label) return false;
    var nav = root.querySelector("nav.fixed");
    var button = nav && Array.from(nav.querySelectorAll("button")).find(function (item) { return clean(item.textContent) === label; });
    if (!button) return false;
    holdBackNavigation(target);
    stack.pop();
    pending = target;
    button.click();
    return true;
  };
  sync();
  if (document.body) new MutationObserver(function () { window.requestAnimationFrame(sync); }).observe(document.body, { childList: true, subtree: true });
})();
