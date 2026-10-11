(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var asciiDigits = function (value) {
      return String(value || "").replace(/[۰-۹٠-٩]/g, function (digit) {
        var fa = "۰۱۲۳۴۵۶۷۸۹".indexOf(digit);
        return String(fa < 0 ? "٠١٢٣٤٥٦٧٨٩".indexOf(digit) : fa);
      });
    };
    var faDigits = function (value) {
      return String(value).replace(/[0-9]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]; });
    };
    var readArray = function (key) {
      try {
        var raw = window.__safeGet ? window.__safeGet(key) : localStorage.getItem(key);
        var value = JSON.parse(raw || "null");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var accountName = function (value, accounts) {
      var name = clean(value);
      var match = accounts.find(function (item) { return item && String(item.id) === asciiDigits(name); });
      return match ? clean(match.name) : name;
    };
    var familyName = function (value) {
      if (value && typeof value === "object") return clean(value.name || value.fullName || value.title || value.label);
      return clean(value);
    };
    var dateParts = function (value) {
      var match = asciiDigits(value).replace(/-/g, "/").match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (!match) return null;
      return { year: match[1], month: match[2].padStart(2, "0"), day: match[3].padStart(2, "0") };
    };
    var dateLabel = function (value) {
      var parts = dateParts(value);
      return parts ? faDigits(parts.year + "/" + parts.month + "/" + parts.day) : "";
    };
    var documentNumber = function (card) {
      var header = Array.from(card.children).find(function (node) { return node.classList.contains("grid"); });
      var cell = header && header.children[0];
      var match = cell && asciiDigits(cell.textContent).match(/#\s*(\d+)/);
      return match ? match[1] : card.dataset.hesabnoStatementDocument || "";
    };
    var transactionForCard = function (card, transactions, accounts, selectedName) {
      var number = documentNumber(card);
      if (!number) return null;
      var matches = transactions.filter(function (item) {
        var doc = item && (item.documentNumber != null ? item.documentNumber : item.docNum != null ? item.docNum : item.number);
        return item && asciiDigits(doc) === number;
      });
      if (matches.length > 1 && selectedName) {
        var selected = clean(selectedName).toLowerCase();
        var relevant = matches.filter(function (item) {
          return [item.account, item.sourceAccount, item.destinationAccount].some(function (value) {
            var name = accountName(value, accounts).toLowerCase();
            return name === selected || name.indexOf(selected) !== -1 || selected.indexOf(name) !== -1;
          });
        });
        if (relevant.length) matches = relevant;
      }
      if (matches.length > 1) {
        var cell = Array.from(card.children).find(function (node) { return node.classList.contains("grid"); });
        var displayedDate = cell && cell.children[0] ? asciiDigits(cell.children[0].textContent).replace(/#\s*\d+.*$/, "") : "";
        var byDate = matches.filter(function (item) {
          var parts = dateParts(item.date);
          var day = parts && String(Number(parts.day));
          return day && new RegExp("(^|[^0-9])" + day + "([^0-9]|$)").test(displayedDate);
        });
        if (byDate.length) matches = byDate;
      }
      return matches[0] || null;
    };
    var counterpartyFor = function (transaction, accounts, selectedName) {
      var type = clean(transaction && transaction.type).toLowerCase();
      var selected = clean(selectedName).toLowerCase();
      var partyName = "";
      var partyAccount = null;
      if (type === "income" || type === "expense") {
        var candidates = [transaction.counterparty, transaction.payee, transaction.merchant, transaction.category, transaction.title]
          .map(clean).filter(Boolean);
        for (var i = 0; i < candidates.length && !partyAccount; i += 1) {
          partyAccount = accounts.find(function (item) {
            if (!item || item.group === "bank" || item.group === "cash") return false;
            return clean(item.name) === candidates[i] || String(item.id) === asciiDigits(candidates[i]);
          }) || null;
        }
        partyName = partyAccount ? clean(partyAccount.name) : candidates[0] || "";
      } else {
        var source = accountName(transaction.sourceAccount || transaction.fromAccount || transaction.account, accounts);
        var destination = accountName(transaction.destinationAccount || transaction.toAccount, accounts);
        var sourceIsSelected = source && (source.toLowerCase() === selected || source.toLowerCase().indexOf(selected) !== -1 || selected.indexOf(source.toLowerCase()) !== -1);
        var destinationIsSelected = destination && (destination.toLowerCase() === selected || destination.toLowerCase().indexOf(selected) !== -1 || selected.indexOf(destination.toLowerCase()) !== -1);
        partyName = sourceIsSelected ? destination : destinationIsSelected ? source : source || destination || clean(transaction.category || transaction.title);
        partyAccount = accounts.find(function (item) { return item && clean(item.name) === partyName; }) || null;
      }
      if (!partyName) partyName = clean(transaction.category || transaction.title || transaction.account);
      var icon = partyAccount && clean(partyAccount.picture) || (type === "expense" ? "🛍️" : type === "income" ? "💰" : "↔");
      var image = "";
      if (partyAccount && partyAccount.group === "bank") {
        var logos = window.__HESABNO_OFFICIAL_BANK_LOGOS || {};
        var bankText = clean(partyAccount.bankName || partyAccount.name);
        var keys = Object.keys(logos).sort(function (a, b) { return b.length - a.length; });
        var key = keys.find(function (item) { return bankText.indexOf(item) !== -1; });
        if (key) image = logos[key];
      }
      if (transaction && (transaction.isLoanTransaction || transaction.loanId != null || transaction.installmentId != null) && window.__HESABNO_LOAN_LOGO) {
        image = window.__HESABNO_LOAN_LOGO;
        icon = "";
      }
      if (!image && /^(https?:|data:image\/)/i.test(icon)) { image = icon; icon = ""; }
      return { name: partyName, icon: icon, image: image };
    };
    var buildCounterpartyRow = function (party) {
      var row = document.createElement("div");
      row.className = "hesabno-statement-counterparty";
      row.dataset.hesabnoCounterpartyRow = "true";
      row.dataset.hesabnoPartyKey = party.name + "|" + party.icon + "|" + party.image;
      var icon = document.createElement("span");
      icon.className = "hesabno-statement-counterparty-icon";
      if (party.image) {
        var image = document.createElement("img");
        image.src = party.image;
        image.alt = "لوگوی " + party.name;
        image.loading = "lazy";
        icon.appendChild(image);
      } else icon.textContent = party.icon;
      var name = document.createElement("span");
      name.className = "hesabno-statement-counterparty-name";
      name.textContent = party.name;
      name.title = party.name;
      row.appendChild(icon);
      row.appendChild(name);
      return row;
    };
    var enhanceDescription = function (card, transaction) {
      var notes = transaction.hasManualDescription === false ? "" : clean(transaction.notes || transaction.description);
      var row = Array.from(card.children).find(function (node) {
        return node.dataset.hesabnoStatementDescription === "true" || clean(node.textContent).indexOf("توضیحات:") === 0;
      });
      if (!notes) {
        if (row) row.remove();
        card.dataset.hesabnoStatementHasManualDescription = "false";
        return;
      }
      card.dataset.hesabnoStatementHasManualDescription = "true";
      if (!row) {
        row = document.createElement("div");
        row.className = "hesabno-statement-description";
        row.dataset.hesabnoStatementDescription = "true";
        var label = document.createElement("span");
        label.className = "hesabno-statement-description-label";
        label.textContent = "توضیحات:";
        var value = document.createElement("span");
        value.className = "hesabno-statement-description-value";
        row.appendChild(label);
        row.appendChild(value);
        var party = Array.from(card.children).find(function (node) { return node.dataset.hesabnoCounterpartyRow === "true"; });
        card.insertBefore(row, party ? party.nextSibling : card.lastElementChild);
      }
      row.classList.add("hesabno-statement-description");
      row.dataset.hesabnoStatementDescription = "true";
      var valueNode = row.querySelector(".hesabno-statement-description-value") || Array.from(row.querySelectorAll("span")).pop();
      if (valueNode) {
        valueNode.classList.add("hesabno-statement-description-value");
        if (valueNode.textContent !== notes) valueNode.textContent = notes;
      }
      var labelNode = row.querySelector(".hesabno-statement-description-label") || row.querySelector("span");
      if (labelNode) labelNode.classList.add("hesabno-statement-description-label");
    };
    var syncMetadataSeparators = function (row) {
      var separators = Array.from(row.children).filter(function (node) { return node.dataset.hesabnoStatementMetadataDivider === "true"; });
      var items = Array.from(row.children).filter(function (node) {
        return node.dataset.hesabnoStatementMetadataDivider !== "true" && getComputedStyle(node).display !== "none";
      });
      var expected = Math.max(0, items.length - 1);
      var isAligned = separators.length === expected && items.slice(1).every(function (item) {
        var previous = item.previousElementSibling;
        while (previous && getComputedStyle(previous).display === "none") previous = previous.previousElementSibling;
        return previous && previous.dataset.hesabnoStatementMetadataDivider === "true";
      });
      if (isAligned) return;
      separators.forEach(function (node) { node.remove(); });
      items = Array.from(row.children).filter(function (node) { return node.dataset.hesabnoStatementMetadataDivider !== "true" && getComputedStyle(node).display !== "none"; });
      items.slice(1).forEach(function (item) {
        var divider = document.createElement("span");
        divider.className = "hesabno-statement-metadata-divider";
        divider.dataset.hesabnoStatementMetadataDivider = "true";
        divider.setAttribute("aria-hidden", "true");
        row.insertBefore(divider, item);
      });
    };
    var enhanceMetadata = function (card, transaction) {
      var project = clean(transaction.project);
      var family = familyName(transaction.familyMember);
      var metadataRows = Array.from(card.children).filter(function (node) { return node.classList.contains("flex-wrap"); });
      var row = metadataRows.find(function (node) { return node.dataset.hesabnoStatementMetadata === "true"; }) || metadataRows.find(function (node) {
        var text = clean(node.textContent);
        return project && text.indexOf(project) !== -1 || family && text.indexOf(family) !== -1 || /پروژه|عضو خانواده/u.test(text);
      });
      if (!row && (project || family)) {
        row = document.createElement("div");
        row.className = "flex flex-wrap items-center gap-1 pt-0.5";
        card.appendChild(row);
      }
      if (!row) return;
      row.dataset.hesabnoStatementMetadata = "true";
      metadataRows.filter(function (node) {
        if (node === row) return false;
        var text = clean(node.textContent);
        return project && text.indexOf(project) !== -1 || family && text.indexOf(family) !== -1 || /پروژه|عضو خانواده/u.test(text);
      }).forEach(function (node) { node.remove(); });
      var projectChip = Array.from(row.children).find(function (chip) {
        var text = clean(chip.textContent);
        return chip.dataset.hesabnoStatementProject === "true" || chip.classList.contains("hesabno-statement-project-chip") || project && text.indexOf(project) !== -1;
      });
      if (!project) {
        if (projectChip) projectChip.remove();
      } else {
        if (!projectChip) {
          projectChip = document.createElement("span");
          row.prepend(projectChip);
        }
        projectChip.className = "hesabno-statement-meta-chip hesabno-statement-project-chip hesabno-meta-project hesabno-canonical-meta-chip";
        projectChip.dataset.hesabnoStatementProject = "true";
        projectChip.setAttribute("data-hesabno-metadata-canonical-item", "project");
        projectChip.setAttribute("aria-label", "پروژه: " + project);
        projectChip.title = "پروژه: " + project;
        var projectIcon = projectChip.querySelector("svg");
        if (!projectIcon) {
          projectIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          projectIcon.setAttribute("viewBox", "0 0 24 24");
          projectIcon.setAttribute("fill", "none");
          projectIcon.setAttribute("stroke", "currentColor");
          projectIcon.setAttribute("stroke-width", "2");
          projectIcon.setAttribute("stroke-linecap", "round");
          projectIcon.setAttribute("stroke-linejoin", "round");
          projectIcon.setAttribute("aria-hidden", "true");
          ["M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z", "M8 10v4", "M12 10v2", "M16 10v6"].forEach(function (data) {
            var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", data);
            projectIcon.appendChild(path);
          });
          projectChip.replaceChildren(projectIcon);
        }
        var projectLabel = projectChip.querySelector("[data-hesabno-canonical-meta-label], .hesabno-meta-project-value");
        if (!projectLabel) {
          Array.from(projectChip.childNodes).forEach(function (node) {
            if (node !== projectIcon) node.remove();
          });
          projectLabel = document.createElement("span");
          projectChip.appendChild(projectLabel);
        }
        projectLabel.className = "hesabno-meta-project-value";
        projectLabel.setAttribute("data-hesabno-canonical-meta-label", "true");
        if (projectLabel.textContent !== "پروژه: " + project) projectLabel.textContent = "پروژه: " + project;
      }
      var familyChip = Array.from(row.children).find(function (chip) {
        return chip.dataset.hesabnoStatementFamily === "true" || chip.classList.contains("hesabno-statement-family-chip") || family && clean(chip.textContent).indexOf(family) !== -1;
      });
      if (!family) {
        if (familyChip) familyChip.remove();
        syncMetadataSeparators(row);
        return;
      }
      if (!familyChip) {
        familyChip = document.createElement("span");
        row.appendChild(familyChip);
      }
      familyChip.dataset.hesabnoStatementFamily = "true";
      familyChip.className = "hesabno-statement-meta-chip hesabno-statement-family-chip hesabno-meta-family hesabno-canonical-meta-chip";
      familyChip.setAttribute("data-hesabno-metadata-canonical-item", "family");
      familyChip.setAttribute("aria-label", "عضو خانواده: " + family);
      familyChip.title = "عضو خانواده: " + family;
      var familyIcon = familyChip.querySelector("svg");
      if (!familyIcon) {
        familyIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        familyIcon.setAttribute("viewBox", "0 0 24 24");
        familyIcon.setAttribute("fill", "none");
        familyIcon.setAttribute("stroke", "currentColor");
        familyIcon.setAttribute("stroke-width", "2");
        familyIcon.setAttribute("stroke-linecap", "round");
        familyIcon.setAttribute("stroke-linejoin", "round");
        familyIcon.setAttribute("aria-hidden", "true");
        ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M16 3.128a4 4 0 0 1 0 7.744", "M22 21v-2a4 4 0 0 0-3-3.87"].forEach(function (data) {
          var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", data);
          familyIcon.appendChild(path);
        });
        var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", "9");
        circle.setAttribute("cy", "7");
        circle.setAttribute("r", "4");
        familyIcon.appendChild(circle);
        familyChip.replaceChildren(familyIcon);
      }
      var familyLabel = familyChip.querySelector("[data-hesabno-canonical-meta-label], .hesabno-meta-family-value");
      if (!familyLabel) {
        Array.from(familyChip.childNodes).forEach(function (node) { if (node !== familyIcon) node.remove(); });
        familyLabel = document.createElement("span");
        familyChip.appendChild(familyLabel);
      }
      familyLabel.className = "hesabno-meta-family-value";
      familyLabel.setAttribute("data-hesabno-canonical-meta-label", "true");
      if (familyLabel.textContent !== "عضو خانواده: " + family) familyLabel.textContent = "عضو خانواده: " + family;
      syncMetadataSeparators(row);
    };
    var enhanceCard = function (card, transaction, accounts, selectedName) {
      card.dataset.hesabnoStatementCard = "true";
      var header = Array.from(card.children).find(function (node) { return node.classList.contains("grid"); });
      if (header && header.children.length >= 3) {
        var doc = documentNumber(card);
        if (doc) card.dataset.hesabnoStatementDocument = doc;
        header.style.setProperty("grid-template-columns", "repeat(3,minmax(0,1fr))", "important");
        var dateCell = header.children[0];
        dateCell.classList.remove("hesabno-statement-header-hidden-cell");
        dateCell.classList.add("hesabno-statement-date-cell");
        dateCell.setAttribute("dir", "ltr");
        var date = dateLabel(transaction.date);
        if (dateCell.textContent !== date) dateCell.textContent = date;
        dateCell.title = "تاریخ سند: " + date;
      }
      var oldFlow = Array.from(card.children).find(function (node) {
        return clean(node.textContent).indexOf("مبدأ:") !== -1 && clean(node.textContent).indexOf("مقصد:") !== -1;
      });
      var party = counterpartyFor(transaction, accounts, selectedName);
      var partyKey = party.name + "|" + party.icon + "|" + party.image;
      var partyRow = Array.from(card.children).find(function (node) { return node.dataset.hesabnoCounterpartyRow === "true"; });
      if (!partyRow || partyRow.dataset.hesabnoPartyKey !== partyKey) {
        var replacement = buildCounterpartyRow(party);
        if (partyRow) partyRow.replaceWith(replacement);
        else if (oldFlow) oldFlow.replaceWith(replacement);
        else {
          var description = Array.from(card.children).find(function (node) { return clean(node.textContent).indexOf("توضیحات:") === 0; });
          card.insertBefore(replacement, description || card.lastElementChild);
        }
      }
      enhanceDescription(card, transaction);
      enhanceMetadata(card, transaction);
    };
    var enhance = function () {
      var transactions = readArray("hesabno:transactions");
      var accounts = readArray("hesabno:accounts_v5");
      document.querySelectorAll(".hesabno-account-statement-panel").forEach(function (panel) {
        var lists = Array.from(panel.querySelectorAll("div.grow.overflow-y-auto"));
        var list = lists.find(function (node) {
          return Array.from(node.children).some(function (card) {
            var text = clean(card.textContent);
            return card.dataset.hesabnoStatementCard === "true" || text.indexOf("مبدأ:") !== -1 && text.indexOf("مقصد:") !== -1;
          });
        });
        if (!list) return;
        var selectedName = panel.dataset.hesabnoStatementAccount || "";
        var cards = Array.from(list.children).filter(function (card) {
          var text = clean(card.textContent);
          return card.dataset.hesabnoStatementCard === "true" || text.indexOf("مبدأ:") !== -1 && text.indexOf("مقصد:") !== -1;
        });
        var items = cards.map(function (card) {
          var transaction = transactionForCard(card, transactions, accounts, selectedName);
          if (transaction) enhanceCard(card, transaction, accounts, selectedName);
          var header = Array.from(card.children).find(function (node) { return node.classList.contains("grid"); });
          var dateText = header && header.children[0] ? clean(header.children[0].textContent) : "";
          var parts = transaction && dateParts(transaction.date);
          var key = parts ? parts.year + "/" + parts.month + "/" + parts.day : dateText;
          var label = transaction && dateLabel(transaction.date) || dateText;
          card.dataset.hesabnoStatementDateKey = key;
          card.dataset.hesabnoStatementDateLabel = label;
          return { card: card, dateKey: key, dateLabel: label };
        });
        Array.from(list.children).filter(function (node) { return node.classList.contains("hesabno-statement-day-header"); }).forEach(function (node) { node.remove(); });
        var sticky = panel.querySelector(".hesabno-statement-sticky-date");
        if (sticky) sticky.remove();
        var columns = Array.from(panel.querySelectorAll("div.grid.grid-cols-3")).find(function (node) {
          var text = clean(node.textContent);
          return text.indexOf("مبلغ گردش") !== -1 && text.indexOf("مانده لحظه‌ای") !== -1;
        });
        if (columns && columns.children.length >= 3) {
          columns.style.setProperty("grid-template-columns", "repeat(3,minmax(0,1fr))", "important");
          columns.children[0].classList.remove("hesabno-statement-header-hidden-cell");
          if (columns.children[0].textContent !== "تاریخ") columns.children[0].textContent = "تاریخ";
        }
      });
    };
    var frame = 0;
    var schedule = function () {
      if (frame) return;
      frame = requestAnimationFrame(function () { frame = 0; enhance(); });
    };
    enhance();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  })();
