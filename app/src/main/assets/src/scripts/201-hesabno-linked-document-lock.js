(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var latin = function (value) { return String(value || "").replace(/[۰-۹]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(digit); }).replace(/[٠-٩]/g, function (digit) { return "٠١٢٣٤٥٦٧٨٩".indexOf(digit); }); };
    var read = function () {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions");
        var items = JSON.parse(raw || "[]");
        return Array.isArray(items) ? items : [];
      } catch (error) { return []; }
    };
    var write = function (items) {
      try {
        var raw = JSON.stringify(items);
        if (window.__safeSet) window.__safeSet("hesabno:transactions", raw); else localStorage.setItem("hesabno:transactions", raw);
        return true;
      } catch (error) { return false; }
    };
    var documentNumber = function (item) { return item && (item.documentNumber || item.id); };
    var sameReference = function (left, right) { return latin(left).trim() === latin(right).trim(); };
    var refKey = /(?:reversal|refund|parent|source|related|linked|original|reference|attached|attachment|child|dependent).*(?:doc|document|transaction|number|id)|(?:doc|document|transaction).*(?:reversal|refund|parent|source|related|linked|original|reference|attached|attachment|child|dependent)/i;
    var values = function (value) {
      if (Array.isArray(value)) return value.reduce(function (all, item) { return all.concat(values(item)); }, []);
      if (value && typeof value === "object") return [value.id, value.documentNumber, value.docNumber].filter(function (item) { return item != null; });
      return value == null ? [] : [value];
    };
    var linkedDocuments = function (source, items) {
      var keys = [documentNumber(source), source && source.id].filter(function (value) { return value != null; });
      if (!keys.length) return [];
      return items.filter(function (candidate) {
        if (!candidate || candidate === source || String(candidate.id) === String(source.id)) return false;
        return Object.keys(candidate).some(function (key) {
          if (!refKey.test(key) || key === "documentNumber" || key === "id") return false;
          return values(candidate[key]).some(function (value) { return keys.some(function (key) { return sameReference(value, key); }); });
        });
      });
    };
    var parentsFor = function (child, items) {
      return items.filter(function (parent) {
        if (!parent || parent === child || String(parent.id) === String(child.id)) return false;
        var parentKeys = [documentNumber(parent), parent.id].filter(function (value) { return value != null; });
        return Object.keys(child).some(function (key) {
          if (!refKey.test(key) || key === "documentNumber" || key === "id") return false;
          return values(child[key]).some(function (value) { return parentKeys.some(function (key) { return sameReference(value, key); }); });
        });
      });
    };
    var cancelLabel = function (item) {
      if (item && (item.isRefundReceipt || item.refundOfDocNumber != null)) return "لغو برگشت وجه";
      if (item && (item.isReversal || item.reversalOfDocNumber != null)) return "لغو اصلاحی";
      return "لغو سند پیوست";
    };
    var linkedLabel = function (item) {
      if (item && item.isCheckReplacementPayment) return "پرداخت جایگزین";
      if (item && (item.isRefundReceipt || item.refundOfDocNumber != null)) return "برگشت وجه";
      if (item && (item.isReversal || item.reversalOfDocNumber != null)) return "سند اصلاحی";
      return "سند مرتبط";
    };
    var actionLabel = function (button) {
      return button.querySelector("span:last-child") || button.lastElementChild || button;
    };
    var setCancelAction = function (button, item, dependent) {
      if (!button) return;
      if (dependent) {
        if (!button.hasAttribute("data-hesabno-linked-cancel-original-text")) {
          button.setAttribute("data-hesabno-linked-cancel-original-text", clean(button.textContent));
          button.setAttribute("data-hesabno-linked-cancel-original-title", button.getAttribute("title") || "");
        }
        button.setAttribute("data-hesabno-linked-cancel-action", "true");
        var label = actionLabel(button), next = cancelLabel(item);
        if (clean(label.textContent) !== next) label.textContent = next;
        button.title = next + "؛ با تأیید، این سند از سوابق مالی برداشته می‌شود.";
      } else if (button.hasAttribute("data-hesabno-linked-cancel-action")) {
        var originalText = button.getAttribute("data-hesabno-linked-cancel-original-text");
        var originalTitle = button.getAttribute("data-hesabno-linked-cancel-original-title");
        var currentLabel = actionLabel(button);
        if (clean(currentLabel.textContent) !== originalText) currentLabel.textContent = originalText;
        if (originalTitle) button.setAttribute("title", originalTitle); else button.removeAttribute("title");
        button.removeAttribute("data-hesabno-linked-cancel-action");
        button.removeAttribute("data-hesabno-linked-cancel-original-text");
        button.removeAttribute("data-hesabno-linked-cancel-original-title");
      }
    };
    var setCorrectionHidden = function (button, hidden) {
      if (!button) return;
      if (hidden) {
        if (!button.hasAttribute("data-hesabno-dependent-original-display")) button.setAttribute("data-hesabno-dependent-original-display", button.style.display || "");
        if (!button.hasAttribute("data-hesabno-dependent-original-tabindex")) button.setAttribute("data-hesabno-dependent-original-tabindex", button.getAttribute("tabindex") || "");
        button.setAttribute("data-hesabno-dependent-no-correction", "true");
        button.setAttribute("aria-hidden", "true");
        button.setAttribute("tabindex", "-1");
        button.style.display = "none";
      } else if (button.hasAttribute("data-hesabno-dependent-no-correction")) {
        var display = button.getAttribute("data-hesabno-dependent-original-display");
        var tabindex = button.getAttribute("data-hesabno-dependent-original-tabindex");
        if (display) button.style.display = display; else button.style.removeProperty("display");
        if (tabindex) button.setAttribute("tabindex", tabindex); else button.removeAttribute("tabindex");
        button.removeAttribute("aria-hidden");
        button.removeAttribute("data-hesabno-dependent-no-correction");
        button.removeAttribute("data-hesabno-dependent-original-display");
        button.removeAttribute("data-hesabno-dependent-original-tabindex");
      }
    };
    var removeNotice = function () {
      var current = document.querySelector("[data-hesabno-linked-document-notice]");
      if (current) current.remove();
    };
    var showNotice = function (source, linked, resolutionAccount) {
       removeNotice();
       var overlay = document.createElement("div");
       overlay.setAttribute("data-hesabno-linked-document-notice", "true");
       overlay.setAttribute("role", "dialog");
       overlay.setAttribute("aria-modal", "true");
       overlay.className = "fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm";
      overlay.style.setProperty("z-index", "2147483600", "important");
      overlay.style.setProperty("isolation", "isolate", "important");
       var panel = document.createElement("div");
       panel.className = "w-full max-w-sm space-y-4 rounded-2xl border border-amber-500/30 bg-stone-900 p-5 text-right shadow-2xl";
       var title = document.createElement("h2");
       title.className = "font-black text-sm text-amber-200";
       title.textContent = resolutionAccount ? "این سند پرداخت جایگزین دارد" : "این سند، سند پیوست دارد";
       var message = document.createElement("p");
       message.className = "text-xs leading-6 text-stone-300";
       message.textContent = resolutionAccount
         ? "تا وقتی تسویه با حساب جایگزین برقرار است، ویرایش یا حذف سند اصلی ممکن نیست. ابتدا پیوند حساب جایگزین را لغو کنید."
         : "تا وقتی سندهای مرتبط به سند اصلی پیوست هستند، ویرایش یا حذف سند اصلی ممکن نیست. ابتدا سندهای پیوست را لغو کنید.";
       var list = document.createElement("div");
       list.className = "space-y-1 rounded-xl border border-stone-700 bg-stone-950/70 p-3 text-xs text-stone-300";
       linked.slice(0, 5).forEach(function (item) {
         var row = document.createElement("div");
         row.textContent = linkedLabel(item) + " #" + (documentNumber(item) || "—");
         list.appendChild(row);
       });
       if (resolutionAccount) {
         var accountRow = document.createElement("div");
         accountRow.textContent = "تسویه از حساب «" + clean(resolutionAccount) + "»";
         list.appendChild(accountRow);
       }
      if (linked.length > 5) {
        var more = document.createElement("div");
        more.className = "text-stone-500";
        more.textContent = "و " + (linked.length - 5) + " سند مرتبط دیگر";
        list.appendChild(more);
      }
       var close = document.createElement("button");
       close.type = "button";
       close.className = "w-full rounded-xl bg-stone-700 px-4 py-2.5 text-xs font-bold text-stone-100 hover:bg-stone-600";
       close.textContent = "متوجه شدم";
       close.addEventListener("click", removeNotice);
      overlay.addEventListener("click", function (event) { if (event.target === overlay) removeNotice(); });
      panel.appendChild(title);
       panel.appendChild(message);
       panel.appendChild(list);
       if (resolutionAccount) {
         var cancelResolution = document.createElement("button");
         cancelResolution.type = "button";
         cancelResolution.className = "w-full rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2.5 text-xs font-bold text-sky-200 hover:bg-sky-500/20";
         cancelResolution.textContent = "لغو پیوند حساب جایگزین";
         cancelResolution.addEventListener("click", function () {
           removeNotice();
           if (typeof window.__hesabnoCancelCheckResolutionAccount === "function") window.__hesabnoCancelCheckResolutionAccount(source.id);
         });
         panel.appendChild(cancelResolution);
       }
       panel.appendChild(close);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      close.focus();
    };
    var cancelLinkedDocument = function (id) {
      var items = read();
      var child = items.find(function (item) { return String(item && item.id) === String(id); });
      if (!child) return false;
      var parents = parentsFor(child, items);
      if (!parents.length || linkedDocuments(child, items).length) return false;
      var childDoc = documentNumber(child);
      var remaining = items.filter(function (item) { return String(item && item.id) !== String(child.id); });
      parents.forEach(function (parent) {
        var parentDoc = documentNumber(parent);
        if (sameReference(parent.reversedByDocNumber, childDoc)) delete parent.reversedByDocNumber;
        if (child.isRefundReceipt || child.refundOfDocNumber != null) {
          var hadRefundState = parent.refundAmount != null || parent.refundStatus != null;
          var receipts = remaining.filter(function (item) {
            return item && (item.isRefundReceipt || item.refundOfDocNumber != null) && parentsFor(item, remaining).some(function (candidate) { return String(candidate.id) === String(parent.id); });
          });
          var refunded = receipts.reduce(function (sum, receipt) { return sum + (Number(receipt.amount) || 0); }, 0);
          if (refunded > 0) {
            parent.refundAmount = refunded;
            parent.refundStatus = refunded >= (Number(parent.amount) || 0) ? "refunded" : "partial";
            if (parent.refundStatus === "refunded") {
              var latest = receipts.reduce(function (current, receipt) {
                return Number(latin(documentNumber(receipt)).replace(/[^0-9]/g, "")) > Number(latin(documentNumber(current)).replace(/[^0-9]/g, "")) ? receipt : current;
              }, receipts[0]);
              parent.reversedByDocNumber = documentNumber(latest);
            } else if (hadRefundState || receipts.some(function (receipt) { return sameReference(parent.reversedByDocNumber, documentNumber(receipt)); })) delete parent.reversedByDocNumber;
          } else {
            delete parent.refundAmount;
            delete parent.refundStatus;
            if (hadRefundState || sameReference(parent.reversedByDocNumber, childDoc)) delete parent.reversedByDocNumber;
          }
        }
        var checkStatus = String(parent.check && parent.check.status || "").toLowerCase();
        var canRestoreCheck = parent.check && !parent.check.resolutionAccount &&
          (checkStatus === "bounced" || checkStatus === "refunded" || parent.check.debtCanceled === true || parent.check.returnedWithCorrection === true) &&
          linkedDocuments(parent, remaining).length === 0;
        if (canRestoreCheck) {
          var restoredCheck = Object.assign({}, parent.check, { status: "in_progress" });
          delete restoredCheck.debtCanceled;
          delete restoredCheck.debtCanceledDate;
          delete restoredCheck.debtCanceledDescription;
          delete restoredCheck.returnedWithCorrection;
          delete restoredCheck.correctionDate;
          delete restoredCheck.correctionDescription;
          parent.check = restoredCheck;
          parent.account = parent.type === "income" ? "اسناد دریافتنی" : "اسناد پرداختنی";
        }
      });
      if (!write(remaining)) return false;
      try { sessionStorage.setItem("hesabno:linked-cancel-resume", "transactions"); } catch (error) {}
      return true;
    };
    var showCancelDialog = function (child, parents) {
      document.querySelectorAll("[data-hesabno-linked-cancel-confirm]").forEach(function (node) { node.remove(); });
      var label = cancelLabel(child);
      var remainingAfterCancel = read().filter(function (item) { return String(item && item.id) !== String(child.id); });
      var restoresCheck = parents.some(function (parent) {
        var status = String(parent.check && parent.check.status || "").toLowerCase();
        return parent.check && !parent.check.resolutionAccount &&
          (status === "bounced" || status === "refunded" || parent.check.debtCanceled === true || parent.check.returnedWithCorrection === true) &&
          linkedDocuments(parent, remainingAfterCancel).length === 0;
      });
      var overlay = document.createElement("div");
      overlay.setAttribute("data-hesabno-linked-cancel-confirm", "true");
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      var lightTheme = document.documentElement.getAttribute("data-theme") === "light";
      overlay.className = "fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm";
      overlay.style.setProperty("z-index", "2147483600", "important");
      overlay.style.setProperty("isolation", "isolate", "important");
      overlay.style.setProperty("background-color", lightTheme ? "rgba(15, 23, 42, .52)" : "rgba(15, 23, 42, .72)", "important");
      overlay.style.setProperty("backdrop-filter", "blur(8px)", "important");
      var panel = document.createElement("div");
      panel.className = "w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto space-y-4 rounded-2xl border border-rose-500/30 bg-stone-900 p-5 text-right shadow-2xl";
      panel.style.setProperty("background-color", lightTheme ? "#f8fbfd" : "#1c1917", "important");
      panel.style.setProperty("border-color", lightTheme ? "#e2b4ba" : "rgba(244, 63, 94, .45)", "important");
      panel.style.setProperty("color", lightTheme ? "#26343e" : "#f5f5f4", "important");
      var title = document.createElement("h2");
      title.className = "font-black text-sm text-rose-200";
      title.style.setProperty("color", lightTheme ? "#b23a4b" : "#fecdd3", "important");
      title.textContent = label + "؟";
      var description = document.createElement("p");
      description.className = "text-xs leading-6 text-stone-300";
      description.style.setProperty("color", lightTheme ? "#526675" : "#d6d3d1", "important");
      var baseDescription = child.isRefundReceipt || child.refundOfDocNumber != null
        ? "این رسید برگشت وجه از سوابق مالی برداشته می‌شود و جمع مبالغ برگشتی دوباره محاسبه خواهد شد."
        : child.isReversal || child.reversalOfDocNumber != null
          ? "اثر مالی سند اصلاحی برداشته می‌شود و سند اصلی دوباره به وضعیت قابل ویرایش و حذف برمی‌گردد."
          : "این سند پیوست از سوابق مالی برداشته می‌شود و ارتباط آن با سند اصلی پایان می‌یابد.";
      description.textContent = restoresCheck
        ? baseDescription + " وضعیت چک اصلی هم به «در جریان» برمی‌گردد و مبلغ آن دوباره در جمع هزینه‌ها محاسبه می‌شود."
        : baseDescription;
      var reference = document.createElement("div");
      reference.className = "rounded-xl border border-stone-700 bg-stone-950/70 p-3 text-xs text-stone-300";
      reference.style.setProperty("background-color", lightTheme ? "#edf2f5" : "#0c0a09", "important");
      reference.style.setProperty("border-color", lightTheme ? "#c8d5de" : "#57534e", "important");
      reference.style.setProperty("color", lightTheme ? "#334155" : "#e7e5e4", "important");
      reference.textContent = "سند #" + (documentNumber(child) || "—") + " · مبلغ " + (Number(child.amount) || 0).toLocaleString("fa-IR") + " ریال · پیوست به " + parents.map(function (parent) { return "#" + (documentNumber(parent) || "—"); }).join("، ");
      var error = document.createElement("p");
      error.className = "hidden text-xs text-rose-300";
      error.style.setProperty("color", lightTheme ? "#b23a4b" : "#fda4af", "important");
      var actions = document.createElement("div");
      actions.className = "flex gap-2";
      var confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className = "grow rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500";
      if (lightTheme) confirm.style.setProperty("background-color", "#c75c6c", "important");
      confirm.textContent = "تأیید " + label;
      var close = document.createElement("button");
      close.type = "button";
      close.className = "rounded-xl bg-stone-700 px-4 py-2.5 text-xs font-bold text-stone-200 hover:bg-stone-600";
      close.style.setProperty("background-color", lightTheme ? "#e1e8ed" : "#44403c", "important");
      close.style.setProperty("color", lightTheme ? "#334155" : "#f5f5f4", "important");
      close.textContent = "انصراف";
      close.addEventListener("click", function () { overlay.remove(); });
      overlay.addEventListener("click", function (event) { if (event.target === overlay) overlay.remove(); });
      confirm.addEventListener("click", function () {
        if (cancelLinkedDocument(child.id)) window.__hesabnoSoftReload();
        else {
          error.textContent = "لغو انجام نشد؛ ابتدا اسناد وابسته به این سند را لغو کنید.";
          error.classList.remove("hidden");
        }
      });
      actions.appendChild(confirm);
      actions.appendChild(close);
      panel.appendChild(title);
      panel.appendChild(description);
      panel.appendChild(reference);
      panel.appendChild(error);
      panel.appendChild(actions);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      confirm.focus();
    };
    var setLocked = function (button, locked) {
      if (!button) return;
      if (locked) {
        if (!button.hasAttribute("data-hesabno-linked-original-title")) button.setAttribute("data-hesabno-linked-original-title", button.getAttribute("title") || "");
        button.setAttribute("data-hesabno-linked-lock-action", "true");
        button.setAttribute("aria-disabled", "true");
        button.title = "این سند پیوند مالی فعال دارد؛ ابتدا پیوند حساب یا سند را لغو کنید.";
        button.style.opacity = "0.5";
        button.style.cursor = "not-allowed";
      } else if (button.hasAttribute("data-hesabno-linked-lock-action")) {
        var title = button.getAttribute("data-hesabno-linked-original-title");
        if (title) button.setAttribute("title", title); else button.removeAttribute("title");
        button.removeAttribute("aria-disabled");
        button.removeAttribute("data-hesabno-linked-lock-action");
        button.removeAttribute("data-hesabno-linked-original-title");
        button.style.removeProperty("opacity");
        button.style.removeProperty("cursor");
      }
    };
    var sync = function () {
      var items = read();
      document.querySelectorAll("article[id^='tx-card-']").forEach(function (article) {
         var id = article.id.slice("tx-card-".length);
         var source = items.find(function (item) { return String(item && item.id) === id; });
         if (!source) return;
         var linked = linkedDocuments(source, items);
         var parents = parentsFor(source, items);
         var resolutionAccount = source.check && source.check.resolutionAccount;
         if (resolutionAccount) {
           var checkStatusLabel = Array.from(article.querySelectorAll("span")).find(function (span) {
             return /^(?:پاس‌شده \(کسر از حساب\)|وصول‌شده \(واریز به حساب\))$/.test(clean(span.textContent));
           });
           if (checkStatusLabel) {
             checkStatusLabel.textContent = "چک برگشتی، تسویه با حساب جایگزین";
             checkStatusLabel.classList.remove("bg-emerald-500/10", "border-emerald-500/30", "text-emerald-400");
             checkStatusLabel.classList.add("bg-rose-500/10", "border-rose-500/30", "text-rose-400");
           }
         }
         article.setAttribute("data-hesabno-linked-document-count", String(linked.length));
         article.setAttribute("data-hesabno-dependent-document", parents.length ? "true" : "false");
         article.toggleAttribute("data-hesabno-linked-account-locked", !!resolutionAccount);
        var buttons = Array.from(article.querySelectorAll("button"));
        var editAction = buttons.find(function (button) { return clean(button.textContent) === "ویرایش"; });
        var deleteAction = buttons.find(function (button) { return clean(button.textContent) === "حذف" || button.hasAttribute("data-hesabno-linked-cancel-action"); });
        var correctionAction = buttons.find(function (button) {
          var label = clean(button.textContent);
          return label === "اصلاحی" || label.indexOf("اصلاحی / برگشت وجه") !== -1 || button.hasAttribute("data-hesabno-payment-refund-action") || button.title === "ثبت سند اصلاحی برای این سند";
         });
         setCancelAction(deleteAction, source, parents.length > 0);
         setCorrectionHidden(correctionAction, parents.length > 0 || !!resolutionAccount);
         setLocked(editAction, linked.length > 0 || !!resolutionAccount);
         setLocked(deleteAction, linked.length > 0 || !!resolutionAccount);
       });
     };
     document.addEventListener("click", function (event) {
      var homeEdit = event.target && event.target.closest ? event.target.closest('[title="برای ویرایش سند کلیک کنید"]') : null;
      if (homeEdit) {
        var homeItems = read();
        var homeMatch = clean(homeEdit.textContent).match(/#\s*([0-9۰-۹٠-٩]+)/u);
         var homeNumber = homeMatch && latin(homeMatch[1]);
         var homeSource = homeItems.find(function (item) { return homeNumber && String(documentNumber(item)) === homeNumber; });
         var homeLinked = homeSource && linkedDocuments(homeSource, homeItems);
         var homeResolution = homeSource && homeSource.check && homeSource.check.resolutionAccount;
         if ((homeLinked && homeLinked.length) || homeResolution) {
           event.preventDefault();
           event.stopPropagation();
           event.stopImmediatePropagation();
           showNotice(homeSource, homeLinked || [], homeResolution);
           return;
         }
      }
      var button = event.target && event.target.closest ? event.target.closest("button") : null;
      if (!button || button.closest("[data-hesabno-linked-document-notice]")) return;
      var items = read(), source = null;
      var article = button.closest("article[id^='tx-card-']");
      var label = clean(button.textContent);
      if (article && button.hasAttribute("data-hesabno-linked-cancel-action")) {
        var childId = article.id.slice("tx-card-".length);
        source = items.find(function (item) { return String(item && item.id) === childId; });
        var parents = source ? parentsFor(source, items) : [];
        if (source && parents.length) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          var childLinks = linkedDocuments(source, items);
          if (childLinks.length) showNotice(source, childLinks);
          else showCancelDialog(source, parents);
          return;
        }
        if (source) setCancelAction(button, source, false);
      }
      if (article && (label === "ویرایش" || label === "حذف")) {
        var id = article.id.slice("tx-card-".length);
        source = items.find(function (item) { return String(item && item.id) === id; });
      } else if (label === "بله، حذف شود") {
        var context = button.closest("[role='dialog'], [class*='fixed'][class*='inset-0']") || document;
        var match = clean(context.textContent).match(/حذف سند شماره\s*#\s*([0-9۰-۹٠-٩]+)/u);
        var target = match && latin(match[1]);
        source = items.find(function (item) { return target && String(documentNumber(item)) === target; });
       }
       if (!source) return;
       var linked = linkedDocuments(source, items);
       var resolutionAccount = source.check && source.check.resolutionAccount;
       if (!linked.length && !resolutionAccount) return;
       event.preventDefault();
       event.stopPropagation();
       event.stopImmediatePropagation();
       showNotice(source, linked, resolutionAccount);
    }, true);
    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      window.setTimeout(function () { scheduled = false; sync(); }, 0);
    };
    sync();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
    window.addEventListener("storage", schedule);
    var resume = "";
    try { resume = sessionStorage.getItem("hesabno:linked-cancel-resume") || ""; sessionStorage.removeItem("hesabno:linked-cancel-resume"); } catch (error) {}
    if (resume === "transactions") window.setTimeout(function () {
      var tab = Array.from(document.querySelectorAll("button")).find(function (button) { return clean(button.textContent) === "تراکنش‌ها"; });
      if (tab) tab.click();
    }, 900);
  })();
