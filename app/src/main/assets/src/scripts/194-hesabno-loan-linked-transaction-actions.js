(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var readArray = function (key) {
      try {
        var raw = window.__safeGet ? window.__safeGet(key) : window.localStorage.getItem(key);
        var value = JSON.parse(raw || "null");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var isLoanLinked = function (transaction, loans, installments) {
      if (!transaction) return false;
      if (transaction.isLoanTransaction || transaction.loanId != null || transaction.installmentId != null) return true;
      var transactionId = String(transaction.id);
      var installmentList = Array.isArray(installments) ? installments : readArray("hesabno:installments");
      var loanList = Array.isArray(loans) ? loans : readArray("hesabno:loans");
      if (installmentList.some(function (item) {
        return item && item.transactionId != null && String(item.transactionId) === transactionId;
      })) return true;
      var installment = installmentList.find(function (item) {
        return item && item.id != null && transaction.installmentId != null && String(item.id) === String(transaction.installmentId);
      });
      var loanId = transaction.loanId != null ? transaction.loanId : installment && installment.loanId;
      return loanId != null && loanList.some(function (loan) { return loan && String(loan.id) === String(loanId); });
    };
    var transactionFor = function (card, transactions) {
      var prefix = "tx-card-";
      if (!card || !card.id || card.id.indexOf(prefix) !== 0) return null;
      var id = card.id.slice(prefix.length);
      return transactions.find(function (transaction) { return String(transaction.id) === id; }) || null;
    };
    var visibleButton = function (predicate) {
      return Array.from(document.querySelectorAll("button")).find(function (button) {
        return button.getClientRects().length > 0 && predicate(clean(button.textContent));
      }) || null;
    };
    var pageTitle = function () {
      var heading = document.querySelector("main h1");
      return clean(heading && heading.innerText);
    };
    var waitFor = function (predicate, timeout) {
      return new Promise(function (resolve) {
        var started = Date.now();
        var check = function () {
          if (predicate()) return resolve(true);
          if (Date.now() - started >= timeout) return resolve(false);
          window.setTimeout(check, 60);
        };
        check();
      });
    };
    var openingLoanManager = false;
    var openLoanManager = async function (transaction) {
      if (openingLoanManager) return;
      openingLoanManager = true;
      try {
        var installments = readArray("hesabno:installments");
        var installment = transaction.installmentId == null ? null : installments.find(function (item) {
          return String(item.id) === String(transaction.installmentId);
        });
        var loanId = transaction.loanId != null ? transaction.loanId : installment && installment.loanId;
        var loan = loanId == null ? null : readArray("hesabno:loans").find(function (item) {
          return String(item.id) === String(loanId);
        });
        var details = [loan && loan.type, loan && loan.loanType, loan && loan.category,
          installment && installment.type, installment && installment.category,
          transaction.loanType, transaction.category, transaction.title].filter(Boolean).join(" ");
        var isPurchase = /purchase|خرید|کالا|صندوق/i.test(details);
        var managerTitles = ["وام‌ها و تسهیلات", "خرید و اقساط"];
        if (managerTitles.indexOf(pageTitle()) === -1) {
          var more = visibleButton(function (text) { return text === "بیشتر"; });
          if (!more && pageTitle() !== "بیشتر و امکانات") {
            var home = visibleButton(function (text) { return text === "خانه"; });
            if (home) {
              home.click();
              await waitFor(function () { return !!visibleButton(function (text) { return text === "بیشتر"; }); }, 2500);
              more = visibleButton(function (text) { return text === "بیشتر"; });
            }
          }
          if (pageTitle() !== "بیشتر و امکانات" && more) {
            more.click();
            await waitFor(function () { return pageTitle() === "بیشتر و امکانات"; }, 3500);
          }
          var tile = visibleButton(function (text) { return text.indexOf("وام و خریدهای اقساطی") === 0; });
          if (tile) {
            tile.click();
            await waitFor(function () { return managerTitles.indexOf(pageTitle()) !== -1; }, 4000);
          } else {
            var shortcut = visibleButton(function (text) { return text === "مشاهده وام‌ها"; });
            if (shortcut) {
              shortcut.click();
              await waitFor(function () { return managerTitles.indexOf(pageTitle()) !== -1; }, 4000);
            }
          }
        }
        var targetTitle = isPurchase ? "خرید و اقساط" : "وام‌ها و تسهیلات";
        if (managerTitles.indexOf(pageTitle()) !== -1 && pageTitle() !== targetTitle) {
          var targetTab = visibleButton(function (text) { return text === (isPurchase ? "خرید و اقساط" : "وام و تسهیلات"); });
          if (targetTab) {
            targetTab.click();
            await waitFor(function () { return pageTitle() === targetTitle; }, 2500);
          }
        }
        if (transaction.installmentId != null && pageTitle() === targetTitle) {
          var scheduleTitle = isPurchase ? "زمان‌بندی اقساط خرید" : "زمان‌بندی اقساط وام";
          await waitFor(function () { return !!visibleButton(function (text) { return text.indexOf(scheduleTitle) === 0; }); }, 2500);
          var schedule = visibleButton(function (text) { return text.indexOf(scheduleTitle) === 0; });
          if (schedule && schedule.className.indexOf("text-white") === -1) schedule.click();
        }
      } finally {
        openingLoanManager = false;
      }
    };
    var update = function () {
      var transactions = readArray("hesabno:transactions");
      var loans = readArray("hesabno:loans");
      var installments = readArray("hesabno:installments");
      Array.from(document.querySelectorAll('article[id^="tx-card-"]')).forEach(function (card) {
        var transaction = transactionFor(card, transactions);
        if (!isLoanLinked(transaction, loans, installments)) return;
        card.dataset.hesabnoLoanLinkedTransaction = "true";
        var genericButtons = Array.from(card.querySelectorAll("button")).filter(function (button) {
          return ["ویرایش", "اصلاحی", "حذف", "حذف تراکنش", "پاک کردن"].indexOf(clean(button.textContent)) !== -1;
        });
        if (!genericButtons.length) return;
        var container = genericButtons[0].parentElement;
        if (!container) return;
        genericButtons.forEach(function (button) {
          if (button.dataset.hesabnoGenericLoanAction === "true") return;
          button.dataset.hesabnoGenericLoanAction = "true";
          button.style.display = "none";
          button.setAttribute("aria-hidden", "true");
          button.tabIndex = -1;
        });
        var action = card.querySelector('[data-hesabno-loan-manager-action="true"]');
        if (!action) {
          action = document.createElement("button");
          action.type = "button";
          action.setAttribute("data-hesabno-loan-manager-action", "true");
          action.className = "flex items-center justify-center gap-1 py-1 px-2.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border border-purple-500/30 font-bold text-[11px] transition cursor-pointer active:scale-98";
        }
        var isInstallment = transaction.installmentId != null;
        var actionLabel = isInstallment ? "مدیریت قسط" : "مدیریت وام";
        var actionTitle = isInstallment ? "رفتن به زمان‌بندی اقساط" : "رفتن به بخش وام‌ها";
        var actionAriaLabel = isInstallment ? "مدیریت قسط مرتبط" : "مدیریت وام مرتبط";
        if (action.textContent !== actionLabel) action.textContent = actionLabel;
        if (action.title !== actionTitle) action.title = actionTitle;
        if (action.getAttribute("aria-label") !== actionAriaLabel) action.setAttribute("aria-label", actionAriaLabel);
        if (action.parentElement !== container) container.appendChild(action);
      });
    };
    document.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("button") : null;
      if (!button) return;
      var card = button.closest('article[id^="tx-card-"]');
      if (!card) return;
      var transaction = transactionFor(card, readArray("hesabno:transactions"));
      if (!isLoanLinked(transaction, readArray("hesabno:loans"), readArray("hesabno:installments"))) return;
      if (button.getAttribute("data-hesabno-loan-manager-action") === "true") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openLoanManager(transaction);
        return;
      }
      if (["ویرایش", "اصلاحی", "حذف", "حذف تراکنش", "پاک کردن"].indexOf(clean(button.textContent)) !== -1) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    }, true);
    var queued = false;
    var schedule = function () {
      if (queued) return;
      queued = true;
      Promise.resolve().then(function () { queued = false; update(); });
    };
    update();
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, characterData: true, subtree: true });
    window.addEventListener("storage", schedule);
  })();
