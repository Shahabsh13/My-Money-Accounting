(function () {
    var logos = window.__HESABNO_OFFICIAL_BANK_LOGOS || {};
    var keys = Object.keys(logos).sort(function (a, b) { return b.length - a.length; });
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var normalizeAccountName = function (value) {
      return clean(value).replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); })
        .replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[\u200c\u200f\u202a-\u202e]/g, "")
        .replace(/[‐‑‒–—−]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
    };
    var readAccounts = function () {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:accounts_v5") : localStorage.getItem("hesabno:accounts_v5");
        var value = JSON.parse(raw || "[]");
        if (Array.isArray(value) && value.length > 0) return value;
      } catch (error) {}
      return Array.isArray(window.__HESABNO_DEFAULT_ACCOUNTS) ? window.__HESABNO_DEFAULT_ACCOUNTS : [];
    };
    var findCounterpartyAccount = function (displayName) {
      var target = normalizeAccountName(displayName);
      if (!target) return null;
      var strippedTarget = target.replace(/^بانک\s+/, "");
      var accounts = readAccounts();
      return accounts.find(function (item) {
        return item && (normalizeAccountName(item.name) === target || (item.bankName && normalizeAccountName(item.bankName) === target));
      }) || accounts.find(function (item) {
        var name = normalizeAccountName(item && item.name).replace(/^بانک\s+/, "");
        return name && name === strippedTarget;
      }) || null;
    };
    var selectedBankName = function (displayName) {
      var account = findCounterpartyAccount(displayName);
      return clean(account && (account.bankName || account.selectedBank || account.bank || account.linkedBank));
    };
    var resolveBank = function (value) {
      var text = clean(value).replace(/^•\s*/, "").replace(/^از\s+/, "").replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
      if (text.indexOf("بانک ") === 0) text = text.slice(5).trim();
      for (var i = 0; i < keys.length; i += 1) {
        var key = clean(keys[i]).replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
        if (key.indexOf("بانک ") === 0) key = key.slice(5).trim();
        if (text === key || text.indexOf(key + " ") === 0 || text.indexOf(key + "-") === 0) return keys[i];
      }
      return "";
    };
    var resolveAccountGlyph = function (displayName, account) {
      var pic = clean(account && account.picture);
      if (pic && !/^(Landmark|Banknote|Wallet|TrendingUp|TrendingDown|User|Users|Gem|HandCoins|Scale)$/i.test(pic)) {
        return pic;
      }
      var text = normalizeAccountName(displayName);
      if ((account && account.group === "cash") || /صندوق|تنخواه|نقد|کیف پول/.test(text)) return "💵";
      if ((account && account.group === "bank") || /بانک/.test(text)) return "🏦";
      if (account && account.group === "person") return "👤";
      return "💵";
    };
    var makeMark = function (key, label) {
      var mark = document.createElement("span");
      mark.className = "hesabno-bank-mark hesabno-report-bank-logo";
      mark.setAttribute("data-hesabno-report-bank-logo", key);
      mark.setAttribute("data-hesabno-bank-logo", key);
      mark.title = label;
      var image = document.createElement("img");
      image.alt = label;
      image.loading = "eager";
      image.decoding = "sync";
      image.src = logos[key];
      mark.appendChild(image);
      return mark;
    };
    var makeGlyphMark = function (glyph, label) {
      var mark = document.createElement("span");
      mark.className = "hesabno-bank-mark hesabno-report-account-icon";
      mark.setAttribute("data-hesabno-report-bank-logo", "glyph:" + glyph);
      mark.setAttribute("data-hesabno-bank-logo", "glyph:" + glyph);
      mark.setAttribute("data-hesabno-report-account-icon", glyph);
      mark.title = label;
      mark.textContent = glyph;
      return mark;
    };
    var readTransactions = function () {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions");
        var value = JSON.parse(raw || "[]");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var digits = function (value) {
      return String(value || "").replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); }).replace(/[^0-9]/g, "");
    };
    var manualDescription = function (row, card) {
      var current = row.querySelector(".hesabno-simple-report-description");
      if (current) return clean(current.textContent);
      if (!card) return "";
      var title = clean(card.querySelector("h2") && card.querySelector("h2").textContent).replace(/^تراکنش‌های\s*[«\"]?/, "").replace(/[»\"]$/, "");
      var bank = clean((row.querySelector(".hesabno-simple-report-bank") || {}).textContent);
      var amountNode = row.querySelector(".hesabno-simple-report-amount");
      var amount = digits(amountNode && amountNode.textContent);
      var candidates = readTransactions().filter(function (item) {
        var account = clean(item && (item.account || item.bank || item.bankName || item.linkedBank));
        var itemAmount = digits(item && item.amount);
        var category = clean(item && (item.title || item.category));
        return amount && itemAmount === amount && (!bank || account.includes(bank) || bank.includes(account)) && (!title || category === title);
      });
      var item = candidates[0];
      var value = clean(item && (item.description || item.note || item.memo));
      if (!value || value === title || value === clean(item && (item.title || item.category))) return "";
      return value;
    };
    /* قواعد ردیف، لوگوی بانک و توضیح گزارش ساده در بستهٔ ۲۳۵ (لایهٔ ظاهر) قرار دارد. */
    var ensureStyle = function () {};
    var decorate = function () {
      ensureStyle();
      document.querySelectorAll(".hesabno-report-transaction-row").forEach(function (row) {
        var bank = row.querySelector(".hesabno-simple-report-bank");
        if (!bank) return;
        var displayName = bank.getAttribute("title") || bank.textContent;
        var account = findCounterpartyAccount(displayName);
        var key = resolveBank(selectedBankName(displayName) || (account && (account.bankName || account.name)) || displayName);
        var glyph = key ? "" : resolveAccountGlyph(displayName, account);
        var markId = key || ("glyph:" + glyph);
        var buildMark = function () {
          return key ? makeMark(key, displayName) : makeGlyphMark(glyph, displayName);
        };
        var wrap = bank.closest("[data-hesabno-report-bank-wrap]");
        if (markId && !wrap) {
          wrap = document.createElement("div");
          wrap.className = "hesabno-simple-report-bank-wrap";
          wrap.setAttribute("data-hesabno-report-bank-wrap", "true");
          wrap.appendChild(buildMark());
          bank.parentNode.insertBefore(wrap, bank);
          wrap.appendChild(bank);
        } else if (markId && wrap) {
          var currentMark = wrap.querySelector(".hesabno-bank-mark");
          if (!currentMark || currentMark.getAttribute("data-hesabno-report-bank-logo") !== markId) {
            if (currentMark) currentMark.remove();
            wrap.insertBefore(buildMark(), bank);
          }
        }
        var card = row.closest(".hesabno-report-transaction-card");
        var description = manualDescription(row, card);
        var box = row.querySelector(".hesabno-simple-report-row-box") || row;
        if (description && !row.querySelector(".hesabno-simple-report-description")) {
          var node = document.createElement("div");
          node.className = "hesabno-simple-report-description";
          node.setAttribute("data-hesabno-report-description-fallback", "true");
          node.textContent = description;
          node.title = description;
          box.appendChild(node);
        }
      });
    };
    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(function () { scheduled = false; decorate(); });
    };
    window.__hesabnoDecorateSimpleReportRows = decorate;
    decorate();
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, schedule);
  })();
