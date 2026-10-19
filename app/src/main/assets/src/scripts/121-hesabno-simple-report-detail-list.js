(function () {
  var clean = function (value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  };

  /* قواعد سرگروه تاریخ و ردیف گزارش ساده در بستهٔ ۲۳۵ (لایهٔ ظاهر) قرار دارد. */
  var ensureStyle = function () {};

  var formatRawDate = function (text) {
    var cleaned = clean(text);
    if (!cleaned) return "";
    if (/^[۰-۹0-9]{4}[\/-][۰-۹0-9]{1,2}[\/-][۰-۹0-9]{1,2}$/.test(cleaned)) {
      return typeof window.__hesabnoDateLabel === "function" ? window.__hesabnoDateLabel(cleaned) : cleaned;
    }
    return cleaned;
  };

  var dateLabel = function (nativeRoot) {
    if (!nativeRoot) return "سایر";
    var node = nativeRoot.querySelector("[data-hesabno-relative-date]");
    if (node && clean(node.textContent)) return formatRawDate(node.textContent);
    var match = clean(nativeRoot.textContent).match(/[۰-۹0-9]{4}[\/-][۰-۹0-9]{1,2}[\/-][۰-۹0-9]{1,2}/);
    if (!match) return "سایر";
    return formatRawDate(match[0]);
  };

  var bankLabel = function (nativeRoot) {
    if (!nativeRoot) return "بدون حساب";
    var bankLine = nativeRoot.querySelector(".hesabno-report-bank-line");
    if (bankLine && clean(bankLine.textContent)) return clean(bankLine.textContent);
    var titled = Array.from(nativeRoot.querySelectorAll("div[title]")).find(function (node) {
      return !node.closest(".w-6.h-6, .w-5.h-5");
    });
    if (titled) {
      var fromTitle = clean(titled.getAttribute("title") || titled.textContent).replace(/^(?:پرداخت‌کننده|واریز به|از بانک)\s*:?\s*/, "");
      if (fromTitle) return fromTitle;
    }
    var match = clean(nativeRoot.textContent).match(/(?:پرداخت‌کننده|واریز به|از بانک)\s*:?\s*([^\n•]+)/);
    if (!match) return "بدون حساب";
    return clean(match[1].replace(/[۰-۹0-9,]+\s*(?:ریال|تومان).*$/, ""));
  };

  var amountLabel = function (nativeRoot) {
    if (!nativeRoot) return "";
    var nodes = Array.from(nativeRoot.querySelectorAll("span, p, div")).filter(function (node) {
      return node.children.length === 0 && (node.textContent.indexOf("ریال") !== -1 || node.textContent.indexOf("تومان") !== -1);
    });
    return nodes.length ? clean(nodes[nodes.length - 1].textContent) : "";
  };

  var descriptionLabel = function (nativeRoot, bank, card) {
    if (!nativeRoot) return "";
    var categoryTitle = clean(card && card.querySelector("h2") && card.querySelector("h2").textContent)
      .replace(/^تراکنش‌های\s*[«"]?/, "")
      .replace(/[»"]$/, "");
    var candidates = Array.from(nativeRoot.querySelectorAll("span, p, div")).map(function (node) {
      if (node.children.length !== 0) return "";
      if (node.hasAttribute("data-hesabno-relative-date")) return "";
      if (node.closest(".hesabno-report-bank-line")) return "";
      if (node.closest(".w-6.h-6, .w-5.h-5, [data-hesabno-account-icon], [data-hesabno-bank-logo]")) return "";
      if (node.classList && node.classList.contains("select-none")) return "";
      var text = clean(node.textContent);
      if (!text || text === "‹" || text === bank || text === categoryTitle) return "";
      if (/^(?:•\s*)?(?:پرداخت|دریافت|انتقال|هزینه|درآمد)$/.test(text)) return "";
      if (/^(?:پرداخت‌کننده|واریز به|از بانک)\s*:/.test(text)) return "";
      if (text.indexOf("ریال") !== -1 || text.indexOf("تومان") !== -1) return "";
      if (/[۰-۹0-9]{4}\/[۰-۹0-9]{1,2}\/[۰-۹0-9]{1,2}/.test(text)) return "";
      if (/^(?:امروز|دیروز|شنبه|یکشنبه|دوشنبه|سه‌شنبه|چهارشنبه|پنجشنبه|جمعه)\s*،/.test(text)) return "";
      return text;
    }).filter(Boolean);
    if (candidates.length > 1) return candidates.slice(1).join(" • ");
    if (candidates.length === 1 && candidates[0] !== categoryTitle && candidates[0] !== "بدون عنوان") {
      return candidates[0];
    }
    return "";
  };

  var findNativeRoot = function (row) {
    var existing = row.querySelector(':scope > [data-hesabno-simple-report-native="true"]');
    if (existing) return existing;
    var first = Array.from(row.children).find(function (child) {
      return !child.hasAttribute("data-hesabno-simple-report-custom");
    });
    if (first) first.setAttribute("data-hesabno-simple-report-native", "true");
    return first || null;
  };

  var renderCard = function (card) {
    if (!(card instanceof HTMLElement)) return;
    var list = Array.from(card.children).find(function (child) {
      return child instanceof HTMLElement && (child.classList.contains("divide-y") || child.classList.contains("hesabno-simple-report-list"));
    });
    if (!list) return;
    card.classList.add("hesabno-report-transaction-card", "hesabno-simple-report-detail-card");
    list.classList.add("hesabno-simple-report-list");

    var rows = Array.from(list.children).filter(function (child) {
      return child instanceof HTMLElement && child.classList.contains("cursor-pointer");
    });
    if (!rows.length) return;

    var previousDate = "";
    rows.forEach(function (row) {
      row.classList.add("hesabno-report-transaction-row");
      row.dataset.hesabnoReportBankDecorated = "true";

      var nativeRoot = findNativeRoot(row);
      if (!nativeRoot) return;

      var date = dateLabel(nativeRoot);
      var showDate = date !== previousDate;
      previousDate = date;

      var bank = bankLabel(nativeRoot);
      var amount = amountLabel(nativeRoot);
      var description = descriptionLabel(nativeRoot, bank, card);
      var sig = [showDate ? "1" : "0", date, bank, amount, description, clean(nativeRoot.textContent)].join("|");

      var dateNode = row.querySelector(':scope > [data-hesabno-simple-report-custom="date"]');
      var boxNode = row.querySelector(':scope > [data-hesabno-simple-report-custom="box"]');

      if (row.getAttribute("data-hesabno-simple-report-sig") === sig && dateNode && boxNode) {
        return;
      }

      if (!dateNode) {
        dateNode = document.createElement("div");
        dateNode.className = "hesabno-simple-report-date-group";
        dateNode.setAttribute("data-hesabno-simple-report-custom", "date");
        dateNode.addEventListener("click", function (event) {
          event.stopPropagation();
        });
        row.appendChild(dateNode);
      }

      if (showDate) {
        dateNode.textContent = date;
        dateNode.hidden = false;
        dateNode.style.display = "";
        row.classList.add("hesabno-simple-report-date-row");
        row.setAttribute("data-hesabno-simple-report-date-heading", date);
      } else {
        dateNode.textContent = "";
        dateNode.hidden = true;
        dateNode.style.display = "none";
        row.classList.remove("hesabno-simple-report-date-row");
        row.removeAttribute("data-hesabno-simple-report-date-heading");
      }

      if (!boxNode) {
        boxNode = document.createElement("div");
        boxNode.className = "hesabno-simple-report-row-box";
        boxNode.setAttribute("data-hesabno-simple-report-custom", "box");
        row.appendChild(boxNode);
      }

      var top = document.createElement("div");
      top.className = "flex items-center justify-between gap-2 w-full";

      var bankNode = document.createElement("span");
      bankNode.className = "hesabno-simple-report-bank";
      bankNode.dataset.hesabnoBankNameDecorated = "true";
      bankNode.textContent = bank;
      bankNode.title = bank;

      var left = document.createElement("div");
      left.className = "flex items-center gap-1.5 shrink-0 text-left";

      var amountNode = document.createElement("span");
      amountNode.className = "hesabno-simple-report-amount";
      amountNode.textContent = amount;

      var arrow = document.createElement("span");
      arrow.className = "text-stone-400 text-sm";
      arrow.textContent = "‹";

      left.appendChild(amountNode);
      left.appendChild(arrow);
      top.appendChild(bankNode);
      top.appendChild(left);
      boxNode.replaceChildren(top);

      if (description) {
        var descNode = document.createElement("div");
        descNode.className = "hesabno-simple-report-description";
        descNode.textContent = description;
        descNode.title = description;
        boxNode.appendChild(descNode);
      }

      row.setAttribute("data-hesabno-simple-report-sig", sig);
    });
  };

  var render = function () {
    ensureStyle();
    var cards = new Set();
    document.querySelectorAll(".hesabno-report-transaction-card").forEach(function (card) {
      cards.add(card);
    });
    document.querySelectorAll("h2").forEach(function (heading) {
      if (clean(heading.textContent).indexOf("تراکنش‌های") === 0) {
        var card = heading.closest("div.rounded-3xl");
        if (card) cards.add(card);
      }
    });
    cards.forEach(renderCard);
    if (typeof window.__hesabnoDecorateSimpleReportRows === "function") {
      window.__hesabnoDecorateSimpleReportRows();
    }
  };

  var scheduled = false;
  var schedule = function () {
    if (scheduled) return;
    scheduled = true;
    Promise.resolve().then(function () {
      scheduled = false;
      render();
    });
  };

  render();
  if (document.body) {
    window.__hesabnoDom.watch(document.body, { childList: true, subtree: true, characterData: true }, schedule);
  }
})();
