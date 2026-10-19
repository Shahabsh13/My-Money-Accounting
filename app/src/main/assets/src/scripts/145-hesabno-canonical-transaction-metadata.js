(function () {
    var transactionKey = "hesabno:transactions";
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var readTransactions = function () {
      try {
        var items = JSON.parse(localStorage.getItem(transactionKey) || "[]");
        return Array.isArray(items) ? items : [];
      } catch (error) { return []; }
    };
    var statusValue = function (value) {
      var text = clean(value);
      var mapped = {
        in_progress: "در جریان", "in-progress": "در جریان", received: "در جریان", issued: "در جریان", pending: "در جریان", active: "در جریان",
        passed: "پاس‌شده", paid: "پاس‌شده", cleared: "پاس‌شده",
        bounced: "برگشتی", returned: "برگشتی", refunded: "مسترد",
        in_bank: "خوابیده در بانک", "in-bank": "خوابیده در بانک", "bank-hold": "خوابیده در بانک", bank_hold: "خوابیده در بانک", deposited: "خوابیده در بانک"
      };
      if (mapped[text.toLowerCase()]) return mapped[text.toLowerCase()];
      return text.replace(/^(?:وضعیت\s*چک|چک)\s*[:：]?\s*/, "");
    };
    var statusFromItem = function (item) {
      var check = item && item.check;
      if (check && check.resolutionAccount) return "برگشت‌خورده، تسویه با حساب جایگزین";
      return check && statusValue(check.status || check.state || check.checkStatus);
    };
    var setAttr = function (el, name, val) {
      if (el && el.getAttribute(name) !== val) el.setAttribute(name, val);
    };
    var rmAttr = function (el, name) {
      if (el && el.hasAttribute(name)) el.removeAttribute(name);
    };
    /* ظاهر ردیف متادیتا، برچسب‌های پروژه/خانواده، جداکننده و نشان سند مرکب در بستهٔ ۲۳۵ است. */
    var ensureRow = function (article) {
      var shell = article.firstElementChild;
      var nativeSource = shell && shell.querySelector(".hesabno-tx-project-chip, .hesabno-tx-family-chip, :is(button, span)[data-hesabno-footnote-kind]");
      var nativeRow = nativeSource && nativeSource.parentElement;
      var existingRows = Array.from(article.querySelectorAll("[data-hesabno-metadata-canonical='true'], [data-hesabno-tx-status-meta], [data-hesabno-tx-metadata-row]"));
      var row = nativeRow || existingRows[0] || null;
      if (!row) {
        if (!shell) return null;
        row = document.createElement("div");
        row.className = "flex items-center gap-1.5 mt-1.5 pt-1 border-t border-stone-700/30 w-full overflow-x-auto no-scrollbar py-0.5";
        shell.appendChild(row);
      }
      existingRows.forEach(function (other) {
        if (other === row) return;
        Array.from(other.children).forEach(function (child) {
          if (child.hasAttribute("data-hesabno-metadata-canonical-item") ||
              child.hasAttribute("data-hesabno-tx-status-badge") ||
              child.hasAttribute("data-hesabno-compound-badge") ||
              child.hasAttribute("data-hesabno-check-correction-link") ||
              child.hasAttribute("data-hesabno-returned-effect") ||
              child.hasAttribute("data-hesabno-returned-correction") ||
              child.hasAttribute("data-hesabno-check-replacement-link")) {
            row.appendChild(child);
          }
        });
        if (!other.querySelector(".hesabno-tx-project-chip, .hesabno-tx-family-chip, :is(button, span)[data-hesabno-footnote-kind]")) {
          other.remove();
        }
      });
      setAttr(row, "data-hesabno-tx-metadata-row", "true");
      setAttr(row, "data-hesabno-metadata-canonical", "true");
      if (!row.classList.contains("hesabno-canonical-metadata-row")) row.classList.add("hesabno-canonical-metadata-row");
      return row;
    };
    var sourceValue = function (article, selectors, prefix) {
      var node = article.querySelector(selectors);
      if (!node) return "";
      var value = node.querySelector("[data-hesabno-live-tx-label], .hesabno-meta-project-value, .hesabno-meta-family-value") || node.querySelector("span");
      return clean(value ? value.textContent : node.textContent).replace(new RegExp("^(?:" + prefix + ")\\s*[:：]?\\s*"), "");
    };
    var makeMetaTag = function (kind) {
      var project = kind === "project";
      var chip = document.createElement("span");
      chip.className = (project ? "hesabno-meta-project" : "hesabno-meta-family") + " hesabno-canonical-meta-chip";
      chip.setAttribute("data-hesabno-metadata-canonical-item", kind);
      chip.innerHTML = project
        ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path><path d="M8 10v4"></path><path d="M12 10v2"></path><path d="M16 10v6"></path></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><path d="M16 3.128a4 4 0 0 1 0 7.744"></path><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><circle cx="9" cy="7" r="4"></circle></svg>';
      var label = document.createElement("span");
      label.className = project ? "hesabno-meta-project-value" : "hesabno-meta-family-value";
      label.setAttribute("data-hesabno-canonical-meta-label", "true");
      chip.appendChild(label);
      return chip;
    };
    var syncMetaTag = function (article, kind, value, source) {
      var key = kind === "project" ? "پروژه" : "عضو خانواده";
      var chip = article.querySelector('[data-hesabno-metadata-canonical-item="' + kind + '"]');
      if (!value) {
        if (chip) chip.remove();
        return null;
      }
      if (!chip) chip = makeMetaTag(kind);
      var label = chip.querySelector("[data-hesabno-canonical-meta-label]");
      var text = key + ": " + value;
      if (label && label.textContent !== text) label.textContent = text;
      setAttr(chip, "aria-label", text);
      setAttr(chip, "title", text);
      if (source) setAttr(source, "data-hesabno-metadata-duplicate", "true");
      return chip;
    };
    var findStatusBadge = function (article) {
      return article.querySelector("[data-hesabno-tx-status-badge]");
    };
    var findNativeStatusText = function (article) {
      var labels = ["چک در جریان", "چک برگشتی", "چک پاس‌شده", "چک وصول‌شده", "خوابیده در بانک", "چک مسترد"];
      var shell = article.firstElementChild || article;
      var node = Array.from(shell.querySelectorAll("span:not([data-hesabno-tx-status-badge])")).find(function (span) {
        return labels.indexOf(clean(span.textContent)) !== -1;
      });
      return node ? statusValue(node.textContent) : "";
    };
    var hideDuplicateStatusBadges = function (article, keep) {
      var labels = ["چک در جریان", "چک برگشتی", "چک پاس‌شده", "چک وصول‌شده", "خوابیده در بانک", "چک مسترد"];
      var shell = article.firstElementChild || article;
      Array.from(shell.querySelectorAll("span")).forEach(function (span) {
        if (span === keep || (keep && keep.contains(span))) return;
        if (labels.indexOf(clean(span.textContent)) !== -1) {
          var target = span.parentElement && span.parentElement.tagName === "SPAN" && span.parentElement !== keep ? span.parentElement : span;
          setAttr(target, "data-hesabno-tx-status-source", "true");
          setAttr(target, "data-hesabno-metadata-duplicate", "true");
          setAttr(target, "aria-hidden", "true");
        }
      });
      article.querySelectorAll("[data-hesabno-tx-status-badge], [data-hesabno-tx-status-source]").forEach(function (node) {
        if (node === keep || (keep && keep.contains(node))) return;
        if (node !== keep && node.hasAttribute("data-hesabno-tx-status-badge")) rmAttr(node, "data-hesabno-tx-status-badge");
        setAttr(node, "data-hesabno-metadata-duplicate", "true");
        setAttr(node, "aria-hidden", "true");
      });
    };
    var ensureStatusIcon = function (badge) {
      if (badge.querySelector("svg.lucide-file-check2, svg.lucide-file-check-2")) return;
      var icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("class", "lucide lucide-file-check2 lucide-file-check-2");
      icon.setAttribute("width", "9");
      icon.setAttribute("height", "9");
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.setAttribute("fill", "none");
      icon.setAttribute("stroke", "currentColor");
      icon.setAttribute("stroke-width", "2");
      icon.setAttribute("stroke-linecap", "round");
      icon.setAttribute("stroke-linejoin", "round");
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = '<path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="m3 15 2 2 4-4"></path>';
      badge.insertBefore(icon, badge.firstChild);
    };
    var setStatusLabel = function (badge, item) {
      var stored = statusFromItem(item);
      var original = stored || badge.getAttribute("data-hesabno-canonical-status-value") || statusValue(badge.textContent);
      if (!original) return "";
      ensureStatusIcon(badge);
      setAttr(badge, "data-hesabno-canonical-status-value", original);
      var tone = original.indexOf("برگشت") !== -1 ? "red" : original.indexOf("مسترد") !== -1 ? "purple" : original.indexOf("بانک") !== -1 ? "blue" : (original.indexOf("پاس") !== -1 || original.indexOf("وصول") !== -1) ? "green" : "amber";
      setAttr(badge, "data-hesabno-status-tone", tone);
      var full = "وضعیت چک: " + original;
      var label = badge.querySelector("[data-hesabno-canonical-status-label]");
      if (!label) label = Array.from(badge.querySelectorAll("span")).find(function (span) { return !span.querySelector("svg"); });
      if (label) {
        setAttr(label, "data-hesabno-canonical-status-label", "true");
        if (label.textContent !== full) label.textContent = full;
      } else {
        var textNodes = Array.from(badge.childNodes).filter(function (node) { return node.nodeType === 3; });
        if (textNodes.length) {
          if (textNodes[0].nodeValue !== full) textNodes[0].nodeValue = full;
          textNodes.slice(1).forEach(function (node) { if (node.nodeValue !== "") node.nodeValue = ""; });
        } else badge.appendChild(document.createTextNode(full));
      }
      setAttr(badge, "aria-label", full);
      setAttr(badge, "title", full);
      setAttr(badge, "data-hesabno-metadata-canonical-item", "status");
      return full;
    };
    var makeStatusBadge = function (text) {
      var badge = document.createElement("span");
      badge.className = "hesabno-tx-status-badge inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
      setAttr(badge, "data-hesabno-tx-status-badge", "true");
      badge.textContent = text;
      return badge;
    };
    var findCompoundBadge = function (article) {
      return article.querySelector("[data-hesabno-compound-badge]");
    };
    var hasNativeCompoundBadge = function (article) {
      return Array.from(article.querySelectorAll("span")).some(function (span) {
        return clean(span.textContent) === "سند مرکب";
      });
    };
    var makeCompoundBadge = function () {
      var badge = document.createElement("span");
      badge.className = "inline-flex items-center justify-center rounded bg-violet-500/15 border border-violet-500/30 text-violet-300";
      setAttr(badge, "data-hesabno-compound-badge", "true");
      badge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 17h8"></path></svg><span data-hesabno-compound-label="true">سند مرکب</span>';
      return badge;
    };
    var hideDuplicates = function (article, selectors, keep) {
      article.querySelectorAll(selectors).forEach(function (node) {
        if (node === keep || (keep && keep.contains(node))) return;
        setAttr(node, "data-hesabno-metadata-duplicate", "true");
        setAttr(node, "aria-hidden", "true");
        var divider = node.previousElementSibling;
        if (divider && divider.classList.contains("h-3") && divider.classList.contains("w-px")) setAttr(divider, "data-hesabno-metadata-duplicate", "true");
      });
    };
    var hideEmptySourceRows = function (article, canonicalRow) {
      var candidates = new Set();
      article.querySelectorAll(".hesabno-tx-project-chip, .hesabno-tx-family-chip, .hesabno-meta-project:not([data-hesabno-metadata-canonical-item]), .hesabno-meta-family:not([data-hesabno-metadata-canonical-item])").forEach(function (node) {
        if (node.parentElement && node.parentElement !== canonicalRow) candidates.add(node.parentElement);
      });
      article.querySelectorAll("[data-hesabno-tx-status-meta], [data-hesabno-tx-metadata-row]").forEach(function (node) {
        if (node !== canonicalRow) candidates.add(node);
      });
      candidates.forEach(function (row) {
        var hasVisibleItem = Array.from(row.children).some(function (child) {
          if (child.getAttribute("data-hesabno-metadata-duplicate") === "true" || child.hasAttribute("data-hesabno-meta-separator")) return false;
          if (child.classList.contains("h-3") && child.classList.contains("w-px")) return false;
          if (getComputedStyle(child).display === "none") return false;
          return !!clean(child.textContent) || !!child.querySelector("svg") || child.tagName === "BUTTON";
        });
        if (!hasVisibleItem) {
          setAttr(row, "data-hesabno-metadata-duplicate", "true");
          setAttr(row, "aria-hidden", "true");
        }
      });
    };
    var arrange = function (row, items) {
      var current = Array.from(row.children);
      var oldSeparators = current.filter(function (node) { return node.hasAttribute("data-hesabno-meta-separator"); });
      var known = new Set(items);
      var extras = current.filter(function (node) { return !known.has(node) && !node.hasAttribute("data-hesabno-meta-separator"); });
      var visibleExtras = extras.filter(function (node) {
        return node.getAttribute("data-hesabno-metadata-duplicate") !== "true" && node.style.display !== "none";
      });
      var hiddenExtras = extras.filter(function (node) {
        return node.getAttribute("data-hesabno-metadata-duplicate") === "true" || node.style.display === "none";
      });
      var visibleItems = items.concat(visibleExtras);
      var desired = [];
      visibleItems.forEach(function (node, index) {
        if (index) {
          var separator = oldSeparators[index - 1] || document.createElement("span");
          separator.setAttribute("data-hesabno-meta-separator", "true");
          separator.setAttribute("aria-hidden", "true");
          desired.push(separator);
        }
        desired.push(node);
      });
      desired = desired.concat(hiddenExtras);
      var same = current.length === desired.length && current.every(function (node, index) { return node === desired[index]; });
      if (!same) {
        oldSeparators.filter(function (node) { return desired.indexOf(node) === -1; }).forEach(function (node) { node.remove(); });
        desired.forEach(function (node) { row.appendChild(node); });
      }
      if (visibleItems.length) rmAttr(row, "data-hesabno-metadata-empty");
      else setAttr(row, "data-hesabno-metadata-empty", "true");
    };
    var sync = function () {
      var transactions = readTransactions();
      document.querySelectorAll("article[id^='tx-card-']").forEach(function (article) {
        var id = article.id.slice("tx-card-".length);
        var item = transactions.find(function (entry) { return entry && String(entry.id) === id; });
        var projectSource = article.querySelector(".hesabno-tx-project-chip, .hesabno-meta-project:not([data-hesabno-metadata-canonical-item])");
        var familySource = article.querySelector(".hesabno-tx-family-chip, .hesabno-meta-family:not([data-hesabno-metadata-canonical-item])");
        var project = clean(item && item.project) || sourceValue(article, ".hesabno-tx-project-chip, .hesabno-meta-project:not([data-hesabno-metadata-canonical-item])", "پروژه");
        var family = clean(item && item.familyMember) || sourceValue(article, ".hesabno-tx-family-chip, .hesabno-meta-family:not([data-hesabno-metadata-canonical-item])", "عضو\\s*خانواده");
        var projectTag = syncMetaTag(article, "project", project, projectSource);
        var familyTag = syncMetaTag(article, "family", family, familySource);
        hideDuplicates(article, ".hesabno-tx-project-chip, .hesabno-meta-project:not([data-hesabno-metadata-canonical-item])", projectTag);
        hideDuplicates(article, ".hesabno-tx-family-chip, .hesabno-meta-family:not([data-hesabno-metadata-canonical-item])", familyTag);
        var statusBadge = item && item.isCheckReplacementPayment ? null : findStatusBadge(article);
        if (item && item.isCheckReplacementPayment) {
          article.querySelectorAll("[data-hesabno-tx-status-badge]").forEach(function (badge) {
            rmAttr(badge, "data-hesabno-tx-status-badge");
            rmAttr(badge, "data-hesabno-metadata-canonical-item");
            setAttr(badge, "data-hesabno-tx-status-source", "true");
            setAttr(badge, "data-hesabno-metadata-duplicate", "true");
            setAttr(badge, "aria-hidden", "true");
            if (badge.style.display !== "none") badge.style.display = "none";
          });
        }
        var storedStatus = statusFromItem(item) || findNativeStatusText(article);
        if (!statusBadge && storedStatus && !(item && item.isCheckReplacementPayment)) statusBadge = makeStatusBadge(storedStatus);
        if (statusBadge) {
          rmAttr(statusBadge, "data-hesabno-metadata-duplicate");
          rmAttr(statusBadge, "aria-hidden");
          setAttr(statusBadge, "data-hesabno-tx-status-badge", "true");
          setStatusLabel(statusBadge, item);
        }
        hideDuplicateStatusBadges(article, statusBadge);
        var compoundBadge = findCompoundBadge(article);
        var isCompound = item ? item.isCompound === true : hasNativeCompoundBadge(article);
        if (isCompound && !compoundBadge) compoundBadge = makeCompoundBadge();
        if (!isCompound) {
          if (compoundBadge) compoundBadge.remove();
          compoundBadge = null;
        }
        if (compoundBadge) {
          rmAttr(compoundBadge, "data-hesabno-metadata-duplicate");
          rmAttr(compoundBadge, "aria-hidden");
          setAttr(compoundBadge, "data-hesabno-compound-badge", "true");
          setAttr(compoundBadge, "data-hesabno-metadata-canonical-item", "compound");
          setAttr(compoundBadge, "aria-label", "سند مرکب");
          setAttr(compoundBadge, "title", "سند مرکب");
          rmAttr(compoundBadge, "role");
          compoundBadge.querySelectorAll("svg").forEach(function (icon) { setAttr(icon, "width", "12"); setAttr(icon, "height", "12"); });
          Array.from(compoundBadge.childNodes).forEach(function (node) { if (node.nodeType === 3 && clean(node.nodeValue)) node.nodeValue = ""; });
          var compoundLabel = compoundBadge.querySelector("[data-hesabno-compound-label]") || Array.from(compoundBadge.querySelectorAll("span")).find(function (label) { return clean(label.textContent) === "سند مرکب"; });
          if (!compoundLabel) {
            compoundLabel = document.createElement("span");
            compoundBadge.appendChild(compoundLabel);
          }
          setAttr(compoundLabel, "data-hesabno-compound-label", "true");
          rmAttr(compoundLabel, "data-hesabno-metadata-duplicate");
          rmAttr(compoundLabel, "aria-hidden");
          if (compoundLabel.textContent !== "سند مرکب") compoundLabel.textContent = "سند مرکب";
        }
        Array.from(article.querySelectorAll("span")).forEach(function (node) {
          if (node !== compoundBadge && clean(node.textContent) === "سند مرکب" && !(compoundBadge && compoundBadge.contains(node))) {
            if (node.hasAttribute("data-hesabno-compound-badge")) rmAttr(node, "data-hesabno-compound-badge");
            setAttr(node, "data-hesabno-metadata-duplicate", "true");
            setAttr(node, "aria-hidden", "true");
          }
        });
        var row = ensureRow(article);
        if (!row) return;
        var ordered = [projectTag, familyTag, statusBadge, compoundBadge].filter(Boolean);
        ordered.forEach(function (node) {
          setAttr(node, "data-hesabno-metadata-canonical-item", node === projectTag ? "project" : node === familyTag ? "family" : node === statusBadge ? "status" : "compound");
          if (node.parentElement !== row) row.appendChild(node);
        });
        if (statusBadge) {
          setAttr(row, "data-hesabno-tx-status-meta", "true");
          if (!row.getAttribute("data-hesabno-tx-status")) setAttr(row, "data-hesabno-tx-status", "check");
        }
        arrange(row, ordered);
        hideEmptySourceRows(article, row);
      });
    };
    var scheduleBurst = function () { [0, 80, 220, 500, 1000].forEach(function (delay) { window.setTimeout(sync, delay); }); };
    var queued = false;
    var schedule = function () {
      if (queued) return;
      queued = true;
      window.queueMicrotask(function () { queued = false; sync(); });
    };
    sync();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
    document.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("button") : null;
      if (button && /^(?:ذخیره تغییرات|ثبت سند|ثبت پرداخت|ثبت دریافت|تایید|تأیید)/u.test(clean(button.textContent))) scheduleBurst();
    }, true);
    window.addEventListener("storage", function (event) { if (event.key === transactionKey) scheduleBurst(); });
    /*
     * پیش از مرحله ۶.۲ این اسکریپت خودش Storage.prototype.setItem را می‌پیچید و پس از خود،
     * ۱۴۸ و ۱۵۴ هم روی آن می‌پیچیدند؛ هر پیچش نشانه‌ی قبلی را پاک می‌کرد و ترتیب اجرا شکننده بود.
     * حالا فقط به نگهبان نوشتن «مشترک» می‌شود (رفتار: پس از نوشتن موفق همان کلید).
     */
    var writeGuard = window.__hesabnoStorageGuard;
    if (writeGuard && typeof writeGuard.onWrite === "function") {
      writeGuard.onWrite(function (change) { if (change.key === transactionKey) scheduleBurst(); });
    }
  })();
