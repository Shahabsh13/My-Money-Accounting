(function () {
    var logos = window.__HESABNO_OFFICIAL_BANK_LOGOS || {};
    var keys = Object.keys(logos).sort(function (a, b) { return b.length - a.length; });
    function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
    function bankKey(value) {
      var text = clean(value);
      for (var i = 0; i < keys.length; i += 1) if (text.indexOf(keys[i]) !== -1) return keys[i];
      return '';
    }
    function decorate() {
      document.querySelectorAll('button, [role="button"], .cursor-pointer').forEach(function (button) {
        if (button.innerText && button.innerText.length > 180) return;
        var key = bankKey(button.innerText);
        var existing = button.querySelector('.hesabno-bank-mark');
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
    setTimeout(decorate, 250);
    setTimeout(decorate, 900);
    setTimeout(decorate, 1800);
    document.addEventListener('click', function () {
      setTimeout(decorate, 0);
      setTimeout(decorate, 180);
    }, true);
  })();
