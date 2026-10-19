(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var statusTerms = ["در جریان", "برگشتی", "برگشت خورده", "پاس‌شده", "پاس شده", "وصول‌شده", "وصول شده", "مسترد", "خوابیده در بانک"];
    var statusKeyFromText = function (value) {
      var text = clean(value);
      if (text.includes("برگشتی") || text.includes("برگشت خورده")) return "bounced";
      if (text.includes("مسترد")) return "refunded";
      if (text.includes("خوابیده در بانک") || text.includes("چک در بانک است")) return "bank-hold";
      if (text.includes("پاس‌شده") || text.includes("پاس شده") || text.includes("وصول‌شده") || text.includes("وصول شده") || text.includes("پاس شد")) return "passed";
      if (text.includes("در جریان")) return "in-progress";
      return "";
    };
    var statusLabel = function (key) {
      return ({ "in-progress": "در جریان", passed: "پاس‌شده", bounced: "برگشت خورده", refunded: "مسترد شده", "bank-hold": "خوابیده در بانک" })[key] || "نامشخص";
    };
    var digits = function (value) { return String(value || "").replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); }).replace(/[^0-9]/g, ""); };
    /* چیدمان و رنگ‌بندی کارت‌های چک در بستهٔ ۲۳۵ (لایهٔ ظاهر) قرار دارد. */
    var ensureStyles = function () {};
    var ensureInfo = function (grid, marker, label, value) {
      var box = grid.querySelector("[" + marker + "]");
      if (!box) {
        box = document.createElement("div");
        box.className = "bg-stone-900/60 border border-stone-700/40 rounded-xl p-2.5 flex items-center gap-2 truncate";
        box.setAttribute(marker, "true");
        box.setAttribute("data-hesabno-check-info-box", "true");
        var content = document.createElement("div");
        content.className = "min-w-0";
        var labelNode = document.createElement("span");
        labelNode.setAttribute("data-hesabno-check-info-label", "true");
        var valueNode = document.createElement("span");
        valueNode.setAttribute("data-hesabno-check-info-value", "true");
        content.append(labelNode, valueNode);
        box.appendChild(content);
      }
      var labelNode = box.querySelector("[data-hesabno-check-info-label]");
      var valueNode = box.querySelector("[data-hesabno-check-info-value]");
      if (labelNode && labelNode.textContent !== label) labelNode.textContent = label;
      if (valueNode && valueNode.textContent !== value) valueNode.textContent = value || "—";
      return box;
    };
    var resolutionAccountFor = function (checkNumber) {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions");
        var items = JSON.parse(raw || "[]");
        var wanted = digits(checkNumber);
        if (!wanted) return "";
        var match = Array.isArray(items) && items.find(function (item) { return item.check && digits(item.check.number) === wanted; });
        return clean(match && match.check && match.check.resolutionAccount);
      } catch (error) { return ""; }
    };
    var recordForCheckNumber = function (checkNumber) {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions");
        var items = JSON.parse(raw || "[]"), wanted = digits(checkNumber);
        return Array.isArray(items) && items.find(function (item) { return item && item.check && digits(item.check.number) === wanted; }) || null;
      } catch (error) { return null; }
    };
    var replacementPaymentsFor = function (original) {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions");
        var items = JSON.parse(raw || "[]"), doc = original && (original.documentNumber || original.id);
        return Array.isArray(items) ? items.filter(function (item) {
          return item && item.isCheckReplacementPayment === true &&
            (digits(item.relatedCheckDocNumber) === digits(doc) || digits(item.relatedCheckId) === digits(original.id));
        }) : [];
      } catch (error) { return []; }
    };
    var correctionFor = function (checkNumber) {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions");
        var items = JSON.parse(raw || "[]"), wanted = digits(checkNumber);
        var match = Array.isArray(items) && items.find(function (item) { return item.check && digits(item.check.number) === wanted; });
        if (!match || !match.check) return null;
        var canceled = match.type === "expense" && (match.check.status === "bounced" || match.check.status === "refunded");
        if (!canceled && match.check.returnedWithCorrection !== true) return null;
        var paidAmount = replacementPaymentsFor(match).reduce(function (sum, item) { return sum + (Number(item.amount) || 0); }, 0);
        return { date: clean(match.check.debtCanceledDate || match.check.correctionDate), description: clean(match.check.debtCanceledDescription || match.check.correctionDescription), canceled: canceled, debtCanceled: match.check.debtCanceled === true, paidAmount: paidAmount };
      } catch (error) { return null; }
    };
    var findCheckArticles = function () {
      return Array.from(document.querySelectorAll("article")).filter(function (article) {
        if (article.id && article.id.indexOf("tx-card-") === 0) return false;
        var text = clean(article.textContent);
        return text.includes("شماره چک:") || text.includes("تغییر وضعیت") || article.hasAttribute("data-hesabno-check-status-card");
      });
    };
    var layout = function (article) {
      var top = article.firstElementChild;
      if (!top) return;
      var meta = Array.from(top.querySelectorAll("p")).find(function (node) { return clean(node.textContent).includes("شماره چک:"); });
      var topAmount = Array.from(top.querySelectorAll("p")).find(function (node) { return /(?:ریال|تومان)/.test(clean(node.textContent)); });
      var storedAmount = article.getAttribute("data-hesabno-check-amount") || "";
      var storedNumber = article.getAttribute("data-hesabno-check-number") || "";
      if (!storedAmount && topAmount) storedAmount = clean(topAmount.textContent).replace(/^[−-]\s*/, "");
      if (!storedNumber && meta) storedNumber = clean(meta.textContent).replace(/^.*شماره چک:\s*/, "").split("·")[0].trim();
      if (storedAmount && article.getAttribute("data-hesabno-check-amount") !== storedAmount) article.setAttribute("data-hesabno-check-amount", storedAmount);
      if (storedNumber && article.getAttribute("data-hesabno-check-number") !== storedNumber) article.setAttribute("data-hesabno-check-number", storedNumber);
      var topStatus = Array.from(top.querySelectorAll("span")).find(function (node) {
        var text = clean(node.textContent);
        return statusTerms.some(function (term) { return text === term || text.includes(term); });
      });
      var key = statusKeyFromText(topStatus && topStatus.textContent) || statusKeyFromText(article.textContent) || article.getAttribute("data-hesabno-check-status-card") || "";
      if (topStatus) {
        topStatus.setAttribute("data-hesabno-check-top-status", "true");
        topStatus.style.display = "none";
      }
      if (meta) {
        meta.setAttribute("data-hesabno-check-top-meta", "true");
        meta.style.display = "none";
      }
      if (topAmount && topAmount.parentElement) {
        topAmount.parentElement.setAttribute("data-hesabno-check-top-amount", "true");
        topAmount.parentElement.style.display = "none";
      }
      var grid = Array.from(article.querySelectorAll("div.grid.grid-cols-2")).find(function (node) { return clean(node.textContent).includes("تاریخ سررسید") || clean(node.textContent).includes("حساب واسط"); });
      if (grid) {
        grid.setAttribute("data-hesabno-check-info-grid", "true");
        var existing = Array.from(grid.children);
        var due = existing.find(function (node) { return clean(node.textContent).includes("تاریخ سررسید"); });
        var account = existing.find(function (node) {
          var text = clean(node.textContent);
          return text.includes("حساب واسط") || text.includes("کسر شده از") || text.includes("واریز شده به");
        }) || existing.find(function (node) { return node !== due; });
        if (storedAmount && grid.getAttribute("data-hesabno-check-amount") !== storedAmount) grid.setAttribute("data-hesabno-check-amount", storedAmount);
        if (storedNumber && grid.getAttribute("data-hesabno-check-number") !== storedNumber) grid.setAttribute("data-hesabno-check-number", storedNumber);
        if (due) due.setAttribute("data-hesabno-check-info-due", "true");
        if (account) account.setAttribute("data-hesabno-check-info-account", "true");
        var amountBox = ensureInfo(grid, "data-hesabno-check-amount-box", "مبلغ چک", storedAmount);
        var numberBox = ensureInfo(grid, "data-hesabno-check-number-box", "شماره چک", storedNumber);
        if (amountBox) amountBox.setAttribute("data-hesabno-check-info-generated", "true");
        if (numberBox) numberBox.setAttribute("data-hesabno-check-info-generated", "true");
      }
       var resolutionAccount = resolutionAccountFor(storedNumber);
       var checkRecord = recordForCheckNumber(storedNumber);
       var replacementPayments = replacementPaymentsFor(checkRecord);
       var paidAmount = replacementPayments.reduce(function (sum, item) { return sum + (Number(item.amount) || 0); }, 0);
       var remainingAmount = checkRecord ? Math.max(0, Math.abs(Number(checkRecord.amount) || 0) - paidAmount) : 0;
       var currencyFactor = clean((window.__safeGet ? window.__safeGet("hesabno:currency") : localStorage.getItem("hesabno:currency")) || "rial").replace(/[\"']/g, "") === "toman" ? 10 : 1;
       var debtCanceled = !!(checkRecord && checkRecord.check && checkRecord.check.debtCanceled === true);
       var correction = correctionFor(storedNumber);
       if (resolutionAccount) key = "bounced";
      var resolutionNote = article.querySelector("[data-hesabno-check-resolution-account]");
       if (resolutionAccount || replacementPayments.length || debtCanceled) {
         if (!resolutionNote) {
           resolutionNote = document.createElement("div");
           resolutionNote.setAttribute("data-hesabno-check-resolution-account", "true");
           resolutionNote.className = "mt-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-2.5 py-1.5 text-[10px] font-bold text-sky-300 space-y-1";
         }
        var resolutionText = debtCanceled ? (paidAmount ? "ماندهٔ بدهی لغو شد؛ پرداخت واقعی ثبت‌شده: " + Math.round(paidAmount / currencyFactor).toLocaleString("fa-IR") + (currencyFactor === 10 ? " تومان" : " ریال") : "معامله لغو شد؛ چک در سابقهٔ برگشتی باقی است.") : resolutionAccount && !replacementPayments.length ? "حساب جایگزین قدیمی: " + resolutionAccount :
            "پرداخت جایگزین: " + Math.round(paidAmount / currencyFactor).toLocaleString("fa-IR") + " از " + Math.round(Math.abs(Number(checkRecord.amount) || 0) / currencyFactor).toLocaleString("fa-IR") + (currencyFactor === 10 ? " تومان" : " ریال") + " · مانده: " + Math.round(remainingAmount / currencyFactor).toLocaleString("fa-IR");
          var resolutionLabel = resolutionNote.querySelector("[data-hesabno-check-resolution-label]");
          if (!resolutionLabel) { resolutionLabel = document.createElement("div"); resolutionLabel.setAttribute("data-hesabno-check-resolution-label", "true"); resolutionNote.appendChild(resolutionLabel); }
          if (resolutionLabel.textContent !== resolutionText) resolutionLabel.textContent = resolutionText;
          var nextPayment = resolutionNote.querySelector("[data-hesabno-return-next]");
         if (checkRecord && !debtCanceled && !resolutionAccount && !checkRecord.check.returnedWithCorrection && !checkRecord.reversedByDocNumber && remainingAmount > 0 && /boun|return|برگشت|مسترد/i.test(String(checkRecord.check.status || ""))) {
            if (!nextPayment) { nextPayment = document.createElement("button"); nextPayment.type = "button"; nextPayment.setAttribute("data-hesabno-return-next", String(checkRecord.id)); nextPayment.className = "rounded-md border border-sky-400/30 px-2 py-1 text-[10px] font-bold text-sky-200"; nextPayment.textContent = "تسویه یا لغو مانده"; resolutionNote.appendChild(nextPayment); }
            if (nextPayment.getAttribute("data-hesabno-return-next") !== String(checkRecord.id)) nextPayment.setAttribute("data-hesabno-return-next", String(checkRecord.id));
          } else if (nextPayment) nextPayment.remove();
          if (grid && grid.nextElementSibling !== resolutionNote) grid.insertAdjacentElement("afterend", resolutionNote);
       } else if (resolutionNote) resolutionNote.remove();
       var correctionNote = article.querySelector("[data-hesabno-check-correction-note]");
       if (correction && correction.canceled) {
         if (!correctionNote) {
           correctionNote = document.createElement("div");
           correctionNote.setAttribute("data-hesabno-check-correction-note", "true");
           correctionNote.className = "mt-2 rounded-lg border border-rose-500/25 bg-rose-500/5 px-2.5 py-1.5 text-[10px] font-bold leading-5 text-rose-300";
         }
           var noteText = correction.debtCanceled ? (correction.paidAmount > 0 ? "ماندهٔ بدهی لغو شد" : "معامله لغو شد") : "چک برگشتی از جمع هزینه خارج شد";
          if (correction.date) noteText += " · " + (correction.debtCanceled ? "تاریخ لغو " : "اصلاحیهٔ قدیمی ") + correction.date;
          if (correction.description) noteText += " · " + correction.description;
         if (correctionNote.textContent !== noteText) correctionNote.textContent = noteText;
         if (grid && correctionNote.previousElementSibling !== grid) grid.insertAdjacentElement("afterend", correctionNote);
       } else if (correctionNote) correctionNote.remove();
       var footer = Array.from(article.children).find(function (node) { return node.querySelector && node.querySelector("button") && clean(node.textContent).includes("تغییر وضعیت"); });
      if (footer) {
        var statusArea = Array.from(footer.children).find(function (node) { return node.tagName !== "BUTTON"; });
        if (statusArea) {
          statusArea.setAttribute("data-hesabno-check-status-display", key || "unknown");
        }
      }
      if (article.getAttribute("data-hesabno-check-card-layout") !== "true") article.setAttribute("data-hesabno-check-card-layout", "true");
    };
    var sync = function () {
      ensureStyles();
      findCheckArticles().forEach(layout);
    };
    var pending = false;
    var schedule = function () {
      if (pending) return;
      pending = true;
      Promise.resolve().then(function () { pending = false; sync(); });
    };
    sync();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-hesabno-check-status-card"] });
  })();
