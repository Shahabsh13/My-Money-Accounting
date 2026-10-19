(function () {
  // Removes helper hints from the bank-account form and keeps form submit footers
  // frozen on scroll and positioned above the phone's native keyboard (while staying
  // underneath the app's internal numeric keyboard #hesabno-amount-keyboard).
  var HINTS = ['داخل پرانتز بین نام بانک و شماره حساب', 'اجباری (۶ رقم آخر', 'اجباری (6 رقم آخر'];
  var FORM_TITLES = [
    'تعریف حساب بانکی جدید',
    'ویرایش اطلاعات بانک',
    'تعریف حساب جدید',
    'تعریف تفضیلی جدید',
    'ویرایش حساب'
  ];
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function cleanHints() {
    document.querySelectorAll('span, p, small, div').forEach(function (node) {
      if (node.children.length > 0) return;
      var text = clean(node.textContent);
      for (var i = 0; i < HINTS.length; i += 1) {
        if (text.indexOf(HINTS[i]) !== -1) { node.remove(); return; }
      }
    });
  }
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    Promise.resolve().then(function () { queued = false; run(); });
  }
  function markBankForm() {
    document.querySelectorAll('h3').forEach(function (h) {
      var title = clean(h.textContent);
      if (FORM_TITLES.indexOf(title) === -1) return;
      var panel = h.closest('[class*="max-h-"]');
      if (panel && !panel.classList.contains('hesabno-bank-form-page')) {
        panel.classList.add('hesabno-bank-form-page');
      }
    });
  }
  function isInternalAmountKeyboardOpen() {
    var kb = document.getElementById('hesabno-amount-keyboard');
    if (kb && !kb.hidden && kb.getAttribute('aria-hidden') !== 'true') return true;
    var active = document.activeElement;
    if (active && active.getAttribute && active.getAttribute('data-hesabno-numkb-bound') === '1') return true;
    return false;
  }
  function isNativeTextEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute('data-hesabno-numkb-bound') === '1') return false;
    if (el.readOnly || el.disabled) return false;
    var tag = (el.tagName || '').toUpperCase();
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      var type = String(el.type || 'text').toLowerCase();
      return type !== 'button' && type !== 'submit' && type !== 'checkbox' && type !== 'radio' && type !== 'file' && type !== 'hidden' && type !== 'range';
    }
    return !!el.isContentEditable;
  }
  var nativeKbActive = false;
  function clearNativeKeyboardVars() {
    if (!nativeKbActive) return;
    nativeKbActive = false;
    var root = document.documentElement;
    if (!root) return;
    root.removeAttribute('data-hesabno-native-kb');
    root.style.removeProperty('--hesabno-vvh');
    root.style.removeProperty('--hesabno-vv-top');
    root.style.removeProperty('--hesabno-kb-offset');
  }
  function syncViewportForKeyboard() {
    var root = document.documentElement;
    if (!root) return;
    if (isInternalAmountKeyboardOpen()) {
      clearNativeKeyboardVars();
      return;
    }
    var vv = window.visualViewport;
    var active = document.activeElement;
    var editableFocused = isNativeTextEditable(active);
    var innerH = window.innerHeight || document.documentElement.clientHeight || 0;
    var vvH = vv && vv.height ? Math.round(vv.height) : innerH;
    var vvTop = vv && vv.offsetTop ? Math.max(0, Math.round(vv.offsetTop)) : 0;
    var kbOffset = Math.max(0, Math.round(innerH - vvH - vvTop));
    if (!editableFocused && kbOffset <= 80) {
      clearNativeKeyboardVars();
      return;
    }
    nativeKbActive = true;
    root.setAttribute('data-hesabno-native-kb', '1');
    root.style.setProperty('--hesabno-vvh', vvH + 'px');
    root.style.setProperty('--hesabno-vv-top', vvTop + 'px');
    root.style.setProperty('--hesabno-kb-offset', kbOffset + 'px');
    if (editableFocused && active && typeof active.scrollIntoView === 'function') {
      try { active.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    }
  }
  if (typeof window !== 'undefined') {
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncViewportForKeyboard, { passive: true });
      window.visualViewport.addEventListener('scroll', syncViewportForKeyboard, { passive: true });
    }
    window.addEventListener('resize', syncViewportForKeyboard, { passive: true });
    document.addEventListener('focusin', function () {
      setTimeout(syncViewportForKeyboard, 30);
    }, true);
    document.addEventListener('focusout', function () {
      setTimeout(syncViewportForKeyboard, 60);
    }, true);
    window.__hesabnoSyncViewportForKeyboard = syncViewportForKeyboard;
  }
  function run() { cleanHints(); markBankForm(); }
  run();
  if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
})();
