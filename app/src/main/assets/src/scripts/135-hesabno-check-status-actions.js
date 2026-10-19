(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var read = function () {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions");
        var value = JSON.parse(raw || "[]");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    /* قاعدهٔ [data-hesabno-check-terminal='true'] [data-hesabno-check-pass] در بستهٔ ۲۳۵ است. */
    var ensureStyle = function () {};
    var confirmClick = function (button, message) {
      if (!button || button.dataset.hesabnoCheckConfirmBound === "true") return;
      button.dataset.hesabnoCheckConfirmBound = "true";
      button.addEventListener("click", function (event) {
        if (window.confirm(message)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);
    };
    var labelNode = function (button) {
      return button && (button.querySelector("span:last-child") || button.lastElementChild || button.lastChild);
    };
    var sync = function () {
      ensureStyle();
      var transactions = read();
      document.querySelectorAll("article[id^='tx-card-']").forEach(function (article) {
        var id = article.id.slice("tx-card-".length);
        var transaction = transactions.find(function (item) { return String(item && item.id) === id; });
        if (!transaction || !transaction.check) return;
        var status = clean(transaction.check.status).toLowerCase();
        var terminal = status === "bounced" || status === "refunded";
        if (terminal) article.setAttribute("data-hesabno-check-terminal", "true");
        else article.removeAttribute("data-hesabno-check-terminal");
        var buttons = Array.from(article.querySelectorAll("button"));
        var genericCorrection = buttons.find(function (button) { return button.title === "ثبت سند اصلاحی برای این سند" || button.hasAttribute("data-hesabno-check-hide-correction"); });
        if (genericCorrection && transaction.check) {
          if (!genericCorrection.hasAttribute("data-hesabno-check-original-display")) genericCorrection.setAttribute("data-hesabno-check-original-display", genericCorrection.style.display || "");
          if (!genericCorrection.hasAttribute("data-hesabno-check-original-tabindex")) genericCorrection.setAttribute("data-hesabno-check-original-tabindex", genericCorrection.getAttribute("tabindex") || "");
          genericCorrection.setAttribute("data-hesabno-check-hide-correction", "true");
          genericCorrection.setAttribute("aria-hidden", "true");
          genericCorrection.setAttribute("tabindex", "-1");
          genericCorrection.style.display = "none";
        } else if (genericCorrection && genericCorrection.hasAttribute("data-hesabno-check-hide-correction")) {
          var correctionDisplay = genericCorrection.getAttribute("data-hesabno-check-original-display");
          var correctionTabindex = genericCorrection.getAttribute("data-hesabno-check-original-tabindex");
          if (correctionDisplay) genericCorrection.style.display = correctionDisplay; else genericCorrection.style.removeProperty("display");
          if (correctionTabindex) genericCorrection.setAttribute("tabindex", correctionTabindex); else genericCorrection.removeAttribute("tabindex");
          genericCorrection.removeAttribute("aria-hidden");
          genericCorrection.removeAttribute("data-hesabno-check-hide-correction");
          genericCorrection.removeAttribute("data-hesabno-check-original-display");
          genericCorrection.removeAttribute("data-hesabno-check-original-tabindex");
        }
        var pass = buttons.find(function (button) { return clean(button.textContent).includes("پاس‌شدن چک و کسر از حساب"); });
        if (pass) {
          if (terminal) {
            if (!pass.hasAttribute("data-hesabno-check-original-tabindex")) pass.setAttribute("data-hesabno-check-original-tabindex", pass.getAttribute("tabindex") || "");
            pass.setAttribute("data-hesabno-check-pass", "true");
            pass.setAttribute("aria-hidden", "true");
            pass.setAttribute("tabindex", "-1");
            pass.style.display = "none";
          } else {
            pass.removeAttribute("data-hesabno-check-pass");
            pass.removeAttribute("aria-hidden");
            var originalTabindex = pass.getAttribute("data-hesabno-check-original-tabindex");
            if (originalTabindex) pass.setAttribute("tabindex", originalTabindex); else pass.removeAttribute("tabindex");
            pass.removeAttribute("data-hesabno-check-original-tabindex");
            pass.style.removeProperty("display");
          }
        }
        var returnButton = buttons.find(function (button) { return clean(button.textContent) === "برگشت زدن"; });
        confirmClick(returnButton, "آیا از برگشت‌زدن این چک مطمئن هستید؟ وضعیت چک به «برگشت‌خورده» تغییر می‌کند و گزینهٔ پاس‌شدن حذف می‌شود.");
        var resumeButton = buttons.find(function (button) {
          var text = clean(button.textContent);
          return text.includes("تغییر وضعیت به در جریان") || text.includes("برگشت به در جریان");
        });
        if (terminal && resumeButton) {
          var label = labelNode(resumeButton);
          if (label && clean(label.textContent) !== "برگشت به در جریان") label.textContent = "برگشت به در جریان";
          resumeButton.setAttribute("data-hesabno-check-resume", "true");
          confirmClick(resumeButton, transaction.check.debtCanceled === true
            ? "با بازگرداندن چک به وضعیت «در جریان»، لغو معامله هم برمی‌گردد و مبلغ دوباره در جمع روزانه حساب می‌شود. ادامه می‌دهید؟"
            : "آیا وضعیت این چک به «در جریان» برگردد؟");
        }
      });
    };
    sync();
    if (document.body) new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
  })();
