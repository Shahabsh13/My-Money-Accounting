(function () {
    var months = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var ascii = function (value) {
      return String(value == null ? "" : value).replace(/[۰-۹٠-٩]/g, function (digit) {
        var index = "۰۱۲۳۴۵۶۷۸۹".indexOf(digit);
        return String(index < 0 ? "٠١٢٣٤٥٦٧٨٩".indexOf(digit) : index);
      });
    };
    var digits = function (value) { return ascii(value).replace(/\D/g, ""); };
    var readArray = function (key) {
      try {
        var raw = window.__safeGet ? window.__safeGet(key) : localStorage.getItem(key);
        var value = JSON.parse(raw || "null");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var accountFor = function (reference, accounts) {
      var value = clean(reference);
      var id = ascii(value);
      return accounts.find(function (account) {
        return account && (clean(account.name).toLowerCase() === value.toLowerCase() || /^\d+$/.test(id) && String(account.id) === id);
      }) || null;
    };
    var accountName = function (reference, accounts) {
      var value = clean(reference);
      var account = accountFor(value, accounts);
      if (!account) return value;
      if (account.group === "bank") {
        var bank = clean(account.bankName || account.name);
        var title = clean(account.customTitle || (clean(account.name) !== bank ? account.name : ""));
        return [bank, title && title !== bank ? title : ""].filter(Boolean).join(" • ");
      }
      return clean(account.name) || value;
    };
    var accountForRow = function (title, transaction, accounts) {
      return accountFor(title, accounts) ||
        accountFor(transaction && transaction.category, accounts) ||
        accountFor(transaction && transaction.categoryId, accounts) ||
        accountFor(transaction && transaction.title, accounts);
    };
    var dateKey = function (value) {
      var text = ascii(value).replace(/-/g, "/");
      var slash = text.match(/(13\d{2}|14\d{2})\/(\d{1,2})\/(\d{1,2})/);
      if (slash) return [slash[1], slash[2].padStart(2, "0"), slash[3].padStart(2, "0")].join("/");
      var year = (text.match(/(?:^|\D)(13\d{2}|14\d{2})(?:\D|$)/) || [])[1];
      var month = months.findIndex(function (name) { return text.indexOf(name) !== -1; }) + 1;
      if (!year || !month) return "";
      var name = months[month - 1];
      var before = new RegExp("(\\d{1,2})\\s*" + name).exec(text);
      var after = new RegExp(name + "\\s*(\\d{1,2})").exec(text);
      var day = before ? Number(before[1]) : after ? Number(after[1]) : 0;
      return day ? [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("/") : "";
    };
    var storedDocumentNumber = function (transaction) {
      return transaction && (transaction.documentNumber != null ? transaction.documentNumber : transaction.docNum != null ? transaction.docNum : transaction.number);
    };
    var documentNumberFromText = function (value) {
      var match = clean(value).match(/(?:سند\s*#?\s*|#\s*)([0-9۰-۹٠-٩]+)/);
      return match ? digits(match[1]) : "";
    };
    var withoutDocumentNumber = function (value) {
      return clean(value).replace(/\s*[•·]\s*سند\s*#?\s*[0-9۰-۹٠-٩]+/g, "").replace(/\s*[•·]\s*$/g, "");
    };
    var transactionForRow = function (source, title, day, transactions) {
      var number = documentNumberFromText(source);
      var candidates = number ? transactions.filter(function (item) { return digits(storedDocumentNumber(item)) === number; }) : [];
      if (!candidates.length && day) {
        var titleKey = clean(title).toLowerCase();
        candidates = transactions.filter(function (item) {
          return dateKey(item && item.date) === day && [item.title, item.category, item.description].some(function (value) { return clean(value).toLowerCase() === titleKey; });
        });
      }
      if (day && candidates.length > 1) {
        var dated = candidates.filter(function (item) { return dateKey(item && item.date) === day; });
        if (dated.length) candidates = dated;
      }
      return candidates.find(function (item) { return clean(item && item.title).toLowerCase() === clean(title).toLowerCase(); }) || candidates[0] || null;
    };
    var groupOf = function (reference, accounts) {
      var account = accountFor(reference, accounts);
      return clean(account && account.group).toLowerCase();
    };
    var counterpartText = function (transaction, accounts) {
      if (!transaction) return "";
      if (transaction.type === "transfer") {
        var source = accountName(transaction.account || transaction.sourceAccount, accounts);
        var destination = accountName(transaction.destinationAccount || transaction.toAccount, accounts);
        return source && destination ? "از: " + source + " • به: " + destination : "اطلاعات انتقال ثبت نشده";
      }
      var reference = transaction.account || transaction.sourceAccount || transaction.counterAccount || transaction.counterpartyAccount || transaction.destinationAccount;
      var direction = transaction.type === "income" ? "به: " : "از: ";
      return reference ? direction + accountName(reference, accounts) : "";
    };
    var visibleCompoundLegs = function (transaction, accounts) {
      var sources = Array.isArray(transaction.compoundSources) ? transaction.compoundSources : [];
      var destinations = Array.isArray(transaction.compoundDestinations) ? transaction.compoundDestinations : [];
      return destinations.map(function (leg) { return { leg: leg, opposite: sources }; }).concat(
        sources.filter(function (leg) { return groupOf(leg && leg.account, accounts) === "income"; }).map(function (leg) { return { leg: leg, opposite: destinations }; })
      );
    };
    var legForRow = function (row, source, transaction, accounts, used) {
      var name = clean(withoutDocumentNumber(source)).toLowerCase();
      var amount = digits(row.lastElementChild && row.lastElementChild.textContent);
      var legs = visibleCompoundLegs(transaction, accounts).filter(function (item) {
        return item.leg && accountName(item.leg.account, accounts).toLowerCase() === name;
      });
      var selected = legs.find(function (item) { return !used.has(item.leg) && amount && digits(item.leg.amount) === amount; }) ||
        legs.find(function (item) { return !used.has(item.leg); }) ||
        visibleCompoundLegs(transaction, accounts).find(function (item) { return item.leg && !used.has(item.leg) && amount && digits(item.leg.amount) === amount; }) ||
        visibleCompoundLegs(transaction, accounts).find(function (item) { return item.leg && !used.has(item.leg); });
      if (selected) used.add(selected.leg);
      return selected || null;
    };
    var oppositeText = function (legs, current, accounts, type) {
      var names = Array.from(new Set((Array.isArray(legs) ? legs : []).map(function (leg) {
        return leg && accountName(leg.account, accounts);
      }).filter(function (name) { return name && name.toLowerCase() !== clean(current).toLowerCase(); })));
      var direction = type === "income" ? "به: " : "از: ";
      return names.length ? direction + names.join("، ") : direction + "حساب ثبت نشده";
    };
    var fallbackCounterpart = function (source, title, transaction) {
      var sourceText = clean(source);
      var priorDirection = sourceText.match(/^(از|به)\s*[:：]/);
      sourceText = sourceText.replace(/^حساب مقابل\s*[:：]?\s*/, "").replace(/^(?:از|به)\s*[:：]?\s*/, "");
      var parts = withoutDocumentNumber(sourceText).split(/\s*[•·]\s*/).map(clean).filter(Boolean);
      var titleKey = clean(title).toLowerCase();
      var candidates = parts.filter(function (part) { return part.toLowerCase() !== titleKey; });
      var type = clean(transaction && transaction.type).toLowerCase();
      var direction = type === "income" ? "به: " : type === "expense" ? "از: " : priorDirection ? (priorDirection[1] === "به" ? "به: " : "از: ") : "";
      return candidates.length ? direction + candidates[candidates.length - 1] : "حساب ثبت نشده";
    };
    var render = function () {
      var root = Array.from(document.querySelectorAll("main")).find(function (main) {
        return Array.from(main.querySelectorAll("h1")).some(function (heading) { return clean(heading.textContent).indexOf("گزارش هزینه و درآمد") === 0; });
      });
      if (!root) return;
      Array.from(root.querySelectorAll("span")).forEach(function (node) {
        if (clean(node.textContent) === "ماه انتخابی" && node.dataset.hesabnoDailyMonthSelectedLabel !== "true") {
          node.dataset.hesabnoDailyMonthSelectedLabel = "true";
        }
      });
      var heading = Array.from(root.querySelectorAll("h3")).find(function (node) { return clean(node.textContent).indexOf("تراکنش‌ها به تفکیک روز") === 0; });
      if (!heading) return;
      var headingText = Array.from(heading.querySelectorAll("span")).find(function (node) { return clean(node.textContent).indexOf("تراکنش‌ها به تفکیک روز") === 0; });
      if (headingText) {
        var plainHeading = clean(headingText.textContent).replace(/\s*\(با جمع روزانه\)\s*$/, "");
        if (headingText.textContent !== plainHeading) headingText.textContent = plainHeading;
      }
      var panel = heading.closest("div.rounded-xl");
      if (!panel) return;
      var accounts = readArray("hesabno:accounts_v5");
      var transactions = readArray("hesabno:transactions");
      var days = Array.from(panel.querySelectorAll("div")).filter(function (node) {
        return node.classList.contains("rounded-lg") && node.classList.contains("bg-stone-900") &&
          Array.from(node.children).some(function (child) { return child.tagName === "BUTTON"; }) &&
          Array.from(node.children).some(function (child) { return child.classList.contains("p-1.5"); });
      });
      days.forEach(function (dayNode) {
        var dayButton = Array.from(dayNode.children).find(function (child) { return child.tagName === "BUTTON"; });
        var day = dateKey(dayButton && dayButton.textContent);
        var usedByTransaction = new Map();
        var rows = Array.from(dayNode.querySelectorAll("div")).filter(function (row) {
          return row.classList.contains("p-2") && row.classList.contains("rounded-md") && row.querySelectorAll("p").length >= 2;
        });
        rows.forEach(function (row) {
          var left = row.firstElementChild;
          var icon = left && left.firstElementChild;
          var details = left && left.children[1];
          var paragraphs = details && details.querySelectorAll("p");
          var title = paragraphs && paragraphs[0];
          var meta = paragraphs && paragraphs[1];
          if (!title || !meta) return;
          var source = meta.dataset.hesabnoDailySource;
          var lastRenderedLabel = meta.dataset.hesabnoDailyRenderedLabel;
          if (!source || lastRenderedLabel && clean(meta.textContent) !== lastRenderedLabel) {
            source = clean(meta.textContent);
            meta.dataset.hesabnoDailySource = source;
          }
          var transaction = transactionForRow(source, title.textContent, day, transactions);
          Array.from(row.querySelectorAll("span")).forEach(function (badge) {
            if (/^(?:اصلاحیه\s*#?\s*|#\s*)[0-9۰-۹٠-٩]+$/.test(clean(badge.textContent))) badge.style.setProperty("display", "none", "important");
          });
          var label = "";
          if (transaction && transaction.isCompound) {
            var used = usedByTransaction.get(transaction) || new Set();
            usedByTransaction.set(transaction, used);
            var match = legForRow(row, source, transaction, accounts, used);
            if (match) {
              var legName = accountName(match.leg.account, accounts);
              if (legName && title.textContent !== legName) title.textContent = legName;
              title.title = legName;
              label = oppositeText(match.opposite, legName, accounts, transaction.type);
            }
          } else if (transaction) {
            label = counterpartText(transaction, accounts);
          }
          if (!label) label = fallbackCounterpart(source, title.textContent, transaction);
          var rowAccount = accountForRow(title.textContent, transaction, accounts);
          if (icon) {
            var picture = clean(rowAccount && (rowAccount.picture || rowAccount.icon || rowAccount.emoji));
            if (picture && icon.textContent !== picture) icon.textContent = picture;
            var iconLabel = clean(rowAccount && rowAccount.name) || "تراکنش مالی";
            icon.setAttribute("aria-label", iconLabel);
            icon.title = iconLabel;
          }
          if (meta.textContent !== label) meta.textContent = label;
          meta.title = label;
          meta.dataset.hesabnoDailyRenderedLabel = label;
          row.dataset.hesabnoDailyLedgerRow = "true";
        });
      });
    };
    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () { scheduled = false; render(); });
    };
    render();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, characterData: true, subtree: true }, schedule);
    window.addEventListener("storage", function (event) {
      if (!event.key || event.key === "hesabno:transactions" || event.key === "hesabno:accounts_v5") schedule();
    });
  })();
