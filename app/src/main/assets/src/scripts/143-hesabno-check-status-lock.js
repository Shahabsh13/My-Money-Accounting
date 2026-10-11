(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var latin = function (value) {
      return String(value || "").replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); })
        .replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); });
    };
    var read = function () {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions");
        var items = JSON.parse(raw || "[]");
        return Array.isArray(items) ? items : [];
      } catch (error) { return []; }
    };
    var write = function (items) {
      var raw = JSON.stringify(items);
      try { if (window.__safeSet) window.__safeSet("hesabno:transactions", raw); else localStorage.setItem("hesabno:transactions", raw); }
      catch (error) { return false; }
      return true;
    };
    var documentNumber = function (item) { return item && (item.documentNumber || item.id); };
    var sameReference = function (left, right) { return left != null && right != null && latin(left) === latin(right); };
    var linkedCheck = function (item, items) {
      if (!item || !item.check) return false;
       if (item.check.resolutionAccount || item.check.returnedWithCorrection === true || item.reversedByDocNumber) return true;
      var keys = [documentNumber(item), item.id].filter(function (value) { return value != null; });
      return items.some(function (candidate) {
        if (!candidate || candidate === item || String(candidate.id) === String(item.id)) return false;
        return Object.keys(candidate).some(function (key) {
          if (!/(?:reversal|refund|parent|source|related|linked|original|reference|attached|attachment|child|dependent)/i.test(key) || key === "documentNumber" || key === "id") return false;
          var value = candidate[key];
          if (!Array.isArray(value)) value = [value];
          return value.some(function (entry) {
            if (entry && typeof entry === "object") entry = entry.id || entry.documentNumber || entry.docNumber;
            return keys.some(function (ref) { return sameReference(entry, ref); });
          });
        });
      });
    };
    var linkedDocumentsFor = function (item, items) {
      var keys = [documentNumber(item), item && item.id].filter(function (value) { return value != null; });
      if (!keys.length) return [];
      return items.filter(function (candidate) {
        if (!candidate || candidate === item || String(candidate.id) === String(item.id)) return false;
        return Object.keys(candidate).some(function (key) {
          if (!/(?:reversal|refund|parent|source|related|linked|original|reference|attached|attachment|child|dependent)/i.test(key) || key === "documentNumber" || key === "id") return false;
          var value = candidate[key];
          if (!Array.isArray(value)) value = [value];
          return value.some(function (entry) {
            if (entry && typeof entry === "object") entry = entry.id || entry.documentNumber || entry.docNumber;
            return keys.some(function (ref) { return sameReference(entry, ref); });
          });
        });
      });
    };
    var linkedCorrection = function (item, items) {
      if (!item || item.reversalOfDocNumber == null) return false;
      return items.some(function (candidate) {
        return candidate && candidate.check && sameReference(documentNumber(candidate), item.reversalOfDocNumber);
      });
    };
    var attachmentLabel = function (item, items) {
      if (item.check && item.check.resolutionAccount) {
        return "پرداخت ثبت‌شده با حساب جایگزین «" + clean(item.check.resolutionAccount) + "» (بدون سند جداگانه)";
      }
      var documents = linkedDocumentsFor(item, items);
      if (!documents.length && item.reversedByDocNumber != null) {
        documents = items.filter(function (candidate) { return sameReference(documentNumber(candidate), item.reversedByDocNumber); });
      }
      if (documents.length) {
        var document = documents[0];
       var kind = document.isCheckReplacementPayment ? "پرداخت جایگزین" : document.isRefundReceipt || document.refundOfDocNumber != null ? "رسید برگشت وجه" :
          document.isReversal || document.reversalOfDocNumber != null ? "سند اصلاحی" : "سند پیوست";
        var number = documentNumber(document);
        var title = clean(document.title || document.category);
        return kind + " شماره #" + number + (title ? " «" + title + "»" : "");
      }
      return "سند اصلاحی پیوست به سند #" + documentNumber(item);
    };
    var notice = function (message) {
      var toast = document.querySelector("[data-hesabno-check-status-lock-toast]");
      if (!toast) {
        toast = document.createElement("div");
        toast.setAttribute("data-hesabno-check-status-lock-toast", "true");
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        toast.className = "fixed bottom-24 left-4 right-4 z-[120] mx-auto max-w-sm whitespace-pre-line rounded-xl border border-amber-500/30 bg-stone-900 px-4 py-3 text-center text-xs font-bold leading-6 text-amber-200 shadow-2xl";
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      clearTimeout(toast.__hesabnoTimer);
      toast.__hesabnoTimer = window.setTimeout(function () { toast.remove(); }, 3500);
    };
    var findItem = function (node, items) {
      var article = node && node.closest ? node.closest("article") : null;
      if (article && article.id.indexOf("tx-card-") === 0) {
        var id = article.id.slice("tx-card-".length);
        var byId = items.find(function (item) { return String(item && item.id) === id; });
        if (byId) return byId;
      }
      var number = article && article.getAttribute("data-hesabno-check-number");
      if (!number && article) {
        var line = Array.from(article.querySelectorAll("p")).find(function (p) { return clean(p.textContent).includes("شماره چک:"); });
        var match = line && clean(line.textContent).match(/شماره چک:\s*([0-9۰-۹٠-٩]+)/u);
        number = match && match[1];
      }
      if (number) {
        var byNumber = items.find(function (item) { return item && item.check && sameReference(item.check.number, number); });
        if (byNumber) return byNumber;
      }
      var heading = Array.from(document.querySelectorAll("h1, h2")).find(function (item) { return /^ویرایش\s/u.test(clean(item.textContent)); });
      var docMatch = heading && clean(heading.textContent).match(/سند\s*#\s*([0-9۰-۹٠-٩]+)/u);
      if (docMatch) return items.find(function (item) { return sameReference(documentNumber(item), docMatch[1]) && item.check; }) || null;
      return null;
    };
    var cancelAccount = function (id) {
      var items = read();
      var item = items.find(function (entry) { return String(entry && entry.id) === String(id); });
       if (!item || !item.check || !item.check.resolutionAccount) return;
       if (!window.confirm("ثبت پرداخت با حساب دیگر لغو شود؟ چک در وضعیت برگشت‌خورده می‌ماند و پس از لغو، تغییر وضعیت دوباره فعال می‌شود.")) return;
       if (typeof item.check.resolutionOriginalAccount === "string") item.account = item.check.resolutionOriginalAccount;
       var check = Object.assign({}, item.check, { status: item.check.resolutionOriginalStatus || "bounced" });
       delete check.resolutionAccount;
       delete check.linkedBank;
       delete check.returnedWithCorrection;
       delete check.resolutionOriginalAccount;
       delete check.resolutionOriginalStatus;
       item.check = check;
       if (!write(items)) { notice("لغو اتصال حساب انجام نشد."); return; }
       try { sessionStorage.setItem("hesabno:check-resolution-resume", "checks"); } catch (error) {}
       window.__hesabnoSoftReload();
     };
     window.__hesabnoCancelCheckResolutionAccount = cancelAccount;
    var lockLabel = function (item, items) {
      return "تغییر وضعیت این چک انجام نشد. پیوست: " + attachmentLabel(item, items) + ". ابتدا پیوست را لغو کنید.";
    };
    var statusButton = function (button) {
      var text = clean(button.textContent);
      return text === "تغییر وضعیت" || text.indexOf("تغییر وضعیت به ") === 0 || text === "برگشت چک" || text === "برگشت زدن" ||
        text === "برگشت خورده" || text === "مسترد شده" || text === "در جریان" ||
        text.indexOf("تایید پاس") === 0 || text.indexOf("تایید وصول") === 0 ||
        text.indexOf("پاس‌شدن چک و کسر از حساب") !== -1 || button.hasAttribute("data-hesabno-check-pass") ||
        button.hasAttribute("data-hesabno-check-resume");
    };
    var sync = function () {
      var items = read();
      document.querySelectorAll("article").forEach(function (article) {
        var item = findItem(article, items);
        if (!item) return;
        if (linkedCorrection(item, items)) {
          var correctionBanner = article.querySelector(":scope > [data-hesabno-linked-correction-banner]");
          if (correctionBanner) correctionBanner.remove();
          article.querySelectorAll("button").forEach(function (button) {
            var action = clean(button.textContent);
            if (action !== "ویرایش") return;
            if (!button.hasAttribute("data-hesabno-linked-correction-action")) {
              button.setAttribute("data-hesabno-linked-correction-action", "true");
              button.setAttribute("data-hesabno-linked-correction-original-title", button.getAttribute("title") || "");
            }
            button.disabled = true;
            button.title = "این سند اصلاحی به چک اصلی پیوست است؛ برای لغو آن از گزینهٔ «لغو اصلاحی» استفاده کنید.";
          });
          return;
        }
        if (!item.check) return;
        var locked = linkedCheck(item, items);
        article.toggleAttribute("data-hesabno-check-status-locked", locked);
        var banner = article.querySelector(":scope > [data-hesabno-check-status-lock-banner]");
        if (!locked) {
          if (banner) banner.remove();
          article.querySelectorAll("button[data-hesabno-check-status-lock-title]").forEach(function (button) {
            var oldTitle = button.getAttribute("data-hesabno-check-status-lock-title") || "";
            if (oldTitle) button.setAttribute("title", oldTitle); else button.removeAttribute("title");
            button.removeAttribute("data-hesabno-check-status-lock-title");
          });
          return;
        }
        if (item.check.resolutionAccount) {
          if (!banner) {
            banner = document.createElement("div");
            banner.setAttribute("data-hesabno-check-status-lock-banner", "true");
            banner.className = "mb-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] font-bold leading-5 text-amber-200";
            var message = document.createElement("span");
            message.setAttribute("data-hesabno-check-status-lock-message", "true");
            banner.appendChild(message);
            article.insertBefore(banner, article.firstChild);
          }
          var message = banner.querySelector("[data-hesabno-check-status-lock-message]");
          if (message && message.textContent !== lockLabel(item, items)) message.textContent = lockLabel(item, items);
          var cancel = banner.querySelector("[data-hesabno-check-resolution-cancel]");
          if (!cancel) {
            cancel = document.createElement("button");
            cancel.type = "button";
            cancel.setAttribute("data-hesabno-check-resolution-cancel", String(item.id));
            cancel.className = "mt-1 block rounded-lg border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-[10px] font-bold text-sky-200 hover:bg-sky-500/20";
            cancel.textContent = "لغو ثبت پرداخت با حساب دیگر";
            banner.appendChild(cancel);
          }
        } else if (banner) banner.remove();
        article.querySelectorAll("button").forEach(function (button) {
          if (button.hasAttribute("data-hesabno-check-resolution-cancel") || !statusButton(button)) return;
          if (!button.hasAttribute("data-hesabno-check-status-lock-title")) {
            button.setAttribute("data-hesabno-check-status-lock-title", button.getAttribute("title") || "");
          }
          button.title = lockLabel(item, items);
        });
      });
    };
    var pending = false;
    var schedule = function () {
      if (pending) return;
      pending = true;
      window.setTimeout(function () { pending = false; sync(); }, 0);
    };
    document.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("button") : null;
      if (!button) return;
      if (button.hasAttribute("data-hesabno-check-resolution-cancel")) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        cancelAccount(button.getAttribute("data-hesabno-check-resolution-cancel"));
        return;
      }
      var items = read(), item = findItem(button, items), text = clean(button.textContent);
      var statusModal = button.closest("[role='dialog'], [class*='fixed'][class*='inset-0']");
      if (item && linkedCorrection(item, items) && text === "ویرایش") {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        notice("این سند اصلاحی به چک اصلی پیوست است و ویرایش مستقیم آن ممکن نیست. برای بازگرداندن وضعیت قبلی، گزینهٔ «لغو اصلاحی» را انتخاب کنید.");
        return;
      }
      if (!item && statusModal && window.__hesabnoPendingCheckStatusId) {
        item = items.find(function (entry) { return String(entry && entry.id) === String(window.__hesabnoPendingCheckStatusId); });
      }
      if (item && linkedCheck(item, items) && statusButton(button)) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        notice(lockLabel(item, items));
        return;
      }
      if (item && item.check && item.check.debtCanceled === true && statusButton(button) && /(?:در جریان|in progress)/i.test(text)) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        if (statusModal && !window.confirm("با بازگرداندن چک به وضعیت «در جریان»، لغو معامله هم برمی‌گردد و مبلغ دوباره در جمع روزانه حساب می‌شود. ادامه می‌دهید؟")) return;
        var updatedItems = read();
        var target = updatedItems.find(function (entry) { return String(entry && entry.id) === String(item.id); });
        if (!target || !target.check || target.check.debtCanceled !== true) { notice("وضعیت چک تغییر نکرد؛ اطلاعات آن به‌روز نیست."); return; }
        var restoredCheck = Object.assign({}, target.check, { status: "in_progress" });
        delete restoredCheck.debtCanceled;
        delete restoredCheck.debtCanceledDate;
        delete restoredCheck.debtCanceledDescription;
        target.check = restoredCheck;
        target.account = target.type === "income" ? "اسناد دریافتنی" : "اسناد پرداختنی";
        if (!write(updatedItems)) { notice("بازگرداندن چک به جریان انجام نشد."); return; }
        try { sessionStorage.setItem("hesabno:check-resolution-resume", "checks"); } catch (error) {}
        window.__hesabnoSoftReload();
        return;
      }
      if (text === "تغییر وضعیت" && item) window.__hesabnoPendingCheckStatusId = String(item.id);
    }, true);
    var originalResolve = window.__hesabnoResolveReturnedCheck;
    if (typeof originalResolve === "function" && !originalResolve.__hesabnoStatusLockWrapped) {
      var guardedResolve = function (id, action) {
        var items = read(), item = items.find(function (entry) { return String(entry && entry.id) === String(id); });
        if (item && linkedCheck(item, items) && action !== "account" && action !== "cancelDebt") { notice(lockLabel(item, items)); return false; }
        return originalResolve.apply(this, arguments);
      };
      guardedResolve.__hesabnoStatusLockWrapped = true;
      window.__hesabnoResolveReturnedCheck = guardedResolve;
    }
    sync();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("storage", schedule);
  })();
