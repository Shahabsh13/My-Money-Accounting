(function () {
    var messages = {
      'میانبرهای سریع': ['میانبری تعریف نشده', 'برای ثبت سریع، یک میانبر جدید بسازید.'],
      'آخرین تراکنش‌ها': ['تراکنشی ثبت نشده', 'پس از ثبت تراکنش، آخرین موارد در اینجا نمایش داده می‌شوند.'],
      'تراکنش‌های دوره‌ای و سررسیدها': ['تراکنش دوره‌ای فعالی ثبت نشده', 'برای اجاره، حقوق یا پرداخت‌های زمان‌بندی‌شده یک مورد بسازید.'],
      'حساب‌های بانکی': ['حساب بانکی فعالی ثبت نشده', 'برای نمایش مانده، یک حساب بانکی اضافه کنید.'],
      'یادآوری چک‌های صیادی': ['چکی برای نمایش وجود ندارد', 'چک‌های ثبت‌شده و سررسیدهای نزدیک اینجا نمایش داده می‌شوند.'],
      'کارت اقساط و وام‌های بانکی': ['وام یا قسط فعالی ثبت نشده', 'وام‌ها و اقساط ثبت‌شده اینجا نمایش داده می‌شوند.'],
      'پیامبانک هوشمند': ['پیامکی برای بررسی وجود ندارد', 'پیامک‌های بانکی جدید در این بخش نمایش داده می‌شوند.']
    };
    function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
    function addEmptyState() {
      document.querySelectorAll('section').forEach(function (section) {
        var heading = Array.from(section.querySelectorAll('h2')).find(function (node) { return messages[clean(node.textContent)]; });
        if (!heading || section.dataset.hesabnoEmptyHomeWidget) return;
        var body = section.lastElementChild;
        var content = body && body.firstElementChild ? body.firstElementChild : body;
        if (!content || content.children.length > 0 || clean(content.textContent)) return;
        var message = messages[clean(heading.textContent)];
        var empty = document.createElement('div');
        empty.className = 'w-full py-4 px-3 rounded-2xl bg-stone-900/40 border border-dashed border-stone-800 text-center text-stone-400 text-xs font-medium';
        empty.innerHTML = '<span>' + message[0] + '</span><p class="text-[10px] text-stone-500 mt-1">' + message[1] + '</p>';
        content.appendChild(empty);
        section.dataset.hesabnoEmptyHomeWidget = 'true';
      });
    }
    addEmptyState();
    if (document.body) new MutationObserver(addEmptyState).observe(document.body, { childList: true, subtree: true });
  })();
