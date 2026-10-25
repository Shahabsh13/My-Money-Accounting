(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var latin = function (value) { return String(value || "").replace(/[۰-۹]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(digit); }); };
    var amountValue = function (value) { return Number(latin(value).replace(/[^0-9]/g, "")) || 0; };
    var read = function (key, fallback) {
      try {
        var raw = window.__safeGet ? window.__safeGet(key) : localStorage.getItem(key);
        var value = JSON.parse(raw || JSON.stringify(fallback));
        return value == null ? fallback : value;
      } catch (error) { return fallback; }
    };
    var write = function (key, value) {
      var raw = JSON.stringify(value);
      if (window.__safeSet) window.__safeSet(key, raw); else localStorage.setItem(key, raw);
    };
    var readTransactions = function () { var value = read("hesabno:transactions", []); return Array.isArray(value) ? value : []; };
    var documentNumber = function (item) { return item && (item.documentNumber || item.id); };
    var numberFor = function (value) { return Number(latin(value).replace(/[^0-9]/g, "")) || 0; };
    var nowDate = function () {
      try {
        var parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()), values = {};
        parts.forEach(function (part) { values[part.type] = part.value; });
        return values.year + "/" + values.month + "/" + values.day;
      } catch (error) { return ""; }
    };
    var nowTime = function () {
      try { return new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()).replace(/\u200e/g, ""); } catch (error) { return ""; }
    };
    var findTransaction = function (id, items) { return items.find(function (item) { return String(item && item.id) === String(id); }); };
    var refundEntries = function (items, original) {
      var doc = String(documentNumber(original));
      return items.filter(function (item) { return item && item.isRefundReceipt && String(item.refundOfDocNumber || item.reversalOfDocNumber) === doc; });
    };
    var relatedCorrection = function (items, original) {
      var doc = String(documentNumber(original));
      return items.some(function (item) { return item && item.isReversal && !item.isRefundReceipt && String(item.reversalOfDocNumber) === doc; });
    };
    var refundedTotal = function (items, original, exceptId) {
      return refundEntries(items, original).reduce(function (sum, item) {
        return String(item.id) === String(exceptId || "") ? sum : sum + (Number(item.amount) || 0);
      }, 0);
    };
    var ensureIncomeAccount = function (accounts) {
      var existing = accounts.find(function (item) { return item && item.group === "income" && clean(item.name) === "برگشت وجه"; });
      if (existing) return { accounts: accounts, account: existing };
      var taken = Object.create(null), maxCode = 400;
      accounts.forEach(function (item) {
        if (!item || item.group !== "income") return;
        var code = numberFor(item.code);
        taken[String(item.code)] = true;
        if (item.parentId == null) maxCode = Math.max(maxCode, code);
      });
      var code = maxCode + 1;
      while (taken[String(code)]) code += 1;
      var account = { id: Date.now() + Math.floor(Math.random() * 1000), group: "income", code: String(code), name: "برگشت وجه", picture: "↩️", parentId: null, active: true, pinned: false, system: false };
      return { accounts: accounts.concat(account), account: account };
    };
    var currentModal = null, bypass = false;
    var removeModal = function () {
      if (currentModal && currentModal.node) currentModal.node.remove();
      currentModal = null;
    };
    var openModal = function (source, original, receipt) {
      removeModal();
      var items = readTransactions();
      var receipts = refundEntries(items, original);
      var correctionExists = relatedCorrection(items, original);
      var remaining = Math.max(0, (Number(original.amount) || 0) - refundedTotal(items, original, receipt && receipt.id));
      var currency = window.__safeGet ? window.__safeGet("hesabno:currency") : localStorage.getItem("hesabno:currency");
      var factor = clean(String(currency || "rial").replace(/^['"]|['"]$/g, "")) === "toman" ? 10 : 1;
      var canCorrect = !correctionExists && !receipts.length && !receipt;
      var overlay = document.createElement("div");
      overlay.setAttribute("data-hesabno-payment-refund-dialog", "true");
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.className = "fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4";
      overlay.innerHTML = "<div class=\"w-full max-w-sm rounded-2xl border border-stone-700 bg-stone-900 p-4 sm:p-5 shadow-2xl space-y-4\"><div class=\"flex items-center justify-between border-b border-stone-800 pb-3\"><div class=\"font-black text-sm text-stone-100\" data-hesabno-refund-title></div><button type=\"button\" data-hesabno-refund-close class=\"rounded-lg px-2 py-1 text-stone-400 hover:bg-stone-800\">×</button></div><div class=\"grid grid-cols-2 gap-1 rounded-xl bg-stone-950 p-1\"><button type=\"button\" data-hesabno-refund-tab=\"correction\" class=\"rounded-lg p-2 text-xs font-bold\">اصلاح سند</button><button type=\"button\" data-hesabno-refund-tab=\"refund\" class=\"rounded-lg p-2 text-xs font-bold\">برگشت وجه</button></div><div data-hesabno-refund-panel=\"correction\" class=\"space-y-3\"><p data-hesabno-correction-help class=\"text-xs leading-6 text-stone-300\">سند اصلاحی برای این پرداخت ثبت می‌شود و به سند اصلی پیوند می‌خورد.</p><button type=\"button\" data-hesabno-correction-continue class=\"w-full rounded-xl bg-amber-500 p-2.5 text-xs font-black text-stone-950\">ادامهٔ اصلاح سند</button></div><div data-hesabno-refund-panel=\"refund\" class=\"hidden space-y-3\"><p class=\"text-[11px] text-stone-400\" data-hesabno-refund-reference></p><div class=\"rounded-xl border border-stone-700 bg-stone-950/60 p-3 text-xs space-y-2\"><div class=\"flex justify-between gap-3\"><span class=\"text-stone-400\">از سرفصل درآمد</span><b class=\"text-emerald-300\">برگشت وجه</b></div><div class=\"flex justify-between gap-3\"><span class=\"text-stone-400\">واریز به حساب پرداخت اصلی</span><b data-hesabno-refund-account class=\"text-stone-100 text-left\"></b></div><div class=\"flex justify-between gap-3 border-t border-stone-800 pt-2\"><span class=\"text-stone-400\">ماندهٔ قابل برگشت</span><b data-hesabno-refund-remaining class=\"text-stone-200\"></b></div></div><label class=\"block space-y-1.5\"><span class=\"text-xs font-bold text-stone-300\">مبلغ برگشتی</span><input data-hesabno-refund-amount type=\"text\" inputmode=\"numeric\" autocomplete=\"off\" placeholder=\"فقط مبلغ را وارد کنید\" class=\"w-full rounded-xl border border-stone-700 bg-stone-950 p-3 text-left font-mono text-sm text-stone-100 outline-none focus:border-emerald-500\"></label><p data-hesabno-refund-error class=\"hidden text-[11px] text-rose-300\"></p><button type=\"button\" data-hesabno-refund-save class=\"w-full rounded-xl bg-emerald-500 p-2.5 text-xs font-black text-stone-950\">ثبت واریزی برگشت وجه</button></div></div>";
      overlay.querySelector("[data-hesabno-refund-title]").textContent = receipt ? "ویرایش مبلغ برگشت وجه" : "اصلاح سند / برگشت وجه";
      overlay.querySelector("[data-hesabno-refund-reference]").textContent = "مرتبط با سند پرداختی #" + documentNumber(original);
      overlay.querySelector("[data-hesabno-refund-account]").textContent = clean(original.account) || "حساب پرداختی مشخص نشده";
      overlay.querySelector("[data-hesabno-refund-remaining]").textContent = Math.round(remaining / factor).toLocaleString("fa-IR") + (factor === 10 ? " تومان" : " ریال");
      var correctionTab = overlay.querySelector("[data-hesabno-refund-tab='correction']");
      if (!canCorrect) {
        correctionTab.disabled = true;
        correctionTab.title = "پس از ثبت برگشت وجه، اصلاح کامل این سند برای جلوگیری از ثبت مبلغ تکراری غیرفعال است.";
        overlay.querySelector("[data-hesabno-correction-help]").textContent = "برای این سند قبلاً برگشت وجه ثبت شده است؛ برای جلوگیری از ثبت مبلغ تکراری، اصلاح کامل سند در دسترس نیست.";
        overlay.querySelector("[data-hesabno-correction-continue]").disabled = true;
        overlay.querySelector("[data-hesabno-correction-continue]").classList.add("opacity-40", "cursor-not-allowed");
      }
      var input = overlay.querySelector("[data-hesabno-refund-amount]");
      if (receipt) input.value = String(Math.round((Number(receipt.amount) || 0) / factor));
      var refundTab = overlay.querySelector("[data-hesabno-refund-tab='refund']");
      var correctionPanel = overlay.querySelector("[data-hesabno-refund-panel='correction']");
      var refundPanel = overlay.querySelector("[data-hesabno-refund-panel='refund']");
      var setTab = function (name) {
        var correction = name === "correction";
        correctionPanel.classList.toggle("hidden", !correction);
        refundPanel.classList.toggle("hidden", correction);
        correctionTab.className = "rounded-lg p-2 text-xs font-bold " + (correction ? "bg-stone-700 text-stone-100" : "text-stone-400");
        refundTab.className = "rounded-lg p-2 text-xs font-bold " + (!correction ? "bg-emerald-600 text-white" : "text-stone-400");
      };
      document.body.appendChild(overlay);
      currentModal = { node: overlay, source: source, originalId: String(original.id), receiptId: receipt && String(receipt.id) };
      overlay.querySelector("[data-hesabno-refund-close]").addEventListener("click", removeModal);
      overlay.addEventListener("click", function (event) { if (event.target === overlay) removeModal(); });
      overlay.querySelectorAll("[data-hesabno-refund-tab]").forEach(function (button) {
        button.addEventListener("click", function () { if (!button.disabled) setTab(button.getAttribute("data-hesabno-refund-tab")); });
      });
      overlay.querySelector("[data-hesabno-correction-continue]").addEventListener("click", function () {
        if (!currentModal || !canCorrect) return;
        var trigger = currentModal.source;
        removeModal();
        bypass = true;
        try { trigger.click(); } finally { bypass = false; }
      });
      overlay.querySelector("[data-hesabno-refund-save]").addEventListener("click", function () {
        if (!currentModal) return;
        var value = amountValue(input.value) * factor, all = readTransactions();
        var originalNow = findTransaction(currentModal.originalId, all);
        var oldReceipt = currentModal.receiptId && findTransaction(currentModal.receiptId, all);
        var left = originalNow ? Math.max(0, (Number(originalNow.amount) || 0) - refundedTotal(all, originalNow, oldReceipt && oldReceipt.id)) : 0;
        var accountName = clean(originalNow && originalNow.account);
        var error = "";
        if (!originalNow || originalNow.type !== "expense" || originalNow.method === "check") error = "سند پرداختی اصلی پیدا نشد.";
        else if (!accountName) error = "حساب پرداختی سند اصلی مشخص نیست.";
        else if (value <= 0) error = "مبلغ برگشتی را وارد کنید.";
        else if (value > left) error = "مبلغ از ماندهٔ قابل برگشت بیشتر است.";
        else if (!oldReceipt && relatedCorrection(all, originalNow)) error = "این سند قبلاً با سند اصلاحی بسته شده است.";
        if (error) {
          var errorNode = overlay.querySelector("[data-hesabno-refund-error]");
          errorNode.textContent = error;
          errorNode.classList.remove("hidden");
          return;
        }
        var accounts = read("hesabno:accounts_v5", []);
        accounts = Array.isArray(accounts) ? accounts : [];
        var sourceCategoryAccount = accounts.find(function (account) {
          return account && (originalNow.categoryAccountId != null && String(account.id) === String(originalNow.categoryAccountId)
            || clean(account.name) && clean(account.name) === clean(originalNow.category));
        });
        var refundCategoryGroup = sourceCategoryAccount && sourceCategoryAccount.group;
        var ensured = ensureIncomeAccount(accounts);
        var incomeAccount = ensured.account;
        var relatedDoc = documentNumber(originalNow);
        var docNum = all.reduce(function (max, item) {
          var value = numberFor(item && item.documentNumber);
          if (!item.documentNumber && numberFor(item && item.id) < 1000000000) value = numberFor(item.id);
          return Math.max(max, value);
        }, 0) + 1;
        if (oldReceipt) {
          oldReceipt.amount = value;
          oldReceipt.account = accountName;
          oldReceipt.category = incomeAccount.name;
          oldReceipt.categoryAccountId = incomeAccount.id;
          oldReceipt.refundCategoryGroup = refundCategoryGroup || void 0;
        } else {
          var id = Date.now() + Math.floor(Math.random() * 1000);
          var refund = {
            id: id, documentNumber: docNum, title: "برگشت وجه از سند #" + relatedDoc + ": " + clean(originalNow.title || originalNow.category || "پرداخت"),
            category: incomeAccount.name, categoryAccountId: incomeAccount.id, amount: value, date: nowDate(), time: nowTime(),
            type: "income", method: "normal", account: accountName, project: originalNow.project || void 0,
            familyMember: originalNow.familyMember || void 0, description: "برگشت وجه بابت سند پرداختی #" + relatedDoc,
            hasManualDescription: false, isReversal: true, isRefundReceipt: true,
            refundCategoryGroup: refundCategoryGroup || void 0,
            refundOfDocNumber: relatedDoc, reversalOfDocNumber: relatedDoc
          };
          all.push(refund);
        }
        var total = refundedTotal(all, originalNow);
        originalNow.refundAmount = total;
        originalNow.refundStatus = total >= (Number(originalNow.amount) || 0) ? "refunded" : "partial";
        if (total >= (Number(originalNow.amount) || 0)) {
          var latestRefund = refundEntries(all, originalNow).reduce(function (latest, item) { return numberFor(documentNumber(item)) > numberFor(documentNumber(latest)) ? item : latest; }, null);
          originalNow.reversedByDocNumber = documentNumber(latestRefund);
        }
        else delete originalNow.reversedByDocNumber;
        write("hesabno:accounts_v5", ensured.accounts);
        write("hesabno:accounts", ensured.accounts);
        write("hesabno:transactions", all);
        try { sessionStorage.setItem("hesabno:payment-refund-resume", "transactions"); } catch (error) {}
        window.__hesabnoSoftReload();
      });
      setTab(canCorrect && !receipt ? "correction" : "refund");
      if (!canCorrect || receipt) setTab("refund");
      else correctionTab.focus();
    };
    var syncCards = function () {
      var items = readTransactions();
      document.querySelectorAll("article[id^='tx-card-']").forEach(function (article) {
        var id = article.id.slice("tx-card-".length), item = findTransaction(id, items);
        if (!item) return;
        if (item.isRefundReceipt) {
          var edit = Array.from(article.querySelectorAll("button")).find(function (button) { return clean(button.textContent) === "ویرایش"; });
          if (edit) {
            edit.setAttribute("data-hesabno-refund-edit", "true");
            edit.title = "ویرایش مبلغ برگشت وجه؛ حساب‌ها ثابت هستند";
          }
          return;
        }
        if (item.type !== "expense" || item.method === "check" || item.isReversal || item.isCompound) return;
        var linked = refundEntries(items, item), blocked = relatedCorrection(items, item);
        var left = Math.max(0, (Number(item.amount) || 0) - refundedTotal(items, item));
        var native = Array.from(article.querySelectorAll("button")).find(function (button) { return button.title === "ثبت سند اصلاحی برای این سند" || button.hasAttribute("data-hesabno-payment-refund-action"); });
        if (native && left > 0 && !blocked) {
          if (native.getAttribute("data-hesabno-payment-refund-action") !== "true") native.setAttribute("data-hesabno-payment-refund-action", "true");
          if (native.title !== "اصلاح سند / برگشت وجه") native.title = "اصلاح سند / برگشت وجه";
          var label = native.querySelector("span");
          if (label && label.textContent !== "اصلاحی / برگشت وجه") label.textContent = "اصلاحی / برگشت وجه";
          return;
        }
        var injected = article.querySelector("[data-hesabno-payment-refund-action='injected']");
        if (blocked || left <= 0 || !linked.length) { if (injected) injected.remove(); return; }
        var actionRow = Array.from(article.querySelectorAll("button")).find(function (button) { return clean(button.textContent) === "ویرایش"; });
        var row = actionRow && actionRow.parentElement;
        if (!row) return;
        if (!injected) {
          injected = document.createElement("button");
          injected.type = "button";
          injected.setAttribute("data-hesabno-payment-refund-action", "injected");
          injected.className = "flex items-center justify-center gap-1 py-1 px-2.5 rounded-lg bg-stone-700/70 hover:bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 font-bold text-[11px] transition cursor-pointer";
          injected.textContent = "برگشت وجه";
          injected.title = "ثبت برگشت وجه جزئی";
        }
        if (injected.parentElement !== row) row.appendChild(injected);
      });
    };
    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(function () { scheduled = false; syncCards(); });
    };
    document.addEventListener("click", function (event) {
      if (bypass) return;
      var button = event.target && event.target.closest ? event.target.closest("button") : null;
      if (!button || button.closest("[data-hesabno-payment-refund-dialog]")) return;
      var article = button.closest("article[id^='tx-card-']");
      if (!article) return;
      var items = readTransactions(), item = findTransaction(article.id.slice("tx-card-".length), items);
      if (button.hasAttribute("data-hesabno-refund-edit") && item && item.isRefundReceipt) {
        event.preventDefault(); event.stopImmediatePropagation(); event.stopPropagation();
        var original = items.find(function (candidate) { return String(documentNumber(candidate)) === String(item.refundOfDocNumber || item.reversalOfDocNumber); });
        if (original) openModal(button, original, item);
        return;
      }
      if (!button.hasAttribute("data-hesabno-payment-refund-action") || !item) return;
      if (button.getAttribute("data-hesabno-payment-refund-action") !== "injected") {
        window.__hesabnoPaymentRefundOriginalId = String(item.id);
        window.__hesabnoPaymentRefundNativeMode = "correction";
        return;
      }
      event.preventDefault(); event.stopImmediatePropagation(); event.stopPropagation();
      openModal(button, item, null);
    }, true);
    syncCards();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
    var resume = "";
    try { resume = sessionStorage.getItem("hesabno:payment-refund-resume") || ""; sessionStorage.removeItem("hesabno:payment-refund-resume"); } catch (error) {}
    if (resume === "transactions") window.setTimeout(function () {
      var button = Array.from(document.querySelectorAll("button")).find(function (item) { return clean(item.textContent) === "تراکنش‌ها"; });
      if (button) button.click();
    }, 900);
  })();
