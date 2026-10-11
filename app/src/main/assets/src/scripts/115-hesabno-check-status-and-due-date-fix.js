(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    if (!document.querySelector("style[data-hesabno-check-due-style]")) {
      var style = document.createElement("style");
      style.setAttribute("data-hesabno-check-due-style", "true");
       style.textContent = ".hesabno-check-due-badge{font-size:10px!important;font-weight:700!important;padding:2px 6px!important;line-height:1.3!important;border-radius:7px;background:#fff5cf!important;border:1px solid #d7b45b!important;color:#8a5d0c!important;white-space:nowrap}.hesabno-check-status-corrected{font-weight:700!important}[data-hesabno-tx-status-source]{display:none!important}[data-hesabno-tx-status-meta][data-hesabno-tx-status]::after{content:attr(data-hesabno-tx-status);display:inline-flex;align-items:center;gap:4px;flex:0 0 auto;white-space:nowrap;padding:2px 6px;border-radius:5px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.35);color:#087f68;font-size:9px;font-weight:800}article[id^='tx-card-'] > div > div:first-child > div.grow > div[class~='gap-1.5'][class~='flex-wrap'] > span{display:none!important}";
      document.head.appendChild(style);
    }
    var fixDueDate = function () {
      document.querySelectorAll("#field-due-date").forEach(function (section) {
        var label = Array.from(section.querySelectorAll("label span")).find(function (node) { return clean(node.textContent).includes("تاریخ سررسید چک"); });
        if (label && label.textContent !== "تاریخ سررسید چک *") label.textContent = "تاریخ سررسید چک *";
        var badge = Array.from(section.querySelectorAll("span")).find(function (node) {
          var text = clean(node.textContent);
          return text.indexOf("سررسید:") === 0 || text === "انتخاب نشده";
        });
        if (badge) badge.classList.add("hesabno-check-due-badge");
      });
    };
    var fixStatus = function () {
      Array.from(document.querySelectorAll("span")).filter(function (node) { return clean(node.textContent) === "چک برگشت خورده است"; }).forEach(function (node) {
        var parent = node.parentElement, status = "";
        for (var level = 0; parent && level < 8; level += 1, parent = parent.parentElement) {
          var text = clean(parent.textContent);
          if (text.includes("در جریان")) { status = "در جریان"; break; }
          if (text.includes("خوابیده در بانک")) { status = "خوابیده در بانک"; break; }
          if (text.includes("مسترد شده")) { status = "مسترد شده"; break; }
        }
        if (!status) return;
        node.textContent = status === "در جریان" ? "چک در جریان است" : status === "خوابیده در بانک" ? "چک در بانک است" : "چک مسترد شده است";
        node.classList.add("hesabno-check-status-corrected");
      });
    };
    var moveStatusField = function () {
      var originalButton = document.querySelector("#field-check-status");
      if (!originalButton || !originalButton.parentElement) return;
      var originalField = originalButton.parentElement;
      originalField.style.display = "none";
      var moreButton = Array.from(document.querySelectorAll("button")).find(function (button) { return clean(button.textContent).includes("گزینه‌ها و امکانات بیشتر"); });
      var moreWrapper = moreButton && moreButton.parentElement;
      if (!moreWrapper) return;
      var advanced = Array.from(moreWrapper.children).find(function (child) {
        return child !== moreButton && child.nodeType === 1 && (child.classList.contains("animate-in") || clean(child.textContent).includes("انتساب به پروژه"));
      });
      if (!advanced) return;
      var copy = advanced.querySelector("[data-hesabno-check-status-copy]");
      if (!copy) {
        copy = originalField.cloneNode(true);
        copy.setAttribute("data-hesabno-check-status-copy", "true");
        advanced.insertBefore(copy, advanced.firstChild);
      } else if (clean(copy.textContent) !== clean(originalField.textContent)) {
        copy.innerHTML = originalField.innerHTML;
      }
      var copiedButton = copy.querySelector("#field-check-status");
      if (!copiedButton) return;
      copiedButton.removeAttribute("id");
      if (!copiedButton.dataset.hesabnoStatusBound) {
        copiedButton.dataset.hesabnoStatusBound = "true";
        copiedButton.addEventListener("click", function (event) { event.preventDefault(); originalButton.click(); });
      }
    };
      var rememberedTransactionStatus = {};
      var statusKeyFromText = function (value) {
        var text = clean(value);
        if (text.includes("برگشتی") || text.includes("برگشت خورده")) return "bounced";
        if (text.includes("مسترد")) return "refunded";
        if (text.includes("خوابیده در بانک") || text.includes("چک در بانک است")) return "bank-hold";
        if (text.includes("پاس‌شده") || text.includes("پاس شده") || text.includes("وصول‌شده") || text.includes("وصول شده")) return "passed";
        if (text.includes("در جریان")) return "in-progress";
        return "";
      };
      var statusLabelForKey = function (key) {
        return ({ "in-progress": "چک در جریان", passed: "چک پاس‌شده", bounced: "چک برگشتی", refunded: "چک مسترد", "bank-hold": "خوابیده در بانک" })[key] || "";
      };
      var statusClassForKey = function (key) {
        return ({
          "in-progress": "bg-amber-500/10 border-amber-500/30 text-amber-400",
          passed: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
          bounced: "bg-rose-500/10 border-rose-500/30 text-rose-400",
          refunded: "bg-purple-500/10 border-purple-500/30 text-purple-400",
          "bank-hold": "bg-sky-500/10 border-sky-500/30 text-sky-400"
        })[key] || "bg-stone-700/50 border-stone-600/50 text-stone-300";
      };
      var ensureTransactionMetaRow = function (article) {
        var shell = article.firstElementChild;
        if (!shell) return null;
        var anchor = shell.querySelector(".hesabno-tx-project-chip, .hesabno-tx-family-chip") || shell.querySelector("[data-hesabno-tx-status-badge]");
        var existing = shell.querySelector("[data-hesabno-tx-status-meta], [data-hesabno-tx-metadata-row]");
        var row = shell.querySelector("[data-hesabno-metadata-canonical='true']") || anchor && anchor.parentElement;
        if (row && existing && existing !== row) {
          existing.querySelectorAll("[data-hesabno-tx-status-badge], [data-hesabno-tx-settlement-display]").forEach(function (node) { row.appendChild(node); });
          if (!existing.children.length) existing.remove();
        }
        row = row || existing;
        if (row) return row;
        row = document.createElement("div");
        row.className = "flex items-center gap-1.5 mt-1.5 pt-1 border-t border-stone-700/30 w-full overflow-x-auto no-scrollbar py-0.5";
        row.setAttribute("data-hesabno-tx-metadata-row", "true");
       shell.appendChild(row);
       return row;
     };
      var moveTransactionCheckStatus = function () {
        var labels = ["چک در جریان", "چک برگشتی", "چک پاس‌شده", "چک وصول‌شده", "خوابیده در بانک", "چک مسترد"];
        document.querySelectorAll("article").forEach(function (article) {
          var statusText = Array.from(article.querySelectorAll("span:not([data-hesabno-tx-status-badge])")).find(function (node) {
            var text = clean(node.textContent);
            return labels.includes(text) && (node.childElementCount === 0 || node.querySelector("svg"));
          });
          var articleId = article.id && article.id.indexOf("tx-card-") === 0 ? article.id : "";
          var statusKey = statusKeyFromText(statusText && statusText.textContent);
          if (!statusKey && articleId) statusKey = statusKeyFromText(article.textContent);
          if (!statusKey && articleId) statusKey = rememberedTransactionStatus[articleId] || article.getAttribute("data-hesabno-tx-status-key") || "";
          if (!statusText && !statusKey) return;
          var statusChip = statusText ? (statusText.parentElement.tagName === "SPAN" ? statusText.parentElement : statusText) : article.querySelector("[data-hesabno-tx-status-badge]");
          if (!statusChip) {
            statusChip = document.createElement("span");
            statusChip.className = "inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 " + statusClassForKey(statusKey);
            statusChip.textContent = statusLabelForKey(statusKey);
          }
          var meta = ensureTransactionMetaRow(article);
          if (!meta) return;
          var oldBadge = article.querySelector("[data-hesabno-tx-status-badge]");
          if (oldBadge && oldBadge !== statusChip) oldBadge.remove();
          var status = clean(statusChip.textContent) || statusLabelForKey(statusKey);
          statusChip.removeAttribute("data-hesabno-tx-status-source");
           // Keep the native status-specific color classes.
          statusChip.setAttribute("data-hesabno-tx-status-badge", "true");
          meta.setAttribute("data-hesabno-tx-status-meta", "true");
          meta.setAttribute("data-hesabno-tx-status", statusKey || status);
          if (articleId && statusKey) {
            rememberedTransactionStatus[articleId] = statusKey;
            article.setAttribute("data-hesabno-tx-status-key", statusKey);
          }
          if (statusChip.parentElement !== meta) meta.appendChild(statusChip);
        });
      };
    var sync = function () {
      fixDueDate();
      moveStatusField();
       moveTransactionCheckStatus();
      var checksPage = Array.from(document.querySelectorAll("h1")).some(function (heading) { return clean(heading.textContent) === "مدیریت چک‌ها"; });
      if (checksPage) fixStatus();
    };
    var pending = false;
    var schedule = function () {
      if (pending) return;
      pending = true;
      window.setTimeout(function () { pending = false; sync(); }, 0);
    };
    sync();
      if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  })();
