(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var digits = function (value) { return String(value || "").replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); }).replace(/[^0-9]/g, ""); };
    var findButton = function (predicate) { return Array.from(document.querySelectorAll("button")).find(predicate); };
    var itemMatches = function (node, item) {
      var text = clean(node && node.textContent);
      var bank = clean(item && item.bankName);
      var bankShort = bank.replace(/^بانک\s+/, "");
      var description = clean(item && (item.description || item.rawText));
      var amount = digits(item && item.amount);
      var bankMatch = !bank || text.includes(bank) || text.includes(bankShort);
      var amountMatch = !amount || digits(text).includes(amount);
      var descriptionMatch = !description || text.includes(description.slice(0, 24));
      return bankMatch && (amountMatch || descriptionMatch);
    };
    var containerFor = function (item) {
      return Array.from(document.querySelectorAll("main article")).find(function (article) { return itemMatches(article, item); });
    };
    var actionFor = function (item) {
      var container = containerFor(item);
      return container && Array.from(container.querySelectorAll("button")).find(function (button) {
        return /ثبت تراکنش|ثبت مجدد سند/.test(clean(button.textContent));
      });
    };
    var setInput = function (input, value) {
      if (!input) return;
      var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, String(value == null ? "" : value));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    var setTextarea = function (textarea, value) {
      if (!textarea || !value) return;
      var setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(textarea, String(value));
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    };
    var jalaliToGregorian = function (jy, jm, jd) {
      jy += 1595;
      var days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 1) * 30 + 6);
      var gy = 400 * Math.floor(days / 146097);
      days %= 146097;
      if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days += 1; }
      gy += 4 * Math.floor(days / 1461);
      days %= 1461;
      if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
      var gd = days + 1;
      var monthDays = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      var gm = 0;
      while (gd > monthDays[gm]) { gd -= monthDays[gm]; gm += 1; }
      return new Date(gy, gm - 1, gd);
    };
    var dateOffset = function (value) {
      var raw = clean(value);
      if (raw.includes("پریروز")) return 2;
      if (raw.includes("دیروز")) return 1;
      var match = raw.replace(/-/g, "/").match(/([۰-۹0-9]{4})\/([۰-۹0-9]{1,2})\/([۰-۹0-9]{1,2})/);
      if (!match) return 0;
      var todayParts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date());
      var today = {};
      todayParts.forEach(function (part) { today[part.type] = Number(digits(part.value)); });
      var target = jalaliToGregorian(Number(digits(match[1])), Number(digits(match[2])), Number(digits(match[3])));
      var current = jalaliToGregorian(today.year, today.month, today.day);
      return Math.max(0, Math.round((current.getTime() - target.getTime()) / 86400000));
    };
    var selectBank = function (item) {
      var wallet = document.querySelector("#field-wallet");
      if (!wallet || !item || !item.bankName || !clean(wallet.textContent).includes("انتخاب")) return;
      wallet.click();
      window.setTimeout(function () {
        var bank = clean(item.bankName).replace(/^بانک\s+/, "");
        var overlay = document.querySelector(".hesabno-account-picker-overlay");
        var label = overlay && Array.from(overlay.querySelectorAll("p")).find(function (node) {
          var text = clean(node.textContent);
          return text === clean(item.bankName) || text === bank || text.includes(clean(item.bankName));
        });
        var option = label && label.closest("div.cursor-pointer");
        if (option) option.click();
      }, 120);
    };
    var fillRegistrationForm = function (item) {
      var heading = Array.from(document.querySelectorAll("h1")).find(function (node) { return /^ثبت (دریافت|پرداخت)$/.test(clean(node.textContent)); });
      if (!heading) return false;
      var form = heading.closest("main") || document.body;
      var amountInput = document.querySelector("#field-amount-input");
      if (!amountInput) return false;
      if (form.dataset.hesabnoSmsPrefilled !== String(item.id || item.rawText || item.amount)) {
        form.dataset.hesabnoSmsPrefilled = String(item.id || item.rawText || item.amount);
        setInput(amountInput, Math.round(Number(item.amount) || 0));
        setTextarea(document.querySelector("textarea"), item.description || item.rawText || "");
        selectBank(item);
      }
      var offset = dateOffset(item.date || item.receivedAt);
      if (offset > 0 && !form.dataset.hesabnoSmsDateAdjusted) {
        form.dataset.hesabnoSmsDateAdjusted = "true";
        var previous = function (remaining) {
          var button = document.querySelector("#tx-date-input-prev-day");
          if (!button || button.disabled || remaining <= 0) return;
          button.click();
          window.setTimeout(function () { previous(remaining - 1); }, 45);
        };
        previous(Math.min(offset, 365));
      }
      return true;
    };
    var open = function (item, register) {
      window.__hesabnoPayambankTarget = { item: item, register: !!register };
      var tries = 0;
      var actionClicked = false;
      var timer = window.setInterval(function () {
        tries += 1;
        var payambank = Array.from(document.querySelectorAll("h1")).some(function (node) { return clean(node.textContent) === "پیامبانک هوشمند"; });
        if (!payambank) {
          var more = findButton(function (button) { return clean(button.textContent) === "بیشتر"; });
          if (more) more.click();
          var menu = findButton(function (button) { return clean(button.textContent).includes("پیامبانک") && clean(button.textContent).includes("استخراج خودکار"); });
          if (menu) menu.click();
        } else if (register) {
          var action = actionFor(item);
          if (action && !actionClicked) { actionClicked = true; action.click(); }
          if (fillRegistrationForm(item)) { window.clearInterval(timer); }
        } else {
          var container = containerFor(item);
          if (container || tries > 80) window.clearInterval(timer);
        }
        if (tries > 100) window.clearInterval(timer);
      }, 100);
    };
    window.__hesabnoOpenSmsInPayambank = open;
  })();
