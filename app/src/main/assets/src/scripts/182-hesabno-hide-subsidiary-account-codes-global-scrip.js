(function () {
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var asciiDigits = function (value) {
      return String(value == null ? "" : value).replace(/[۰-۹٠-٩]/g, function (digit) {
        var index = "۰۱۲۳۴۵۶۷۸۹".indexOf(digit);
        return String(index < 0 ? "٠١٢٣٤٥٦٧٨٩".indexOf(digit) : index);
      });
    };
    var readAccounts = function () {
      var read = function (key) {
        try {
          var raw = window.__safeGet ? window.__safeGet(key) : localStorage.getItem(key);
          var value = JSON.parse(raw || "null");
          return Array.isArray(value) ? value : [];
        } catch (error) { return []; }
      };
      var accounts = read("hesabno:accounts_v5");
      return accounts.length ? accounts : read("hesabno:accounts");
    };
    var accountNameNearby = function (node, account) {
      var name = asciiDigits(clean(account && account.name));
      var code = asciiDigits(clean(account && account.code));
      if (!name || !code) return false;
      var current = node.parentElement;
      for (var depth = 0; current && depth < 3; depth += 1, current = current.parentElement) {
        var text = asciiDigits(clean(current.textContent));
        if (text.length > 320 || text.indexOf(name) === -1 || text.indexOf(code) === -1) continue;
        var remainder = text.replace(name, "").replace(code, "").replace(/[\p{P}\p{S}\p{Z}\p{N}]+/gu, "");
        if (!remainder) return true;
      }
      return false;
    };
    var isCodeDisplay = function (node, accountsByCode) {
      var text = asciiDigits(clean(node.textContent));
      var label = /^(?:کد(?:ینگ(?:\s*سرفصل)?|\s*تفصیلی)?)\s*[:：]?\s*/;
      var hasLabel = label.test(text);
      var value = text.replace(label, "").trim();
      var exact = value.match(/^[\(（]?\s*(\d+)\s*[\)）]?$/);
      if (exact && accountsByCode.has(exact[1])) {
        var wrapped = /^[\(（]\s*\d+\s*[\)）]$/.test(value);
        if (hasLabel || wrapped || node.tagName === "OPTION" || accountNameNearby(node, accountsByCode.get(exact[1]))) return true;
      }
      if (hasLabel) {
        var labeled = value.match(/^\(?\s*(\d+)\s*\)?(?:\s*[•·,|].*)?$/);
        if (labeled && accountsByCode.has(labeled[1])) return true;
      }
      var parenthetical = text.match(/^[\(（]\s*(\d+)\s*[\)）](?:\s*[•·,|].*)?$/);
      return !!(parenthetical && accountsByCode.has(parenthetical[1]));
    };
    /* نشانِ کد کنار نام حساب (بدون برچسب «کد») — مثل سرصفحهٔ صورت‌حساب یا ردیف تراز.
       فقط وقتی کد است که: قالب مونو داشته باشد و نام همان حساب دقیقاً کنارش رندر شده باشد.
       مبلغ‌ها معمولاً در بلوک جدا و با واحد پول/برچسب می‌آیند و این شرط را رد نمی‌کنند. */
    var isAccountCodeBadge = function (node, accountsByCode) {
      if (node.tagName === "OPTION") return false;
      var className = String(node.className || "");
      if (!/\bfont-mono\b/.test(className)) return false;
      /* ستون‌های عددیِ تراز/صورت‌حساب (مبلغ) با tabular-nums می‌آیند؛ کد نیستند */
      if (/\btabular-nums\b/.test(className)) return false;
      var text = asciiDigits(clean(node.textContent));
      var match = text.match(/^[\(（]?\s*(\d+)\s*[\)）]?$/) || text.match(/^کد\s*[:：]?\s*(\d+)$/);
      var account = match && accountsByCode.get(match[1]);
      if (!account) return false;
      return accountNameNearby(node, account);
    };
    // نام‌های نرمال‌شده یک‌بار در هر به‌روزرسانی ساخته می‌شوند (کش موقت)
    var normNames = new Map();
    var allDigitCodes = false;
    var stripInlineAccountCode = function (node, accountsByCode) {
      if (!node.textContent) return false;
      var original = node.textContent;
      var text = asciiDigits(original);
      // اگر کد فقط رقم است و متن رقم ندارد، هیچ کدی پیدا نمی‌شود
      if (allDigitCodes && !/\d/.test(text)) return false;
      var found = null;
      accountsByCode.forEach(function (account, code) {
        if (found || !account || !account.name) return;
        var name = normNames.get(code) || '';
        var nameStart = name ? text.indexOf(name) : -1;
        var codeStart = text.indexOf(code);
        if (nameStart < 0 || codeStart < 0 || (codeStart >= nameStart && codeStart < nameStart + name.length)) return;
        var gap = codeStart < nameStart ? text.slice(codeStart + code.length, nameStart) : text.slice(nameStart + name.length, codeStart);
        if (/[\p{L}\p{N}]/u.test(gap)) return;
        var remainder = text.replace(name, "").replace(code, "").replace(/[\p{P}\p{S}\p{Z}\p{N}]+/gu, "");
        if (remainder) return;
        var before = text.charAt(codeStart - 1), after = text.charAt(codeStart + code.length);
        if (/\d/.test(before) || /\d/.test(after)) return;
        found = { code: code, start: codeStart };
      });
      if (!found) return false;
      var target = node, start = found.start;
      if (node.childElementCount && node.tagName !== "OPTION") {
        target = Array.from(node.childNodes).find(function (child) {
          if (child.nodeType !== 3) return false;
          var childText = asciiDigits(child.nodeValue), index = childText.indexOf(found.code);
          return index !== -1 && !/\d/.test(childText.charAt(index - 1)) && !/\d/.test(childText.charAt(index + found.code.length));
        });
        if (!target) return false;
        start = asciiDigits(target.nodeValue).indexOf(found.code);
      }
      var targetText = target.nodeType === 3 ? target.nodeValue : target.textContent;
      var end = start + found.code.length;
      var left = targetText.slice(0, start).replace(/[\s:：,،;；|·•\-–—]+$/u, "").replace(/[(（]\s*$/u, "");
      var right = targetText.slice(end).replace(/^[\s:：,،;；|·•\-–—]+/u, "").replace(/^[)）]/u, "");
      var cleaned = (left + right).replace(/\s+/g, " ").trim();
      if (!cleaned && target.nodeType !== 3) return false;
      if (cleaned === targetText.trim()) return false;
      if (target.nodeType === 3) target.nodeValue = cleaned;
      else {
        if (target.tagName === "OPTION" && !target.hasAttribute("value")) target.setAttribute("value", target.value);
        target.textContent = cleaned;
      }
      return true;
    };
    var replaceCodeOnlyOption = function (node, accountsByCode) {
      if (node.tagName !== "OPTION") return false;
      var exact = asciiDigits(clean(node.textContent)).match(/^[\(（]?\s*(\d+)\s*[\)）]?$/);
      var account = exact && accountsByCode.get(exact[1]);
      if (!account || !account.name) return false;
      var value = node.value;
      if (!node.hasAttribute("value")) node.setAttribute("value", value);
      node.textContent = account.name;
      delete node.dataset.hesabnoSubsidiaryAccountCode;
      return true;
    };
    var update = function () {
      var accountsByCode = new Map(), allByCode = new Map();
      readAccounts().filter(function (account) {
        return account && account.code != null && account.code !== "";
      }).forEach(function (account) {
        var code = asciiDigits(account.code).trim();
        if (!code) return;
        allByCode.set(code, account);
        if (account.parentId != null) accountsByCode.set(code, account);
      });
      Array.from(document.querySelectorAll('[data-hesabno-subsidiary-account-code="true"]')).forEach(function (node) {
        if (!isCodeDisplay(node, accountsByCode) && !isAccountCodeBadge(node, allByCode)) delete node.dataset.hesabnoSubsidiaryAccountCode;
      });
      if (!accountsByCode.size && !allByCode.size) return;
      normNames = new Map();
      allDigitCodes = true;
      accountsByCode.forEach(function (account, code) {
        if (account && account.name) normNames.set(code, asciiDigits(clean(account.name)));
        if (!/^\d+$/.test(code)) allDigitCodes = false;
      });
      Array.from(document.querySelectorAll("span, p, small, strong, em, td, th, option, div, li, label, a, button")).forEach(function (node) {
        if (replaceCodeOnlyOption(node, accountsByCode)) return;
        if (stripInlineAccountCode(node, accountsByCode)) return;
        if (node.dataset.hesabnoSubsidiaryAccountCode === "true") return;
        if (isCodeDisplay(node, accountsByCode) || isAccountCodeBadge(node, allByCode)) {
          node.dataset.hesabnoSubsidiaryAccountCode = "true";
        }
      });
    };
    var frame = 0;
    var schedule = function () {
      if (frame) return;
      frame = 1;
      Promise.resolve().then(function () { frame = 0; update(); });
    };
    update();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, characterData: true, subtree: true }, schedule);
  window.addEventListener("storage", function (event) {
    if (!event.key || event.key === "hesabno:accounts" || event.key === "hesabno:accounts_v5") schedule();
  });
})();
