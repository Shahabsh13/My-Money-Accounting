(function () {
  var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
  var read = function (key, fallback) {
    try {
      var raw = window.__safeGet ? window.__safeGet(key) : window.localStorage.getItem(key);
      var value = JSON.parse(raw || "null");
      return value == null ? fallback : value;
    } catch (error) { return fallback; }
  };
  var fa = function (value) { return String(Math.max(0, Number(value) || 0)).replace(/\d/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[digit]; }); };
  var faAmount = function (value) { return Math.round(Number(value) || 0).toLocaleString("fa-IR"); };
  var currencyUnit = function () {
    try { return (window.__safeGet ? window.__safeGet("hesabno:currency") : localStorage.getItem("hesabno:currency")) === "toman" ? "تومان" : "ریال"; }
    catch (error) { return "ریال"; }
  };
  var findButton = function (predicate) { return Array.from(document.querySelectorAll("button")).find(predicate); };
  var closePanel = function () {
    var panel = document.querySelector("#hesabno-dashboard-panel");
    if (panel) panel.remove();
  };
  var createPanel = function (title, subtitle, onBack) {
    closePanel();
    var panel = document.createElement("div");
    panel.id = "hesabno-dashboard-panel";
    panel.className = "hesabno-dashboard-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.innerHTML = '<div class="hesabno-dashboard-panel-card" dir="rtl"><header class="hesabno-dashboard-panel-header"><div><div class="hesabno-dashboard-panel-title"></div><div class="hesabno-dashboard-panel-subtitle"></div></div><div class="hesabno-dashboard-panel-actions"><button type="button" class="hesabno-dashboard-panel-back" aria-label="بازگشت" hidden>‹</button><button type="button" class="hesabno-dashboard-panel-close" aria-label="بستن">×</button></div></header><div class="hesabno-dashboard-panel-content"></div></div>';
    panel.querySelector(".hesabno-dashboard-panel-title").textContent = title;
    panel.querySelector(".hesabno-dashboard-panel-subtitle").textContent = subtitle;
    panel.addEventListener("click", function (event) { if (event.target === panel) closePanel(); });
    var back = panel.querySelector(".hesabno-dashboard-panel-back");
    var close = panel.querySelector(".hesabno-dashboard-panel-close");
    if (onBack) { back.hidden = false; close.hidden = true; back.addEventListener("click", onBack); }
    close.addEventListener("click", closePanel);
    document.body.appendChild(panel);
    return panel;
  };
  var appendPanelRow = function (container, label, value, onClick) {
    var row = document.createElement(onClick ? "button" : "div");
    row.className = "hesabno-dashboard-panel-row";
    if (onClick) {
      row.type = "button";
      row.classList.add("hesabno-dashboard-panel-clickable");
      row.addEventListener("click", onClick);
    }
    var labelNode = document.createElement("span");
    var valueNode = document.createElement("span");
    labelNode.textContent = label;
    valueNode.className = "hesabno-dashboard-panel-number";
    valueNode.textContent = value;
    row.append(labelNode, valueNode);
    container.appendChild(row);
  };
  var setSearchValue = function (input, value) {
    if (!input) return;
    var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, String(value || ""));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  var openCheckInSection = function (item) {
    var number = item && item.check && item.check.number;
    closePanel();
    var tries = 0;
    var requested = false;
    var menuRequested = false;
    var searchApplied = false;
    var timer = window.setInterval(function () {
      tries += 1;
      if (!requested) {
        var open = document.querySelector("button.action-checks") || findButton(function (button) { return clean(button.textContent) === "چک‌های صیادی" || clean(button.textContent).includes("چک‌های صیادی"); });
        if (open) { requested = true; open.click(); }
        else if (!menuRequested) {
          var more = findButton(function (button) { return clean(button.textContent) === "بیشتر"; });
          if (more) { menuRequested = true; more.click(); }
        }
      }
      var heading = Array.from(document.querySelectorAll("h1")).find(function (node) { return clean(node.textContent) === "مدیریت چک‌ها"; });
      if (heading) {
        var input = Array.from(document.querySelectorAll("main input")).find(function (node) { return /جستجو/.test(node.placeholder || ""); });
        if (input && !searchApplied) {
          searchApplied = true;
          setSearchValue(input, number);
          input.blur();
        }
        var wanted = normalizeDigits(number);
        var card = wanted && Array.from(document.querySelectorAll("article")).find(function (article) { return normalizeDigits(article.textContent).includes(wanted); });
        if (card) {
          window.clearInterval(timer);
          card.classList.add("hesabno-focused-check-card");
          card.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (tries > 80) window.clearInterval(timer);
      } else if (tries > 80) window.clearInterval(timer);
    }, 100);
  };
  var showDetail = function (kind, item, listTitle, listItems) {
    var isSms = kind === "sms";
    var panel = createPanel(isSms ? "جزئیات پیامک بانکی" : "جزئیات چک", "همان‌جا داخل داشبورد", function () { showList(kind, listTitle, listItems); });
    var content = panel.querySelector(".hesabno-dashboard-panel-content");
    var detail = document.createElement("div");
    detail.className = "hesabno-dashboard-panel-detail";
    var check = item && item.check || {};
    var actionLink = null;
    var smsNeedsRegistration = isSms && listTitle === "پیامک‌های نیازمند ثبت" && !(item && item.isRegistered);
    if (isSms) {
      appendPanelRow(detail, "بانک", item.bankName || "پیامک بانکی");
      appendPanelRow(detail, "نوع تراکنش", item.type === "income" ? "واریز" : "برداشت");
      appendPanelRow(detail, "مبلغ", faAmount(item.amount) + " " + currencyUnit());
      appendPanelRow(detail, "تاریخ", item.date || item.receivedAt || "—");
      appendPanelRow(detail, "زمان دریافت", item.receivedAt || "—");
      appendPanelRow(detail, "شرح", item.description || item.rawText || "—");
      actionLink = document.createElement("button");
      actionLink.type = "button";
      actionLink.className = "hesabno-dashboard-panel-link";
      actionLink.textContent = smsNeedsRegistration ? "ثبت تراکنش در پیامبانک" : "مشاهده در پیامبانک";
      actionLink.addEventListener("click", function () {
        closePanel();
        if (window.__hesabnoOpenSmsInPayambank) window.__hesabnoOpenSmsInPayambank(item, smsNeedsRegistration);
      });
    } else {
      appendPanelRow(detail, "شماره چک", check.number || "—");
      appendPanelRow(detail, "مبلغ", faAmount(item.amount) + " " + currencyUnit());
      appendPanelRow(detail, "تاریخ سررسید", check.dueDate || check.date || "—");
      appendPanelRow(detail, "وضعیت", check.status || "—");
      appendPanelRow(detail, "شرح", item.description || "—");
      actionLink = document.createElement("button");
      actionLink.type = "button";
      actionLink.className = "hesabno-dashboard-panel-link";
      actionLink.textContent = "مشاهده در بخش چک‌ها";
      actionLink.addEventListener("click", function () { openCheckInSection(item); });
    }
    content.appendChild(detail);
    if (actionLink) content.appendChild(actionLink);
  };
  var appendPanelItems = function (container, kind, title, items) {
    if (!items.length) {
      var empty = document.createElement("div");
      empty.className = "hesabno-dashboard-panel-empty";
      empty.textContent = "موردی برای نمایش وجود ندارد.";
      container.appendChild(empty);
      return;
    }
    var list = document.createElement("div");
    list.className = "hesabno-dashboard-panel-list";
    items.slice(0, 5).forEach(function (item) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "hesabno-dashboard-panel-item";
      if (kind === "sms") button.textContent = (item.bankName || "پیامک بانکی") + " · " + (item.description || "تراکنش بانکی");
      else if (kind === "pattern") button.textContent = item.name || item.title || "الگوی پیامک";
      else {
        var check = item.check || {};
        var direction = item.type === "income" ? "دریافتی" : "پرداختی";
        button.classList.add("hesabno-dashboard-check-item");
        var top = document.createElement("span");
        top.className = "hesabno-dashboard-check-item-top";
        var number = document.createElement("strong");
        number.textContent = "چک " + String(check.number || "بدون شماره");
        var directionLabel = document.createElement("span");
        directionLabel.className = "hesabno-dashboard-check-item-direction";
        directionLabel.textContent = direction;
        top.appendChild(number);
        top.appendChild(directionLabel);
        var bottom = document.createElement("span");
        bottom.className = "hesabno-dashboard-check-item-bottom";
        var dueDate = document.createElement("span");
        dueDate.textContent = String(check.dueDate || "بدون تاریخ");
        var amount = document.createElement("span");
        amount.textContent = faAmount(item.amount) + " " + currencyUnit();
        bottom.appendChild(dueDate);
        bottom.appendChild(amount);
        button.appendChild(top);
        button.appendChild(bottom);
      }
      button.addEventListener("click", function () {
        if (kind === "checks") openCheckInSection(item);
        else showDetail(kind, item, title, items);
      });
      list.appendChild(button);
    });
    container.appendChild(list);
  };
  var normalizeDigits = function (value) {
    var fa = "۰۱۲۳۴۵۶۷۸۹";
    return String(value || "").replace(/[۰-۹]/g, function (digit) { return String(fa.indexOf(digit)); });
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
  var checkDueDate = function (item) {
    var raw = item && item.check && (item.check.dueDate || item.check.date);
    var match = normalizeDigits(raw).replace(/-/g, "/").match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!match) return null;
    var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    if (year > 1700) return new Date(year, month - 1, day);
    return jalaliToGregorian(year, month, day);
  };
  var checkDaysUntil = function (item) {
    var due = checkDueDate(item);
    if (!due || Number.isNaN(due.getTime())) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / 86400000);
  };
  var isOpenCheck = function (item) {
    return item && item.check && !["cleared", "bounced", "refunded"].includes(item.check.status);
  };
  var isReceivedCheck = function (item) {
    return isOpenCheck(item) && (item.type === "income" || (item.type !== "expense" && item.check.status === "received"));
  };
  var showList = function (kind, title, items) {
    var panel = createPanel(title, "برای مشاهده جزئیات، یک مورد را انتخاب کن", function () { showPanel(kind === "checks" ? "checks" : "sms"); });
    appendPanelItems(panel.querySelector(".hesabno-dashboard-panel-content"), kind, title, items);
  };
  var showPanel = function (kind) {
    var isSms = kind === "sms";
    var transactions = read("hesabno:transactions", []);
    var checks = Array.isArray(transactions) ? transactions.filter(function (item) { return item && item.check; }) : [];
    var inbox = read("hesabno:payambank:inbox", []);
    if (!Array.isArray(inbox)) inbox = [];
    var smsItems = Array.isArray(inbox) ? inbox.filter(function (item) { return item && !item.isRegistered; }) : [];
    var registeredSmsItems = Array.isArray(inbox) ? inbox.filter(function (item) { return item && item.isRegistered; }) : [];
    var openChecks = checks.filter(isOpenCheck);
    var nearChecks = openChecks.filter(function (item) { var days = checkDaysUntil(item); return days !== null && days <= 4; });
    var outgoingChecks = openChecks.filter(function (item) { return item.type === "expense"; });
    var receivedChecks = checks.filter(isReceivedCheck);
    var panel = createPanel(isSms ? "پیامبانک هوشمند" : "مدیریت چک‌ها", "بدون خروج از داشبورد");
    var content = panel.querySelector(".hesabno-dashboard-panel-content");
    if (isSms) {
      appendPanelRow(content, "صندوق پیامک‌ها", fa(inbox.length), function () { showList("sms", "صندوق پیامک‌ها", inbox); });
      appendPanelRow(content, "نیازمند ثبت", fa(smsItems.length), function () { showList("sms", "پیامک‌های نیازمند ثبت", smsItems); });
      appendPanelRow(content, "ثبت‌شده‌ها", fa(registeredSmsItems.length), function () { showList("sms", "پیامک‌های ثبت‌شده", registeredSmsItems); });
    } else {
      appendPanelRow(content, "چک سررسید نزدیک", fa(nearChecks.length), function () { showList("checks", "چک‌های سررسید نزدیک", nearChecks); });
      appendPanelRow(content, "پرداختی پیش‌رو", fa(outgoingChecks.length), function () { showList("checks", "چک‌های پرداختی پیش‌رو", outgoingChecks); });
      appendPanelRow(content, "چک‌های دریافتنی", fa(receivedChecks.length), function () { showList("checks", "چک‌های دریافتنی", receivedChecks); });
    }
  };
  var openChecks = function () { showPanel("checks"); };
  var openSms = function () { showPanel("sms"); };
  var getCheckCounts = function () {
    var transactions = read("hesabno:transactions", []);
    var checks = Array.isArray(transactions) ? transactions.filter(function (item) { return item && item.check; }) : [];
    var open = checks.filter(isOpenCheck);
    var near = open.filter(function (item) { var days = checkDaysUntil(item); return days !== null && days <= 4; });
    var outgoing = open.filter(function (item) { return item.type === "expense"; });
    var received = checks.filter(isReceivedCheck);
    return [near.length, outgoing.length, received.length];
  };
  var getSmsCounts = function () {
    var inbox = read("hesabno:payambank:inbox", []);
    if (!Array.isArray(inbox)) return [0, 0, 0];
    var pending = inbox.filter(function (item) { return item && !item.isRegistered; }).length;
    var registered = inbox.filter(function (item) { return item && item.isRegistered; }).length;
    return [inbox.length, pending, registered];
  };
  var formatNumbers = function (root, dashboardFont) {
    var hasDigits = /[0-9\u0660-\u0669\u06f0-\u06f9]/;
    var numericValue = /^(?:[+\-−]\s*)?(?:[%٪]\s*)?[0-9\u0660-\u0669\u06f0-\u06f9]+(?:[،,٫٬.:\/-][0-9\u0660-\u0669\u06f0-\u06f9]+)*[%٪]?(?:\s*(?:ریال|تومان))?$/;
    var numberFont = '"IRANSans", "IRANSansFaNum", "Vazirmatn", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    var setNumberFont = function (node) {
      node.classList.add("hesabno-unified-number-font");
      node.style.setProperty("font-family", numberFont, "important");
      node.style.setProperty("font-variant-numeric", "tabular-nums", "important");
    };
    root.querySelectorAll(".hesabno-unified-number-font").forEach(function (node) {
      var text = (node.textContent || "").trim();
      if (numericValue.test(text)) setNumberFont(node);
      else {
        node.classList.remove("hesabno-unified-number-font");
        node.style.setProperty("font-family", dashboardFont, "important");
        node.style.setProperty("font-variant-numeric", "normal", "important");
      }
    });
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, function (node) {
      return hasDigits.test(node.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    });
    var textNode;
    while ((textNode = walker.nextNode())) {
      var parent = textNode.parentElement;
      if (!parent || parent.closest("script,style,noscript,textarea,.hesabno-unified-number-font") || parent.isContentEditable) continue;
      if (!numericValue.test((parent.textContent || "").trim())) continue;
      setNumberFont(parent);
    }
  };
  var dashboardObserver = null;
  var buildCards = function (wrapper) {
    var counts = getCheckCounts();
    var smsCounts = getSmsCounts();
    wrapper.innerHTML = '<button type="button" class="hesabno-fixed-dashboard-card hesabno-fixed-check-card"><div class="hesabno-fixed-dashboard-card-header"><span class="hesabno-fixed-dashboard-card-title"><span>چک‌ها</span></span><span class="hesabno-fixed-dashboard-card-arrow">‹</span></div><div class="hesabno-fixed-dashboard-check-row"><span class="hesabno-fixed-dashboard-card-badge">' + fa(counts[0]) + '</span><span>چک سررسید نزدیک</span></div><div class="hesabno-fixed-dashboard-check-row"><span class="hesabno-fixed-dashboard-card-badge">' + fa(counts[1]) + '</span><span>پرداختی پیش‌رو</span></div><div class="hesabno-fixed-dashboard-check-row"><span class="hesabno-fixed-dashboard-card-badge">' + fa(counts[2]) + '</span><span>چک‌های دریافتنی</span></div></button><button type="button" class="hesabno-fixed-dashboard-card hesabno-fixed-sms-card"><div class="hesabno-fixed-dashboard-card-header"><span class="hesabno-fixed-dashboard-card-title"><span>پیامبانک</span></span><span class="hesabno-fixed-dashboard-card-arrow">‹</span></div><div class="hesabno-fixed-dashboard-sms-row"><span class="hesabno-fixed-dashboard-card-badge">' + fa(smsCounts[0]) + '</span><span>صندوق پیامک‌ها</span></div><div class="hesabno-fixed-dashboard-sms-row"><span class="hesabno-fixed-dashboard-card-badge">' + fa(smsCounts[1]) + '</span><span>نیازمند ثبت</span></div><div class="hesabno-fixed-dashboard-sms-row"><span class="hesabno-fixed-dashboard-card-badge">' + fa(smsCounts[2]) + '</span><span>ثبت‌شده‌ها</span></div></button>';
    var checkCard = wrapper.querySelector(".hesabno-fixed-check-card");
    var smsCard = wrapper.querySelector(".hesabno-fixed-sms-card");
    if (checkCard) checkCard.addEventListener("click", openChecks);
    if (smsCard) smsCard.addEventListener("click", openSms);
  };
  var enhance = function () {
    if (dashboardObserver) dashboardObserver.disconnect();
    try {
    var main = document.querySelector("main");
    var hero = main && main.querySelector(".dashboard-hero-card");
    if (!main || !hero) return;
    main.classList.add("hesabno-dashboard-main");
    var dashboardFont = '"Vazirmatn", system-ui, sans-serif';
    main.style.setProperty("font-family", dashboardFont, "important");
    main.querySelectorAll("*").forEach(function (node) {
      if (node.classList.contains("hesabno-unified-number-font")) return;
      node.style.setProperty("font-family", dashboardFont, "important");
    });
    var heroSub = hero.querySelector(".hero-sub");
    var balanceRow = hero.querySelector(".hero-balance-value") && hero.querySelector(".hero-balance-value").parentElement;
    if (heroSub && balanceRow) {
      heroSub.classList.add("hesabno-balance-source");
      var balanceKind = hero.querySelector(".hesabno-balance-kind");
      if (!balanceKind) {
        balanceKind = document.createElement("span");
        balanceKind.className = "hesabno-balance-kind";
        balanceRow.insertAdjacentElement("afterend", balanceKind);
      }
      if (balanceKind.textContent !== heroSub.textContent) balanceKind.textContent = heroSub.textContent;
    }
    var actionSection = main.querySelector(".dashboard-action-btn") && main.querySelector(".dashboard-action-btn").closest("section");
    if (actionSection) {
      actionSection.classList.add("hesabno-dashboard-action-grid");
      var checkAction = actionSection.querySelector(".action-checks");
      if (checkAction) checkAction.classList.add("hesabno-dashboard-check-action-hidden");
    }
    main.querySelectorAll("h2").forEach(function (heading) {
      var text = clean(heading.textContent);
      if (text !== "پیامبانک هوشمند" && text !== "یادآوری چک‌های صیادی") return;
      var section = heading.closest("section");
      if (section) section.classList.add("hesabno-dashboard-legacy-widget-hidden");
    });
    var wrapper = main.querySelector("#hesabno-fixed-dashboard-widgets");
    if (!wrapper) {
      wrapper = document.createElement("section");
      wrapper.id = "hesabno-fixed-dashboard-widgets";
      wrapper.className = "hesabno-fixed-dashboard-widgets";
      var anchor = actionSection;
      if (anchor && anchor.nextSibling) anchor.parentNode.insertBefore(wrapper, anchor.nextSibling);
      else if (anchor) anchor.parentNode.appendChild(wrapper);
      else return;
      buildCards(wrapper);
    }
    var signature = JSON.stringify([getCheckCounts(), getSmsCounts()]);
    if (wrapper.dataset.hesabnoSignature !== signature) {
      wrapper.dataset.hesabnoSignature = signature;
      buildCards(wrapper);
    }
    formatNumbers(main, dashboardFont);
    } finally {
      if (dashboardObserver && document.body) dashboardObserver.observe(document.body, { childList: true, subtree: true });
    }
  };
  dashboardObserver = new MutationObserver(enhance);
  if (document.body) dashboardObserver.observe(document.body, { childList: true, subtree: true });
  enhance();
  document.addEventListener("click", function (event) {
    var toggle = event.target && event.target.closest ? event.target.closest('button[title="تغییر نحوه محاسبه موجودی در صفحه داشبورد"]') : null;
    if (toggle) window.setTimeout(enhance, 80);
  }, true);
})();
