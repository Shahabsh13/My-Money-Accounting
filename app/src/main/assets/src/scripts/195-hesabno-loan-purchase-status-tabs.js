(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var purchaseMode = "active";
    /* قواعد کنتراست نام وام و تب‌های وضعیت در بستهٔ ۲۳۵ (لایهٔ ظاهر) قرار دارد. */
    var findMain = function () {
      return Array.from(document.querySelectorAll("main")).find(function (main) {
        var heading = clean(main.querySelector("h1") && main.querySelector("h1").textContent);
        return heading.indexOf("وام‌ها و تسهیلات") === 0 || heading.indexOf("خرید و اقساط") === 0;
      });
    };
    var findButton = function (main, prefix) {
      return Array.from(main.querySelectorAll("button")).find(function (button) {
        return clean(button.textContent).indexOf(prefix) === 0;
      }) || null;
    };
    var syncStatusButtonHeights = function (main) {
      var upperTab = findButton(main, "وام و تسهیلات");
      var height = upperTab && upperTab.getBoundingClientRect().height;
      if (!height) return;
      Array.from(main.querySelectorAll('[data-hesabno-status-button="true"]')).forEach(function (button) {
        button.style.setProperty("--hesabno-status-tab-height", height + "px");
      });
    };
    var hide = function (node) {
      if (!node) return;
      if (node.style.display !== "none") node.style.display = "none";
      if (node.getAttribute("aria-hidden") !== "true") node.setAttribute("aria-hidden", "true");
    };
    var countFrom = function (button) {
      var match = clean(button && button.textContent).match(/\(([^()]*)\)/);
      if (!match) return 0;
      var digits = match[1].replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); }).replace(/\D/g, "");
      return Number(digits) || 0;
    };
    var updateSummaryAndLoanCards = function (main, isPurchase) {
      Array.from(main.querySelectorAll("span")).forEach(function (span) {
        var text = clean(span.textContent);
        if (text.indexOf("وام فعال /") !== -1 || text.indexOf("مورد فعال /") !== -1) hide(span);
      });
      Array.from(main.querySelectorAll("h4")).forEach(function (title) {
        var installmentLabel = title.nextElementSibling;
        if (installmentLabel && clean(installmentLabel.textContent).indexOf("قسط ") === 0) title.setAttribute("data-hesabno-installment-name", "true");
      });
      if (isPurchase) {
        Array.from(main.querySelectorAll("div.rounded-3xl.p-4")).forEach(function (card) {
          if (clean(card.textContent).indexOf("تاریخ ثبت:") === -1) return;
          var title = card.querySelector("h3");
          if (title) title.setAttribute("data-hesabno-loan-name", "true");
        });
        return;
      }
      Array.from(main.querySelectorAll("p")).forEach(function (detail) {
        var text = clean(detail.textContent);
        if (text.indexOf("تاریخ دریافت:") !== 0) return;
        var date = text.match(/^تاریخ دریافت:\s*([^•]+)/);
        var installments = text.match(/•\s*([0-9۰-۹٠-٩٬,]+)\s*قسط/);
        if (!date || !installments) return;
        var simpleText = "تاریخ دریافت: " + date[1].trim() + " • " + installments[1] + " قسط";
        if (detail.textContent !== simpleText) detail.textContent = simpleText;
        var card = detail.closest(".rounded-3xl");
        var title = card && card.querySelector("h3");
        if (title) title.setAttribute("data-hesabno-loan-name", "true");
      });
    };
    var statusClass = function (selected) {
      return "w-full flex items-center justify-center px-3 py-1.5 rounded-xl text-xs font-bold transition " +
        (selected ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" : "bg-stone-800/80 text-stone-400 border border-stone-700/60");
    };
    var purchaseCards = function (main) {
      return Array.from(main.querySelectorAll("div")).filter(function (node) {
        return node.classList.contains("rounded-3xl") && node.classList.contains("p-4") && clean(node.textContent).includes("تاریخ ثبت:");
      });
    };
    // Reuse the app's all-items filter, then hide settled cards for the active view.
    var updatePurchaseCards = function (main) {
      var cards = purchaseCards(main), activeCount = 0;
      cards.forEach(function (card) {
        var completed = Array.from(card.querySelectorAll("span")).some(function (node) { return clean(node.textContent) === "تسویه شده"; });
        if (purchaseMode === "active" && completed) card.style.display = "none";
        else { card.style.display = ""; if (!completed) activeCount += 1; }
      });
      var empty = main.querySelector("[data-hesabno-active-purchases-empty]");
      if (cards.length && purchaseMode === "active" && activeCount === 0) {
        if (!empty) {
          empty = document.createElement("div");
          empty.setAttribute("data-hesabno-active-purchases-empty", "true");
          empty.className = "p-8 rounded-3xl bg-stone-850/60 border border-stone-800 text-center space-y-2 text-xs text-stone-400";
          empty.textContent = "موردی با اقساط در حال پرداخت یافت نشد.";
        }
        var list = cards[0].parentElement;
        if (list && (empty.parentElement !== list || list.firstElementChild !== empty)) list.insertBefore(empty, list.firstChild);
      } else if (empty) empty.remove();
    };
    var schedule = function () {};
    var makePurchaseTab = function (bar, mode) {
      var button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "tab");
      button.setAttribute("data-hesabno-purchase-status", mode);
      button.setAttribute("data-hesabno-status-button", "true");
      button.addEventListener("click", function (event) {
        event.preventDefault();
        purchaseMode = mode;
        var main = findMain();
        var original = main && findButton(main, mode === "active" ? "همه موارد (" : "تسویه شده (");
        if (original) original.click();
        if (main) updatePurchaseCards(main);
        schedule();
        window.setTimeout(schedule, 100);
      });
      bar.appendChild(button);
      return button;
    };
    var sync = function () {
      var main = findMain();
      if (!main) return;
      var heading = clean(main.querySelector("h1") && main.querySelector("h1").textContent);
      var isPurchase = heading.indexOf("خرید و اقساط") === 0;
      updateSummaryAndLoanCards(main, isPurchase);
      var listPrefix = isPurchase ? "لیست خریدها و صندوق‌ها" : "لیست وام‌ها";
      var schedulePrefix = isPurchase ? "زمان‌بندی اقساط خرید" : "زمان‌بندی اقساط وام";
      var listTab = findButton(main, listPrefix);
      var scheduleTab = findButton(main, schedulePrefix);
      var topTab = listTab || scheduleTab;
      if (topTab) {
        var group = topTab.parentElement;
        var header = group && group.parentElement;
        var hiddenTabs = header && header.classList.contains("border-b") ? header : group;
        hide(hiddenTabs);
        var isSchedule = scheduleTab && clean(scheduleTab.className).indexOf("text-white") !== -1;
        var backButton = main.querySelector("[data-hesabno-schedule-back]");
        if (isSchedule && hiddenTabs && hiddenTabs.parentElement) {
          if (!backButton) {
            backButton = document.createElement("button");
            backButton.type = "button";
            backButton.setAttribute("data-hesabno-schedule-back", "true");
            backButton.addEventListener("click", function (event) {
              event.preventDefault();
              var current = findMain();
              var currentHeading = clean(current && current.querySelector("h1") && current.querySelector("h1").textContent);
              var currentIsPurchase = currentHeading.indexOf("خرید و اقساط") === 0;
              var currentList = current && findButton(current, currentIsPurchase ? "لیست خریدها و صندوق‌ها" : "لیست وام‌ها");
              if (currentList) currentList.click();
            });
          }
          backButton.className = "w-full py-2.5 px-3 rounded-xl bg-purple-500/10 text-purple-700 border border-purple-500/25 text-xs font-bold flex items-center justify-center transition";
          backButton.textContent = isPurchase ? "بازگشت به فهرست خریدها" : "بازگشت به فهرست وام‌ها";
          if (backButton.parentElement !== hiddenTabs.parentElement || backButton.previousElementSibling !== hiddenTabs) hiddenTabs.after(backButton);
        } else if (backButton) backButton.remove();
      }
      if (!isPurchase) {
        var allLoans = findButton(main, "همه وام‌ها (");
        var activeLoans = findButton(main, "در حال بازپرداخت (") || findButton(main, "در حال پرداخت (");
        var completedLoans = findButton(main, "تسویه شده (");
        if (allLoans && activeLoans) {
          hide(allLoans);
          var loanStatusBar = activeLoans.parentElement;
          if (completedLoans && completedLoans.parentElement === loanStatusBar) {
            loanStatusBar.className = "grid grid-cols-2 gap-1.5 p-1 bg-stone-800/90 border border-stone-700/70 rounded-2xl w-full";
            loanStatusBar.setAttribute("data-hesabno-loan-status-bar", "true");
            activeLoans.setAttribute("data-hesabno-status-button", "true");
            completedLoans.setAttribute("data-hesabno-status-button", "true");
            activeLoans.classList.add("w-full");
            completedLoans.classList.add("w-full");
          }
          var activeText = "در حال پرداخت (" + countFrom(activeLoans).toLocaleString("fa-IR") + ")";
          if (activeLoans.textContent !== activeText) activeLoans.textContent = activeText;
          if (main.dataset.hesabnoLoanStatusTabsReady !== "true") {
            main.dataset.hesabnoLoanStatusTabsReady = "true";
            if (clean(activeLoans.className).indexOf("bg-sky-500/20") === -1) activeLoans.click();
          }
        }
        syncStatusButtonHeights(main);
        return;
      }
      var allPurchases = findButton(main, "همه موارد (");
      var completedPurchases = findButton(main, "تسویه شده (");
      if (!allPurchases || !completedPurchases || allPurchases.parentElement !== completedPurchases.parentElement) return;
      var originalBar = allPurchases.parentElement;
      hide(originalBar);
      var bar = main.querySelector("[data-hesabno-purchase-status-bar]");
      if (!bar) {
        bar = document.createElement("div");
        bar.setAttribute("data-hesabno-purchase-status-bar", "true");
        bar.setAttribute("role", "tablist");
        bar.setAttribute("aria-label", "وضعیت اقساط خرید");
        makePurchaseTab(bar, "active");
        makePurchaseTab(bar, "completed");
      }
      bar.className = "grid grid-cols-2 gap-1.5 p-1 bg-stone-800/90 border border-stone-700/70 rounded-2xl w-full";
      if (bar.parentElement !== originalBar.parentElement || bar.previousElementSibling !== originalBar) originalBar.after(bar);
      var activeTab = bar.querySelector('[data-hesabno-purchase-status="active"]');
      var completedTab = bar.querySelector('[data-hesabno-purchase-status="completed"]');
      var totalCount = countFrom(allPurchases), completedCount = countFrom(completedPurchases);
      if (activeTab) {
        activeTab.className = statusClass(purchaseMode === "active");
        var activeText = "در حال پرداخت (" + Math.max(0, totalCount - completedCount).toLocaleString("fa-IR") + ")";
        if (activeTab.textContent !== activeText) activeTab.textContent = activeText;
        activeTab.setAttribute("aria-selected", purchaseMode === "active" ? "true" : "false");
      }
      if (completedTab) {
        completedTab.className = statusClass(purchaseMode === "completed");
        var completedText = "تسویه شده (" + completedCount.toLocaleString("fa-IR") + ")";
        if (completedTab.textContent !== completedText) completedTab.textContent = completedText;
        completedTab.setAttribute("aria-selected", purchaseMode === "completed" ? "true" : "false");
      }
      if (main.dataset.hesabnoPurchaseStatusTabsReady !== "true") {
        main.dataset.hesabnoPurchaseStatusTabsReady = "true";
        purchaseMode = "active";
        allPurchases.click();
      }
      updatePurchaseCards(main);
      syncStatusButtonHeights(main);
    };
    var queued = false;
    schedule = function () {
      if (queued) return;
      queued = true;
      Promise.resolve().then(function () { queued = false; sync(); });
    };
    sync();
    document.addEventListener("click", function (event) {
      var main = findMain();
      if (main && main.contains(event.target)) {
        schedule();
        window.setTimeout(schedule, 0);
        window.setTimeout(schedule, 120);
      }
    }, true);
    window.addEventListener("resize", schedule);
    if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, characterData: true, subtree: true }, schedule);
  })();
