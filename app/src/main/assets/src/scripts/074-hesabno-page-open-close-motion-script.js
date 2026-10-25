(function () {
  var root = document.getElementById("root");
  if (!root) return;

  var skipNextOpen = false;
  var replayingBack = false;
  var pendingDirection = "";
  var lastFormKey = null;
  var backSequence = 0;
  var normalize = function (value) { return (value || "").replace(/\s+/g, " ").trim(); };
  var MOTION_MS = 280;
  var ENTER_CLASSES = [
    "hesabno-form-transition-enter-forward",
    "hesabno-form-transition-enter-back",
    "hesabno-form-transition-enter-confirm"
  ];
  var EXIT_CLASSES = ["hesabno-form-transition-exit-back"];
  var BACK_BUTTON_SELECTOR = 'button[aria-label="بازگشت"], button[aria-label="بستن"], button[title="بازگشت"]';

  function formKey(main) {
    if (!main) return "";
    var form = main.querySelector("form");
    if (!form) return "";
    var heading = main.querySelector("h1, h2, h3");
    return "form:" + normalize(heading && heading.textContent);
  }

  function motionAllowed() {
    try {
      return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (error) {
      return true;
    }
  }

  function clearLegacyPageMotion(main) {
    ["hesabno-page-enter", "hesabno-page-open-up", "hesabno-tab-horizontal-in", "hesabno-content-swap", "hesabno-page-exit-down"].forEach(function (name) {
      main.classList.remove(name);
    });
  }

  function animateEntry(main, direction) {
    if (!main || !motionAllowed()) return;
    var className = direction === "confirm"
      ? "hesabno-form-transition-enter-confirm"
      : direction === "back"
        ? "hesabno-form-transition-enter-back"
        : "hesabno-form-transition-enter-forward";
    clearLegacyPageMotion(main);
    ENTER_CLASSES.forEach(function (name) { main.classList.remove(name); });
    void main.offsetWidth;
    main.classList.add(className);
    window.setTimeout(function () { main.classList.remove(className); }, MOTION_MS + 100);
  }

  function markPageOpen() {
    var main = root.querySelector("main");
    if (!main) return;

    var nextFormKey = formKey(main);
    if (lastFormKey === null) {
      lastFormKey = nextFormKey;
      if (nextFormKey) clearLegacyPageMotion(main);
      return;
    }

    if (nextFormKey !== lastFormKey) {
      var direction = pendingDirection || (nextFormKey ? "forward" : "back");
      lastFormKey = nextFormKey;
      pendingDirection = "";
      animateEntry(main, direction);
      if (nextFormKey || direction === "back" || direction === "confirm") return;
    }

    /* فرم‌ها انیمیشن افقی اختصاصی دارند؛ کلاس‌های عمودیِ قدیمی عمداً رویشان نمی‌آیند. */
    if (nextFormKey) {
      clearLegacyPageMotion(main);
      return;
    }

    if (!main.querySelector('button[aria-label="بازگشت"]')) {
      main.classList.remove("hesabno-page-exit-down", "hesabno-page-open-up");
      delete main.dataset.hesabnoPageMotion;
      return;
    }

    if (Date.now() < Number(window.__hesabnoSuppressMotionUntil || 0)) {
      main.classList.remove("hesabno-page-enter", "hesabno-page-open-up", "hesabno-tab-horizontal-in", "hesabno-content-swap");
      main.dataset.hesabnoPageMotion = "open";
      return;
    }
    if (skipNextOpen) {
      skipNextOpen = false;
      main.dataset.hesabnoPageMotion = "open";
      main.classList.remove("hesabno-page-enter", "hesabno-page-open-up", "hesabno-content-swap");
      main.classList.add("hesabno-tab-horizontal-in");
      return;
    }
    if (main.dataset.hesabnoPageMotion === "open") return;
    main.dataset.hesabnoPageMotion = "open";
    main.classList.remove("hesabno-page-enter", "hesabno-content-swap");
    main.classList.add("hesabno-page-open-up");
  }

  function replayBack(button, main, sequence) {
    if (sequence !== backSequence) return;
    main.classList.remove("hesabno-form-transition-exit-back");
    delete main.dataset.hesabnoFormMotionExiting;
    replayingBack = true;
    try { button.click(); } catch (error) {}
    replayingBack = false;
    window.setTimeout(function () {
      if (pendingDirection === "back") pendingDirection = "";
    }, 1200);
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (target && target.nodeType !== 1) target = target.parentElement;
    var button = target && target.closest ? target.closest(BACK_BUTTON_SELECTOR) : null;
    if (!button || replayingBack) return;
    if (button.closest(".hesabno-account-picker-overlay, .hesabno-fullscreen-selector-overlay")) return;

    var main = button.closest("main");
    if (!formKey(main)) return;
    if (button.closest('.fixed.inset-0, [role="dialog"], [aria-modal="true"]')) return;
    var pageHeader = main.querySelector("header");
    if (!pageHeader || !pageHeader.contains(button)) return;

    pendingDirection = "back";
    if (!motionAllowed()) return;
    if (main.dataset.hesabnoFormMotionExiting === "1") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    main.dataset.hesabnoFormMotionExiting = "1";
    EXIT_CLASSES.forEach(function (name) { main.classList.remove(name); });
    void main.offsetWidth;
    main.classList.add("hesabno-form-transition-exit-back");

    var sequence = ++backSequence;
    var completed = false;
    function finish() {
      if (completed) return;
      completed = true;
      main.removeEventListener("animationend", onAnimationEnd);
      replayBack(button, main, sequence);
    }
    function onAnimationEnd(animationEvent) {
      if (animationEvent.target === main) finish();
    }
    main.addEventListener("animationend", onAnimationEnd);
    window.setTimeout(finish, MOTION_MS + 80);
  }, true);

  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || form.tagName !== "FORM") return;
    var main = form.closest("main");
    if (!formKey(main)) return;

    /* جهت تأیید را فقط تا تغییر واقعی صفحه نگه می‌داریم؛ اعتبارسنجی ناموفق انیمیشن ندارد. */
    pendingDirection = "confirm";
    var submittedForm = form;
    window.setTimeout(function () {
      if (submittedForm.isConnected && pendingDirection === "confirm") pendingDirection = "";
    }, 0);
  }, true);

  window.__hesabnoDom.watch(root, { childList: true, subtree: true }, markPageOpen);
  document.addEventListener("click", function (event) {
    var button = event.target && event.target.closest ? event.target.closest("button") : null;
    if (!button || replayingBack) return;
    var parentClass = button.parentElement && String(button.parentElement.className);
    var segmentedTabs = parentClass && parentClass.indexOf("grid-cols-2") !== -1 && parentClass.indexOf("rounded-2xl") !== -1;
    var scrollableTabs = parentClass && parentClass.indexOf("overflow-x-auto") !== -1 && Array.from(button.parentElement.children).filter(function (child) { return child.tagName === "BUTTON"; }).length > 1;
    if (segmentedTabs || scrollableTabs) {
      var tabMain = button.closest("main");
      if (tabMain && (tabMain.classList.contains("hesabno-tab-shell") || scrollableTabs)) {
        tabMain.classList.remove("hesabno-tab-horizontal-in");
        void tabMain.offsetWidth;
        tabMain.classList.add("hesabno-tab-horizontal-in");
      }
      skipNextOpen = true;
      window.setTimeout(function () { skipNextOpen = false; }, 500);
    }
  }, true);

  markPageOpen();
})();
