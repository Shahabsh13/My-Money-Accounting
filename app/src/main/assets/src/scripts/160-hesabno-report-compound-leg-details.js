(function () {
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var asciiDigits = function (value) {
      return String(value == null ? "" : value).replace(/[۰-۹٠-٩]/g, function (digit) {
        var fa = "۰۱۲۳۴۵۶۷۸۹".indexOf(digit);
        return String(fa < 0 ? "٠١٢٣٤٥٦٧٨٩".indexOf(digit) : fa);
      });
    };
    var digits = function (value) { return asciiDigits(value).replace(/[^0-9]/g, ""); };
    var readArray = function (key) {
      try {
        var raw = window.__safeGet ? window.__safeGet(key) : localStorage.getItem(key);
        var value = JSON.parse(raw || "null");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var accountName = function (reference, accounts) {
      var value = clean(reference);
      var id = digits(value);
      var account = accounts.find(function (item) {
        return item && (clean(item.name).toLowerCase() === value.toLowerCase() || id && String(item.id) === id);
      });
      return clean(account && account.name || value);
    };
    var dateKey = function (value) {
      var text = asciiDigits(value).replace(/-/g, "/");
      var slash = text.match(/(1[34]\d{2})\/(\d{1,2})\/(\d{1,2})/);
      if (slash) return [slash[1], slash[2].padStart(2, "0"), slash[3].padStart(2, "0")].join("/");
      var months = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
      var year = (text.match(/(?:^|\s)(1[34]\d{2})(?:\s|$)/) || [])[1];
      var month = months.findIndex(function (name) { return text.indexOf(name) !== -1; }) + 1;
      var dayMatch = text.match(/(?:^|[^0-9])(\d{1,2})(?=[^0-9]|$)/);
      var day = dayMatch && Number(dayMatch[1]);
      return year && month && day ? [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("/") : "";
    };
    var headerFor = function (card) {
      return Array.from(card.children).find(function (node) { return node.classList.contains("grid") && node.classList.contains("grid-cols-3"); });
    };
    var documentNumber = function (card) {
      var header = headerFor(card);
      var cell = header && header.children[0];
      var match = cell && clean(cell.textContent).match(/#\s*[0-9۰-۹٠-٩]+/);
      return match ? digits(match[0]) : "";
    };
    var reportDate = function (card) {
      var header = headerFor(card);
      var cell = header && header.children[0];
      var date = cell && cell.querySelector("[data-hesabno-relative-date]");
      return dateKey(date && date.textContent || cell && cell.textContent);
    };
    var transactionForCard = function (card, transactions) {
      var knownId = card.dataset.hesabnoReportCompoundId;
      if (knownId) {
        var known = transactions.find(function (item) { return item && String(item.id) === knownId; });
        if (known) return known;
      }
      var number = documentNumber(card);
      if (!number) return null;
      var matches = transactions.filter(function (item) {
        var value = item && (item.documentNumber != null ? item.documentNumber : item.docNum != null ? item.docNum : item.number);
        return item && item.isCompound && digits(value) === number;
      });
      if (matches.length > 1) {
        var date = reportDate(card);
        var dated = matches.filter(function (item) { return date && dateKey(item.date) === date; });
        if (dated.length) matches = dated;
      }
      var transaction = matches[0] || null;
      if (transaction) card.dataset.hesabnoReportCompoundId = String(transaction.id);
      return transaction;
    };
    var flowForCard = function (card) {
      return Array.from(card.children).find(function (node) {
        var text = clean(node.textContent);
        return text.indexOf("مبدأ:") === 0 && text.indexOf("مقصد:") !== -1;
      });
    };
    var sideName = function (flow, label) {
      if (!flow) return "";
      var side = Array.from(flow.children).find(function (node) { return clean(node.textContent).indexOf(label + ":") === 0; });
      return clean(side && side.textContent).replace(new RegExp("^" + label + ":\\s*"), "");
    };
    var amountForCard = function (card) {
      var header = headerFor(card);
      var amount = header && header.children[1];
      return Number(digits(amount && amount.textContent)) || 0;
    };
    var findLeg = function (legs, name, amount, accounts) {
      if (!Array.isArray(legs) || !name) return null;
      var target = accountName(name, accounts).toLowerCase();
      var candidates = legs.filter(function (leg) { return leg && accountName(leg.account, accounts).toLowerCase() === target; });
      return candidates.find(function (leg) { return !amount || Number(digits(leg.amount)) === amount; }) || candidates[0] || null;
    };
    var findLegForCard = function (card, transaction, accounts) {
      var flow = flowForCard(card);
      var source = sideName(flow, "مبدأ") || clean(card.dataset.hesabnoFromText);
      var destination = sideName(flow, "مقصد") || clean(card.dataset.hesabnoToText);
      var amount = amountForCard(card);
      var preferred = transaction.type === "income"
        ? [{ legs: transaction.compoundSources, name: source, side: "source" }, { legs: transaction.compoundDestinations, name: destination, side: "destination" }]
        : [{ legs: transaction.compoundDestinations, name: destination, side: "destination" }, { legs: transaction.compoundSources, name: source, side: "source" }];
      for (var i = 0; i < preferred.length; i += 1) {
        var choice = preferred[i];
        var leg = findLeg(choice.legs, choice.name, amount, accounts);
        if (leg) return { leg: leg, legs: choice.legs, side: choice.side, name: accountName(leg.account, accounts) };
      }
      return null;
    };
    var isAggregateDescription = function (value, legs, accounts) {
      var text = clean(value).toLowerCase();
      var names = (Array.isArray(legs) ? legs : []).map(function (leg) { return accountName(leg && leg.account, accounts).toLowerCase(); }).filter(Boolean);
      return names.length > 1 && names.every(function (name) { return text.indexOf(name) !== -1; });
    };
    var descriptionRow = function (card) {
      return Array.from(card.children).find(function (node) {
        return node.dataset.hesabnoStatementDescription === "true" || clean(node.textContent).indexOf("توضیحات:") === 0 || clean(node.textContent).indexOf("شرح:") === 0;
      });
    };
    var updateDescription = function (card, transaction, match, accounts) {
      var row = descriptionRow(card);
      if (card.dataset.hesabnoShowDescription === "false") {
        if (row) row.remove();
        return;
      }
      var leg = match.leg;
      var note = clean(leg.description || leg.notes || leg.note || leg.memo);
      var notes = [transaction.description, transaction.notes, transaction.note, transaction.memo].map(clean).filter(Boolean);
      var shared = notes.find(function (value) { return !isAggregateDescription(value, match.legs, accounts); }) || "";
      var display = note || shared;
      if (!row && display) {
        row = document.createElement("div");
        row.className = "hesabno-statement-description";
        row.dataset.hesabnoStatementDescription = "true";
        row.dataset.hesabnoReportCompoundDescription = "true";
        var label = document.createElement("span");
        label.className = "hesabno-statement-description-label";
        label.textContent = "توضیحات:";
        var value = document.createElement("span");
        value.className = "hesabno-statement-description-value";
        row.append(label, value);
        var party = Array.from(card.children).find(function (node) { return node.dataset.hesabnoCounterpartyRow === "true"; });
        card.insertBefore(row, party ? party.nextSibling : card.lastElementChild);
      }
      if (!row) return;
      row.classList.add("hesabno-statement-description");
      row.dataset.hesabnoStatementDescription = "true";
      row.dataset.hesabnoReportCompoundDescription = "true";
      if (!display) {
        row.style.setProperty("display", "none", "important");
        return;
      }
      row.style.removeProperty("display");
      var labelNode = row.querySelector(".hesabno-statement-description-label") || row.querySelector("span");
      if (labelNode) {
        labelNode.className = "hesabno-statement-description-label";
        if (clean(labelNode.textContent) !== "توضیحات:") labelNode.textContent = "توضیحات:";
      }
      var valueNode = row.querySelector(".hesabno-statement-description-value") || Array.from(row.querySelectorAll("span")).find(function (node) { return node !== labelNode; });
      if (valueNode) {
        valueNode.className = "hesabno-statement-description-value";
        if (clean(valueNode.textContent) !== display) valueNode.textContent = display;
        valueNode.title = display;
      }
    };
    var hideDocumentNumber = function (card) {
      var header = headerFor(card);
      var dateCell = header && header.children[0];
      var badge = dateCell && Array.from(dateCell.querySelectorAll("span")).find(function (node) { return /^#\s*[0-9۰-۹٠-٩]+$/.test(clean(node.textContent)); });
      if (badge) badge.style.setProperty("display", "none", "important");
    };
    var render = function () {
      var heading = Array.from(document.querySelectorAll("h1")).find(function (node) { return clean(node.textContent) === "گزارش صورتحساب"; });
      if (!heading) return;
      var root = heading.closest("main") || heading.closest("div.w-full.flex.flex-col") || document;
      var accounts = readArray("hesabno:accounts_v5");
      var transactions = readArray("hesabno:transactions");
      var columns = Array.from(root.querySelectorAll("div.grid.grid-cols-3")).find(function (node) {
        var text = clean(node.textContent);
        return (text.indexOf("تاریخ و سند") !== -1 || text.indexOf("تاریخ") !== -1) && (text.indexOf("مبلغ تراکنش") !== -1 || text.indexOf("مبلغ گردش") !== -1);
      });
      if (columns) {
        columns.classList.add("hesabno-statement-columns");
        var label = Array.from(columns.querySelectorAll("*")).find(function (node) { return clean(node.textContent) === "تاریخ و سند"; });
        if (label) label.textContent = "تاریخ";
        var amountLabel = Array.from(columns.querySelectorAll("*")).find(function (node) { return clean(node.textContent) === "مبلغ تراکنش"; });
        if (amountLabel) amountLabel.textContent = "مبلغ گردش";
      }
      var cards = Array.from(root.querySelectorAll("div")).filter(function (card) {
        if (card.classList.contains("hesabno-statement-opening-balance")) return false;
        var header = headerFor(card);
        return header && (flowForCard(card) || card.dataset.hesabnoStatementCard === "true");
      });
      cards.forEach(function (card) {
        var transaction = transactionForCard(card, transactions);
        hideDocumentNumber(card);
        if (!transaction) return;
        var match = findLegForCard(card, transaction, accounts);
        if (!match) return;
        card.dataset.hesabnoReportCompoundLeg = match.side + "|" + match.name;
        updateDescription(card, transaction, match, accounts);
      });
    };
    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(function () { scheduled = false; render(); });
    };
    render();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
  })();
