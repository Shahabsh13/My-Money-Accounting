(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var active = null, bypass = false;
    var remove = function () {
      if (active && active.modal) active.modal.remove();
      active = null;
    };
    var saveReplacementPaymentEdit = function (paymentId, accountName, actionDate, amount, details) {
      var items = [];
      try { items = JSON.parse((window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions")) || "[]"); } catch (error) { return false; }
      var payment = items.find(function (item) { return String(item && item.id) === String(paymentId) && item.isCheckReplacementPayment === true; });
      if (!payment || !clean(accountName) || !(Number(amount) > 0)) return false;
      var original = items.find(function (item) {
        return item && item.check && ((payment.relatedCheckId != null && String(item.id) === String(payment.relatedCheckId)) || String(item.documentNumber || item.id) === String(payment.relatedCheckDocNumber));
      });
      if (!original) return false;
      var toLatin = function (value) { return String(value || "").replace(/[۰-۹]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(digit); }).replace(/[٠-٩]/g, function (digit) { return "٠١٢٣٤٥٦٧٨٩".indexOf(digit); }); };
      var match = toLatin(actionDate).match(/^(\d{4})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})$/);
      if (!match) return false;
      var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
      var maxDay = month <= 6 ? 31 : month <= 11 ? 30 : window.__hesabnoJalaliMonthLength ? window.__hesabnoJalaliMonthLength(year, month) : 29;
      if (month < 1 || month > 12 || day < 1 || day > maxDay) return false;
      var normalized = ("0000" + year).slice(-4) + "/" + ("0" + month).slice(-2) + "/" + ("0" + day).slice(-2);
      var originalMatch = toLatin(original.date).match(/^(\d{4})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})$/);
      var originalDateKey = originalMatch ? Number(originalMatch[1]) * 10000 + Number(originalMatch[2]) * 100 + Number(originalMatch[3]) : 0;
      var actionDateKey = year * 10000 + month * 100 + day;
      var otherPaid = items.reduce(function (sum, item) {
        return item && item.id !== payment.id && item.isCheckReplacementPayment === true &&
          (String(item.relatedCheckDocNumber) === String(original.documentNumber || original.id) || String(item.relatedCheckId) === String(original.id))
          ? sum + (Number(item.amount) || 0) : sum;
      }, 0);
      var maximum = Math.max(0, Math.abs(Number(original.amount) || 0) - otherPaid);
      var todayMatch = toLatinDate(new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())).match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
      var todayKey = todayMatch ? Number(todayMatch[1]) * 10000 + Number(todayMatch[2]) * 100 + Number(todayMatch[3]) : 0;
      if (originalDateKey && actionDateKey < originalDateKey || todayKey && actionDateKey > todayKey || Number(amount) > maximum) return false;
      payment.date = normalized;
      payment.amount = Number(amount);
      payment.account = clean(accountName);
      details = details || {};
      var notes = String(details.notes || "").trim();
      payment.notes = notes || void 0;
      payment.hasManualDescription = !!notes;
      if (details.attachment) payment.attachment = details.attachment; else delete payment.attachment;
      if (details.attachmentName) payment.attachmentName = details.attachmentName; else delete payment.attachmentName;
      var originalTitle = clean(original.title || original.description || original.category || "هزینه");
      payment.title = "هزینه جایگزین سند #" + (original.documentNumber || original.id) + ": " + originalTitle;
      payment.description = "پرداخت از حساب «" + payment.account + "» بابت چک برگشتی #" + (original.documentNumber || original.id) + " · " + originalTitle;
      try {
        if (window.__safeSet) window.__safeSet("hesabno:transactions", JSON.stringify(items));
        else localStorage.setItem("hesabno:transactions", JSON.stringify(items));
        sessionStorage.setItem("hesabno:check-resolution-resume", "checks");
      } catch (error) { return false; }
      window.__hesabnoSoftReload();
      return true;
    };
    var open = function (source, context, forcedId, followUp, editingPaymentId) {
      remove();
      var article = source && source.closest ? source.closest("article") : null, container = article || context || (source && source.closest ? source.closest("form") : null), text = clean(container && container.textContent), paragraphs = container ? Array.from(container.querySelectorAll("p")) : [];
      var amountNode = paragraphs.find(function (node) { return /(?:ریال|تومان)/.test(clean(node.textContent)); });
      var checkNumberLine = paragraphs.find(function (node) { return clean(node.textContent).includes("شماره چک:"); });
      var numberMatch = clean(checkNumberLine ? checkNumberLine.textContent : text).match(/(?:شماره چک|وضعیت چک)\s*:?[\s]*([0-9۰-۹]+)/u);
      var storedTransactions = [];
      try { storedTransactions = JSON.parse((window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions")) || "[]"); } catch (error) {}
      var transactionId = forcedId || (article && article.id.indexOf("tx-card-") === 0 ? article.id.slice("tx-card-".length) : "") || window.__hesabnoPendingCheckStatusId || "";
      var transaction = storedTransactions.find(function (item) { return transactionId ? String(item.id) === transactionId : item.check && numberMatch && clean(item.check.number) === clean(numberMatch[1]); });
      var editingPayment = editingPaymentId && storedTransactions.find(function (item) { return String(item && item.id) === String(editingPaymentId) && item.isCheckReplacementPayment === true; });
      transactionId = transaction && String(transaction.id);
      var amountText = editingPayment && transaction ? (Number(transaction.amount) || 0).toLocaleString("fa-IR") + " ریال" : clean(amountNode && amountNode.textContent) || (transaction ? (Number(transaction.amount) || 0).toLocaleString("fa-IR") + " ریال" : "—");
      var checkNumberText = editingPayment && transaction ? clean(transaction.check && transaction.check.number) || "—" : numberMatch ? numberMatch[1] : clean(transaction && transaction.check && transaction.check.number) || "—";
      var modal = document.createElement("div");
      modal.setAttribute("data-hesabno-return-confirm", "true");
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.className = "fixed inset-0 z-[90] bg-black/80 backdrop-blur-xs flex items-stretch justify-stretch p-0 animate-fadeIn hesabno-overlay-motion";
      modal.style.setProperty("z-index", "90", "important");
      modal.style.setProperty("padding", "0", "important");
      modal.style.setProperty("align-items", "stretch", "important");
      modal.style.setProperty("justify-content", "stretch", "important");
      modal.style.setProperty("height", "100dvh", "important");
      modal.innerHTML = "<div class=\"w-full max-w-sm bg-stone-900 border border-stone-700 rounded-2xl p-5 space-y-4 shadow-2xl hesabno-dialog-motion\"><div class=\"flex items-center justify-between border-b border-stone-800 pb-3\"><div class=\"flex items-center gap-2 text-rose-400 font-black text-sm\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"text-rose-400\"><circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"m15 9-6 6\"></path><path d=\"m9 9 6 6\"></path></svg><span>تایید برگشت چک</span></div><button type=\"button\" aria-label=\"بستن\" class=\"p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg></button></div><div class=\"space-y-2.5 text-xs text-stone-300\"><p class=\"leading-relaxed text-stone-200\">آیا از برگشت‌زدن این چک مطمئن هستید؟ وضعیت چک به <span class=\"text-rose-400 font-bold\">برگشت‌خورده</span> تغییر می‌کند و گزینهٔ پاس‌شدن حذف می‌شود.</p><div class=\"bg-stone-800/80 border border-stone-700/60 rounded-xl p-3 space-y-1.5 text-xs\"><div class=\"flex justify-between\"><span class=\"text-stone-400\">مبلغ چک:</span><span class=\"font-bold text-rose-400 font-mono\">" + clean(amountNode && amountNode.textContent) + "</span></div><div class=\"flex justify-between\"><span class=\"text-stone-400\">شماره چک:</span><span class=\"font-bold text-stone-200 font-mono\">" + (numberMatch ? numberMatch[1] : "—") + "</span></div></div></div><div class=\"flex items-center gap-2 pt-2\"><button type=\"button\" data-hesabno-return-confirm-accept class=\"grow py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shadow-md shadow-rose-950/40 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer\"><span>تایید برگشت چک</span></button><button type=\"button\" data-hesabno-return-confirm-cancel class=\"py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs transition cursor-pointer\">انصراف</button></div></div>";
       modal.innerHTML = "<div class=\"w-full max-w-sm bg-stone-900 border border-stone-700 rounded-2xl p-5 space-y-4 shadow-2xl hesabno-dialog-motion\"><div class=\"flex items-center justify-between border-b border-stone-800 pb-3\"><div class=\"font-black text-sm text-rose-300\">پیگیری برگشت چک</div><button type=\"button\" aria-label=\"بستن\" class=\"p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800\">×</button></div><div class=\"rounded-xl bg-stone-800/80 border border-stone-700/60 p-3 text-xs space-y-1\"><div>مبلغ چک: <b data-hesabno-return-amount></b></div><div>شماره چک: <b data-hesabno-return-number></b></div></div><div data-hesabno-return-choice-view class=\"space-y-2\"><button type=\"button\" data-hesabno-return-choice=\"cancelDebt\" class=\"w-full text-right rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200 font-bold text-xs\"><span class=\"block\">معامله / ماندهٔ بدهی لغو شده</span><span class=\"block mt-1 text-[10px] text-stone-400 font-normal\">چک برگشتی می‌ماند؛ سند مالی تازه ساخته نمی‌شود.</span></button><button type=\"button\" data-hesabno-return-choice=\"account\" class=\"w-full text-right rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-sky-200 font-bold text-xs\"><span class=\"block\">ثبت پرداخت جایگزین</span><span class=\"block mt-1 text-[10px] text-stone-400 font-normal\">فقط مبلغی که واقعاً پرداخت کرده‌اید ثبت کنید.</span></button></div><div data-hesabno-return-account-view class=\"hidden space-y-3\"></div><p class=\"text-[10px] text-stone-500\">چک برگشتی از جمع هزینه خارج می‌شود؛ پرداخت‌های واقعی جداگانه و حداکثر تا مبلغ بدهی ثبت می‌شوند.</p></div>";
      modal.querySelector("[data-hesabno-return-amount]").textContent = amountText;
        modal.querySelector("[data-hesabno-return-number]").textContent = checkNumberText;
        var dialogPanel = modal.firstElementChild;
        dialogPanel.className = "w-full h-[100dvh] max-w-none max-h-none overflow-y-auto bg-stone-900 border-0 rounded-none p-5 sm:p-8 space-y-5 shadow-2xl hesabno-dialog-motion";
        dialogPanel.style.setProperty("width", "100%", "important");
        dialogPanel.style.setProperty("height", "100dvh", "important");
        dialogPanel.style.setProperty("min-height", "100dvh", "important");
        dialogPanel.style.setProperty("max-width", "none", "important");
        dialogPanel.style.setProperty("max-height", "none", "important");
        dialogPanel.style.setProperty("border-radius", "0", "important");
        dialogPanel.style.setProperty("overflow-y", "auto", "important");
        var dialogHeader = dialogPanel.firstElementChild;
        if (dialogHeader) dialogHeader.classList.add("sticky", "top-0", "z-10", "bg-stone-900", "pt-1");
        var dialogBody = document.createElement("div");
        dialogBody.className = "mx-auto w-full max-w-4xl space-y-5";
        dialogBody.style.setProperty("width", "100%", "important");
        dialogBody.style.setProperty("max-width", "896px", "important");
        dialogBody.style.setProperty("margin-left", "auto", "important");
        dialogBody.style.setProperty("margin-right", "auto", "important");
        Array.from(dialogPanel.children).slice(1).forEach(function (node) { dialogBody.appendChild(node); });
        dialogPanel.appendChild(dialogBody);
        var dialogTitle = modal.querySelector(".font-black.text-sm.text-rose-300");
        if (dialogTitle) dialogTitle.setAttribute("data-hesabno-return-title", "true");
        var cancellationChoice = modal.querySelector("[data-hesabno-return-choice='cancelDebt']");
        var replacementAccountChoice = modal.querySelector("[data-hesabno-return-choice='account']");
        var existingPayments = transaction ? storedTransactions.filter(function (item) {
          var doc = transaction.documentNumber || transaction.id;
          return item && item.isCheckReplacementPayment === true &&
            (String(item.relatedCheckDocNumber) === String(doc) || String(item.relatedCheckId) === String(transaction.id));
        }) : [];
        var paidToDate = existingPayments.reduce(function (sum, item) { return sum + (Number(item.amount) || 0); }, 0);
        var stillDue = transaction ? Math.max(0, Math.abs(Number(transaction.amount) || 0) - paidToDate) : 0;
        if (stillDue <= 0) {
          cancellationChoice.disabled = true;
          replacementAccountChoice.disabled = true;
          modal.querySelector("p:last-child").textContent = "این بدهی قبلاً کامل تسویه شده است؛ چک در سابقهٔ برگشتی می‌ماند.";
        }
       document.body.appendChild(modal);
        active = { modal: modal, source: source, transactionId: transactionId, followUp: !!followUp, editingPaymentId: editingPayment ? String(editingPayment.id) : "" };
        if (editingPayment && dialogTitle) dialogTitle.textContent = "ویرایش پرداخت جایگزین";
        var close = function () {
          remove();
        };
      modal.querySelector("[aria-label='بستن']").addEventListener("click", close);
      modal.addEventListener("click", function (event) { if (event.target === modal) close(); });
      var showAccounts = function () {
        var choiceView = modal.querySelector("[data-hesabno-return-choice-view]"), accountView = modal.querySelector("[data-hesabno-return-account-view]");
          var accounts = [], allAccounts = [], currentItems = [], original = null;
         try { currentItems = JSON.parse((window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions")) || "[]"); } catch (error) {}
         original = currentItems.find(function (item) { return String(item && item.id) === active.transactionId; });
         var doc = original && (original.documentNumber || original.id);
          var editPayment = active && active.editingPaymentId && currentItems.find(function (item) { return String(item && item.id) === String(active.editingPaymentId) && item.isCheckReplacementPayment === true; });
          var paid = original ? currentItems.reduce(function (sum, item) {
            return item && item.isCheckReplacementPayment === true && String(item.id) !== String(editPayment && editPayment.id) && (String(item.relatedCheckDocNumber) === String(doc) || String(item.relatedCheckId) === String(original.id)) ? sum + (Number(item.amount) || 0) : sum;
         }, 0) : 0;
         var currencyFactor = clean((window.__safeGet ? window.__safeGet("hesabno:currency") : localStorage.getItem("hesabno:currency")) || "rial").replace(/[\"']/g, "") === "toman" ? 10 : 1;
         var remaining = original ? Math.max(0, Math.abs(Number(original.amount) || 0) - paid) : 0;
         try { allAccounts = JSON.parse((window.__safeGet ? window.__safeGet("hesabno:accounts_v5") : localStorage.getItem("hesabno:accounts_v5")) || "[]"); } catch (error) {}
           accounts = allAccounts.filter(function (account) {
             return account && (account.group === "bank" || account.group === "cash") && account.active !== false;
           });
        choiceView.classList.add("hidden");
        accountView.classList.remove("hidden");
          accountView.innerHTML = `
            <p class="text-xs text-stone-300">فقط مبلغ واقعاً پرداخت‌شده را وارد کنید. این پرداخت به همین چک برگشتی پیوست می‌شود.</p>
            <p data-hesabno-return-remaining class="rounded-lg bg-stone-800 px-3 py-2 text-[11px] font-bold text-stone-300"></p>
            <div class="space-y-1 w-full text-right">
              <label class="text-xs text-stone-300 font-medium block">حساب پرداخت‌کننده</label>
              <button type="button" data-hesabno-return-account-open class="w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl bg-stone-900 border border-stone-700/80 hover:bg-stone-850 text-right transition cursor-pointer active:scale-99">
                <span class="flex items-center gap-2.5 min-w-0">
                  <span data-hesabno-return-account-picture class="w-8 h-8 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-base shrink-0">🏷️</span>
                  <span class="min-w-0"><span data-hesabno-return-account-name class="block text-xs font-bold text-stone-100 truncate"></span></span>
                </span>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-stone-400"><path d="m6 9 6 6 6-6"></path></svg>
              </button>
              <select data-hesabno-return-account-select class="hidden"></select>
            </div>
            <label class="block space-y-1">
              <span class="text-xs text-stone-300 font-medium">مبلغ پرداختی</span>
              <input data-hesabno-return-payment-amount type="text" inputmode="numeric" autocomplete="off" class="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 font-mono focus:outline-none focus:border-emerald-500">
            </label>
            <div data-hesabno-return-payment-date-field class="w-full space-y-1">
              <label class="block text-xs font-bold text-stone-300 mb-1.5">تاریخ پرداخت</label>
              <div data-hesabno-return-payment-date-open dir="rtl" role="group" tabindex="0" class="w-full bg-stone-900 hover:bg-stone-850 border border-stone-700/80 hover:border-stone-600 rounded-2xl p-3 flex items-center justify-between transition cursor-pointer group shadow-xs">
                <div class="flex items-center gap-3 grow min-w-0 pr-1">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-stone-400 shrink-0 transition-colors"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 11h18"></path></svg>
                  <span data-hesabno-return-payment-date-label class="font-bold text-xs sm:text-[13px] text-stone-100 truncate"></span>
                </div>
                <span class="flex items-center gap-1 shrink-0 pl-1">
                  <button type="button" data-hesabno-return-date-prev-day class="p-1.5 rounded-lg transition text-stone-300 hover:text-white hover:bg-stone-800 active:scale-95" title="روز قبل" aria-label="روز قبل"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"></path></svg></button>
                  <button type="button" data-hesabno-return-date-next-day class="p-1.5 rounded-lg transition text-stone-300 hover:text-white hover:bg-stone-800 active:scale-95" title="روز بعد" aria-label="روز بعد"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"></path></svg></button>
                </span>
              </div>
              <input data-hesabno-return-payment-date type="hidden">
            </div>
            <div>
              <label class="block text-xs font-bold text-stone-300 mb-1.5">شرح / توضیحات <span class="text-[10px] text-stone-500 font-normal">(اختیاری)</span></label>
              <textarea data-hesabno-return-payment-notes rows="3" placeholder="توضیحاتی درباره این پرداخت بنویسید..." class="w-full bg-stone-800/90 border border-stone-700/60 rounded-xl px-3 py-2 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-emerald-500 min-h-16 transition"></textarea>
            </div>
            <section data-hesabno-return-attachment class="p-3 rounded-xl border border-stone-700/50 bg-stone-850/60 space-y-3">
              <div class="p-3 rounded-xl bg-stone-800/90 border border-stone-700/60 space-y-3">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2.5">
                    <span class="text-lg text-emerald-400">▣</span>
                    <div><p class="font-bold text-xs text-stone-200">تصویر فیش / سند پیوست</p></div>
                  </div>
                  <label class="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold cursor-pointer transition border border-stone-700/80 flex items-center gap-1.5 shadow-xs shrink-0">
                    <span class="text-emerald-400">＋</span><span class="whitespace-nowrap">انتخاب تصویر</span><input data-hesabno-return-attachment-input type="file" accept="image/*" hidden>
                  </label>
                </div>
                <div data-hesabno-return-attachment-preview></div>
              </div>
            </section>
            <p data-hesabno-return-attachment-error class="hidden text-xs text-rose-300"></p>
            <p data-hesabno-return-payment-error class="hidden text-xs text-rose-300"></p>
            <div class="flex gap-2">
              <button type="button" data-hesabno-return-account-save class="grow py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition">ثبت پرداخت جایگزین</button>
              <button type="button" data-hesabno-return-back class="rounded-xl bg-stone-800 px-3 text-stone-300 text-xs">بازگشت</button>
            </div>`;
          var paymentDate = accountView.querySelector("[data-hesabno-return-payment-date]");
          var paymentAmount = accountView.querySelector("[data-hesabno-return-payment-amount]");
          var paymentError = accountView.querySelector("[data-hesabno-return-payment-error]");
          var formatAmount = function (value) {
            var digits = String(value || "").replace(/[۰-۹]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(digit); }).replace(/[٠-٩]/g, function (digit) { return "٠١٢٣٤٥٦٧٨٩".indexOf(digit); }).replace(/[^0-9]/g, "");
            return digits ? Number(digits).toLocaleString("fa-IR") : "";
          };
          paymentAmount.value = formatAmount(Math.floor((editPayment ? Number(editPayment.amount) || 0 : remaining) / currencyFactor));
          accountView.querySelector("[data-hesabno-return-remaining]").textContent = (editPayment ? "سایر پرداخت‌ها: " : "پرداخت‌شده: ") + Math.round(paid / currencyFactor).toLocaleString("fa-IR") + " · " + (editPayment ? "حداکثر این پرداخت: " : "مانده: ") + Math.round(remaining / currencyFactor).toLocaleString("fa-IR") + (currencyFactor === 10 ? " تومان" : " ریال");
         try { paymentDate.value = editPayment && editPayment.date ? String(editPayment.date).replace(/[0-9]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]; }) : new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/-/g, "/"); } catch (error) {}
          var select = accountView.querySelector("[data-hesabno-return-account-select]");
          var accountSaveButton = accountView.querySelector("[data-hesabno-return-account-save]");
          var accountOpen = accountView.querySelector("[data-hesabno-return-account-open]");
          var accountNameLabel = accountView.querySelector("[data-hesabno-return-account-name]");
          var accountPicture = accountView.querySelector("[data-hesabno-return-account-picture]");
          if (editPayment) accountSaveButton.textContent = "ذخیره تغییرات پرداخت";
          accounts.forEach(function (account) { var option = document.createElement("option"); option.value = account.name; option.textContent = account.name; select.appendChild(option); });
          if (editPayment && accounts.some(function (account) { return account.name === editPayment.account; })) select.value = editPayment.account;
           if (!select.value && accounts.length) select.value = (accounts.find(function (account) { return account.group === "bank"; }) || accounts[0]).name;
          var renderAccountSelection = function () {
            var chosen = accounts.find(function (account) { return account.name === select.value; });
            accountNameLabel.textContent = chosen ? chosen.name : "انتخاب حساب بانکی یا صندوق...";
            accountPicture.textContent = chosen && chosen.picture || (chosen && chosen.group === "cash" ? "💵" : "🏦");
          };
          renderAccountSelection();
          var accountPicker = null;
          var openAccountPicker = function () {
            if (accountPicker && accountPicker.__hesabnoClose) accountPicker.__hesabnoClose();
            var activeAccount = accounts.find(function (account) { return account.name === select.value; });
             var state = { group: activeAccount && activeAccount.group || "bank", query: "" };
            var overlay = document.createElement("div");
            overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true"); overlay.setAttribute("dir", "rtl");
            overlay.setAttribute("data-hesabno-return-account-picker", "true");
            overlay.className = "fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150 hesabno-fullscreen-selector-overlay";
            var panel = document.createElement("div");
            panel.className = "w-full max-w-2xl h-[94vh] sm:h-[88vh] sm:max-h-[740px] rounded-t-3xl sm:rounded-3xl bg-stone-900 border-t sm:border border-stone-700/80 shadow-2xl flex flex-col overflow-hidden text-stone-100 hesabno-fullscreen-selector";
            panel.innerHTML = `<header class="flex items-center gap-3 px-4 py-3 border-b border-stone-800 shrink-0 bg-stone-900 z-10"><button type="button" data-account-picker-close class="p-2 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition" aria-label="بازگشت">‹</button><div class="grow min-w-0"><h1 class="text-base sm:text-lg font-black text-stone-100 truncate">انتخاب حساب پرداخت</h1><p class="text-xs text-stone-400 truncate">حساب بانکی یا صندوقی را که پرداخت از آن انجام شده انتخاب کنید.</p></div><button type="button" data-account-picker-close class="p-2 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition" aria-label="بستن">×</button></header><div class="bg-stone-900/95 pt-2 pb-2 px-4 border-b border-stone-800/80 space-y-2 shadow-xs shrink-0 z-10"><div class="flex gap-1.5"><button type="button" data-account-group="bank" class="grow px-3 py-2 rounded-xl text-xs font-bold transition">🏦 بانک</button><button type="button" data-account-group="cash" class="grow px-3 py-2 rounded-xl text-xs font-bold transition">💵 صندوق</button></div><div class="relative"><input data-account-search type="text" class="w-full bg-stone-800/90 border border-stone-700/60 rounded-xl pr-3 pl-8 py-2 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-emerald-500 transition" placeholder="جستجو"><button type="button" data-account-search-clear class="hidden absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200">×</button></div></div><div class="flex items-center justify-between text-[11px] text-stone-400 px-4 py-1.5 bg-stone-900 border-b border-stone-800/80 shrink-0"><span data-account-count></span></div><div data-account-list class="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2 no-scrollbar"></div>`;
            overlay.appendChild(panel); document.body.appendChild(overlay); accountPicker = overlay;
            var search = panel.querySelector("[data-account-search]");
            var list = panel.querySelector("[data-account-list]");
            panel.querySelector("[data-account-group]").parentElement.className = "flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5";
            var searchIcon = document.createElement("span");
            searchIcon.className = "absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none";
            searchIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>';
            search.parentElement.insertBefore(searchIcon, search);
            search.className = "w-full bg-stone-800/90 border border-stone-700/60 rounded-xl pr-9 pl-8 py-2 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-emerald-500 transition";
            var clearSearch = panel.querySelector("[data-account-search-clear]");
            clearSearch.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>';
            var escapeHandler;
            var closeAccountPicker = function () { overlay.remove(); if (accountPicker === overlay) accountPicker = null; if (escapeHandler) document.removeEventListener("keydown", escapeHandler); };
            overlay.__hesabnoClose = closeAccountPicker;
            escapeHandler = function (event) { if (event.key === "Escape") closeAccountPicker(); };
            document.addEventListener("keydown", escapeHandler);
            var accountIcon = function (account, size) {
              if (account.group === "bank" || account.bankName) {
                var name = String(account.bankName || account.name || "").replace(/^بانک\s+/, "");
                var logos = window.__HESABNO_OFFICIAL_BANK_LOGOS || {};
                var keys = Object.keys(logos).sort(function (a, b) { return b.length - a.length; });
                var key = keys.find(function (item) { return name.indexOf(item) !== -1 || String(account.name || "").indexOf(item) !== -1; });
                var mark = document.createElement("span");
                mark.className = "inline-flex items-center justify-center shrink-0 rounded-2xl overflow-hidden shadow-xs border border-stone-200/20 select-none";
                mark.style.width = size + "px"; mark.style.height = size + "px"; mark.style.backgroundColor = "#F1F5F9";
                mark.title = account.bankName || account.name || "حساب بانکی";
                if (key && logos[key]) {
                  var image = document.createElement("img"); image.src = logos[key]; image.alt = mark.title; image.className = "w-full h-full object-contain p-0.5"; image.loading = "lazy"; mark.appendChild(image);
                } else {
                  mark.innerHTML = '<svg viewBox="0 0 48 48" class="w-full h-full p-1" fill="none"><path d="M7 19 24 8l17 11v3H7v-3Zm3 6h4v13h-4V25Zm10 0h4v13h-4V25Zm10 0h4v13h-4V25Zm10 0h4v13h-4V25ZM6 42h36v-3H6v3Z" fill="#0288D1"/></svg>';
                }
                return mark;
              }
              var icon = document.createElement("span");
              icon.className = size < 20 ? "text-sm shrink-0" : "w-10 h-10 rounded-xl bg-stone-700/60 flex items-center justify-center text-xl flex-shrink-0";
              icon.textContent = account.picture || "🏦";
              return icon;
            };
            var renderAccountRows = function () {
              var filtered = accounts.filter(function (account) { var query = state.query.toLowerCase(); return account.group === state.group && (!query || [account.name, account.code, account.description, account.bankName].some(function (value) { return String(value || "").toLowerCase().includes(query); })); });
              panel.querySelectorAll("[data-account-group]").forEach(function (button) {
                var buttonGroup = button.getAttribute("data-account-group");
                var selected = buttonGroup === state.group;
                var bankTab = buttonGroup === "bank";
                button.innerHTML = (bankTab
                  ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7"></path><path d="M4 10h16M5 21h14M6 10v8M10 10v8M14 10v8M18 10v8M3 21h18"></path></svg><span>بانک‌ها</span>'
                  : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01M18 12h.01"></path></svg><span>صندوق‌ها</span>');
                button.setAttribute("aria-pressed", selected ? "true" : "false");
                button.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 cursor-pointer " + (selected ? "bg-emerald-500 text-stone-950 shadow-md shadow-emerald-950/40 font-black" : "bg-stone-800/80 text-stone-400 hover:text-stone-200 hover:bg-stone-800 border border-stone-700/60");
              });
              search.placeholder = "جستجو";
              panel.querySelector("[data-account-count]").textContent = filtered.length.toLocaleString("fa-IR") + " سرفصل/حساب";
              panel.querySelector("[data-account-search-clear]").classList.toggle("hidden", !state.query);
              list.replaceChildren();
              var quickAccounts = accounts.filter(function (account) { return account.pinned && account.active !== false; });
              if (!state.query && quickAccounts.length) {
                var quickWrap = document.createElement("div"); quickWrap.className = "mb-2.5";
                var quick = document.createElement("div"); quick.className = "bg-stone-850/70 border border-stone-800/80 rounded-2xl p-2 space-y-1.5 shadow-xs";
                var quickHeader = document.createElement("div"); quickHeader.className = "flex items-center justify-between px-1 text-emerald-400";
                var quickTitle = document.createElement("div"); quickTitle.className = "flex items-center gap-1";
                quickTitle.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"></path><path d="M15 3.7a2 2 0 0 0-2.1 0l-7.9 5a2 2 0 0 0-1 1.7v.6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-.6a2 2 0 0 0-1-1.7z"></path></svg><span class="text-[10.5px] font-bold">سنجاق‌شده‌ها (دسترسی سریع)</span>';
                var quickCount = document.createElement("span"); quickCount.className = "text-[9.5px] text-stone-400 font-mono"; quickCount.textContent = quickAccounts.length.toLocaleString("fa-IR") + " / ۱۵";
                quickHeader.append(quickTitle, quickCount);
                var quickList = document.createElement("div"); quickList.className = "flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5 pt-0.5";
                quickAccounts.forEach(function (account) {
                  var chosen = select.value === account.name;
                  var item = document.createElement("div"); item.setAttribute("role", "button"); item.tabIndex = 0; item.setAttribute("aria-pressed", chosen ? "true" : "false");
                  item.className = "group shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border shadow-xs transition cursor-pointer " + (chosen ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold" : "bg-stone-800 border-stone-700/80 hover:border-emerald-500/50 text-stone-200");
                  item.appendChild(accountIcon(account, 16));
                  var label = document.createElement("span"); label.className = "text-xs font-bold group-hover:text-emerald-300 max-w-[110px] truncate leading-tight"; label.textContent = account.name; item.appendChild(label);
                  var choose = function () { select.value = account.name; renderAccountSelection(); closeAccountPicker(); };
                  item.addEventListener("click", choose); item.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(); } });
                  quickList.appendChild(item);
                });
                quick.append(quickHeader, quickList); quickWrap.appendChild(quick); list.appendChild(quickWrap);
              }
              if (!filtered.length) { var empty = document.createElement("div"); empty.className = "py-12 text-center text-stone-500 text-xs"; empty.textContent = "حسابی در این سرفصل یافت نشد."; list.appendChild(empty); return; }
              filtered.forEach(function (account) {
                var chosen = select.value === account.name;
                var row = document.createElement("div"); row.setAttribute("role", "button"); row.tabIndex = 0; row.setAttribute("aria-pressed", chosen ? "true" : "false");
                row.className = "bg-stone-800/90 border rounded-2xl p-3 flex items-center gap-3 transition relative cursor-pointer hover:bg-stone-750/90 " + (chosen ? "border-emerald-500 bg-emerald-950/20 ring-1 ring-emerald-500/30" : "border-stone-700/60 hover:border-stone-600") + (account.active === false ? " opacity-40" : "");
                row.appendChild(accountIcon(account, 36));
                var details = document.createElement("span"); details.className = "grow min-w-0";
                var name = document.createElement("p"); name.className = "font-bold text-xs truncate " + (chosen ? "text-emerald-300 font-black" : "text-stone-100"); name.textContent = account.name;
                details.appendChild(name);
                if (account.description) { var description = document.createElement("p"); description.className = "text-[10px] text-stone-500 truncate mt-0.5"; description.textContent = account.description; details.appendChild(description); }
                row.appendChild(details);
                var trailing = document.createElement("div"); trailing.className = "flex items-center gap-1.5 shrink-0";
                if (chosen) {
                  trailing.className += " w-6 h-6 rounded-full bg-emerald-500 text-stone-950 flex items-center justify-center shadow-xs";
                  trailing.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"></path></svg>';
                } else trailing.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-stone-500"><path d="m9 18 6-6-6-6"></path></svg>';
                row.appendChild(trailing);
                var chooseAccount = function () { select.value = account.name; renderAccountSelection(); closeAccountPicker(); };
                row.addEventListener("click", chooseAccount); row.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseAccount(); } });
                list.appendChild(row);
              });
            };
            panel.querySelectorAll("[data-account-group]").forEach(function (button) { button.addEventListener("click", function () { state.group = button.getAttribute("data-account-group"); state.query = ""; search.value = ""; renderAccountRows(); }); });
            search.addEventListener("input", function () { state.query = search.value.trim(); renderAccountRows(); });
            panel.querySelector("[data-account-search-clear]").addEventListener("click", function () { search.value = ""; state.query = ""; renderAccountRows(); search.focus(); });
             panel.querySelectorAll("[data-account-picker-close]").forEach(function (button) { button.addEventListener("click", closeAccountPicker); });
             overlay.addEventListener("click", function (event) { if (event.target === overlay) closeAccountPicker(); });
            renderAccountRows(); search.focus();
          };
          accountOpen.addEventListener("click", openAccountPicker);
          var toLatinDate = function (value) { return String(value || "").replace(/[۰-۹]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(digit); }).replace(/[٠-٩]/g, function (digit) { return "٠١٢٣٤٥٦٧٨٩".indexOf(digit); }); };
          var parsePaymentDate = function (value) { var match = toLatinDate(value).match(/(\d{4})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})/); return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null; };
          var formatPaymentDate = function (parts) { return ("0000" + parts.year).slice(-4) + "/" + ("0" + parts.month).slice(-2) + "/" + ("0" + parts.day).slice(-2); };
          var persianNumber = function (value) { return String(value).replace(/[0-9]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]; }); };
          var monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
          var todayParts = parsePaymentDate(new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/-/g, "/"));
          var minimumDate = parsePaymentDate(original && original.date);
          var jalaliBreaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
         var dateDiv = function (a, b) { return a < 0 ? Math.ceil(a / b) : Math.floor(a / b); };
         var dateMod = function (a, b) { return a - dateDiv(a, b) * b; };
         var jalaliToGregorian = function (jy, jm, jd) {
           var gy = jy + 621, leapJ = -14, jp = jalaliBreaks[0], jmBreak = 0, jump = 0, n;
           for (var i = 1; i < jalaliBreaks.length; i += 1) { jmBreak = jalaliBreaks[i]; jump = jmBreak - jp; if (jy < jmBreak) break; leapJ += dateDiv(jump, 33) * 8 + dateDiv(dateMod(jump, 33), 4); jp = jmBreak; }
           n = jy - jp; leapJ += dateDiv(n, 33) * 8 + dateDiv(dateMod(n, 33) + 3, 4); if (dateMod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
           var leapG = dateDiv(gy, 4) - dateDiv((dateDiv(gy, 100) + 1) * 3, 4) - 150, march = 20 + leapJ - leapG;
           var day = dateDiv((gy + dateDiv(3 - 8, 6) + 100100) * 1461, 4);
           day += dateDiv(153 * dateMod(3 + 9, 12) + 2, 5) + march - 34840408;
           day = day - dateDiv(dateDiv(gy + 100100 + dateDiv(3 - 8, 6), 100) * 3, 4) + 752;
           day += (jm - 1) * 31 - dateDiv(jm, 7) * (jm - 7) + jd - 1;
           var j = 4 * day + 139361631; j += dateDiv(dateDiv(4 * day + 183187720, 146097) * 3, 4) * 4 - 3908;
           var i = dateDiv(dateMod(j, 1461), 4) * 5 + 308, gd = dateDiv(dateMod(i, 153), 5) + 1, gm = dateMod(dateDiv(i, 153), 12) + 1;
            return { year: dateDiv(j, 1461) - 100100 + dateDiv(8 - gm, 6), month: gm, day: gd };
          };
          var dateKey = function (parts) { return parts ? parts.year * 10000 + parts.month * 100 + parts.day : 0; };
          var paymentMonthLength = function (year, month) { return window.__hesabnoJalaliMonthLength ? window.__hesabnoJalaliMonthLength(year, month) : month <= 6 ? 31 : month <= 11 ? 30 : 29; };
          var setPaymentDate = function (parts) {
            paymentDate.value = persianNumber(formatPaymentDate(parts));
            var gregorian = jalaliToGregorian(parts.year, parts.month, parts.day);
            var date = new Date(Date.UTC(gregorian.year, gregorian.month - 1, gregorian.day, 12));
            accountView.querySelector("[data-hesabno-return-payment-date-label]").textContent = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", year: "numeric", month: "long", day: "numeric" }).format(date);
          };
          var initialPaymentDate = parsePaymentDate(editPayment && editPayment.date) || todayParts;
          if (minimumDate && dateKey(initialPaymentDate) < dateKey(minimumDate)) initialPaymentDate = minimumDate;
          if (todayParts && dateKey(initialPaymentDate) > dateKey(todayParts) && (!minimumDate || dateKey(minimumDate) <= dateKey(todayParts))) initialPaymentDate = todayParts;
          setPaymentDate(initialPaymentDate);
          var dateContainer = accountView.querySelector("[data-hesabno-return-payment-date-open]");
          var updateDayButtons = function () {
            var current = parsePaymentDate(paymentDate.value), previous = accountView.querySelector("[data-hesabno-return-date-prev-day]"), next = accountView.querySelector("[data-hesabno-return-date-next-day]");
            var previousBlocked = !current || minimumDate && dateKey(current) <= dateKey(minimumDate);
            var nextBlocked = !current || todayParts && dateKey(current) >= dateKey(todayParts);
            previous.disabled = !!previousBlocked; next.disabled = !!nextBlocked;
            previous.classList.toggle("opacity-20", !!previousBlocked); previous.classList.toggle("cursor-not-allowed", !!previousBlocked);
            next.classList.toggle("opacity-20", !!nextBlocked); next.classList.toggle("cursor-not-allowed", !!nextBlocked);
          };
          updateDayButtons();
          var stepPaymentDate = function (amount) {
            var current = parsePaymentDate(paymentDate.value); if (!current) return;
            var day = current.day + amount;
            if (day < 1) { current.month -= 1; if (current.month < 1) { current.month = 12; current.year -= 1; } day = paymentMonthLength(current.year, current.month); }
            else if (day > paymentMonthLength(current.year, current.month)) { day = 1; current.month += 1; if (current.month > 12) { current.month = 1; current.year += 1; } }
            setPaymentDate({ year: current.year, month: current.month, day: day }); updateDayButtons();
          };
          accountView.querySelector("[data-hesabno-return-date-prev-day]").addEventListener("click", function (event) { event.stopPropagation(); if (!this.disabled) stepPaymentDate(-1); });
          accountView.querySelector("[data-hesabno-return-date-next-day]").addEventListener("click", function (event) { event.stopPropagation(); if (!this.disabled) stepPaymentDate(1); });
          var attachmentInput = accountView.querySelector("[data-hesabno-return-attachment-input]");
          var attachmentPreview = accountView.querySelector("[data-hesabno-return-attachment-preview]");
          var attachmentError = accountView.querySelector("[data-hesabno-return-attachment-error]");
          var attachment = editPayment && editPayment.attachment
            ? (window.__hesabnoResolveAttachment ? window.__hesabnoResolveAttachment(String(editPayment.attachment)) : String(editPayment.attachment))
            : "";
          var attachmentName = editPayment && editPayment.attachmentName ? String(editPayment.attachmentName) : "";
          var attachmentLoading = false;
          var renderAttachment = function () {
            attachmentPreview.replaceChildren();
            if (!attachment) return;
            var card = document.createElement("div");
            card.className = "relative rounded-xl overflow-hidden border border-stone-700/60 bg-stone-800/90 p-2 flex items-center gap-3";
            var thumbnailButton = document.createElement("button"); thumbnailButton.type = "button"; thumbnailButton.className = "relative group rounded-lg overflow-hidden shrink-0 cursor-zoom-in border border-stone-700 active:scale-95 transition"; thumbnailButton.title = "مشاهده تصویر در اندازه واقعی";
            var thumbnail = document.createElement("img"); thumbnail.src = attachment; thumbnail.alt = "پیش‌نمایش فیش"; thumbnail.className = "w-14 h-14 object-cover group-hover:scale-105 transition duration-200"; thumbnailButton.appendChild(thumbnail);
            var showAttachment = function () {
              var overlay = document.createElement("div"); overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true"); overlay.setAttribute("dir", "rtl");
              overlay.className = "fixed inset-0 z-[999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in";
              var panel = document.createElement("div"); panel.className = "relative max-w-2xl w-full bg-stone-900 border border-stone-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"; panel.addEventListener("click", function (event) { event.stopPropagation(); });
              var header = document.createElement("div"); header.className = "flex items-center justify-between p-3 border-b border-stone-800 bg-stone-950/80";
              var title = document.createElement("span"); title.className = "text-xs font-bold text-stone-200 truncate"; title.textContent = attachmentName || "تصویر فیش پیوست";
              var closeButton = document.createElement("button"); closeButton.type = "button"; closeButton.className = "p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-xl transition"; closeButton.setAttribute("aria-label", "بستن پیش‌نمایش"); closeButton.textContent = "×";
              var close = function () { document.removeEventListener("keydown", onEscape); overlay.remove(); };
              closeButton.addEventListener("click", close); header.append(title, closeButton);
              var frame = document.createElement("div"); frame.className = "p-3 overflow-auto flex items-center justify-center bg-stone-950/60 min-h-[220px] max-h-[70vh]";
              var image = document.createElement("img"); image.src = attachment; image.alt = attachmentName || "پیش‌نمایش تصویر"; image.className = "max-w-full max-h-[66vh] object-contain rounded-xl shadow-lg border border-stone-800"; frame.appendChild(image);
              var footer = document.createElement("div"); footer.className = "p-3 bg-stone-900 border-t border-stone-800 flex items-center justify-between gap-3 text-xs text-stone-400";
              var description = document.createElement("span"); description.textContent = "تصویر بارگذاری‌شده برای پرداخت";
              var done = document.createElement("button"); done.type = "button"; done.className = "px-4 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition"; done.textContent = "بستن"; done.addEventListener("click", close); footer.append(description, done);
              panel.append(header, frame, footer); overlay.appendChild(panel); overlay.addEventListener("click", close);
              var onEscape = function (event) { if (event.key === "Escape") close(); }; document.addEventListener("keydown", onEscape); document.body.appendChild(overlay);
            };
            thumbnailButton.addEventListener("click", showAttachment);
            var details = document.createElement("div"); details.className = "min-w-0 flex-1 cursor-pointer"; details.title = "برای مشاهده تصویر کلیک کنید"; details.addEventListener("click", showAttachment);
            var filename = document.createElement("p"); filename.className = "text-xs font-bold text-stone-200 truncate hover:text-emerald-400 transition"; filename.textContent = attachmentName || "تصویر پیوست";
            var hint = document.createElement("p"); hint.className = "text-[10px] text-emerald-400 mt-0.5"; hint.textContent = "برای مشاهده تصویر بزرگ کلیک کنید"; details.append(filename, hint);
            var removeAttachment = document.createElement("button"); removeAttachment.type = "button"; removeAttachment.className = "px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold border border-rose-500/20 transition"; removeAttachment.textContent = "حذف";
            removeAttachment.addEventListener("click", function () { attachment = ""; attachmentName = ""; attachmentInput.value = ""; renderAttachment(); });
            card.append(thumbnailButton, details, removeAttachment); attachmentPreview.appendChild(card);
          };
          attachmentInput.addEventListener("change", function () {
            var file = attachmentInput.files && attachmentInput.files[0];
            if (!file) return;
            if (!/^image\//i.test(file.type || "")) { attachmentError.textContent = "فقط فایل تصویری انتخاب کنید."; attachmentError.classList.remove("hidden"); attachmentInput.value = ""; return; }
            attachmentError.classList.add("hidden"); attachmentLoading = true; accountSaveButton.disabled = true;
            if (typeof window.__hesabnoReadAndCompressImage === "function") {
              window.__hesabnoReadAndCompressImage(
                file,
                function (compressed) {
                  if (typeof compressed === "string" && compressed) {
                    attachment = compressed;
                    attachmentName = file.name || "تصویر فیش";
                    renderAttachment();
                  }
                  attachmentLoading = false;
                  accountSaveButton.disabled = !accounts.length || remaining <= 0;
                },
                function () {
                  attachmentLoading = false;
                  accountSaveButton.disabled = !accounts.length || remaining <= 0;
                  attachmentError.textContent = "خواندن تصویر انجام نشد؛ دوباره تلاش کنید.";
                  attachmentError.classList.remove("hidden");
                }
              );
              return;
            }
            var reader = new FileReader();
            reader.onload = function () { if (typeof reader.result === "string") { attachment = reader.result; attachmentName = file.name || "تصویر فیش"; renderAttachment(); } attachmentLoading = false; accountSaveButton.disabled = !accounts.length || remaining <= 0; };
            reader.onerror = function () { attachmentLoading = false; accountSaveButton.disabled = !accounts.length || remaining <= 0; attachmentError.textContent = "خواندن تصویر انجام نشد؛ دوباره تلاش کنید."; attachmentError.classList.remove("hidden"); };
            reader.readAsDataURL(file);
          });
          renderAttachment();
          var openPaymentDatePicker = function () {
            var current = parsePaymentDate(paymentDate.value) || todayParts;
            var state = { year: current.year, month: current.month, years: false, pendingDate: current };
            var overlay = document.createElement("div");
            overlay.setAttribute("data-hesabno-return-date-picker", "true");
            overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true");
            overlay.id = "hesabno-return-datepicker-backdrop";
            overlay.className = "fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200";
            overlay.style.setProperty("z-index", "2147483000", "important");
            var picker = document.createElement("div");
            picker.id = "hesabno-return-datepicker-sheet";
            picker.dir = "rtl";
            picker.className = "w-full max-w-sm bg-[#161a23] text-stone-100 rounded-t-3xl sm:rounded-3xl border-t sm:border border-stone-700/60 p-4 sm:p-5 shadow-2xl transition-all select-none animate-in slide-in-from-bottom-6 duration-200";
            picker.innerHTML = `<div class="w-10 h-1 bg-stone-700 rounded-full mx-auto mb-4 sm:hidden"></div><div class="flex items-center justify-between gap-2.5 mb-4"><button data-return-date-year type="button" class="px-4 py-2 rounded-xl text-sm font-bold border transition flex items-center gap-1.5"></button><div class="flex items-center justify-between bg-stone-800 border border-stone-700/80 rounded-xl px-2 py-1.5 min-w-[155px]"><button data-return-date-prev-month type="button" class="p-1 rounded-lg transition" title="ماه قبل">‹</button><span data-date-month class="font-bold text-sm text-stone-100 px-3"></span><button data-return-date-next-month type="button" class="p-1 rounded-lg transition" title="ماه بعد">›</button></div><button data-return-date-close type="button" aria-label="بستن تقویم" class="w-9 h-9 rounded-xl bg-stone-800/80 hover:bg-stone-750 border border-stone-700/60 text-stone-400 hover:text-stone-200 text-lg transition">×</button></div><div data-date-calendar></div><div class="flex items-center justify-start gap-3 mt-4 pt-2 border-t border-stone-800"><button data-return-date-today type="button" class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-750 border border-stone-700 text-xs font-bold text-stone-200 transition">امروز</button><button data-return-date-confirm type="button" class="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition">تأیید تاریخ</button></div>`;
            overlay.appendChild(picker); document.body.appendChild(overlay);
            var renderCalendar = function () {
              var body = picker.querySelector("[data-date-calendar]"), yearButton = picker.querySelector("[data-return-date-year]"), monthButton = picker.querySelector("[data-date-month]");
              yearButton.textContent = persianNumber(state.year);
              yearButton.className = "px-4 py-2 rounded-xl text-sm font-bold border transition flex items-center gap-1.5 " + (state.years ? "bg-blue-600 text-white border-blue-500 shadow-sm" : "bg-stone-800 hover:bg-stone-750 text-stone-100 border-stone-700/80");
              monthButton.textContent = monthNames[state.month - 1];
              var previousMonth = { year: state.month === 1 ? state.year - 1 : state.year, month: state.month === 1 ? 12 : state.month - 1, day: 1 };
              var nextMonth = { year: state.month === 12 ? state.year + 1 : state.year, month: state.month === 12 ? 1 : state.month + 1, day: 1 };
              var previousDisabled = minimumDate && dateKey(previousMonth) < dateKey({ year: minimumDate.year, month: minimumDate.month, day: 1 });
              var nextDisabled = todayParts && dateKey(nextMonth) > dateKey({ year: todayParts.year, month: todayParts.month, day: 1 });
              picker.querySelector("[data-return-date-prev-month]").disabled = !!previousDisabled;
              picker.querySelector("[data-return-date-next-month]").disabled = !!nextDisabled;
              ["[data-return-date-prev-month]", "[data-return-date-next-month]"].forEach(function (selector) { var button = picker.querySelector(selector); button.className = "p-1 rounded-lg transition " + (button.disabled ? "text-stone-600 opacity-20 cursor-not-allowed" : "text-stone-200 hover:text-white hover:bg-stone-700"); });
              if (state.years) {
                body.innerHTML = `<div class="bg-stone-850/90 border border-stone-700/50 rounded-2xl p-4 min-h-[290px] flex flex-col justify-between"><div class="text-xs font-bold text-stone-400 mb-3 text-center">انتخاب سال شمسی</div><div data-date-years class="grid grid-cols-3 gap-2.5 max-h-[240px] overflow-y-auto py-1"></div></div>`;
                var years = body.querySelector("[data-date-years]"), low = minimumDate ? minimumDate.year : todayParts.year - 12;
                for (var year = todayParts.year; year >= low; year -= 1) { var yearOption = document.createElement("button"); yearOption.type = "button"; yearOption.setAttribute("data-date-set-year", String(year)); yearOption.className = "py-2.5 rounded-xl font-bold text-sm transition " + (year === state.year ? "bg-blue-600 text-white shadow-md" : "bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700/60"); yearOption.textContent = persianNumber(year); years.appendChild(yearOption); }
                return;
              }
              var first = jalaliToGregorian(state.year, state.month, 1), leading = (new Date(Date.UTC(first.year, first.month - 1, first.day)).getUTCDay() + 1) % 7, monthLength = paymentMonthLength(state.year, state.month);
              body.innerHTML = `<div class="bg-stone-850/90 border border-stone-700/50 rounded-2xl p-3.5 shadow-inner"><div class="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-stone-400"><span class="py-1">ش</span><span class="py-1">ی</span><span class="py-1">د</span><span class="py-1">س</span><span class="py-1">چ</span><span class="py-1">پ</span><span class="py-1 text-rose-400/80">ج</span></div><div data-date-days class="grid grid-cols-7 gap-y-2 gap-x-1"></div></div>`;
              var days = body.querySelector("[data-date-days]"); for (var blank = 0; blank < leading; blank += 1) { var emptyDay = document.createElement("div"); emptyDay.className = "w-9 h-9 sm:w-10 sm:h-10"; days.appendChild(emptyDay); }
              var selected = parsePaymentDate(state.pendingDate);
              for (var day = 1; day <= monthLength; day += 1) {
                var parts = { year: state.year, month: state.month, day: day }, blocked = minimumDate && dateKey(parts) < dateKey(minimumDate) || todayParts && dateKey(parts) > dateKey(todayParts);
                var button = document.createElement("button"); button.type = "button"; button.disabled = !!blocked; button.setAttribute("data-date-day", String(day));
                button.className = "w-9 h-9 sm:w-10 sm:h-10 mx-auto flex items-center justify-center rounded-xl text-xs sm:text-sm font-bold transition-all " + (selected && dateKey(selected) === dateKey(parts) ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105 font-black" : dateKey(todayParts) === dateKey(parts) ? "border border-blue-400/80 text-blue-400 hover:bg-stone-800" : blocked ? "text-stone-600 opacity-25 cursor-not-allowed pointer-events-none" : "text-stone-200 hover:bg-stone-750 hover:text-white");
                button.textContent = persianNumber(day); days.appendChild(button);
              }
            };
            renderCalendar();
            var escapeHandler = null;
            var closeDatePicker = function () { overlay.remove(); if (escapeHandler) document.removeEventListener("keydown", escapeHandler); };
            overlay.addEventListener("click", function (event) {
              if (event.target === overlay) { event.stopPropagation(); return; }
              var button = event.target.closest("button"); if (!button) return;
              if (button.hasAttribute("data-return-date-close")) { closeDatePicker(); return; }
              if (button.hasAttribute("data-return-date-confirm")) { if (state.pendingDate) setPaymentDate(state.pendingDate); updateDayButtons(); closeDatePicker(); return; }
              if (button.hasAttribute("data-return-date-prev-month") || button.hasAttribute("data-return-date-next-month")) { if (button.disabled) return; state.month += button.hasAttribute("data-return-date-prev-month") ? -1 : 1; if (state.month < 1) { state.month = 12; state.year -= 1; } if (state.month > 12) { state.month = 1; state.year += 1; } state.years = false; renderCalendar(); }
              else if (button.hasAttribute("data-return-date-year")) { state.years = !state.years; renderCalendar(); }
              else if (button.hasAttribute("data-date-set-year")) { state.year = Number(button.getAttribute("data-date-set-year")); state.years = false; renderCalendar(); }
              else if (button.hasAttribute("data-return-date-today")) { if (!minimumDate || dateKey(todayParts) >= dateKey(minimumDate)) { state.pendingDate = todayParts; state.year = todayParts.year; state.month = todayParts.month; state.years = false; renderCalendar(); } }
              else if (button.hasAttribute("data-date-day") && !button.disabled) { state.pendingDate = { year: state.year, month: state.month, day: Number(button.getAttribute("data-date-day")) }; renderCalendar(); }
            });
          };
          dateContainer.addEventListener("click", openPaymentDatePicker);
          dateContainer.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPaymentDatePicker(); } });
         if (!accounts.length) {
          accountView.querySelector("p").textContent = "حساب بانکی یا صندوق فعال برای انتخاب پیدا نشد.";
         accountView.querySelector("[data-hesabno-return-account-save]").disabled = true;
         }
         if (remaining <= 0) {
           accountView.querySelector("[data-hesabno-return-remaining]").textContent = "این بدهی قبلاً کامل تسویه شده است.";
           accountView.querySelector("[data-hesabno-return-account-save]").disabled = true;
         }
          paymentAmount.addEventListener("input", function () { paymentAmount.value = formatAmount(paymentAmount.value); paymentError.classList.add("hidden"); });
          accountView.querySelector("[data-hesabno-return-payment-notes]").value = editPayment && editPayment.notes ? String(editPayment.notes) : "";
          accountView.querySelector("[data-hesabno-return-payment-notes]").addEventListener("input", function () { paymentError.classList.add("hidden"); });
         accountView.querySelector("[data-hesabno-return-back]").addEventListener("click", function () {
           if (active && active.followUp) { remove(); return; }
           accountView.classList.add("hidden"); choiceView.classList.remove("hidden");
         });
          accountView.querySelector("[data-hesabno-return-account-save]").addEventListener("click", function () {
            if (!active || !active.transactionId || !select.value) return;
             var amount = Number(String(paymentAmount.value || "").replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); }).replace(/[^0-9]/g, "")) * currencyFactor;
             if (!amount || amount > remaining) { paymentError.textContent = "مبلغ باید بیشتر از صفر و حداکثر برابر ماندهٔ بدهی باشد."; paymentError.classList.remove("hidden"); return; }
              if (attachmentLoading) { paymentError.textContent = "لطفاً تا پایان بارگذاری تصویر صبر کنید."; paymentError.classList.remove("hidden"); return; }
              var storedAttachment = attachment && typeof window.__hesabnoSaveAttachment === "function"
                ? window.__hesabnoSaveAttachment(attachment)
                : attachment;
              var details = { notes: accountView.querySelector("[data-hesabno-return-payment-notes]").value, attachment: storedAttachment, attachmentName: attachmentName };
              var saved = active.editingPaymentId
                ? saveReplacementPaymentEdit(active.editingPaymentId, select.value, paymentDate.value, amount, details)
                : window.__hesabnoResolveReturnedCheck(active.transactionId, "account", select.value, paymentDate.value, amount, "", details);
             if (saved) { if (!active.editingPaymentId) remove(); }
             else { paymentError.textContent = active.editingPaymentId ? "ویرایش انجام نشد؛ حساب، تاریخ یا سقف مبلغ را بررسی کنید." : "ثبت انجام نشد؛ تاریخ یا ماندهٔ بدهی را بررسی کنید."; paymentError.classList.remove("hidden"); }
          });
      };
      var showCorrectionForm = function () {
        if (!active || !active.transactionId) return;
        var items = [];
        try { items = JSON.parse((window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions")) || "[]"); } catch (error) {}
        var original = items.find(function (item) { return String(item && item.id) === active.transactionId; });
        if (!original) return;
        var toLatin = function (value) { return String(value || "").replace(/[۰-۹]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(digit); }).replace(/[٠-٩]/g, function (digit) { return "٠١٢٣٤٥٦٧٨٩".indexOf(digit); }); };
        var partsFor = function (value) {
          var match = toLatin(value).match(/(\d{4})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})/);
          if (!match) return null;
          var parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
          if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > (parts.month <= 6 ? 31 : 30)) return null;
          return parts;
        };
        var keyFor = function (value) { var parts = partsFor(value); return parts ? parts.year * 10000 + parts.month * 100 + parts.day : 0; };
        var formatDate = function (value) {
          var parts = partsFor(value);
          if (!parts) return "";
          return (("0000" + parts.year).slice(-4) + "/" + ("0" + parts.month).slice(-2) + "/" + ("0" + parts.day).slice(-2))
            .replace(/[0-9]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]; });
        };
        var today = "";
        try { today = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/-/g, "/"); } catch (error) {}
        var originalDate = formatDate(original.date) || today;
        var initialDate = keyFor(today) >= keyFor(originalDate) ? today : originalDate;
        var docNumber = original.documentNumber || original.id;
         var title = "اصلاحیهٔ پیوست به سند #" + docNumber;
         var typeLabel = "توضیح اصلاحی روی سند اصلی";
        var accountFrom = original.type === "transfer" ? original.destinationAccount || original.account : original.account;
        var accountTo = original.type === "transfer" ? original.account : "";
        var details = [
           ["موضوع", title], ["نوع اصلاحیه", typeLabel], ["تاریخ سند اصلی", original.date || "—"], ["دسته", original.category || "—"],
          [original.type === "transfer" ? "از حساب" : "حساب", accountFrom || "—"]
        ];
        if (original.type === "transfer") details.push(["به حساب", accountTo || "—"]);
        else if (original.destinationAccount) details.push(["حساب مقصد", original.destinationAccount]);
        details.push(["مبلغ", Math.abs(Number(original.amount) || 0).toLocaleString("fa-IR") + " ریال"]);
        details.push(["شرح", original.description || original.title || "—"]);
        details.push(["روش سند اصلی", original.method === "check" ? "چک" : original.method || "—"]);
        if (original.project) details.push(["پروژه", original.project]);
        if (original.familyMember) details.push(["عضو خانواده", original.familyMember]);
        if (original.check) {
          details.push(["شماره چک", original.check.number || "—"]);
          details.push(["بانک چک", original.check.bank || original.check.issuerBank || "—"]);
          details.push(["سررسید چک", original.check.dueDate || "—"]);
        }
        var existing = items.some(function (item) { return item && String(item.reversalOfDocNumber) === String(docNumber); });
        modal.innerHTML = "<div class=\"w-full max-w-lg max-h-[90vh] overflow-y-auto bg-stone-900 border border-stone-700 rounded-2xl p-5 space-y-4 shadow-2xl\"><div class=\"flex items-center justify-between border-b border-stone-800 pb-3\"><div><div class=\"font-black text-sm text-violet-200\">فرم سند اصلاحی</div><div class=\"mt-1 text-[10px] text-stone-400\">اطلاعات سند از سند اصلی تکمیل شده است.</div></div><button type=\"button\" aria-label=\"بستن\" class=\"rounded-lg px-2 py-1 text-stone-400 hover:bg-stone-800\">×</button></div><div data-hesabno-correction-form-details class=\"grid grid-cols-1 sm:grid-cols-2 gap-2\"></div><label class=\"block space-y-1.5\"><span class=\"text-xs font-bold text-stone-200\">تاریخ سند اصلاحی <span class=\"text-rose-300\">(تنها فیلد قابل تغییر)</span></span><input data-hesabno-correction-date type=\"text\" inputmode=\"numeric\" autocomplete=\"off\" placeholder=\"۱۴۰۵/۰۷/۰۵\" class=\"w-full rounded-xl border border-stone-600 bg-stone-950 p-3 text-sm text-stone-100 outline-none focus:border-violet-400\"></label><p class=\"text-[10px] text-stone-400\">تاریخ سند اصلاحی نمی‌تواند قبل از تاریخ سند اصلی باشد: <b data-hesabno-correction-min class=\"text-stone-200\"></b></p><p data-hesabno-correction-error class=\"hidden text-xs text-rose-300\"></p><div class=\"flex gap-2\"><button type=\"button\" data-hesabno-correction-save class=\"grow rounded-xl bg-violet-500 p-2.5 text-xs font-black text-white\">ثبت سند اصلاحی</button><button type=\"button\" data-hesabno-correction-back class=\"rounded-xl bg-stone-800 px-4 text-xs text-stone-300\">بازگشت</button></div></div>";
        var detailsNode = modal.querySelector("[data-hesabno-correction-form-details]");
        details.forEach(function (entry) {
          var row = document.createElement("div");
          row.className = "rounded-lg border border-stone-700/70 bg-stone-800/60 p-2 text-xs";
          var label = document.createElement("div"); label.className = "text-[10px] text-stone-400"; label.textContent = entry[0];
          var value = document.createElement("div"); value.className = "mt-1 break-words font-bold text-stone-100"; value.textContent = entry[1];
          row.appendChild(label); row.appendChild(value); detailsNode.appendChild(row);
        });
         var dateInput = modal.querySelector("[data-hesabno-correction-date]");
         dateInput.value = initialDate;
         modal.querySelector("[data-hesabno-correction-min]").textContent = originalDate || "—";
         var formTitle = modal.querySelector(".font-black.text-sm.text-violet-200");
         if (formTitle) formTitle.textContent = "ثبت اصلاحیه روی همان سند";
          var formSubtitle = modal.querySelector(".font-black.text-sm.text-violet-200 + div");
          if (formSubtitle) formSubtitle.textContent = "تاریخ و توضیح به سند اصلی افزوده می‌شود؛ سند جداگانه ساخته نمی‌شود.";
          var dateHelp = Array.from(modal.querySelectorAll("p")).find(function (node) { return clean(node.textContent).indexOf("تاریخ سند اصلاحی نمی‌تواند") === 0; });
          if (dateHelp) dateHelp.textContent = "تاریخ اصلاحیه نمی‌تواند قبل از تاریخ سند اصلی باشد: " + (originalDate || "—");
          var saveCorrectionButton = modal.querySelector("[data-hesabno-correction-save]");
          if (saveCorrectionButton) saveCorrectionButton.textContent = "ثبت توضیح اصلاحیه";
         var dateLabel = dateInput.parentElement.querySelector("span");
         if (dateLabel) dateLabel.innerHTML = "تاریخ اصلاحیه <span class=\"text-rose-300\">(الزامی)</span>";
         var detailsInput = document.createElement("textarea");
         detailsInput.setAttribute("data-hesabno-correction-description", "true");
         detailsInput.rows = 3;
         detailsInput.placeholder = "توضیح اصلاحیه را بنویسید";
         detailsInput.className = "w-full rounded-xl border border-stone-600 bg-stone-950 p-3 text-sm text-stone-100 outline-none focus:border-violet-400";
         dateInput.parentElement.insertAdjacentElement("afterend", detailsInput);
        var errorNode = modal.querySelector("[data-hesabno-correction-error]");
         if (existing || original.reversedByDocNumber || original.check.returnedWithCorrection) {
           errorNode.textContent = "برای این سند قبلاً اصلاحیه ثبت شده است.";
          errorNode.classList.remove("hidden");
          modal.querySelector("[data-hesabno-correction-save]").disabled = true;
        }
        modal.querySelector("[aria-label='بستن']").addEventListener("click", remove);
        modal.querySelector("[data-hesabno-correction-back]").addEventListener("click", function () {
          var state = active;
          if (state) open(state.source, state.source.closest("article") || state.source.closest("form"), state.transactionId);
        });
         modal.querySelector("[data-hesabno-correction-save]").addEventListener("click", function () {
           var selectedDate = formatDate(dateInput.value), selectedKey = keyFor(selectedDate), minKey = keyFor(originalDate);
           var correctionNote = clean(detailsInput.value);
           if (!selectedKey || selectedKey < minKey) {
             errorNode.textContent = "تاریخ معتبر و هم‌زمان یا بعد از تاریخ سند اصلی وارد کنید.";
             errorNode.classList.remove("hidden");
             return;
           }
           if (!correctionNote) {
             errorNode.textContent = "توضیح اصلاحیه را وارد کنید.";
             errorNode.classList.remove("hidden");
             detailsInput.focus();
             return;
           }
           if (window.__hesabnoResolveReturnedCheck(active.transactionId, "correction", "", selectedDate, correctionNote)) remove();
          else {
            errorNode.textContent = "ثبت سند اصلاحی انجام نشد؛ احتمالاً این سند قبلاً اصلاح شده است.";
            errorNode.classList.remove("hidden");
          }
        });
        modal.querySelector("[data-hesabno-correction-date]").focus();
      };
      modal.querySelectorAll("[data-hesabno-return-choice]").forEach(function (button) {
        button.addEventListener("click", function () {
          if (!active || !active.transactionId) return;
          var action = button.getAttribute("data-hesabno-return-choice");
          if (action === "account") { showAccounts(); return; }
          if (action === "cancelDebt") {
            var today = "";
            try { today = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/-/g, "/"); } catch (error) {}
            if (window.__hesabnoResolveReturnedCheck(active.transactionId, "cancelDebt", "", today, 0, "")) remove();
          }
        });
      });
      if (followUp) showAccounts();
      else cancellationChoice.focus();
    };
    window.__hesabnoOpenCheckPayment = function (id, button) {
      var card = button && button.closest ? button.closest("article") : null;
      open(button || card, card, String(id), false);
    };
    document.addEventListener("click", function (event) {
      if (bypass) return;
      var button = event.target && event.target.closest ? event.target.closest("button") : null;
      if (!button || button.closest("[data-hesabno-return-confirm]")) return;
      var editedArticle = button.closest("article");
      if (clean(button.textContent) === "ویرایش" && editedArticle && editedArticle.id.indexOf("tx-card-") === 0) {
        var editedItems = [];
        try { editedItems = JSON.parse((window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions")) || "[]"); } catch (error) {}
        var editedId = editedArticle.id.slice("tx-card-".length);
        var replacement = editedItems.find(function (item) { return String(item && item.id) === editedId && item.isCheckReplacementPayment === true; });
        var original = replacement && editedItems.find(function (item) {
          return item && item.check && ((replacement.relatedCheckId != null && String(item.id) === String(replacement.relatedCheckId)) || String(item.documentNumber || item.id) === String(replacement.relatedCheckDocNumber));
        });
        if (replacement && original) {
          event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
          open(button, editedArticle, String(original.id), true, String(replacement.id));
          return;
        }
      }
      var nextPayment = button.closest("[data-hesabno-return-next]");
      if (nextPayment) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        if (typeof window.__hesabnoOpenCheckPayment === "function") window.__hesabnoOpenCheckPayment(nextPayment.getAttribute("data-hesabno-return-next"), nextPayment);
        return;
      }
      var text = clean(button.textContent), article = button.closest("article");
      var statusOption = text === "برگشت خورده" || text === "مسترد شده";
      var statusModal = button.closest("[class*='fixed'][class*='inset-0'], [role='dialog']");
      var statusFlow = statusOption && statusModal && clean(statusModal.textContent).includes("وضعیت چک");
      var editHeading = Array.from(document.querySelectorAll("h1, h2")).find(function (node) { return /^ویرایش\s/u.test(clean(node.textContent)); });
      var editStatus = statusOption && text === "مسترد شده" && !!editHeading;
      if (!(text === "برگشت زدن" && article) && !statusFlow && !editStatus) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
      var forcedId = "";
      if (editStatus) {
        var docMatch = clean(editHeading.textContent).match(/سند\s*#\s*([0-9۰-۹]+)/u);
        var docNumber = docMatch && Number(docMatch[1].replace(/[۰-۹]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(digit); }));
        try {
          var items = JSON.parse((window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions")) || "[]");
          var edited = items.find(function (item) { return Number(item.documentNumber || item.id) === docNumber; });
          forcedId = edited && String(edited.id) || "";
        } catch (error) {}
      }
      open(button, statusFlow ? statusModal : button.closest("form"), forcedId);
    }, true);
  })();
