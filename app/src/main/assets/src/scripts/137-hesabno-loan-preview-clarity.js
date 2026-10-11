(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var faDigits = "۰۱۲۳۴۵۶۷۸۹";
    var number = function (value) {
      var parsed = Number(String(value || "").replace(/[۰-۹]/g, function (digit) { return faDigits.indexOf(digit); }).replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    var format = function (value, unit) { return Math.round(value).toLocaleString("fa-IR") + " " + unit; };
    var setText = function (node, value) {
      value = String(value);
      if (node && node.textContent !== value) node.textContent = value;
    };
    var ensureStyles = function () {
      if (document.querySelector("style[data-hesabno-loan-preview-clarity-style]")) return;
      var style = document.createElement("style");
      style.setAttribute("data-hesabno-loan-preview-clarity-style", "true");
      style.textContent = "[data-hesabno-loan-preview-warning]{border-top-color:#c8d5de!important}[data-hesabno-loan-preview-warning] .hesabno-loan-preview-warning-label{color:#8a6512!important}[data-hesabno-loan-preview-warning] .hesabno-loan-preview-warning-text{color:#8a6512!important;font-weight:700!important}.hesabno-loan-preview-profit-value.is-positive{color:#167257!important}.hesabno-loan-preview-profit-value.is-negative{color:#b4233c!important}html[data-theme=\"dark\"] [data-hesabno-loan-preview-warning]{border-top-color:rgba(120,113,108,.35)!important}html[data-theme=\"dark\"] [data-hesabno-loan-preview-warning] .hesabno-loan-preview-warning-label{color:#fcd34d!important}html[data-theme=\"dark\"] [data-hesabno-loan-preview-warning] .hesabno-loan-preview-warning-text{color:#fde68a!important}";
      document.head.appendChild(style);
    };
    var findMain = function () {
      return Array.from(document.querySelectorAll("main")).find(function (main) {
        return clean(main.textContent).includes("ثبت وام بانکی و تسهیلات");
      });
    };
    var findFields = function (main) {
      if (!main) return null;
      var principal = main.querySelector('input[placeholder*="۵۰,۰۰۰,۰۰۰"]');
      var count = main.querySelector('input[placeholder*="۱۲"]');
      var installment = main.querySelector('input[placeholder="مبلغ قسط"]');
      return principal && count && installment ? { principal: principal, count: count, installment: installment } : null;
    };
    var findCard = function (main) {
      if (!main) return null;
      return Array.from(main.querySelectorAll("div")).find(function (node) {
        return node.classList.contains("p-3.5") && node.classList.contains("bg-stone-850") && clean(node.textContent).includes("مبلغ هر قسط:");
      });
    };
    var makeRow = function (card, marker, className) {
      var row = card.querySelector("[" + marker + "]");
      var isNew = !row;
      if (!row) {
        row = document.createElement("div");
        row.setAttribute(marker, "true");
      }
      row.className = className;
      if (row.children.length !== 2) {
        var label = document.createElement("span");
        label.className = "text-stone-400";
        var value = document.createElement("span");
        value.className = "font-bold text-stone-200 text-sm";
        row.replaceChildren(label, value);
      }
      if (isNew) card.appendChild(row);
      return { row: row, label: row.children[0], value: row.children[1] };
    };
    var ensureCard = function (main) {
      var card = findCard(main);
      if (!card) return null;
      var first = card.querySelector("[data-hesabno-loan-preview-installment]");
      if (!first) {
        first = Array.from(card.children).find(function (node) { return clean(node.textContent).startsWith("مبلغ هر قسط:"); });
        if (first) first.setAttribute("data-hesabno-loan-preview-installment", "true");
      }
      if (!first) return null;
      Array.from(card.children).forEach(function (node) {
        if (node !== first && !node.hasAttribute("data-hesabno-loan-preview-total") && !node.hasAttribute("data-hesabno-loan-preview-profit") && !node.hasAttribute("data-hesabno-loan-preview-warning") && (node.childElementCount === 0 || clean(node.textContent).startsWith("کل بازپرداخت (") || clean(node.textContent).startsWith("سود / کارمزد واقعی") || clean(node.textContent).includes("مجموع بازپرداخت کمتر از اصل فاکتور"))) node.remove();
      });
      var firstValue = first.children[1];
      if (!firstValue) {
        firstValue = document.createElement("span");
        first.appendChild(firstValue);
      }
      firstValue.className = "font-bold text-emerald-400 text-sm";
      var total = makeRow(card, "data-hesabno-loan-preview-total", "flex items-center justify-between border-t border-stone-800 pt-2");
      var profit = makeRow(card, "data-hesabno-loan-preview-profit", "flex items-center justify-between border-t border-stone-800 pt-2");
      profit.value.className = "font-bold text-sm hesabno-loan-preview-profit-value";
      var warning = card.querySelector("[data-hesabno-loan-preview-warning]");
      if (!warning) {
        warning = document.createElement("div");
        warning.setAttribute("data-hesabno-loan-preview-warning", "true");
        var warningLabel = document.createElement("span");
        warningLabel.className = "font-bold hesabno-loan-preview-warning-label";
        warningLabel.textContent = "هشدار:";
        var warningText = document.createElement("span");
        warningText.className = "text-right hesabno-loan-preview-warning-text";
        warningText.textContent = "مجموع بازپرداخت کمتر از اصل وام است";
        warning.append(warningLabel, warningText);
        card.appendChild(warning);
      }
      warning.className = "flex items-center justify-between gap-2 border-t border-stone-800 pt-2 text-[11px]";
      return { card: card, firstValue: firstValue, total: total, profit: profit, warning: warning };
    };
    var render = function () {
      var main = findMain(), fields = findFields(main), view = ensureCard(main);
      if (!main || !fields || !view) return;
      var principal = number(fields.principal.value);
      var count = Math.floor(number(fields.count.value));
      var installment = number(fields.installment.value);
      var unitNode = fields.installment.closest(".relative");
      var unit = clean(unitNode && unitNode.querySelector("span") && unitNode.querySelector("span").textContent) || "ریال";
      setText(view.firstValue, installment ? format(installment, unit) : "—");
      if (count && installment) {
        var total = Math.round(count * installment);
        setText(view.total.label, "کل بازپرداخت (" + count.toLocaleString("fa-IR") + " قسط):");
        setText(view.total.value, format(total, unit));
        view.profit.row.style.display = "flex";
        setText(view.profit.label, "سود / کارمزد واقعی:");
        if (principal) {
          var profit = Math.round(total - principal);
          setText(view.profit.value, format(profit, unit));
          view.profit.value.className = "font-bold text-sm hesabno-loan-preview-profit-value " + (profit < 0 ? "is-negative" : "is-positive");
        } else {
          setText(view.profit.value, "—");
          view.profit.value.className = "font-bold text-sm hesabno-loan-preview-profit-value";
        }
        view.warning.style.display = principal && total < principal ? "flex" : "none";
      } else {
        setText(view.total.label, "کل بازپرداخت:");
        setText(view.total.value, "—");
        view.profit.row.style.display = "none";
        view.warning.style.display = "none";
      }
      main.setAttribute("data-hesabno-loan-preview-ready", "true");
    };
    var scheduled = false;
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () {
        scheduled = false;
        render();
      });
    };
    var bind = function () {
      var main = findMain();
      if (!main || main.dataset.hesabnoLoanPreviewClarityBound) return;
      main.dataset.hesabnoLoanPreviewClarityBound = "true";
      main.addEventListener("input", schedule, true);
      main.addEventListener("change", schedule, true);
    };
    ensureStyles();
    bind();
    render();
    if (document.body) new MutationObserver(function () { bind(); schedule(); }).observe(document.body, { childList: true, subtree: true });
  })();
