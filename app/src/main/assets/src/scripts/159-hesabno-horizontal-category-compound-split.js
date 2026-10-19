(function () {
    var widgetTitle = "نمودار افقی سرفصل‌ها";
    var clean = function (value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); };
    var asciiDigits = function (value) {
      return String(value == null ? "" : value).replace(/[۰-۹٠-٩]/g, function (digit) {
        var index = "۰۱۲۳۴۵۶۷۸۹".indexOf(digit);
        return String(index < 0 ? "٠١٢٣٤٥٦٧٨٩".indexOf(digit) : index);
      });
    };
    var faDigits = function (value) { return String(value).replace(/[0-9]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]; }); };
    var number = function (value) { return Number(asciiDigits(value).replace(/[^0-9.-]/g, "")) || 0; };
    var read = function (key) {
      try {
        var raw = window.__safeGet ? window.__safeGet(key) : localStorage.getItem(key);
        var parsed = JSON.parse(raw || "null");
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) { return []; }
    };
    var currencyUnit = function () {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:currency") : localStorage.getItem("hesabno:currency");
        return String(raw || "rial").replace(/"/g, "").toLowerCase() === "toman" ? "تومان" : "ریال";
      } catch (error) { return "ریال"; }
    };
    var normalizedDate = function (value) {
      var match = asciiDigits(value).replace(/-/g, "/").match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
      return match ? [match[1], match[2].padStart(2, "0"), match[3].padStart(2, "0")].join("/") : "";
    };
    var jalaliDate = function (date) {
      try {
        var parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
        var values = {};
        parts.forEach(function (part) { values[part.type] = part.value; });
        return normalizedDate(values.year + "/" + values.month + "/" + values.day);
      } catch (error) { return ""; }
    };
    var accountFor = function (reference, accounts) {
      var name = clean(reference).toLowerCase();
      var id = asciiDigits(reference);
      return accounts.find(function (account) {
        return account && (clean(account.name).toLowerCase() === name || String(account.id) === id);
      }) || null;
    };
    var groupOf = function (reference, accounts) {
      var account = accountFor(reference, accounts);
      return account ? clean(account.group).toLowerCase() : "";
    };
    var categoryName = function (reference, accounts, fallback) {
      var account = accountFor(reference, accounts);
      return clean(account && account.name || reference || fallback);
    };
    var otherCategory = function (name, mode) {
      var value = clean(name);
      if (mode === "expense" && (value === "پرداخت مرکب" || value === "سند مرکب")) return "سایر هزینه‌ها";
      if (mode === "income" && (value === "دریافت مرکب" || value === "سند مرکب")) return "سایر درآمدها";
      return value || (mode === "expense" ? "سایر هزینه‌ها" : "سایر درآمدها");
    };
    var selectedMode = function (section) {
      var buttons = Array.from(section.querySelectorAll("button"));
      var income = buttons.find(function (button) { return clean(button.textContent).indexOf("سرفصل‌های درآمد") !== -1; });
      return income && String(income.className).indexOf("bg-emerald-500/20") !== -1 ? "income" : "expense";
    };
    var selectedPeriod = function (section) {
      var buttons = Array.from(section.querySelectorAll("button"));
      var active = buttons.find(function (button) {
        var text = clean(button.textContent);
        return String(button.className).indexOf("bg-purple-600") !== -1 && (text.indexOf("امروز") !== -1 || /روزه|ماه/.test(text));
      });
      var label = clean(active && active.textContent);
      if (label.indexOf("امروز") !== -1) return "today";
      if (label.indexOf("۷") !== -1 || label.indexOf("7") !== -1) return "7days";
      if (label.indexOf("۱۴") !== -1 || label.indexOf("14") !== -1) return "14days";
      return "30days";
    };
    var dateRange = function (period) {
      var range = new Set();
      var days = period === "today" ? 1 : period === "7days" ? 7 : period === "14days" ? 14 : 30;
      for (var i = 0; i < days; i += 1) {
        var date = new Date();
        date.setDate(date.getDate() - i);
        var key = jalaliDate(date);
        if (key) range.add(key);
      }
      return range;
    };
    var bounced = function (transaction) { return transaction.check && transaction.check.status === "bounced"; };
    var totalsFor = function (transaction, accounts) {
      var income = 0, direction = transaction.isReversal ? -1 : 1;
      var expense = number(transaction.feeAmount) * direction;
      if (transaction.isCompound) {
        (transaction.compoundSources || []).forEach(function (leg) {
          if (leg && leg.account && groupOf(leg.account, accounts) === "income") income += number(leg.amount) * direction;
        });
        (transaction.compoundDestinations || []).forEach(function (leg) {
          if (leg && leg.account && groupOf(leg.account, accounts) === "expense") expense += number(leg.amount) * direction;
        });
        return { income: income, expense: expense };
      }
      var categoryGroup = groupOf(transaction.category, accounts);
      var categoryAccount = accountFor(transaction.category, accounts);
      var isPerson = categoryAccount && categoryAccount.group === "person";
      if (transaction.type === "income") {
        if (!bounced(transaction) && (categoryGroup === "income" || !categoryGroup && !isPerson && !transaction.isReversal)) income += number(transaction.amount);
        else if (!bounced(transaction) && (categoryGroup === "expense" || transaction.isReversal)) expense -= number(transaction.amount);
      } else if (transaction.type === "expense") {
        if (!bounced(transaction) && (categoryGroup === "expense" || !categoryGroup && !isPerson && !transaction.isReversal)) expense += number(transaction.amount);
        else if (!bounced(transaction) && (categoryGroup === "income" || transaction.isReversal)) income -= number(transaction.amount);
      }
      return { income: income, expense: expense };
    };
    var addAmount = function (buckets, name, amount) {
      name = clean(name);
      if (!name || !Number.isFinite(amount) || amount === 0) return;
      buckets.set(name, (buckets.get(name) || 0) + amount);
    };
    var categoryTotals = function (transactions, accounts, mode, range) {
      var buckets = new Map();
      var total = 0;
      transactions.forEach(function (transaction) {
        if (!transaction || !range.has(normalizedDate(transaction.date))) return;
        var source = transaction.isReversal && transaction.reversalOfDocNumber != null ? transactions.find(function (candidate) {
          return candidate && !candidate.isReversal && String(candidate.documentNumber != null ? candidate.documentNumber : candidate.id) === String(transaction.reversalOfDocNumber);
        }) : null;
        var basis = source || transaction, sign = source ? -1 : 1;
        var totals = totalsFor(basis, accounts);
        var value = (mode === "expense" ? totals.expense : totals.income) * sign;
        if (!value) return;
        total += value;
        if (basis.isCompound) {
          var legs = mode === "expense" ? basis.compoundDestinations || [] : basis.compoundSources || [];
          var distributed = 0;
          legs.forEach(function (leg) {
            if (!leg || !leg.account || groupOf(leg.account, accounts) !== mode) return;
            var amount = number(leg.amount) * sign;
            var name = otherCategory(categoryName(leg.account, accounts, ""), mode);
            addAmount(buckets, name, amount);
            distributed += amount;
          });
          var fee = mode === "expense" ? number(basis.feeAmount) * sign : 0;
          if (fee) {
            addAmount(buckets, categoryName(basis.feeAccount, accounts, "هزینه کارمزد و بهره"), fee);
            distributed += fee;
          }
          if (value !== distributed) addAmount(buckets, otherCategory(basis.category, mode), value - distributed);
          return;
        }
        if (mode === "expense") {
          var feeAmount = number(basis.feeAmount) * sign;
          if (feeAmount) addAmount(buckets, categoryName(basis.feeAccount, accounts, "هزینه کارمزد و بهره"), feeAmount);
          var expenseAmount = value - feeAmount;
          if (expenseAmount && basis.type !== "transfer") addAmount(buckets, otherCategory(basis.category || basis.destinationAccount, mode), expenseAmount);
        } else {
          addAmount(buckets, otherCategory(basis.category || basis.account, mode), value);
        }
      });
      return { total: Math.max(0, total), items: Array.from(buckets.entries()).map(function (entry) { return { name: entry[0], amount: entry[1], account: accountFor(entry[0], accounts) }; }).filter(function (item) { return item.amount > 0; }).sort(function (a, b) { return b.amount - a.amount; }).slice(0, 7) };
    };
    var faNumber = function (value) { return faDigits(new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value))); };
    var money = function (value, unit) { return faNumber(value) + " " + unit; };
    var percent = function (value) {
      var rounded = Number(value.toFixed(1));
      var text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", "/");
      return faDigits(text) + "٪";
    };
    var iconFor = function (item) {
      var account = item.account || accountFor(item.name, currentAccounts);
      var isLoanCategory = /(وام|تسهیلات)/u.test(clean(item && item.name));
      var picture = isLoanCategory && window.__HESABNO_LOAN_LOGO ? window.__HESABNO_LOAN_LOGO : clean(account && account.picture) || "📁";
      var icon = document.createElement("span");
      icon.className = "w-5 h-5 rounded-md bg-stone-800 text-stone-300 flex items-center justify-center text-[10px] font-mono shrink-0 hesabno-dashboard-category-icon";
      icon.dataset.hesabnoCategoryAccountIcon = "true";
      icon.setAttribute("aria-label", "آیکون سرفصل " + item.name);
      icon.title = item.name;
      if (/^(https?:|data:image\/)/i.test(picture)) {
        var image = document.createElement("img");
        image.src = picture;
        image.alt = "";
        image.loading = "lazy";
        icon.appendChild(image);
      } else icon.textContent = picture;
      return icon;
    };
    var currentAccounts = [];
    var buildRow = function (item, mode, total, unit) {
      var expense = mode === "expense";
      var row = document.createElement("div");
      row.className = "p-2 rounded-xl bg-stone-900/60 border border-stone-750/70 hover:border-stone-650 transition";
      row.dataset.hesabnoCategoryRow = "true";
      var head = document.createElement("div");
      head.className = "flex items-center justify-between text-xs mb-1.5";
      var labelGroup = document.createElement("div");
      labelGroup.className = "flex items-center gap-2 min-w-0";
      labelGroup.appendChild(iconFor(item));
      var label = document.createElement("span");
      label.className = "font-bold text-stone-200 truncate";
      label.textContent = item.name;
      label.title = item.name;
      labelGroup.appendChild(label);
      var values = document.createElement("div");
      values.className = "flex items-center gap-2 shrink-0 font-mono";
      var amount = document.createElement("span");
      amount.className = "text-[11px] font-black text-stone-100";
      amount.textContent = money(item.amount, unit);
      var share = document.createElement("span");
      share.className = "text-[10px] px-1.5 py-0.5 rounded-md font-bold " + (expense ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300");
      share.textContent = percent(total > 0 ? item.amount / total * 100 : 0);
      values.appendChild(amount);
      values.appendChild(share);
      head.appendChild(labelGroup);
      head.appendChild(values);
      var track = document.createElement("div");
      track.className = "w-full h-2 rounded-full overflow-hidden " + (expense ? "bg-rose-500/10" : "bg-emerald-500/10");
      var bar = document.createElement("div");
      bar.className = "h-full rounded-full transition-all duration-500 " + (expense ? "bg-rose-500" : "bg-emerald-500");
      bar.style.width = Math.max(3, Math.min(100, total > 0 ? item.amount / total * 100 : 0)) + "%";
      track.appendChild(bar);
      row.appendChild(head);
      row.appendChild(track);
      return row;
    };
    var isWidget = function (section) {
      return Array.from(section.querySelectorAll("h2")).some(function (heading) { return clean(heading.textContent) === widgetTitle; });
    };
    var sync = function () {
      var accounts = read("hesabno:accounts_v5");
      var transactions = read("hesabno:transactions");
      currentAccounts = accounts;
      var unit = currencyUnit();
      document.querySelectorAll("section").forEach(function (section) {
        if (!isWidget(section)) return;
        if (section.dataset.hesabnoCategoryWidgetCompact !== "true") section.dataset.hesabnoCategoryWidgetCompact = "true";
        var header = Array.from(section.children).find(function (node) {
          return Array.from(node.querySelectorAll("h2")).some(function (heading) { return clean(heading.textContent) === widgetTitle; });
        });
        if (header) {
          if (header.dataset.hesabnoCategoryHeader !== "true") header.dataset.hesabnoCategoryHeader = "true";
          var icon = header.querySelector("span.w-8.h-8");
          if (icon && icon.dataset.hesabnoCategoryHeaderIcon !== "true") icon.dataset.hesabnoCategoryHeaderIcon = "true";
          var summary = header.nextElementSibling;
          if (summary && summary.dataset.hesabnoCategorySummary !== "true") summary.dataset.hesabnoCategorySummary = "true";
        }
        var todayButton = Array.from(section.querySelectorAll("button")).find(function (button) { return clean(button.textContent).indexOf("امروز (ساعتی)") !== -1; });
        if (todayButton && todayButton.dataset.hesabnoCategoryPeriodHidden !== "true") {
          if (String(todayButton.className).indexOf("bg-purple-600") !== -1) {
            var sevenDayButton = Array.from(section.querySelectorAll("button")).find(function (button) { return /۷\s*روزه|7\s*روزه/.test(clean(button.textContent)); });
            if (sevenDayButton) sevenDayButton.click();
          }
          todayButton.dataset.hesabnoCategoryPeriodHidden = "true";
        }
        var list = Array.from(section.querySelectorAll("div.max-h-64.overflow-y-auto")).find(function (node) {
          return node.classList.contains("pr-0.5") && node.dataset.hesabnoCategoryEnhanced !== "true";
        });
        if (!list) return;
        var enhancedList = section.querySelector("[data-hesabno-category-enhanced='true']");
        if (!enhancedList) {
          enhancedList = document.createElement("div");
          enhancedList.className = list.className;
          enhancedList.dataset.hesabnoCategoryEnhanced = "true";
          enhancedList.setAttribute("aria-label", widgetTitle);
          list.parentNode.insertBefore(enhancedList, list.nextSibling);
        } else if (enhancedList.parentElement !== list.parentElement || enhancedList.previousElementSibling !== list) {
          list.parentNode.insertBefore(enhancedList, list.nextSibling);
        }
        var mode = selectedMode(section);
        var period = selectedPeriod(section);
        var result = categoryTotals(transactions, accounts, mode, dateRange(period));
        if (!result.items.length) {
          if (enhancedList.style.getPropertyValue("display") !== "none") enhancedList.style.setProperty("display", "none", "important");
          if (list.dataset.hesabnoCategoryDisplaySaved === "true") {
            var oldDisplay = list.dataset.hesabnoCategoryDisplay || "";
            var oldPriority = list.dataset.hesabnoCategoryDisplayPriority || "";
            if (oldDisplay) list.style.setProperty("display", oldDisplay, oldPriority);
            else list.style.removeProperty("display");
            delete list.dataset.hesabnoCategoryDisplay;
            delete list.dataset.hesabnoCategoryDisplayPriority;
            delete list.dataset.hesabnoCategoryDisplaySaved;
          }
          return;
        }
        if (list.dataset.hesabnoCategoryDisplaySaved !== "true") {
          list.dataset.hesabnoCategoryDisplay = list.style.getPropertyValue("display");
          list.dataset.hesabnoCategoryDisplayPriority = list.style.getPropertyPriority("display");
          list.dataset.hesabnoCategoryDisplaySaved = "true";
        }
        if (list.style.getPropertyValue("display") !== "none") list.style.setProperty("display", "none", "important");
        if (enhancedList.style.getPropertyValue("display")) enhancedList.style.removeProperty("display");
        var signature = JSON.stringify([mode, period, unit, result.total, result.items.map(function (item) { return [item.name, item.amount, item.account && item.account.picture || ""]; })]);
        if (enhancedList.dataset.hesabnoCategorySignature === signature && enhancedList.querySelector("[data-hesabno-category-row='true']")) return;
        enhancedList.dataset.hesabnoCategorySignature = signature;
        enhancedList.replaceChildren.apply(enhancedList, result.items.map(function (item) { return buildRow(item, mode, result.total, unit); }));
      });
    };
    var queued = false;
    var schedule = function () {
      if (queued) return;
      queued = true;
      Promise.resolve().then(function () { queued = false; sync(); });
    };
    sync();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
    document.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("button") : null;
      var section = button && button.closest("section");
      if (section && isWidget(section)) { schedule(); window.setTimeout(sync, 180); }
    }, true);
    window.addEventListener("storage", function (event) {
      if (!event.key || event.key === "hesabno:transactions" || event.key === "hesabno:accounts_v5" || event.key === "hesabno:currency") schedule();
    });
  })();
