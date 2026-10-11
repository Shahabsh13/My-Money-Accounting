(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var lockedStyle = "opacity:.62;cursor:not-allowed";
    var monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
    var selectedDate = function () {
      var node = document.querySelector("#tx-date-input");
      var text = clean(node && node.textContent);
      var match = text.match(/([۰-۹\d]+)\s+(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)\s+([۰-۹\d]+)/u);
      if (!match) return "";
      var day = numberFor(match[1]), year = numberFor(match[3]), month = monthNames.indexOf(match[2]) + 1;
      var faDigits = function (value) { return String(value).replace(/[0-9]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[Number(d)]; }); };
      return year && month && day ? faDigits(("0000" + year).slice(-4)) + "/" + faDigits(("0" + month).slice(-2)) + "/" + faDigits(("0" + day).slice(-2)) : "";
    };
    var numberFor = function (value) { return Number(String(value || "").replace(/[۰-۹]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(d); }).replace(/[٠-٩]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩".indexOf(d); }).replace(/[^0-9]/g, "")) || 0; };
    var amountValue = function (value) { return numberFor(value); };
    var read = function (key, fallback) {
      try { var raw = window.__safeGet ? window.__safeGet(key) : localStorage.getItem(key); var value = JSON.parse(raw || JSON.stringify(fallback)); return value == null ? fallback : value; }
      catch (error) { return fallback; }
    };
    var write = function (key, value) { var raw = JSON.stringify(value); if (window.__safeSet) window.__safeSet(key, raw); else localStorage.setItem(key, raw); };
    var readTransactions = function () { var value = read("hesabno:transactions", []); return Array.isArray(value) ? value : []; };
    var documentNumber = function (item) { return item && (item.documentNumber || item.id); };
    var findTransaction = function (id, items) { return items.find(function (item) { return String(item && item.id) === String(id); }); };
    var refundEntries = function (items, original) {
      var doc = String(documentNumber(original));
      return items.filter(function (item) { return item && item.isRefundReceipt && String(item.refundOfDocNumber || item.reversalOfDocNumber) === doc; });
    };
    var relatedCorrection = function (items, original) {
      var doc = String(documentNumber(original));
      return items.some(function (item) { return item && item.isReversal && !item.isRefundReceipt && String(item.reversalOfDocNumber) === doc; });
    };
    var refundedTotal = function (items, original) { return refundEntries(items, original).reduce(function (sum, item) { return sum + (Number(item.amount) || 0); }, 0); };
    var ensureIncomeAccount = function (accounts) {
      var existing = accounts.find(function (item) { return item && item.group === "income" && clean(item.name) === "برگشت وجه"; });
      if (existing) return { accounts: accounts, account: existing };
      var taken = Object.create(null), maxCode = 400;
      accounts.forEach(function (item) { if (!item || item.group !== "income") return; var code = numberFor(item.code); taken[String(item.code)] = true; if (item.parentId == null) maxCode = Math.max(maxCode, code); });
      var code = maxCode + 1;
      while (taken[String(code)]) code += 1;
      var account = { id: Date.now() + Math.floor(Math.random() * 1000), group: "income", code: String(code), name: "برگشت وجه", picture: "↩️", parentId: null, active: true, pinned: false, system: false };
      return { accounts: accounts.concat(account), account: account };
    };
    var nowDate = function () {
      try {
        var parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()), values = {};
        parts.forEach(function (part) { values[part.type] = part.value; });
        return values.year + "/" + values.month + "/" + values.day;
      } catch (error) { return ""; }
    };
    var nowTime = function () {
      try { return new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()).replace(/\u200e/g, ""); }
      catch (error) { return ""; }
    };
    var sync = function () {
      var main = document.querySelector("main");
      var heading = main && main.querySelector("header h1, header h2");
      if (!main || !heading || clean(heading.textContent) !== "ثبت سند اصلاحی") return;
      var form = main.querySelector("form");
      if (!form || !form.children.length) return;
      var formChildren = Array.from(form.children);
      var tabs = formChildren.find(function (node) {
        var buttons = node.querySelectorAll(":scope > button");
        return buttons.length === 2 && (node.hasAttribute("data-hesabno-payment-refund-tabs") || /مرکب/.test(clean(node.textContent)) || /اصلاح سند/.test(clean(node.textContent)) && /برگشت وجه/.test(clean(node.textContent)));
      });
      if (tabs) tabs.setAttribute("data-hesabno-payment-refund-tabs", "true");
      var dateControl = form.querySelector("#tx-date-input");
      var dateRow = formChildren.find(function (node) { return dateControl && node.contains(dateControl); });
      var methodRow = formChildren.find(function (node) { return /عادی/.test(clean(node.textContent)) && /چک صیادی/.test(clean(node.textContent)); });
      var noticeRow = formChildren.find(function (node) { return node !== tabs && /این سند به عنوان سند اصلاحی/.test(clean(node.textContent)); });
      var tabButtons = tabs && tabs.querySelectorAll("button");
      if (!tabButtons || tabButtons.length < 2) return;
      var correctionTab = tabButtons[0], refundTab = tabButtons[1];
      if (!tabs.hasAttribute("data-hesabno-payment-refund-tab-classes")) {
        tabs.setAttribute("data-hesabno-payment-refund-tab-classes", "true");
        correctionTab.setAttribute("data-hesabno-native-active-class", correctionTab.className);
        refundTab.setAttribute("data-hesabno-native-inactive-class", refundTab.className);
      }
      var correctionLabel = correctionTab.querySelector("span");
      var refundLabel = refundTab.querySelector("span");
      if (correctionLabel && correctionLabel.textContent !== "اصلاح سند") correctionLabel.textContent = "اصلاح سند";
      if (refundLabel && refundLabel.textContent !== "برگشت وجه") refundLabel.textContent = "برگشت وجه";
      if (form.dataset.hesabnoRefundTabsBound !== "true") {
        form.dataset.hesabnoRefundTabsBound = "true";
        [correctionTab, refundTab].forEach(function (button, index) {
          button.addEventListener("click", function (event) {
            event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
            window.__hesabnoPaymentRefundNativeMode = index === 0 ? "correction" : "refund";
            sync();
          }, true);
        });
      }
      var panel = form.querySelector("[data-hesabno-native-refund-panel]");
      if (!panel) {
        panel = document.createElement("section");
        panel.setAttribute("data-hesabno-native-refund-panel", "true");
        panel.className = "rounded-2xl border border-stone-700/60 bg-stone-800/60 p-3.5 space-y-3";
        panel.innerHTML =
          "<p data-hesabno-native-refund-reference class=\"text-[11px] text-stone-400\"></p>" +
          "<label class=\"block space-y-1.5\"><span class=\"text-xs font-bold text-stone-300\">مبلغ برگشتی</span><input data-hesabno-native-refund-amount type=\"text\" inputmode=\"numeric\" autocomplete=\"off\" placeholder=\"مبلغ برگشتی را وارد کنید\" class=\"w-full rounded-xl border border-stone-600 bg-stone-950 p-3 text-lg font-black text-stone-100 outline-none focus:border-emerald-400\"></label>" +
          "<div class=\"flex items-center justify-between gap-3 px-1 text-xs\"><span class=\"text-stone-400\">مانده قابل برگشت</span><b data-hesabno-native-refund-remaining class=\"text-stone-200\"></b></div>" +
          "<div data-hesabno-native-refund-route-holder></div>" +
          "<label class=\"block space-y-1.5\"><span class=\"block text-xs text-stone-400 mb-1.5 font-medium\">شرح / توضیحات</span><textarea data-hesabno-native-refund-description rows=2 placeholder=\"توضیحاتی درباره این پرداخت یا دریافت بنویسید...\" class=\"w-full rounded-xl border border-stone-700 bg-stone-900 p-3 text-sm text-stone-300 resize-none\"></textarea></label>" +
          "<p data-hesabno-native-refund-error class=\"hidden text-xs text-rose-300\" role=\"alert\"></p><button type=\"button\" data-hesabno-native-refund-save class=\"w-full rounded-xl bg-emerald-500 p-3 text-sm font-black text-stone-950\">ثبت برگشت وجه</button>";
        form.insertBefore(panel, methodRow || form.children[formChildren.indexOf(dateRow) + 1] || null);
      }
      var originalId = String(window.__hesabnoPaymentRefundOriginalId || "");
      var items = readTransactions();
      var original = findTransaction(originalId, items);
      if (!original) {
        var reversalMatch = clean(main.textContent).match(/عطف به سند\s*#\s*([۰-۹\d]+)/u);
        var originalNumber = reversalMatch && numberFor(reversalMatch[1]);
        original = items.find(function (item) { return item && numberFor(documentNumber(item)) === originalNumber; });
        if (original) originalId = String(original.id);
      }
      if (!original) return;
      window.__hesabnoPaymentRefundOriginalId = originalId;
      var routeHolder = panel.querySelector("[data-hesabno-native-refund-route-holder]");
      if (routeHolder && !routeHolder.firstElementChild) {
        var nativeRoute = Array.from(form.querySelectorAll("section")).find(function (section) {
          return !section.hasAttribute("data-hesabno-native-refund-route") && section.querySelector("#field-party") && section.querySelector("#field-wallet");
        });
        if (nativeRoute) {
          var routeClone = nativeRoute.cloneNode(true);
          routeClone.setAttribute("data-hesabno-native-refund-route", "true");
          routeClone.querySelectorAll("[id]").forEach(function (node) { node.removeAttribute("id"); });
          routeHolder.appendChild(routeClone);
        }
      }
      var routeClone = routeHolder && routeHolder.firstElementChild;
      if (routeClone) {
        var routeLabels = routeClone.querySelectorAll("label");
        if (routeLabels[0] && routeLabels[0].textContent !== "دریافت از:") routeLabels[0].textContent = "دریافت از:";
        if (routeLabels[1] && routeLabels[1].textContent !== "به حساب:") routeLabels[1].textContent = "به حساب:";
        var routeButtons = routeClone.querySelectorAll("button");
        var setReadonlyValue = function (button, value, icon, logoKey, logoUrl) {
          if (!button) return;
          if (button.getAttribute("data-hesabno-static-value") === value && button.getAttribute("data-hesabno-static-icon") === icon && button.getAttribute("data-hesabno-static-logo-key") === logoKey) {
            button.disabled = true;
            button.setAttribute("aria-disabled", "true");
            button.tabIndex = -1;
            return;
          }
          button.replaceChildren();
          if (logoUrl) {
            var mark = document.createElement("span");
            mark.className = "hesabno-bank-mark";
            mark.style.width = "24px";
            mark.style.height = "24px";
            var image = document.createElement("img");
            image.alt = value;
            image.loading = "lazy";
            image.src = logoUrl;
            mark.appendChild(image);
            button.appendChild(mark);
          } else if (icon) {
            var iconNode = document.createElement("span");
            iconNode.className = "text-lg flex-shrink-0";
            iconNode.textContent = icon;
            button.appendChild(iconNode);
          }
          var valueNode = document.createElement("span");
          valueNode.className = "grow font-bold text-xs text-stone-100 truncate";
          valueNode.textContent = value;
          button.appendChild(valueNode);
          button.disabled = true;
          button.setAttribute("aria-disabled", "true");
          button.tabIndex = -1;
          button.title = "این حساب در برگشت وجه ثابت است.";
          button.setAttribute("data-hesabno-static-value", value);
          button.setAttribute("data-hesabno-static-icon", icon);
          button.removeAttribute("data-hesabno-static-code");
          button.setAttribute("data-hesabno-static-logo-key", logoKey);
        };
        var accountList = read("hesabno:accounts_v5", []);
        var bank = Array.isArray(accountList) ? accountList.find(function (account) { return account && clean(account.name) === clean(original.account); }) : null;
        var logoMap = window.__HESABNO_OFFICIAL_BANK_LOGOS || {};
        var logoKeys = Object.keys(logoMap).sort(function (a, b) { return b.length - a.length; });
        var accountText = clean(original.account);
        var normalizeBankText = function (value) { return clean(value).replace(/[\s‌]+/g, "").toLowerCase(); };
        var normalizedAccount = normalizeBankText(accountText);
        var logoKey = logoKeys.find(function (key) { return normalizedAccount.indexOf(normalizeBankText(key)) !== -1; }) || "";
        if (!logoKey && bank) logoKey = logoKeys.find(function (key) { return normalizeBankText(bank.name).indexOf(normalizeBankText(key)) !== -1; }) || "";
        var logoUrl = logoKey ? logoMap[logoKey] : "";
        setReadonlyValue(routeButtons[0], "برگشت وجه", "↩️", "", "");
        setReadonlyValue(routeButtons[1], accountText || "حساب پرداختی مشخص نشده", logoUrl ? "" : (bank && bank.picture ? String(bank.picture) : ""), logoKey, logoUrl);
      }
      var factor = clean(String(read("hesabno:currency", "rial")).replace(/^['"]|['"]$/g, "")) === "toman" ? 10 : 1;
      var remaining = Math.max(0, (Number(original.amount) || 0) - refundedTotal(items, original));
      var referenceText = "مرتبط با سند پرداختی #" + documentNumber(original);
      var remainingText = Math.round(remaining / factor).toLocaleString("fa-IR") + (factor === 10 ? " تومان" : " ریال");
      var referenceNode = panel.querySelector("[data-hesabno-native-refund-reference]");
      var remainingNode = panel.querySelector("[data-hesabno-native-refund-remaining]");
      if (referenceNode.textContent !== referenceText) referenceNode.textContent = referenceText;
      if (remainingNode.textContent !== remainingText) remainingNode.textContent = remainingText;
      var mode = window.__hesabnoPaymentRefundNativeMode || "correction";
      form.setAttribute("data-hesabno-native-refund-mode", mode);
      var children = Array.from(form.children);
      children.forEach(function (node) {
        if (node === tabs || node === dateRow || node === panel || node === noticeRow) return;
        if (mode === "refund") node.style.setProperty("display", "none", "important");
        else node.style.removeProperty("display");
      });
      panel.style.display = mode === "refund" ? "" : "none";
      var activeClass = correctionTab.getAttribute("data-hesabno-native-active-class") || correctionTab.className;
      var inactiveClass = refundTab.getAttribute("data-hesabno-native-inactive-class") || refundTab.className;
      correctionTab.className = mode === "correction" ? activeClass : inactiveClass;
      refundTab.className = mode === "refund" ? activeClass : inactiveClass;
      correctionTab.setAttribute("aria-pressed", String(mode === "correction"));
      refundTab.setAttribute("aria-pressed", String(mode === "refund"));
      if (mode === "correction") {
        form.querySelectorAll("input, textarea, select, button").forEach(function (control) {
          if (control === correctionTab || control === refundTab || control.closest("#tx-date-input") || control.closest("[data-hesabno-native-refund-panel]")) return;
          if (control.matches("button[type='submit']")) return;
          if (control.matches("input, textarea")) {
            if (control.type === "checkbox" || control.type === "radio" || control.type === "file") control.disabled = true;
            else control.readOnly = true;
          } else control.disabled = true;
          control.style.cssText += ";" + lockedStyle;
        });
      }
      var amountInput = panel.querySelector("[data-hesabno-native-refund-amount]");
      var error = panel.querySelector("[data-hesabno-native-refund-error]");
      var formatAmount = function (value) {
        var digits = String(value || "").replace(/[۰-۹]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(d); }).replace(/[٠-٩]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩".indexOf(d); }).replace(/[^0-9]/g, "");
        return digits ? Number(digits).toLocaleString("fa-IR") : "";
      };
      var showError = function (message) { error.textContent = message; error.classList.remove("hidden"); };
      panel.querySelector("[data-hesabno-native-refund-save]").onclick = function () {
        var all = readTransactions(), current = findTransaction(originalId, all);
        var value = amountValue(amountInput.value) * factor;
        var left = current ? Math.max(0, (Number(current.amount) || 0) - refundedTotal(all, current)) : 0;
        var accountName = clean(current && current.account);
        var description = clean(panel.querySelector("[data-hesabno-native-refund-description]").value);
        var problem = "";
        if (!current || current.type !== "expense" || current.method === "check") problem = "سند پرداختی اصلی پیدا نشد.";
        else if (!accountName) problem = "حساب پرداختی سند اصلی مشخص نیست.";
        else if (value <= 0) problem = "مبلغ برگشتی را وارد کنید.";
        else if (value > left) problem = "مبلغ از مانده قابل برگشت بیشتر است.";
        else if (relatedCorrection(all, current)) problem = "این سند قبلاً با سند اصلاحی بسته شده است.";
        if (problem) { showError(problem); return; }
        var accounts = read("hesabno:accounts_v5", []), ensured = ensureIncomeAccount(Array.isArray(accounts) ? accounts : []);
        var incomeAccount = ensured.account, relatedDoc = documentNumber(current);
        var nextDoc = all.reduce(function (max, item) { return Math.max(max, numberFor(documentNumber(item))); }, 0) + 1;
        var refund = {
          id: Date.now() + Math.floor(Math.random() * 1000), documentNumber: nextDoc,
          title: "برگشت وجه از سند #" + relatedDoc + ": " + clean(current.title || current.category || "پرداخت"),
          category: incomeAccount.name, categoryAccountId: incomeAccount.id, amount: value,
          date: selectedDate() || nowDate(), time: nowTime(), type: "income", method: "normal", account: accountName,
          project: current.project || void 0, familyMember: current.familyMember || void 0,
          description: description, hasManualDescription: !!description,
          isReversal: true, isRefundReceipt: true, refundOfDocNumber: relatedDoc, reversalOfDocNumber: relatedDoc
        };
        all.push(refund);
        var total = refundedTotal(all, current);
        current.refundAmount = total;
        current.refundStatus = total >= (Number(current.amount) || 0) ? "refunded" : "partial";
        if (total >= (Number(current.amount) || 0)) current.reversedByDocNumber = nextDoc;
        else delete current.reversedByDocNumber;
        write("hesabno:accounts_v5", ensured.accounts);
        write("hesabno:accounts", ensured.accounts);
        write("hesabno:transactions", all);
        try { sessionStorage.setItem("hesabno:payment-refund-resume", "transactions"); } catch (error) {}
        window.__hesabnoSoftReload();
      };
      amountInput.oninput = function () { amountInput.value = formatAmount(amountInput.value); error.classList.add("hidden"); };
    };
    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      window.setTimeout(function () { scheduled = false; sync(); }, 20);
    };
    sync();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("storage", schedule);
  })();
