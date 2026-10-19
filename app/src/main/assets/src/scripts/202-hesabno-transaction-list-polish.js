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
    var documentNumber = function (item) { return item && (item.documentNumber || item.id); };
    var sameReference = function (left, right) { return left != null && right != null && latin(left).trim() === latin(right).trim(); };
    /* ظاهر ردیف لینک سند اصلاحی و نشان‌های چک برگشتی در بستهٔ ۲۳۵ (لایهٔ ظاهر) قرار دارد. */
    var mergeGroups = function (first, second) {
      var firstHeader = first.querySelector(":scope > .hesabno-transaction-day-header");
      var secondHeader = second.querySelector(":scope > .hesabno-transaction-day-header");
      var firstList = Array.from(first.children).find(function (node) { return node !== firstHeader; });
      var secondList = Array.from(second.children).find(function (node) { return node !== secondHeader; });
      if (!firstHeader || !secondHeader || !firstList || !secondList) return;
      var chips = Array.from(firstHeader.querySelectorAll(".hesabno-transaction-day-total"))
        .concat(Array.from(secondHeader.querySelectorAll(".hesabno-transaction-day-total")));
      var totals = Object.create(null);
      chips.forEach(function (chip) {
        var text = clean(chip.textContent);
        var key = /[−-]/.test(text) || chip.classList.contains("text-rose-400") ? "expense" :
          /\+/.test(text) || chip.classList.contains("text-emerald-400") ? "income" : "other:" + chip.className;
        var amount = Number(latin(text).replace(/[^0-9]/g, "")) || 0;
        if (!totals[key]) totals[key] = { amount: 0, chip: chip.cloneNode(true) };
        totals[key].amount += amount;
      });
      var firstCount = firstHeader.querySelector(".hesabno-transaction-day-count");
      var secondCount = secondHeader.querySelector(".hesabno-transaction-day-count");
      var counts = [firstCount, secondCount].reduce(function (sum, node) {
        return sum + (node ? Number(latin(node.textContent).replace(/[^0-9]/g, "")) || 0 : 0);
      }, 0);
      var right = firstHeader.children[firstHeader.children.length - 1];
      if (right && chips.length) {
        right.replaceChildren();
        right.classList.add("flex-wrap", "justify-end");
        right.style.maxWidth = "58%";
        Object.keys(totals).forEach(function (key) {
          var entry = totals[key], sign = key === "expense" ? "−" : key === "income" ? "+" : "";
          entry.chip.textContent = sign + entry.amount.toLocaleString("fa-IR") + " ریال";
          right.appendChild(entry.chip);
        });
      }
      if (firstCount) firstCount.textContent = counts.toLocaleString("fa-IR") + " سند";
      Array.from(secondList.querySelectorAll(":scope > article")).forEach(function (article) { firstList.appendChild(article); });
      second.remove();
    };
    var mergeDuplicateDates = function () {
      document.querySelectorAll("main section").forEach(function (section) {
        var groups = Array.from(section.children).filter(function (group) {
          return group.querySelector(":scope > .hesabno-transaction-day-header");
        });
        var previous = null, previousDate = "";
        groups.forEach(function (group) {
          var header = group.querySelector(":scope > .hesabno-transaction-day-header");
          var date = clean(header && header.querySelector(".hesabno-transaction-day-date") && header.querySelector(".hesabno-transaction-day-date").textContent);
          if (previous && date && date === previousDate) mergeGroups(previous, group);
          else { previous = group; previousDate = date; }
        });
      });
    };
    var polishCorrectionLinks = function () {
      var items = read();
      document.querySelectorAll('article[id^="tx-card-"]').forEach(function (article) {
        var item = items.find(function (entry) { return String(entry && entry.id) === article.id.slice("tx-card-".length); });
        if (!item) return;
        if (item.reversalOfDocNumber != null) {
          var parent = items.find(function (entry) {
            return entry && entry.check && sameReference(documentNumber(entry), item.reversalOfDocNumber);
          });
          if (parent) {
            article.querySelectorAll("[data-hesabno-correction-link-row]").forEach(function (node) {
              node.removeAttribute("data-hesabno-correction-link-row");
            });
            var footer = Array.from(article.querySelectorAll("div")).find(function (node) {
              var label = node.querySelector("span.truncate"), button = node.querySelector("button");
              return label && button && clean(label.textContent).indexOf("سند اصلاحی عطف به") === 0;
            });
            if (footer) footer.setAttribute("data-hesabno-correction-link-row", "true");
          }
          return;
        }
        if (!item || !item.check || item.check.returnedWithCorrection !== true) return;
        var child = items.find(function (entry) { return sameReference(entry && entry.reversalOfDocNumber, documentNumber(item)); });
        if (!child) return;
        var link = article.querySelector("button[data-hesabno-check-correction-link]");
        var sourceLink = Array.from(article.querySelectorAll("button")).find(function (button) {
          if (button === link) return false;
          var label = clean(button.textContent);
          return button.title.indexOf("مشاهده سند اصلاحی") === 0 ||
            label.indexOf("مشاهده اصلاحی") === 0 || /^اصلاح در\s*#/u.test(label);
        });
        if (!link && !sourceLink) return;
        var metadata = Array.from(article.querySelectorAll("[data-hesabno-tx-metadata-row]"))
          .find(function (row) { return row.querySelector("[data-hesabno-tx-status-badge]"); });
        if (!metadata) return;
        if (!link) {
          link = document.createElement("button");
          link.type = "button";
          link.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var current = Array.from(article.querySelectorAll("button")).find(function (button) {
              if (button === link || button.hasAttribute("data-hesabno-check-correction-link")) return false;
              var label = clean(button.textContent);
              return button.title.indexOf("مشاهده سند اصلاحی") === 0 ||
                label.indexOf("مشاهده اصلاحی") === 0 || /^اصلاح در\s*#/u.test(label);
            });
            if (current) current.click();
          });
        }
        var linkText = "اصلاح در #" + String(documentNumber(child)).replace(/[0-9]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]; }) + " ↗";
        if (link.textContent !== linkText) link.textContent = linkText;
        link.title = "مشاهده سند اصلاحی #" + documentNumber(child);
        link.setAttribute("aria-label", "بازکردن سند اصلاحی شماره " + documentNumber(child));
        link.setAttribute("data-hesabno-check-correction-link", "true");
        link.className = "shrink-0 rounded-md border border-violet-700 bg-violet-700 px-2 py-0.5 text-[9px] font-bold text-white transition hover:bg-violet-800";
        metadata.classList.remove("overflow-x-auto", "no-scrollbar");
        metadata.classList.remove("justify-between");
        metadata.classList.add("flex-wrap", "justify-start");
        metadata.style.setProperty("justify-content", "flex-start", "important");
        metadata.style.setProperty("direction", "rtl", "important");
        metadata.style.setProperty("column-gap", "6px", "important");
        if (link.parentElement !== metadata) metadata.appendChild(link);
        if (sourceLink && sourceLink !== link) {
          if (sourceLink.parentElement !== metadata) {
            sourceLink.parentElement.style.display = "none";
            sourceLink.parentElement.setAttribute("aria-hidden", "true");
          } else {
            sourceLink.setAttribute("data-hesabno-metadata-duplicate", "true");
            sourceLink.setAttribute("aria-hidden", "true");
            sourceLink.tabIndex = -1;
          }
        }
        metadata.querySelectorAll("button[data-hesabno-footnote-kind='corrected']").forEach(function (button) {
          if (button === link) return;
          button.setAttribute("data-hesabno-metadata-duplicate", "true");
          button.setAttribute("aria-hidden", "true");
          button.tabIndex = -1;
        });
        article.querySelectorAll("button").forEach(function (button) {
          if (button === link || !/^سند اصلاحی\s*#/u.test(clean(button.textContent))) return;
          if (!button.hasAttribute("data-hesabno-check-correction-original-display")) {
            button.setAttribute("data-hesabno-check-correction-original-display", button.style.display || "");
          }
          button.style.display = "none";
          button.setAttribute("aria-hidden", "true");
          button.tabIndex = -1;
        });
      });
    };
    var polishReturnedChecks = function () {
      var items = read();
      document.querySelectorAll('article[id^="tx-card-"]').forEach(function (article) {
        var item = items.find(function (entry) { return String(entry && entry.id) === article.id.slice("tx-card-".length); });
        if (!item) return;
        var status = item.check && String(item.check.status || "").toLowerCase();
        var returned = item.check && item.type === "expense" && (status === "bounced" || status === "refunded");
        article.toggleAttribute("data-hesabno-returned-check", !!returned);
        var title = article.querySelector(".grow > div p"), amount = article.querySelector(".text-left p");
        [title, amount].forEach(function (node) {
          if (!node) return;
          if (returned) {
            node.style.textDecoration = "line-through";
            node.style.opacity = "0.68";
          } else {
            node.style.removeProperty("text-decoration");
            node.style.removeProperty("opacity");
          }
        });
        var row = article.querySelector("[data-hesabno-metadata-canonical='true'], [data-hesabno-tx-metadata-row]");
        if (!row) return;
        var canceled = row.querySelector("[data-hesabno-returned-effect]");
        if (returned && item.check.debtCanceled === true) {
          if (!canceled) {
            canceled = document.createElement("span");
            canceled.setAttribute("data-hesabno-returned-effect", "true");
            canceled.className = "rounded-md border px-1.5 py-0.5 text-[9px] font-black hesabno-returned-effect-chip";
            row.appendChild(canceled);
          }
          var paidAmount = items.filter(function (entry) {
            return entry && entry.isCheckReplacementPayment === true &&
              (sameReference(entry.relatedCheckDocNumber, documentNumber(item)) || sameReference(entry.relatedCheckId, item.id));
          }).reduce(function (sum, entry) { return sum + (Number(entry.amount) || 0); }, 0);
          var effectText = paidAmount > 0 ? "ماندهٔ بدهی لغو شد" : "معامله لغو شد";
          if (canceled.textContent !== effectText) canceled.textContent = effectText;
        } else if (canceled) {
          canceled.remove();
        }
        var correction = row.querySelector("[data-hesabno-returned-correction]");
        if (returned && item.check.returnedWithCorrection) {
          if (!correction) {
            correction = document.createElement("span");
            correction.setAttribute("data-hesabno-returned-correction", "true");
            correction.className = "rounded-md border px-1.5 py-0.5 text-[9px] font-bold hesabno-returned-correction-chip";
            row.appendChild(correction);
          }
          var correctionText = "اصلاحیه " + (item.check.correctionDate || "") + (item.check.correctionDescription ? " · " + item.check.correctionDescription : "");
          if (correction.textContent !== correctionText) correction.textContent = correctionText;
          if (correction.title !== correctionText) correction.title = correctionText;
        } else if (correction) {
          correction.remove();
        }
        if (!returned) {
          var staleEffect = row.querySelector("[data-hesabno-returned-effect]");
          if (staleEffect) staleEffect.remove();
        }
        var linkedPayment = item.check && items.find(function (entry) {
          return entry && entry.isCheckReplacementPayment === true &&
            (sameReference(entry.relatedCheckDocNumber, documentNumber(item)) || sameReference(entry.relatedCheckId, item.id));
        });
        var paymentLink = row.querySelector("[data-hesabno-check-replacement-link]");
        var parent = item.isCheckReplacementPayment ? items.find(function (entry) {
          return entry && entry.check &&
            (sameReference(item.relatedCheckDocNumber, documentNumber(entry)) || sameReference(item.relatedCheckId, entry.id));
        }) : null;
        var linkText = linkedPayment ? "پرداخت جایگزین #" + String(documentNumber(linkedPayment)).replace(/[0-9]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]; }) + " ↗" :
          parent ? "پیوست به چک برگشتی #" + String(documentNumber(parent)).replace(/[0-9]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]; }) + " ↗" : "";
        if (linkText) {
          if (!paymentLink) {
            paymentLink = document.createElement("button");
            paymentLink.type = "button";
            paymentLink.setAttribute("data-hesabno-check-replacement-link", "true");
            paymentLink.className = "shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold hesabno-check-replacement-chip";
            paymentLink.addEventListener("click", function (event) {
              event.preventDefault();
              event.stopPropagation();
              var targetId = paymentLink.getAttribute("data-hesabno-target-id");
              var target = targetId && document.getElementById("tx-card-" + targetId);
              if (target) {
                target.scrollIntoView({ behavior: "smooth", block: "center" });
                target.style.outline = "2px solid #38bdf8";
                window.setTimeout(function () { target.style.removeProperty("outline"); }, 1800);
              }
            });
          }
          var linkedTarget = linkedPayment || parent;
          if (paymentLink.textContent !== linkText) paymentLink.textContent = linkText;
          var linkTitle = linkedPayment ? "مشاهده سند پرداخت جایگزین" : "بازگشت به سند چک برگشتی";
          if (paymentLink.title !== linkTitle) paymentLink.title = linkTitle;
          if (paymentLink.getAttribute("data-hesabno-target-id") !== String(linkedTarget.id)) paymentLink.setAttribute("data-hesabno-target-id", String(linkedTarget.id));
          if (paymentLink.parentElement !== row) row.appendChild(paymentLink);
        } else if (paymentLink) paymentLink.remove();
      });
    };
    var queued = false;
    var sync = function () {
      queued = false;
      mergeDuplicateDates();
      polishCorrectionLinks();
      polishReturnedChecks();
    };
    var schedule = function () {
      if (queued) return;
      queued = true;
      Promise.resolve().then(sync);
    };
    sync();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, characterData: true, subtree: true }, schedule);
  })();
