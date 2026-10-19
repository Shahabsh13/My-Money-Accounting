(function () {
    var logos = window.__HESABNO_OFFICIAL_BANK_LOGOS || {};
    var keys = Object.keys(logos).sort(function (a, b) { return b.length - a.length; });
    function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
    function bankKey(value) {
      var text = clean(value).replace(/[۰-۹0-9]+\s*(?:فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)(?:\s*[۰-۹0-9]+)?/g, ' ').replace(/\s+/g, ' ').trim();
      if (!text) return '';
      var i, key;
      for (i = 0; i < keys.length; i += 1) {
        key = keys[i];
        var prefixed = key.indexOf('بانک ') === 0 ? key : 'بانک ' + key;
        if (text.indexOf(prefixed) !== -1) return key;
      }
      for (i = 0; i < keys.length; i += 1) {
        key = keys[i];
        if (key === 'دی' || key === 'مهر' || key === 'شهر' || key === 'نور') {
          if (text === key) return key;
          continue;
        }
        if (text.indexOf(key) !== -1) return key;
      }
      return '';
    }
    function decorate() {
      document.querySelectorAll('button, [role="button"], .cursor-pointer').forEach(function (button) {
        if (button.closest('.hesabno-report-transaction-row, .hesabno-report-transaction-card, [data-hesabno-report-bank-wrap], article[id^="tx-card-"]')) return;
        var label = button.innerText || button.textContent || '';
        if (label.length > 180) return;
        var key = bankKey(label);
        var existing = button.querySelector('.hesabno-bank-mark[data-hesabno-selected-bank-mark="true"]');
        if (existing) {
          // اگر متن دکمه تغییر کرده (مثلاً بانک دیگری انتخاب شده)، لوگو هم باید عوض شود
          if (!key) { existing.remove(); return; }
          if (existing.dataset.hesabnoBankLogo !== key) {
            existing.dataset.hesabnoBankLogo = key;
            var img = existing.querySelector('img');
            if (img) { img.src = logos[key]; img.alt = 'لوگوی ' + key; }
          }
          return;
        }
        if (!key) return;
        var icon = Array.from(button.querySelectorAll('span')).find(function (node) {
          return clean(node.textContent) === '🏦' && node.childElementCount === 0;
        });
        if (!icon) return;
        var mark = document.createElement('span');
        mark.className = 'hesabno-bank-mark';
        mark.dataset.hesabnoBankLogo = key;
        mark.dataset.hesabnoSelectedBankMark = 'true';
        mark.style.width = '28px';
        mark.style.height = '28px';
        mark.style.marginInlineEnd = '0';
        var image = document.createElement('img');
        image.alt = 'لوگوی ' + key;
        image.loading = 'lazy';
        image.src = logos[key];
        mark.appendChild(image);
        icon.textContent = '';
        icon.appendChild(mark);
      });
    }
    decorate();
    /* همان observer مشترک به‌جای تایمرهای ۲۵۰/۹۰۰/۱۸۰۰ms: هر محتوای تازه در همان تسک
       تزئین می‌شود و دیگر هیچ نوشتنی بعد از نمایش صفحه رخ نمی‌دهد. */
    var queued = false;
    var schedule = function () {
      if (queued) return;
      queued = true;
      Promise.resolve().then(function () { queued = false; decorate(); });
    };
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
  })();
