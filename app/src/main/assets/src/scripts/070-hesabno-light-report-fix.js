(function () {
  function markModeTabs() {
    var simple = Array.from(document.querySelectorAll('button')).find(function (button) {
      return button.textContent.trim() === 'ساده';
    });
    var advanced = Array.from(document.querySelectorAll('button')).find(function (button) {
      return button.textContent.trim() === 'پیشرفته';
    });
    if (simple && advanced && simple.parentElement === advanced.parentElement) {
      simple.parentElement.classList.add('hesabno-report-mode-tabs');
    }
  }
  markModeTabs();
  if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, markModeTabs);
})();
