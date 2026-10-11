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
    if (!document.querySelector("style[data-hesabno-canonical-metadata-style]")) {
      var style = document.createElement("style");
      style.setAttribute("data-hesabno-canonical-metadata-style", "true");
      style.textContent = "article [data-hesabno-metadata-duplicate='true']{display:none!important}" +
        "article [data-hesabno-metadata-empty='true']{display:none!important}" +
        "article [data-hesabno-metadata-canonical='true']{display:flex!important;align-items:center!important;flex-wrap:nowrap!important;gap:0!important;direction:rtl!important;white-space:nowrap!important;overflow-x:hidden!important;overflow-y:hidden!important;scrollbar-width:none!important;border-top:1px solid rgba(148,163,184,.24)!important;padding:4px 0!important;min-height:24px}" +
        "article [data-hesabno-metadata-canonical='true'][data-hesabno-metadata-empty='true']{display:none!important;min-height:0!important;height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important}" +
        "article [data-hesabno-metadata-canonical='true']::-webkit-scrollbar{display:none}" +
        "article [data-hesabno-metadata-canonical='true']>[data-hesabno-metadata-canonical-item]{display:inline-flex!important;align-items:center!important;flex:0 0 auto!important;white-space:nowrap!important}" +
        "article [data-hesabno-metadata-canonical='true']>[data-hesabno-meta-separator]{display:block!important;flex:0 0 1px!important;width:1px!important;height:12px!important;margin:0 4px!important;background:rgba(148,163,184,.34)!important;border:0!important;padding:0!important}" +
        "article [data-hesabno-metadata-canonical='true']>[data-hesabno-metadata-canonical-item='project'],article [data-hesabno-metadata-canonical='true']>[data-hesabno-metadata-canonical-item='family'],article [data-hesabno-metadata-canonical='true']>[data-hesabno-metadata-canonical-item='status']{flex:0 1 auto!important;min-width:0!important;max-width:42%!important;overflow:hidden!important;text-overflow:ellipsis!important}" +
        "article [data-hesabno-metadata-canonical='true'] .hesabno-canonical-meta-chip{gap:4px!important;padding:2px 4px!important;border:1px solid rgba(148,163,184,.2)!important;border-radius:6px!important;background:rgba(100,116,139,.10)!important;color:#cbd5e1!important;font-size:9px!important;font-weight:700!important}" +
        "article [data-hesabno-metadata-canonical='true'] .hesabno-canonical-meta-chip svg{display:block!important;flex:0 0 auto!important;width:10px!important;height:10px!important}" +
        "article [data-hesabno-metadata-canonical='true'] .hesabno-canonical-meta-chip>[data-hesabno-canonical-meta-label]{display:block!important;flex:1 1 auto!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}" +
        "html[data-theme='light'] article [data-hesabno-metadata-canonical='true'] .hesabno-canonical-meta-chip{color:#475569!important;background:#f1f5f9!important;border-color:#cbd5e1!important}" +
        "html[data-theme='light'] article [data-hesabno-metadata-canonical='true'] .hesabno-canonical-meta-chip svg{color:#64748b!important}" +
        "article [data-hesabno-metadata-canonical='true']>[data-hesabno-tx-status-badge]{font-size:9px!important;font-weight:800!important;flex:0 0 auto!important;white-space:nowrap!important}" +
        "article [data-hesabno-metadata-canonical='true']>[data-hesabno-compound-badge]{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:3px!important;flex:0 0 auto!important;width:auto!important;height:20px!important;min-width:0!important;max-width:72px!important;padding:0 5px!important;font-size:9px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important}" +
        "article [data-hesabno-metadata-canonical='true']>[data-hesabno-compound-badge]>span{display:inline!important;flex:0 1 auto!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}" +
        "article [data-hesabno-metadata-canonical='true']>[data-hesabno-compound-badge] svg{display:block!important;width:12px!important;height:12px!important;flex:0 0 auto!important}" +
         "article [data-hesabno-metadata-canonical='true']>[data-hesabno-metadata-canonical-item]{border-radius:4px!important}";
      document.head.appendChild(style);
    }
    var ensureRow = function (article) {
      var row = article.querySelector("[data-hesabno-metadata-canonical='true']") || article.querySelector("[data-hesabno-tx-status-meta], [data-hesabno-tx-metadata-row]");
      if (!row) {
        var source = article.querySelector(".hesabno-tx-project-chip, .hesabno-tx-family-chip");
        row = source && source.parentElement;
      }
      if (!row) {
        var shell = article.firstElementChild;
        if (!shell) return null;
        row = document.createElement("div");
        row.className = "flex items-center gap-1.5 mt-1.5 pt-1 border-t border-stone-700/30 w-full overflow-x-auto no-scrollbar py-0.5";
        shell.appendChild(row);
      }
      row.setAttribute("data-hesabno-tx-metadata-row", "true");
      row.setAttribute("data-hesabno-metadata-canonical", "true");
      row.classList.add("hesabno-canonical-metadata-row");
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
      chip.setAttribute("aria-label", text);
      chip.setAttribute("title", text);
      if (source) source.setAttribute("data-hesabno-metadata-duplicate", "true");
      return chip;
    };
    var findStatusBadge = function (article) {
      var badge = article.querySelector("[data-hesabno-tx-status-badge]");
      if (badge) return badge;
      var labels = ["چک در جریان", "چک برگشتی", "چک پاس‌شده", "چک وصول‌شده", "خوابیده در بانک", "چک مسترد"];
      var node = Array.from(article.querySelectorAll("span")).find(function (span) {
        return labels.indexOf(clean(span.textContent)) !== -1 && !span.hasAttribute("data-hesabno-tx-status-source");
      });
      return node && node.parentElement && node.parentElement.tagName === "SPAN" ? node.parentElement : node;
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
      icon.style.cssText = "display:block;flex:0 0 auto;width:9px;height:9px";
      icon.innerHTML = '<path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="m3 15 2 2 4-4"></path>';
      badge.insertBefore(icon, badge.firstChild);
    };
    var setStatusLabel = function (badge, item) {
      var stored = statusFromItem(item);
      var original = stored || badge.getAttribute("data-hesabno-canonical-status-value") || statusValue(badge.textContent);
      if (!original) return "";
      ensureStatusIcon(badge);
      badge.setAttribute("data-hesabno-canonical-status-value", original);
      var full = "وضعیت چک: " + original;
      var label = badge.querySelector("[data-hesabno-canonical-status-label]");
      if (!label) label = Array.from(badge.querySelectorAll("span")).find(function (span) { return !span.querySelector("svg"); });
      if (label) {
        label.setAttribute("data-hesabno-canonical-status-label", "true");
        if (label.textContent !== full) label.textContent = full;
      } else {
        var textNodes = Array.from(badge.childNodes).filter(function (node) { return node.nodeType === 3; });
        if (textNodes.length) {
          textNodes[0].nodeValue = full;
          textNodes.slice(1).forEach(function (node) { node.nodeValue = ""; });
        } else badge.appendChild(document.createTextNode(full));
      }
      badge.setAttribute("aria-label", full);
      badge.setAttribute("title", full);
      badge.setAttribute("data-hesabno-metadata-canonical-item", "status");
      return full;
    };
    var makeStatusBadge = function (text) {
      var badge = document.createElement("span");
      badge.className = "hesabno-tx-status-badge inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
      badge.setAttribute("data-hesabno-tx-status-badge", "true");
      badge.textContent = text;
      return badge;
    };
    var findCompoundBadge = function (article) {
      var marked = article.querySelector("[data-hesabno-compound-badge]");
      if (marked) return marked;
      var spans = Array.from(article.querySelectorAll("span"));
      var label = spans.find(function (span) { return clean(span.textContent) === "سند مرکب"; });
      if (!label) return null;
      var current = label;
      for (var level = 0; current && level < 4; level += 1, current = current.parentElement) {
        if (current.tagName === "SPAN" && clean(current.textContent) === "سند مرکب" && current.querySelector("svg")) return current;
      }
      return label;
    };
    var makeCompoundBadge = function () {
      var badge = document.createElement("span");
      badge.className = "inline-flex items-center justify-center rounded bg-violet-500/15 border border-violet-500/30 text-violet-300";
      badge.setAttribute("data-hesabno-compound-badge", "true");
      badge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 17h8"></path></svg><span data-hesabno-compound-label="true">سند مرکب</span>';
      return badge;
    };
    var hideDuplicates = function (article, selectors, keep) {
      article.querySelectorAll(selectors).forEach(function (node) {
        if (node === keep || (keep && keep.contains(node))) return;
        node.setAttribute("data-hesabno-metadata-duplicate", "true");
        node.setAttribute("aria-hidden", "true");
        var divider = node.previousElementSibling;
        if (divider && divider.classList.contains("h-3") && divider.classList.contains("w-px")) divider.setAttribute("data-hesabno-metadata-duplicate", "true");
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
          row.setAttribute("data-hesabno-metadata-duplicate", "true");
          row.setAttribute("aria-hidden", "true");
        }
      });
    };
    var arrange = function (row, items) {
      var current = Array.from(row.children);
      var oldSeparators = current.filter(function (node) { return node.hasAttribute("data-hesabno-meta-separator"); });
      var known = new Set(items);
      var extras = current.filter(function (node) { return !known.has(node) && !node.hasAttribute("data-hesabno-meta-separator"); });
      var desired = [];
      items.forEach(function (node, index) {
        if (index) {
          var separator = oldSeparators[index - 1] || document.createElement("span");
          separator.setAttribute("data-hesabno-meta-separator", "true");
          separator.setAttribute("aria-hidden", "true");
          separator.style.cssText = "display:block!important;flex:0 0 1px!important;width:1px!important;height:12px!important;margin:0 4px!important;background:rgba(148,163,184,.34)!important;border:0!important;padding:0!important";
          desired.push(separator);
        }
        desired.push(node);
      });
      desired = desired.concat(extras);
      var same = current.length === desired.length && current.every(function (node, index) { return node === desired[index]; });
      if (!same) {
        oldSeparators.filter(function (node) { return desired.indexOf(node) === -1; }).forEach(function (node) { node.remove(); });
        desired.forEach(function (node) { row.appendChild(node); });
      }
      if (items.length) row.removeAttribute("data-hesabno-metadata-empty");
      else if (!extras.some(function (node) { return node.getAttribute("data-hesabno-metadata-duplicate") !== "true"; })) row.setAttribute("data-hesabno-metadata-empty", "true");
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
            badge.removeAttribute("data-hesabno-tx-status-badge");
            badge.removeAttribute("data-hesabno-metadata-canonical-item");
            badge.setAttribute("data-hesabno-tx-status-source", "true");
            badge.setAttribute("data-hesabno-metadata-duplicate", "true");
            badge.setAttribute("aria-hidden", "true");
            badge.style.display = "none";
          });
        }
        var storedStatus = statusFromItem(item);
        if (!statusBadge && storedStatus) statusBadge = makeStatusBadge(storedStatus);
        if (statusBadge) {
          statusBadge.setAttribute("data-hesabno-tx-status-badge", "true");
          setStatusLabel(statusBadge, item);
        }
        var compoundBadge = findCompoundBadge(article);
        var isCompound = item ? item.isCompound === true : !!compoundBadge;
        if (isCompound && !compoundBadge) compoundBadge = makeCompoundBadge();
        if (!isCompound) compoundBadge = null;
        if (compoundBadge) {
          compoundBadge.setAttribute("data-hesabno-compound-badge", "true");
          compoundBadge.setAttribute("data-hesabno-metadata-canonical-item", "compound");
          compoundBadge.setAttribute("aria-label", "سند مرکب");
          compoundBadge.setAttribute("title", "سند مرکب");
          compoundBadge.removeAttribute("role");
          compoundBadge.style.setProperty("display", "inline-flex", "important");
          compoundBadge.style.setProperty("align-items", "center", "important");
          compoundBadge.style.setProperty("justify-content", "center", "important");
          compoundBadge.style.setProperty("gap", "3px", "important");
          compoundBadge.style.setProperty("font-size", "9px", "important");
          compoundBadge.style.setProperty("line-height", "1.2", "important");
          compoundBadge.style.setProperty("width", "auto", "important");
          compoundBadge.style.setProperty("height", "20px", "important");
          compoundBadge.style.setProperty("min-width", "0", "important");
          compoundBadge.style.setProperty("max-width", "72px", "important");
          compoundBadge.style.setProperty("padding", "0 5px", "important");
          compoundBadge.style.setProperty("white-space", "nowrap", "important");
          compoundBadge.style.setProperty("overflow", "hidden", "important");
          compoundBadge.querySelectorAll("svg").forEach(function (icon) { icon.setAttribute("width", "12"); icon.setAttribute("height", "12"); });
          Array.from(compoundBadge.childNodes).forEach(function (node) { if (node.nodeType === 3 && clean(node.nodeValue)) node.nodeValue = ""; });
          var compoundLabel = compoundBadge.querySelector("[data-hesabno-compound-label]") || Array.from(compoundBadge.querySelectorAll("span")).find(function (label) { return clean(label.textContent) === "سند مرکب"; });
          if (!compoundLabel) {
            compoundLabel = document.createElement("span");
            compoundBadge.appendChild(compoundLabel);
          }
          compoundLabel.setAttribute("data-hesabno-compound-label", "true");
          compoundLabel.removeAttribute("data-hesabno-metadata-duplicate");
          compoundLabel.removeAttribute("aria-hidden");
          if (compoundLabel.textContent !== "سند مرکب") compoundLabel.textContent = "سند مرکب";
        }
        Array.from(article.querySelectorAll("span")).forEach(function (node) {
          if (node !== compoundBadge && clean(node.textContent) === "سند مرکب" && !(compoundBadge && compoundBadge.contains(node))) {
            node.setAttribute("data-hesabno-metadata-duplicate", "true");
            node.setAttribute("aria-hidden", "true");
          }
        });
        var row = ensureRow(article);
        if (!row) return;
        var ordered = [projectTag, familyTag, statusBadge, compoundBadge].filter(Boolean);
        ordered.forEach(function (node) {
          node.setAttribute("data-hesabno-metadata-canonical-item", node === projectTag ? "project" : node === familyTag ? "family" : node === statusBadge ? "status" : "compound");
          if (node.parentElement !== row) row.appendChild(node);
        });
        if (statusBadge) {
          row.setAttribute("data-hesabno-tx-status-meta", "true");
          if (!row.getAttribute("data-hesabno-tx-status")) row.setAttribute("data-hesabno-tx-status", "check");
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
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("button") : null;
      if (button && /^(?:ذخیره تغییرات|ثبت سند|ثبت پرداخت|ثبت دریافت|تایید|تأیید)/u.test(clean(button.textContent))) scheduleBurst();
    }, true);
    window.addEventListener("storage", function (event) { if (event.key === transactionKey) scheduleBurst(); });
    var nativeSetItem = Storage.prototype.setItem;
    if (!nativeSetItem.__hesabnoCanonicalTransactionMetadata) {
      var wrappedSetItem = function (key, value) {
        var result = nativeSetItem.call(this, key, value);
        if (key === transactionKey) scheduleBurst();
        return result;
      };
      wrappedSetItem.__hesabnoCanonicalTransactionMetadata = true;
      Storage.prototype.setItem = wrappedSetItem;
    }
  })();
