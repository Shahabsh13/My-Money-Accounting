(function () {
      var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
      var normalize = function (value) { return clean(value).toLocaleLowerCase(); };
      var asciiDigits = function (value) {
        return String(value == null ? "" : value).replace(/[۰-۹٠-٩]/g, function (digit) {
          var fa = "۰۱۲۳۴۵۶۷۸۹".indexOf(digit);
          return String(fa < 0 ? "٠١٢٣٤٥٦٧٨٩".indexOf(digit) : fa);
        });
      };
      var faDigits = function (value) {
        return String(value).replace(/[0-9]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]; });
      };
      var readArray = function (key) {
        try {
          var value = JSON.parse(localStorage.getItem(key) || "null");
          return Array.isArray(value) ? value : [];
        } catch (error) { return []; }
      };
      var readAccounts = function () {
        return readArray("hesabno:accounts_v5");
      };
      var iconFor = function (name, group, list) {
        var key = normalize(name);
        var account = list.find(function (item) {
          return item && item.group === group && normalize(item.name) === key;
        });
        return account && account.picture ? account.picture : "";
      };
      var hide = function (node) {
        if (!node) return;
        if (node.getAttribute("data-hesabno-period-hidden") !== "true") node.setAttribute("data-hesabno-period-hidden", "true");
        if (node.getAttribute("aria-hidden") !== "true") node.setAttribute("aria-hidden", "true");
      };
      var show = function (node) {
        if (!node) return;
        node.removeAttribute("data-hesabno-period-hidden");
        node.removeAttribute("aria-hidden");
      };
      var dateLabel = function (value) {
        var text = clean(value).replace(/^(امروز|دیروز|پریروز)\s*،?\s*/, "");
        var normalized = asciiDigits(text).replace(/-/g, "/");
        var match = normalized.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
        if (!match) {
          var months = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
          var year = (normalized.match(/(?:^|\s)(\d{4})(?:\s|$)/) || [])[1];
          var month = months.findIndex(function (name) { return text.indexOf(name) !== -1; }) + 1;
          var dayMatch = normalized.match(/(?:^|[^0-9])(\d{1,2})(?=[^0-9]|$)/);
          var day = dayMatch && Number(dayMatch[1]);
          if (!year || !month || !day) return "";
          match = ["", year, String(month), String(day)];
        }
        var yearText = match[1];
        var monthText = String(Number(match[2])).padStart(2, "0");
        var dayText = String(Number(match[3])).padStart(2, "0");
        return faDigits(yearText + "/" + monthText + "/" + dayText);
      };
      var transactionForRow = function (row, transactions, group) {
        var titleGroup = row.children[0] && row.children[0].children[0];
        var badge = titleGroup && Array.from(titleGroup.children).find(function (node) {
          return node.tagName === "SPAN" && (/^#/.test(clean(node.textContent)) || node.dataset.hesabnoPeriodOriginalDoc);
        });
        var docText = badge && (badge.dataset.hesabnoPeriodOriginalDoc || badge.textContent);
        var number = docText && asciiDigits(docText).replace(/[^0-9]/g, "");
        var item = number && transactions.find(function (transaction) {
          var doc = transaction && (transaction.documentNumber != null ? transaction.documentNumber : transaction.docNum != null ? transaction.docNum : transaction.number != null ? transaction.number : transaction.id);
          return asciiDigits(doc).replace(/[^0-9]/g, "") === number;
        });
        if (item) return item;
        var title = titleGroup && Array.from(titleGroup.children).find(function (node) {
          return node.tagName === "SPAN" && node !== badge && (node.dataset.hesabnoPeriodOriginalTitle || clean(node.textContent));
        });
        var titleText = title && (title.dataset.hesabnoPeriodOriginalTitle || title.textContent);
        return transactions.find(function (transaction) {
          return transaction && transaction.type === group && normalize(transaction.title) === normalize(titleText);
        }) || null;
      };
      var compoundAccountNames = function (transaction, group) {
        var legs = group === "income"
          ? transaction && transaction.compoundDestinations
          : transaction && transaction.compoundSources;
        var names = [];
        (Array.isArray(legs) ? legs : []).forEach(function (leg) {
          var account = leg && leg.account;
          var name = clean(account && typeof account === "object" ? account.name : account);
          if (!name || Number(leg.amount) === 0 || names.some(function (item) { return normalize(item) === normalize(name); })) return;
          names.push(name);
        });
        if (!names.length) {
          var fallback = group === "income"
            ? transaction && (transaction.destinationAccount || transaction.account)
            : transaction && (transaction.account || transaction.sourceAccount);
          fallback = clean(fallback);
          if (fallback) names.push(fallback);
        }
        return names;
      };
      var ensureChip = function (footer, attribute, text, className) {
        var selector = "[" + attribute + '="true"]';
        var chip = footer.querySelector(selector);
        if (!text) {
          if (chip) chip.remove();
          return null;
        }
        if (!chip) {
          chip = document.createElement("span");
          chip.setAttribute(attribute, "true");
          chip.className = className;
          footer.appendChild(chip);
        }
        if (chip.textContent !== text) chip.textContent = text;
        return chip;
      };
      var manualDescriptionFor = function (transaction, row, existingNode) {
        if (transaction && transaction.hasManualDescription === false) return "";
        var source = transaction && transaction.hasManualDescription === true
          ? transaction.notes || transaction.description
          : transaction && (transaction.description || transaction.notes);
        if (source) return clean(source);
        if (existingNode) return clean(existingNode.textContent);
        var valueNode = row.querySelector('[data-hesabno-period-manual-value="true"]');
        return clean(valueNode && valueNode.textContent);
      };
      var syncMetadataFooter = function (row, titleLine, accountLine, transaction) {
        var footer = row.querySelector('[data-hesabno-period-footer="true"]');
        var manualBox = row.querySelector('[data-hesabno-period-manual-description="true"]');
        if (!footer) {
          footer = Array.from(row.children).find(function (node) {
            return node !== titleLine && node !== accountLine && node !== manualBox && node.getAttribute("data-hesabno-period-compound-details") !== "true";
          }) || null;
        }
        var descriptionWrap = footer && footer.querySelector("div.flex.items-center.gap-1.truncate.grow");
        var descriptionNode = descriptionWrap && descriptionWrap.querySelector("span.truncate");
        var manualText = manualDescriptionFor(transaction, row, descriptionNode);
        if (descriptionWrap) hide(descriptionWrap);
        if (manualText) {
          if (!manualBox) {
            manualBox = document.createElement("div");
            manualBox.setAttribute("data-hesabno-period-manual-description", "true");
            manualBox.setAttribute("role", "note");
            manualBox.setAttribute("aria-label", "توضیحات سند");
            var label = document.createElement("span");
            label.setAttribute("data-hesabno-period-manual-label", "true");
            label.textContent = "توضیحات:";
            var value = document.createElement("span");
            value.setAttribute("data-hesabno-period-manual-value", "true");
            manualBox.appendChild(label);
            manualBox.appendChild(value);
          }
          var valueNode = manualBox.querySelector('[data-hesabno-period-manual-value="true"]');
          if (valueNode && valueNode.textContent !== manualText) valueNode.textContent = manualText;
          manualBox.title = manualText;
          var before = footer || null;
          if (manualBox.parentElement !== row || manualBox.nextSibling !== before) row.insertBefore(manualBox, before);
        } else if (manualBox) manualBox.remove();

        var project = clean(transaction && transaction.project);
        var family = clean(transaction && transaction.familyMember);
        var check = transaction && transaction.check;
        var checkNumber = clean(check && (check.number || check.checkNumber || check.sayadNumber) || transaction && transaction.checkNumber);
        var checkText = check || transaction && transaction.checkNumber ? "چک" + (checkNumber ? ": " + faDigits(asciiDigits(checkNumber)) : "") : "";
        var reversalText = transaction && transaction.isReversal
          ? "اصلاحیه" + (transaction.reversalOfDocNumber ? " · عطف به #" + faDigits(asciiDigits(transaction.reversalOfDocNumber)) : "")
          : "";
        var reversedText = transaction && transaction.reversedByDocNumber ? "اصلاح‌شده" : "";
        var compoundText = transaction && transaction.isCompound ? "سند مرکب" : "";
        if (!footer && (project || family || checkText || reversalText || reversedText || compoundText)) {
          footer = document.createElement("div");
          row.appendChild(footer);
        }
        if (!footer) return;
        footer.setAttribute("data-hesabno-period-footer", "true");
        footer.removeAttribute("data-hesabno-period-description");
        var projectChip = Array.from(footer.querySelectorAll("span")).find(function (node) {
          return node.getAttribute("data-hesabno-period-project") === "true" || (node.classList.contains("bg-purple-950/60") && node.querySelector("svg"));
        });
        if (projectChip) projectChip.setAttribute("data-hesabno-period-project", "true");
        else if (project) {
          projectChip = document.createElement("span");
          projectChip.className = "px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/40 text-purple-300 font-bold shrink-0";
          projectChip.setAttribute("data-hesabno-period-project", "true");
          projectChip.textContent = "پروژه: " + project;
          footer.appendChild(projectChip);
        }
        var compoundChip = ensureChip(footer, "data-hesabno-period-compound-meta", compoundText, "");
        if (compoundChip) {
          var firstVisibleMeta = projectChip || footer.firstChild;
          if (firstVisibleMeta && compoundChip !== firstVisibleMeta && compoundChip.nextSibling !== firstVisibleMeta) footer.insertBefore(compoundChip, firstVisibleMeta);
        }
        ensureChip(footer, "data-hesabno-period-family", family ? "عضو خانواده: " + family : "", "");
        ensureChip(footer, "data-hesabno-period-check", checkText, "");
        var reversalChip = footer.querySelector('[data-hesabno-period-reversal="true"]') || Array.from(footer.querySelectorAll("span")).find(function (node) {
          return clean(node.textContent).indexOf("اصلاحیه") === 0;
        });
        if (reversalText && !reversalChip) {
          reversalChip = document.createElement("span");
          footer.appendChild(reversalChip);
        }
        if (reversalChip && reversalText) {
          reversalChip.setAttribute("data-hesabno-period-reversal", "true");
          if (reversalChip.textContent !== reversalText) reversalChip.textContent = reversalText;
        }
        ensureChip(footer, "data-hesabno-period-reversed", reversedText, "");
        var hasMetadata = Array.from(footer.children).some(function (node) {
          return node !== descriptionWrap && node.getAttribute("data-hesabno-period-hidden") !== "true" && clean(node.textContent);
        });
        if (hasMetadata) footer.removeAttribute("data-hesabno-period-footer-empty");
        else footer.setAttribute("data-hesabno-period-footer-empty", "true");
      };
      var sync = function () {
        var modal = Array.from(document.querySelectorAll("div.max-w-md")).find(function (node) {
          return node.classList.contains("max-h-[88vh]") && node.querySelector("header h2") && node.querySelector("header h2").textContent.indexOf("هزینه‌ها و درآمدها") >= 0;
        });
        if (!modal) return;
        var buttons = Array.from(modal.querySelectorAll("button"));
        var income = buttons.some(function (button) { return button.textContent.indexOf("درآمدها") >= 0 && button.classList.contains("bg-emerald-500/20"); });
        var isToday = buttons.some(function (button) { return button.textContent.indexOf("امروز") >= 0 && button.classList.contains("bg-amber-500"); });
        var group = income ? "income" : "expense";
        modal.setAttribute("data-hesabno-period-modal", "true");
        modal.setAttribute("data-hesabno-period-mode", isToday ? "today" : "month");
        var footerLabel = modal.querySelector("footer > span:first-child");
        if (footerLabel) {
          var label = isToday ? "خالص امروز (درآمد − هزینه):" : "خالص ماه (درآمد − هزینه):";
          if (footerLabel.textContent !== label) footerLabel.textContent = label;
          footerLabel.title = "درآمد منهای هزینه‌های همین بازه؛ مقدار منفی یعنی هزینه‌ها بیشتر از درآمد بوده‌اند.";
        }
        var list = Array.from(modal.querySelectorAll("div")).find(function (node) {
          return node.classList.contains("grow") && node.classList.contains("overflow-y-auto") && node.classList.contains("min-h-[140px]");
        });
        if (!list) return;
        var rows = Array.from(list.children).filter(function (row) { return row.classList.contains("cursor-pointer") && row.children.length >= 2; });
        if (!rows.length) {
          list.removeAttribute("data-hesabno-period-list");
          return;
        }
        list.setAttribute("data-hesabno-period-list", "true");
        var accounts = readAccounts();
        var transactions = readArray("hesabno:transactions");
        rows.forEach(function (row) {
          row.setAttribute("data-hesabno-period-row", "true");
          var titleLine = row.children[0];
          var titleGroup = titleLine && titleLine.children[0];
          var icon = titleGroup && titleGroup.children[0];
          var accountLine = row.children[1];
          var details = accountLine && accountLine.children[0];
          var category = details && details.children[0];
          var transaction = transactionForRow(row, transactions, group);
          var badge = titleGroup && Array.from(titleGroup.children).find(function (node) {
            return node.tagName === "SPAN" && (/^#/.test(clean(node.textContent)) || node.dataset.hesabnoPeriodOriginalDoc);
          });
          var isCompound = !!(transaction && transaction.isCompound);
          var title = titleGroup && Array.from(titleGroup.children).find(function (node) {
            return node.tagName === "SPAN" && node !== badge && (node.dataset.hesabnoPeriodOriginalTitle || clean(node.textContent));
          });
          var originalTitle = title && (title.dataset.hesabnoPeriodOriginalTitle || title.textContent);
          var manualText = manualDescriptionFor(transaction, row);
          var categoryName = clean(transaction && transaction.category || category && category.textContent);
          if (icon && isCompound) {
            icon.setAttribute("data-hesabno-period-category-icon", "🔀");
            icon.setAttribute("data-hesabno-period-type", group);
            icon.setAttribute("data-hesabno-period-compound-icon", "true");
          } else if (icon) {
            var picture = iconFor(category && category.textContent, group, accounts);
            icon.removeAttribute("data-hesabno-period-compound-icon");
            if (picture) {
              icon.setAttribute("data-hesabno-period-category-icon", picture);
              icon.setAttribute("data-hesabno-period-type", group);
            } else {
              icon.removeAttribute("data-hesabno-period-category-icon");
              icon.removeAttribute("data-hesabno-period-type");
            }
          }
          if (title && isCompound) {
            if (!title.dataset.hesabnoPeriodOriginalTitle) title.dataset.hesabnoPeriodOriginalTitle = title.textContent;
            if (title.textContent !== "سند مرکب") title.textContent = "سند مرکب";
            show(title);
            title.removeAttribute("aria-label");
          } else if (title) {
            var titleIsManualDescription = manualText && normalize(originalTitle) === normalize(manualText);
            if (titleIsManualDescription && categoryName && normalize(categoryName) !== normalize(manualText)) {
              if (!title.dataset.hesabnoPeriodOriginalTitle) title.dataset.hesabnoPeriodOriginalTitle = originalTitle;
              if (title.textContent !== categoryName) title.textContent = categoryName;
            } else if (title.dataset.hesabnoPeriodOriginalTitle) {
              title.textContent = title.dataset.hesabnoPeriodOriginalTitle;
              delete title.dataset.hesabnoPeriodOriginalTitle;
            }
            show(title);
            title.removeAttribute("aria-label");
          }
          if (badge) {
            if (isCompound) badge.setAttribute("data-hesabno-period-compound-badge", "true");
            else badge.removeAttribute("data-hesabno-period-compound-badge");
            hide(badge);
          }
          if (details) {
            var accountNames = isCompound ? compoundAccountNames(transaction, group) : [];
            Array.from(details.children).forEach(function (node, index) {
              if (index === 2) {
                node.setAttribute("data-hesabno-period-account", "true");
                if (isCompound && accountNames.length) {
                  if (!node.hasAttribute("data-hesabno-period-original-account")) {
                    node.setAttribute("data-hesabno-period-original-account", node.textContent);
                  }
                  var accountText = accountNames.join("، ");
                  if (node.textContent !== accountText) node.textContent = accountText;
                  if (accountNames.length > 1) node.setAttribute("data-hesabno-period-multiple-accounts", "true");
                  else node.removeAttribute("data-hesabno-period-multiple-accounts");
                  show(node);
                } else if (isCompound) hide(node);
                else {
                  var originalAccount = node.getAttribute("data-hesabno-period-original-account");
                  if (originalAccount !== null) {
                    if (node.textContent !== originalAccount) node.textContent = originalAccount;
                    node.removeAttribute("data-hesabno-period-original-account");
                  }
                  node.removeAttribute("data-hesabno-period-multiple-accounts");
                  show(node);
                }
              } else hide(node);
            });
          }
          var date = accountLine && (accountLine.querySelector("[data-hesabno-relative-date]") || accountLine.children[1]);
          if (date) {
            date.setAttribute("data-hesabno-period-date", "true");
            date.setAttribute("dir", "ltr");
            var numericDate = dateLabel(transaction && transaction.date || date.textContent);
            if (!isToday && numericDate) {
              if (date.textContent !== numericDate) date.textContent = numericDate;
              show(date);
            } else hide(date);
          }
          syncMetadataFooter(row, titleLine, accountLine, transaction);
        });
      };
      var queued = false;
      var schedule = function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () { queued = false; sync(); });
      };
      sync();
      if (document.body) new MutationObserver(function () { sync(); }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
      document.addEventListener("click", function (event) {
        var target = event.target;
        var button = target && target.closest ? target.closest("button") : null;
        var modal = button && button.closest("div.max-w-md");
        var heading = modal && modal.querySelector("header h2");
        if (!heading || clean(heading.textContent).indexOf("هزینه‌ها و درآمدها") < 0) return;
        if (!/هزینه‌ها|درآمدها|امروز|ماهانه/.test(clean(button.textContent))) return;
        sync();
      });
      window.addEventListener("storage", schedule);
    })();
